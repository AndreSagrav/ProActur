const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const aiService = require('../services/aiService');
const notionService = require('../services/notionService');
const storageService = require('../services/storageService');
const { checkSupabaseStatus, keepAliveSupabase } = require('../services/supabaseClient');
const eventService = require('../services/eventService');
const noteService = require('../services/noteService');

const router = express.Router();

// Configurar multer para subida de audio (seguro para serverless)
const uploadDir = process.env.VERCEL ? path.join('/tmp', 'uploads') : path.join(__dirname, '..', '..', 'uploads');
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (err) {
  // Manejo silencioso en filesystem de solo lectura
}

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// Health check ampliado con Supabase y estado de proveedores de IA
// Supabase Keep-Alive Endpoint para Vercel Cron, GitHub Actions y Heartbeat proactivo
router.get('/keep-alive', async (req, res) => {
  try {
    const result = await keepAliveSupabase();
    const statusCode = result.success || !result.configured ? 200 : 500;
    res.status(statusCode).json({
      status: result.success ? 'ok' : 'warning',
      timestamp: new Date().toISOString(),
      service: 'ProActur Supabase Keep-Alive',
      ...result
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/health', async (req, res) => {
  try {
    const supabaseStatus = await checkSupabaseStatus();
    const providers = (typeof aiService.getAvailableProviders === "function") ? aiService.getAvailableProviders() : ["gemini"];

    res.json({
      status: 'ok',
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      activeAiModel: aiService.geminiModel,
      aiProviders: providers,
      supabase: supabaseStatus,
      hasNotionKey: Boolean(process.env.NOTION_API_KEY),
      hasNotionDb: Boolean(process.env.NOTION_DATABASE_ID)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener todas las reuniones
router.get('/meetings', async (req, res) => {
  try {
    const meetings = await storageService.getAllMeetings();
    res.json(meetings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener una reunión por ID
router.get('/meetings/:id', async (req, res) => {
  try {
    const meeting = await storageService.getMeetingById(req.params.id);
    if (!meeting) return res.status(404).json({ error: 'Reunión no encontrada' });
    res.json(meeting);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Actualizar campos o tareas de una reunión (PATCH)
router.patch('/meetings/:id', async (req, res) => {
  try {
    const { actionItems, title, summary, keyDecisions } = req.body;
    const updated = await storageService.updateMeeting(req.params.id, {
      ...(actionItems !== undefined && { actionItems }),
      ...(title !== undefined && { title }),
      ...(summary !== undefined && { summary }),
      ...(keyDecisions !== undefined && { keyDecisions })
    });

    if (!updated) {
      return res.status(404).json({ error: 'Reunión no encontrada' });
    }

    res.json(updated);
  } catch (err) {
    console.error('[API] Error actualizando reunión:', err);
    res.status(500).json({ error: err.message });
  }
});

// Eliminar una reunión
router.delete('/meetings/:id', async (req, res) => {
  try {
    await storageService.deleteMeeting(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Procesar reunión desde Audio (Micrófono o Archivo)

// Analizar fragmento de reunion en tiempo real (Live Meeting AI Copilot)
router.post('/meetings/live-analyze', upload.single('audio'), async (req, res) => {
  try {
    const { title, transcript, userNotes, previousContext, audioBase64, audioMimeType } = req.body;
    let prev = null;
    if (previousContext) {
      try { prev = typeof previousContext === 'string' ? JSON.parse(previousContext) : previousContext; } catch (_) {}
    }

    // Soportar audio vía multipart (req.file) O vía JSON base64
    let audioBuffer = req.file ? req.file.buffer : null;
    let mimeType = req.file ? req.file.mimetype : null;

    if (!audioBuffer && audioBase64) {
      try {
        audioBuffer = Buffer.from(audioBase64, 'base64');
        mimeType = audioMimeType || 'audio/webm';
      } catch (_) {}
    }

    if (!transcript && !audioBuffer && (!userNotes || !userNotes.trim())) {
      return res.status(400).json({ error: 'Se requiere transcripción, fragmento de audio o notas escritas para analizar.' });
    }

    const liveAnalysis = await aiService.analyzeLiveMeeting({
      meetingTitle: title,
      transcript: transcript || '',
      audioBuffer,
      mimeType,
      userNotes: userNotes || "",
      previousContext: prev
    });

    res.json(liveAnalysis);
  } catch (err) {
    console.error('[Live Meeting AI] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Finalizar y guardar reunion analizada en vivo (con titulación automática por IA)
router.post('/meetings/live-finalize', async (req, res) => {
  try {
    const meetingData = req.body;
    let finalTitle = meetingData.title;

    // Si el usuario no especificó un título manual claro, la IA lo genera a partir del contexto
    if (!finalTitle || aiService.isGenericTitle(finalTitle)) {
      if (meetingData.aiTitle && !aiService.isGenericTitle(meetingData.aiTitle)) {
        finalTitle = meetingData.aiTitle;
      } else {
        try {
          const generated = await aiService.generateExecutiveTitle({
            transcript: meetingData.transcript,
            summary: meetingData.summary,
            keyTopics: meetingData.keyTopics,
            userNotes: meetingData.userNotes
          });
          if (generated) finalTitle = generated;
        } catch (titleErr) {
          console.warn('[Live Finalize] Error generando título por IA:', titleErr.message);
        }
      }
    }

    if (!finalTitle || aiService.isGenericTitle(finalTitle)) {
      finalTitle = 'Reunión Ejecutiva ' + new Date().toLocaleDateString('es-ES');
    }

    const saved = await storageService.saveMeeting({
      title: finalTitle,
      summary: meetingData.summary || 'Resumen de reunion analizada en vivo por ProActur AI',
      keyTopics: meetingData.keyTopics || [],
      keyDecisions: meetingData.keyDecisions || [],
      actionItems: meetingData.actionItems || [],
      proactiveAdvice: meetingData.proactiveAdvice || [],
      transcript: meetingData.transcript || '',
      source: 'live-meeting',
      createdAt: new Date().toISOString()
    });

    res.json(saved);
  } catch (err) {
    console.error('[Live Meeting Finalize] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Procesar audio de reunión (con titulación contextual por IA)
router.post('/meetings/process-audio', upload.single('audio'), async (req, res) => {
  try {
    const { audioBase64, audioMimeType } = req.body || {};

    // Soportar audio vía multipart (req.file) O vía JSON base64
    let audioBuffer = req.file ? req.file.buffer : null;
    let mimeType = req.file ? (req.file.mimetype || 'audio/webm') : null;

    if (!audioBuffer && audioBase64) {
      try {
        audioBuffer = Buffer.from(audioBase64, 'base64');
        mimeType = audioMimeType || 'audio/webm';
      } catch (_) {}
    }

    if (!audioBuffer) {
      return res.status(400).json({ error: 'No se envió ningún archivo de audio.' });
    }

    const rawTitle = req.body.title;
    const meetingTitle = (rawTitle && !aiService.isGenericTitle(rawTitle)) ? rawTitle : null;

    console.log(`[ProActur AI] Procesando audio de reunión: ${audioBuffer.length} bytes (${mimeType})`);

    const result = await aiService.processMeeting({
      audioBuffer,
      mimeType,
      meetingTitle
    });

    // Si no había título explícito o el resultado no trajo uno, generamos uno ejecutivo a partir del contexto
    let finalTitle = result.title || meetingTitle;
    if (!finalTitle || aiService.isGenericTitle(finalTitle)) {
      try {
        const generated = await aiService.generateExecutiveTitle({
          summary: result.summary,
          keyTopics: result.keyTopics,
          transcript: result.transcript
        });
        if (generated) finalTitle = generated;
      } catch (_) {}
    }

    if (!finalTitle) {
      finalTitle = 'Reunión Grabada ' + new Date().toLocaleDateString('es-ES');
    }

    // Guardar la reunión analizada en Supabase y local
    const saved = await storageService.saveMeeting({
      ...result,
      title: finalTitle,
      source: 'audio',
      audioSize: req.file ? req.file.size : (audioBuffer ? audioBuffer.length : 0)
    });

    res.json(saved);
  } catch (err) {
    console.error('[ProActur AI] Error procesando audio:', err);
    res.status(500).json({ error: err.message });
  }
});

// Procesar reunión desde Texto / Minuta previa (con titulación contextual por IA)
router.post('/meetings/process-text', async (req, res) => {
  try {
    const { rawText, title } = req.body;
    if (!rawText || !rawText.trim()) {
      return res.status(400).json({ error: 'El texto o notas de la reunión están vacíos.' });
    }

    const rawTitle = title;
    const meetingTitle = (rawTitle && !aiService.isGenericTitle(rawTitle)) ? rawTitle : null;

    console.log(`[ProActur AI] Analizando notas de reunión con IA...`);

    const result = await aiService.processMeeting({
      rawText,
      meetingTitle
    });

    let finalTitle = result.title || meetingTitle;
    if (!finalTitle || aiService.isGenericTitle(finalTitle)) {
      try {
        const generated = await aiService.generateExecutiveTitle({
          summary: result.summary,
          keyTopics: result.keyTopics,
          transcript: rawText
        });
        if (generated) finalTitle = generated;
      } catch (_) {}
    }

    if (!finalTitle) {
      finalTitle = 'Minuta de Trabajo ' + new Date().toLocaleDateString('es-ES');
    }

    const saved = await storageService.saveMeeting({
      ...result,
      title: finalTitle,
      source: 'text'
    });

    res.json(saved);
  } catch (err) {
    console.error('[ProActur AI] Error procesando texto:', err);
    res.status(500).json({ error: err.message });
  }
});

// FUSIONAR Y SINTETIZAR MÚLTIPLES SESIONES (CAPACITACIONES / SERIES) CON IA
router.post('/meetings/merge', async (req, res) => {
  try {
    const { meetingIds, directive } = req.body || {};
    if (!Array.isArray(meetingIds) || meetingIds.length < 2) {
      return res.status(400).json({ error: 'Se requieren al menos 2 reuniones para realizar la fusión.' });
    }

    const allMeetings = await storageService.getMeetings();
    const meetingsToMerge = allMeetings.filter(m => meetingIds.includes(m.id));

    if (meetingsToMerge.length < 2) {
      return res.status(404).json({ error: 'No se encontraron las reuniones seleccionadas para fusionar.' });
    }

    console.log(`[ProActur AI] Fusionando ${meetingsToMerge.length} sesiones con IA...`);

    const mergedData = await aiService.mergeMeetings({
      meetings: meetingsToMerge,
      directive: directive || ''
    });

    const saved = await storageService.saveMeeting({
      ...mergedData,
      source: 'merged-series',
      createdAt: new Date().toISOString()
    });

    res.json(saved);
  } catch (err) {
    console.error('[Meeting Merge Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// Sincronizar reunión con Notion
router.post('/meetings/:id/sync-notion', async (req, res) => {
  try {
    const meeting = await storageService.getMeetingById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ error: 'Reunión no encontrada' });
    }

    const { apiKey, databaseId } = req.body || {};

    const syncResult = await notionService.syncMeetingToNotion(meeting, {
      apiKey,
      databaseId
    });

    const updated = await storageService.updateMeeting(meeting.id, {
      notionSync: {
        syncedAt: new Date().toISOString(),
        pageId: syncResult.id,
        url: syncResult.url
      }
    });

    res.json({
      success: true,
      url: syncResult.url,
      meeting: updated
    });
  } catch (err) {
    console.error('[ProActur AI] Error sincronizando con Notion:', err);
    res.status(500).json({ error: err.message });
  }
});

// Probar conexión con Notion
router.post('/notion/test', async (req, res) => {
  try {
    const { apiKey, databaseId } = req.body;
    const result = await notionService.testConnection(apiKey, databaseId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Consulta al Segundo Cerebro (Cross-meeting & Notebook Chat)
router.post('/second-brain/ask', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Pregunta requerida' });
    }

    const allMeetings = await storageService.getAllMeetings();
    let allNotes = [];
    try {
      allNotes = await noteService.getAllNotes();
    } catch (e) {
      console.warn('[SecondBrain] Error cargando notas para contexto:', e.message);
    }

    const answer = await aiService.askSecondBrain(question, allMeetings, allNotes);

    res.json({
      question,
      answer,
      totalMeetingsAnalyzed: allMeetings.length,
      totalNotesAnalyzed: allNotes.length
    });
  } catch (err) {
    console.error('[ProActur AI] Error en Second Brain:', err);
    res.status(500).json({ error: err.message });
  }
});


// ==========================================
// EVENTOS / AGENDA
// ==========================================

router.get('/events', async (req, res) => {
  try {
    const { month, year } = req.query;
    const events = await eventService.getAllEvents(
      month ? parseInt(month) : undefined,
      year ? parseInt(year) : undefined
    );
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/events/:id', async (req, res) => {
  try {
    const event = await eventService.getEventById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Evento no encontrado' });
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/events', async (req, res) => {
  try {
    const event = await eventService.createEvent(req.body);
    res.status(201).json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/events/:id', async (req, res) => {
  try {
    const updated = await eventService.updateEvent(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Evento no encontrado' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/events/:id', async (req, res) => {
  try {
    await eventService.deleteEvent(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/events/:id/link', async (req, res) => {
  try {
    const { meetingId } = req.body;
    const updated = await eventService.linkMeeting(req.params.id, meetingId);
    if (!updated) return res.status(404).json({ error: 'Evento no encontrado' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// NOTAS / LIBRETA
// ==========================================

router.get('/notes', async (req, res) => {
  try {
    const { filter, search } = req.query;
    const filters = {};
    if (filter === 'favorite') filters.favorite = true;
    if (filter === 'meeting') filters.meetingLinked = true;
    if (search) filters.search = search;
    const notes = await noteService.getAllNotes(filters);
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/notes/:id', async (req, res) => {
  try {
    const note = await noteService.getNoteById(req.params.id);
    if (!note) return res.status(404).json({ error: 'Nota no encontrada' });
    res.json(note);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/notes', async (req, res) => {
  try {
    const note = await noteService.createNote(req.body);
    res.status(201).json(note);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/notes/:id', async (req, res) => {
  try {
    const updated = await noteService.updateNote(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Nota no encontrada' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/notes/:id', async (req, res) => {
  try {
    await noteService.deleteNote(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/notes/:id/favorite', async (req, res) => {
  try {
    const updated = await noteService.toggleFavorite(req.params.id);
    if (!updated) return res.status(404).json({ error: 'Nota no encontrada' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Preguntar a la IA sobre una reunión específica
router.post('/meetings/:id/ask', async (req, res) => {
  try {
    const { question, meetingData } = req.body;
    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Pregunta requerida' });
    }

    let meeting = meetingData;
    if (!meeting || !meeting.title) {
      meeting = await storageService.getMeetingById(req.params.id);
    }

    if (!meeting) {
      return res.status(404).json({ error: 'Reunión no encontrada' });
    }

    const answer = await aiService.askMeeting(question, meeting);
    res.json({
      question,
      answer,
      meetingId: req.params.id,
      meetingTitle: meeting.title
    });
  } catch (err) {
    console.error('[Meeting Ask Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

