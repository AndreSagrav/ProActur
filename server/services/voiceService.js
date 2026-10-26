const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

class VoiceService {
  constructor() {
    this.defaultVoice = 'es-CR-JuanNeural'; // Voz neural natural de Costa Rica
  }

  /**
   * Sintetiza texto en audio MP3 de calidad estudio
   * @param {string} text - Mensaje a hablar
   * @param {string} [voice] - Nombre opcional de la voz
   * @returns {Promise<Buffer>}
   */
  async synthesizeSpeech(text, voice = null) {
    if (!text || !text.trim()) {
      throw new Error('Texto vacío para síntesis de voz');
    }

    // Limpiar marcadores markdown, URLs o caracteres que ensucian la pronunciación
    const cleanText = text
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[*_#`~›•\(\)\[\]]/g, ' ')
      .replace(/[^\w\s\d,.:;¿?¡!áéíóúÁÉÍÓÚñÑüÜ-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) {
      throw new Error('Texto sin contenido fonético');
    }

    const tts = new MsEdgeTTS();
    const candidateVoices = [
      voice || this.defaultVoice,
      'es-CR-MariaNeural',
      'es-MX-JorgeNeural',
      'es-US-AlonsoNeural'
    ];

    let lastError = null;
    for (const v of candidateVoices) {
      try {
        await tts.setMetadata(v, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
        const buffer = await new Promise((resolve, reject) => {
          const stream = tts.toStream(cleanText);
          const chunks = [];
          const timeout = setTimeout(() => reject(new Error('TTS timeout')), 8000);
          stream.audioStream.on('data', c => chunks.push(c));
          stream.audioStream.on('end', () => {
            clearTimeout(timeout);
            resolve(Buffer.concat(chunks));
          });
          stream.audioStream.on('error', err => {
            clearTimeout(timeout);
            reject(err);
          });
        });
        if (buffer && buffer.length > 0) {
          return buffer;
        }
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error('No se pudo sintetizar voz con los modelos disponibles');
  }
}

module.exports = new VoiceService();
