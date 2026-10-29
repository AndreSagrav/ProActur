/**
 * financeCategorizer.js
 * Motor inteligente y determinístico de categorización contable y financiera para Costa Rica.
 * Clasifica comercios, conceptos y notas en las categorías oficiales de ProActur.
 */

class FinanceCategorizer {
  constructor() {
    // Categorías oficiales de gastos
    this.CATEGORIES = {
      GASTO: [
        'Gasolina y Transporte',
        'Alimentación y Reuniones',
        'Servicios y Software',
        'Equipamiento',
        'Honorarios y Nómina',
        'Financiero e Intereses',
        'Donaciones y Diezmos',
        'Varios'
      ],
      INGRESO: [
        'Honorarios Profesionales',
        'Cobro de Clientes',
        'Rendimientos e Inversiones',
        'Transferencias Recibidas',
        'Otros Ingresos'
      ]
    };
  }

  /**
   * Normaliza texto eliminando acentos, caracteres especiales y palabras de relleno bancario
   */
  normalize(text = '') {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Quitar tildes
      .replace(/[^a-z0-9\s]/g, ' ')   // Dejar solo letras y números
      .replace(/\s+/g, ' ')           // Espacios simples
      .trim();
  }

  /**
   * Categoriza un egreso o compra basándose en el comercio y el texto completo
   * @param {string} merchant - Nombre del comercio
   * @param {string} fullText - Texto del correo, nota o descripción
   * @returns {string} Categoría oficial de gasto
   */
  categorizeExpense(merchant = '', fullText = '') {
    const raw = `${merchant} ${fullText}`;
    const norm = this.normalize(raw);

    // 1. DONACIONES Y DIEZMOS (Prioridad alta por especificidad)
    if (/\b(diezmo|diezmos|ofrenda|ofrendas|iglesia|congregacion|pastor|donacion|donaciones)\b/.test(norm)) {
      return 'Donaciones y Diezmos';
    }

    // 2. DELIVERY DE COMIDA (Antes de transporte, porque contiene "uber" o "didi")
    if (/\b(uber\s*eats|ubereats|didi\s*food|didifood|pedidosya|pedidos\s*ya|rappi)\b/.test(norm)) {
      return 'Alimentación y Reuniones';
    }

    // 3. GASOLINA Y TRANSPORTE
    // REGLA CRÍTICA: NUNCA usar 'gas' como subcadena porque coincide con 'gasto' o 'gastos' bancarios.
    // Solo coincidencias exactas de términos de combustible o transporte.
    const isGasOrFuel = /\b(gasolinera|gasolineras|combustible|combustibles|servidistrito|recope|delta|uno|total|puma|bomba|estacion\s+de\s+servicio|lubricentro)\b/.test(norm);
    const isTransport = /\b(uber|didi|indrive|taxi|taxis|peaje|peajes|quickpass|tren|incofer|transporte|autobus|buses|tuasa|lumaca|parqueo|estacionamiento)\b/.test(norm);

    if (isGasOrFuel || isTransport) {
      return 'Gasolina y Transporte';
    }

    // 4. ALIMENTACIÓN, SUPERMERCADOS Y RESTAURANTES (Costa Rica)
    const isFoodOrSuper = /\b(soda|restaurante|rest|cafe|cafeteria|panaderia|reposteria|carniceria|verduleria|marisqueria|pescaderia|licorera|comida|almuerzo|cena|desayuno)\b/.test(norm) ||
      /\b(super|supermercado|mini\s*super|minisuper|pulperia|abastecedor|colibri)\b/.test(norm) ||
      /\b(am\s*pm|ampm|vindi|fresh\s*market|musmanni|pali|maxipali|maxi\s*pali|walmart|masxmenos|mas\s*x\s*menos|auto\s*mercado|automercado|macrobiotica)\b/.test(norm) ||
      /\b(kfc|mcdonald|mcdonalds|burger\s*king|pizza\s*hut|taco\s*bell|subway|starbucks|popeyes|papa\s*johns|little\s*caesars|rostipollos|spoon|creperie|chilis|outback|carls\s*jr)\b/.test(norm);

    if (isFoodOrSuper) {
      return 'Alimentación y Reuniones';
    }

    // 5. SERVICIOS PÚBLICOS, TELECOMUNICACIONES Y SOFTWARE
    const isUtilitiesOrSoftware = /\b(ice|kolbi|claro|liberty|aya|ayac|cnfl|esph|jasec|coopeguanacaste|coopelesca|coopesantos)\b/.test(norm) ||
      /\b(google|apple|netflix|spotify|aws|amazon|prime|disney|hbo|max|youtube|chatgpt|openai|github|microsoft|adobe|zoom|canva|godaddy|namecheap|digitalocean|heroku|vercel|stripe)\b/.test(norm) ||
      /\b(cable|internet|recarga|luz|agua|telefono|telefonia|electricidad|streaming|hosting|dominio)\b/.test(norm);

    if (isUtilitiesOrSoftware) {
      return 'Servicios y Software';
    }

    // 6. EQUIPAMIENTO, SALUD, FARMACIAS Y FERRETERÍAS
    const isHealthOrEquipment = /\b(farmacia|fischel|sucre|clinica|hospital|laboratorio|optica|dentista|odontolog|medico|medica|veterinaria|mascota|medicamento|receta)\b/.test(norm) ||
      /\b(ferreteria|epa|el\s*lagar|materiales|herramientas|repuesto|repuestos|tecnologia|computadora|hardware|oficina)\b/.test(norm);

    if (isHealthOrEquipment) {
      return 'Equipamiento';
    }

    // 7. FINANCIERO E INTERESES
    if (/\b(comision|comisiones|interes|intereses|cargo|anualidad|membresia|seguro|poliza|cargos\s*bancarios)\b/.test(norm) ||
        (merchant.toLowerCase().includes('bac credomatic') && !merchant.toLowerCase().includes('super')) ||
        (merchant.toLowerCase().includes('banco') && norm.includes('banco') && !norm.includes('super'))) {
      return 'Financiero e Intereses';
    }

    // 8. HONORARIOS Y NÓMINA
    if (/\b(honorario|honorarios|salario|nomina|planilla|pago\s*a\s*proveedor|subcontrato|colaborador)\b/.test(norm)) {
      return 'Honorarios y Nómina';
    }

    // Por defecto, Varios (jamás forzar Gasolina)
    return 'Varios';
  }

  /**
   * Categoriza un ingreso monetario
   * @param {string} note - Nota o concepto
   * @param {boolean} isSinpe - Si es transferencia SINPE
   * @returns {string} Categoría oficial de ingreso
   */
  categorizeIncome(note = '', isSinpe = false) {
    const norm = this.normalize(note);

    if (/\b(honorario|honorarios|servicio\s*profesional|consultoria|desarrollo|programacion|asesoria)\b/.test(norm)) {
      return 'Honorarios Profesionales';
    }
    if (/\b(factura|cliente|cobro|pago\s*de\s*proyecto|adelanto|saldo\s*pendiente)\b/.test(norm)) {
      return 'Cobro de Clientes';
    }
    if (/\b(rendimiento|interes\s*ganado|intereses|inversion|cdp|dividendo|cupon)\b/.test(norm)) {
      return 'Rendimientos e Inversiones';
    }
    if (isSinpe || /\b(sinpe|transferencia|deposito|me\s*paso|me\s*transfirio|reembolso)\b/.test(norm)) {
      return 'Transferencias Recibidas';
    }

    return 'Otros Ingresos';
  }
}

module.exports = new FinanceCategorizer();
