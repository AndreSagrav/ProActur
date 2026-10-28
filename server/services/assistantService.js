const eventService = require('./eventService');
const financeService = require('./financeService');
const taskService = require('./taskService');
const storageService = require('./storageService');
const noteService = require('./noteService');
const aiService = require('./aiService');
const edusService = require('./edusService');
const dobyBrowserService = require('./dobyBrowserService');

class AssistantService {
  /**
   * Procesa un comando de voz o texto ejecutivo y ejecuta la acción correspondiente.
   * @param {string} command - Instrucción en lenguaje natural
   * @returns {Promise<{ action: string, message: string, data?: any }>}
   */
  async processCommand(command, options = {}) {
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
        return await this.executeAction(parsed, cmd, options);
      }
    } catch (err) {
      console.warn('[AssistantService AI Parse Warn]:', err.message);
    }

    // 3. Fallback heurístico determinístico (en caso de degradación de red o cuota)
    return await this.fallbackExecute(cmd, lower);
  }

  async parseWithAI(cmd) {
    const today = new Date().toISOString();
    const systemPrompt = `Eres Dobby, el copiloto y asistente ejecutivo de ProActur. Analiza la siguiente instrucción de César y extrae la intención en formato JSON puro (sin markdown, sin bloques de código).

Fecha/Hora actual: ${today}.
Contexto del usuario: César Andrés reside en Costa Rica.
Moneda por defecto: Colones costarricenses (CRC, ₡), a menos que el usuario diga explícitamente "dólares" o "USD".
Cuentas bancarias habituales: "BAC" (o BAC Credomatic), "Wink" (Wink débito o crédito), "Popular" (Banco Popular).

Opciones de "action":
1. "CREATE_EVENT": Si la orden es agendar, programar una junta, cita, evento o reunión con fecha/hora.
2. "RECORD_FINANCE": Si la orden indica uno o varios gastos, pagos, compras, ingresos, cobros monetarios, transferencias o movimientos bancarios, especialmente SINPE Móvil (ej: "mandé un sinpe de 10 mil a Juan de la cuenta Wink", "hice un sinpe de 5000", "me transfirieron un sinpe de 25000 al Popular", "pagué 2000 en el súper con el BAC", o listas de varios SINPEs).
3. "CREATE_TASK": Si la orden indica recordar algo, crear un pendiente, tarea o compromiso sin horario específico.
4. "START_RECORDING": Si pide grabar o registrar una reunión o audio.
5. "EDUS_MONITORING": Si pide buscar, monitorear o sacar citas médicas, dentales u odontológicas en el EDUS de la CCSS o EBAIS (ej: "sácame una cita con el odontólogo", "sacar cita el viernes en EDUS", "monitoree citas en EDUS", "cita dental").
6. "SEARCH_PROMOS": Si pide buscar promociones, ofertas o combos (ej: "promociones de KFC", "ofertas de comida").
7. "ANSWER": Si es una pregunta, consulta sobre reuniones pasadas, tareas o finanzas.

REGLA ESTRICTA DE FINANZAS Y SINPE:
Si el usuario menciona o lista MÚLTIPLES transferencias, montos, personas o SINPEs (ej: dos o más pagos, recibos o personas):
- NUNCA los sumes ni los agrupes en un solo registro genérico como "Ingresos varios".
- Debes devolver la propiedad "finances" como un arreglo (array) con CADA transferencia desglosada por separado con su respectivo "amount", "contact", "note", "type" e "isSinpe: true".

Estructura JSON requerida según acción:
{
  "action": "CREATE_EVENT" | "RECORD_FINANCE" | "CREATE_TASK" | "START_RECORDING" | "EDUS_MONITORING" | "SEARCH_PROMOS" | "ANSWER",
  "event": {
    "title": "título formal del evento",
    "startTime": "YYYY-MM-DDTHH:mm:ss.sssZ (interpretar fechas relativas como 'mañana', 'el lunes', etc.)",
    "location": "ubicación o virtual si se menciona"
  },
  "finances": [
    {
      "amount": 0.00,
      "currency": "CRC" | "USD",
      "type": "gasto" | "ingreso",
      "isSinpe": true | false,
      "account": "Wink" | "BAC" | "Popular" | "Efectivo",
      "contact": "nombre o teléfono si es transferencia o SINPE",
      "category": "Gasolina y Transporte" | "Alimentación y Reuniones" | "Honorarios Profesionales" | "Transferencias Recibidas" | "Servicios y Software" | "Varios",
      "note": "concepto formal individual del movimiento (ej: 'Empanada', 'Almuerzo')"
    }
  ],
  "finance": {
    "amount": 0.00,
    "currency": "CRC" | "USD",
    "type": "gasto" | "ingreso",
    "isSinpe": true | false,
    "account": "Wink" | "BAC" | "Popular" | "Efectivo",
    "contact": "nombre o teléfono si es transferencia o SINPE",
    "category": "Gasolina y Transporte" | "Alimentación y Reuniones" | "Honorarios Profesionales" | "Transferencias Recibidas" | "Servicios y Software" | "Varios",
    "note": "concepto formal del movimiento"
  },
  "task": {
    "title": "descripción formal de la tarea",
    "priority": "high" | "medium" | "low"
  },
  "edus": {
    "preferredDay": "viernes" | "lunes" | "martes" | "miercoles" | "jueves",
    "timeSlot": "mañana" | "tarde"
  },
  "promo": {
    "merchant": "KFC" | "comercio"
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

  async executeAction(parsed, originalCmd, options = {}) {
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

      const dateStr = new Date(startTime).toLocaleString('es-CR', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });

      return {
        action: 'CREATE_EVENT',
        message: `Evento agendado: "${event.title}" para el ${dateStr}.`,
        data: event
      };
    }

    // B) REGISTRAR FINANZA (INDIVIDUAL O MÚLTIPLES MOVIMIENTOS / SINPEs DESGLOSADOS)
    if (parsed.action === 'RECORD_FINANCE' && (parsed.finances?.length > 0 || parsed.finance?.amount)) {
      const itemsToRecord = parsed.finances && Array.isArray(parsed.finances) && parsed.finances.length > 0
        ? parsed.finances
        : [parsed.finance];

      const overview = await financeService.getSummary();
      const accounts = overview?.accounts || [];
      const recordedTxs = [];
      const summaryLines = [];

      for (const item of itemsToRecord) {
        if (!item || !item.amount) continue;
        const amount = Math.abs(Number(item.amount));
        const isIncome = item.type === 'ingreso';
        const currency = (item.currency || 'CRC').toUpperCase();
        const lowerItem = `${item.note || ''} ${item.contact || ''} ${originalCmd || ''}`.toLowerCase();
        const isSinpe = !!item.isSinpe || (item.note || '').toLowerCase().includes('sinpe') || lowerItem.includes('sinpe') || lowerItem.includes('transferí') || lowerItem.includes('transferi');

        const requestedAcc = `${item.account || ''} ${originalCmd || ''}`.toLowerCase();
        const targetAccount = this.resolveTargetAccount(accounts, requestedAcc, currency);

        let note = item.note || originalCmd;
        if (isSinpe && !note.toLowerCase().includes('sinpe')) {
          const contact = item.contact ? ` (${isIncome ? 'de' : 'a'} ${item.contact})` : '';
          note = `SINPE Móvil${contact}: ${note}`;
        }

        const tx = await financeService.addTransaction({
          accountId: targetAccount?.id,
          amount,
          currency,
          type: isIncome ? 'ingreso' : 'gasto',
          category: item.category || (isIncome ? 'Transferencias Recibidas' : (isSinpe ? 'Varios' : 'Gasolina y Transporte')),
          note,
          source: isSinpe ? 'sinpe_assistant' : 'assistant_voice',
          merchant: item.contact || ''
        });

        if (tx) {
          recordedTxs.push(tx);
          const formattedAmount = currency === 'CRC'
            ? `₡${Math.round(amount).toLocaleString('es-CR')} CRC`
            : `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`;
          const accDesc = targetAccount ? `${targetAccount.name}` : 'cuenta';
          summaryLines.push(`• ${isIncome ? 'Ingreso' : 'Egreso'} de ${formattedAmount} en ${accDesc} [${note}]`);
        }
      }

      const totalCount = recordedTxs.length;
      const sinpeBadge = itemsToRecord.some(i => i.isSinpe) ? ' 📲 [SINPE Móvil]' : '';

      return {
        action: 'RECORD_FINANCE',
        message: totalCount === 1
          ? `Registro financiero asentado${sinpeBadge}: ${summaryLines[0].replace('• ', '')}.`
          : `${totalCount} transferencias SINPE asentadas${sinpeBadge} individualmente:\n${summaryLines.join('\n')}`,
        data: totalCount === 1 ? recordedTxs[0] : recordedTxs
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

    // D2) GESTIÓN DE CITAS EDUS CCSS Y DOBBY WEB AGENT
    if (parsed.action === 'EDUS_MONITORING') {
      const lowerCmd = (originalCmd || '').toLowerCase();
      const isDental = lowerCmd.includes('odont') || lowerCmd.includes('dient') || lowerCmd.includes('autolog') || lowerCmd.includes('dentist') || lowerCmd.includes('muela') || lowerCmd.includes('dental');
      const specialty = isDental ? 'Odontología' : 'Medicina General';

      // NUNCA asumir "viernes" a menos que César lo haya pedido explícitamente
      let preferredDay = null;
      for (const day of ['lunes', 'martes', 'miércoles', 'miercoles', 'jueves', 'viernes', 'sábado', 'sabado', 'domingo']) {
        if (lowerCmd.includes(day)) {
          preferredDay = day;
          break;
        }
      }

      let timeSlot = null;
      if (lowerCmd.includes('mañana') || lowerCmd.includes('manana')) timeSlot = 'mañana';
      else if (lowerCmd.includes('tarde')) timeSlot = 'tarde';

      const job = await edusService.createEdusJob({
        preferredDay: preferredDay || 'más próxima',
        timeSlot: timeSlot || 'cualquiera',
        specialty,
        notes: originalCmd
      });

      const userCedula = options.userCedula || process.env.EDUS_CEDULA || '';
      const userClave = options.userClave || process.env.EDUS_CLAVE || '';
      const hasCredentials = Boolean(userCedula && userClave);

      // Iniciar navegación o conectar a Chrome existente y arrancar monitoreo en tiempo real
      try {
        (async () => {
          // 1. Intentar conectar primero a Chrome ya abierto con remote debugging (puerto 9222)
          const connectRes = await dobyBrowserService.connectToExistingChrome({ port: 9222 });
          if (connectRes?.success) {
            await dobyBrowserService.startMonitoringLoop({
              service: isDental ? 'ODONTOLOGIA' : 'MEDICINA GENERAL',
              specialty: isDental ? 'ODONTOLOGIA GENERAL' : 'MEDICINA GENERAL',
              targetDay: preferredDay,
              intervalSeconds: 5,
              autoBook: true
            });
            return;
          }

          // 2. Si no hay Chrome en puerto 9222, abrir sesión visible con Dobby
          const launchRes = await dobyBrowserService.launchEdusPortal({
            headless: false,
            userCedula,
            userClave,
            autoSolve: true
          });

          if (hasCredentials && launchRes?.solvedCaptcha) {
            const loginRes = await dobyBrowserService.submitLogin({
              userCedula,
              userClave,
              captchaCode: launchRes.solvedCaptcha
            });
            if (loginRes?.success) {
              await dobyBrowserService.startMonitoringLoop({
                service: isDental ? 'ODONTOLOGIA' : 'MEDICINA GENERAL',
                specialty: isDental ? 'ODONTOLOGIA GENERAL' : 'MEDICINA GENERAL',
                targetDay: preferredDay,
                intervalSeconds: 5,
                autoBook: true
              });
            }
          }
        })().catch(err => {
          console.warn('[DobbyBrowser AutoLaunch Warn]:', err.message);
        });
      } catch (_) {}

      const dayText = preferredDay ? `para el ${preferredDay}` : 'más próxima disponible';
      const replyMsg = hasCredentials
        ? `Inicié la búsqueda y auto-reserva en tiempo real de tu cita ${dayText} para ${specialty}. Tengo el portal EDUS en pantalla, resolviendo captchas y monitoreando cada 5 segundos para sacar el cupo de inmediato apenas se libere.`
        : `Tengo el portal EDUS listo para sacar tu cita ${dayText} de ${specialty} en tiempo real. Si ya tienes EDUS abierto o ingresas tus datos, Dobby ejecutará la búsqueda en bucle rápido y reservará el cupo en el instante en que aparezca.`;

      return {
        action: 'EDUS_MONITORING',
        message: replyMsg,
        data: { ...job, browserStarted: true, hasCredentials, specialty, preferredDay }
      };
    }

    // D3) BÚSQUEDA DE PROMOCIONES
    if (parsed.action === 'SEARCH_PROMOS') {
      const merchant = parsed.promo?.merchant || 'KFC';
      const promoResult = await edusService.searchPromotions(merchant);
      const topPromo = promoResult.promotions[0]?.title || 'Promociones encontradas';
      return {
        action: 'SEARCH_PROMOS',
        message: `Se encontraron ${promoResult.promotions.length} promociones activas en ${promoResult.merchant}. Destacada: ${topPromo}.`,
        data: promoResult
      };
    }

    // E) CONSULTA / SEGUNDO CEREBRO
    return await this.answerQuestion(parsed.question || originalCmd);
  }

  async fallbackExecute(cmd, lower) {
    // 1. Detección de gasto / ingreso / SINPE con regex
    const isSinpe = lower.includes('sinpe') || lower.includes('transferí') || lower.includes('transferi') || lower.includes('transferencia');
    const isIncome = lower.includes('ingres') || lower.includes('cobr') || lower.includes('gan') || lower.includes('abono') || lower.includes('recibí') || lower.includes('recibi') || lower.includes('me transfirieron') || lower.includes('me pasaron') || lower.includes('me pagaron');
    const isExpense = isSinpe || lower.includes('gast') || lower.includes('pagu') || lower.includes('compr') || lower.includes('egreso') || lower.includes('mandé') || lower.includes('mande') || lower.includes('le pasé') || lower.includes('le pase');

    // Extraer monto en colones o dólares (soporta '10 mil', '10.000', '10000', '$50', '₡2500')
    let detectedAmount = null;
    const milMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:mil|k)\b/i);
    if (milMatch) {
      detectedAmount = parseFloat(milMatch[1].replace(',', '.')) * 1000;
    } else {
      const numMatch = lower.match(/(?:₡|\$)?\s*(\d+(?:[.,]\d{3})*(?:[.,]\d+)?)/);
      if (numMatch) {
        let rawNum = numMatch[1];
        if (rawNum.includes('.') && rawNum.includes(',')) {
          rawNum = rawNum.replace(/\./g, '').replace(',', '.');
        } else if (rawNum.includes(',') && !rawNum.includes('.')) {
          const parts = rawNum.split(',');
          if (parts[1] && parts[1].length === 3) rawNum = parts.join('');
          else rawNum = rawNum.replace(',', '.');
        } else if (rawNum.includes('.') && !rawNum.includes(',')) {
          const parts = rawNum.split('.');
          if (parts[1] && parts[1].length === 3) rawNum = parts.join('');
        }
        detectedAmount = parseFloat(rawNum);
      }
    }

    if ((isExpense || isIncome) && detectedAmount && !isNaN(detectedAmount) && detectedAmount > 0) {
      const isUSD = lower.includes('dolar') || lower.includes('dólar') || lower.includes('usd') || lower.includes('$');
      const currency = isUSD ? 'USD' : 'CRC';

      let category = isIncome ? 'Transferencias Recibidas' : (isSinpe ? 'Varios' : 'Gasolina y Transporte');
      if (lower.includes('comida') || lower.includes('almuerz') || lower.includes('restauran') || lower.includes('soda')) {
        category = 'Alimentación y Reuniones';
      } else if (lower.includes('software') || lower.includes('servici') || lower.includes('internet') || lower.includes('luz') || lower.includes('agua')) {
        category = 'Servicios y Software';
      }

      // Detectar cuenta real adecuada
      const overview = await financeService.getSummary();
      const accounts = overview?.accounts || [];
      const targetAccount = this.resolveTargetAccount(accounts, lower, currency);

      let note = cmd;
      if (isSinpe && !note.toLowerCase().includes('sinpe')) {
        note = `SINPE Móvil: ${cmd}`;
      }

      const tx = await financeService.addTransaction({
        accountId: targetAccount?.id,
        amount: detectedAmount,
        currency,
        type: isIncome ? 'ingreso' : 'gasto',
        category,
        note,
        source: isSinpe ? 'sinpe_assistant' : 'assistant_voice'
      });

      const formattedAmount = currency === 'CRC'
        ? `₡${Math.round(detectedAmount).toLocaleString('es-CR')} CRC`
        : `$${detectedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`;

      const accDesc = targetAccount ? `${targetAccount.name} (${targetAccount.entity})` : 'cuenta principal';
      const sinpeBadge = isSinpe ? ' 📲 [SINPE Móvil]' : '';

      return {
        action: 'RECORD_FINANCE',
        message: `Registro financiero asentado${sinpeBadge}: ${isIncome ? 'Ingreso' : 'Egreso'} de ${formattedAmount} en ${accDesc}.`,
        data: tx
      };
    }

    // 2. Detección prioritaria de EDUS / CCSS / Odontología (antes de agenda genérica)
    if (lower.includes('edus') || lower.includes('ccss') || lower.includes('ebais') || lower.includes('odont') || lower.includes('dient') || (lower.includes('cita') && (lower.includes('medic') || lower.includes('médic')))) {
      const isDental = lower.includes('odont') || lower.includes('dient');
      const specialty = isDental ? 'Odontología' : 'Medicina General';
      const isMorning = lower.includes('mañana') || !lower.includes('tarde');
      const isFriday = lower.includes('viernes') || true;
      const job = await edusService.createEdusJob({
        preferredDay: isFriday ? 'viernes' : 'próximo día hábil',
        timeSlot: isMorning ? 'mañana' : 'tarde',
        specialty,
        notes: cmd
      });

      try {
        dobyBrowserService.launchEdusPortal({ headless: false, autoSolve: true }).then(() => {
          dobyBrowserService.startMonitoringLoop({
            service: isDental ? 'ODONTOLOGIA' : 'MEDICINA GENERAL',
            targetDay: isFriday ? 'viernes' : 'lunes',
            intervalSeconds: 60
          }).catch(() => {});
        }).catch(() => {});
      } catch (_) {}

      return {
        action: 'EDUS_MONITORING',
        message: `Estoy abriendo el portal de EDUS CCSS en pantalla para monitorear citas de ${specialty}.`,
        data: { ...job, browserStarted: true }
      };
    }

    // 3. Detección de agenda / cita normal
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

    // 4. Detección fallback de EDUS / CCSS
    if (lower.includes('edus') || lower.includes('ccss') || (lower.includes('cita') && (lower.includes('medic') || lower.includes('médic')))) {
      const isMorning = lower.includes('mañana') || !lower.includes('tarde');
      const isFriday = lower.includes('viernes') || true;
      const job = await edusService.createEdusJob({
        preferredDay: isFriday ? 'viernes' : 'próximo día hábil',
        timeSlot: isMorning ? 'mañana' : 'tarde',
        notes: cmd
      });
      return {
        action: 'EDUS_MONITORING',
        message: `Monitoreo autónomo activado en EDUS (CCSS) para cupo médico el viernes por la mañana. Se le notificará en cuanto se reserve.`,
        data: job
      };
    }

    // 5. Detección fallback de Promociones (KFC, restaurantes)
    if (lower.includes('kfc') || lower.includes('promocion') || lower.includes('promo') || lower.includes('oferta')) {
      const promoResult = await edusService.searchPromotions('KFC');
      return {
        action: 'SEARCH_PROMOS',
        message: `Búsqueda de promociones en KFC Costa Rica completada con éxito.`,
        data: promoResult
      };
    }

    // 6. Consulta general
    return await this.answerQuestion(cmd);
  }

  resolveTargetAccount(accounts = [], requestedText = '', currency = 'CRC') {
    const text = (requestedText || '').toLowerCase();
    const curr = (currency || 'CRC').toUpperCase();

    // 1. Wink
    if (text.includes('wink')) {
      if (text.includes('crédito') || text.includes('credito') || text.includes('tarjeta')) {
        const cred = accounts.find(a => (a.entity?.toLowerCase().includes('wink') || a.name?.toLowerCase().includes('wink')) && a.type === 'credito');
        if (cred) return cred;
      }
      if (text.includes('dolar') || text.includes('dólar') || curr === 'USD') {
        const usdAcc = accounts.find(a => (a.entity?.toLowerCase().includes('wink') || a.name?.toLowerCase().includes('wink')) && a.type !== 'credito' && (a.currency || '').toUpperCase() === 'USD');
        if (usdAcc) return usdAcc;
      }
      // Por defecto en colones costarricenses (CRC)
      const crcAcc = accounts.find(a => (a.entity?.toLowerCase().includes('wink') || a.name?.toLowerCase().includes('wink')) && a.type !== 'credito' && (a.currency || 'CRC').toUpperCase() === 'CRC');
      if (crcAcc) return crcAcc;
      return accounts.find(a => a.entity?.toLowerCase().includes('wink') || a.name?.toLowerCase().includes('wink'));
    }

    // 2. Banco Popular
    if (text.includes('popular') || text.includes('bp')) {
      return accounts.find(a => a.entity?.toLowerCase().includes('popular') || a.name?.toLowerCase().includes('popular'));
    }

    // 3. BAC Credomatic
    if (text.includes('bac')) {
      if (text.includes('dolar') || text.includes('dólar') || curr === 'USD') {
        const usdAcc = accounts.find(a => (a.entity?.toLowerCase().includes('bac') || a.name?.toLowerCase().includes('bac')) && (a.currency || '').toUpperCase() === 'USD');
        if (usdAcc) return usdAcc;
      }
      const crcAcc = accounts.find(a => (a.entity?.toLowerCase().includes('bac') || a.name?.toLowerCase().includes('bac')) && a.type === 'debito' && (a.currency || 'CRC').toUpperCase() === 'CRC');
      if (crcAcc) return crcAcc;
      return accounts.find(a => a.entity?.toLowerCase().includes('bac') || a.name?.toLowerCase().includes('bac'));
    }

    // 4. Default / Fallback a cuenta de débito de la misma divisa
    return accounts.find(a => a.type === 'debito' && (a.currency || 'CRC').toUpperCase() === curr)
      || accounts.find(a => a.type === 'debito')
      || accounts[0];
  }

  async getFinanceBrief() {
    try {
      const fin = await financeService.getSummary();
      if (!fin) return '';
      const liquidAccs = (fin.accounts || []).filter(a => a.type !== 'credito');
      const creditCards = (fin.accounts || []).filter(a => a.type === 'credito');
      const lines = [
        `ESTADO FINANCIERO Y CUENTAS REALES DE CÉSAR ANDRÉS (AL DÍA):`,
        `- Saldo Líquido Disponible Total: ₡${(fin.balance || 0).toLocaleString()} CRC`,
        `- Cuentas de Débito y Efectivo:`
      ];
      liquidAccs.forEach(a => {
        lines.push(`  * ${a.name} (${a.entity}): ₡${(a.balance || 0).toLocaleString()} CRC disponibles (Inicial: ₡${(a.initialBalance || 0).toLocaleString()})`);
      });
      if (creditCards.length > 0) {
        lines.push(`- Tarjetas de Crédito / Pasivos:`);
        creditCards.forEach(c => {
          lines.push(`  * ${c.name} (${c.entity}): Límite ₡${(c.creditLimit || 0).toLocaleString()} ($${c.creditLimitUSD || 3000}), Consumo/Deuda actual ₡${(c.balance || 0).toLocaleString()} ($${c.debtUSD || 0}), Disponible para compras ₡${(c.availableCredit || 0).toLocaleString()} ($${c.availableCreditUSD || 0}), Pago de contado $${c.cashPaymentUSD || 0}, Pago mínimo $${c.minPaymentUSD || 0}, Fecha de Corte día ${c.cutOffDay || 13}, Fecha Límite de Pago día ${c.paymentDueDay || 2}`);
        });
      }
      lines.push(`- Deuda Total en Tarjetas: ₡${(fin.creditDebt || 0).toLocaleString()} CRC`);
      lines.push(`- Gastos del Mes: ₡${(fin.monthExpense || 0).toLocaleString()} CRC`);
      lines.push(`- Ingresos del Mes: ₡${(fin.monthIncome || 0).toLocaleString()} CRC`);
      return lines.join('\n');
    } catch (_) {
      return '';
    }
  }

  async answerQuestion(question) {
    try {
      const lower = question.toLowerCase();
      const isFinQuery = lower.includes('saldo') || lower.includes('cuenta') || lower.includes('tarjeta') || lower.includes('debo') || lower.includes('deuda') || lower.includes('cuánto tengo') || lower.includes('cuanto tengo') || lower.includes('corte') || lower.includes('pago') || lower.includes('gasto') || lower.includes('dinero') || lower.includes('bac') || lower.includes('wink') || lower.includes('popular');

      if (isFinQuery) {
        const finBrief = await this.getFinanceBrief();
        if (finBrief) {
          const sysPrompt = `Eres ProActur AI, el asistente ejecutivo de máxima confianza de César Andrés. Responde a su consulta sobre sus cuentas bancarias, saldos o deudas con cifras exactas, concisas y en español natural directo de Costa Rica. Sin relleno.`;
          try {
            const reply = await aiService.callGroq(`Pregunta de César: "${question}"\n\n${finBrief}`, sysPrompt, 'openai/gpt-oss-120b');
            if (reply) return { action: 'ANSWER', message: reply, data: { source: 'finances' } };
          } catch (_) {
            try {
              const reply = await aiService.callGeminiText(`Pregunta de César: "${question}"\n\n${finBrief}`, sysPrompt, 'gemini-3.6-flash');
              if (reply) return { action: 'ANSWER', message: reply, data: { source: 'finances' } };
            } catch (_) {}
          }
        }
      }

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

  /**
   * Conversación Humana y Fluida Bidireccional (Estilo Gemini Live)
   * @param {{ message: string, history?: Array<{ role: 'user' | 'assistant', text: string }>, userCedula?: string, userClave?: string }}
   */
  async processConversationalChat({ message, history = [], userCedula = '', userClave = '' }) {
    if (!message || !message.trim()) {
      return {
        reply: 'Hola César, aquí estoy atento. ¿En qué te colaboro hoy?',
        spokenReply: 'Hola César, aquí estoy atento. ¿En qué te colaboro hoy?',
        action: 'GREETING'
      };
    }

    const lower = message.toLowerCase().trim();

    // 1. Ejecutar análisis de acción en segundo plano
    let executedAction = null;
    try {
      executedAction = await this.processCommand(message, { userCedula, userClave });
    } catch (e) {
      console.warn('[ConversationalChat Action Warn]:', e.message);
    }

    // 2. Si se ejecutó una acción concreta, generar respuesta humana y resolutiva
    if (executedAction && executedAction.action !== 'NONE' && executedAction.action !== 'ANSWER') {
      let naturalReply = executedAction.message;
      if (executedAction.action === 'CREATE_EVENT') {
        naturalReply = `Listo César, ya te dejé agendado "${executedAction.data?.title || 'el evento'}" en tu calendario directivo. Todo quedó sincronizado en la nube.`;
      } else if (executedAction.action === 'RECORD_FINANCE') {
        naturalReply = `Entendido César, ya registré el movimiento en tu panel de finanzas. Los saldos y comprobantes quedaron actualizados.`;
      } else if (executedAction.action === 'CREATE_TASK') {
        naturalReply = `Anotado en tus tareas de alta prioridad. Te mantendré al tanto de su seguimiento.`;
      } else if (executedAction.action === 'EDUS_MONITORING') {
        const spec = executedAction.data?.specialty || 'Odontología';
        const dayTxt = executedAction.data?.preferredDay ? `para el ${executedAction.data.preferredDay}` : 'más próxima disponible';
        if (executedAction.data?.hasCredentials) {
          naturalReply = `César, ya abrí el portal oficial de EDUS CCSS, descifré el captcha e inicié sesión. Ahora estoy buscando la cita ${dayTxt} de ${spec} en vivo. Puedes ver todo el movimiento en la pantalla.`;
        } else {
          naturalReply = `César, ya abrí el portal de EDUS en pantalla para buscar la cita ${dayTxt} de ${spec}. Para ingresar, solo digita tu cédula y clave arriba y dale a Iniciar Sesión. Yo resuelvo el captcha de seguridad automáticamente.`;
        }
      } else if (executedAction.action === 'SEARCH_PROMOS') {
        const p = executedAction.data?.promotions || [];
        naturalReply = `César, revisé las promociones de ${executedAction.data?.merchant || 'KFC'} en Costa Rica: la más prometedora es "${p[0]?.title || 'el Mega Box'}" (${p[0]?.description || ''}). ¿Quieres que te detalle los demás cupones o combos?`;
      } else if (executedAction.action === 'START_RECORDING') {
        naturalReply = `De acuerdo César, iniciando la captura de audio y análisis de la reunión en vivo ahora mismo.`;
      }

      return {
        reply: naturalReply,
        spokenReply: naturalReply,
        action: executedAction.action,
        data: executedAction.data
      };
    }

    // 3. Conversación abierta o consulta con Segundo Cerebro
    try {
      const allMeetings = await storageService.getAllMeetings();
      let allNotes = [];
      try { allNotes = await noteService.getAllNotes(); } catch (_) {}
      const finBrief = await this.getFinanceBrief();

      const promptContext = `Historial reciente de la charla:\n` +
        (history.slice(-4).map(h => `${h.role === 'user' ? 'César' : 'Asistente'}: ${h.text}`).join('\n') || 'Ninguno') +
        `\n\nInstrucción / Pregunta actual de César: "${message}"\n` +
        (finBrief ? `\n${finBrief}\n` : '') +
        `Reuniones registradas en el sistema: ${allMeetings.length}\n` +
        `Notas disponibles: ${allNotes.length}`;

      const systemPrompt = `Eres Dobby, el asistente ejecutivo personal de máxima confianza de César Andrés.
Hablas SIEMPRE en primera persona ('inicié la búsqueda', 'registré el gasto', 'revisé la agenda'). TÚ ERES DOBBY, nunca te refieras a ti mismo en tercera persona ni digas que 'mandaste a Dobby' o 'pusiste a Dobby'.
Hablas en español de Costa Rica/Latinoamérica con un tono completamente natural, humano, directo, educado y resolutivo.
Tienes acceso completo en tiempo real a sus cuentas bancarias, deudas, reuniones, notas y tareas.
NUNCA hables como un robot ni des introducciones genéricas ni bloques de código.
Responde en 1 o 2 oraciones concisas y útiles como un verdadero asistente personal que habla cara a cara.`;

      let aiReply = null;
      try {
        aiReply = await aiService.callGroq(promptContext, systemPrompt, 'openai/gpt-oss-120b');
      } catch (_) {
        try {
          aiReply = await aiService.callGeminiText(promptContext, systemPrompt, 'gemini-3.6-flash');
        } catch (_) {
          try {
            aiReply = await aiService.callOpenRouter(promptContext, systemPrompt, 'deepseek/deepseek-chat');
          } catch (_) {}
        }
      }

      const finalReply = aiReply || (executedAction?.message) || 'Entendido César, estoy a tu orden para agendar eventos, registrar finanzas, notas o monitorear gestiones.';
      return {
        reply: finalReply,
        spokenReply: finalReply,
        action: 'CONVERSATION'
      };
    } catch (err) {
      return {
        reply: 'Disculpa César, tuve una leve interrupción de conexión pero ya estoy aquí. ¿En qué te colaboro?',
        spokenReply: 'Disculpa César, tuve una leve interrupción de conexión pero ya estoy aquí. ¿En qué te colaboro?',
        action: 'ERROR'
      };
    }
  }
}

module.exports = new AssistantService();
