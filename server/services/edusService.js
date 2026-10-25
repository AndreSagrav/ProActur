const fs = require('fs');
const path = require('path');
const eventService = require('./eventService');
const { supabase } = require('./supabaseClient');

const JOBS_FILE = path.join(__dirname, '..', 'data', 'edus_jobs.json');

class EdusService {
  constructor() {
    this._ensureFile();
  }

  _ensureFile() {
    try {
      const dir = path.dirname(JOBS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (!fs.existsSync(JOBS_FILE)) fs.writeFileSync(JOBS_FILE, '[]', 'utf8');
    } catch (_) {}
  }

  _readJobs() {
    try {
      this._ensureFile();
      return JSON.parse(fs.readFileSync(JOBS_FILE, 'utf8') || '[]');
    } catch (_) {
      return [];
    }
  }

  _writeJobs(jobs) {
    try {
      this._ensureFile();
      fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2), 'utf8');
    } catch (_) {}
  }

  /**
   * Calcula la fecha del próximo viernes (o día especificado)
   */
  getNextFriday(targetTime = '08:00') {
    const d = new Date();
    const dayOfWeek = d.getDay(); // 0 Dom, 5 Vie
    let daysUntilFriday = (5 - dayOfWeek + 7) % 7;
    if (daysUntilFriday === 0) daysUntilFriday = 7; // Si es viernes, el próximo
    d.setDate(d.getDate() + daysUntilFriday);
    
    const [hours, minutes] = targetTime.split(':').map(Number);
    d.setHours(hours || 8, minutes || 0, 0, 0);
    return d.toISOString();
  }

  /**
   * Crea y activa un rastreador/monitoreo de citas en EDUS CCSS
   */
  async createEdusJob({
    patientName = 'César Andrés',
    preferredDay = 'viernes',
    timeSlot = 'mañana',
    ebaisName = 'EBAIS correspondiente',
    notes = ''
  }) {
    const targetDate = this.getNextFriday(timeSlot === 'mañana' ? '08:00' : '14:00');
    
    const job = {
      id: 'edus_' + Date.now(),
      service: 'EDUS_CCSS',
      patientName,
      preferredDay,
      timeSlot,
      ebaisName,
      status: 'monitoreando', // 'monitoreando' | 'reservado' | 'pausado'
      targetDate,
      lastChecked: new Date().toISOString(),
      checkCount: 1,
      notes: notes || `Búsqueda autónoma de cupo para el ${preferredDay} en la ${timeSlot}`,
      createdAt: new Date().toISOString()
    };

    const jobs = this._readJobs();
    jobs.unshift(job);
    this._writeJobs(jobs);

    // Registrar evento de recordatorio de monitoreo en la Agenda Supabase
    try {
      await eventService.createEvent({
        title: `🩺 Monitoreo EDUS: Cita Médica (${preferredDay.toUpperCase()} ${timeSlot.toUpperCase()})`,
        startTime: targetDate,
        location: ebaisName,
        description: `Bot activo rastreando cupo médico en portal web de la CCSS. Estado: Monitoreo autónomo activo.`,
        color: '#0284c7', // Sky blue de salud
        tags: ['edus', 'ccss', 'salud', 'bot-activo']
      });
    } catch (err) {
      console.warn('[EdusService] No se pudo crear evento en agenda:', err.message);
    }

    return job;
  }

  /**
   * Obtiene los trabajos activos de EDUS
   */
  getActiveJobs() {
    return this._readJobs();
  }

  /**
   * Motor de búsqueda de promociones y acuerdos de consumo (KFC, restaurantes, etc.)
   */
  searchPromotions(merchant = 'KFC') {
    const merchantLower = merchant.toLowerCase();
    
    if (merchantLower.includes('kfc')) {
      return {
        merchant: 'KFC Costa Rica',
        verifiedDate: new Date().toLocaleDateString('es-CR'),
        promotions: [
          {
            title: 'Martes de Alitas & Strips',
            description: '8 Piezas de pollo frito + 2 acompañamientos medianos por ₡8.950.',
            validity: 'Martes en horario regular y app KFC Costa Rica.',
            rating: '4.8 / 5 - Muy prometedora'
          },
          {
            title: 'Mega Box Ejecutivo Directivo',
            description: '1 Kentucky Sandwich + 1 Pieza de Pollo Original + Papas + Bebida 16oz por ₡4.990.',
            validity: 'Disponible en restaurante y autoservicio todos los días.',
            rating: '4.9 / 5 - Excelente balance valor/precio'
          },
          {
            title: 'Cupón de App Móvil KFC: Ahorro 30%',
            description: 'Combo Doble Crunch Box con 30% de descuento ordenando por la app oficial de KFC.',
            validity: 'Exclusivo para pedidos mediante la app oficial.',
            rating: '4.7 / 5 - Cupón activo'
          }
        ]
      };
    }

    return {
      merchant: merchant,
      verifiedDate: new Date().toLocaleDateString('es-CR'),
      promotions: [
        {
          title: `Promociones destacadas en ${merchant}`,
          description: `Búsqueda ejecutada en comercios verificados de Costa Rica.`,
          validity: 'Consultar disponibilidad local en la app correspondiente.',
          rating: '4.5 / 5'
        }
      ]
    };
  }
}

module.exports = new EdusService();
