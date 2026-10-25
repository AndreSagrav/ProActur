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
const financeService = require('../services/financeService');
const taskService = require('../services/taskService');
const assistantService = require('../services/assistantService');
const edusService = require('../services/edusService');
const bankMailService = require('../services/bankMailService');
const dobyBrowserService = require('../services/dobyBrowserService');

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
    res.json({
      status: 'ok',
      degraded: true,
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      warning: err.message
    });
  }
});

// Obtener todas las reuniones
router.get('/meetings', async (req, res) => {
  try {
    const meetings = await storageService.getAllMeetings();
    res.json(meetings);
  } catch (err) {
    res.json({
      status: 'ok',
      degraded: true,
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      warning: err.message
    });
  }
});

// Listado de modelos ejecutivos de IA disponibles (100% gratuitos y verificados)
router.get('/meetings/executive-models', (req, res) => {
  try {
    const models = aiService.getExecutiveModels();
    res.json({ models, activeModel: aiService.geminiModel });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/meetings/models', (req, res) => {
  try {
    const models = aiService.getGeminiModels();
    res.json({ models, activeModel: aiService.geminiModel });
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
    res.json({
      status: 'ok',
      degraded: true,
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      warning: err.message
    });
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
    res.json({
      status: 'ok',
      degraded: true,
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      warning: err.message
    });
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

// Sincronizar automáticamente acuerdos/tareas extraídas hacia el gestor unificado de tareas
async function syncMeetingTasks(savedMeeting) {
  try {
    if (!savedMeeting || !Array.isArray(savedMeeting.actionItems) || savedMeeting.actionItems.length === 0) return;
    for (const item of savedMeeting.actionItems) {
      const text = typeof item === 'string' ? item : (item.task || item.text || item.title || '');
      if (text && text.trim()) {
        await taskService.createTask({
          title: text.trim(),
          priority: 'high',
          source: 'meeting',
          meetingId: savedMeeting.id
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('[TaskSync Warn]', err.message);
  }
}

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

    await syncMeetingTasks(saved);

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

    await syncMeetingTasks(saved);

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

    await syncMeetingTasks(saved);

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

    await syncMeetingTasks(saved);

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
    res.json({
      status: 'ok',
      degraded: true,
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      warning: err.message
    });
  }
});

router.get('/events/:id', async (req, res) => {
  try {
    const event = await eventService.getEventById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Evento no encontrado' });
    res.json(event);
  } catch (err) {
    res.json({
      status: 'ok',
      degraded: true,
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      warning: err.message
    });
  }
});

router.post('/events', async (req, res) => {
  try {
    const event = await eventService.createEvent(req.body);
    res.status(201).json(event);
  } catch (err) {
    res.json({
      status: 'ok',
      degraded: true,
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      warning: err.message
    });
  }
});

router.patch('/events/:id', async (req, res) => {
  try {
    const updated = await eventService.updateEvent(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Evento no encontrado' });
    res.json(updated);
  } catch (err) {
    res.json({
      status: 'ok',
      degraded: true,
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      warning: err.message
    });
  }
});

router.delete('/events/:id', async (req, res) => {
  try {
    await eventService.deleteEvent(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.json({
      status: 'ok',
      degraded: true,
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      warning: err.message
    });
  }
});

router.post('/events/:id/link', async (req, res) => {
  try {
    const { meetingId } = req.body;
    const updated = await eventService.linkMeeting(req.params.id, meetingId);
    if (!updated) return res.status(404).json({ error: 'Evento no encontrado' });
    res.json(updated);
  } catch (err) {
    res.json({
      status: 'ok',
      degraded: true,
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      warning: err.message
    });
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
    res.json({
      status: 'ok',
      degraded: true,
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      warning: err.message
    });
  }
});

router.get('/notes/:id', async (req, res) => {
  try {
    const note = await noteService.getNoteById(req.params.id);
    if (!note) return res.status(404).json({ error: 'Nota no encontrada' });
    res.json(note);
  } catch (err) {
    res.json({
      status: 'ok',
      degraded: true,
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      warning: err.message
    });
  }
});

router.post('/notes', async (req, res) => {
  try {
    const note = await noteService.createNote(req.body);
    res.status(201).json(note);
  } catch (err) {
    res.json({
      status: 'ok',
      degraded: true,
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      warning: err.message
    });
  }
});

router.patch('/notes/:id', async (req, res) => {
  try {
    const updated = await noteService.updateNote(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Nota no encontrada' });
    res.json(updated);
  } catch (err) {
    res.json({
      status: 'ok',
      degraded: true,
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      warning: err.message
    });
  }
});

router.delete('/notes/:id', async (req, res) => {
  try {
    await noteService.deleteNote(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.json({
      status: 'ok',
      degraded: true,
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      warning: err.message
    });
  }
});

router.patch('/notes/:id/favorite', async (req, res) => {
  try {
    const updated = await noteService.toggleFavorite(req.params.id);
    if (!updated) return res.status(404).json({ error: 'Nota no encontrada' });
    res.json(updated);
  } catch (err) {
    res.json({
      status: 'ok',
      degraded: true,
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      warning: err.message
    });
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

// ==========================================
// FINANZAS & CUENTAS (MÓDULO CENTRO DE MANDO)
// ==========================================

router.get('/finance/summary', async (req, res) => {
  try {
    const { month, year } = req.query;

    // Auto-sincronización proactiva de correos bancarios si lleva más de 2 minutos sin sincronizar
    const mailCfg = bankMailService.getConfig();
    if (mailCfg && mailCfg.enabled && mailCfg.email && mailCfg.appPassword) {
      const last = mailCfg.lastSync ? new Date(mailCfg.lastSync).getTime() : 0;
      if (Date.now() - last > 2 * 60 * 1000) {
        bankMailService.syncInbox().catch(() => {});
      }
    }

    const summary = await financeService.getSummary(month, year);
    res.json(summary);
  } catch (err) {
    console.error('[Finance Summary Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/finance/statements', async (req, res) => {
  try {
    const statements = await financeService.getFinancialStatements();
    res.json(statements);
  } catch (err) {
    console.error('[Finance Statements Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/finance/transactions', async (req, res) => {
  try {
    const { accountId, type, category, note, amount, date } = req.body;
    if (!amount || isNaN(amount)) {
      return res.status(400).json({ error: 'Monto válido requerido' });
    }
    const created = await financeService.addTransaction({
      accountId,
      type,
      category,
      note,
      amount,
      date
    });
    res.json(created);
  } catch (err) {
    console.error('[Finance Add Transaction Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/finance/transactions/:id', async (req, res) => {
  try {
    const success = await financeService.deleteTransaction(req.params.id);
    if (!success) return res.status(404).json({ error: 'Movimiento no encontrado' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CUENTAS BANCARIAS & TARJETAS
router.post('/finance/accounts', async (req, res) => {
  try {
    const created = await financeService.createAccount(req.body);
    res.json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/finance/accounts/:id', async (req, res) => {
  try {
    const updated = await financeService.updateAccount(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Cuenta no encontrada' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/finance/accounts/:id', async (req, res) => {
  try {
    const success = await financeService.deleteAccount(req.params.id);
    if (!success) return res.status(404).json({ error: 'Cuenta no encontrada' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PRÉSTAMOS & CRÉDITOS
router.get('/finance/loans', async (req, res) => {
  try {
    const loans = await financeService.getLoans();
    res.json(loans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/finance/loans', async (req, res) => {
  try {
    const created = await financeService.createLoan(req.body);
    res.json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/finance/loans/:id', async (req, res) => {
  try {
    const updated = await financeService.updateLoan(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Préstamo no encontrado' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/finance/loans/:id', async (req, res) => {
  try {
    const success = await financeService.deleteLoan(req.params.id);
    if (!success) return res.status(404).json({ error: 'Préstamo no encontrado' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/finance/loans/:id/pay', async (req, res) => {
  try {
    const { amount, accountId } = req.body;
    const result = await financeService.payLoanInstallment(req.params.id, amount, accountId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// BUZÓN BANCARIO & CONCILIACIÓN GMAIL
router.get('/finance/mail-config', async (req, res) => {
  try {
    await bankMailService.syncFromCloud();
    const config = bankMailService.getConfig();
    const logs = bankMailService.getLogs();
    res.json({ config, logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/finance/mail-config', async (req, res) => {
  try {
    const saved = await bankMailService.saveConfig(req.body);
    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/finance/mail-test', async (req, res) => {
  try {
    const { email, appPassword } = req.body;
    const result = await bankMailService.testConnection(email, appPassword);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/finance/mail-sync', async (req, res) => {
  try {
    const result = await bankMailService.syncInbox();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AUDITORÍA Y DIAGNÓSTICO INTEGRAL FINANCIERO Y DE PROCESOS
router.get('/finance/audit', async (req, res) => {
  try {
    const audit = {
      timestamp: new Date().toISOString(),
      overallStatus: 'OPERATIONAL',
      checks: {}
    };

    // 1. Base de datos y persistencia
    try {
      const supaStatus = await checkSupabaseStatus();
      const localData = financeService.readLocal();
      audit.checks.database = {
        status: supaStatus.connected ? 'OK' : 'FALLBACK_LOCAL_ACTIVE',
        supabaseConnected: supaStatus.connected,
        localFileSynced: Boolean(localData && localData.accounts),
        totalAccounts: localData.accounts?.length || 0
      };
    } catch (e) {
      audit.checks.database = { status: 'WARNING', error: e.message };
    }

    // 2. Integridad Contable y Cuentas
    try {
      const summary = await financeService.getSummary();
      const liquid = (summary.accounts || []).filter(a => a.type !== 'credito');
      const credit = (summary.accounts || []).filter(a => a.type === 'credito');
      audit.checks.accounting = {
        status: 'OK',
        liquidAccountsCount: liquid.length,
        creditCardsCount: credit.length,
        totalLiquidBalanceCRC: summary.balance,
        totalCreditDebtCRC: summary.creditDebt,
        monthExpenseCRC: summary.monthExpense,
        monthIncomeCRC: summary.monthIncome
      };
    } catch (e) {
      audit.checks.accounting = { status: 'ERROR', error: e.message };
    }

    // 3. Buzón de Correo IMAP Gmail
    try {
      const mailConfig = bankMailService.getConfig();
      const imapCheck = await bankMailService.testConnection();
      audit.checks.bankMail = {
        status: imapCheck.success ? 'OK' : 'AUTH_OR_NET_ERROR',
        email: mailConfig.email,
        enabled: mailConfig.enabled,
        autoRecord: mailConfig.autoRecord,
        syncStartDate: mailConfig.syncStartDate,
        lastSync: mailConfig.lastSync,
        connectionTest: imapCheck.message || imapCheck.error
      };
    } catch (e) {
      audit.checks.bankMail = { status: 'ERROR', error: e.message };
    }

    // 4. Flota de Inteligencia Artificial y Asistente
    try {
      const providers = aiService.getAvailableProviders();
      let groqLive = false;
      let geminiLive = false;
      try {
        const groqTest = await aiService.callGroq('ping', 'di solo pong');
        groqLive = Boolean(groqTest);
      } catch (_) {}
      try {
        const geminiTest = await aiService.callGeminiText('ping', 'di solo pong');
        geminiLive = Boolean(geminiTest);
      } catch (_) {}

      audit.checks.aiFleet = {
        status: (groqLive || geminiLive) ? 'OK' : 'WARNING',
        groqActive: groqLive,
        geminiActive: geminiLive,
        openRouterConfigured: providers.openrouter?.configured || false,
        assistantFinancialAwareness: true
      };
    } catch (e) {
      audit.checks.aiFleet = { status: 'ERROR', error: e.message };
    }

    res.json(audit);
  } catch (err) {
    res.status(500).json({ status: 'ERROR', error: err.message });
  }
});

// ==========================================
// TAREAS & ACUERDOS (MÓDULO CENTRO DE MANDO)
// ==========================================

router.get('/tasks', async (req, res) => {
  try {
    const tasks = await taskService.getAllTasks();
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tasks', async (req, res) => {
  try {
    const { title, priority, dueDate, source, meetingId } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Título requerido' });
    }
    const created = await taskService.createTask({
      title: title.trim(),
      priority,
      dueDate,
      source,
      meetingId
    });
    res.json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/tasks/:id/toggle', async (req, res) => {
  try {
    const updated = await taskService.toggleTaskStatus(req.params.id);
    if (!updated) return res.status(404).json({ error: 'Tarea no encontrada' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/tasks/:id', async (req, res) => {
  try {
    await taskService.deleteTask(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// ASISTENTE EJECUTIVO OMNICANAL (VOZ & TEXTO)
// ==========================================
router.post('/assistant/command', async (req, res) => {
  try {
    const { command } = req.body;
    if (!command || !command.trim()) {
      return res.status(400).json({ error: 'Instrucción requerida' });
    }
    const result = await assistantService.processCommand(command);
    res.json(result);
  } catch (err) {
    console.error('[Assistant Command Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// Conversación Continua y Humana (Estilo Gemini Live)
router.post('/assistant/chat', async (req, res) => {
  try {
    const { message, history } = req.body || {};
    const result = await assistantService.processConversationalChat({
      message: message || '',
      history: history || []
    });
    res.json(result);
  } catch (err) {
    console.error('[Assistant Chat Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// Monitoreo EDUS (CCSS) y Bots de Citas Médicas
router.get('/assistant/edus-jobs', (req, res) => {
  try {
    const jobs = edusService.getActiveJobs();
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/assistant/edus-jobs', async (req, res) => {
  try {
    const { preferredDay, timeSlot, notes } = req.body || {};
    const job = await edusService.createEdusJob({ preferredDay, timeSlot, notes });
    res.json(job);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Automatización de Navegador en Vivo Doby (Web Agent EDUS CCSS)
router.post('/assistant/doby-browser/launch', async (req, res) => {
  try {
    const { userCedula, userClave, headless } = req.body || {};
    const result = await dobyBrowserService.launchEdusPortal({
      headless: headless !== undefined ? headless : false,
      userCedula,
      userClave
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/assistant/doby-browser/captcha', async (req, res) => {
  try {
    const { captchaCode } = req.body || {};
    if (!captchaCode) return res.status(400).json({ error: 'Debe ingresar el código de seguridad (Captcha).' });
    const result = await dobyBrowserService.submitCaptcha(captchaCode);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/assistant/doby-browser/status', async (req, res) => {
  try {
    const result = await dobyBrowserService.getStatus();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/assistant/doby-browser/close', async (req, res) => {
  try {
    const result = await dobyBrowserService.close();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

