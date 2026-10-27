import React, { useState, useEffect, useRef } from 'react';
import {
  Mic, MicOff, Send, X, Volume2, VolumeX, Sparkles,
  Calendar, Wallet, CheckSquare, Brain, Radio, ArrowDownRight,
  ArrowUpRight, ShieldCheck, Clock, ExternalLink, Loader2, Globe, Eye, RefreshCw,
  Maximize2, Minimize2, MessageSquare, CheckCircle2, Link2, Zap
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

export default function ConversationalAssistantModal({
  isOpen,
  onClose,
  onNavigate,
  onRefreshData
}) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hola César, soy Dobby, tu copiloto ejecutivo. ¿En qué te colaboro hoy?',
      action: 'GREETING',
      timestamp: new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);
  const [activeJobs, setActiveJobs] = useState([]);
  const [browserSession, setBrowserSession] = useState({
    active: false,
    status: 'inactivo',
    screenshot: null,
    logs: [],
    solvedCaptcha: null
  });
  const [captchaInput, setCaptchaInput] = useState('');
  const [isLaunchingBrowser, setIsLaunchingBrowser] = useState(false);
  const [isConnectingChrome, setIsConnectingChrome] = useState(false);
  const [isSolvingCaptcha, setIsSolvingCaptcha] = useState(false);
  const [isLoopActive, setIsLoopActive] = useState(false);
  const [turboMode, setTurboMode] = useState(true);
  const [loopInfo, setLoopInfo] = useState({ attempts: 0, service: 'ODONTOLOGIA', targetDay: 'viernes' });
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);
  const [isBrowserExpanded, setIsBrowserExpanded] = useState(false);
  const [activeView, setActiveView] = useState('chat'); // 'chat' | 'browser'
  const [edusCedula, setEdusCedula] = useState(() => {
    try { return localStorage.getItem('proactur_edus_cedula') || ''; } catch (_) { return ''; }
  });
  const [edusClave, setEdusClave] = useState(() => {
    try { return localStorage.getItem('proactur_edus_clave') || ''; } catch (_) { return ''; }
  });
  const [rememberCredentials, setRememberCredentials] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Conmutar vista a Chrome EDUS en vivo si el navegador se activa
  useEffect(() => {
    if (browserSession.active) {
      setActiveView('browser');
    }
  }, [browserSession.active]);

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const synthRef = useRef(null);
  const audioPlayerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const checkBrowserStatus = async () => {
    try {
      const res = await fetch(`${API}/api/assistant/dobby-browser/status`);
      if (res.ok) {
        const data = await res.json();
        if (data.hasActiveBrowser) {
          setBrowserSession({
            active: true,
            status: data.status,
            screenshot: data.screenshot,
            logs: data.logs || [],
            solvedCaptcha: data.solvedCaptcha || null
          });
          setIsLoopActive(!!data.isLoopRunning);
          if (data.loopConfig) setLoopInfo(data.loopConfig);
          if (data.solvedCaptcha && !captchaInput) {
            setCaptchaInput(data.solvedCaptcha);
          }
        } else {
          setBrowserSession(prev => ({ ...prev, active: false }));
          setIsLoopActive(false);
        }
      }
    } catch (_) {}
  };

  const handleLaunchDobbyBrowser = async () => {
    try {
      setIsLaunchingBrowser(true);
      const res = await fetch(`${API}/api/assistant/dobby-browser/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headless: false,
          autoSolve: true,
          userCedula: edusCedula.trim(),
          userClave: edusClave
        })
      });
      const data = await res.json();
      if (data.success) {
        setBrowserSession({
          active: true,
          status: data.status,
          screenshot: data.screenshot,
          logs: data.logs || [],
          solvedCaptcha: data.solvedCaptcha || null
        });
        if (data.solvedCaptcha) {
          setCaptchaInput(data.solvedCaptcha);
          speakText(`Chrome abierto en pantalla. Descifré el código captcha ${data.solvedCaptcha} automáticamente.`);
        } else {
          speakText('Chrome abierto en tu pantalla en el portal de EDUS.');
        }
      } else {
        alert(data.error || 'No se pudo abrir el navegador.');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setIsLaunchingBrowser(false);
    }
  };

  const handleLoginAndStart = async () => {
    try {
      setIsLoggingIn(true);
      const res = await fetch(`${API}/api/assistant/dobby-browser/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userCedula: edusCedula.trim(),
          userClave: edusClave
        })
      });
      const data = await res.json();
      if (data.success) {
        checkBrowserStatus();
        speakText('Sesión iniciada con éxito en el portal de EDUS. Iniciando búsqueda de cupos disponibles.');
        handleStartLoop();
      } else {
        alert(data.error || 'Aviso en EDUS: Verifique que la cédula y contraseña sean correctas.');
        checkBrowserStatus();
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAutoSolveCaptcha = async () => {
    try {
      setIsSolvingCaptcha(true);
      const res = await fetch(`${API}/api/assistant/dobby-browser/auto-solve`, { method: 'POST' });
      const data = await res.json();
      if (data.success && data.code) {
        setCaptchaInput(data.code);
        checkBrowserStatus();
        speakText(`Descifré el código: ${data.code}.`);
      } else {
        alert(data.error || 'No se pudo descifrar el captcha automáticamente.');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSolvingCaptcha(false);
    }
  };

  const handleSendCaptcha = async () => {
    if (!captchaInput.trim()) return;
    try {
      const res = await fetch(`${API}/api/assistant/dobby-browser/captcha`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ captchaCode: captchaInput.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setBrowserSession(prev => ({
          ...prev,
          status: data.status,
          screenshot: data.screenshot || prev.screenshot,
          logs: data.logs || prev.logs
        }));
        speakText('Código captcha enviado a Chrome.');
      } else {
        alert(data.error || 'Error al enviar código.');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleConnectExistingBrowser = async () => {
    try {
      setIsConnectingChrome(true);
      const res = await fetch(`${API}/api/assistant/dobby-browser/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port: 9222 })
      });
      const data = await res.json();
      if (data.success) {
        checkBrowserStatus();
        speakText('Conectado en vivo a tu Chrome abierto. Listo para sacar citas en tiempo real.');
      } else {
        alert(data.error || 'No se pudo conectar a Chrome existente.');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setIsConnectingChrome(false);
    }
  };

  const handleStartLoop = async () => {
    try {
      const interval = turboMode ? 5 : 60;
      const res = await fetch(`${API}/api/assistant/dobby-browser/loop/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: 'ODONTOLOGIA',
          specialty: 'ODONTOLOGIA GENERAL',
          targetDay: null,
          intervalSeconds: interval,
          autoBook: true
        })
      });
      const data = await res.json();
      if (data.success) {
        setIsLoopActive(true);
        speakText(`Caza en tiempo real iniciada cada ${interval} segundos con auto-reserva activa.`);
        checkBrowserStatus();
      } else {
        alert(data.error || 'No se pudo iniciar el bucle.');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleStopLoop = async () => {
    try {
      await fetch(`${API}/api/assistant/dobby-browser/loop/stop`, { method: 'POST' });
      setIsLoopActive(false);
      speakText('Bucle de búsqueda pausado.');
      checkBrowserStatus();
    } catch (_) {}
  };

  const handleCloseBrowser = async () => {
    try {
      await fetch(`${API}/api/assistant/dobby-browser/close`, { method: 'POST' });
      setBrowserSession({ active: false, status: 'inactivo', screenshot: null, logs: [], solvedCaptcha: null });
      setIsLoopActive(false);
      setCaptchaInput('');
    } catch (_) {}
  };

  // Inicializar Web Speech Recognition y Synthesis
  useEffect(() => {
    // 1. Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognizer = new SpeechRecognition();
      recognizer.lang = 'es-CR';
      recognizer.continuous = false;
      recognizer.interimResults = false;

      recognizer.onstart = () => {
        setIsListening(true);
        // Si la IA estaba hablando, pausar síntesis para no pisarse
        if (window.speechSynthesis) window.speechSynthesis.cancel();
      };
      recognizer.onend = () => setIsListening(false);
      recognizer.onerror = () => setIsListening(false);

      recognizer.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript || '';
        if (transcript.trim()) {
          handleSendMessage(transcript.trim());
        }
      };

      recognitionRef.current = recognizer;
    }

    // 2. Speech Synthesis
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (_) {}
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  // Cargar trabajos de EDUS activos
  const loadEdusJobs = async () => {
    try {
      const res = await fetch(`${API}/api/assistant/edus-jobs`);
      if (res.ok) {
        const jobs = await res.json();
        setActiveJobs(jobs || []);
      }
    } catch (_) {}
  };

  // Polling continuo en vivo para actualizar la pantalla de Chrome mientras el navegador esté activo
  useEffect(() => {
    let interval = null;
    if (isOpen && browserSession.active) {
      interval = setInterval(() => {
        checkBrowserStatus();
      }, 1500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOpen, browserSession.active]);

  useEffect(() => {
    if (isOpen) {
      loadEdusJobs();
      checkBrowserStatus();
      scrollToBottom();
    } else {
      if (synthRef.current) synthRef.current.cancel();
      setIsSpeaking(false);
      setIsListening(false);
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Hablar texto con voz humana natural (Neural TTS Costa Rica / Estudio)
  const speakText = async (text) => {
    if (isVoiceMuted) return;

    // Detener audio previo si está activo
    if (audioPlayerRef.current) {
      try {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      } catch (_) {}
    }
    if (synthRef.current) {
      try { synthRef.current.cancel(); } catch (_) {}
    }

    const cleanText = text
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[*_#`~›•\(\)\[\]]/g, ' ')
      .trim();

    if (!cleanText) return;

    setIsSpeaking(true);

    try {
      // 1. Invocar voz neural humana hiperrealista desde el servidor
      const res = await fetch(`${API}/api/assistant/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText })
      });

      if (res.ok) {
        const blob = await res.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audioPlayerRef.current = audio;

        audio.onended = () => {
          setIsSpeaking(false);
          audioPlayerRef.current = null;
          URL.revokeObjectURL(audioUrl);
        };
        audio.onerror = () => {
          setIsSpeaking(false);
          audioPlayerRef.current = null;
          URL.revokeObjectURL(audioUrl);
        };

        await audio.play();
        return;
      }
    } catch (_) {}

    // 2. Fallback de respaldo: Web Speech API si no hay conexión
    if (synthRef.current) {
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'es-CR';
      utterance.rate = 1.0;
      utterance.pitch = 0.98;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      synthRef.current.speak(utterance);
    } else {
      setIsSpeaking(false);
    }
  };

  const toggleVoiceMute = () => {
    if (!isVoiceMuted && synthRef.current) synthRef.current.cancel();
    const next = !isVoiceMuted;
    setIsVoiceMuted(next);
    try {
      localStorage.setItem('proactur_voice_muted', String(next));
    } catch (_) {}
  };

  const startListening = async () => {
    if (synthRef.current) synthRef.current.cancel();

    // 1. Probar MediaRecorder (Universal en Móvil, WebView y Desktop con Groq Whisper)
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunksRef.current = [];
        
        let options = undefined;
        let finalMime = 'audio/webm';
        if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
          const supportedTypes = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4',
            'audio/aac',
            'audio/ogg'
          ];
          for (const t of supportedTypes) {
            if (MediaRecorder.isTypeSupported(t)) {
              options = { mimeType: t };
              finalMime = t;
              break;
            }
          }
        }

        const mr = options ? new MediaRecorder(stream, options) : new MediaRecorder(stream);
        mr.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        mr.onstop = async () => {
          stream.getTracks().forEach(t => t.stop());
          if (audioChunksRef.current.length === 0) {
            setIsListening(false);
            return;
          }

          const resolvedMime = mr.mimeType || finalMime || 'audio/webm';
          const blob = new Blob(audioChunksRef.current, { type: resolvedMime });
          setIsListening(false);
          setIsTranscribingAudio(true);

          try {
            const formData = new FormData();
            const ext = resolvedMime.includes('mp4') ? 'mp4' : resolvedMime.includes('ogg') ? 'ogg' : 'webm';
            formData.append('audio', blob, `dobby_voice.${ext}`);
            const res = await fetch(`${API}/api/assistant/transcribe-audio`, {
              method: 'POST',
              body: formData
            });
            if (res.ok) {
              const data = await res.json();
              if (data.text && data.text.trim()) {
                handleSendMessage(data.text.trim());
              }
            }
          } catch (tErr) {
            console.error('[Whisper Transcribe Error]:', tErr);
          } finally {
            setIsTranscribingAudio(false);
          }
        };

        mr.start(250);
        mediaRecorderRef.current = mr;
        setIsListening(true);
        return;
      } catch (err) {
        console.warn('[MediaRecorder Error]:', err);
      }
    }

    // 2. Fallback a Web Speech Recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (_) {
        setIsListening(false);
      }
    } else {
      alert('Por favor autoriza el permiso de micrófono en tu navegador o celular.');
    }
  };

  const stopListening = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (_) {}
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
    }
    setIsListening(false);
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleSendMessage = async (textToSend) => {
    const text = (typeof textToSend === 'string' ? textToSend : inputText).trim();
    if (!text || isThinking) return;

    setInputText('');
    const userMsg = {
      id: 'msg_' + Date.now(),
      role: 'user',
      text,
      timestamp: new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setIsThinking(true);

    try {
      const historyPayload = messages.slice(-6).map(m => ({
        role: m.role,
        text: m.text
      }));

      const res = await fetch(`${API}/api/assistant/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: historyPayload,
          userCedula: edusCedula.trim(),
          userClave: edusClave
        })
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      const assistantReply = data.reply || data.message || 'He procesado tu solicitud, César.';

      const assistantMsg = {
        id: 'reply_' + Date.now(),
        role: 'assistant',
        text: assistantReply,
        action: data.action,
        data: data.data,
        timestamp: new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, assistantMsg]);
      speakText(data.spokenReply || assistantReply);

      // Si generó o actualizó un evento o trabajo de EDUS, refrescar y activar panel de navegador
      if (data.action === 'EDUS_MONITORING') {
        loadEdusJobs();
        setActiveView('browser');
        setTimeout(checkBrowserStatus, 1200);
        setTimeout(checkBrowserStatus, 3500);
        setTimeout(checkBrowserStatus, 7000);
      }
      if (onRefreshData) onRefreshData();

    } catch (err) {
      console.error('[Assistant Chat Error]:', err);
      const errorMsg = {
        id: 'err_' + Date.now(),
        role: 'assistant',
        text: 'Disculpa César, tuve un inconveniente al conectar con el servidor. Por favor intenta de nuevo.',
        action: 'ERROR',
        timestamp: new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
      speakText('Disculpa César, tuve un inconveniente al conectar. Por favor intenta de nuevo.');
    } finally {
      setIsThinking(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xl animate-fade-in">
      <div className={`bg-slate-900 border border-slate-800 rounded-3xl w-full ${
        isBrowserExpanded ? 'max-w-4xl h-[94vh] max-h-[920px]' : 'max-w-xl h-[90vh] max-h-[780px]'
      } flex flex-col shadow-2xl overflow-hidden relative transition-all duration-300`}>
        
        {/* 1. Header Ejecutivo del Asistente */}
        <div className="px-5 py-4 border-b border-slate-800/80 bg-slate-950/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {/* Orbe pulsante inteligente */}
            <div className="relative flex items-center justify-center">
              <div className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                isSpeaking
                  ? 'bg-gradient-to-tr from-cyan-500 to-indigo-500 shadow-lg shadow-cyan-500/30 scale-105'
                  : isListening
                  ? 'bg-gradient-to-tr from-rose-500 to-amber-500 shadow-lg shadow-rose-500/30 animate-pulse'
                  : isThinking
                  ? 'bg-gradient-to-tr from-purple-500 to-indigo-500 animate-spin'
                  : 'bg-gradient-to-tr from-indigo-600 to-emerald-600 shadow-md shadow-indigo-600/20'
              }`}>
                {isThinking ? (
                  <Loader2 className="w-4 h-4 text-white" />
                ) : (
                  <Sparkles className="w-4 h-4 text-white" />
                )}
              </div>
              {(isSpeaking || isListening) && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-cyan-400 animate-ping" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-white tracking-tight">Dobby</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                  Copiloto Ejecutivo
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {isSpeaking ? 'Hablando respuesta...' : isTranscribingAudio ? 'Transcribiendo audio con Whisper...' : isListening ? 'Escuchando tu voz (toca el micro rojo para enviar)...' : isThinking ? 'Procesando con IA...' : 'Diálogo continuo por voz y texto'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Selector de Pestañas (Diálogo / Chrome EDUS) si el navegador está activo */}
            {browserSession.active && (
              <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-700/80">
                <button
                  type="button"
                  onClick={() => setActiveView('chat')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeView === 'chat'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Diálogo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('browser')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeView === 'browser'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Chrome EDUS</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </button>
              </div>
            )}

            {/* Botón Silenciar Voz IA */}
            <button
              type="button"
              onClick={toggleVoiceMute}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                isVoiceMuted
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white'
              }`}
              title={isVoiceMuted ? 'Activar voz del asistente' : 'Silenciar voz del asistente'}
            >
              {isVoiceMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span className="text-[10px] font-medium">{isVoiceMuted ? 'Silencio' : 'Voz'}</span>
            </button>

            {/* Cerrar */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* CUERPO DEL MODAL: PESTAÑA NAVEGADOR EDUS O PESTAÑA DIÁLOGO */}
        {activeView === 'browser' && browserSession.active ? (
          <div className="flex-1 p-4 sm:p-5 space-y-4 overflow-y-auto scrollbar-thin">
            {/* 1. Header amplio y balanceado sin textos partidos */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-white/[0.08]">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                <Globe className="w-4 h-4 text-sky-400 shrink-0" />
                <span className="text-sm font-bold text-white tracking-tight whitespace-nowrap">
                  Chrome • EDUS CCSS
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-[11px] font-bold whitespace-nowrap flex items-center gap-1.5 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  EN VIVO
                </span>
                {browserSession.solvedCaptcha && (
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-mono text-[11px] font-bold whitespace-nowrap shrink-0">
                    Captcha IA: {browserSession.solvedCaptcha}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleConnectExistingBrowser}
                  disabled={isConnectingChrome}
                  className="px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shadow-sm"
                  title="Conectar a Chrome ya abierto con --remote-debugging-port=9222"
                >
                  {isConnectingChrome ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                  <span>{isConnectingChrome ? 'Conectando...' : 'Vincular a mi Chrome Abierto'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsBrowserExpanded(prev => !prev)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 hover:border-sky-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
                  title={isBrowserExpanded ? 'Reducir tamaño' : 'Ampliar pantalla completa'}
                >
                  {isBrowserExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  <span>{isBrowserExpanded ? 'Reducir' : 'Ampliar'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => { handleCloseBrowser(); setActiveView('chat'); }}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cerrar</span>
                </button>
              </div>
            </div>

            {/* 2. Panel de Credenciales y Acceso Autónomo (Sin pedir Captcha al usuario) */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-sky-500/20 space-y-3.5 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-sky-400" />
                  Credenciales de Acceso a EDUS (CCSS)
                </span>
                <label className="text-[11px] text-slate-400 flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberCredentials}
                    onChange={(e) => setRememberCredentials(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-0"
                  />
                  <span>Recordar credenciales</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                <div className="sm:col-span-6">
                  <label className="block text-[11px] text-slate-400 mb-1">Número de Identificación / Cédula</label>
                  <input
                    type="text"
                    value={edusCedula}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEdusCedula(val);
                      if (rememberCredentials) {
                        try { localStorage.setItem('proactur_edus_cedula', val); } catch (_) {}
                      }
                    }}
                    placeholder="Ej: 115840293"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono tracking-wider"
                  />
                </div>

                <div className="sm:col-span-6">
                  <label className="block text-[11px] text-slate-400 mb-1">Contraseña de EDUS</label>
                  <input
                    type="password"
                    value={edusClave}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEdusClave(val);
                      if (rememberCredentials) {
                        try { localStorage.setItem('proactur_edus_clave', val); } catch (_) {}
                      }
                    }}
                    placeholder="••••••••••••"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono tracking-wider"
                  />
                </div>
              </div>

              {/* Indicador de Captcha 100% autónomo por visión IA */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/90 border border-sky-500/20 text-xs text-sky-300">
                <Sparkles className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="text-[11px]">
                  El código captcha de seguridad se descifra y digita <strong>100% por visión IA de forma autónoma</strong>.
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-1 border-t border-white/[0.04]">
                <span className="text-[11px] text-slate-400">
                  Dobby digita tus datos en Chrome, supera el captcha y entra a consultar los cupos.
                </span>
                <button
                  type="button"
                  onClick={handleLoginAndStart}
                  disabled={isLoggingIn || !edusCedula.trim() || !edusClave.trim()}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs disabled:opacity-40 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  {isLoggingIn ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  <span>{isLoggingIn ? 'Iniciando sesión y resolviendo captcha...' : 'Iniciar Sesión en EDUS y Buscar Cupos'}</span>
                </button>
              </div>
            </div>

            {/* 3. Pantalla en vivo con tamaño adaptable sin desbordarse */}
            {browserSession.screenshot && (
              <div className={`rounded-2xl overflow-hidden border border-white/10 bg-slate-950 relative group transition-all duration-300 flex items-center justify-center ${
                isBrowserExpanded ? 'h-80 sm:h-[420px] md:h-[480px]' : 'h-60 sm:h-72 md:h-80'
              }`}>
                <img
                  src={browserSession.screenshot}
                  alt="Vista en vivo EDUS"
                  className="w-full h-full object-contain bg-black"
                />
                <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 bg-black/85 backdrop-blur-md px-3 py-1 rounded-full border border-sky-500/40 text-xs font-semibold text-sky-200 shadow-xl whitespace-nowrap">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Directo (1.5s)</span>
                </div>
              </div>
            )}

            {/* 4. Bucle Autónomo de Citas en Tiempo Real */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/[0.06] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={isLoopActive ? handleStopLoop : handleStartLoop}
                  className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-md whitespace-nowrap shrink-0 cursor-pointer ${
                    isLoopActive
                      ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse'
                      : 'bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white'
                  }`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoopActive ? 'animate-spin' : ''}`} />
                  <span>
                    {isLoopActive
                      ? `Detener Caza (Intento #${loopInfo.attempts || 1})`
                      : `⚡ Caza en Tiempo Real (${turboMode ? 'Cada 5s' : 'Cada 60s'})`}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setTurboMode(prev => !prev)}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                    turboMode
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                  title="Modo Turbo: escanea cada 5s para aperturas a las 6:00 AM"
                >
                  {turboMode ? '⚡ Turbo (5s)' : 'Normal (60s)'}
                </button>
              </div>

              <div className="text-xs text-slate-300 leading-snug">
                {isLoopActive ? (
                  <span className="text-amber-300 font-semibold font-mono flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                    Buscando y auto-reservando {loopInfo.service} en tiempo real...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Auto-reserva activada: Dobby sacará la primera cita disponible al instante</span>
                  </span>
                )}
              </div>
            </div>

            {/* 5. Terminal de Logs en tiempo real: Sin texto cortado (wrap limpio) */}
            {browserSession.logs && browserSession.logs.length > 0 && (
              <div className="bg-slate-950 rounded-xl p-3 border border-white/[0.08] space-y-1.5 font-mono text-[11px] text-slate-300 max-h-36 overflow-y-auto scrollbar-thin">
                {browserSession.logs.map((l, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-slate-300 leading-relaxed">
                    <span className="text-sky-400 font-bold shrink-0">›</span>
                    <span className="break-words flex-1">{l}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* 3. Feed Conversacional con Burbujas */
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 scrollbar-thin">
          {messages.map((m) => {
            const isUser = m.role === 'user';
            return (
              <div
                key={m.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-fade-in`}
              >
                <div className={`max-w-[85%] sm:max-w-[80%] rounded-2xl p-3.5 sm:p-4 text-xs sm:text-sm leading-relaxed shadow-md ${
                  isUser
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-medium rounded-tr-none'
                    : 'bg-slate-950/80 border border-slate-800/90 text-slate-100 rounded-tl-none space-y-2'
                }`}>
                  <p>{m.text}</p>

                  {/* Tarjeta embebida de acción ejecutada */}
                  {!isUser && m.action && m.action !== 'GREETING' && m.action !== 'CONVERSATION' && (
                    <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between gap-2 text-[11px]">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        {m.action === 'CREATE_EVENT' && <Calendar className="w-3.5 h-3.5 text-amber-400" />}
                        {m.action === 'RECORD_FINANCE' && <Wallet className="w-3.5 h-3.5 text-emerald-400" />}
                        {m.action === 'CREATE_TASK' && <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />}
                        {m.action === 'EDUS_MONITORING' && <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />}
                        {m.action === 'SEARCH_PROMOS' && <Sparkles className="w-3.5 h-3.5 text-rose-400" />}
                        <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-300">
                          {m.action.replace('_', ' ')}
                        </span>
                      </div>

                      {m.action === 'EDUS_MONITORING' && (
                        <button
                          type="button"
                          onClick={handleLaunchDobbyBrowser}
                          disabled={isLaunchingBrowser}
                          className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-[10px] flex items-center gap-1 shadow-sm transition-all"
                        >
                          <Globe className="w-3 h-3" />
                          <span>{isLaunchingBrowser ? 'Abriendo...' : 'Abrir Chrome EDUS'}</span>
                        </button>
                      )}
                      {m.action === 'CREATE_EVENT' && (
                        <button
                          type="button"
                          onClick={() => { onClose(); onNavigate?.('calendar'); }}
                          className="text-amber-400 hover:underline font-bold text-[10px]"
                        >
                          Ver Agenda
                        </button>
                      )}
                      {m.action === 'RECORD_FINANCE' && (
                        <button
                          type="button"
                          onClick={() => { onClose(); onNavigate?.('finance'); }}
                          className="text-emerald-400 hover:underline font-bold text-[10px]"
                        >
                          Ver Finanzas
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-slate-500 mt-1 px-1">{m.timestamp}</span>
              </div>
            );
          })}

          {isThinking && (
            <div className="flex items-center gap-2 text-slate-400 text-xs py-2 px-3 bg-slate-950/40 rounded-xl w-fit animate-pulse border border-slate-800/60">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              <span>Procesando solicitud...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
        )}



        {/* 5. Barra Inferior de Entrada (Voz Continua + Input de Texto) */}
        <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950/90 flex items-center gap-2 shrink-0">
          {/* Botón de Micrófono (Hablar) */}
          <button
            type="button"
            onClick={toggleListening}
            disabled={isTranscribingAudio || isThinking}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-95 shrink-0 ${
              isTranscribingAudio
                ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40 animate-pulse'
                : isListening
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/40 animate-pulse ring-2 ring-rose-400'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
            title={isListening ? 'Detener y transcribir' : 'Hablar con Dobby'}
          >
            {isTranscribingAudio ? (
              <Loader2 className="w-5 h-5 animate-spin text-amber-300" />
            ) : isListening ? (
              <MicOff className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5 text-amber-400" />
            )}
          </button>

          {/* Campo de Texto */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              isTranscribingAudio
                ? 'Transcribiendo tu voz con Whisper...'
                : isListening
                ? 'Escuchando... Toca el micro rojo para enviar'
                : 'Escribe o presiona el micro para hablar...'
            }
            className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />

          {/* Botón Enviar */}
          <button
            type="submit"
            disabled={!inputText.trim() || isThinking}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all shrink-0 ${
              inputText.trim() && !isThinking
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 cursor-pointer active:scale-95'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-800'
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

      </div>
    </div>
  );
}
