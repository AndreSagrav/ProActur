let puppeteer = null;
try {
  puppeteer = require('puppeteer-core');
} catch (_) {}
const fs = require('fs');
const path = require('path');
const config = require('../config');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EDUS_URL = 'https://edus.ccss.sa.cr/eduscitasweb/';

class DobbyBrowserService {
  constructor() {
    this.activeBrowser = null;
    this.activePage = null;
    this.currentStatus = 'inactivo'; // 'inactivo' | 'abriendo' | 'esperando_ingreso' | 'monitoreando_citas' | 'cupos_encontrados'
    this.lastScreenshot = null;
    this.lastLogs = [];
    this.solvedCaptcha = null;
    this.keepAliveInterval = null;
    this.loopInterval = null;
    this.isLoopRunning = false;
    this.loopConfig = {
      service: 'ODONTOLOGIA',
      specialty: 'ODONTOLOGIA GENERAL',
      targetDay: 'viernes',
      intervalSeconds: 60,
      attempts: 0
    };
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
   * Alias de launchEdusPortal
   */
  launchBrowser(opts) {
    return this.launchEdusPortal(opts);
  }

  /**
   * Resuelve automáticamente el captcha de EDUS mediante visión IA
   */
  async autoSolveCaptcha() {
    if (!this.activePage) {
      throw new Error('No hay página activa para resolver el captcha');
    }

    try {
      this._log('Analizando la imagen del Captcha con visión IA...');
      const captchaSelector = '[id="formInicioSesion:captcha"]';
      await this.activePage.waitForSelector(captchaSelector, { timeout: 10000 });
      const captchaEl = await this.activePage.$(captchaSelector);

      if (!captchaEl) {
        throw new Error('No se encontró el elemento de captcha en la página');
      }

      const captchaBase64 = await captchaEl.screenshot({ encoding: 'base64' });

      // Modelos candidatos probados en orden de preferencia:
      // gemini-3.5-flash-lite responde en <1s sin agotar cuota
      const models = [
        'gemini-3.5-flash-lite',
        'gemini-3.8-flash',
        'gemini-3.1-flash-lite',
        'gemini-flash-lite-latest',
        'gemini-3.6-flash',
        'gemini-3.5-flash'
      ];
      let solvedText = null;

      for (const m of models) {
        try {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${config.GEMINI_API_KEY}`;
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
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
                      text: 'Extract and return ONLY the alphanumeric text inside this security captcha image. Do not output explanations, spaces, punctuation or extra words. Just the raw characters.'
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
              if (solvedText && solvedText.length >= 3) break;
            }
          }
        } catch (mErr) {
          console.warn(`[DobbyBrowser] Falló modelo ${m}:`, mErr.message);
        }
      }

      if (!solvedText) {
        throw new Error('La IA no pudo decodificar el captcha con suficiente certeza');
      }

      this._log(`Descifré el captcha con éxito: ${solvedText}`);
      this.solvedCaptcha = solvedText;

      // Digitar automáticamente el código en el input
      const inputSelector = '[id="formInicioSesion:captchaDigitado"]';
      await this.activePage.waitForSelector(inputSelector, { timeout: 5000 });
      await this.activePage.click(inputSelector);
      await this.activePage.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) el.value = '';
      }, inputSelector);
      await this.activePage.type(inputSelector, solvedText, { delay: 60 });
      this._log(`Digité automáticamente "${solvedText}" en el campo de seguridad.`);

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
      this._log('Portal EDUS listo en pantalla visible.');

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
          ? `Abrí Chrome y descifré el captcha (${this.solvedCaptcha}) automáticamente.`
          : 'Abrí Chrome en tu pantalla.',
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
      if (this.activePage && !this.isLoopRunning) {
        try {
          await this.activePage.evaluate(() => {
            window.dispatchEvent(new Event('mousemove'));
          });
        } catch (_) {}
      }
    }, 60000);
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

      this._log('Dobby está haciendo clic en Ingresar...');
      const btn = await this.activePage.$('[id="formInicioSesion:ejecutarPaso1"]');
      if (btn) {
        await Promise.all([
          btn.click(),
          this.activePage.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {})
        ]);
      }

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
   * Hace clic en el botón "Agregar una cita"
   */
  async clickAddAppointment() {
    if (!this.activePage) return false;
    try {
      return await this.activePage.evaluate(() => {
        const candidates = Array.from(document.querySelectorAll('button, a, div, span, p')).filter(el => {
          const txt = (el.innerText || '').trim().toLowerCase();
          return txt.includes('agregar una cita') || txt.includes('agregar cita');
        });
        if (candidates.length > 0) {
          const target = candidates[candidates.length - 1];
          (target.closest('a, button') || target).click();
          return true;
        }
        return false;
      });
    } catch (_) {
      return false;
    }
  }

  /**
   * Selecciona un dropdown de PrimeFaces / JSF por texto de etiqueta y opción
   */
  async selectDropdownOption(labelPattern, optionPattern) {
    if (!this.activePage) return false;
    try {
      return await this.activePage.evaluate((lStr, oStr) => {
        const lReg = new RegExp(lStr, 'i');
        const oReg = new RegExp(oStr, 'i');

        // 1. Buscar selects nativos
        const selects = Array.from(document.querySelectorAll('select'));
        for (const sel of selects) {
          const container = sel.closest('div, td, .form-group') || sel.parentElement;
          if (container && lReg.test(container.innerText || '')) {
            for (const opt of sel.options) {
              if (oReg.test(opt.text)) {
                sel.value = opt.value;
                sel.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
              }
            }
          }
        }

        // 2. Buscar dropdowns PrimeFaces
        const primeMenus = Array.from(document.querySelectorAll('.ui-selectonemenu'));
        for (const menu of primeMenus) {
          const parent = menu.closest('div, td, tr') || menu.parentElement;
          if (parent && lReg.test(parent.innerText || '')) {
            const trigger = menu.querySelector('.ui-selectonemenu-trigger') || menu;
            trigger.click();

            // Buscar la opción en los paneles visibles
            const panelItems = Array.from(document.querySelectorAll('.ui-selectonemenu-item, li')).filter(li => oReg.test(li.innerText || ''));
            if (panelItems.length > 0) {
              panelItems[panelItems.length - 1].click();
              return true;
            }
          }
        }

        // 3. Fallback directo en items
        const directItems = Array.from(document.querySelectorAll('.ui-selectonemenu-item, li')).filter(li => oReg.test(li.innerText || ''));
        if (directItems.length > 0) {
          directItems[directItems.length - 1].click();
          return true;
        }

        return false;
      }, labelPattern, optionPattern);
    } catch (_) {
      return false;
    }
  }

  /**
   * Revisa la tabla de cupos de citas disponibles
   */
  async checkTableAvailability(targetDay = 'viernes') {
    if (!this.activePage) return { available: false, message: 'Sin página' };
    try {
      return await this.activePage.evaluate((dayTarget) => {
        const bodyText = document.body.innerText || '';
        if (bodyText.includes('No se encontraron cupos disponibles')) {
          return { available: false, count: 0, message: 'No se encontraron cupos disponibles.' };
        }

        const rows = Array.from(document.querySelectorAll('table tbody tr, .ui-datatable-data tr'));
        const foundRows = [];
        for (const r of rows) {
          const text = (r.innerText || '').trim();
          if (!text || text.includes('No se encontraron') || text.includes('Espere por favor')) continue;
          
          const matchesDay = dayTarget ? text.toLowerCase().includes(dayTarget.toLowerCase()) : true;
          foundRows.push({ text, matchesDay });
        }

        return {
          available: foundRows.length > 0,
          count: foundRows.length,
          rows: foundRows
        };
      }, targetDay);
    } catch (err) {
      return { available: false, count: 0, error: err.message };
    }
  }

  /**
   * Ejecuta un paso de búsqueda completo
   */
  async executeSearchStep(service = 'ODONTOLOGIA', specialty = 'ODONTOLOGIA GENERAL', targetDay = 'viernes') {
    this.loopConfig.attempts += 1;
    this._log(`[Intento #${this.loopConfig.attempts}] Dobby verificando citas para ${service} (${targetDay})...`);

    // 1. Clic en "Agregar una cita"
    const clickedAdd = await this.clickAddAppointment();
    if (clickedAdd) {
      this._log('Dobby pulsó "Agregar una cita".');
      await new Promise(r => setTimeout(r, 2000));
    }

    // 2. Seleccionar Servicio
    this._log(`Seleccionando servicio: ${service}`);
    await this.selectDropdownOption('Servicio', service);
    await new Promise(r => setTimeout(r, 2000));

    // 3. Seleccionar Especialidad
    this._log(`Seleccionando especialidad: ${specialty}`);
    await this.selectDropdownOption('Especialidad', specialty);
    await new Promise(r => setTimeout(r, 3500)); // Espera a que termine la animación de pulso "Espere por favor"

    // 4. Leer tabla de cupos
    const result = await this.checkTableAvailability(targetDay);

    // Actualizar captura en vivo
    try {
      const buffer = await this.activePage.screenshot({ encoding: 'base64' });
      this.lastScreenshot = `data:image/png;base64,${buffer}`;
    } catch (_) {}

    if (result.available) {
      this.currentStatus = 'cupos_encontrados';
      this._log(`🎉 ¡CUPOS ENCONTRADOS! Se detectaron ${result.count} citas en el sistema.`);
      return { success: true, found: true, rows: result.rows };
    } else {
      this.currentStatus = 'monitoreando_citas';
      this._log(`No hay cupos en este momento. Reintentando en ${this.loopConfig.intervalSeconds}s...`);
      return { success: true, found: false };
    }
  }

  /**
   * Inicia el bucle recurrente de monitoreo
   */
  startMonitoringLoop({ service = 'ODONTOLOGIA', specialty = 'ODONTOLOGIA GENERAL', targetDay = 'viernes', intervalSeconds = 60 } = {}) {
    if (!this.activePage) {
      return { success: false, error: 'Primero debes abrir el navegador con Dobby.' };
    }

    this.stopMonitoringLoop();
    this.isLoopRunning = true;
    this.loopConfig = {
      service,
      specialty,
      targetDay,
      intervalSeconds,
      attempts: 0
    };

    this._log(`🚀 Bucle de búsqueda autónoma iniciado para ${service} cada ${intervalSeconds} segundos.`);
    this.currentStatus = 'monitoreando_citas';

    // Primer intento inmediato
    this.executeSearchStep(service, specialty, targetDay).then(res => {
      if (res.found) this.stopMonitoringLoop();
    });

    // Repetición recurrente
    this.loopInterval = setInterval(async () => {
      if (!this.isLoopRunning || !this.activePage) return;
      const res = await this.executeSearchStep(
        this.loopConfig.service,
        this.loopConfig.specialty,
        this.loopConfig.targetDay
      );
      if (res.found) {
        this._log('Dobby detuvo el bucle porque encontró cupos disponibles.');
        this.stopMonitoringLoop();
      }
    }, intervalSeconds * 1000);

    return {
      success: true,
      status: this.currentStatus,
      message: `Bucle autónomo activo. Dobby consultará ${service} cada ${intervalSeconds} segundos.`,
      loopConfig: this.loopConfig
    };
  }

  /**
   * Detiene el bucle de búsqueda recurrente
   */
  stopMonitoringLoop() {
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }
    this.isLoopRunning = false;
    this._log('Bucle de monitoreo detenido.');
    return { success: true, isLoopRunning: false };
  }

  /**
   * Obtiene el estado actual, logs y captura en vivo
   */
  async getStatus() {
    if (this.activePage) {
      try {
        const buffer = await Promise.race([
          this.activePage.screenshot({ encoding: 'base64' }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
        ]);
        if (buffer) {
          this.lastScreenshot = `data:image/png;base64,${buffer}`;
        }
      } catch (_) {}
    }
    return {
      status: this.currentStatus,
      screenshot: this.lastScreenshot,
      logs: this.lastLogs,
      solvedCaptcha: this.solvedCaptcha,
      hasActiveBrowser: !!this.activeBrowser,
      isLoopRunning: this.isLoopRunning,
      loopConfig: this.loopConfig
    };
  }

  /**
   * Cierra el navegador de Dobby
   */
  async close() {
    this.stopMonitoringLoop();
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
