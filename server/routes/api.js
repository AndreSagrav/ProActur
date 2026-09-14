const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const aiService = require('../services/aiService');
const notionService = require('../services/notionService');
const storageService = require('../services/storageService');
const { checkSupabaseStatus } = require('../services/supabaseClient');

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
router.get('/health', async (req, res) => {
  try {
    const supabaseStatus = await checkSupabaseStatus();
    const providers = aiService.getAvailableProviders();

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
router.post('/meetings/process-audio', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se envió ningún archivo de audio.' });
    }

    const meetingTitle = req.body.title || 'Reunión Grabada ' + new Date().toLocaleString('es-ES');
    const mimeType = req.file.mimetype || 'audio/webm';

    console.log(`[Proactor AI] Procesando audio de reunión: ${req.file.size} bytes (${mimeType})`);

    const result = await aiService.processMeeting({
      audioBuffer: req.file.buffer,
      mimeType,
      meetingTitle
    });

    // Guardar la reunión analizada en Supabase y local
    const saved = await storageService.saveMeeting({
      ...result,
      source: 'audio',
      audioSize: req.file.size
    });

    res.json(saved);
  } catch (err) {
    console.error('[Proactor AI] Error procesando audio:', err);
    res.status(500).json({ error: err.message });
  }
});

// Procesar reunión desde Texto / Minuta previa
router.post('/meetings/process-text', async (req, res) => {
  try {
    const { rawText, title } = req.body;
    if (!rawText || !rawText.trim()) {
      return res.status(400).json({ error: 'El texto o notas de la reunión están vacíos.' });
    }

    console.log(`[Proactor AI] Analizando notas de reunión con IA...`);

    const result = await aiService.processMeeting({
      rawText,
      meetingTitle: title
    });

    const saved = await storageService.saveMeeting({
      ...result,
      source: 'text'
    });

    res.json(saved);
  } catch (err) {
    console.error('[Proactor AI] Error procesando texto:', err);
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
    console.error('[Proactor AI] Error sincronizando con Notion:', err);
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

// Consulta al Segundo Cerebro (Cross-meeting Chat)
router.post('/second-brain/ask', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Pregunta requerida' });
    }

    const allMeetings = await storageService.getAllMeetings();
    const answer = await aiService.askSecondBrain(question, allMeetings);

    res.json({
      question,
      answer,
      totalMeetingsAnalyzed: allMeetings.length
    });
  } catch (err) {
    console.error('[Proactor AI] Error en Second Brain:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
