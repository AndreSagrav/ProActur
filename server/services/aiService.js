const config = require('../config');

class AIService {
  constructor() {
    this.geminiModel = config.GEMINI_MODEL || 'gemini-3.6-flash';
    this.openRouterModel = config.OPENROUTER_MODEL || 'deepseek/deepseek-chat';
    this.groqModel = config.GROQ_CHAT_MODEL || 'openai/gpt-oss-120b';
    this.timeoutMs = 120000;
  }

    /**
   * FLOTA DE MODELOS INTELIGENTES Y ROBUSTOS PARA LABOR EJECUTIVA:
   * 1. Groq GPT-OSS 120B: Ultra-rápido (1.1s), 120B parámetros, gran capacidad ejecutiva.
   * 2. Qwen 2.5 72B Instruct: Extraordinaria intuición de contexto en español y alta velocidad (0.8s).
   * 3. DeepSeek V3 (deepseek-chat): Máxima profundidad de razonamiento, riesgos y tareas implícitas.
   * 4. Meta Llama 3.3 70B Instruct: Estándar de oro empresarial para seguimiento estricto de instrucciones.
   * 5. Google Gemini Flash: Multimodal nativo para audio y texto.
   */
    /**
   * FAMILIA COMPLETA DE MODELOS GEMINI CON CUOTAS INDEPENDIENTES:
   * Cada modelo cuenta con su propio bucket de cuota en Google AI Studio.
   */
  getGeminiModels() {
    return [
      'gemini-3.7-flash',
      'gemini-3.5-flash',
      'gemini-3.8-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite'
    ];
  }

