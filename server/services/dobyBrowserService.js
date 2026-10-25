const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EDUS_URL = 'https://edus.ccss.sa.cr/eduscitasweb/';

class DobyBrowserService {
  constructor() {
    this.activeBrowser = null;
    this.activePage = null;
    this.currentStatus = 'inactivo'; // 'inactivo' | 'abriendo' | 'esperando_captcha' | 'ingresado' | 'buscando_citas'
    this.lastScreenshot = null;
    this.lastLogs = [];
  }

  _log(msg) {
    const timestamp = new Date().toLocaleTimeString('es-CR');
    const line = `[${timestamp}] ${msg}`;
    console.log('[DobyBrowser]', line);
    this.lastLogs.unshift(line);
    if (this.lastLogs.length > 50) this.lastLogs.pop();
  }

  getChromePath() {
    if (fs.existsSync(CHROME_PATH)) return CHROME_PATH;
    const paths = [
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) return p;
    }
    return 'chrome.exe';
  }

  /**
   * Inicia el navegador de Doby en pantalla visible para César
   */
  async launchEdusPortal({ headless = false, userCedula = '', userClave = '' } = {}) {
    try {
      this.currentStatus = 'abriendo';
      this._log('Doby está iniciando Google Chrome para el portal EDUS CCSS...');

      // Si ya hay una instancia abierta, cerrarla antes de crear una nueva
      if (this.activeBrowser) {
        try { await this.activeBrowser.close(); } catch (_) {}
        this.activeBrowser = null;
        this.activePage = null;
      }

      const execPath = this.getChromePath();
      this._log(`Ejecutable detectado: ${execPath}`);

      this.activeBrowser = await puppeteer.launch({
        executablePath: execPath,
        headless: headless, // false para que César lo vea EN VIVO en su pantalla
        defaultViewport: null,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--start-maximized',
          '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ]
      });

      const pages = await this.activeBrowser.pages();
      this.activePage = pages.length > 0 ? pages[0] : await this.activeBrowser.newPage();

      this._log('Navegando a https://edus.ccss.sa.cr/eduscitasweb/ ...');
      await this.activePage.goto(EDUS_URL, { waitUntil: 'networkidle2', timeout: 35000 });

      this.currentStatus = 'esperando_captcha';
      this._log('Portal EDUS cargado con éxito. Esperando autenticación / Código de Seguridad.');

      // Si se proporcionó cédula y clave, rellenarlas automáticamente
      if (userCedula) {
        try {
          await this.activePage.type('input[name*="identificacion" i], input[id*="identificacion" i], input[type="text"]', userCedula, { delay: 60 });
        } catch (_) {}
      }
      if (userClave) {
        try {
          await this.activePage.type('input[type="password"]', userClave, { delay: 60 });
        } catch (_) {}
      }

      // Tomar captura en vivo
      try {
        const buffer = await this.activePage.screenshot({ encoding: 'base64' });
        this.lastScreenshot = `data:image/png;base64,${buffer}`;
      } catch (_) {}

      return {
        success: true,
        status: this.currentStatus,
        message: 'Portal EDUS abierto en vivo en la pantalla. Doby está listo para continuar con la selección de odontología.',
        screenshot: this.lastScreenshot,
        logs: this.lastLogs
      };
    } catch (err) {
      this.currentStatus = 'error';
      this._log(`Error al iniciar navegador: ${err.message}`);
      return {
        success: false,
        error: err.message,
        logs: this.lastLogs
      };
    }
  }

  /**
   * Ingresa el código de seguridad (Captcha) y presiona "Ingresar"
   */
  async submitCaptcha(captchaCode) {
    if (!this.activePage) {
      return { success: false, error: 'No hay ninguna sesión activa del navegador de Doby.' };
    }

    try {
      this._log(`Digitando código de seguridad captcha: ${captchaCode}`);
      // Buscar el campo de captcha
      const inputs = await this.activePage.$$('input[type="text"]');
      if (inputs.length >= 2) {
        // Usualmente el segundo o tercer input es el código de seguridad
        const captchaInput = inputs[inputs.length - 1];
        await captchaInput.click();
        await captchaInput.type(captchaCode, { delay: 80 });
      }

      // Clic en el botón Ingresar
      this._log('Presionando botón Ingresar...');
      const btn = await this.activePage.$('input[value*="Ingresar" i], button[type="submit"]');
      if (btn) {
        await Promise.all([
          btn.click(),
          this.activePage.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {})
        ]);
      }

      // Tomar captura actualizada
      const buffer = await this.activePage.screenshot({ encoding: 'base64' });
      this.lastScreenshot = `data:image/png;base64,${buffer}`;
      this.currentStatus = 'ingresado';

      return {
        success: true,
        status: this.currentStatus,
        url: this.activePage.url(),
        message: 'Código de seguridad enviado. Sesión de EDUS procesada.',
        screenshot: this.lastScreenshot,
        logs: this.lastLogs
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Obtiene el estado actual, logs y captura en vivo
   */
  async getStatus() {
    if (this.activePage) {
      try {
        const buffer = await this.activePage.screenshot({ encoding: 'base64' });
        this.lastScreenshot = `data:image/png;base64,${buffer}`;
      } catch (_) {}
    }
    return {
      status: this.currentStatus,
      screenshot: this.lastScreenshot,
      logs: this.lastLogs,
      hasActiveBrowser: !!this.activeBrowser
    };
  }

  /**
   * Cierra el navegador de Doby
   */
  async close() {
    if (this.activeBrowser) {
      try { await this.activeBrowser.close(); } catch (_) {}
      this.activeBrowser = null;
      this.activePage = null;
      this.currentStatus = 'inactivo';
      this._log('Navegador de Doby cerrado.');
    }
    return { success: true };
  }
}

module.exports = new DobyBrowserService();
