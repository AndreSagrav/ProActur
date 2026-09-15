import React, { useState, useRef, useEffect } from 'react';
import {
  Mic, Square, Upload, FileText, Loader2, Sparkles, Volume2, AlertCircle,
  CheckCircle2, CheckSquare, Clock, Zap, Brain, ShieldAlert, ArrowRight,
  RotateCcw, ShieldCheck, Trash2
} from 'lucide-react';

import {
  initEmergencyRecording,
  appendAudioChunk,
  checkUnfinalizedRecording,
  recoverUnfinalizedAudio,
  clearEmergencyRecording
} from '../utils/audioStorage';

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

  // Estados de recuperacion de emergencia (Caja Negra IndexedDB)
  const [hasRecoverableAudio, setHasRecoverableAudio] = useState(false);
  const [recoverableSeconds, setRecoverableSeconds] = useState(0);
  const [recovering, setRecovering] = useState(false);

  // Medidor de voz en vivo (Audio Activity Analyzer)
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);

  // Estados del copiloto en tiempo real (Live Proactor AI)
  const [liveTranscript, setLiveTranscript] = useState('');
  const [liveInterim, setLiveInterim] = useState('');
  const [liveDecisions, setLiveDecisions] = useState([]);
  const [liveActionItems, setLiveActionItems] = useState([]);
  const [liveAdvice, setLiveAdvice] = useState([]);
  const [liveSummary, setLiveSummary] = useState('');
  const [isAnalyzingLive, setIsAnalyzingLive] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const recognitionRef = useRef(null);
  const liveAnalysisTimerRef = useRef(null);

  // Referencias mutables para evitar stale closures
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

  // 1. Verificacion de grabaciones no finalizadas en IndexedDB al cargar
  useEffect(() => {
    checkUnfinalizedRecording().then(res => {
      if (res && res.hasUnfinalized) {
        setHasRecoverableAudio(true);
        setRecoverableSeconds(res.chunkCount);
      }
    });
  }, []);

  // 2. Proteccion contra cierre o refresco accidental de pestana (beforeunload)
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isRecording) {
        e.preventDefault();
        e.returnValue = 'Hay una reunion activa grabandose en vivo. Si sales o refrescas se interrumpira la sesion.';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isRecording]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (liveAnalysisTimerRef.current) clearInterval(liveAnalysisTimerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch (_) {}
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (_) {}
      }
    };
  }, []);

  // Configuracion del analizador de volumen de voz en tiempo real
  const setupAudioAnalyzer = (stream) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!stateRef.current.isRecording) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setAudioLevel(normalized);
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (err) {
      console.warn('[AudioContext] No disponible:', err);
    }
  };

  // Reconocimiento de voz continuo en segundo plano
  const initSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

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
          setLiveTranscript(prev => (prev + ' ' + finalChunk.trim()).trim());
        }
        setLiveInterim(interim.trim());
      };

      recognition.onerror = (e) => {
        if (stateRef.current.isRecording && e.error !== 'not-allowed') {
          setTimeout(() => {
            if (stateRef.current.isRecording) {
              try { recognition.start(); } catch (_) {}
            }
          }, 400);
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
      return null;
    }
  };

  // Analisis incremental continuo con Gemini enviando audio nativo
  const triggerLiveAnalysis = async () => {
    const current = stateRef.current;
    if (!current.isRecording || current.isAnalyzing) return;

    const hasAudio = audioChunksRef.current && audioChunksRef.current.length > 0;
    const textToAnalyze = current.transcript.trim();

    if (!hasAudio && textToAnalyze.length < 10) return;

    setIsAnalyzingLive(true);

    try {
      const formData = new FormData();
      formData.append('title', current.title || 'Reunion en Vivo');
      if (textToAnalyze) formData.append('transcript', textToAnalyze);

      if (hasAudio) {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        formData.append('audio', audioBlob, 'live_chunk.webm');
      }

      if (current.actionItems.length > 0 || current.decisions.length > 0) {
        formData.append('previousContext', JSON.stringify({
          actionItems: current.actionItems,
          keyDecisions: current.decisions
        }));
      }

      const res = await fetch(`${API}/api/meetings/live-analyze`, {
        method: 'POST',
        body: formData
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
        if (data.transcript && !current.transcript) {
          setLiveTranscript(data.transcript);
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

      // Inicializar la caja negra en IndexedDB
      await initEmergencyRecording(meetingTitle);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Configurar medidor de voz
      setupAudioAnalyzer(stream);

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
          // Escribir inmediatamente a disco local en IndexedDB cada segundo
          appendAudioChunk(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      // Captura chunks cada 1 segundo (1000ms) para resiliencia total
      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      // Reconocimiento de voz nativo en paralelo
      recognitionRef.current = initSpeechRecognition();

      // Analisis periodico en vivo cada 12 segundos
      liveAnalysisTimerRef.current = setInterval(() => {
        triggerLiveAnalysis();
      }, 12000);

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
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch (_) {}
      }
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
      // 1. Si ya se habia estructurado la minuta en vivo, finalizamos directamente
      if (current.actionItems.length > 0 || current.decisions.length > 0) {
        const res = await fetch(`${API}/api/meetings/live-finalize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: current.title.trim() || `Reunion en Vivo ${new Date().toLocaleDateString('es-ES')}`,
            summary: current.summary || 'Resumen de reunion en vivo',
            keyDecisions: current.decisions,
            actionItems: current.actionItems,
            proactiveAdvice: current.advice,
            transcript: fullTranscript
          })
        });

        if (res.ok) {
          const savedMeeting = await res.json();
          await clearEmergencyRecording();
          setHasRecoverableAudio(false);
          onMeetingProcessed(savedMeeting);
          return;
        }
      }

      // 2. Procesar audio acumulado completo con Gemini
      setTimeout(async () => {
        if (audioChunksRef.current.length > 0) {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          await processAudioMeeting(blob);
          await clearEmergencyRecording();
          setHasRecoverableAudio(false);
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

  // Recuperar grabacion no finalizada tras refresco o apagado
  const handleRecoverUnfinalized = async () => {
    setRecovering(true);
    setError(null);
    try {
      const recovered = await recoverUnfinalizedAudio();
      if (recovered && recovered.blob) {
        await processAudioMeeting(recovered.blob, 'reunion_recuperada.webm');
        await clearEmergencyRecording();
        setHasRecoverableAudio(false);
      } else {
        setError('No se encontro audio util en la caja negra.');
        setHasRecoverableAudio(false);
      }
    } catch (err) {
      setError('Fallo al recuperar la grabacion: ' + err.message);
    } finally {
      setRecovering(false);
    }
  };

  const handleDiscardUnfinalized = async () => {
    await clearEmergencyRecording();
    setHasRecoverableAudio(false);
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

      {/* =================================================================== */}
      {/* BANNER DE RECUPERACION DE EMERGENCIA (CAJA NEGRA)                   */}
      {/* =================================================================== */}
      {hasRecoverableAudio && !isRecording && (
        <div className="mb-5 p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 shadow-lg animate-fade-in flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
              <RotateCcw className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h5 className="text-xs sm:text-sm font-bold text-amber-200">
                Sesion Previa Recuperada en Disco Local
              </h5>
              <p className="text-[11px] text-slate-300">
                Se detectaron {recoverableSeconds} segundos de audio guardados en la caja negra antes del refresco o cierre.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleDiscardUnfinalized}
              className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              Descartar
            </button>
            <button
              onClick={handleRecoverUnfinalized}
              disabled={recovering}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow transition-all"
            >
              {recovering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Recuperar y Procesar Ahora
            </button>
          </div>
        </div>
      )}

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
              <div className="flex items-center gap-1.5 mt-3 text-[10px] text-emerald-400/80 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                <ShieldCheck className="w-3 h-3" />
                <span>Caja Negra Activa: Respaldo continuo en disco contra desconexiones o refrescos</span>
              </div>
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

                {/* Ecualizador de Voz Visual en Vivo */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 rounded-xl border border-slate-800" title="Actividad de microfono en tiempo real">
                  <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                  <div className="flex items-end gap-0.5 h-4 w-12">
                    {[15, 35, 60, 85, 50, 25].map((threshold, idx) => {
                      const isActive = audioLevel >= threshold;
                      return (
                        <span
                          key={idx}
                          className={`flex-1 rounded-full transition-all duration-75 ${
                            isActive ? 'bg-indigo-400' : 'bg-slate-700'
                          }`}
                          style={{ height: isActive ? `${Math.max(25, (audioLevel / 100) * 100)}%` : '20%' }}
                        />
                      );
                    })}
                  </div>
                  <span className="text-[9px] font-mono text-slate-400 ml-1">{audioLevel}%</span>
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

              {/* MINUTA EJECUTIVA ESTRUCTURADA EN TIEMPO REAL (LOS 4 PILARES DE PROACTOR) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Pilar 1: Resumen Ejecutivo en Vivo */}
                <div className="bg-slate-950/70 border border-indigo-500/20 rounded-xl p-4 flex flex-col justify-between min-h-[170px] shadow-sm">
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <h5 className="text-xs font-bold text-indigo-300 flex items-center gap-1.5 uppercase tracking-wider">
                        <FileText className="w-3.5 h-3.5 text-indigo-400" />
                        Resumen Ejecutivo en Vivo
                      </h5>
                      <span className="text-[10px] font-semibold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                        Sintesis en Tiempo Real
                      </span>
                    </div>

                    {liveSummary ? (
                      <p className="text-xs text-slate-200 leading-relaxed max-h-[140px] overflow-y-auto pr-1 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/60">
                        {liveSummary}
                      </p>
                    ) : (
                      <div className="text-center py-6 text-slate-500 text-xs italic">
                        <Sparkles className="w-5 h-5 text-indigo-500/40 mx-auto mb-1 animate-pulse" />
                        Sintetizando puntos clave conforme se discuten...
                      </div>
                    )}
                  </div>
                </div>

                {/* Pilar 2: Decisiones Clave en Vivo */}
                <div className="bg-slate-950/70 border border-emerald-500/20 rounded-xl p-4 flex flex-col justify-between min-h-[170px] shadow-sm">
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <h5 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5 uppercase tracking-wider">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Decisiones Clave ({liveDecisions.length})
                      </h5>
                      <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        Acuerdos en Vivo
                      </span>
                    </div>

                    {liveDecisions.length === 0 ? (
                      <div className="text-center py-6 text-slate-500 text-xs italic">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500/40 mx-auto mb-1 animate-pulse" />
                        Esperando acuerdos y decisiones en la sesion...
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                        {liveDecisions.map((dec, i) => (
                          <div key={i} className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/25 text-xs flex items-start gap-2 text-slate-200">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                            <span className="leading-snug font-medium">{dec}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Pilar 3: Compromisos y Tareas (Action Items) */}
                <div className="bg-slate-950/70 border border-blue-500/20 rounded-xl p-4 flex flex-col justify-between min-h-[170px] shadow-sm">
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <h5 className="text-xs font-bold text-blue-300 flex items-center gap-1.5 uppercase tracking-wider">
                        <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
                        Compromisos y Tareas ({liveActionItems.length})
                      </h5>
                      <span className="text-[10px] font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                        Responsables y Fechas
                      </span>
                    </div>

                    {liveActionItems.length === 0 ? (
                      <div className="text-center py-6 text-slate-500 text-xs italic">
                        <CheckSquare className="w-5 h-5 text-blue-500/40 mx-auto mb-1 animate-pulse" />
                        Detectando compromisos y asignando responsables en vivo...
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                        {liveActionItems.map((item, i) => (
                          <div key={i} className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs flex items-start gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-slate-200 font-semibold leading-snug">{item.task}</p>
                              <div className="flex items-center flex-wrap gap-2 mt-1 text-[10px] text-slate-400">
                                <span className="bg-slate-800 px-1.5 py-0.5 rounded text-indigo-300 font-medium">?? {item.assignee || 'Por asignar'}</span>
                                {item.deadline && <span className="bg-slate-800 px-1.5 py-0.5 rounded text-amber-300 font-medium">?? {item.deadline}</span>}
                                {item.priority && (
                                  <span className="px-1.5 py-0.5 rounded font-bold bg-slate-800 text-indigo-300">
                                    {item.priority}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Pilar 4: Consejos Proactivos y Alertas de Riesgo */}
                <div className="bg-slate-950/70 border border-amber-500/20 rounded-xl p-4 flex flex-col justify-between min-h-[170px] shadow-sm">
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <h5 className="text-xs font-bold text-amber-300 flex items-center gap-1.5 uppercase tracking-wider">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                        Consejos Proactivos &amp; Alertas
                      </h5>
                      <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                        Estrategico
                      </span>
                    </div>

                    {liveAdvice.length === 0 ? (
                      <div className="text-center py-6 text-slate-500 text-xs italic">
                        <ShieldAlert className="w-5 h-5 text-amber-500/40 mx-auto mb-1 animate-pulse" />
                        Proactor evalua riesgos y recomendaciones estrategicas durante la charla...
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                        {liveAdvice.map((adv, i) => (
                          <div key={i} className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/25 text-xs text-amber-200 flex items-start gap-2">
                            <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <span className="leading-snug">{adv}</span>
                          </div>
                        ))}
                      </div>
                    )}
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
            Sintetizando decisiones clave, asignando responsables a cada tarea y preparando tareas y acuerdos para tu libreta...
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