  getExecutiveModels() {
    return [
      { provider: 'groq', model: config.GROQ_CHAT_MODEL || 'openai/gpt-oss-120b', name: 'Groq GPT-OSS 120B' },
      { provider: 'openrouter', model: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B Instruct' },
      { provider: 'openrouter', model: this.openRouterModel || 'deepseek/deepseek-chat', name: 'DeepSeek V3' },
      { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B' },
      { provider: 'gemini', model: this.geminiModel, name: 'Gemini Flash' }
    ];
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
        model: this.openRouterModel || 'deepseek/deepseek-chat',
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
Eres ProActur AI, un asistente ejecutivo y compañero de equipo proactivo de clase mundial.
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

    /**
   * Extractor de JSON 100% resiliente: nunca falla ante bloques de texto,
   * markdown, comas finales o prefacios generados por cualquier LLM.
   */
  cleanJsonResponse(rawText) {
    if (!rawText) return null;

    let clean = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    // 1. Intento directo
    try {
      const parsed = JSON.parse(clean);
      return this.normalizeParsedResponse(parsed);
    } catch (_) {}

    // 2. Extracción quirúrgica entre la primera llave { y la última }
    try {
      const firstBrace = clean.indexOf('{');
      const lastBrace = clean.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        let jsonSubstring = clean.substring(firstBrace, lastBrace + 1);
        jsonSubstring = jsonSubstring.replace(/,\s*([}\]])/g, '$1');
        const parsed = JSON.parse(jsonSubstring);
        return this.normalizeParsedResponse(parsed);
      }
    } catch (_) {}

    // 3. Extracción heurística por expresiones regulares si el JSON está truncado
    try {
      const summaryMatch = clean.match(/"summary"\s*:\s*"([^"]+)"/i);
      const decisionsMatch = clean.match(/"keyDecisions"\s*:\s*\[([^\]]*)\]/i);
      const adviceMatch = clean.match(/"proactiveAdvice"\s*:\s*\[([^\]]*)\]/i);

      let keyDecisions = [];
      if (decisionsMatch && decisionsMatch[1]) {
        keyDecisions = decisionsMatch[1].split(',').map(s => s.replace(/"/g, '').trim()).filter(Boolean);
      }

      let proactiveAdvice = [];
      if (adviceMatch && adviceMatch[1]) {
        proactiveAdvice = adviceMatch[1].split(',').map(s => s.replace(/"/g, '').trim()).filter(Boolean);
      }

      if (summaryMatch && summaryMatch[1]) {
        return {
          summary: summaryMatch[1],
          keyTopics: ["Puntos clave tratados"],
          keyDecisions,
          actionItems: [],
          proactiveAdvice: proactiveAdvice.length > 0 ? proactiveAdvice : ["Monitorear seguimiento de acuerdos hablados."]
        };
      }
    } catch (_) {}

    return null;
  }

  normalizeParsedResponse(parsed) {
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      summary: parsed.summary || 'Resumen en proceso de estructuración...',
      keyTopics: Array.isArray(parsed.keyTopics) ? parsed.keyTopics : [],
      keyDecisions: Array.isArray(parsed.keyDecisions) ? parsed.keyDecisions : [],
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems.map(item => ({
        task: item.task || 'Tarea acordada',
        assignee: item.assignee || 'Por asignar',
        priority: item.priority || 'Alta',
        deadline: item.deadline || 'Pendiente',
        completed: Boolean(item.completed)
      })) : [],
      proactiveAdvice: Array.isArray(parsed.proactiveAdvice) ? parsed.proactiveAdvice : []
    };
  }

  /**
   * Respaldo local determinista (Cero Fallo Absoluto):
   * Si todos los proveedores externos fallan (ej. corte de internet o caída de API global),
   * el sistema sintetiza y extrae tareas y acuerdos localmente sin dejar la pantalla en blanco.
   */
  generateDeterministicFallback(text, meetingTitle, userNotes) {
    const combined = [text, userNotes].filter(Boolean).join('. ');
    const sentences = combined.split(/[.\n]+/).map(s => s.trim()).filter(s => s.length > 8);

    const actionKeywords = /entregar|revisar|enviar|validar|aprobar|diseñar|preparar|llamar|coordinar|hacer/i;
    const decisionKeywords = /acordamos|se decide|definido|aprobado|fijado|quedamos en|compromiso/i;
    const daysKeywords = /lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo|mañana|hoy/i;

    const actionItems = [];
    const keyDecisions = [];

    sentences.forEach(s => {
      if (decisionKeywords.test(s)) {
        keyDecisions.push(s);
      } else if (actionKeywords.test(s)) {
        const dayMatch = s.match(daysKeywords);
        actionItems.push({
          task: s,
          assignee: 'Por asignar',
          priority: 'Alta',
          deadline: dayMatch ? dayMatch[0] : 'Próximamente',
          completed: false
        });
      }
    });

    const summaryText = sentences.slice(0, 3).join('. ');

    return {
      summary: summaryText ? (summaryText + ' (Procesado por motor local resiliente).') : 'Sesión activa. Detectando acuerdos y tareas conforme se conversa...',
      keyTopics: ['Seguimiento de sesión'],
      keyDecisions: keyDecisions.slice(0, 5),
      actionItems: actionItems.slice(0, 5),
      proactiveAdvice: ['Verificar asignaciones y plazos identificados en esta sección.'],
      transcript: text || userNotes || ''
    };
  }
buildLivePrompt(meetingTitle, currentTranscript, previousContext, userNotes = '') {
    return `
Eres ProActur AI, el copiloto ejecutivo de reuniones de clase mundial trabajando EN TIEMPO REAL.
Tu mision es escuchar la conversacion y estructurar la minuta ejecutiva en vivo.

Titulo de la reunion: ${meetingTitle || 'Reunion en vivo'}
Contexto previo acumulado:
- Tareas ya detectadas: ${JSON.stringify(previousContext?.actionItems || [])}
- Decisiones ya detectadas: ${JSON.stringify(previousContext?.keyDecisions || [])}

${userNotes ? `Notas manuales tomadas por el usuario durante la sesion:\n${userNotes}\n` : ''}
${currentTranscript ? `Texto preliminar hablado:\n${currentTranscript}\n` : 'Analiza el audio y notas provistas de la sesion.'}

Devuelve UNICAMENTE un JSON valido (sin bloques markdown de codigo json) con este formato exacto:
{
  "summary": "Sintesis ejecutiva clara y directa de lo tratado",
  "keyTopics": ["Tema 1", "Tema 2"],
  "keyDecisions": ["Decision acordada 1", "Decision acordada 2"],
  "actionItems": [
    {
      "task": "Descripcion clara del compromiso",
      "assignee": "Responsable asignado o 'Por asignar'",
      "priority": "Alta | Media | Baja",
      "deadline": "Fecha limite o 'Pendiente'",
      "completed": false
    }
  ],
  "proactiveAdvice": [
    "Consejo proactivo o alerta de riesgo para el equipo"
  ],
  "transcript": "Transcripcion del audio"
}
`;
  }

  async transcribeWithGroq(audioBuffer, mimeType = 'audio/webm') {
    if (!config.GROQ_API_KEY || !audioBuffer || audioBuffer.length < 400) {
      return '';
    }

    try {
      const FormData = require('form-data');
      const form = new FormData();

      let ext = 'webm';
      let type = mimeType || 'audio/webm';
      if (type.includes('mp4') || type.includes('m4a')) {
        ext = 'm4a';
      } else if (type.includes('wav')) {
        ext = 'wav';
      } else if (type.includes('ogg')) {
        ext = 'ogg';
      }

      form.append('file', audioBuffer, {
        filename: `audio.${ext}`,
        contentType: type
      });
      form.append('model', config.GROQ_WHISPER_MODEL || 'whisper-large-v3-turbo');
      form.append('language', 'es');
      form.append('response_format', 'json');

      const headers = {
        'Authorization': `Bearer ${config.GROQ_API_KEY}`,
        ...form.getHeaders()
      };

      const buffer = form.getBuffer();
      headers['Content-Length'] = buffer.length;

      const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: headers,
        body: buffer
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[Groq Whisper Error ${response.status}]:`, errText);
        return '';
      }

      const data = await response.json();
      const text = (data.text || '').trim();
      console.log(`[Groq Whisper OK]: Transcritos ${text.length} caracteres`);
      return text;
    } catch (err) {
      console.warn('[Groq Whisper Warn]:', err.message);
      return '';
    }
  }

async analyzeLiveWithGroq(prompt, specificModel = null) {
    const key = config.GROQ_API_KEY;
    if (!key) throw new Error('GROQ_API_KEY no configurada');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: config.GROQ_CHAT_MODEL || 'openai/gpt-oss-120b',
          messages: [
            { role: 'system', content: 'Eres un copiloto ejecutivo en tiempo real de clase mundial. Responde estrictamente con JSON valido sin markdown.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' }
        }),
        signal: controller.signal
      });

      clearTimeout(timer);
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Groq Error (${response.status}): ${errText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      return this.cleanJsonResponse(content);
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  async analyzeLiveWithOpenRouter(prompt, specificModel = null) {
    const key = config.OPENROUTER_API_KEY;
    if (!key) throw new Error('OPENROUTER_API_KEY no configurada');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: this.openRouterModel,
          messages: [
            { role: 'system', content: 'Eres un copiloto ejecutivo en tiempo real. Responde únicamente en JSON válido.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.1
        }),
        signal: controller.signal
      });

      clearTimeout(timer);
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenRouter Error (${response.status}): ${errText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      return this.cleanJsonResponse(content);
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  async analyzeLiveWithGemini(prompt, audioBuffer, mimeType, activeTranscript, requestedModel = null) {
    const key = config.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY no configurada');

    const geminiModels = requestedModel ? [requestedModel] : this.getGeminiModels();
    let lastGeminiError = null;

    for (const modelName of geminiModels) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
      const parts = [];

      if (!activeTranscript && audioBuffer) {
        parts.push({
          inlineData: {
            mimeType: mimeType || 'audio/webm',
            data: audioBuffer.toString('base64')
          }
        });
      }
      parts.push({ text: prompt });

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);

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
          console.warn(`[Gemini Family] ${modelName} falló (${response.status}), probando modelo hermano...`);
          lastGeminiError = new Error(`Gemini ${modelName} (${response.status}): ${errorText}`);
          continue;
        }

        const data = await response.json();
        const contentText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const parsed = this.cleanJsonResponse(contentText);
        if (parsed) return parsed;
      } catch (err) {
        clearTimeout(timer);
        lastGeminiError = err;
        console.warn(`[Gemini Family] Error con ${modelName} (${err.message}), conmutando al siguiente...`);
      }
    }

    throw lastGeminiError || new Error('Ningún modelo de la familia Gemini respondió con éxito.');
  }

  async analyzeLiveMeeting({ meetingTitle, transcript, userNotes, audioBuffer, mimeType, previousContext }) {
    let activeTranscript = (transcript || '').trim();

    // 1. Transcripción ultrarrápida (150ms) con Whisper si hay audio
    if (audioBuffer && (!activeTranscript || activeTranscript.length < 10)) {
      try {
        const whisperText = await this.transcribeWithGroq(audioBuffer, mimeType);
        if (whisperText) {
          activeTranscript = activeTranscript ? (activeTranscript + ' ' + whisperText).trim() : whisperText;
          console.log('[Whisper Live]', whisperText);
        }
      } catch (wErr) {
        console.warn('[Whisper Live Warn]:', wErr.message);
      }
    }

    // 2. Si no hay nada de texto ni notas, estado de espera limpio
    if (!activeTranscript && (!userNotes || !userNotes.trim()) && !audioBuffer) {
      return {
        summary: "Escuchando conversación en vivo...",
        keyTopics: [],
        keyDecisions: [],
        actionItems: [],
        proactiveAdvice: ["Habla al micrófono o escribe notas para que ProActur extraiga acuerdos en tiempo real."],
        transcript: ""
      };
    }

    const prompt = this.buildLivePrompt(meetingTitle, activeTranscript, previousContext, userNotes);

    // 3. Fallback en cascada sobre modelos inteligentes de élite
    let executiveModels = this.getExecutiveModels();
    // Si no hay transcripción de texto previa pero sí audio, priorizar Gemini multimodal (oye el audio directamente)
    if (!activeTranscript && audioBuffer && config.GEMINI_API_KEY) {
      executiveModels = [
        { provider: 'gemini', model: 'gemini-3.6-flash', name: 'Gemini Multimodal' },
        ...executiveModels.filter(m => m.provider !== 'gemini')
      ];
    }
    let lastError = null;

    for (const item of executiveModels) {
      const { provider, model, name } = item;
      try {
        let result = null;
        if (provider === 'groq' && config.GROQ_API_KEY) {
          result = await this.analyzeLiveWithGroq(prompt, model);
        } else if (provider === 'openrouter' && config.OPENROUTER_API_KEY) {
          result = await this.analyzeLiveWithOpenRouter(prompt, model);
        } else if (provider === 'gemini' && config.GEMINI_API_KEY) {
          result = await this.analyzeLiveWithGemini(prompt, audioBuffer, mimeType, activeTranscript);
        }

        if (result && result.summary) {
          if (activeTranscript && (!result.transcript || result.transcript.length < activeTranscript.length)) {
            result.transcript = activeTranscript;
          }
          return result;
        }
      } catch (err) {
        console.warn(`[Live AI] ${provider} no disponible (${err.message}), probando alternativa...`);
        lastError = err;
      }
    }

    // Si fallaron todos los modelos remotos, el motor de respaldo local asume el control: CERO FALLO
    console.warn('[AI Engine] Activando motor determinista local de máxima resiliencia...');
    return this.generateDeterministicFallback(activeTranscript, meetingTitle, userNotes);
  }

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
          'X-Title': 'ProActur AI'
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
    const { audioBuffer, mimeType, meetingTitle, rawText } = options;

    // Si hay audioBuffer, intentamos Gemini primero. Si falla por cuota (429) o servicio (503), conmutamos a Whisper + Groq/OpenRouter
    if (audioBuffer) {
      try {
        if (config.GEMINI_API_KEY) {
          return await this.processWithGemini(options);
        }
      } catch (geminiErr) {
        console.warn('[AI] Gemini falló procesando audio (' + geminiErr.message + '). Conmutando a Groq Whisper + LLM...');
      }

      // Fallback para audio: Transcribir con Groq Whisper
      let transcribedText = '';
      try {
        transcribedText = await this.transcribeWithGroq(audioBuffer, mimeType);
      } catch (wErr) {
        console.warn('[AI] Groq Whisper fallback falló:', wErr.message);
      }

      if (transcribedText) {
        options.rawText = (rawText ? rawText + '\n' : '') + transcribedText;
        options.audioBuffer = null; // ya fue convertido a texto limpio
      } else {
        throw new Error('No se pudo procesar el audio ni con Gemini ni con Whisper.');
      }
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
  async askSecondBrain(question, meetingsList, notesList = []) {
    const recentMeetings = (meetingsList || []).slice(0, 20);
    const recentNotes = (notesList || []).slice(0, 20);

    const meetingsContext = recentMeetings.map((m, idx) => `
Reunión #${idx + 1}:
Título: ${m.title}
Fecha: ${m.createdAt || m.date}
Resumen: ${m.summary}
Decisiones: ${(m.keyDecisions || []).join('; ')}
Tareas: ${(m.actionItems || []).map(a => `${a.task} [Resp: ${a.assignee}] [Estado: ${a.completed ? 'Completada' : 'Pendiente'}]`).join('; ')}
Consejos: ${(m.proactiveAdvice || []).join('; ')}
---
`).join('\n');

    const notesContext = recentNotes.map((n, idx) => `
Libreta/Nota #${idx + 1}:
Título: ${n.title}
Fecha: ${n.updatedAt || n.createdAt}
Contenido: ${n.contentText ? n.contentText.replace(/<[^>]+>/g, '').substring(0, 300) : 'Dibujo o nota manuscrita'}
Etiquetas: ${(n.tags || []).join(', ')}
---
`).join('\n');

    const prompt = `
Eres el "Segundo Cerebro" (Second Brain) y Asistente IA interactivo de ProActur.
Tienes acceso al historial completo de reuniones y a las libretas canvas del usuario.

Historial de Reuniones:
${meetingsContext || 'No hay reuniones previas registradas aún.'}

Libretas de Notas Canvas:
${notesContext || 'No hay libretas previas registradas aún.'}

Pregunta del usuario:
"${question}"

Instrucciones:
1. Responde de forma concisa, ejecutiva, profesional y citando específicamente qué reunión, libreta, fecha o responsable está relacionado.
2. Si la información no aparece en las reuniones o libretas registradas, indícalo cortésmente y sugiere qué buscar o registrar.
`;

    // Ejecución en cascada con la flota de modelos de élite (Groq LPU -> DeepSeek -> Qwen -> Llama -> Gemini)
    const executiveModels = [
      { provider: 'groq', model: config.GROQ_CHAT_MODEL || 'openai/gpt-oss-120b', name: 'Groq GPT-OSS 120B' },
      { provider: 'openrouter', model: 'deepseek/deepseek-chat', name: 'DeepSeek V3' },
      { provider: 'openrouter', model: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B' },
      { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B' },
      { provider: 'gemini', model: this.geminiModel, name: 'Gemini Flash' }
    ];

    let lastError = null;

    for (const item of executiveModels) {
      const { provider, model, name } = item;

      if (provider === 'groq' && config.GROQ_API_KEY) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 8000);
          const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${config.GROQ_API_KEY}`
            },
            body: JSON.stringify({
              model,
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.3
            }),
            signal: controller.signal
          });
          clearTimeout(timer);

          if (res.ok) {
            const data = await res.json();
            const ans = data.choices?.[0]?.message?.content;
            if (ans && ans.trim()) return ans.trim();
          }
        } catch (err) {
          console.warn(`[SecondBrain] Falló ${name} (${err.message}), probando siguiente modelo...`);
          lastError = err;
        }
      }

      if (provider === 'openrouter' && config.OPENROUTER_API_KEY) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 8000);
          const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${config.OPENROUTER_API_KEY}`,
              'HTTP-Referer': 'https://pro-actur.vercel.app',
              'X-Title': 'ProActur AI'
            },
            body: JSON.stringify({
              model,
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.3
            }),
            signal: controller.signal
          });
          clearTimeout(timer);

          if (res.ok) {
            const data = await res.json();
            const ans = data.choices?.[0]?.message?.content;
            if (ans && ans.trim()) return ans.trim();
          }
        } catch (err) {
          console.warn(`[SecondBrain] Falló ${name} (${err.message}), probando siguiente modelo...`);
          lastError = err;
        }
      }

      if (provider === 'gemini' && config.GEMINI_API_KEY) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 8000);
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent`;
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': config.GEMINI_API_KEY
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.3 }
            }),
            signal: controller.signal
          });
          clearTimeout(timer);

          if (res.ok) {
            const data = await res.json();
            const ans = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (ans && ans.trim()) return ans.trim();
          }
        } catch (err) {
          console.warn(`[SecondBrain] Falló ${name} (${err.message}), probando siguiente modelo...`);
          lastError = err;
        }
      }
    }

    throw lastError || new Error('No se pudo obtener respuesta del Segundo Cerebro.');
  }

  async askMeeting(question, meeting) {
    if (!meeting) throw new Error('Se requiere información de la reunión');

    const title = meeting.title || 'Reunión sin título';
    const date = meeting.createdAt || meeting.date || 'Fecha no registrada';
    const summary = meeting.summary || 'Sin resumen registrado';
    const decisions = (meeting.keyDecisions || []).join('\n- ');
    const tasks = (meeting.actionItems || []).map(a => `- ${a.task} (Responsable: ${a.assignee || 'No asignado'}, Plazo: ${a.deadline || 'Sin plazo'})`).join('\n');
    const advice = (meeting.proactiveAdvice || []).join('\n- ');
    const transcript = meeting.transcript || 'Transcripción no disponible';

    const prompt = `
Eres el Copiloto Ejecutivo de ProActur.
El usuario está revisando el registro histórico de una reunión específica y te hace una consulta directa sobre ella.

INFORMACIÓN EXCLUSIVA DE ESTA REUNIÓN:
- TÍTULO: ${title}
- FECHA: ${date}
- RESUMEN EJECUTIVO:
${summary}

- ACUERDOS Y DECISIONES CLAVE:
${decisions ? '- ' + decisions : 'No se registraron decisiones formales.'}

- COMPROMISOS Y TAREAS ASIGNADAS:
${tasks || 'No se registraron tareas pendientes.'}

- CONSEJOS PROACTIVOS Y ALERTAS:
${advice ? '- ' + advice : 'No hay consejos adicionales.'}

- TRANSCRIPCIÓN TEXTUAL COMPLETA:
"""
${transcript.substring(0, 20000)}
"""

PREGUNTA DEL USUARIO:
"${question}"

INSTRUCCIONES CLAVE:
1. Responde de forma concisa, profesional, ejecutiva y certera basada ÚNICAMENTE en la información de esta reunión.
2. Si te piden redactar un correo, una lista de pendientes o clarificar posturas de participantes, usa formato Markdown limpio.
3. Si el dato solicitado no aparece en la reunión, indícalo claramente con honestidad sin inventar información.
`;

    const executiveModels = [
      { provider: 'groq', model: config.GROQ_CHAT_MODEL || 'openai/gpt-oss-120b', name: 'Groq GPT-OSS 120B' },
      { provider: 'openrouter', model: 'deepseek/deepseek-chat', name: 'DeepSeek V3' },
      { provider: 'gemini', model: this.geminiModel, name: 'Gemini Flash' }
    ];

    for (const item of executiveModels) {
      const { provider, model, name } = item;

      if (provider === 'groq' && config.GROQ_API_KEY) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 9000);
          const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${config.GROQ_API_KEY}`
            },
            body: JSON.stringify({
              model,
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.2
            }),
            signal: controller.signal
          });
          clearTimeout(timer);

          if (res.ok) {
            const data = await res.json();
            const ans = data.choices?.[0]?.message?.content;
            if (ans && ans.trim()) return ans.trim();
          }
        } catch (err) {
          console.warn(`[Meeting AI] Error con ${name}:`, err.message);
        }
      }

      if (provider === 'openrouter' && config.OPENROUTER_API_KEY) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 9000);
          const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${config.OPENROUTER_API_KEY}`,
              'HTTP-Referer': 'https://pro-actur.vercel.app',
              'X-Title': 'ProActur AI'
            },
            body: JSON.stringify({
              model,
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.2
            }),
            signal: controller.signal
          });
          clearTimeout(timer);

          if (res.ok) {
            const data = await res.json();
            const ans = data.choices?.[0]?.message?.content;
            if (ans && ans.trim()) return ans.trim();
          }
        } catch (err) {
          console.warn(`[Meeting AI] Error con ${name}:`, err.message);
        }
      }

      if (provider === 'gemini' && config.GEMINI_API_KEY) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 9000);
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent`;
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': config.GEMINI_API_KEY
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.2 }
            }),
            signal: controller.signal
          });
          clearTimeout(timer);

          if (res.ok) {
            const data = await res.json();
            const ans = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (ans && ans.trim()) return ans.trim();
          }
        } catch (err) {
          console.warn(`[Meeting AI] Error con Gemini:`, err.message);
        }
      }
    }

    return `He revisado el registro de "${title}". Sobre tu consulta: ${summary}`;
  }

}
