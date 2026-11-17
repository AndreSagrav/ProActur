import React, { useState, useRef, useEffect } from 'react';
import HandwritingCanvas from './HandwritingCanvas';
import {
  Mic, Square, Upload, FileText, Loader2, Sparkles, Volume2, AlertCircle,
  CheckCircle2, CheckSquare, Clock, Zap, Brain, ShieldAlert, ArrowRight,
  RotateCcw, ShieldCheck, Trash2, PenTool, Keyboard, BookOpen
} from 'lucide-react';

import {
  initEmergencyRecording,
  appendAudioChunk,
  saveLiveSessionSnapshot,
  checkUnfinalizedRecording,
  recoverUnfinalizedAudio,
  clearEmergencyRecording
} from '../utils/audioStorage';

const API = import.meta.env.VITE_API_URL || '';

// Detección de dispositivo móvil para optimizaciones de audio
const isMobileDevice = () => {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || (window.innerWidth <= 768);
};

function getSupportedAudioMimeType() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return 'audio/webm';
  }
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus'
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return 'audio/webm';
}

function normalizeKey(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function mergeUniqueTextArrays(prevArr = [], nextArr = []) {
  const out = [];
  const seen = new Set();
  for (const item of [...(Array.isArray(prevArr) ? prevArr : []), ...(Array.isArray(nextArr) ? nextArr : [])]) {
    if (typeof item !== 'string') continue;
    const t = item.trim();
    if (!t) continue;
    const k = normalizeKey(t);
    if (k && !seen.has(k)) {
      seen.add(k);
      out.push(t);
    }
  }
  return out;
}

function mergeUniqueActionItems(prevArr = [], nextArr = []) {
  const out = [];
  const seen = new Set();
  for (const raw of [...(Array.isArray(prevArr) ? prevArr : []), ...(Array.isArray(nextArr) ? nextArr : [])]) {
    if (!raw) continue;
    const item = typeof raw === 'string'
      ? { task: raw, assignee: 'Por asignar', priority: 'Alta', deadline: 'Pendiente', completed: false }
      : raw;
    const taskText = String(item.task || item.text || item.title || '').trim();
    if (!taskText) continue;
    const k = normalizeKey(taskText);
    if (k && !seen.has(k)) {
      seen.add(k);
      out.push({ ...item, task: taskText });
    }
  }
  return out;
}

function appendTranscriptSafely(base, delta) {
  const b = (base || '').trim();
  const d = (delta || '').trim();
  if (!d) return b;
  if (!b) return d;
  const tailNorm = normalizeKey(b.slice(-Math.max(d.length + 25, 90)));
  const deltaNorm = normalizeKey(d);
  if (deltaNorm && tailNorm.includes(deltaNorm)) return b;
  return `${b} ${d}`.trim();
}

// Genera un archivo WAV RIFF PCM 16-bit mono estándar a partir de muestras float (-1.0 a 1.0)
function encodePcmToWav(samples, sampleRate = 16000) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF header
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + samples.length * 2, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"

  // fmt sub-chunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, 1, true); // NumChannels (1 = Mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample

  // data sub-chunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, samples.length * 2, true);

  // Muestras PCM 16-bit con clamping
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  return buffer;
}

