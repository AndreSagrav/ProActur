const config = require('../config');

class AIService {
  constructor() {
    this.geminiModel = config.GEMINI_MODEL || 'gemini-3.6-flash';
    this.openRouterModel = config.OPENROUTER_MODEL || 'deepseek/deepseek-chat';
    this.groqModel = config.GROQ_CHAT_MODEL || 'openai/gpt-oss-120b';
    this.timeoutMs = 120000;
  }

  getAvailableProviders() {
    return {
      gemini: {
        name: 'Google Gemini',
        model: this.geminiModel,
        configured: Boolean(config.GEMINI_API_KEY),
        type: 'multimodal (audio nativo + texto)'
      },
      openrouter: {
        name: 'OpenRouter (DeepSeek / Claude / GPT)',
        model: this.openRouterModel,
        configured: Boolean(config.OPENROUTER_API_KEY),
        type: 'razonamiento avanzado y síntesis'
      },
      groq: {
        name: 'Groq LPU (Ultra-Fast)',
        model: this.groqModel,
        configured: Boolean(config.GROQ_API_KEY),
        type: 'inferencia ultrarrápida + whisper'
      }
    };
  }

  buildMeetingPrompt(meetingTitle, rawText) {
    return `
Eres Proactor AI, un asistente ejecutivo y compañero de equipo proactivo de clase mundial.
Tu trabajo es escuchar/leer esta reunión y generar un análisis exhaustivo, estructurado y de alto impacto.

${rawText ? `Notas o transcripción previa provista:\n${rawText}\n` : ''}

Debes responder ÚNICAMENTE con un objeto JSON válido (sin markdown, sin bloques de código \`\`\`json, solo el JSON puro) con la siguiente estructura exacta:
{
  "title": "${meetingTitle || 'Título conciso y profesional de la reunión'}",
  "summary": "Resumen ejecutivo de 2 o 3 párrafos claros y directos",
  "keyTopics": ["Tema 1", "Tema 2", "Tema 3"],
  "keyDecisions": [
    "Decisión 1 acordada",
    "Decisión 2 acordada"
  ],
  "actionItems": [
    {
      "task": "Descripción clara de la tarea a realizar",
      "assignee": "Nombre del responsable (o 'Por asignar' si no se especifica)",
      "priority": "Alta | Media | Baja",
      "deadline": "Fecha límite o 'Pendiente de definir'",
      "completed": false
    }
  ],
  "proactiveAdvice": [
    "Consejo proactivo o alerta de riesgo que el equipo debería considerar para esta reunión"
  ],
  "transcript": "Transcripción textual completa y limpia de lo hablado o notas de la reunión",
  "tags": ["Categoría1", "Categoría2"]
}
`;
  }

