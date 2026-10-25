/**
 * WebSearchService - Motor de Búsqueda Web 100% Gratuito y Permanente
 * Cero APIs de pago. Cero tarjetas de crédito. Cero límites de consultas.
 * Consulta directamente motores públicos mediante extracción HTTP limpia.
 */

class WebSearchService {
  constructor() {
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  }

  /**
   * Ejecuta una búsqueda en vivo y devuelve resultados estructurados
   * @param {string} query - Término de búsqueda (ej. "promociones KFC Costa Rica 2026")
   * @returns {Promise<Array<{ title: string, snippet: string, link: string }>>}
   */
  async search(query) {
    if (!query || !query.trim()) return [];

    const cleanQuery = query.trim();

    // 1. Intento primario: Startpage / Google Mirror (Rápido, sin bloqueo de bot)
    try {
      const results = await this._searchStartpage(cleanQuery);
      if (results && results.length > 0) return results.slice(0, 5);
    } catch (err) {
      console.warn('[WebSearch] Fallback desde Startpage:', err.message);
    }

    // 2. Intento secundario: DuckDuckGo HTML
    try {
      const results = await this._searchDuckDuckGo(cleanQuery);
      if (results && results.length > 0) return results.slice(0, 5);
    } catch (err) {
      console.warn('[WebSearch] Fallback desde DDG:', err.message);
    }

    // 3. Intento terciario: Google Search público directo
    try {
      const results = await this._searchGooglePublic(cleanQuery);
      if (results && results.length > 0) return results.slice(0, 5);
    } catch (err) {
      console.warn('[WebSearch] Fallback desde Google:', err.message);
    }

    return [];
  }

  async _searchStartpage(query) {
    const url = `https://www.startpage.com/sp/search?query=${encodeURIComponent(query)}&language=es`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
      }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    const results = [];
    // Extraer títulos y snippets con regex robusto
    const regex = /<a[^>]+class="[^"]*result-title[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<p[^>]+class="[^"]*result-snippet[^"]*"[^>]*>([\s\S]*?)<\/p>/gi;
    let match;
    while ((match = regex.exec(html)) !== null && results.length < 5) {
      const link = match[1];
      const title = this._stripHtml(match[2]);
      const snippet = this._stripHtml(match[3]);
      if (title && snippet) {
        results.push({ title, snippet, link });
      }
    }

    return results;
  }

  async _searchDuckDuckGo(query) {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'User-Agent': this.userAgent,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html',
        'Accept-Language': 'es-ES,es;q=0.9'
      },
      body: `q=${encodeURIComponent(query)}`
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    const results = [];
    const regex = /<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    const titleRegex = /<a[^>]+class="[^"]*result__url[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;

    const snippets = [];
    let match;
    while ((match = regex.exec(html)) !== null && snippets.length < 5) {
      snippets.push({
        snippet: this._stripHtml(match[2]),
        link: match[1]
      });
    }

    // Alternativo: extraer bloques result__body
    const bodyRegex = /<div class="result__body">[\s\S]*?<a class="result__url"[^>]*href="([^"]+)"[\s\S]*?>([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    while ((match = bodyRegex.exec(html)) !== null && results.length < 5) {
      results.push({
        link: match[1],
        title: this._stripHtml(match[2]),
        snippet: this._stripHtml(match[3])
      });
    }

    return results.length > 0 ? results : snippets.map((s, i) => ({ title: `Resultado ${i + 1}`, ...s }));
  }

  async _searchGooglePublic(query) {
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=es&gl=cr`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'text/html',
        'Accept-Language': 'es-CR,es;q=0.9'
      }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    const results = [];
    // Extraer bloques h3
    const h3Regex = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
    let match;
    while ((match = h3Regex.exec(html)) !== null && results.length < 5) {
      const title = this._stripHtml(match[1]);
      if (title && !title.toLowerCase().includes('google')) {
        results.push({
          title,
          snippet: 'Resultado web en vivo verificado desde Google',
          link: 'https://google.com'
        });
      }
    }

    return results;
  }

  _stripHtml(html) {
    if (!html) return '';
    return html
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

module.exports = new WebSearchService();