export default function AudioRecorder({ onMeetingProcessed, onRecordingStatusChange, externalNotebookNotes, recorderRef, onOpenNotebook }) {
  const [activeTab, setActiveTab] = useState('record'); // 'record' | 'upload' | 'text'
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [rawText, setRawText] = useState('');
  const [meetingTitle, setMeetingTitle] = useState('');
  const userEditedTitleRef = useRef(false);
  const liveAiTitleRef = useRef('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Estados de recuperacion de emergencia (Caja Negra IndexedDB)
  const [hasRecoverableAudio, setHasRecoverableAudio] = useState(false);
  const [recoverableSeconds, setRecoverableSeconds] = useState(0);
  const [recovering, setRecovering] = useState(false);

  // Medidor de voz en vivo y selector de micrófono (Audio Activity Analyzer)
  const [audioLevel, setAudioLevel] = useState(0);
  const [audioInputDevices, setAudioInputDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [zeroMicWarning, setZeroMicWarning] = useState(false);
  const zeroAudioSecondsRef = useRef(0);
  const audioLevelRef = useRef(0);
  const isRecordingRef = useRef(false);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);

  // Estados del copiloto en tiempo real (Live ProActur AI)
  const [liveTranscript, setLiveTranscript] = useState('');
  const [liveInterim, setLiveInterim] = useState('');
  const [liveTopics, setLiveTopics] = useState([]);
  const [liveDecisions, setLiveDecisions] = useState([]);
  const [liveActionItems, setLiveActionItems] = useState([]);
  const [liveAdvice, setLiveAdvice] = useState([]);
  const [userLiveNotes, setUserLiveNotes] = useState('');
  const [liveNotesMode, setLiveNotesMode] = useState('keyboard'); // 'keyboard' | 'pencil'
  const [liveNotesStrokes, setLiveNotesStrokes] = useState([]);
  const [liveStatusMessage, setLiveStatusMessage] = useState('');
  const [activeLiveTab, setActiveLiveTab] = useState('notes'); // 'notes' | 'transcript' | 'chat'
  const [liveChatMessages, setLiveChatMessages] = useState([
    { role: 'assistant', text: '¡Hola! Estoy grabando y tomando notas del seminario/reunión en tiempo real. Puedes preguntarme cualquier cosa sobre lo dicho hasta este instante sin cortar la grabación.' }
  ]);
  const [liveChatInput, setLiveChatInput] = useState('');
  const [liveChatLoading, setLiveChatLoading] = useState(false);
  const [liveSummary, setLiveSummary] = useState('');
  const [isAnalyzingLive, setIsAnalyzingLive] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const workerTimerRef = useRef(null);
  const recognitionRef = useRef(null);
  const liveAnalysisTimerRef = useRef(null);
  const silenceOscRef = useRef(null);
  const scriptNodeRef = useRef(null);
  const activeStreamRef = useRef(null);
  const pcmBufferRef = useRef([]);
  const pcmSampleCountRef = useRef(0);
  const silentAudioRef = useRef(null);
  const wakeLockRef = useRef(null);
  const startTimeRef = useRef(null);

  // Refs incrementales anti-stale-closure para sesiones de 8+ horas
  const sessionMeetingIdRef = useRef(null);
  const sessionCreatedAtRef = useRef(null);
  const fullTranscriptRef = useRef('');
  const speechDeltaRef = useRef('');
  const lastLiveAnalysisTimeRef = useRef(0);
  const lastCheckpointTimeRef = useRef(0);
  const isAnalyzingRef = useRef(false);
  const externalNotesRef = useRef(externalNotebookNotes || '');

  useEffect(() => {
    externalNotesRef.current = typeof externalNotebookNotes === 'string' ? externalNotebookNotes : '';
  }, [externalNotebookNotes]);

  // Referencias mutables para evitar stale closures
  const stateRef = useRef({
    transcript: '',
    userNotes: '',
    topics: [],
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
      transcript: fullTranscriptRef.current || liveTranscript,
      userNotes: userLiveNotes,
      topics: liveTopics,
      decisions: liveDecisions,
      actionItems: liveActionItems,
      advice: liveAdvice,
      summary: liveSummary,
      title: meetingTitle,
      isRecording,
      isAnalyzing: isAnalyzingLive
    };
  }, [liveTranscript, userLiveNotes, liveTopics, liveDecisions, liveActionItems, liveAdvice, liveSummary, meetingTitle, isRecording, isAnalyzingLive]);

  // Sincronización continua de estado con la aplicación y Dynamic Island
  useEffect(() => {
    if (recorderRef) {
      recorderRef.current = {
        startRecording: startRecording,
        stopAndFinalize: stopAndFinalizeRecording,
        triggerAnalysis: triggerLiveAnalysis
      };
    }
  });

  useEffect(() => {
    if (onRecordingStatusChange) {
      onRecordingStatusChange({
        isRecording,
        recordingTime,
        audioLevel,
        decisionsCount: liveDecisions.length,
        actionItemsCount: liveActionItems.length,
        title: meetingTitle || 'Reunión en vivo',
        stopAndFinalize: stopAndFinalizeRecording
      });
    }
  }, [isRecording, recordingTime, audioLevel, liveDecisions.length, liveActionItems.length, meetingTitle]);

  // 1. Verificacion de grabaciones no finalizadas en IndexedDB al cargar
  useEffect(() => {
    checkUnfinalizedRecording().then(res => {
      if (res && res.hasUnfinalized) {
        setHasRecoverableAudio(true);
        const mins = res.snapshot?.transcript
          ? `${res.snapshot.transcript.split(/\s+/).filter(Boolean).length} palabras`
          : `${res.chunkCount} segundos de audio`;
        setRecoverableSeconds(mins);
      }
    });
  }, []);

  // 2. Proteccion contra cierre o refresco accidental de pestana (beforeunload)
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isRecordingRef.current) {
        e.preventDefault();
        e.returnValue = 'Hay una reunion activa grabandose en vivo. Si sales o refrescas se interrumpira la sesion.';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // 2b. Re-adquisición de WakeLock y AudioContext cuando el usuario regresa a la pestaña (minimizado/cambio de pestaña)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isRecordingRef.current) {
        try {
          if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
          }
          if (silentAudioRef.current && silentAudioRef.current.paused) {
            silentAudioRef.current.play().catch(() => {});
          }
          if ('wakeLock' in navigator && !wakeLockRef.current) {
            navigator.wakeLock.request('screen').then(lock => {
              wakeLockRef.current = lock;
              lock.addEventListener?.('release', () => { wakeLockRef.current = null; });
            }).catch(() => {});
          }
        } catch (_) {}
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // 3. Resiliencia de red: auto-pausa y auto-reanudación de análisis ante cortes de internet
  useEffect(() => {
    const handleOnline = () => {
      console.log('[ProActur Network] Conexión restablecida.');
      if (isRecordingRef.current) {
        setLiveStatusMessage('⚡ Internet restablecido. Reanudando análisis en vivo con la IA...');
        setTimeout(() => {
          if (isRecordingRef.current) {
            triggerLiveAnalysis();
          }
        }, 1200);
      }
    };

    const handleOffline = () => {
      console.warn('[ProActur Network] Pérdida de conexión a internet.');
      if (isRecordingRef.current) {
        setLiveStatusMessage('📡 Sin internet: Grabación y transcripción locales activas. Se sincronizará al reconectar.');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);


  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (liveAnalysisTimerRef.current) clearInterval(liveAnalysisTimerRef.current);
      if (workerTimerRef.current) {
        try { workerTimerRef.current.terminate(); } catch (_) {}
      }
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch (_) {}
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (_) {}
      }
    };
  }, []);

  // Medidor de voz en vivo de alta precisión (Peak + RMS TimeDomain)
  const setupAudioAnalyzer = async (stream) => {
    try {
      let audioCtx = audioContextRef.current;
      if (!audioCtx || audioCtx.state === 'closed') {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;
      }

      if (audioCtx.state === 'suspended') {
        try { await audioCtx.resume(); } catch (_) {}
      }

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.2; // Respuesta dinámica inmediata
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      // 1. Mantener AudioContext y subprocesos activos en segundo plano (pestañas minimizadas)
      try {
        if (!silenceOscRef.current) {
          const osc = audioCtx.createOscillator();
          const silentGain = audioCtx.createGain();
          silentGain.gain.value = 0.00001; // Inaudible pero activo en el subsistema de audio
          osc.connect(silentGain);
          silentGain.connect(audioCtx.destination);
          osc.start();
          silenceOscRef.current = osc;
        }
      } catch (oscErr) {
        console.warn('[AudioContext] Keep-alive osc error:', oscErr);
      }

      // 2. Buffer circular de audio PCM directo a 16kHz para transcripción Whisper/Gemini sin corrupción WebM
      try {
        if (scriptNodeRef.current) {
          try { scriptNodeRef.current.disconnect(); } catch (_) {}
          scriptNodeRef.current = null;
        }
        const scriptNode = audioCtx.createScriptProcessor(4096, 1, 1);
        const targetRate = 16000;
        const sourceRate = audioCtx.sampleRate || 44100;
        const downsampleRatio = sourceRate / targetRate;

        // Capacidad máxima en cola: 35 segundos a 16kHz (seguro para payload < 4.5MB de Vercel)
        const maxSamples = 16000 * 35;

        scriptNode.onaudioprocess = (audioEvent) => {
          if (!isRecordingRef.current) return;
          const inputData = audioEvent.inputBuffer.getChannelData(0);
          const newLength = Math.floor(inputData.length / downsampleRatio);
          const downsampled = new Float32Array(newLength);
          for (let i = 0; i < newLength; i++) {
            downsampled[i] = inputData[Math.floor(i * downsampleRatio)];
          }

          pcmBufferRef.current.push(downsampled);
          pcmSampleCountRef.current += newLength;

          while (pcmSampleCountRef.current > maxSamples && pcmBufferRef.current.length > 1) {
            const removed = pcmBufferRef.current.shift();
            pcmSampleCountRef.current -= removed.length;
          }
        };

        source.connect(scriptNode);
        const zeroGain = audioCtx.createGain();
        zeroGain.gain.value = 0;
        scriptNode.connect(zeroGain);
        zeroGain.connect(audioCtx.destination);
        scriptNodeRef.current = scriptNode;
      } catch (pcmErr) {
        console.warn('[AudioContext] PCM ScriptProcessor error:', pcmErr);
      }

      const timeData = new Uint8Array(analyser.fftSize);
      const freqData = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!isRecordingRef.current) return;

        // 1. Amplitud pico y RMS directa de la onda (inmune a artefactos de frecuencia)
        analyser.getByteTimeDomainData(timeData);
        let maxPeak = 0;
        let sumSq = 0;
        for (let i = 0; i < timeData.length; i++) {
          const val = Math.abs(timeData[i] - 128); // 0 a 128
          if (val > maxPeak) maxPeak = val;
          sumSq += val * val;
        }
        const rms = Math.sqrt(sumSq / timeData.length); // 0 a 128

        // 2. Energía vocal (primeras bandas 0-3500 Hz)
        analyser.getByteFrequencyData(freqData);
        let vocalSum = 0;
        const vocalBins = Math.min(30, freqData.length);
        for (let i = 0; i < vocalBins; i++) {
          vocalSum += freqData[i];
        }
        const vocalAvg = vocalSum / vocalBins; // 0 a 255

        // Ponderación: Amplitud de pico (70%) + RMS (30%)
        const peakLevel = (maxPeak / 128) * 100;
        const rmsLevel = (rms / 64) * 100;
        const freqLevel = (vocalAvg / 180) * 100;

        let calculated = Math.max(peakLevel * 1.6, rmsLevel * 1.4, freqLevel * 1.2);

        // Umbral de compuerta de ruido
        if (calculated < 4) {
          calculated = 0;
        }

        const normalized = Math.min(100, Math.round(calculated));
        audioLevelRef.current = normalized;
        if (normalized > 0) {
          zeroAudioSecondsRef.current = 0;
        }
        setAudioLevel(normalized);

        animFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (err) {
      console.warn('[AudioContext] Error en setupAudioAnalyzer:', err);
    }
  };

  // Reconocimiento de voz continuo y autorenovable (evita límite 5 min de Chromium)
  const initSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[ProActur] SpeechRecognition no disponible en este navegador/WebView. Se usará Whisper del servidor.');
      return null;
    }

    const startRecognitionInstance = () => {
      if (!isRecordingRef.current) return null;
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
            const cleanChunk = finalChunk.trim();
            speechDeltaRef.current = (speechDeltaRef.current + ' ' + cleanChunk).trim();
            const updatedFull = appendTranscriptSafely(fullTranscriptRef.current, cleanChunk);
            fullTranscriptRef.current = updatedFull;
            setLiveTranscript(updatedFull);
          }
          setLiveInterim(interim.trim());
        };

        recognition.onerror = (e) => {
          if (isRecordingRef.current && e.error !== 'not-allowed') {
            setTimeout(() => {
              if (isRecordingRef.current) {
                recognitionRef.current = startRecognitionInstance();
              }
            }, 300);
          }
        };

        recognition.onend = () => {
          // Re-instanciar automáticamente cuando Chromium finalice la sesión (ej. límite 5 min o silencio)
          if (isRecordingRef.current) {
            setTimeout(() => {
              if (isRecordingRef.current) {
                recognitionRef.current = startRecognitionInstance();
              }
            }, 250);
          }
        };

        recognition.start();
        return recognition;
      } catch (err) {
        console.warn('[SpeechRecognition Start Err]', err);
        return null;
      }
    };

    return startRecognitionInstance();
  };

  // Persistir snapshot local y checkpoint en Supabase cada ~30s sin detener la sesión
  const syncLiveCheckpoint = async (snapshotData, forceCloud = false) => {
    try {
      await saveLiveSessionSnapshot(snapshotData);
    } catch (_) {}

    const now = Date.now();
    if (!forceCloud && (now - lastCheckpointTimeRef.current < 28000)) return;
    if (!navigator.onLine || !snapshotData?.id) return;

    lastCheckpointTimeRef.current = now;
    try {
      const res = await fetch(`${API}/api/meetings/live-checkpoint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshotData)
      });
      if (res.ok) {
        const words = (snapshotData.transcript || '').split(/\s+/).filter(Boolean).length;
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLiveStatusMessage(`☁️ Guardado en nube y disco (${timeStr}) • ${words} palabras`);
      }
    } catch (_) {}
  };

  // Analisis incremental continuo enviando nuevo bloque de audio + delta de texto y acumulando notas
  const triggerLiveAnalysis = async (explicitNotes = null, forceFlush = false) => {
    const current = stateRef.current;
    if ((!isRecordingRef.current && !forceFlush) || isAnalyzingRef.current) return;

    const externalNotes = externalNotesRef.current || '';
    const internalNotes = typeof explicitNotes === 'string' ? explicitNotes : (current.userNotes || '');
    const userNotesText = [internalNotes, externalNotes].filter(Boolean).join('\n\n').trim();
    const currentFullTranscript = fullTranscriptRef.current || current.transcript || '';
    const speechDelta = speechDeltaRef.current.trim();

    // Extraer atómicamente los fragmentos PCM acumulados desde el último envío (sin perder audio si tarda)
    let drainedChunks = [];
    let drainedSamples = 0;
    if (pcmBufferRef.current && pcmBufferRef.current.length > 0 && pcmSampleCountRef.current > (forceFlush ? 4000 : 8000)) {
      drainedChunks = pcmBufferRef.current;
      drainedSamples = pcmSampleCountRef.current;
      pcmBufferRef.current = [];
      pcmSampleCountRef.current = 0;
    }

    const hasPcmAudio = drainedSamples > 0;
    const hasWebmFallback = !hasPcmAudio && audioChunksRef.current && audioChunksRef.current.length > 0;

    if (!navigator.onLine) {
      // Re-encolar PCM si estamos offline y guardar snapshot local
      if (hasPcmAudio) {
        pcmBufferRef.current = [...drainedChunks, ...pcmBufferRef.current];
        pcmSampleCountRef.current += drainedSamples;
      }
      await saveLiveSessionSnapshot({
        id: sessionMeetingIdRef.current,
        title: current.title || 'Reunión en Vivo',
        summary: current.summary,
        keyTopics: current.topics,
        keyDecisions: current.decisions,
        actionItems: current.actionItems,
        proactiveAdvice: current.advice,
        transcript: currentFullTranscript,
        userNotes: userNotesText,
        createdAt: sessionCreatedAtRef.current
      });
      setLiveStatusMessage('📡 Sin internet: Transcripción y notas seguras en disco local. Esperando red...');
      return;
    }

    if (!hasPcmAudio && !hasWebmFallback && speechDelta.length < 3 && currentFullTranscript.length < 3 && userNotesText.length < 3) {
      setLiveStatusMessage('🎙️ Escuchando... habla al micrófono o escribe notas para generar apuntes.');
      return;
    }

    isAnalyzingRef.current = true;
    setIsAnalyzingLive(true);
    setLiveStatusMessage('⚡ Transcribiendo y actualizando notas...');

    // Limpiar delta solo al enviarlo (si falla, se restaura en catch)
    if (speechDelta) {
      speechDeltaRef.current = '';
    }

    const controller = new AbortController();
    const timeoutMs = 20000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const payload = {
        title: current.title || 'Reunión en Vivo',
        transcript: currentFullTranscript.slice(-12000),
        newTranscriptChunk: speechDelta,
        userNotes: userNotesText,
        previousContext: {
          title: current.title,
          summary: current.summary,
          keyTopics: current.topics,
          keyDecisions: current.decisions,
          actionItems: current.actionItems,
          proactiveAdvice: current.advice
        }
      };

      if (hasPcmAudio) {
        try {
          const flatSamples = new Float32Array(drainedSamples);
          let offset = 0;
          for (const chunk of drainedChunks) {
            flatSamples.set(chunk, offset);
            offset += chunk.length;
          }
          const wavBuffer = encodePcmToWav(flatSamples, 16000);
          const bytes = new Uint8Array(wavBuffer);
          let binary = '';
          const chunkSize = 8192;
          for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
          }
          payload.audioBase64 = btoa(binary);
          payload.audioMimeType = 'audio/wav';
        } catch (packErr) {
          console.warn('[PCM WAV Packing Warn]:', packErr.message);
        }
      } else if (hasWebmFallback && currentFullTranscript.length < 20) {
        try {
          const recordedMime = mediaRecorderRef.current?.mimeType || getSupportedAudioMimeType();
          const recentChunks = audioChunksRef.current.slice(-12);
          const smallBlob = new Blob(recentChunks, { type: recordedMime });
          if (smallBlob.size > 500 && smallBlob.size < 2500000) {
            const arrayBuf = await smallBlob.arrayBuffer();
            const bytes = new Uint8Array(arrayBuf);
            let binary = '';
            const chunkSize = 8192;
            for (let i = 0; i < bytes.length; i += chunkSize) {
              binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
            }
            payload.audioBase64 = btoa(binary);
            payload.audioMimeType = recordedMime;
          }
        } catch (packErr) {
          console.warn('[Audio Fallback Packing Warn]:', packErr.message);
        }
      }

      const res = await fetch(`${API}/api/meetings/live-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      const data = await res.json();

      let nextTitle = current.title;
      if (data.title && typeof data.title === 'string' && data.title.trim().length > 3) {
        liveAiTitleRef.current = data.title.trim();
        if (!userEditedTitleRef.current) {
          nextTitle = data.title.trim();
          setMeetingTitle(nextTitle);
        }
      }

      // Integrar transcripción nueva sin perder nunca la historia acumulada del día
      let updatedTranscript = fullTranscriptRef.current;
      if (data.lastChunkTranscript && data.lastChunkTranscript.trim()) {
        updatedTranscript = appendTranscriptSafely(updatedTranscript, data.lastChunkTranscript);
      } else if (data.transcript && data.transcript.length > updatedTranscript.length) {
        updatedTranscript = data.transcript;
      }
      if (updatedTranscript !== fullTranscriptRef.current) {
        fullTranscriptRef.current = updatedTranscript;
        setLiveTranscript(updatedTranscript);
      }

      const nextSummary = (data.summary && data.summary.trim().length > 15) ? data.summary.trim() : current.summary;
      const nextTopics = mergeUniqueTextArrays(current.topics, data.keyTopics);
      const nextDecisions = mergeUniqueTextArrays(current.decisions, data.keyDecisions);
      const nextActions = mergeUniqueActionItems(current.actionItems, data.actionItems);
      const nextAdvice = mergeUniqueTextArrays(current.advice, data.proactiveAdvice);

      if (nextSummary) setLiveSummary(nextSummary);
      setLiveTopics(nextTopics);
      setLiveDecisions(nextDecisions);
      setLiveActionItems(nextActions);
      setLiveAdvice(nextAdvice);

      // Actualizar stateRef síncronamente para el siguiente tick inmediato
      stateRef.current = {
        ...stateRef.current,
        title: nextTitle,
        transcript: updatedTranscript,
        summary: nextSummary,
        topics: nextTopics,
        decisions: nextDecisions,
        actionItems: nextActions,
        advice: nextAdvice
      };

      const wordsCount = updatedTranscript.split(/\s+/).filter(Boolean).length;
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLiveStatusMessage(`✓ Notas al día (${timeStr}) • ${wordsCount} palabras transcritas`);

      // Respaldar en IndexedDB y periódicamente en Supabase
      await syncLiveCheckpoint({
        id: sessionMeetingIdRef.current,
        title: nextTitle || 'Sesión en Vivo',
        summary: nextSummary,
        keyTopics: nextTopics,
        keyDecisions: nextDecisions,
        actionItems: nextActions,
        proactiveAdvice: nextAdvice,
        transcript: updatedTranscript,
        userNotes: userNotesText,
        createdAt: sessionCreatedAtRef.current
      }, forceFlush);
    } catch (err) {
      // Si falló la red o timeout, re-encolar el audio PCM para reintentar en el próximo ciclo (hasta tope 35s)
      if (hasPcmAudio && pcmSampleCountRef.current < 16000 * 20) {
        pcmBufferRef.current = [...drainedChunks, ...pcmBufferRef.current];
        pcmSampleCountRef.current += drainedSamples;
      }
      if (speechDelta) {
        speechDeltaRef.current = (speechDelta + ' ' + speechDeltaRef.current).trim();
      }
      if (err.name === 'AbortError') {
        console.warn('[Live Analysis] Request timeout, reintentando en el siguiente ciclo...');
        setLiveStatusMessage('⚡ Red lenta: reintentando envío de bloque...');
      } else {
        console.warn('[Live Analysis Warn]', err.message);
        setLiveStatusMessage(`⚠️ ${err.message} (audio respaldado en disco)`);
      }
    } finally {
      clearTimeout(timeoutId);
      isAnalyzingRef.current = false;
      setIsAnalyzingLive(false);
    }
  };

  // Crea e inicia la captura sobre un MediaStream (permite auto-recuperación si el SO corta el track)
  const attachRecorderToStream = (stream, analysisIntervalMs) => {
    activeStreamRef.current = stream;
    setupAudioAnalyzer(stream);

    const preferredMime = getSupportedAudioMimeType();
    let mediaRecorder;
    try {
      mediaRecorder = new MediaRecorder(stream, { mimeType: preferredMime });
    } catch (_) {
      mediaRecorder = new MediaRecorder(stream);
    }
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        // Ventana rodante de 30s en RAM para evitar consumo excesivo de memoria en jornadas de 8-12h
        audioChunksRef.current.push(e.data);
        if (audioChunksRef.current.length > 30) {
          audioChunksRef.current.shift();
        }
        appendAudioChunk(e.data);
      }

      // Impulso desde el hardware de audio: NO sufre throttling cuando Chrome/Edge está minimizado
      if (isRecordingRef.current && startTimeRef.current) {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setRecordingTime(elapsed);

        if (
          Date.now() - lastLiveAnalysisTimeRef.current >= analysisIntervalMs &&
          !isAnalyzingRef.current
        ) {
          lastLiveAnalysisTimeRef.current = Date.now();
          triggerLiveAnalysis();
        }
      }
    };

    mediaRecorder.onstop = () => {
      const actualMime = mediaRecorder.mimeType || preferredMime || 'audio/webm';
      if (audioChunksRef.current.length > 0) {
        setAudioBlob(new Blob(audioChunksRef.current, { type: actualMime }));
      }
      stream.getTracks().forEach(track => track.stop());
    };

    // Auto-recuperación si el sistema operativo o driver cierra el micrófono inesperadamente
    stream.getAudioTracks().forEach(track => {
      track.onended = async () => {
        console.warn('[AudioTrack] Track finalizado por el sistema.');
        if (isRecordingRef.current) {
          setLiveStatusMessage('🔄 Reconectando micrófono automáticamente...');
          try {
            const newStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (isRecordingRef.current) {
              attachRecorderToStream(newStream, analysisIntervalMs);
              setLiveStatusMessage('✓ Micrófono reconectado. Grabación continua activa.');
            }
          } catch (recErr) {
            console.error('[AudioTrack Recovery Err]', recErr);
            setLiveStatusMessage('⚠️ El sistema cerró el micrófono. Verifica permisos.');
          }
        }
      };
      track.onmute = () => console.warn('[AudioTrack] Micrófono silenciado temporalmente por el SO');
      track.onunmute = () => console.log('[AudioTrack] Micrófono desilenciado por el SO');
    });

    mediaRecorder.onerror = (e) => console.warn('[MediaRecorder Error]', e);
    mediaRecorder.start(1000);
  };

  const startRecording = async () => {
    // ACTIVACIÓN SÍNCRONA DE AUDIO EN EL GESTO DEL USUARIO (Crítico para Android / WebView)
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
          audioContextRef.current = new AudioCtx();
        }
        if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume();
        }
      }
    } catch (e) {
      console.warn('[AudioContext Sync Init]', e);
    }

    try {
      setError(null);
      setLiveTranscript('');
      setLiveInterim('');
      setLiveTopics([]);
      setLiveDecisions([]);
      setLiveActionItems([]);
      setLiveAdvice([]);
      setLiveSummary('');
      setLiveChatMessages([
        { role: 'assistant', text: '¡Hola! Estoy grabando y tomando notas del seminario/reunión en tiempo real. Puedes preguntarme cualquier cosa sobre lo dicho hasta este instante sin cortar la grabación.' }
      ]);

      const newSessionId = 'meet_live_' + Date.now();
      sessionMeetingIdRef.current = newSessionId;
      sessionCreatedAtRef.current = new Date().toISOString();
      fullTranscriptRef.current = '';
      speechDeltaRef.current = '';
      pcmBufferRef.current = [];
      pcmSampleCountRef.current = 0;
      audioChunksRef.current = [];
      lastLiveAnalysisTimeRef.current = Date.now();
      lastCheckpointTimeRef.current = 0;

      // Inicializar la caja negra en IndexedDB
      await initEmergencyRecording(meetingTitle, newSessionId);

      // Solicitar micrófono con constraints optimizadas
      const mobile = isMobileDevice();
      const buildAudioConstraints = (devId = selectedDeviceId) => {
        const base = mobile
          ? {
              echoCancellation: true,
              noiseSuppression: false,
              autoGainControl: true
            }
          : {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: 44100
            };
        if (devId) {
          base.deviceId = { exact: devId };
        }
        return base;
      };

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: buildAudioConstraints() });
      } catch (micErr) {
        console.warn('[ProActur Mic] Reintentando con constraint básica:', micErr.message);
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      // Listar micrófonos disponibles con etiqueta real una vez concedido el permiso
      try {
        const devs = await navigator.mediaDevices.enumerateDevices();
        const inputs = devs.filter(d => d.kind === 'audioinput');
        setAudioInputDevices(inputs);
        const activeTrack = stream.getAudioTracks()[0];
        const currentSettings = activeTrack?.getSettings?.();
        if (currentSettings?.deviceId && !selectedDeviceId) {
          setSelectedDeviceId(currentSettings.deviceId);
        }
      } catch (_) {}

      zeroAudioSecondsRef.current = 0;
      setZeroMicWarning(false);
      isRecordingRef.current = true;
      setIsRecording(true);
      setRecordingTime(0);
      startTimeRef.current = Date.now();

      const analysisIntervalMs = mobile ? 15000 : 12000;
      attachRecorderToStream(stream, analysisIntervalMs);

      // Web Worker timer inmune al throttling de pestañas en segundo plano / ventana minimizada
      try {
        if (workerTimerRef.current) workerTimerRef.current.terminate();
        const workerBlob = new Blob([
          'setInterval(() => { postMessage("tick"); }, 1000);'
        ], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(workerBlob);
        const worker = new Worker(workerUrl);
        URL.revokeObjectURL(workerUrl);
        worker.onmessage = () => {
          if (!isRecordingRef.current || !startTimeRef.current) return;
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setRecordingTime(elapsed);

          if (audioLevelRef.current === 0) {
            zeroAudioSecondsRef.current += 1;
            if (zeroAudioSecondsRef.current >= 10) setZeroMicWarning(true);
          } else {
            zeroAudioSecondsRef.current = 0;
            setZeroMicWarning(false);
          }

          if (
            Date.now() - lastLiveAnalysisTimeRef.current >= analysisIntervalMs &&
            !isAnalyzingRef.current
          ) {
            lastLiveAnalysisTimeRef.current = Date.now();
            triggerLiveAnalysis();
          }
        };
        workerTimerRef.current = worker;
      } catch (wErr) {
        console.warn('[WebWorker Timer Warn]', wErr);
        timerRef.current = setInterval(() => {
          if (startTimeRef.current) {
            setRecordingTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
          }
        }, 1000);
      }

      // 1. Silent Audio Loop en elemento HTML5 (mantiene el proceso de audio vivo en segundo plano)
      try {
        const silentBuffer = encodePcmToWav(new Float32Array(16000), 16000);
        const silentBlob = new Blob([silentBuffer], { type: 'audio/wav' });
        const silentUrl = URL.createObjectURL(silentBlob);
        const audioEl = new Audio(silentUrl);
        audioEl.loop = true;
        audioEl.volume = 0.001;
        audioEl.play().catch(() => {});
        silentAudioRef.current = audioEl;
      } catch (sErr) {
        console.warn('[SilentAudio KeepAlive Warn]', sErr);
      }

      // 2. MediaSession API
      try {
        if ('mediaSession' in navigator) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: meetingTitle || 'ProActur AI - Grabando Sesión',
            artist: 'Grabación continua y notas en vivo',
            album: 'ProActur AI'
          });
          navigator.mediaSession.playbackState = 'playing';
        }
      } catch (_) {}

      // 3. Screen Wake Lock API con re-adquisición
      try {
        if ('wakeLock' in navigator) {
          navigator.wakeLock.request('screen').then(lock => {
            wakeLockRef.current = lock;
            lock.addEventListener?.('release', () => { wakeLockRef.current = null; });
          }).catch(() => {});
        }
      } catch (_) {}

      // Reconocimiento de voz nativo en paralelo
      recognitionRef.current = initSpeechRecognition();
      setLiveStatusMessage('🎙️ Grabación continua activa (resiste minimizado y cambio de pestañas).');

    } catch (err) {
      console.error('Error accediendo al microfono:', err);
      setError('No se pudo acceder al microfono. Por favor concede permisos en tu navegador.');
    }
  };

  const askSessionAi = async (text) => {
    if (!text.trim() || liveChatLoading) return;
    const q = text.trim();
    setLiveChatInput('');
    setLiveChatMessages(prev => [...prev, { role: 'user', text: q }]);
    setLiveChatLoading(true);

    try {
      const current = stateRef.current;
      const res = await fetch(`${API}/api/meetings/live-ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          meetingId: sessionMeetingIdRef.current,
          title: current.title || 'Sesión en vivo',
          transcript: (fullTranscriptRef.current || current.transcript || '').trim(),
          summary: current.summary,
          keyTopics: current.topics,
          keyDecisions: current.decisions,
          actionItems: current.actionItems,
          proactiveAdvice: current.advice,
          userNotes: [current.userNotes, externalNotesRef.current].filter(Boolean).join('\n\n'),
          history: liveChatMessages.slice(-6)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setLiveChatMessages(prev => [...prev, { role: 'assistant', text: data.answer || 'No pude procesar la consulta.' }]);
    } catch (e) {
      setLiveChatMessages(prev => [...prev, { role: 'assistant', text: 'Error conectando con la IA: ' + e.message }]);
    } finally {
      setLiveChatLoading(false);
    }
  };

  const stopAndFinalizeRecording = async () => {
    if (!isRecordingRef.current && !isRecording) return;

    setLoading(true);
    setError(null);
    isRecordingRef.current = false;
    setIsRecording(false);
    setAudioLevel(0);

    // Capturar último fragmento hablado antes de apagar el micrófono
    try {
      if (pcmSampleCountRef.current > 4000 || speechDeltaRef.current.trim().length > 2) {
        await triggerLiveAnalysis(null, true);
      }
    } catch (_) {}

    if (timerRef.current) clearInterval(timerRef.current);
    if (liveAnalysisTimerRef.current) clearInterval(liveAnalysisTimerRef.current);
    if (workerTimerRef.current) {
      try { workerTimerRef.current.terminate(); } catch (_) {}
      workerTimerRef.current = null;
    }
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (silenceOscRef.current) {
      try { silenceOscRef.current.stop(); silenceOscRef.current.disconnect(); } catch (_) {}
      silenceOscRef.current = null;
    }
    if (scriptNodeRef.current) {
      try { scriptNodeRef.current.disconnect(); } catch (_) {}
      scriptNodeRef.current = null;
    }
    pcmBufferRef.current = [];
    pcmSampleCountRef.current = 0;
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (_) {}
      audioContextRef.current = null;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
    }
    if (silentAudioRef.current) {
      try {
        silentAudioRef.current.pause();
        silentAudioRef.current.src = '';
      } catch (_) {}
      silentAudioRef.current = null;
    }
    if (wakeLockRef.current) {
      try { wakeLockRef.current.release(); } catch (_) {}
      wakeLockRef.current = null;
    }
    try {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'none';
      }
    } catch (_) {}
    startTimeRef.current = null;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (_) {}
    }

    const current = stateRef.current;
    const finalTranscript = appendTranscriptSafely(
      fullTranscriptRef.current || current.transcript || '',
      (speechDeltaRef.current + ' ' + liveInterim).trim()
    );
    const combinedNotes = [current.userNotes, externalNotesRef.current].filter(Boolean).join('\n\n').trim();

    try {
      // Si hay transcripción, notas, decisiones o tareas acumuladas, finalizar directamente con toda la sesión en Supabase
      if (
        finalTranscript.length >= 10 ||
        current.actionItems.length > 0 ||
        current.decisions.length > 0 ||
        (current.summary && current.summary.length > 20) ||
        combinedNotes.length > 10
      ) {
        const res = await fetch(`${API}/api/meetings/live-finalize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: sessionMeetingIdRef.current,
            createdAt: sessionCreatedAtRef.current,
            title: userEditedTitleRef.current ? current.title.trim() : (liveAiTitleRef.current || current.title.trim()),
            aiTitle: liveAiTitleRef.current || undefined,
            summary: current.summary || 'Resumen de sesión grabada y analizada en vivo por ProActur AI',
            keyTopics: current.topics,
            keyDecisions: current.decisions,
            actionItems: current.actionItems,
            proactiveAdvice: current.advice,
            userNotes: combinedNotes,
            transcript: finalTranscript
          })
        });

        if (res.ok) {
          const savedMeeting = await res.json();
          await clearEmergencyRecording();
          setHasRecoverableAudio(false);
          setLoading(false);
          onMeetingProcessed(savedMeeting);
          return;
        }
      }

      // Respaldo para grabaciones muy cortas (<20s) donde aún no se acumuló texto
      const recordedMime = mediaRecorderRef.current?.mimeType || getSupportedAudioMimeType();
      let finalBlob = null;
      if (audioChunksRef.current && audioChunksRef.current.length > 0) {
        finalBlob = new Blob(audioChunksRef.current, { type: recordedMime });
      } else {
        const emergency = await recoverUnfinalizedAudio().catch(() => null);
        if (emergency && emergency.blob) {
          finalBlob = emergency.blob;
        }
      }

      if (finalBlob && finalBlob.size > 200) {
        const ext = recordedMime.includes('mp4') ? 'mp4' : 'webm';
        await processAudioMeeting(finalBlob, `reunion_grabada.${ext}`);
        await clearEmergencyRecording();
        setHasRecoverableAudio(false);
      } else {
        setLoading(false);
        setError('No se capturó audio suficiente en la sesión. Verifica tu micrófono.');
      }
    } catch (err) {
      console.error('[Finalize Meeting Error]', err);
      setError('Error guardando la reunión: ' + err.message);
      setLoading(false);
    }
  };

  // Recuperar grabacion o sesión en vivo no finalizada tras refresco o apagado
  const handleRecoverUnfinalized = async () => {
    setRecovering(true);
    setError(null);
    try {
      const recovered = await recoverUnfinalizedAudio();
      if (recovered?.snapshot && ((recovered.snapshot.transcript || '').length > 20 || (recovered.snapshot.summary || '').length > 20)) {
        const snap = recovered.snapshot;
        const res = await fetch(`${API}/api/meetings/live-finalize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: snap.id,
            createdAt: snap.createdAt,
            title: snap.title || 'Sesión Recuperada',
            summary: snap.summary || 'Sesión recuperada desde respaldo local.',
            keyTopics: snap.keyTopics || [],
            keyDecisions: snap.keyDecisions || [],
            actionItems: snap.actionItems || [],
            proactiveAdvice: snap.proactiveAdvice || [],
            userNotes: snap.userNotes || '',
            transcript: snap.transcript || ''
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error finalizando sesión recuperada');
        await clearEmergencyRecording();
        setHasRecoverableAudio(false);
        onMeetingProcessed(data);
        return;
      }

      if (recovered && recovered.blob) {
        await processAudioMeeting(recovered.blob, 'reunion_recuperada.webm');
        await clearEmergencyRecording();
        setHasRecoverableAudio(false);
      } else {
        setError('No se encontró audio o transcripción útil en la caja negra.');
        setHasRecoverableAudio(false);
      }
    } catch (err) {
      setError('Fallo al recuperar la grabación: ' + err.message);
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
      let res;
      try {
        res = await fetch(`${API}/api/meetings/process-audio`, {
          method: 'POST',
          body: formData
        });
        // Si Vercel devuelve HTML error (multipart no soportado), usar fallback JSON
        const contentType = res.headers.get('content-type') || '';
        if (!res.ok && contentType.includes('text/html')) {
          throw new Error('Multipart not supported, switching to JSON');
        }
      } catch (fetchErr) {
        // Fallback: enviar como JSON con audio base64
        const arrayBuf = await fileOrBlob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        res = await fetch(`${API}/api/meetings/process-audio`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64: btoa(binary),
            audioMimeType: fileOrBlob.type || 'audio/webm',
            title: meetingTitle.trim() || undefined
          })
        });
      }

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
                Sesión Previa Recuperada en Disco Local
              </h5>
              <p className="text-[11px] text-slate-300">
                Se detectaron datos sin finalizar ({recoverableSeconds}) guardados en la caja negra antes del refresco o cierre.
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
              Recuperar y Guardar Minuta
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-rose-300 hover:text-white font-bold">✕</button>
        </div>
      )}

      {loading && !isRecording && (
        <div className="mb-4 p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/40 text-indigo-200 text-xs sm:text-sm flex items-center gap-3 animate-pulse">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-400 shrink-0" />
          <div>
            <p className="font-bold">Finalizando y guardando la transcripción completa...</p>
            <p className="text-[11px] text-indigo-300/80">Consolidando notas, acuerdos y tareas en Supabase para tus consultas.</p>
          </div>
        </div>
      )}

      {/* Selector de Modo de Entrada (Segmented Control 100% Responsivo y Simétrico) */}
      {!isRecording && (
        <div className="w-full grid grid-cols-3 p-1 bg-slate-950/80 border border-slate-800/80 rounded-2xl mb-4 shadow-inner">
          <button
            type="button"
            onClick={() => setActiveTab('record')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'record'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Mic className="w-4 h-4 shrink-0" />
            <span className="truncate">En Vivo</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'upload'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Upload className="w-4 h-4 shrink-0" />
            <span className="truncate">Subir Audio</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('text')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'text'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span className="truncate">Minuta</span>
          </button>
        </div>
      )}

      {/* Titulo de la reunion con Acceso a Cuaderno Integrado */}
      {!isRecording && (
        <div className="mb-4">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold truncate">
              Título de la Reunión (Opcional)
            </label>
            {onOpenNotebook && (
              <button
                type="button"
                onClick={onOpenNotebook}
                className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-bold transition-all active:scale-95 shrink-0 group px-2 py-0.5 rounded-lg hover:bg-amber-500/10"
                title="Abrir cuaderno ejecutivo de notas en pantalla completa"
              >
                <BookOpen className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
                <span>Abrir Cuaderno Fino</span>
              </button>
            )}
          </div>
          <input
            type="text"
            value={meetingTitle}
            onChange={(e) => {
              userEditedTitleRef.current = Boolean(e.target.value.trim());
              setMeetingTitle(e.target.value);
            }}
            placeholder="Título de la reunión (la IA lo generará si lo dejas en blanco)..."
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
                ProActur AI escuchara en tiempo real, extrayendo tareas, decisiones y consejos proactivos mientras conversas.
              </p>
              <div className="flex items-center gap-1.5 mt-3 text-[10px] text-emerald-400/80 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                <ShieldCheck className="w-3 h-3" />
                <span>Caja Negra Activa: Respaldo continuo en disco contra desconexiones o refrescos</span>
              </div>
            </div>
          ) : (
            /* COPILOTO EN TIEMPO REAL ACTIVO */
            <div className="space-y-4 animate-fade-in">
              {/* Barra de Estado y Accion Superior - Espaciosa y Verticalmente Estructurada */}
              <div className="bg-slate-950/90 border border-indigo-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
                {/* Fila 1: Temporizador Principal, Badges y Estado de la Reunion */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative flex items-center justify-center shrink-0">
                      <span className="absolute w-5 h-5 rounded-full bg-red-500/40 animate-ping" />
                      <span className="w-3.5 h-3.5 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xl sm:text-2xl font-black text-slate-100 font-mono tracking-tight">
                          {formatTime(recordingTime)}
                        </span>
                        <span className="px-2.5 py-1 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 text-xs font-black uppercase tracking-wider shrink-0">
                          ● En Vivo
                        </span>
                        {isAnalyzingLive && (
                          <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-xs font-bold flex items-center gap-1.5 animate-pulse shrink-0">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Analizando con IA...</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1 font-medium truncate">
                        {meetingTitle || 'Sesión en vivo'} &bull; Escucha activa y respaldo continuo
                      </p>
                      {liveStatusMessage && (
                        <p className="text-[11px] text-emerald-300/90 mt-1 font-mono break-words">
                          {liveStatusMessage}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Estado de la Grabacion / Caja Negra */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold whitespace-nowrap">
                      <ShieldCheck className="w-4 h-4 shrink-0" />
                      <span>Caja Negra Activa</span>
                    </div>
                  </div>
                </div>

                {/* Fila 2: Ecualizador de Voz Amplio con Selector de Micrófono */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 shrink-0">
                        <Volume2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                          <span>Sensibilidad del Micrófono:</span>
                          <span className={`font-mono font-bold px-1.5 py-0.5 rounded text-xs ${
                            audioLevel > 10 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                          }`}>
                            {audioLevel}%
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {audioLevel > 10
                            ? 'Capturando ondas de voz con claridad'
                            : 'Micrófono en silencio o esperando audio'}
                        </p>
                      </div>
                    </div>

                    {/* Visualizador de Barras con Ancho Generoso */}
                    <div className="flex items-end gap-1 h-7 w-full sm:w-48 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                      {[10, 20, 35, 50, 70, 85, 95, 80, 60, 45, 30, 15].map((threshold, idx) => {
                        const isActive = audioLevel >= threshold;
                        return (
                          <span
                            key={idx}
                            className={`flex-1 rounded-full transition-all duration-75 ${
                              isActive ? 'bg-indigo-400 shadow-sm shadow-indigo-400/50' : 'bg-slate-800'
                            }`}
                            style={{ height: isActive ? `${Math.max(25, (audioLevel / 100) * 100)}%` : '20%' }}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {audioInputDevices.length > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2 border-t border-slate-800/70">
                      <label className="text-[11px] text-slate-400 font-semibold shrink-0">
                        Micrófono activo:
                      </label>
                      <select
                        value={selectedDeviceId}
                        onChange={async (e) => {
                          const newId = e.target.value;
                          setSelectedDeviceId(newId);
                          try {
                            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                              mediaRecorderRef.current.onstop = null;
                              mediaRecorderRef.current.stop();
                            }
                            if (activeStreamRef.current) {
                              activeStreamRef.current.getTracks().forEach(t => t.stop());
                            }
                            const nextStream = await navigator.mediaDevices.getUserMedia({
                              audio: newId ? { deviceId: { exact: newId }, echoCancellation: true, autoGainControl: true } : true
                            });
                            zeroAudioSecondsRef.current = 0;
                            setZeroMicWarning(false);
                            attachRecorderToStream(nextStream, isMobileDevice() ? 15000 : 12000);
                            setLiveStatusMessage('✓ Micrófono cambiado sin interrumpir la sesión.');
                          } catch (switchErr) {
                            setLiveStatusMessage('⚠️ No se pudo cambiar de micrófono: ' + switchErr.message);
                          }
                        }}
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-indigo-500"
                      >
                        {audioInputDevices.map((d, i) => (
                          <option key={d.deviceId || i} value={d.deviceId}>
                            {d.label || `Micrófono ${i + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {zeroMicWarning && audioLevel === 0 && (
                    <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-[11px] leading-snug">
                      ⚠️ No entra señal del micrófono (0%). Si Chrome te pide arriba <strong>&quot;Volver a cargar&quot;</strong> por permisos o estás usando otro micrófono, recarga la página o cambia el <strong>Micrófono activo</strong> arriba.
                    </div>
                  )}
                </div>

                {/* Fila 3: Botones de Accion con Ancho Completo y Sin Amontonamiento */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => triggerLiveAnalysis(userLiveNotes)}
                    disabled={isAnalyzingLive}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 hover:border-indigo-500/50 transition-all shadow-md disabled:opacity-50"
                  >
                    {isAnalyzingLive ? <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> : <Zap className="w-4 h-4 text-amber-400" />}
                    <span>{isAnalyzingLive ? 'Analizando con Gemini...' : '⚡ Analizar Ahora'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={stopAndFinalizeRecording}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-xs sm:text-sm font-black bg-gradient-to-r from-red-600 via-rose-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white shadow-xl shadow-red-600/30 transition-all"
                  >
                    <Square className="w-4 h-4 fill-white" />
                    <span>Finalizar y Guardar Minuta</span>
                  </button>
                </div>
              </div>

              {/* PANEL TRIPLE: NOTAS EN VIVO, TRANSCRIPCIÓN EN VIVO & COPILOTO IA */}
              <div className="bg-slate-900/90 border border-indigo-500/30 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-4">
                {/* Control Segmentado de Pestañas */}
                <div className="grid grid-cols-3 p-1.5 bg-slate-950/90 rounded-2xl border border-slate-800/80 gap-1.5 shadow-inner">
                  <button
                    type="button"
                    onClick={() => setActiveLiveTab('notes')}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                      activeLiveTab === 'notes'
                        ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-500/25'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/70'
                    }`}
                  >
                    <PenTool className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Notas en Vivo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveLiveTab('transcript')}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                      activeLiveTab === 'transcript'
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/25'
                        : 'text-emerald-400/80 hover:text-emerald-300 hover:bg-slate-900/70'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      Transcripción ({(liveTranscript || '').split(/\s+/).filter(Boolean).length})
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveLiveTab('chat')}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                      activeLiveTab === 'chat'
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25'
                        : 'text-purple-400 hover:text-purple-300 hover:bg-slate-900/70'
                    }`}
                  >
                    <Brain className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Preguntar IA</span>
                  </button>
                </div>

                {/* Sub-barra de Modo de Entrada (Solo cuando la pestaña Notas está activa) */}
                {activeLiveTab === 'notes' && (
                  <div className="space-y-3">
                    {onOpenNotebook && (
                      <div className="p-3.5 bg-gradient-to-r from-amber-500/10 via-indigo-600/10 to-violet-600/10 border border-indigo-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white shadow shrink-0">
                            <BookOpen className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-100">¿Deseas la experiencia de Cuaderno Fino?</h4>
                            <p className="text-[11px] text-slate-400">Renglones Oxford, caligrafía suave, tablas y mapas mentales en 1er plano. La reunión sigue en 2do plano.</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={onOpenNotebook}
                          className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-black shadow-lg shadow-indigo-500/25 transition-all shrink-0 active:scale-95 flex items-center justify-center gap-1.5"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-amber-300" />
                          <span>Abrir Cuaderno Completo</span>
                        </button>
                      </div>
                    )}
                  <div className="flex items-center justify-between gap-2 px-1 pt-0.5">
                    <span className="text-[11px] sm:text-xs font-semibold text-slate-400">
                      Modo de escritura:
                    </span>
                    <div className="inline-flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shadow-sm gap-1">
                      <button
                        type="button"
                        onClick={() => setLiveNotesMode('keyboard')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          liveNotesMode === 'keyboard'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Keyboard className="w-3.5 h-3.5" />
                        <span>Teclado</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setLiveNotesMode('pencil')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          liveNotesMode === 'pencil'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <PenTool className="w-3.5 h-3.5" />
                        <span>Lápiz Canvas</span>
                      </button>
                    </div>
                  </div>
                  </div>
                )}

                {/* Contenido segun la pestaña activa */}
                {activeLiveTab === 'transcript' ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-semibold text-emerald-300">
                        Transcripción acumulada en tiempo real ({(liveTranscript || '').split(/\s+/).filter(Boolean).length} palabras)
                      </span>
                      {liveTranscript && (
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(liveTranscript)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold"
                        >
                          Copiar texto
                        </button>
                      )}
                    </div>
                    <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 h-56 overflow-y-auto text-xs font-mono text-slate-200 leading-relaxed whitespace-pre-wrap">
                      {liveTranscript || 'Escuchando... la transcripción aparecerá aquí cada pocos segundos.'}
                      {liveInterim && (
                        <span className="text-indigo-400/80 italic"> {liveInterim}</span>
                      )}
                    </div>
                  </div>
                ) : activeLiveTab === 'chat' ? (
                  <div className="space-y-3">
                    <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 h-44 overflow-y-auto space-y-2.5">
                      {liveChatMessages.map((m, idx) => (
                        <div key={idx} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          {m.role === 'assistant' && (
                            <div className="w-6 h-6 rounded-lg bg-indigo-600/30 flex items-center justify-center text-indigo-400 shrink-0 text-xs">
                              ✨
                            </div>
                          )}
                          <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                            m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-200'
                          }`}>
                            {m.text}
                          </div>
                        </div>
                      ))}
                      {liveChatLoading && (
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                          <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                          <span>La IA está consultando la transcripción acumulada del seminario...</span>
                        </div>
                      )}
                    </div>

                    <form onSubmit={(e) => { e.preventDefault(); askSessionAi(liveChatInput); }} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={liveChatInput}
                        onChange={(e) => setLiveChatInput(e.target.value)}
                        placeholder="Pregúntale en vivo sobre lo hablado hasta ahora..."
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="submit"
                        disabled={liveChatLoading || !liveChatInput.trim()}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-all shadow"
                      >
                        Preguntar
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {liveNotesMode === 'keyboard' ? (
                      <div className="space-y-2">
                        <textarea
                          value={userLiveNotes}
                          onChange={(e) => setUserLiveNotes(e.target.value)}
                          placeholder="Escribe aquí notas, compromisos o acuerdos hablados... (Se analizan con IA automáticamente o presiona Ctrl+Enter / botón amarillo)"
                          className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 h-24 transition-all resize-none leading-relaxed font-sans"
                        />
                                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1.5 text-xs text-slate-400">
                          <span className="text-[11px] text-slate-400 leading-tight">
                            {userLiveNotes.trim().length} caracteres &bull; Sincronizado en vivo con IA
                          </span>
                          <button
                            type="button"
                            onClick={() => triggerLiveAnalysis(userLiveNotes)}
                            disabled={isAnalyzingLive || !userLiveNotes.trim()}
                            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-500/20 disabled:opacity-40"
                          >
                            <Zap className="w-3.5 h-3.5 text-amber-300" />
                            <span>Analizar Notas Ahora</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                        <HandwritingCanvas
                          strokes={liveNotesStrokes}
                          onStrokesChange={(strokes) => setLiveNotesStrokes(strokes)}
                          className="h-44 w-full"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* MINUTA EJECUTIVA ESTRUCTURADA EN TIEMPO REAL (LOS 4 PILARES DE PROACTUR) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                {/* Pilar 1: Resumen Ejecutivo en Vivo */}
                <div className="bg-slate-950/85 border border-indigo-500/25 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col justify-between min-h-[220px]">
                  <div className="space-y-3">
                    <div className="border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2 text-indigo-300 font-bold text-sm">
                        <FileText className="w-4 h-4 text-indigo-400" />
                        <span>Resumen Ejecutivo en Vivo</span>
                      </div>
                      <p className="text-[11px] text-indigo-400/80 mt-1 font-medium">
                        Síntesis incremental generada en tiempo real
                      </p>
                    </div>

                    {liveSummary ? (
                      <div className="space-y-3">
                        <p className="text-xs sm:text-sm text-slate-200 leading-relaxed max-h-[160px] overflow-y-auto pr-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800 whitespace-pre-line">
                          {liveSummary}
                        </p>
                        {liveTopics.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {liveTopics.map((topic, idx) => (
                              <span key={idx} className="px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-[11px] text-indigo-200 font-semibold">
                                #{topic}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-400 text-xs italic space-y-2">
                        <Sparkles className="w-6 h-6 text-indigo-400/50 mx-auto animate-pulse" />
                        <p>La IA sintetiza los puntos clave conforme avanza la sesión...</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Pilar 2: Decisiones Clave en Vivo */}
                <div className="bg-slate-950/85 border border-emerald-500/25 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col justify-between min-h-[220px]">
                  <div className="space-y-3">
                    <div className="border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Decisiones Clave ({liveDecisions.length})</span>
                      </div>
                      <p className="text-[11px] text-emerald-400/80 mt-1 font-medium">
                        Acuerdos vinculantes detectados en la conversación
                      </p>
                    </div>

                    {liveDecisions.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-xs italic space-y-2">
                        <CheckCircle2 className="w-6 h-6 text-emerald-400/50 mx-auto animate-pulse" />
                        <p>Esperando decisiones y acuerdos en la sesión...</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                        {liveDecisions.map((dec, i) => (
                          <div key={i} className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-xs sm:text-sm flex items-start gap-2.5 text-slate-100">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                            <span className="leading-snug font-medium">{dec}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Pilar 3: Compromisos y Tareas (Action Items) */}
                <div className="bg-slate-950/85 border border-blue-500/25 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col justify-between min-h-[220px]">
                  <div className="space-y-3">
                    <div className="border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2 text-blue-300 font-bold text-sm">
                        <CheckSquare className="w-4 h-4 text-blue-400" />
                        <span>Compromisos y Tareas ({liveActionItems.length})</span>
                      </div>
                      <p className="text-[11px] text-blue-400/80 mt-1 font-medium">
                        Responsables asignados y fechas límite
                      </p>
                    </div>

                    {liveActionItems.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-xs italic space-y-2">
                        <CheckSquare className="w-6 h-6 text-blue-400/50 mx-auto animate-pulse" />
                        <p>Detectando compromisos y asignando responsables en vivo...</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                        {liveActionItems.map((item, i) => (
                          <div key={i} className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs sm:text-sm flex items-start gap-2.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <p className="text-slate-100 font-bold leading-snug">{item.task}</p>
                              <div className="flex items-center flex-wrap gap-2 text-xs text-slate-300">
                                <span className="bg-slate-800 px-2 py-0.5 rounded-md text-indigo-300 font-semibold">
                                  👤 {item.assignee || 'Por asignar'}
                                </span>
                                {item.deadline && (
                                  <span className="bg-slate-800 px-2 py-0.5 rounded-md text-amber-300 font-semibold">
                                    📅 {item.deadline}
                                  </span>
                                )}
                                {item.priority && (
                                  <span className="px-2 py-0.5 rounded-md font-bold bg-slate-800 text-indigo-300">
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

                {/* Pilar 4: Consejos Proactivos y Alertas Estrategicas */}
                <div className="bg-slate-950/85 border border-amber-500/25 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col justify-between min-h-[220px]">
                  <div className="space-y-3">
                    <div className="border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                        <ShieldAlert className="w-4 h-4 text-amber-400" />
                        <span>Consejos Proactivos & Alertas</span>
                      </div>
                      <p className="text-[11px] text-amber-400/80 mt-1 font-medium">
                        Recomendaciones estratégicas y riesgos de gestión
                      </p>
                    </div>

                    {liveAdvice.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-xs italic space-y-2">
                        <ShieldAlert className="w-6 h-6 text-amber-400/50 mx-auto animate-pulse" />
                        <p>ProActur evalúa riesgos y recomendaciones durante la charla...</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                        {liveAdvice.map((adv, i) => (
                          <div key={i} className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs sm:text-sm flex items-start gap-2.5 text-slate-100">
                            <span className="text-amber-400 font-bold shrink-0">💡</span>
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
    </div>
  );
}