  cleanJsonResponse(rawText) {
    if (!rawText) throw new Error('No se recibió texto de respuesta del modelo.');
    const cleaned = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed.actionItems)) {
      parsed.actionItems = parsed.actionItems.map(item => ({
        ...item,
        completed: Boolean(item.completed)
      }));
    }
    return parsed;
  }


  buildLivePrompt(meetingTitle, currentTranscript, previousContext) {
    return `
Eres Proactor AI trabajando EN TIEMPO REAL durante una reunión en vivo.
Tu trabajo es escuchar activamente la conversación y extraer al instante:
1. Resumen de lo que se lleva tratado.
2. Decisiones clave tomadas en este momento.
3. Compromisos y tareas (Action Items) asignados a personas con prioridad y plazos.
4. Consejos proactivos y alertas de riesgo en vivo para los participantes.

Título de la reunión: ${meetingTitle || 'Reunión en vivo'}
Contexto acumulado previo:
- Tareas ya identificadas: ${JSON.stringify(previousContext?.actionItems || [])}
- Decisiones previas: ${JSON.stringify(previousContext?.keyDecisions || [])}

Transcripción o fragmento hablado hasta ahora:
"""
${currentTranscript}
"""

Devuelve ÚNICAMENTE un JSON puro (sin bloques markdown) con este formato exacto:
{
  "summary": "Resumen ejecutivo actualizado de lo conversado hasta ahora",
  "keyTopics": ["Tema 1", "Tema 2"],
  "keyDecisions": ["Decisión tomada 1", "Decisión tomada 2"],
  "actionItems": [
    {
      "task": "Descripción de la tarea acordada",
      "assignee": "Responsable o 'Por asignar'",
      "priority": "Alta | Media | Baja",
      "deadline": "Fecha límite o 'Pendiente'",
      "completed": false
    }
  ],
  "proactiveAdvice": [
    "Alerta proactiva o recomendación estratégica para el equipo en tiempo real"
  ]
}
`;
  }

  async analyzeLiveMeeting({ meetingTitle, transcript, audioBuffer, mimeType, previousContext }) {
    const key = config.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY no configurada');

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent`;
    const prompt = this.buildLivePrompt(meetingTitle, transcript, previousContext);
    const parts = [];

    if (audioBuffer) {
      parts.push({
        inlineData: {
          mimeType: mimeType || 'audio/webm',
          data: audioBuffer.toString('base64')
        }
      });
    }
    parts.push({ text: prompt });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': key
        },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json'
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timer);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini Live Error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const contentText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return this.cleanJsonResponse(contentText);
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  // --- 1. LLAMADA CON GEMINI (Multimodal Audio & Texto) ---
  async processWithGemini({ audioBuffer, mimeType, rawText, meetingTitle }) {
    const key = config.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY no configurada');

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent`;
    const prompt = this.buildMeetingPrompt(meetingTitle, rawText);
    const parts = [];

    if (audioBuffer) {
      parts.push({
        inlineData: {
          mimeType: mimeType || 'audio/webm',
          data: audioBuffer.toString('base64')
        }
      });
    }
    parts.push({ text: prompt });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': key
        },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json'
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timer);

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Error Gemini (${response.status}): ${errText}`);
      }

      const data = await response.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return this.cleanJsonResponse(raw);
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  // --- 2. LLAMADA CON OPENROUTER (Texto / Notas) ---
  async processWithOpenRouter({ rawText, meetingTitle }) {
    const key = config.OPENROUTER_API_KEY;
    if (!key) throw new Error('OPENROUTER_API_KEY no configurada');

    const prompt = this.buildMeetingPrompt(meetingTitle, rawText);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
          'HTTP-Referer': 'https://vercel.app',
          'X-Title': 'Proactor AI'
        },
        body: JSON.stringify({
          model: this.openRouterModel,
          messages: [
            { role: 'system', content: 'Eres un asistente ejecutivo experto en estructurar minutas de reunión en formato JSON estricto.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' }
        }),
        signal: controller.signal
      });

      clearTimeout(timer);
      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Error OpenRouter (${response.status}): ${err}`);
      }

      const data = await response.json();
      const raw = data.choices?.[0]?.message?.content;
      return this.cleanJsonResponse(raw);
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  // --- 3. LLAMADA CON GROQ (Inferencia Rápida) ---
  async processWithGroq({ rawText, meetingTitle }) {
    const key = config.GROQ_API_KEY;
    if (!key) throw new Error('GROQ_API_KEY no configurada');

    const prompt = this.buildMeetingPrompt(meetingTitle, rawText);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: this.groqModel,
          messages: [
            { role: 'system', content: 'Eres un asistente ejecutivo que responde estrictamente en JSON.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' }
        }),
        signal: controller.signal
      });

      clearTimeout(timer);
      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Error Groq (${response.status}): ${err}`);
      }

      const data = await response.json();
      const raw = data.choices?.[0]?.message?.content;
      return this.cleanJsonResponse(raw);
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  /**
   * Router Inteligente de Procesamiento de Reuniones (con auto-fallback)
   */
  async processMeeting(options) {
    const { audioBuffer } = options;

    // Si hay audioBuffer, Gemini es el motor nativo ideal
    if (audioBuffer) {
      return await this.processWithGemini(options);
    }

    // Si es texto, intentamos según preferencia con fallback en cascada
    const attempts = [];
    if (config.OPENROUTER_API_KEY) attempts.push('openrouter');
    if (config.GROQ_API_KEY) attempts.push('groq');
    if (config.GEMINI_API_KEY) attempts.push('gemini');

    let lastError = null;
    for (const provider of attempts) {
      try {
        if (provider === 'openrouter') return await this.processWithOpenRouter(options);
        if (provider === 'groq') return await this.processWithGroq(options);
        if (provider === 'gemini') return await this.processWithGemini(options);
      } catch (err) {
        console.warn(`[AI] Falló ${provider}: ${err.message}. Intentando siguiente proveedor...`);
        lastError = err;
      }
    }

    throw lastError || new Error('No hay proveedores de IA configurados o disponibles.');
  }

  /**
   * Segundo Cerebro: Chat cruzado inteligente
   */
  async askSecondBrain(question, meetingsList) {
    const recentMeetings = (meetingsList || []).slice(0, 20);
    const context = recentMeetings.map((m, idx) => `
Reunión #${idx + 1}:
Título: ${m.title}
Fecha: ${m.createdAt || m.date}
Resumen: ${m.summary}
Decisiones: ${(m.keyDecisions || []).join('; ')}
Tareas: ${(m.actionItems || []).map(a => `${a.task} [Resp: ${a.assignee}] [Estado: ${a.completed ? 'Completada' : 'Pendiente'}]`).join('; ')}
Consejos: ${(m.proactiveAdvice || []).join('; ')}
---
`).join('\n');

    const prompt = `
Eres el "Segundo Cerebro" (Second Brain) de Proactor AI.
Tienes acceso al historial de reuniones del usuario.

Historial de Reuniones:
${context || 'No hay reuniones previas registradas aún.'}

Pregunta del usuario:
"${question}"

Instrucciones:
1. Responde de forma concisa, ejecutiva, profesional y citando específicamente qué reunión, fecha o responsable está relacionado.
2. Si la información no aparece en las reuniones registradas, indícalo cortésmente y sugiere qué buscar o registrar.
`;

    // Intentar con OpenRouter (DeepSeek) primero si está disponible
    if (config.OPENROUTER_API_KEY) {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.OPENROUTER_API_KEY}`,
            'HTTP-Referer': 'https://vercel.app',
            'X-Title': 'Proactor AI'
          },
          body: JSON.stringify({
            model: this.openRouterModel,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3
          })
        });
        if (res.ok) {
          const data = await res.json();
          const ans = data.choices?.[0]?.message?.content;
          if (ans) return ans;
        }
      } catch (err) {
        console.warn('[SecondBrain] Fallback desde OpenRouter a Gemini:', err.message);
      }
    }

    // Fallback con Gemini
    const key = config.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY no configurada');

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3 }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Error en API de Gemini (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta generada';
  }
}

module.exports = new AIService();
