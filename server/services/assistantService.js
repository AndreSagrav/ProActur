const eventService = require('./eventService');
const financeService = require('./financeService');
const taskService = require('./taskService');
const storageService = require('./storageService');
const noteService = require('./noteService');
const aiService = require('./aiService');

class AssistantService {
  /**
   * Procesa un comando de voz o texto ejecutivo y ejecuta la acción correspondiente.
   * @param {string} command - Instrucción en lenguaje natural
   * @returns {Promise<{ action: string, message: string, data?: any }>}
   */
  async processCommand(command) {
    if (!command || !command.trim()) {
      return { action: 'NONE', message: 'Instrucción vacía recibida.' };
    }

    const cmd = command.trim();
    const lower = cmd.toLowerCase();

    // 1. Detección rápida de orden de grabación de audio / reunión
    if (
      lower.includes('grabar reunión') ||
      lower.includes('iniciar grabación') ||
      lower.includes('comenzar grabación') ||
      lower.includes('graba la reunión') ||
      lower.includes('grabar sesion') ||
      lower.includes('iniciar sesion de audio')
    ) {
      return {
        action: 'START_RECORDING',
        message: 'Iniciando captura de audio y análisis de reunión en vivo.',
        data: {}
      };
    }

    // 2. Intentar parsear con IA ejecutiva
    try {
      const parsed = await this.parseWithAI(cmd);
      if (parsed && parsed.action) {
        return await this.executeAction(parsed, cmd);
      }
    } catch (err) {
      console.warn('[AssistantService AI Parse Warn]:', err.message);
    }

    // 3. Fallback heurístico determinístico (en caso de degradación de red o cuota)
    return await this.fallbackExecute(cmd, lower);
  }

