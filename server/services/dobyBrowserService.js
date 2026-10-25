const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EDUS_URL = 'https://edus.ccss.sa.cr/eduscitasweb/';

class DobbyBrowserService {
  constructor() {
    this.activeBrowser = null;
    this.activePage = null;
    this.currentStatus = 'inactivo'; // 'inactivo' | 'abriendo' | 'resolviendo_captcha' | 'ingresado' | 'buscando_citas'
    this.lastScreenshot = null;
    this.lastLogs = [];
    this.solvedCaptcha = null;
    this.keepAliveInterval = null;
  }

  _log(msg) {
    const timestamp = new Date().toLocaleTimeString('es-CR');
    const line = `[${timestamp}] ${msg}`;
    console.log('[DobbyBrowser]', line);
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
   * Resuelve automáticamente el captcha de EDUS mediante visión IA (Gemini)
   */
  async autoSolveCaptcha() {
    if (!this.activePage) {
      throw new Error('No hay página activa para resolver el captcha');
    }

    try {
      this._log('Dobby está analizando la imagen del Captcha con visión IA...');
      const captchaSelector = '[id="formInicioSesion:captcha"]';
      await this.activePage.waitForSelector(captchaSelector, { timeout: 10000 });
      const captchaEl = await this.activePage.$(captchaSelector);

      if (!captchaEl) {
        throw new Error('No se encontró el elemento de captcha en la página');
      }

      const captchaBase64 = await captchaEl.screenshot({ encoding: 'base64' });

      // Modelos candidatos en orden de preferencia
      const models = ['gemini-3.6-flash', 'gemini-3.5-flash'];
      let solvedText = null;

      for (const m of models) {
        try {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': config.GEMINI_API_KEY
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      inlineData: {
                        mimeType: 'image/png',
                        data: captchaBase64
                      }
                    },
                    {
                      text: 'Extract and return ONLY the alphanumeric text inside this security captcha image. Do not output explanations, spaces, or symbols. Just the raw characters.'
                    }
                  ]
                }
              ],
              generationConfig: {
                temperature: 0.0
              }
            })
          });

          if (response.ok) {
            const data = await response.json();
            const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (raw) {
              solvedText = raw.replace(/[^a-zA-Z0-9]/g, '');
              if (solvedText) break;
            }
          }
        } catch (mErr) {
          console.warn(`[DobbyBrowser] Falló modelo ${m}:`, mErr.message);
        }
      }

      if (!solvedText) {
        throw new Error('La IA no pudo decodificar el captcha con suficiente certeza');
      }

      this._log(`Dobby descifró el captcha con éxito: ${solvedText}`);
      this.solvedCaptcha = solvedText;

      // Digitar automáticamente el código en el input
      const inputSelector = '[id="formInicioSesion:captchaDigitado"]';
      await this.activePage.waitForSelector(inputSelector, { timeout: 5000 });
      await this.activePage.click(inputSelector);
      // Limpiar campo si tiene algo
      await this.activePage.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) el.value = '';
      }, inputSelector);
      await this.activePage.type(inputSelector, solvedText, { delay: 60 });
      this._log(`Dobby digitó automáticamente "${solvedText}" en el campo de seguridad.`);

      return { success: true, code: solvedText };
    } catch (err) {
      this._log(`Aviso en auto-resolución de captcha: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Inicia el navegador de Dobby en pantalla visible para César
   */
  async launchEdusPortal({ headless = false, userCedula = '', userClave = '', autoSolve = true } = {}) {
    try {
      this.currentStatus = 'abriendo';
      this._log('Dobby está iniciando Google Chrome para el portal EDUS CCSS...');

      // Si ya hay una instancia previa, cerrarla
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

      // Rellenar credenciales si se suministran
      if (userCedula) {
        try {
          await this.activePage.type('[id="formInicioSesion:usuario"]', userCedula, { delay: 40 });
        } catch (_) {}
      }
      if (userClave) {
        try {
          await this.activePage.type('[id="formInicioSesion:clave"]', userClave, { delay: 40 });
        } catch (_) {}
      }

      // Auto-resolver captcha de forma autónoma si se solicita
      let captchaResult = null;
      if (autoSolve) {
        this.currentStatus = 'resolviendo_captcha';
        captchaResult = await this.autoSolveCaptcha();
      }

      this.currentStatus = captchaResult?.success ? 'captcha_resuelto' : 'esperando_ingreso';
      this._log('Portal EDUS listo en pantalla.');

      // Iniciar heartbeat / keep-alive para que la sesión de César no se cierre
      this._startKeepAlive();

      // Tomar captura en vivo
      try {
        const buffer = await this.activePage.screenshot({ encoding: 'base64' });
        this.lastScreenshot = `data:image/png;base64,${buffer}`;
      } catch (_) {}

      return {
        success: true,
        status: this.currentStatus,
        solvedCaptcha: this.solvedCaptcha,
        message: captchaResult?.success
          ? `Dobby abrió Chrome y descifró el captcha (${this.solvedCaptcha}) automáticamente.`
          : 'Dobby abrió Chrome en pantalla.',
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
   * Mantener viva la sesión activa de EDUS en el navegador
   */
  _startKeepAlive() {
    if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
    this.keepAliveInterval = setInterval(async () => {
      if (this.activePage) {
        try {
          // Micro interacción invisible para que el servidor JSF / PrimeFaces no cierre la sesión por inactividad
          await this.activePage.evaluate(() => {
            window.dispatchEvent(new Event('mousemove'));
          });
        } catch (_) {}
      }
    }, 60000); // Cada 60 segundos
  }

  /**
   * Ingresa el código de seguridad (Captcha) y presiona "Ingresar"
   */
  async submitCaptcha(captchaCode) {
    if (!this.activePage) {
      return { success: false, error: 'No hay ninguna sesión activa del navegador de Dobby.' };
    }

    try {
      this._log(`Digitando código de seguridad captcha: ${captchaCode}`);
      const inputSelector = '[id="formInicioSesion:captchaDigitado"]';
      await this.activePage.click(inputSelector);
      await this.activePage.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) el.value = '';
      }, inputSelector);
      await this.activePage.type(inputSelector, captchaCode, { delay: 60 });

      // Clic en el botón Ingresar
      this._log('Dobby está haciendo clic en Ingresar...');
      const btn = await this.activePage.$('[id="formInicioSesion:ejecutarPaso1"]');
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
      this._log('Sesión procesada en EDUS.');

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
      solvedCaptcha: this.solvedCaptcha,
      hasActiveBrowser: !!this.activeBrowser
    };
  }

  /**
   * Cierra el navegador de Dobby
   */
  async close() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
    if (this.activeBrowser) {
      try { await this.activeBrowser.close(); } catch (_) {}
      this.activeBrowser = null;
      this.activePage = null;
      this.currentStatus = 'inactivo';
      this.solvedCaptcha = null;
      this._log('Navegador de Dobby cerrado.');
    }
    return { success: true };
  }
}

module.exports = new DobbyBrowserService();
