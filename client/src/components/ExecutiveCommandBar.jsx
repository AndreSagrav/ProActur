import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles, Mic, MicOff, Send, Loader2, CheckCircle2,
  Calendar, Wallet, CheckSquare, Brain, Radio, X, ArrowUpRight,
  ChevronDown
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

export default function ExecutiveCommandBar({
  onStartRecording,
  onNavigate,
  onRefreshData,
  onOpenVoiceAssistant
}) {
  const [commandText, setCommandText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [resultModal, setResultModal] = useState(null); // { action, message, data }
  const [quickToast, setQuickToast] = useState(null);

  const recognitionRef = useRef(null);
  const inputRef = useRef(null);

  // Inicializar Web Speech API para dictado por voz
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognizer = new SpeechRecognition();
      recognizer.lang = 'es-ES';
      recognizer.continuous = false;
      recognizer.interimResults = false;

      recognizer.onstart = () => setIsListening(true);
      recognizer.onend = () => setIsListening(false);
      recognizer.onerror = () => setIsListening(false);

      recognizer.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript || '';
        if (transcript) {
          setCommandText(transcript);
          // Ejecutar automáticamente al terminar de hablar
          handleExecute(transcript);
        }
      };

      recognitionRef.current = recognizer;
    }
  }, []);

  const toggleListening = () => {
    if (onOpenVoiceAssistant) {
      onOpenVoiceAssistant();
      return;
    }
    if (!recognitionRef.current) {
      alert('El reconocimiento de voz no está disponible en este navegador. Puede escribir la orden directamente.');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (_) {
        setIsListening(false);
      }
    }
  };

  const handleExecute = async (textToRun) => {
    const cmd = (typeof textToRun === 'string' ? textToRun : commandText).trim();
    if (!cmd || isLoading) return;

    setIsLoading(true);
    setCommandText('');
    setQuickToast(null);

    try {
      const res = await fetch(`${API}/api/assistant/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const result = await res.json();

      // Acción: Iniciar grabación en vivo
      if (result.action === 'START_RECORDING') {
        setQuickToast({
          action: 'START_RECORDING',
          message: result.message
        });
        if (onStartRecording) onStartRecording();
        return;
      }

      // Si es una respuesta analítica / Segundo Cerebro, abrir modal completo
      if (result.action === 'ANSWER') {
        setResultModal({
          action: result.action,
          message: result.message,
          data: result.data
        });
      } else {
        // Confirmación ejecutiva flotante con acceso directo
        setQuickToast(result);
        if (onRefreshData) onRefreshData();
      }
    } catch (err) {
      setQuickToast({
        action: 'ERROR',
        message: 'Error al ejecutar orden: ' + err.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleExecute(commandText);
  };

  return (
    <>
      {/* 1. Modo Minimizado en Móvil (Píldora Discreta que No Cubre Contenido) */}
      {isMinimized && (
        <div className="fixed bottom-20 right-4 z-40 md:hidden animate-fade-in">
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-slate-950/95 border border-white/[0.15] text-amber-300 font-bold text-xs shadow-[0_10px_25px_rgba(0,0,0,0.6)] backdrop-blur-2xl active:scale-95 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>Asistente IA</span>
          </button>
        </div>
      )}

      {/* 2. Barra Flotante Principal */}
      <div className={`${isMinimized ? 'hidden md:block' : 'block'} fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-xl px-3 pointer-events-auto transition-all`}>
        {/* Banner de Feedback Rápido */}
        {quickToast && (
          <div className="mb-2 p-3 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur-2xl flex items-center justify-between gap-3 text-xs animate-fade-in">
            <div className="flex items-center gap-2.5 min-w-0">
              {quickToast.action === 'CREATE_EVENT' && <Calendar className="w-4 h-4 text-amber-400 shrink-0" />}
              {quickToast.action === 'RECORD_FINANCE' && <Wallet className="w-4 h-4 text-emerald-400 shrink-0" />}
              {quickToast.action === 'CREATE_TASK' && <CheckSquare className="w-4 h-4 text-indigo-400 shrink-0" />}
              {quickToast.action === 'START_RECORDING' && <Radio className="w-4 h-4 text-rose-400 animate-pulse shrink-0" />}
              {quickToast.action === 'ERROR' && <X className="w-4 h-4 text-rose-400 shrink-0" />}
              <span className="text-slate-100 font-medium truncate">{quickToast.message}</span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {quickToast.action === 'CREATE_EVENT' && (
                <button
                  type="button"
                  onClick={() => { setQuickToast(null); onNavigate?.('calendar'); }}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 font-bold text-[11px] transition-all"
                >
                  Ver Agenda
                </button>
              )}
              {quickToast.action === 'RECORD_FINANCE' && (
                <button
                  type="button"
                  onClick={() => { setQuickToast(null); onNavigate?.('finance'); }}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 font-bold text-[11px] transition-all"
                >
                  Ver Finanzas
                </button>
              )}
              {quickToast.action === 'CREATE_TASK' && (
                <button
                  type="button"
                  onClick={() => { setQuickToast(null); onNavigate?.('command-center'); }}
                  className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 font-bold text-[11px] transition-all"
                >
                  Ver Tareas
                </button>
              )}
              <button
                type="button"
                onClick={() => setQuickToast(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className={`relative flex items-center bg-slate-950/90 border rounded-2xl p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.75)] backdrop-blur-3xl ring-1 transition-all ${
            isListening
              ? 'border-red-500/80 ring-red-500/40 bg-slate-950'
              : 'border-white/[0.12] ring-white/[0.04] focus-within:border-indigo-500/80 focus-within:ring-indigo-500/25'
          }`}
        >
          {/* Botón Asistente Conversacional Humano (Gemini Live) */}
          {onOpenVoiceAssistant && (
            <button
              type="button"
              onClick={onOpenVoiceAssistant}
              className="p-2 sm:p-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all flex items-center justify-center shrink-0 cursor-pointer active:scale-95"
              title="Abrir conversación continua con IA (Gemini Live)"
            >
              <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            </button>
          )}

          {/* Botón de Dictado por Voz */}
          <button
            type="button"
            onClick={toggleListening}
            className={`p-2 sm:p-2.5 rounded-xl transition-all flex items-center justify-center shrink-0 cursor-pointer ${
              isListening
                ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/40'
                : 'text-slate-400 hover:text-indigo-400 hover:bg-slate-800/80'
            }`}
            title={isListening ? 'Detener dictado' : 'Hablar al Asistente por voz'}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Campo de Texto con placeholder conciso para evitar textos cortados */}
          <input
            ref={inputRef}
            type="text"
            value={commandText}
            onChange={e => setCommandText(e.target.value)}
            disabled={isLoading}
            placeholder={
              isListening
                ? 'Escuchando voz...'
                : 'Instrucción o consulta con IA...'
            }
            className="w-full bg-transparent text-xs sm:text-sm text-slate-100 placeholder-slate-400 outline-none px-2.5"
          />

          {/* Botón Minimizar en Móvil */}
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 md:hidden shrink-0"
            title="Minimizar barra"
          >
            <ChevronDown className="w-4 h-4" />
          </button>

          {/* Botón Ejecutar */}
          <button
            type="submit"
            disabled={(!commandText.trim() && !isListening) || isLoading}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shrink-0 shadow-md transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <span className="hidden sm:inline">Ejecutar</span>
                <Send className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* 2. Modal de Resultado para Consultas Extensas / Segundo Cerebro */}
      {resultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Brain className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Respuesta del Asistente Ejecutivo</h3>
                  <p className="text-xs text-slate-400">Análisis basado en minutas, tareas y registros</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResultModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 text-sm text-slate-200 leading-relaxed whitespace-pre-line space-y-3">
              {resultModal.message}
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-800 shrink-0 gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(resultModal.message);
                  setQuickToast({ action: 'COPY', message: 'Respuesta copiada al portapapeles.' });
                  setResultModal(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200"
              >
                Copiar
              </button>
              <button
                type="button"
                onClick={() => setResultModal(null)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
