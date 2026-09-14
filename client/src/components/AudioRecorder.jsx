import React, { useState, useRef, useEffect } from 'react';
import {
  Mic, Square, Upload, FileText, Loader2, Sparkles, Volume2, AlertCircle,
  CheckCircle2, CheckSquare, Clock, Zap, Brain, ShieldAlert, ArrowRight
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

export default function AudioRecorder({ onMeetingProcessed }) {
  const [activeTab, setActiveTab] = useState('record'); // 'record' | 'upload' | 'text'
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [rawText, setRawText] = useState('');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Estados del copiloto en tiempo real (Live Proactor AI)
  const [liveTranscript, setLiveTranscript] = useState('');
  const [liveInterim, setLiveInterim] = useState('');
  const [liveDecisions, setLiveDecisions] = useState([]);
  const [liveActionItems, setLiveActionItems] = useState([]);
  const [liveAdvice, setLiveAdvice] = useState([]);
  const [liveSummary, setLiveSummary] = useState('');
  const [isAnalyzingLive, setIsAnalyzingLive] = useState(false);
  const [lastAnalyzedLength, setLastAnalyzedLength] = useState(0);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const recognitionRef = useRef(null);
  const liveAnalysisTimerRef = useRef(null);

  // Referencias mutables para evitar stale closures en intervalos
  const stateRef = useRef({
    transcript: '',
    decisions: [],
    actionItems: [],
    advice: [],
    summary: '',
    title: '',
    isRecording: false,
    isAnalyzing: false
  });

  useEffect(() => {
    stateRef.current = {
      transcript: liveTranscript,
      decisions: liveDecisions,
      actionItems: liveActionItems,
      advice: liveAdvice,
      summary: liveSummary,
      title: meetingTitle,
      isRecording,
      isAnalyzing: isAnalyzingLive
    };
  }, [liveTranscript, liveDecisions, liveActionItems, liveAdvice, liveSummary, meetingTitle, isRecording, isAnalyzingLive]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (liveAnalysisTimerRef.current) clearInterval(liveAnalysisTimerRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (_) {}
      }
    };
  }, []);

  // Iniciar reconocimiento de voz nativo continuo en el navegador
  const initSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[SpeechRecognition] No soportado en este navegador');
      return null;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'es-ES';

      recognition.onresult = (event) => {
        let interim = '';
        let finalChunk = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const trans = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalChunk += ' ' + trans;
          } else {
            interim += ' ' + trans;
          }
        }

        if (finalChunk.trim()) {
          setLiveTranscript(prev => {
            const updated = (prev + ' ' + finalChunk.trim()).trim();
            return updated;
          });
        }
        setLiveInterim(interim.trim());
      };

      recognition.onerror = (e) => {
        console.warn('[SpeechRecognition Error]', e.error);
        // Si se interrumpe por silencio, volver a escuchar si sigue grabando
        if (stateRef.current.isRecording && e.error !== 'not-allowed') {
          setTimeout(() => {
            if (stateRef.current.isRecording) {
              try { recognition.start(); } catch (_) {}
            }
          }, 300);
        }
      };

      recognition.onend = () => {
        if (stateRef.current.isRecording) {
          try { recognition.start(); } catch (_) {}
        }
      };

      recognition.start();
      return recognition;
    } catch (err) {
      console.warn('[SpeechRecognition Start Error]', err);
      return null;
    }
  };

  // Analisis incremental en vivo con Gemini
  const triggerLiveAnalysis = async () => {
    const current = stateRef.current;
    if (!current.isRecording || current.isAnalyzing) return;

    const textToAnalyze = current.transcript.trim();
    // Requerir al menos 15 palabras para no saturar con analisis vacios
    if (textToAnalyze.split(/\s+/).length < 10) return;

    // Solo analizar si hubo texto nuevo relevante
    if (textToAnalyze.length <= lastAnalyzedLength + 30 && current.decisions.length > 0) return;

    setIsAnalyzingLive(true);
    setLastAnalyzedLength(textToAnalyze.length);

    try {
      const res = await fetch(`${API}/api/meetings/live-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: current.title || 'Reunion en Vivo',
          transcript: textToAnalyze,
          previousContext: {
            actionItems: current.actionItems,
            keyDecisions: current.decisions
          }
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.summary) setLiveSummary(data.summary);
        if (Array.isArray(data.keyDecisions) && data.keyDecisions.length > 0) {
          setLiveDecisions(data.keyDecisions);
        }
        if (Array.isArray(data.actionItems) && data.actionItems.length > 0) {
          setLiveActionItems(data.actionItems);
        }
        if (Array.isArray(data.proactiveAdvice) && data.proactiveAdvice.length > 0) {
          setLiveAdvice(data.proactiveAdvice);
        }
      }
    } catch (err) {
      console.warn('[Live Analysis Warn]', err.message);
    } finally {
      setIsAnalyzingLive(false);
    }
  };

  const startRecording = async () => {
    try {
      setError(null);
      setLiveTranscript('');
      setLiveInterim('');
      setLiveDecisions([]);
      setLiveActionItems([]);
      setLiveAdvice([]);
      setLiveSummary('');
      setLastAnalyzedLength(0);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);

      // Iniciar temporizador de duracion
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      // Iniciar reconocimiento de voz en vivo
      recognitionRef.current = initSpeechRecognition();

      // Disparar analisis de copiloto en tiempo real cada 18 segundos
      liveAnalysisTimerRef.current = setInterval(() => {
        triggerLiveAnalysis();
      }, 18000);

    } catch (err) {
      console.error('Error accediendo al microfono:', err);
      setError('No se pudo acceder al microfono. Por favor concede permisos en tu navegador.');
    }
  };

  const stopAndFinalizeRecording = async () => {
    if (mediaRecorderRef.current && isRecording) {
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      if (liveAnalysisTimerRef.current) clearInterval(liveAnalysisTimerRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (_) {}
      }
      mediaRecorderRef.current.stop();
    }

    setLoading(true);
    setError(null);

    const current = stateRef.current;
    const fullTranscript = (current.transcript + ' ' + liveInterim).trim();

    try {
      // Si ya recolectamos analisis o transcripcion en vivo, finalizamos directamente
      if (fullTranscript.length > 20 || current.actionItems.length > 0) {
        const res = await fetch(`${API}/api/meetings/live-finalize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: current.title.trim() || `Reunion en Vivo ${new Date().toLocaleDateString('es-ES')}`,
            summary: current.summary || (fullTranscript.substring(0, 180) + '...'),
            keyDecisions: current.decisions,
            actionItems: current.actionItems,
            proactiveAdvice: current.advice,
            transcript: fullTranscript
          })
        });

        if (res.ok) {
          const savedMeeting = await res.json();
          onMeetingProcessed(savedMeeting);
          return;
        }
      }

      // Fallback: procesar audio completo con Gemini si no hubo streaming previo
      setTimeout(async () => {
        if (audioChunksRef.current.length > 0) {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          await processAudioMeeting(blob);
        } else {
          setLoading(false);
        }
      }, 500);

    } catch (err) {
      console.error('[Finalize Meeting Error]', err);
      setError('Error guardando la reunion: ' + err.message);
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const processAudioMeeting = async (fileOrBlob, filename = 'recording.webm') => {
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('audio', fileOrBlob, filename);
    if (meetingTitle.trim()) {
      formData.append('title', meetingTitle.trim());
    }

    try {
      const res = await fetch(`${API}/api/meetings/process-audio`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al procesar el audio');
      }

      setAudioBlob(null);
      setSelectedFile(null);
      setMeetingTitle('');
      onMeetingProcessed(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const processTextMeeting = async () => {
    if (!rawText.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API}/api/meetings/process-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText,
          title: meetingTitle.trim() || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar notas');

      setRawText('');
      setMeetingTitle('');
      onMeetingProcessed(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden transition-all">
      {/* Background glow */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Tabs superiores */}
      {!isRecording && (
        <div className="flex border-b border-slate-800 mb-5 gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('record')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'record'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mic className="w-4 h-4" />
            Grabar en Vivo (Copiloto IA)
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'upload'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-4 h-4" />
            Subir Audio
          </button>
          <button
            onClick={() => setActiveTab('text')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'text'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            Pegar Minuta / Notas
          </button>
        </div>
      )}

      {/* Titulo de la reunion */}
      {!isRecording && (
        <div className="mb-4">
          <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5">
            Titulo de la Reunion (Opcional)
          </label>
          <input
            type="text"
            value={meetingTitle}
            onChange={(e) => setMeetingTitle(e.target.value)}
            placeholder="Ej. Sincronizacion Estrategica Semanal..."
            className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
          />
        </div>
      )}

      {/* =================================================================== */}
      {/* VISTA 1: MODO GRABACION EN VIVO Y COPILOTO EN TIEMPO REAL           */}
      {/* =================================================================== */}
      {activeTab === 'record' && (
        <div>
          {!isRecording ? (
            <div className="flex flex-col items-center justify-center py-6 sm:py-8">
              <button
                onClick={startRecording}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white flex items-center justify-center shadow-xl shadow-indigo-500/25 hover:scale-105 active:scale-95 transition-all duration-300 group"
                title="Iniciar grabacion y analisis en vivo"
              >
                <Mic className="w-9 h-9 sm:w-10 sm:h-10 group-hover:scale-110 transition-transform" />
              </button>
              <h4 className="mt-4 text-sm font-semibold text-slate-200">Iniciar Reunion en Vivo</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm text-center">
                Proactor AI escuchara en tiempo real, extrayendo tareas, decisiones y consejos proactivos mientras conversas.
              </p>
            </div>
          ) : (
            /* COPILOTO EN TIEMPO REAL ACTIVO */
            <div className="space-y-4 animate-fade-in">
              {/* Barra de Estado y Accion Superior */}
              <div className="flex items-center justify-between flex-wrap gap-3 bg-slate-950/70 border border-indigo-500/30 rounded-2xl p-3 sm:p-4">
                <div className="flex items-center gap-3">
                  <div className="relative flex items-center justify-center">
                    <span className="absolute w-4 h-4 rounded-full bg-red-500/40 animate-ping" />
                    <span className="w-3 h-3 rounded-full bg-red-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold text-slate-100 font-mono">
                        {formatTime(recordingTime)}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 font-semibold uppercase tracking-wider">
                        En Vivo
                      </span>
                      {isAnalyzingLive && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-semibold flex items-center gap-1 animate-pulse">
                          <Sparkles className="w-3 h-3" /> Analizando IA...
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {meetingTitle || 'Reunion en vivo'} &bull; Escuchando y detectando en tiempo real
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={triggerLiveAnalysis}
                    disabled={isAnalyzingLive}
                    className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 transition-all"
                    title="Forzar analisis inmediato de lo hablado hasta ahora"
                  >
                    <Zap className="w-3.5 h-3.5" /> Analizar Ahora
                  </button>

                  <button
                    onClick={stopAndFinalizeRecording}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-lg shadow-red-500/20 transition-all"
                  >
                    <Square className="w-3.5 h-3.5 fill-white" />
                    Finalizar y Guardar Minuta
                  </button>
                </div>
              </div>

              {/* TABLERO DE RESULTADOS EN TIEMPO REAL (4 PANELES) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Panel 1: Compromisos y Tareas en Vivo (Action Items) */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between min-h-[160px]">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="text-xs font-bold text-indigo-300 flex items-center gap-1.5 uppercase tracking-wider">
                        <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
                        Tareas Detectadas ({liveActionItems.length})
                      </h5>
                      <span className="text-[10px] text-slate-500">Tiempo Real</span>
                    </div>

                    {liveActionItems.length === 0 ? (
                      <p className="text-[11px] text-slate-500 italic py-4 text-center">
                        La IA ira agregando tareas y responsables automaticamente conforme se acuerden en la llamada...
                      </p>
                    ) : (
                      <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                        {liveActionItems.map((item, i) => (
                          <div key={i} className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-xs flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-slate-200 font-medium leading-snug">{item.task}</p>
                              <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                                <span>👤 {item.assignee || 'Por asignar'}</span>
                                {item.deadline && <span>📅 {item.deadline}</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Panel 2: Decisiones Clave en Vivo */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between min-h-[160px]">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5 uppercase tracking-wider">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Decisiones Clave ({liveDecisions.length})
                      </h5>
                      <span className="text-[10px] text-slate-500">Tiempo Real</span>
                    </div>

                    {liveDecisions.length === 0 ? (
                      <p className="text-[11px] text-slate-500 italic py-4 text-center">
                        Esperando que se pacten decisiones en la conversacion...
                      </p>
                    ) : (
                      <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                        {liveDecisions.map((dec, i) => (
                          <div key={i} className="p-2 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-xs flex items-start gap-2 text-slate-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <span className="leading-snug">{dec}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Panel 3: Consejos Proactivos y Alertas de Riesgo */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between min-h-[140px]">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="text-xs font-bold text-amber-300 flex items-center gap-1.5 uppercase tracking-wider">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                        Consejos Proactivos &amp; Alertas
                      </h5>
                      <span className="text-[10px] text-slate-500">Proactor</span>
                    </div>

                    {liveAdvice.length === 0 ? (
                      <p className="text-[11px] text-slate-500 italic py-3 text-center">
                        Proactor evaluara riesgos y sugerencias estrategicas en los proximos minutos de la reunion...
                      </p>
                    ) : (
                      <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                        {liveAdvice.map((adv, i) => (
                          <div key={i} className="p-2 rounded-lg bg-amber-950/20 border border-amber-500/20 text-xs text-amber-200 flex items-start gap-2">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                            <span className="leading-snug">{adv}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Panel 4: Transcripcion y Resumen en Vivo */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between min-h-[140px]">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="text-xs font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                        <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                        Transcripcion en Vivo
                      </h5>
                      <span className="text-[10px] text-slate-500">Streaming</span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/80 max-h-[160px] overflow-y-auto text-xs text-slate-300 leading-relaxed font-mono">
                      {liveTranscript || liveInterim ? (
                        <>
                          <span>{liveTranscript}</span>
                          {liveInterim && <span className="text-indigo-400 italic"> {liveInterim}</span>}
                        </>
                      ) : (
                        <span className="text-slate-500 italic font-sans">
                          Habla por el microfono... Cada palabra aparecera aqui al instante.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* VISTA 2: SUBIR ARCHIVO DE AUDIO                                     */}
      {/* =================================================================== */}
      {activeTab === 'upload' && (
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700/80 rounded-2xl p-8 hover:border-indigo-500/50 transition-all bg-slate-800/30">
          <Upload className="w-10 h-10 text-indigo-400 mb-3" />
          <h4 className="text-sm font-semibold text-slate-200">Selecciona o arrastra una grabacion</h4>
          <p className="text-xs text-slate-400 mt-1 mb-4 text-center">
            Formatos soportados: MP3, WAV, M4A, WEBM, OGG (hasta 50MB)
          </p>

          <input
            type="file"
            accept="audio/*"
            id="audio-file-input"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setSelectedFile(file);
                if (!meetingTitle) setMeetingTitle(file.name.replace(/\.[^/.]+$/, ''));
              }
            }}
          />

          <label
            htmlFor="audio-file-input"
            className="cursor-pointer px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition-all"
          >
            Examinar Archivo
          </label>

          {selectedFile && (
            <div className="mt-4 p-3 bg-slate-800/80 border border-indigo-500/40 rounded-xl flex items-center justify-between w-full max-w-md">
              <div className="truncate text-xs text-slate-200">
                <span className="font-semibold">{selectedFile.name}</span>
                <span className="text-slate-400 ml-2">({(selectedFile.size / (1024 * 1024)).toFixed(1)} MB)</span>
              </div>
              <button
                onClick={() => processAudioMeeting(selectedFile, selectedFile.name)}
                disabled={loading}
                className="ml-3 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow transition-all shrink-0 flex items-center gap-1.5"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Procesar
              </button>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* VISTA 3: PEGAR TEXTO O MINUTA PREVIA                                */}
      {/* =================================================================== */}
      {activeTab === 'text' && (
        <div className="space-y-4">
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={6}
            placeholder="Pega aqui transcripciones previas, notas desordenadas o apuntes rapidos para que Proactor AI los estructure en minutos ejecutivos, acuerdos y tareas..."
            className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono transition-all"
          />

          <div className="flex justify-end">
            <button
              onClick={processTextMeeting}
              disabled={loading || !rawText.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Estructurar y Generar Minuta
            </button>
          </div>
        </div>
      )}

      {/* Indicador de Carga General */}
      {loading && (
        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center z-30 animate-fade-in p-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 mb-3 animate-pulse">
            <Sparkles className="w-6 h-6 animate-spin" />
          </div>
          <h4 className="text-sm font-bold text-slate-100">Proactor AI Generando Minuta</h4>
          <p className="text-xs text-slate-400 max-w-sm mt-1">
            Sintetizando decisiones clave, asignando responsables a cada tarea y preparando exportacion a Notion...
          </p>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2 text-xs text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}