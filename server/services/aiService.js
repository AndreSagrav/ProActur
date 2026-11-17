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
  getGeminiModels() {
    return [
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
      'gemini-flash-lite-latest',
      'gemini-3-flash-preview',
      'gemini-3.8-flash'
    ];
  }

  getExecutiveModels() {
    return [
      // 1. Google Gemini (Multicuota con modelos verificados y capacidad multimodal)
      { provider: 'gemini', model: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash' },
      { provider: 'gemini', model: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' },
      { provider: 'gemini', model: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite' },
      { provider: 'gemini', model: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite' },
      { provider: 'gemini', model: 'gemini-flash-lite-latest', name: 'Gemini Flash Lite Latest' },
      { provider: 'gemini', model: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview' },
      // 2. Groq LPU (Ultra-rápido, infraestructura independiente de Google)
      { provider: 'groq', model: 'openai/gpt-oss-120b', name: 'Groq GPT-OSS 120B' },
      { provider: 'groq', model: 'qwen/qwen3.8-27b', name: 'Groq Qwen 3.8 27B' },
      { provider: 'groq', model: 'openai/gpt-oss-20b', name: 'Groq GPT-OSS 20B' },
      // 3. OpenRouter Free Tier (Red de seguridad 100% gratuita con soporte de visión)
      { provider: 'openrouter', model: 'nvidia/nemotron-3.5-super-vl:free', name: 'Nemotron 3.5 Super VL (Free)' },
      { provider: 'openrouter', model: 'recursive/flint-v1.0:free', name: 'Flint v1.0 (Free)' }
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
  "title": "${(meetingTitle && !this.isGenericTitle(meetingTitle)) ? meetingTitle : 'Título ejecutivo conciso (máximo 5 a 7 palabras) que sintetice con precisión el tema central de la reunión'}",
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

  isGenericTitle(title) {
    if (!title || typeof title !== 'string') return true;
    const clean = title.trim();
    if (clean.length < 3) return true;
    const lower = clean.toLowerCase();
    const genericPatterns = [
      /^reuni[oó]n\s*(en\s*vivo|grabada|sin\s*t[ií]tulo)?\s*(\d+[/.-]\d+.*)?$/i,
      /^reuni[oó]n\s*\d+[/.-]\d+.*$/i,
      /^ej\.\s*sincronizaci[oó]n/i,
      /^ejemplo/i,
      /^nueva reuni[oó]n/i,
      /^notas de reuni[oó]n/i,
      /^sin t[ií]tulo/i,
      /^t[ií]tulo conciso/i
    ];
    return genericPatterns.some(p => p.test(clean)) || lower === 'reunión' || lower === 'reunion';
  }

  normalizeParsedResponse(parsed) {
    if (!parsed || typeof parsed !== 'object') return null;
    const normalizedTitle = (parsed.title && typeof parsed.title === 'string' && !this.isGenericTitle(parsed.title))
      ? parsed.title.trim()
      : undefined;

    return {
      title: normalizedTitle,
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
  filterWhisperHallucinations(text) {
    if (!text || typeof text !== 'string') return '';
    const cleaned = text.trim();
    if (!cleaned) return '';

    const globalHallucinations = [
      /^subt[íi]tulos realizados por.*$/i,
      /^amara\.org$/i,
      /^gracias por ver.*$/i,
      /^suscr[íi]bete.*$/i,
      /^m[úu]sica$/i,
      /^\[m[úu]sica\]$/i,
      /^[\s.,…\-_!?]+$/
    ];
    if (globalHallucinations.some(p => p.test(cleaned))) return '';

    // Descartar alucinaciones cortas típicas de Whisper ante silencio o ruido ambiental
    const normalizedShort = cleaned
      .replace(/[¡!¿?.,;:…"'()[\]]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (normalizedShort.length <= 45) {
      const shortSilenceNoise = [
        /^(?:(?:la\s+)?baja\s+y\s+)?(?:muchas\s+)?gracias(?:\s+a\s+todos)?$/i,
        /^(?:gracias(?:\s+gracias)*)$/i,
        /^(?:ok|s[ií]|bueno|bien|vale)\s+gracias$/i,
        /^(?:hasta\s+luego|nos\s+vemos|adi[oó]s|de\s+nada)$/i,
        /^(?:thank\s+you|thanks(?:\s+for\s+watching)?|bye|you)$/i
      ];
      if (shortSilenceNoise.some(p => p.test(normalizedShort))) return '';
    }

    return cleaned;
  }

  /**
   * Normaliza errores fonéticos frecuentes de ASR para términos técnicos del dominio.
   */
  normalizeDomainTerminology(text) {
    if (!text || typeof text !== 'string') return '';
    const replacements = [
      [/\b(?:XEMERAL|Getic\s+Central|Hit\s*Central|X-?Centra|Psy\s*Central|Hic\s+Central|Hik\s+Central|Xcentral|X-Terminal|KDIC\s+Central|Kitschner)\b/gi, 'HikCentral'],
      [/\b(?:BMS|IBMS|IBM\s+S)\b/gi, 'iVMS-4200'],
      [/\bPCNBR\b/gi, 'PCNVR'],
      [/\bDeepming\b/gi, 'DeepinMind']
    ];
    let out = text;
    for (const [pattern, replacement] of replacements) {
      out = out.replace(pattern, replacement);
    }
    return out;
  }

  /**
   * Detecta frases contaminadas generadas por alucinaciones de cierre/bajas al inicio de sesión.
   */
  isPoisonedLiveItem(text) {
    if (!text || typeof text !== 'string') return false;
    const trimmed = text.trim();
    if (!trimmed) return true;
    return /gesti[oó]n de bajas|tr[aá]mites de bajas|bajas administrativas|bajas mencionadas|revisar las bajas|la sesi[oó]n (?:ha |haya )?conclu(?:y[oó]|ido)|finalizaci[oó]n formal de la sesi[oó]n|cierre de reuni[oó]n|cierre definitivo de la sesi[oó]n|cierre de ciclo acad[eé]mico|agradecimientos finales|agradecimiento(?:s)? y cortes[ií]a inicial|comentarios informales de cierre|comentarios de cierre|archivar la sesi[oó]n|transcripci[oó]n actual est[aá] incompleta|despedida y cierre formal|^inicio de la? sesi[oó]n$/i.test(trimmed);
  }

  sanitizeSummaryText(summary) {
    if (!summary || typeof summary !== 'string') return '';
    const lines = summary
      .split(/\r?\n/)
      .map(line => {
        const trimmed = line.trim();
        if (!trimmed) return '';
        const sentences = trimmed
          .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¡¿🔴📋📌•-])/)
          .filter(sentence => !this.isPoisonedLiveItem(sentence));
        return this.normalizeDomainTerminology(sentences.join(' ').trim());
      })
      .filter(Boolean);

    let formatted = lines
      .map((line, idx) => {
        const isBullet = /^[•\-*]\s+/.test(line);
        const prevIsBullet = idx > 0 && /^[•\-*]\s+/.test(lines[idx - 1]);
        const prevIsHeader = idx > 0 && /^(?:📌|📋)\s*/.test(lines[idx - 1]);
        if (idx === 0) return line;
        return (isBullet && (prevIsBullet || prevIsHeader)) ? `\n${line}` : `\n\n${line}`;
      })
      .join('')
      .trim();

    if (formatted.length > 950) {
      const compactLines = formatted.split(/\r?\n/).filter(Boolean);
      const nowLine = compactLines.find(l => l.startsWith('🔴')) || compactLines[0] || '';
      const bullets = compactLines.filter(l => /^[•\-*]\s+/.test(l)).slice(0, 5);
      if (bullets.length > 0) {
        const rebuilt = [nowLine, '📌 SÍNTESIS COMPACTA:', ...bullets].filter(Boolean).join('\n');
        formatted = rebuilt.slice(0, 950).trim();
      } else {
        const cut = formatted.slice(0, 947);
        const lastPeriod = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf(' '));
        formatted = (lastPeriod > 400 ? cut.slice(0, lastPeriod + 1) : cut).trim();
      }
    }

    return formatted;
  }

  sanitizePreviousContext(previousContext) {
    if (!previousContext || typeof previousContext !== 'object') return null;
    const rawTitle = typeof previousContext.title === 'string' ? previousContext.title.trim() : '';
    const cleanTitle = (rawTitle && !this.isPoisonedLiveItem(rawTitle))
      ? this.normalizeDomainTerminology(rawTitle)
      : '';

    const pickLatestSlice = (arr) => {
      if (!Array.isArray(arr)) return [];
      return arr.length > 25 ? arr.slice(-40).reverse() : arr;
    };

    return {
      ...previousContext,
      title: cleanTitle || undefined,
      summary: this.sanitizeSummaryText(previousContext.summary || ''),
      keyTopics: this.mergeUniqueStrings([], pickLatestSlice(previousContext.keyTopics), 16),
      keyDecisions: this.mergeUniqueStrings([], pickLatestSlice(previousContext.keyDecisions), 16),
      actionItems: this.mergeActionItems([], pickLatestSlice(previousContext.actionItems), 14),
      proactiveAdvice: this.mergeUniqueStrings([], pickLatestSlice(previousContext.proactiveAdvice), 12)
    };
  }

  normalizeCompareKey(text) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  extractSignificantTokens(text) {
    const stopWords = new Set([
      'de', 'la', 'el', 'los', 'las', 'en', 'para', 'por', 'con', 'una', 'uno',
      'unos', 'unas', 'del', 'al', 'que', 'como', 'sobre', 'entre', 'se', 'su',
      'sus', 'sin', 'ante', 'tras', 'hacia', 'desde', 'hasta', 'durante', 'mediante'
    ]);
    const key = this.normalizeCompareKey(text);
    const tokens = key.split(' ').filter(w => w.length > 2 && !stopWords.has(w));
    return new Set(tokens);
  }

  isSemanticallyDuplicate(tokensA, tokensB) {
    if (!tokensA || !tokensB || tokensA.size === 0 || tokensB.size === 0) return false;
    let intersection = 0;
    for (const token of tokensA) {
      if (tokensB.has(token)) intersection += 1;
    }
    const union = tokensA.size + tokensB.size - intersection;
    if (union > 0 && (intersection / union) >= 0.55) return true;
    const minSize = Math.min(tokensA.size, tokensB.size);
    return minSize >= 3 && (intersection / minSize) >= 0.8;
  }

  mergeUniqueStrings(prevList = [], newList = [], maxItems = 16) {
    const result = [];
    const seenKeys = new Set();
    const keptTokenSets = [];
    // Priorizar ítems recientes primero y luego previos útiles, depurando ruido y redundancias
    const candidates = [
      ...(Array.isArray(newList) ? newList : []),
      ...(Array.isArray(prevList) ? prevList : [])
    ];

    for (const item of candidates) {
      if (typeof item !== 'string') continue;
      const cleaned = this.normalizeDomainTerminology(item.trim());
      if (!cleaned || this.isPoisonedLiveItem(cleaned)) continue;

      const key = this.normalizeCompareKey(cleaned);
      if (!key || seenKeys.has(key)) continue;

      const tokens = this.extractSignificantTokens(cleaned);
      if (keptTokenSets.some(existing => this.isSemanticallyDuplicate(tokens, existing))) {
        continue;
      }

      seenKeys.add(key);
      keptTokenSets.push(tokens);
      result.push(cleaned);
      if (result.length >= maxItems) break;
    }
    return result;
  }

  mergeActionItems(prevItems = [], newItems = [], maxItems = 14) {
    const result = [];
    const seenKeys = new Set();
    const keptTokenSets = [];
    const candidates = [
      ...(Array.isArray(newItems) ? newItems : []),
      ...(Array.isArray(prevItems) ? prevItems : [])
    ];

    for (const raw of candidates) {
      if (!raw) continue;
      const rawTask = typeof raw === 'string' ? raw : (raw.task || raw.text || raw.title || '');
      const cleanTask = this.normalizeDomainTerminology(String(rawTask).trim());
      if (!cleanTask || this.isPoisonedLiveItem(cleanTask)) continue;

      const item = typeof raw === 'string'
        ? { task: cleanTask, assignee: 'Por asignar', priority: 'Alta', deadline: 'Pendiente', completed: false }
        : {
            task: cleanTask,
            assignee: raw.assignee || 'Por asignar',
            priority: raw.priority || 'Alta',
            deadline: raw.deadline || 'Pendiente',
            completed: Boolean(raw.completed)
          };

      const key = this.normalizeCompareKey(item.task);
      if (!key || seenKeys.has(key)) continue;

      const tokens = this.extractSignificantTokens(item.task);
      if (keptTokenSets.some(existing => this.isSemanticallyDuplicate(tokens, existing))) {
        continue;
      }

      seenKeys.add(key);
      keptTokenSets.push(tokens);
      result.push(item);
      if (result.length >= maxItems) break;
    }
    return result;
  }

  appendTranscriptDelta(baseTranscript = '', delta = '') {
    const base = (baseTranscript || '').trim();
    const next = (delta || '').trim();
    if (!next) return base;
    if (!base) return next;
    // Evitar duplicar si el final ya contiene exactamente este fragmento
    const baseTail = this.normalizeCompareKey(base.slice(-Math.max(next.length + 20, 80)));
    const nextKey = this.normalizeCompareKey(next);
    if (nextKey && baseTail.includes(nextKey)) {
      return base;
    }
    return `${base} ${next}`.trim();
  }

  buildSmartTranscriptContext(transcript = '', question = '', maxChars = 90000) {
    const text = (transcript || '').trim();
    if (!text) return 'Transcripción no disponible aún.';
    if (text.length <= maxChars) return text;

    const headSize = Math.floor(maxChars * 0.14); // Apertura
    const tailSize = Math.floor(maxChars * 0.36); // Lo más reciente
    const middleBudget = maxChars - headSize - tailSize;

    const head = text.slice(0, headSize);
    const tail = text.slice(-tailSize);
    const middleText = text.slice(headSize, text.length - tailSize);

    // Extraer palabras clave de la pregunta para rescatar fragmentos relevantes del centro
    const stopWords = new Set(['como', 'cual', 'cuales', 'quien', 'quienes', 'cuando', 'donde', 'porque', 'para', 'sobre', 'entre', 'este', 'esta', 'estos', 'estas', 'todo', 'toda', 'todos', 'todas', 'algo', 'dijo', 'dijeron', 'hablo', 'hablaron', 'reunion', 'seminario', 'clase', 'resumen', 'tema', 'temas']);
    const keywords = this.normalizeCompareKey(question)
      .split(' ')
      .filter(w => w.length >= 4 && !stopWords.has(w));

    const chunkSize = 1800;
    const chunks = [];
    for (let i = 0; i < middleText.length; i += chunkSize) {
      const slice = middleText.slice(i, i + chunkSize);
      const norm = this.normalizeCompareKey(slice);
      let score = 0;
      for (const kw of keywords) {
        if (norm.includes(kw)) score += 1;
      }
      chunks.push({ idx: i, slice, score });
    }

    // Seleccionar los mejores chunks (si no hay keywords, muestrear uniformemente)
    let selected = [];
    if (keywords.length > 0 && chunks.some(c => c.score > 0)) {
      const ranked = [...chunks].sort((a, b) => b.score - a.score);
      let used = 0;
      for (const c of ranked) {
        if (used + c.slice.length > middleBudget) break;
        selected.push(c);
        used += c.slice.length;
      }
      selected.sort((a, b) => a.idx - b.idx);
    } else {
      const step = Math.max(1, Math.floor(chunks.length / Math.max(1, Math.floor(middleBudget / chunkSize))));
      let used = 0;
      for (let i = 0; i < chunks.length; i += step) {
        if (used + chunks[i].slice.length > middleBudget) break;
        selected.push(chunks[i]);
        used += chunks[i].slice.length;
      }
    }

    const middleFormatted = selected.map(c => c.slice).join('\n[...]\n');
    return `[INICIO DE LA SESIÓN]\n${head}\n\n[FRAGMENTOS RELEVANTES INTERMEDIOS]\n${middleFormatted}\n\n[PARTE MÁS RECIENTE / CIERRE]\n${tail}`;
  }

  buildLivePrompt(meetingTitle, recentTranscript, newChunkText = '', previousContext = null, userNotes = '') {
    return `
Eres ProActur AI, el copiloto ejecutivo y tomador de notas experto de un seminario o reunión EN CURSO EN TIEMPO REAL.
Tu misión es tomar notas completas, detalladas y acumulativas mientras la sesión SIGUE ABIERTA.

Título de la sesión: ${meetingTitle || 'Sesión en vivo'}
Estado acumulado previo (consérvalo integrado con lo nuevo, eliminando repeticiones):
- Resumen acumulado previo: ${JSON.stringify(previousContext?.summary || '')}
- Temas clave previos: ${JSON.stringify(previousContext?.keyTopics || [])}
- Decisiones previas: ${JSON.stringify(previousContext?.keyDecisions || [])}
- Tareas/Compromisos previos: ${JSON.stringify(previousContext?.actionItems || [])}
- Consejos/Alertas previos: ${JSON.stringify(previousContext?.proactiveAdvice || [])}

${userNotes ? `Notas manuales del usuario:\n${userNotes}\n` : ''}
${recentTranscript ? `Contexto reciente de la conversación:\n${recentTranscript}\n` : ''}
${newChunkText ? `LO ÚLTIMO HABLADO AHORA MISMO (Analiza e incorpora esto al instante):\n"${newChunkText}"\n` : 'Analiza el audio y notas provistas de la sesión.'}

INSTRUCCIONES CRÍTICAS:
1. PROHIBIDO decir "la sesión concluyó", "cierre de reunión", "finalización formal", "gestión de bajas" o "agradecimientos finales": la reunión sigue EN VIVO en curso.
2. En "summary", sé ULTRA-COMPACTO (MÁXIMO 120 palabras en total) usando SIEMPRE este formato exacto para lectura rápida de un vistazo:
   - Primera línea arriba: "🔴 AHORA: [1 sola frase directa de máximo 20-25 palabras sobre lo que se está explicando en este instante]"
   - Debajo: "📌 SÍNTESIS COMPACTA:" seguido de MÁXIMO 4 a 5 viñetas ("•") de una sola línea corta cada una, agrupando por módulos o temas principales toda la sesión sin repetir ideas ni escribir párrafos largos.
   - Al integrar lo nuevo al resumen previo, SINTETIZA y FUSIONA los temas anteriores dentro de esas 4 a 5 viñetas en lugar de seguir agregando texto al final.
3. Normaliza automáticamente términos técnicos mal escuchados por voz: "XEMERAL" / "Getic Central" / "Hit Central" / "XCentra" / "PsyCentral" -> "HikCentral"; "BMS" / "IBMS" -> "iVMS-4200"; "PCNBR" -> "PCNVR"; "Deepming" -> "DeepinMind".
4. En "keyTopics" (8 a 12), "keyDecisions" (8 a 12 conclusiones/acuerdos), "actionItems" (6 a 10) y "proactiveAdvice" (5 a 8), consolida los puntos sin repetir variantes de la misma idea y coloca LOS PUNTOS MÁS RECIENTES E IMPORTANTES PRIMERO ARRIBA de cada lista.
5. En "transcript", devuelve únicamente el texto limpio del último fragmento hablado (el servidor ya conserva la transcripción total acumulada).

Devuelve ÚNICAMENTE un JSON válido (sin markdown) con este formato exacto:
{
  "title": "Título ejecutivo conciso (máximo 5 a 7 palabras) del tema central (ej. 'Certificación HikCentral Professional')",
  "summary": "🔴 AHORA: Frase breve de lo actual.\n\n📌 SÍNTESIS COMPACTA:\n• Punto clave 1\n• Punto clave 2\n• Punto clave 3\n• Punto clave 4",
  "keyTopics": ["Tema más reciente", "Tema o módulo previo"],
  "keyDecisions": ["Conclusión o acuerdo más reciente", "Acuerdo previo relevante"],
  "actionItems": [
    {
      "task": "Descripción clara del compromiso o punto de acción",
      "assignee": "Responsable asignado o 'Por asignar'",
      "priority": "Alta | Media | Baja",
      "deadline": "Fecha límite o 'Pendiente'",
      "completed": false
    }
  ],
  "proactiveAdvice": [
    "Nota analítica, consejo proactivo o alerta relevante más reciente"
  ],
  "transcript": "Transcripción limpia del fragmento reciente"
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

    const modelToUse = specificModel || config.GROQ_CHAT_MODEL || 'openai/gpt-oss-120b';

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: modelToUse,
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

    const modelToUse = specificModel || this.openRouterModel || 'nvidia/nemotron-3.5-super-vl:free';

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: modelToUse,
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

  async analyzeLiveWithGemini(prompt, audioBuffer, mimeType, activeTranscript, requestedModel = null, forceAudio = false) {
    const key = config.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY no configurada');

    const geminiModels = requestedModel ? [requestedModel] : this.getGeminiModels();
    let lastGeminiError = null;

    for (const modelName of geminiModels) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
      const parts = [];

      if ((forceAudio || !activeTranscript) && audioBuffer) {
        parts.push({
          inlineData: {
            mimeType: mimeType || 'audio/webm',
            data: audioBuffer.toString('base64')
          }
        });
      }
      parts.push({ text: prompt });

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 9000);

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

  async analyzeLiveMeeting({ meetingTitle, transcript, newTranscriptChunk, userNotes, audioBuffer, mimeType, previousContext }) {
    const cleanPreviousContext = this.sanitizePreviousContext(previousContext);
    const cleanMeetingTitle = (meetingTitle && !this.isPoisonedLiveItem(meetingTitle))
      ? this.normalizeDomainTerminology(meetingTitle)
      : '';
    const baseTranscript = this.normalizeDomainTerminology((transcript || '').trim());
    let speechDelta = (newTranscriptChunk || '').trim();
    let whisperText = '';

    // 1. Transcribir SIEMPRE el nuevo fragmento de audio entrante (sin bloqueo por longitud previa)
    if (audioBuffer && audioBuffer.length >= 400) {
      try {
        const rawWhisper = await this.transcribeWithGroq(audioBuffer, mimeType);
        whisperText = this.filterWhisperHallucinations(rawWhisper);
        if (whisperText) {
          console.log('[Whisper Live Delta]', whisperText.substring(0, 120));
        }
      } catch (wErr) {
        console.warn('[Whisper Live Warn]:', wErr.message);
      }
    }

    // Priorizar Whisper si transcribió contenido real; si no, usar delta de SpeechRecognition
    const rawDeltaText = whisperText || this.filterWhisperHallucinations(speechDelta);
    const deltaText = this.normalizeDomainTerminology(rawDeltaText);
    const fullAccumulatedTranscript = this.appendTranscriptDelta(baseTranscript, deltaText);
    const notesText = (userNotes || '').trim();
    const hasPrevSummary = Boolean(cleanPreviousContext?.summary && cleanPreviousContext.summary.trim().length > 20);

    // 2. Si no hay nada nuevo ni previo, estado de espera limpio
    if (!fullAccumulatedTranscript && !notesText && !audioBuffer) {
      return {
        summary: 'Escuchando sesión en vivo...',
        keyTopics: cleanPreviousContext?.keyTopics || [],
        keyDecisions: cleanPreviousContext?.keyDecisions || [],
        actionItems: cleanPreviousContext?.actionItems || [],
        proactiveAdvice: cleanPreviousContext?.proactiveAdvice?.length > 0
          ? cleanPreviousContext.proactiveAdvice
          : ['Habla al micrófono o escribe notas para que ProActur tome apuntes y acuerdos en tiempo real.'],
        transcript: '',
        lastChunkTranscript: ''
      };
    }

    // 3. Si este bloque fue silencio puro (sin texto nuevo) y ya tenemos resumen previo sin notas nuevas, preservar limpio sin gastar cuota LLM
    if (!deltaText && hasPrevSummary && !notesText) {
      return {
        title: cleanPreviousContext?.title,
        summary: cleanPreviousContext.summary,
        keyTopics: cleanPreviousContext?.keyTopics || [],
        keyDecisions: cleanPreviousContext?.keyDecisions || [],
        actionItems: cleanPreviousContext?.actionItems || [],
        proactiveAdvice: cleanPreviousContext?.proactiveAdvice || [],
        transcript: fullAccumulatedTranscript,
        lastChunkTranscript: ''
      };
    }

    const recentTranscript = fullAccumulatedTranscript.slice(-10000);
    const prompt = this.buildLivePrompt(cleanMeetingTitle || cleanPreviousContext?.title, recentTranscript, deltaText, cleanPreviousContext, notesText);

    // 4. Fallback en cascada sobre modelos ejecutivos
    let executiveModels = this.getExecutiveModels();
    if (!deltaText && !baseTranscript && audioBuffer && config.GEMINI_API_KEY) {
      executiveModels = [
        { provider: 'gemini', model: 'gemini-3.6-flash', name: 'Gemini Multimodal' },
        ...executiveModels.filter(m => m.provider !== 'gemini')
      ];
    }

    for (const item of executiveModels) {
      const { provider, model } = item;
      try {
        let result = null;
        if (provider === 'groq' && config.GROQ_API_KEY) {
          result = await this.analyzeLiveWithGroq(prompt, model);
        } else if (provider === 'openrouter' && config.OPENROUTER_API_KEY) {
          result = await this.analyzeLiveWithOpenRouter(prompt, model);
        } else if (provider === 'gemini' && config.GEMINI_API_KEY) {
          result = await this.analyzeLiveWithGemini(prompt, audioBuffer, mimeType, deltaText || recentTranscript, model, !deltaText);
        }

        if (result && result.summary) {
          const mergedTopics = this.mergeUniqueStrings(cleanPreviousContext?.keyTopics, result.keyTopics, 16);
          const mergedDecisions = this.mergeUniqueStrings(cleanPreviousContext?.keyDecisions, result.keyDecisions, 16);
          const mergedActions = this.mergeActionItems(cleanPreviousContext?.actionItems, result.actionItems, 14);
          const mergedAdvice = this.mergeUniqueStrings(cleanPreviousContext?.proactiveAdvice, result.proactiveAdvice, 12);
          const modelChunkText = !deltaText && result.transcript && result.transcript.length > 5
            ? this.normalizeDomainTerminology(this.filterWhisperHallucinations(result.transcript))
            : '';
          const finalTranscript = modelChunkText
            ? this.appendTranscriptDelta(fullAccumulatedTranscript, modelChunkText)
            : fullAccumulatedTranscript;

          const sanitizedSummary = this.sanitizeSummaryText(result.summary);
          const safeSummary = (sanitizedSummary && sanitizedSummary.length >= 30)
            ? sanitizedSummary
            : (cleanPreviousContext?.summary || sanitizedSummary || result.summary);

          const safeTitle = (result.title && !this.isPoisonedLiveItem(result.title))
            ? this.normalizeDomainTerminology(result.title)
            : cleanPreviousContext?.title;

          return {
            ...result,
            title: safeTitle,
            summary: safeSummary,
            keyTopics: mergedTopics,
            keyDecisions: mergedDecisions,
            actionItems: mergedActions,
            proactiveAdvice: mergedAdvice,
            transcript: finalTranscript,
            lastChunkTranscript: deltaText || modelChunkText
          };
        }
      } catch (err) {
        console.warn(`[Live AI] ${provider} (${model}) no disponible (${err.message}), probando alternativa...`);
      }
    }

    // 5. Motor determinista local preservando estado previo + transcripción íntegra
    console.warn('[AI Engine] Activando motor determinista local preservando acumulado...');
    const fallback = this.generateDeterministicFallback(deltaText || recentTranscript, cleanMeetingTitle, notesText);
    return {
      ...fallback,
      title: cleanPreviousContext?.title || cleanMeetingTitle || undefined,
      summary: (cleanPreviousContext?.summary && cleanPreviousContext.summary.length > 40)
        ? cleanPreviousContext.summary
        : this.sanitizeSummaryText(fallback.summary),
      keyTopics: this.mergeUniqueStrings(cleanPreviousContext?.keyTopics, fallback.keyTopics, 16),
      keyDecisions: this.mergeUniqueStrings(cleanPreviousContext?.keyDecisions, fallback.keyDecisions, 16),
      actionItems: this.mergeActionItems(cleanPreviousContext?.actionItems, fallback.actionItems, 14),
      proactiveAdvice: this.mergeUniqueStrings(cleanPreviousContext?.proactiveAdvice, fallback.proactiveAdvice, 12),
      transcript: fullAccumulatedTranscript,
      lastChunkTranscript: deltaText
    };
  }

  async processWithGemini({ audioBuffer, mimeType, rawText, meetingTitle }) {
    const key = config.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY no configurada');

    const prompt = this.buildMeetingPrompt(meetingTitle, rawText);
    const geminiModels = this.getGeminiModels();
    let lastError = null;

    for (const modelName of geminiModels) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
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
      const timer = setTimeout(() => controller.abort(), 25000);

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
          console.warn(`[Gemini Finalize] ${modelName} falló (${response.status}), probando siguiente...`);
          lastError = new Error(`Error Gemini ${modelName} (${response.status}): ${errText}`);
          continue;
        }

        const data = await response.json();
        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const parsed = this.cleanJsonResponse(raw);
        if (parsed) return parsed;
      } catch (err) {
        clearTimeout(timer);
        lastError = err;
        console.warn(`[Gemini Finalize] Error ${modelName}: ${err.message}`);
      }
    }

    throw lastError || new Error('Ningún modelo Gemini pudo procesar la reunión.');
  }

  // --- 2. LLAMADA CON OPENROUTER (Texto / Notas) ---
  async processWithOpenRouter({ rawText, meetingTitle }) {
    const key = config.OPENROUTER_API_KEY;
    if (!key) throw new Error('OPENROUTER_API_KEY no configurada');

    const prompt = this.buildMeetingPrompt(meetingTitle, rawText);
    const models = ['nvidia/nemotron-3.5-super-vl:free', 'recursive/flint-v1.0:free'];
    let lastError = null;

    for (const modelName of models) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);

      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`,
            'HTTP-Referer': 'https://proactur.local',
            'X-Title': 'ProActur AI'
          },
          body: JSON.stringify({
            model: modelName,
            messages: [
              { role: 'system', content: 'Eres un asistente ejecutivo experto en estructurar minutas de reunión en formato JSON estricto.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.2
          }),
          signal: controller.signal
        });

        clearTimeout(timer);
        if (!response.ok) {
          const err = await response.text();
          console.warn(`[OpenRouter Finalize] ${modelName} falló (${response.status}), probando siguiente...`);
          lastError = new Error(`Error OpenRouter ${modelName} (${response.status}): ${err}`);
          continue;
        }

        const data = await response.json();
        const raw = data.choices?.[0]?.message?.content;
        const parsed = this.cleanJsonResponse(raw);
        if (parsed) return parsed;
      } catch (err) {
        clearTimeout(timer);
        lastError = err;
        console.warn(`[OpenRouter Finalize] Error ${modelName}: ${err.message}`);
      }
    }

    throw lastError || new Error('Ningún modelo OpenRouter pudo procesar la reunión.');
  }

  // --- 3. LLAMADA CON GROQ (Inferencia Rápida) ---
  async processWithGroq({ rawText, meetingTitle }) {
    const key = config.GROQ_API_KEY;
    if (!key) throw new Error('GROQ_API_KEY no configurada');

    const prompt = this.buildMeetingPrompt(meetingTitle, rawText);
    const models = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b'];
    let lastError = null;

    for (const modelName of models) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);

      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
          },
          body: JSON.stringify({
            model: modelName,
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
          console.warn(`[Groq Finalize] ${modelName} falló (${response.status}), probando siguiente...`);
          lastError = new Error(`Error Groq ${modelName} (${response.status}): ${err}`);
          continue;
        }

        const data = await response.json();
        const raw = data.choices?.[0]?.message?.content;
        const parsed = this.cleanJsonResponse(raw);
        if (parsed) return parsed;
      } catch (err) {
        clearTimeout(timer);
        lastError = err;
        console.warn(`[Groq Finalize] Error ${modelName}: ${err.message}`);
      }
    }

    throw lastError || new Error('Ningún modelo Groq pudo procesar la reunión.');
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

  async askLiveSession({
    question,
    title = 'Sesión en Vivo',
    transcript = '',
    summary = '',
    keyTopics = [],
    keyDecisions = [],
    actionItems = [],
    proactiveAdvice = [],
    userNotes = '',
    history = []
  }) {
    if (!question || !question.trim()) {
      throw new Error('Pregunta requerida');
    }

    const transcriptContext = this.buildSmartTranscriptContext(transcript, question, 90000);
    const topicsStr = (Array.isArray(keyTopics) ? keyTopics : []).join(', ');
    const decisionsStr = (Array.isArray(keyDecisions) ? keyDecisions : []).map(d => `- ${d}`).join('\n');
    const tasksStr = (Array.isArray(actionItems) ? actionItems : [])
      .map(a => `- ${a.task || a} (Resp: ${a.assignee || 'Por asignar'}, Plazo: ${a.deadline || 'Pendiente'})`)
      .join('\n');
    const adviceStr = (Array.isArray(proactiveAdvice) ? proactiveAdvice : []).map(a => `- ${a}`).join('\n');
    const recentHistory = (Array.isArray(history) ? history : [])
      .slice(-6)
      .map(h => `${h.role === 'user' ? 'Usuario' : 'Copiloto'}: ${h.text}`)
      .join('\n');

    const prompt = `
Eres ProActur AI, el Copiloto Ejecutivo en tiempo real que está escuchando y tomando notas de esta reunión / seminario EN VIVO.
Responde la pregunta del usuario basándote en TODO lo transcrito hasta este momento, en las notas tomadas y en los acuerdos detectados.

SESIÓN EN CURSO:
- TÍTULO: ${title}
- RESUMEN ACUMULADO: ${summary || 'En curso...'}
- TEMAS CLAVE: ${topicsStr || 'Por consolidar'}
- DECISIONES / CONCLUSIONES:
${decisionsStr || 'Ninguna registrada aún.'}
- COMPROMISOS Y TAREAS:
${tasksStr || 'Ninguno registrado aún.'}
- NOTAS Y ALERTAS PROACTIVAS:
${adviceStr || 'Ninguna aún.'}
- NOTAS MANUALES DEL USUARIO:
${userNotes || 'Sin notas manuales.'}

TRANSCRIPCIÓN ACUMULADA DE LA SESIÓN (${(transcript || '').length} caracteres totales):
"""
${transcriptContext}
"""

${recentHistory ? `HISTORIAL RECIENTE DEL CHAT EN VIVO:\n${recentHistory}\n` : ''}
PREGUNTA DEL USUARIO EN VIVO:
"${question}"

INSTRUCCIONES:
1. Responde de manera clara, directa, precisa y en español basándote en la transcripción y notas de esta sesión.
2. Si el tema sí se mencionó en la transcripción, cita exactamente qué se dijo, conceptos, ejemplos o conclusiones.
3. Si aún no se ha hablado de ese tema en lo que va de la sesión, indícalo claramente sin inventar datos.
`;

    return await this._runLongContextQuery(prompt, summary || 'Sesión activa en curso.');
  }

  async _runLongContextQuery(prompt, fallbackSummary = '') {
    const models = [
      { provider: 'groq', model: config.GROQ_CHAT_MODEL || 'openai/gpt-oss-120b', name: 'Groq GPT-OSS 120B' },
      { provider: 'groq', model: 'llama-3.3-70b-versatile', name: 'Groq Llama 3.3 70B' },
      { provider: 'openrouter', model: 'deepseek/deepseek-chat', name: 'DeepSeek V3' },
      { provider: 'openrouter', model: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B' },
      { provider: 'gemini', model: this.geminiModel, name: 'Gemini Configurado' },
      { provider: 'gemini', model: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { provider: 'gemini', model: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' }
    ];

    for (const item of models) {
      const { provider, model, name } = item;
      try {
        if (provider === 'groq' && config.GROQ_API_KEY) {
          const ans = await this.callGroq(prompt, 'Eres un asistente ejecutivo experto en analizar transcripciones completas y responder preguntas precisas.', model);
          if (ans) return ans;
        } else if (provider === 'openrouter' && config.OPENROUTER_API_KEY) {
          const ans = await this.callOpenRouter(prompt, 'Eres un asistente ejecutivo experto en analizar transcripciones completas y responder preguntas precisas.', model);
          if (ans) return ans;
        } else if (provider === 'gemini' && config.GEMINI_API_KEY) {
          const ans = await this.callGeminiText(prompt, '', model);
          if (ans) return ans;
        }
      } catch (err) {
        console.warn(`[LongContext AI] Error con ${name}:`, err.message);
      }
    }

    return fallbackSummary
      ? `No fue posible consultar a los modelos remotos en este instante. Resumen acumulado disponible:\n\n${fallbackSummary}`
      : 'No fue posible consultar a los modelos remotos en este instante. Verifica tu conexión e intenta de nuevo.';
  }

  async askMeeting(question, meeting) {
    if (!meeting) throw new Error('Se requiere información de la reunión');

    const title = meeting.title || 'Reunión sin título';
    const date = meeting.createdAt || meeting.date || 'Fecha no registrada';
    const summary = meeting.summary || 'Sin resumen registrado';
    const topics = (meeting.keyTopics || []).join(', ');
    const decisions = (meeting.keyDecisions || []).join('\n- ');
    const tasks = (meeting.actionItems || []).map(a => `- ${a.task} (Responsable: ${a.assignee || 'No asignado'}, Plazo: ${a.deadline || 'Sin plazo'})`).join('\n');
    const advice = (meeting.proactiveAdvice || []).join('\n- ');
    const fullTranscript = meeting.transcript || 'Transcripción no disponible';
    const smartTranscript = this.buildSmartTranscriptContext(fullTranscript, question, 95000);

    const prompt = `
Eres el Copiloto Ejecutivo de ProActur.
El usuario está revisando el registro histórico de una reunión o seminario completo y te hace una consulta directa sobre ella.

INFORMACIÓN EXCLUSIVA DE ESTA SESIÓN:
- TÍTULO: ${title}
- FECHA: ${date}
- TEMAS CLAVE: ${topics || 'No especificados'}
- RESUMEN EJECUTIVO:
${summary}

- ACUERDOS Y DECISIONES CLAVE:
${decisions ? '- ' + decisions : 'No se registraron decisiones formales.'}

- COMPROMISOS Y TAREAS ASIGNADAS:
${tasks || 'No se registraron tareas pendientes.'}

- CONSEJOS PROACTIVOS Y ALERTAS:
${advice ? '- ' + advice : 'No hay consejos adicionales.'}

- TRANSCRIPCIÓN TEXTUAL COMPLETA (${fullTranscript.length} caracteres totales):
"""
${smartTranscript}
"""

PREGUNTA DEL USUARIO:
"${question}"

INSTRUCCIONES CLAVE:
1. Responde de forma concisa, profesional, ejecutiva y certera basada ÚNICAMENTE en la información de esta sesión.
2. Si te piden redactar un correo, un resumen, una lista de pendientes o clarificar conceptos/posturas de participantes o ponentes, usa formato Markdown limpio.
3. Si el dato solicitado no aparece en la sesión, indícalo claramente con honestidad sin inventar información.
`;

    return await this._runLongContextQuery(prompt, `He revisado el registro de "${title}". Sobre tu consulta: ${summary}`);
  }


  // --- GENERACIÓN DE TÍTULO EJECUTIVO INTELIGENTE ---
  async generateExecutiveTitle({ transcript, summary, keyTopics, userNotes }) {
    const contextText = [
      summary ? `Resumen: ${summary}` : '',
      keyTopics && keyTopics.length > 0 ? `Temas: ${keyTopics.join(', ')}` : '',
      transcript ? `Transcripción: ${transcript.substring(0, 1200)}` : '',
      userNotes ? `Notas: ${userNotes.substring(0, 500)}` : ''
    ].filter(Boolean).join('\n');

    if (!contextText.trim() || contextText.length < 15) {
      return null;
    }

    const prompt = `Genera un título ejecutivo, conciso y específico (máximo de 4 a 7 palabras) que sintetice la siguiente reunión o sesión de trabajo.
IMPORTANTE: Devuelve ÚNICAMENTE el texto del título (sin comillas, sin prefijos como "Título:", sin puntos finales y sin explicaciones adicionales).

CONTEXTO:
${contextText}`;

    // 1. Groq ultra-rápido (150ms)
    if (config.GROQ_API_KEY) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.GROQ_API_KEY}`
          },
          body: JSON.stringify({
            model: this.groqModel || 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2,
            max_tokens: 30
          })
        });
        if (res.ok) {
          const data = await res.json();
          const title = data.choices?.[0]?.message?.content?.trim().replace(/^["']|["']$/g, '');
          if (title && title.length > 3 && !this.isGenericTitle(title)) return title;
        }
      } catch (err) {
        console.warn('[AI] Groq title gen error:', err.message);
      }
    }

    // 2. Gemini Flash
    if (config.GEMINI_API_KEY) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.GEMINI_API_KEY },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        if (res.ok) {
          const data = await res.json();
          const title = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim().replace(/^["']|["']$/g, '');
          if (title && title.length > 3 && !this.isGenericTitle(title)) return title;
        }
      } catch (err) {
        console.warn('[AI] Gemini title gen error:', err.message);
      }
    }

    // 3. Fallback heurístico inteligente si no hay internet
    if (keyTopics && keyTopics.length > 0 && keyTopics[0].length > 4 && !this.isGenericTitle(keyTopics[0])) {
      return keyTopics[0].substring(0, 50);
    }
    if (summary && summary.length > 15) {
      const firstSentence = summary.split(/[.\n]/)[0].trim();
      if (firstSentence.length > 10 && !this.isGenericTitle(firstSentence)) return firstSentence.substring(0, 55);
    }
    return null;
  }

  // --- FUSIÓN Y SÍNTESIS DE MÚLTIPLES SESIONES (CAPACITACIONES / SERIES) ---
  async mergeMeetings({ meetings, directive = '' }) {
    if (!Array.isArray(meetings) || meetings.length < 2) {
      throw new Error('Se requieren al menos 2 reuniones para realizar la fusión.');
    }

    // Ordenar cronológicamente
    const sorted = [...meetings].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

    const sessionsContext = sorted.map((m, idx) => {
      const date = m.createdAt ? new Date(m.createdAt).toLocaleDateString('es-ES') : `Sesión ${idx + 1}`;
      return `--- JORNADA / SESIÓN ${idx + 1} (${date}) ---
Título registrado: ${m.title}
Resumen: ${m.summary || 'Sin resumen'}
Temas tratados: ${(m.keyTopics || []).join(', ')}
Decisiones acordadas: ${(m.keyDecisions || []).join(' | ')}
Tareas asignadas: ${(m.actionItems || []).map(t => `${t.task} [${t.assignee || 'Por asignar'}, ${t.deadline || 'Pendiente'}]`).join('; ')}
Transcripción/Notas: ${(m.transcript || '').substring(0, 2000)}`;
    }).join('\n\n');

    const prompt = `Eres ProActur AI, consultor de inteligencia ejecutiva de clase mundial.
Tu tarea es FUSIONAR Y SINTETIZAR una serie de ${sorted.length} sesiones de trabajo (por ejemplo: jornadas de una capacitación de varios días, módulos formativos o etapas de un proyecto) en una sola MINUTA MAESTRA INTEGRAL Y CONSOLIDADA.

${directive ? `DIRECTRIZ O TEMA PRINCIPAL PROVISTO POR EL USUARIO: "${directive}"\n` : ''}

HISTORIAL DE LAS ${sorted.length} SESIONES A CONSOLIDAR (EN ORDEN CRONOLÓGICO):
${sessionsContext}

DIRECTRICES PARA LA SÍNTESIS CONSOLIDADA:
1. TÍTULO MAESTRO: Genera un título integral de alto impacto que englobe toda la capacitación o ciclo de sesiones (ejemplo: "Capacitación Integral en Mantenimiento Preventivo — Días 1 a 3" o "Serie Estratégica: Planificación y Ejecución Comercial").
2. RESUMEN EJECUTIVO GLOBAL: Redacta una síntesis completa y articulada de 2 a 4 párrafos que narre el progreso a través de las diferentes jornadas, unificando conceptos y conclusiones.
3. CRONOLOGÍA POR JORNADAS (keyTopics): Enlista cada sesión como un módulo temático (ejemplo: "Día 1: Diagnóstico inicial", "Día 2: Implementación práctica", "Día 3: Evaluación y cierre").
4. DECISIONES ACORDADAS (keyDecisions): Unifica todas las decisiones de todas las sesiones, eliminando duplicados y ordenándolas por importancia.
5. PLAN MAESTRO DE ACCIÓN (actionItems): Combina y consolida todas las tareas y compromisos de todas las jornadas, deduplicando tareas idénticas y asegurando que cada una tenga su responsable y prioridad.
6. CONSEJOS PROACTIVOS GLOBALES (proactiveAdvice): Recomendaciones y alertas estratégicas para la adopción y seguimiento de todo lo acordado en la serie.

Devuelve ÚNICAMENTE un objeto JSON válido (sin markdown) con esta estructura exacta:
{
  "title": "Título Maestro de la Serie / Capacitación",
  "summary": "Resumen ejecutivo integral del ciclo completo de sesiones",
  "keyTopics": ["Día/Módulo 1: ...", "Día/Módulo 2: ..."],
  "keyDecisions": ["Decisión integral 1", "Decisión integral 2"],
  "actionItems": [
    {
      "task": "Descripción clara de la tarea",
      "assignee": "Responsable",
      "priority": "Alta | Media | Baja",
      "deadline": "Fecha límite o Pendiente",
      "completed": false
    }
  ],
  "proactiveAdvice": ["Recomendación estratégica para la implementación post-capacitación"],
  "transcript": "Síntesis cronológica y notas consolidadas de las ${sorted.length} jornadas fusionadas."
}`;

    let mergedResult = null;

    // Intento 1: Gemini Flash
    if (config.GEMINI_API_KEY) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.GEMINI_API_KEY },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
          })
        });
        if (res.ok) {
          const data = await res.json();
          const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
          mergedResult = this.cleanJsonResponse(raw);
        }
      } catch (err) {
        console.warn('[AI Merge] Gemini falló:', err.message);
      }
    }

    // Intento 2: Groq LPU
    if (!mergedResult && config.GROQ_API_KEY) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.GROQ_API_KEY}`
          },
          body: JSON.stringify({
            model: this.groqModel || 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2,
            response_format: { type: 'json_object' }
          })
        });
        if (res.ok) {
          const data = await res.json();
          const raw = data.choices?.[0]?.message?.content;
          mergedResult = this.cleanJsonResponse(raw);
        }
      } catch (err) {
        console.warn('[AI Merge] Groq falló:', err.message);
      }
    }

    // Fallback determinista local
    if (!mergedResult) {
      const allTasks = [];
      const allDecisions = [];
      sorted.forEach(m => {
        if (Array.isArray(m.actionItems)) allTasks.push(...m.actionItems);
        if (Array.isArray(m.keyDecisions)) allDecisions.push(...m.keyDecisions);
      });
      mergedResult = {
        title: directive || `Capacitación Consolidada: ${sorted.map(s => s.title).join(' / ')}`,
        summary: sorted.map((s, i) => `Jornada ${i + 1} (${s.title}): ${s.summary}`).join('\n\n'),
        keyTopics: sorted.map((s, i) => `Módulo ${i + 1}: ${s.title}`),
        keyDecisions: Array.from(new Set(allDecisions)),
        actionItems: allTasks,
        proactiveAdvice: ['Revisar compromisos y cronograma de seguimiento consolidado.'],
        transcript: sorted.map((s, i) => `[SESIÓN ${i + 1}: ${s.title}]\n${s.transcript || s.summary}`).join('\n\n')
      };
    }

    return {
      ...mergedResult,
      isMergedSeries: true,
      mergedSessionCount: sorted.length,
      mergedFromIds: sorted.map(m => m.id),
      mergedSessionTitles: sorted.map(m => m.title)
    };
  }

  async callGroq(prompt, systemPrompt = '', model = null) {
    const key = config.GROQ_API_KEY;
    if (!key) throw new Error('GROQ_API_KEY no configurada');

    const targetModel = model || config.GROQ_CHAT_MODEL || 'llama-3.3-70b-versatile';
    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: targetModel,
          messages,
          temperature: 0.2
        }),
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Groq API error (${res.status}): ${errText}`);
      }

      const data = await res.json();
      return data.choices?.[0]?.message?.content?.trim() || null;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  async callGeminiText(prompt, systemPrompt = '', model = null) {
    const key = config.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY no configurada');

    const targetModel = model || this.geminiModel || 'gemini-3.6-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent`;

    const contents = [];
    const fullText = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
    contents.push({ parts: [{ text: fullText }] });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': key
        },
        body: JSON.stringify({
          contents,
          generationConfig: { temperature: 0.2 }
        }),
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini API error (${res.status}): ${errText}`);
      }

      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  async callOpenRouter(prompt, systemPrompt = '', model = null) {
    const key = config.OPENROUTER_API_KEY;
    if (!key) throw new Error('OPENROUTER_API_KEY no configurada');

    const targetModel = model || config.OPENROUTER_MODEL || 'deepseek/deepseek-chat';
    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 18000);

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
          'HTTP-Referer': 'https://pro-actur.vercel.app',
          'X-Title': 'ProActur AI'
        },
        body: JSON.stringify({
          model: targetModel,
          messages,
          temperature: 0.2
        }),
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenRouter API error (${res.status}): ${errText}`);
      }

      const data = await res.json();
      return data.choices?.[0]?.message?.content?.trim() || null;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }
}

module.exports = new AIService();