  async parseWithAI(cmd) {
    const today = new Date().toISOString();
    const systemPrompt = `Eres el Asistente Ejecutivo de ProActur. Analiza la siguiente instrucción del directivo y extrae la intención en formato JSON puro (sin markdown, sin bloques de código).

Fecha/Hora actual: ${today}.

Opciones de "action":
1. "CREATE_EVENT": Si la orden es agendar, programar una junta, cita, evento o reunión con fecha/hora.
2. "RECORD_FINANCE": Si la orden indica un gasto, pago, compra, ingreso, cobro monetario, factura electrónica, comprobante fiscal, ticket o voucher bancario.
3. "CREATE_TASK": Si la orden indica recordar algo, crear un pendiente, tarea o compromiso sin horario específico.
4. "START_RECORDING": Si pide grabar o registrar una reunión o audio.
5. "ANSWER": Si es una pregunta, consulta sobre reuniones pasadas, tareas o finanzas.

Estructura JSON requerida según acción:
{
  "action": "CREATE_EVENT" | "RECORD_FINANCE" | "CREATE_TASK" | "START_RECORDING" | "ANSWER",
  "event": {
    "title": "título formal del evento",
    "startTime": "YYYY-MM-DDTHH:mm:ss.sssZ (interpretar fechas relativas como 'mañana', 'el lunes', etc.)",
    "location": "ubicación o virtual si se menciona"
  },
  "finance": {
    "amount": 0.00,
    "type": "gasto" | "ingreso",
    "category": "Gasolina y Transporte" | "Alimentación y Reuniones" | "Honorarios Profesionales" | "Servicios y Software" | "Varios",
    "note": "concepto formal del movimiento"
  },
  "task": {
    "title": "descripción formal de la tarea",
    "priority": "high" | "medium" | "low"
  },
  "question": "texto de la consulta si la acción es ANSWER"
}`;

    const prompt = `Instrucción del usuario: "${cmd}"`;

    let rawResponse = null;
    // Flota completa de 11 Modelos Ejecutivos de Alta Capacidad y Respaldo:
    // 1° Groq LPU (GPT-OSS 120B / Qwen 27B) -> 2° Google Gemini (3.6 / 3.5 / Lite) -> 3° OpenRouter -> 4° Motor Local Offline
    const executiveFleet = [
      { provider: 'groq', model: 'openai/gpt-oss-120b', name: 'Groq GPT-OSS 120B' },
      { provider: 'groq', model: 'qwen/qwen3.8-27b', name: 'Groq Qwen 3.8 27B' },
      { provider: 'groq', model: 'openai/gpt-oss-20b', name: 'Groq GPT-OSS 20B' },
      { provider: 'gemini', model: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash' },
      { provider: 'gemini', model: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' },
      { provider: 'gemini', model: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite' },
      { provider: 'gemini', model: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite' },
      { provider: 'gemini', model: 'gemini-flash-lite-latest', name: 'Gemini Flash Lite Latest' },
      { provider: 'gemini', model: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview' },
      { provider: 'openrouter', model: 'nvidia/nemotron-3.5-super-vl:free', name: 'Nemotron 3.5 Super VL' },
      { provider: 'openrouter', model: 'recursive/flint-v1.0:free', name: 'Flint v1.0 Free' }
    ];

    for (const p of executiveFleet) {
      try {
        if (p.provider === 'groq') {
          rawResponse = await aiService.callGroq(prompt, systemPrompt, p.model);
        } else if (p.provider === 'gemini') {
          rawResponse = await aiService.callGeminiText(prompt, systemPrompt, p.model);
        } else if (p.provider === 'openrouter') {
          rawResponse = await aiService.callOpenRouter(prompt, systemPrompt, p.model);
        }
        if (rawResponse) break;
      } catch (_) {}
    }

    if (!rawResponse) return null;

    const cleaned = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  }

  async executeAction(parsed, originalCmd) {
    // A) CREAR EVENTO / AGENDA
    if (parsed.action === 'CREATE_EVENT' && parsed.event?.title) {
      const startTime = parsed.event.startTime || new Date(Date.now() + 86400000).toISOString();
      const event = await eventService.createEvent({
        title: parsed.event.title,
        startTime,
        location: parsed.event.location || '',
        color: '#f59e0b',
        tags: ['asistente-ejecutivo']
      });

      const dateStr = new Date(startTime).toLocaleString('es-MX', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });

      return {
        action: 'CREATE_EVENT',
        message: `Evento agendado: "${event.title}" para el ${dateStr}.`,
        data: event
      };
    }

    // B) REGISTRAR FINANZA
    if (parsed.action === 'RECORD_FINANCE' && parsed.finance?.amount) {
      const amount = Math.abs(Number(parsed.finance.amount));
      const isIncome = parsed.finance.type === 'ingreso';
      const tx = await financeService.addTransaction({
        amount,
        type: isIncome ? 'ingreso' : 'gasto',
        category: parsed.finance.category || (isIncome ? 'Honorarios Profesionales' : 'Gasolina y Transporte'),
        note: parsed.finance.note || originalCmd
      });

      return {
        action: 'RECORD_FINANCE',
        message: `Registro financiero asentado: ${isIncome ? 'Ingreso' : 'Egreso'} de $${amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN (${tx.category}).`,
        data: tx
      };
    }

    // C) CREAR TAREA
    if (parsed.action === 'CREATE_TASK' && parsed.task?.title) {
      const task = await taskService.createTask({
        title: parsed.task.title,
        priority: parsed.task.priority || 'high',
        source: 'assistant'
      });

      return {
        action: 'CREATE_TASK',
        message: `Tarea prioritaria registrada: "${task.title}".`,
        data: task
      };
    }

    // D) INICIAR GRABACIÓN
    if (parsed.action === 'START_RECORDING') {
      return {
        action: 'START_RECORDING',
        message: 'Iniciando captura de audio y análisis de reunión.',
        data: {}
      };
    }

    // E) CONSULTA / SEGUNDO CEREBRO
    return await this.answerQuestion(parsed.question || originalCmd);
  }

  async fallbackExecute(cmd, lower) {
    // 1. Detección de gasto / ingreso con regex
    const amountMatch = lower.match(/\$?\s*(\d+(?:[.,]\d+)?)/);
    const isExpense = lower.includes('gast') || lower.includes('pagu') || lower.includes('compr') || lower.includes('egreso');
    const isIncome = lower.includes('ingres') || lower.includes('cobr') || lower.includes('gan') || lower.includes('abono');

    if ((isExpense || isIncome) && amountMatch) {
      const amount = parseFloat(amountMatch[1].replace(',', '.'));
      let category = isIncome ? 'Honorarios Profesionales' : 'Gasolina y Transporte';
      if (lower.includes('comida') || lower.includes('almuerz') || lower.includes('restauran')) {
        category = 'Alimentación y Reuniones';
      } else if (lower.includes('software') || lower.includes('servici') || lower.includes('internet')) {
        category = 'Servicios y Software';
      }

      const tx = await financeService.addTransaction({
        amount,
        type: isIncome ? 'ingreso' : 'gasto',
        category,
        note: cmd
      });

      return {
        action: 'RECORD_FINANCE',
        message: `Registro financiero asentado: ${isIncome ? 'Ingreso' : 'Egreso'} de $${amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN.`,
        data: tx
      };
    }

    // 2. Detección de agenda / cita
    if (lower.startsWith('agenda') || lower.startsWith('agendar') || lower.startsWith('cita') || lower.startsWith('junta') || lower.startsWith('reunion')) {
      const cleanTitle = cmd.replace(/^(agenda(r)?|cita|junta|reunion)\s*/i, '') || 'Reunión Ejecutiva';
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);

      const event = await eventService.createEvent({
        title: cleanTitle,
        startTime: tomorrow.toISOString(),
        color: '#f59e0b'
      });

      return {
        action: 'CREATE_EVENT',
        message: `Evento agendado en su calendario: "${cleanTitle}".`,
        data: event
      };
    }

    // 3. Detección de tarea / recordatorio
    if (lower.startsWith('recuerda') || lower.startsWith('recordar') || lower.startsWith('tarea') || lower.startsWith('pendiente')) {
      const cleanTitle = cmd.replace(/^(recuerda(me)?|recordar|tarea:?|pendiente:?)\s*/i, '') || cmd;
      const task = await taskService.createTask({
        title: cleanTitle,
        priority: lower.includes('urgent') || lower.includes('prioritari') ? 'high' : 'medium',
        source: 'assistant'
      });

      return {
        action: 'CREATE_TASK',
        message: `Tarea agregada al registro ejecutivo: "${cleanTitle}".`,
        data: task
      };
    }

    // 4. Consulta general
    return await this.answerQuestion(cmd);
  }

  async answerQuestion(question) {
    try {
      const allMeetings = await storageService.getAllMeetings();
      let allNotes = [];
      try {
        allNotes = await noteService.getAllNotes();
      } catch (_) {}

      const answer = await aiService.askSecondBrain(question, allMeetings, allNotes);
      return {
        action: 'ANSWER',
        message: answer || 'Consulta procesada satisfactoriamente.',
        data: {
          meetingsAnalyzed: allMeetings.length,
          notesAnalyzed: allNotes.length
        }
      };
    } catch (err) {
      return {
        action: 'ANSWER',
        message: 'No fue posible completar el análisis de la consulta: ' + err.message
      };
    }
  }
}

module.exports = new AssistantService();
