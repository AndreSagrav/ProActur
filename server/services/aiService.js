const fs = require('fs');

class AIService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
  }

  getApiKey() {
    return this.apiKey || process.env.GEMINI_API_KEY;
  }

  setApiKey(key) {
    this.apiKey = key;
  }

  /**
   * Transcribe and analyze audio or raw meeting text
   */
  async processMeeting({ audioBuffer, mimeType, rawText, meetingTitle }) {
    const key = this.getApiKey();
    if (!key) {
      throw new Error('GEMINI_API_KEY no configurada. Añádela en el archivo .env o en la configuración.');
    }

    const model = 'gemini-2.0-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

    const prompt = `
Eres Proactor AI, un asistente ejecutivo y compañero de equipo proactivo de clase mundial.
Tu trabajo es escuchar/leer esta reunión y generar un análisis exhaustivo, estructurado y de alto impacto.

Debes responder ÚNICAMENTE con un objeto JSON válido (sin markdown, sin bloques de código \`\`\`json, solo el JSON puro) con la siguiente estructura:
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
      "deadline": "Fecha límite o 'Pendiente de definir'"
    }
  ],
  "proactiveAdvice": [
    "Consejo proactivo o alerta de riesgo que el equipo debería considerar para esta reunión"
  ],
  "transcript": "Transcripción textual completa y limpia de lo hablado o notas de la reunión",
  "tags": ["Categoría1", "Categoría2"]
}
`;

    const parts = [];

    if (audioBuffer) {
      const base64Data = audioBuffer.toString('base64');
      parts.push({
        inlineData: {
          mimeType: mimeType || 'audio/webm',
          data: base64Data
        }
      });
    }

    if (rawText) {
      parts.push({
        text: `Notas o transcripción previa provista:\n${rawText}\n`
      });
    }

    parts.push({ text: prompt });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Error en API de Gemini (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const rawResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawResult) {
      throw new Error('No se recibió respuesta válida del modelo de IA');
    }

    try {
      // Limpiar posibles delimitadores de código markdown si los hubiera
      const cleaned = rawResult.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      return JSON.parse(cleaned);
    } catch (parseError) {
      console.error('Error parseando JSON de Gemini:', rawResult);
      throw new Error('Error al interpretar el JSON generado por el modelo de IA');
    }
  }

  /**
   * Second Brain: Chat across past meetings
   */
  async askSecondBrain(question, meetingsList) {
    const key = this.getApiKey();
    if (!key) {
      throw new Error('GEMINI_API_KEY no configurada.');
    }

    const model = 'gemini-2.0-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

    const context = meetingsList.map((m, idx) => `
Reunión #${idx + 1}:
Título: ${m.title}
Fecha: ${m.createdAt || m.date}
Resumen: ${m.summary}
Decisiones: ${(m.keyDecisions || []).join('; ')}
Tareas pendientes: ${(m.actionItems || []).map(a => `${a.task} (${a.assignee})`).join('; ')}
Transcripción / Notas: ${m.transcript || ''}
---
`).join('\n');

    const prompt = `
Eres el "Segundo Cerebro" (Second Brain) de Proactor AI.
Tienes acceso al historial completo de reuniones y notas del usuario.

Historial de Reuniones:
${context || 'No hay reuniones previas registradas aún.'}

Pregunta del usuario:
"${question}"

Instrucciones:
1. Responde de forma clara, directa, profesional y citando específicamente qué reunión, fecha o responsable está relacionado.
2. Si la información no aparece en las reuniones registradas, indícalo cortésmente y sugiere qué buscar o registrar.
`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta';
  }
}

module.exports = new AIService();
