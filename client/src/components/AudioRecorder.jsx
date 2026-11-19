import React, { useState, useRef, useEffect } from 'react';
import HandwritingCanvas from './HandwritingCanvas';
import MarkdownText from './MarkdownText';
import {
  Mic, Square, Play, Upload, FileText, Loader2, Sparkles, Volume2, AlertCircle,
  CheckCircle2, CheckSquare, Clock, Zap, Brain, ShieldAlert, ArrowRight,
  RotateCcw, ShieldCheck, Trash2, PenTool, Keyboard, BookOpen, Globe, ExternalLink
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

function isVirtualOrSilentMic(label = '') {
  return /wonder|virtual|vb-audio|voicemeeter|cable output|blackhole/i.test(label);
}

function isStereoMixDevice(label = '') {
  return /mezcla est[eé]reo|stereo mix|what u hear/i.test(label);
}

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

function isPoisonedClientItem(str) {
  return /gesti[oó]n de bajas|tr[aá]mites de bajas|bajas administrativas|bajas mencionadas|revisar las bajas|la sesi[oó]n (?:ha |haya )?conclu(?:y[oó]|ido)|finalizaci[oó]n formal de la sesi[oó]n|cierre de reuni[oó]n|cierre definitivo de la sesi[oó]n|cierre de ciclo acad[eé]mico|agradecimientos finales|agradecimiento(?:s)? y cortes[ií]a inicial|comentarios informales de cierre|comentarios de cierre|archivar la sesi[oó]n|transcripci[oó]n actual est[aá] incompleta|despedida y cierre formal|^inicio de la? sesi[oó]n$/i.test(String(str || '').trim());
}

function mergeUniqueTextArrays(prevArr = [], nextArr = [], maxItems = 16) {
  const out = [];
  const seen = new Set();
  for (const item of [...(Array.isArray(nextArr) ? nextArr : []), ...(Array.isArray(prevArr) ? prevArr : [])]) {
    if (typeof item !== 'string') continue;
    const t = item.trim();
    if (!t || isPoisonedClientItem(t)) continue;
    const k = normalizeKey(t);
    if (k && !seen.has(k)) {
      seen.add(k);
      out.push(t);
      if (out.length >= maxItems) break;
    }
  }
  return out;
}

function mergeUniqueActionItems(prevArr = [], nextArr = [], maxItems = 14) {
  const out = [];
  const seen = new Set();
  for (const raw of [...(Array.isArray(nextArr) ? nextArr : []), ...(Array.isArray(prevArr) ? prevArr : [])]) {
    if (!raw) continue;
    const item = typeof raw === 'string'
      ? { task: raw, assignee: 'Por asignar', priority: 'Alta', deadline: 'Pendiente', completed: false }
      : raw;
    const taskText = String(item.task || item.text || item.title || '').trim();
    if (!taskText || isPoisonedClientItem(taskText)) continue;
    const k = normalizeKey(taskText);
    if (k && !seen.has(k)) {
      seen.add(k);
      out.push({ ...item, task: taskText });
      if (out.length >= maxItems) break;
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
  const [selectedDeviceId, setSelectedDeviceId] = useState('auto-mix');
  const [zeroMicWarning, setZeroMicWarning] = useState(false);
  const [audioCtxSuspended, setAudioCtxSuspended] = useState(false);
  const autoResumeTriggeredRef = useRef(false);
  const zeroAudioSecondsRef = useRef(0);
  const audioLevelRef = useRef(0);
  const extraStreamsRef = useRef([]);
  const autoSwitchedRef = useRef(false);
  const isRecordingRef = useRef(false);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const trackProcessorActiveRef = useRef(false);
  const trackReadersRef = useRef([]);

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
  const [activeLiveTab, setActiveLiveTab] = useState(() => (isMobileDevice() ? 'summary' : 'notes')); // 'summary' | 'notes' | 'transcript' | 'chat'
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

  // 1. Auto-reanudación inmediata tras refresco o recuperación de sesión del mismo día
  useEffect(() => {
    const attemptAutoResume = async () => {
      let localBackup = null;
      try {
        const raw = localStorage.getItem('proactur_live_snapshot_backup');
        if (raw) localBackup = JSON.parse(raw);
      } catch (_) {}

      const res = await checkUnfinalizedRecording().catch(() => ({ hasUnfinalized: false }));
      const snap = res?.snapshot || localBackup;
      const lastActiveTime = Number(snap?.updatedAt || res?.meta?.startTime || 0);
      const hasContent = Boolean(snap && ((snap.transcript || '').trim().length > 20 || (snap.summary || '').trim().length > 20));
      const isSameDaySession = lastActiveTime > 0 && (Date.now() - lastActiveTime < 12 * 3600 * 1000);

      if ((res?.hasUnfinalized || hasContent) && isSameDaySession && !autoResumeTriggeredRef.current && !isRecordingRef.current) {
        autoResumeTriggeredRef.current = true;
        handleResumeUnfinalized();
        return;
      }

      if (res && res.hasUnfinalized) {
        setHasRecoverableAudio(true);
        const mins = res.snapshot?.transcript
          ? `${res.snapshot.transcript.split(/\s+/).filter(Boolean).length} palabras`
          : `${res.chunkCount} segundos de audio`;
        setRecoverableSeconds(mins);
      }
    };
    attemptAutoResume();
  }, []);

  // 2. Guardado síncrono instantáneo al refrescar o cerrar (sin bloquear F5 con diálogos)
  useEffect(() => {
    const persistSyncBeforeUnload = () => {
      if (!isRecordingRef.current) return;
      try {
        const current = stateRef.current;
        const transcriptNow = appendTranscriptSafely(
          fullTranscriptRef.current || current.transcript || '',
          speechDeltaRef.current.trim()
        );
        localStorage.setItem('proactur_live_snapshot_backup', JSON.stringify({
          id: sessionMeetingIdRef.current,
          createdAt: sessionCreatedAtRef.current,
          title: current.title || liveAiTitleRef.current || 'Sesión en Vivo',
          summary: current.summary || '',
          keyTopics: current.topics || [],
          keyDecisions: current.decisions || [],
          actionItems: current.actionItems || [],
          proactiveAdvice: current.advice || [],
          transcript: transcriptNow,
          userNotes: [current.userNotes, externalNotesRef.current].filter(Boolean).join('\n\n'),
          updatedAt: Date.now()
        }));
      } catch (_) {}
    };

    window.addEventListener('beforeunload', persistSyncBeforeUnload);
    window.addEventListener('pagehide', persistSyncBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', persistSyncBeforeUnload);
      window.removeEventListener('pagehide', persistSyncBeforeUnload);
    };
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
      stopDirectTrackProcessors();
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch (_) {}
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (_) {}
      }
    };
  }, []);

  const stopDirectTrackProcessors = () => {
    trackProcessorActiveRef.current = false;
    if (trackReadersRef.current.length > 0) {
      for (const r of trackReadersRef.current) {
        try { r.cancel().catch(() => {}); } catch (_) {}
      }
      trackReadersRef.current = [];
    }
  };

  // Helper compartido para muestrear PCM a 16kHz en la ventana circular de 35s
  const pushDownsampledPcm = (inputSamples, sourceRate, gain = 1) => {
    if (!inputSamples || inputSamples.length === 0) return;
    const downsampleRatio = (sourceRate || 44100) / 16000;
    const newLength = Math.max(1, Math.floor(inputSamples.length / downsampleRatio));
    const downsampled = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const idx = Math.min(inputSamples.length - 1, Math.floor(i * downsampleRatio));
      downsampled[i] = Math.max(-1, Math.min(1, inputSamples[idx] * gain));
    }

    pcmBufferRef.current.push(downsampled);
    pcmSampleCountRef.current += newLength;
    const maxSamples = 16000 * 35;
    while (pcmSampleCountRef.current > maxSamples && pcmBufferRef.current.length > 1) {
      const removed = pcmBufferRef.current.shift();
      pcmSampleCountRef.current -= removed.length;
    }
  };

  const readAudioDataChannelZero = (frame) => {
    const count = frame.numberOfFrames || 0;
    if (count === 0) return new Float32Array(0);
    try {
      const buf = new Float32Array(count);
      frame.copyTo(buf, { planeIndex: 0, format: 'f32-planar' });
      return buf;
    } catch (_) {
      const fmt = frame.format || '';
      const byteSize = frame.allocationSize({ planeIndex: 0 });
      const raw = new ArrayBuffer(byteSize);
      frame.copyTo(raw, { planeIndex: 0 });
      const channels = Math.max(1, frame.numberOfChannels || 1);
      if (fmt === 'f32' || fmt === 'f32-planar') {
        const view = new Float32Array(raw);
        const step = fmt === 'f32' ? channels : 1;
        if (step === 1) return view;
        const out = new Float32Array(count);
        for (let i = 0; i < count; i++) out[i] = view[i * step];
        return out;
      }
      if (fmt === 's16' || fmt === 's16-planar') {
        const view = new Int16Array(raw);
        const step = fmt === 's16' ? channels : 1;
        const out = new Float32Array(count);
        for (let i = 0; i < count; i++) out[i] = view[i * step] / 32768;
        return out;
      }
      return new Float32Array(0);
    }
  };

  // Lector directo inmune a políticas de suspensión de AudioContext tras F5
  const startDirectTrackFallback = (streamList) => {
    if (typeof window === 'undefined' || typeof window.MediaStreamTrackProcessor !== 'function') {
      return false;
    }
    stopDirectTrackProcessors();
    const candidates = (streamList || []).filter(s => s && s.getAudioTracks().length > 0).slice(0, 2);
    if (candidates.length === 0) return false;

    trackProcessorActiveRef.current = true;
    const streamLevels = new Array(candidates.length).fill(0);
    let primaryStreamIdx = 0;

    candidates.forEach((stream, idx) => {
      try {
        const track = stream.getAudioTracks()[0];
        const processor = new window.MediaStreamTrackProcessor({ track });
        const reader = processor.readable.getReader();
        trackReadersRef.current.push(reader);

        (async () => {
          while (trackProcessorActiveRef.current && isRecordingRef.current) {
            if (audioContextRef.current?.state === 'running') {
              stopDirectTrackProcessors();
              break;
            }
            const { value: frame, done } = await reader.read();
            if (done || !frame) break;
            try {
              const samples = readAudioDataChannelZero(frame);
              let maxPeak = 0;
              let sumSq = 0;
              const gain = 2.5;
              for (let i = 0; i < samples.length; i++) {
                const v = Math.abs(Math.max(-1, Math.min(1, samples[i] * gain)));
                if (v > maxPeak) maxPeak = v;
                sumSq += v * v;
              }
              const rms = samples.length > 0 ? Math.sqrt(sumSq / samples.length) : 0;
              const normalized = maxPeak < 0.0005 ? 0 : Math.min(100, Math.round(Math.max(rms * 420, maxPeak * 110)));
              streamLevels[idx] = normalized;
              if (normalized > streamLevels[primaryStreamIdx] + 5) {
                primaryStreamIdx = idx;
              }
              const topLevel = Math.max(...streamLevels);
              audioLevelRef.current = topLevel;
              if (topLevel > 0) zeroAudioSecondsRef.current = 0;
              setAudioLevel(topLevel);

              if (idx === primaryStreamIdx) {
                pushDownsampledPcm(samples, frame.sampleRate || 48000, gain);
              }
            } finally {
              try { frame.close(); } catch (_) {}
            }
          }
        })().catch(() => {});
      } catch (tpErr) {
        console.warn('[MediaStreamTrackProcessor Warn]', tpErr);
      }
    });

    return trackReadersRef.current.length > 0;
  };

  // Medidor de voz en vivo de alta precisión + pre-amplificador y mezclador multi-micrófono
  const setupAudioAnalyzer = async (inputStreams) => {
    const streamList = Array.isArray(inputStreams) ? inputStreams.filter(Boolean) : [inputStreams].filter(Boolean);
    if (streamList.length === 0) return null;

    try {
      let audioCtx = audioContextRef.current;
      if (!audioCtx || audioCtx.state === 'closed') {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return streamList[0];
        audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;
      }

      if (audioCtx.state === 'suspended') {
        try {
          await Promise.race([
            audioCtx.resume(),
            new Promise(resolve => setTimeout(resolve, 250))
          ]);
        } catch (_) {}
      }

      if (audioCtx.state === 'suspended') {
        const directOk = startDirectTrackFallback(streamList);
        setAudioCtxSuspended(!directOk);
        const unlockAudio = () => {
          if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume().then(() => {
              if (audioContextRef.current?.state === 'running') {
                setAudioCtxSuspended(false);
                stopDirectTrackProcessors();
              }
            }).catch(() => {});
          }
          if (audioContextRef.current?.state === 'running') {
            setAudioCtxSuspended(false);
            stopDirectTrackProcessors();
            window.removeEventListener('pointerdown', unlockAudio);
            window.removeEventListener('keydown', unlockAudio);
          }
        };
        window.addEventListener('pointerdown', unlockAudio, { passive: true });
        window.addEventListener('keydown', unlockAudio, { passive: true });
        audioCtx.onstatechange = () => {
          if (audioCtx.state === 'running') {
            setAudioCtxSuspended(false);
            stopDirectTrackProcessors();
            window.removeEventListener('pointerdown', unlockAudio);
            window.removeEventListener('keydown', unlockAudio);
          }
        };
      } else {
        setAudioCtxSuspended(false);
        stopDirectTrackProcessors();
      }

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.2;
      analyserRef.current = analyser;

      // Pre-amplificador de ganancia (x2.5) para capturar voces lejanas en seminarios + mezclador único
      const preampGain = audioCtx.createGain();
      preampGain.gain.value = 2.5;

      const mixDestination = audioCtx.createMediaStreamDestination();
      for (const s of streamList) {
        try {
          const src = audioCtx.createMediaStreamSource(s);
          src.connect(preampGain);
        } catch (srcErr) {
          console.warn('[AudioContext Source Warn]', srcErr);
        }
      }

      preampGain.connect(analyser);
      preampGain.connect(mixDestination);

      // 1. Mantener AudioContext y subprocesos activos en segundo plano (pestañas minimizadas)
      try {
        if (!silenceOscRef.current) {
          const osc = audioCtx.createOscillator();
          const silentGain = audioCtx.createGain();
          silentGain.gain.value = 0.00001;
          osc.connect(silentGain);
          silentGain.connect(audioCtx.destination);
          osc.start();
          silenceOscRef.current = osc;
        }
      } catch (oscErr) {
        console.warn('[AudioContext] Keep-alive osc error:', oscErr);
      }

      // 2. Buffer circular de audio PCM directo a 16kHz conectado al pre-amplificador
      try {
        if (scriptNodeRef.current) {
          try { scriptNodeRef.current.disconnect(); } catch (_) {}
          scriptNodeRef.current = null;
        }
        const scriptNode = audioCtx.createScriptProcessor(4096, 1, 1);
        const sourceRate = audioCtx.sampleRate || 44100;

        scriptNode.onaudioprocess = (audioEvent) => {
          if (!isRecordingRef.current) return;
          pushDownsampledPcm(audioEvent.inputBuffer.getChannelData(0), sourceRate, 1);
        };

        preampGain.connect(scriptNode);
        const zeroGain = audioCtx.createGain();
        zeroGain.gain.value = 0;
        scriptNode.connect(zeroGain);
        zeroGain.connect(audioCtx.destination);
        scriptNodeRef.current = scriptNode;
      } catch (pcmErr) {
        console.warn('[AudioContext] PCM ScriptProcessor error:', pcmErr);
      }

      const floatTimeData = new Float32Array(analyser.fftSize);
      const freqData = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!isRecordingRef.current) return;
        if (audioCtx.state === 'suspended' && trackProcessorActiveRef.current) {
          animFrameRef.current = requestAnimationFrame(updateLevel);
          return;
        }

        // Precisión Float32 en rango [-1, 1]: detecta incluso voces lejanas en auditorios
        let maxPeak = 0;
        let sumSq = 0;
        if (typeof analyser.getFloatTimeDomainData === 'function') {
          analyser.getFloatTimeDomainData(floatTimeData);
          for (let i = 0; i < floatTimeData.length; i++) {
            const val = Math.abs(floatTimeData[i]);
            if (val > maxPeak) maxPeak = val;
            sumSq += val * val;
          }
        }
        const rms = Math.sqrt(sumSq / floatTimeData.length);

        analyser.getByteFrequencyData(freqData);
        let vocalSum = 0;
        const vocalBins = Math.min(40, freqData.length);
        for (let i = 0; i < vocalBins; i++) {
          vocalSum += freqData[i];
        }
        const vocalAvg = vocalSum / vocalBins;

        const calculated = Math.max(rms * 420, maxPeak * 110, (vocalAvg / 140) * 100);
        const normalized = maxPeak < 0.0005 && vocalAvg < 1 ? 0 : Math.min(100, Math.round(calculated));

        audioLevelRef.current = normalized;
        if (normalized > 0) {
          zeroAudioSecondsRef.current = 0;
        }
        setAudioLevel(normalized);

        animFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
      return mixDestination.stream;
    } catch (err) {
      console.warn('[AudioContext] Error en setupAudioAnalyzer:', err);
      return streamList[0];
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
      const cleanTopics = Array.isArray(data.keyTopics)
        ? data.keyTopics.filter(t => typeof t === 'string' && t.trim() && !isPoisonedClientItem(t))
        : [];
      const cleanDecisions = Array.isArray(data.keyDecisions)
        ? data.keyDecisions.filter(d => typeof d === 'string' && d.trim() && !isPoisonedClientItem(d))
        : [];
      const cleanActions = Array.isArray(data.actionItems)
        ? data.actionItems.filter(a => a && !isPoisonedClientItem(typeof a === 'string' ? a : (a.task || a.text || a.title)))
        : [];
      const cleanAdvice = Array.isArray(data.proactiveAdvice)
        ? data.proactiveAdvice.filter(a => typeof a === 'string' && a.trim() && !isPoisonedClientItem(a))
        : [];

      const nextTopics = cleanTopics.length > 0 ? cleanTopics : mergeUniqueTextArrays(current.topics, []);
      const nextDecisions = cleanDecisions.length > 0 ? cleanDecisions : mergeUniqueTextArrays(current.decisions, []);
      const nextActions = cleanActions.length > 0 ? cleanActions : mergeUniqueActionItems(current.actionItems, []);
      const nextAdvice = cleanAdvice.length > 0 ? cleanAdvice : mergeUniqueTextArrays(current.advice, []);

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

  // Abre streams reales ignorando drivers virtuales mudos (Wonder Microphone, etc.)
  const openPhysicalAudioStreams = async (modeOrDeviceId = selectedDeviceId) => {
    const mobile = isMobileDevice();
    const baseOpts = mobile
      ? { echoCancellation: true, noiseSuppression: false, autoGainControl: true }
      : { echoCancellation: false, noiseSuppression: false, autoGainControl: true };

    // Primero obtener permiso general o listar dispositivos
    let initialStream = null;
    if (!modeOrDeviceId || modeOrDeviceId === 'auto-mix') {
      initialStream = await navigator.mediaDevices.getUserMedia({ audio: baseOpts });
    } else {
      try {
        initialStream = await navigator.mediaDevices.getUserMedia({
          audio: { ...baseOpts, deviceId: { exact: modeOrDeviceId } }
        });
      } catch (_) {
        initialStream = await navigator.mediaDevices.getUserMedia({ audio: baseOpts });
      }
    }

    let inputs = [];
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      inputs = devs.filter(d => d.kind === 'audioinput');
      setAudioInputDevices(inputs);
    } catch (_) {}

    if (modeOrDeviceId && modeOrDeviceId !== 'auto-mix') {
      return { streams: [initialStream], inputs, label: 'Micrófono seleccionado' };
    }

    // Buscar micrófonos físicos reales (excluyendo Wonder Microphone, drivers virtuales y mezcla estéreo sola)
    const realMics = inputs.filter(
      d => d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications' &&
           !isVirtualOrSilentMic(d.label) && !isStereoMixDevice(d.label)
    );

    if (realMics.length === 0) {
      return { streams: [initialStream], inputs, label: 'Micrófono del sistema' };
    }

    // Cerrar el stream inicial si apuntaba a un micrófono virtual (ej. Wonder Microphone)
    const initTrack = initialStream.getAudioTracks()[0];
    const initLabel = initTrack?.label || '';
    const isInitialVirtual = isVirtualOrSilentMic(initLabel);
    const openedStreams = [];

    if (!isInitialVirtual) {
      openedStreams.push(initialStream);
    } else {
      initialStream.getTracks().forEach(t => t.stop());
    }

    // Abrir hasta 2 micrófonos físicos reales distintos (ej. Intel Smart Sound + Logi USB) y mezclarlos
    for (const mic of realMics) {
      if (openedStreams.length >= 2) break;
      const alreadyOpen = openedStreams.some(s => s.getAudioTracks()[0]?.getSettings?.()?.deviceId === mic.deviceId);
      if (alreadyOpen) continue;
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          audio: { ...baseOpts, deviceId: { exact: mic.deviceId } }
        });
        openedStreams.push(s);
      } catch (_) {}
    }

    if (openedStreams.length === 0) {
      const fallbackStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      openedStreams.push(fallbackStream);
    }

    const activeLabels = openedStreams
      .map(s => s.getAudioTracks()[0]?.label)
      .filter(Boolean)
      .join(' + ');
    return { streams: openedStreams, inputs, label: activeLabels || 'Micrófonos reales' };
  };

  const stopAllCaptureStreams = () => {
    stopDirectTrackProcessors();
    if (activeStreamRef.current) {
      try { activeStreamRef.current.getTracks().forEach(t => t.stop()); } catch (_) {}
      activeStreamRef.current = null;
    }
    if (extraStreamsRef.current && extraStreamsRef.current.length > 0) {
      for (const s of extraStreamsRef.current) {
        try { s.getTracks().forEach(t => t.stop()); } catch (_) {}
      }
      extraStreamsRef.current = [];
    }
  };

  // Crea e inicia la captura sobre uno o varios streams mezclados y pre-amplificados
  const attachRecorderToStream = async (inputStreams, analysisIntervalMs) => {
    const rawStreams = Array.isArray(inputStreams) ? inputStreams : [inputStreams];
    extraStreamsRef.current = rawStreams;

    const mixedStream = (await setupAudioAnalyzer(rawStreams)) || rawStreams[0];
    const recorderStream = (audioContextRef.current?.state === 'suspended') ? rawStreams[0] : mixedStream;
    activeStreamRef.current = mixedStream;

    const preferredMime = getSupportedAudioMimeType();
    let mediaRecorder;
    try {
      mediaRecorder = new MediaRecorder(recorderStream, { mimeType: preferredMime });
    } catch (_) {
      mediaRecorder = new MediaRecorder(recorderStream);
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
      stopAllCaptureStreams();
    };

    // Auto-recuperación si el sistema operativo o driver cierra el micrófono inesperadamente
    rawStreams.forEach(rawS => {
      rawS.getAudioTracks().forEach(track => {
        track.onended = async () => {
          console.warn('[AudioTrack] Track finalizado por el sistema.');
          if (isRecordingRef.current) {
            setLiveStatusMessage('🔄 Reconectando micrófono automáticamente...');
            try {
              const { streams } = await openPhysicalAudioStreams(selectedDeviceId);
              if (isRecordingRef.current && streams.length > 0) {
                await attachRecorderToStream(streams, analysisIntervalMs);
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
    });

    mediaRecorder.onerror = (e) => console.warn('[MediaRecorder Error]', e);
    mediaRecorder.start(1000);
  };

  const startRecording = async (resumeSnapshot = null) => {
    const isResuming = Boolean(
      resumeSnapshot &&
      typeof resumeSnapshot === 'object' &&
      resumeSnapshot.id &&
      !resumeSnapshot.nativeEvent
    );

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
      const pickLatestItems = (arr) => {
        if (!Array.isArray(arr)) return [];
        return arr.length > 20 ? arr.slice(-40).reverse() : arr;
      };

      const restoredTitle = isResuming ? (resumeSnapshot.title || meetingTitle || '') : '';
      const restoredTranscript = isResuming ? (resumeSnapshot.transcript || '') : '';
      const restoredSummary = isResuming ? (resumeSnapshot.summary || '') : '';
      const restoredTopics = isResuming
        ? mergeUniqueTextArrays([], pickLatestItems(resumeSnapshot.keyTopics), 16)
        : [];
      const restoredDecisions = isResuming
        ? mergeUniqueTextArrays([], pickLatestItems(resumeSnapshot.keyDecisions), 16)
        : [];
      const restoredActions = isResuming
        ? mergeUniqueActionItems([], pickLatestItems(resumeSnapshot.actionItems), 14)
        : [];
      const restoredAdvice = isResuming
        ? mergeUniqueTextArrays([], pickLatestItems(resumeSnapshot.proactiveAdvice), 12)
        : [];
      const restoredUserNotes = isResuming ? (resumeSnapshot.userNotes || userLiveNotes || '') : '';

      setError(null);
      setLiveTranscript(restoredTranscript);
      setLiveInterim('');
      setLiveTopics(restoredTopics);
      setLiveDecisions(restoredDecisions);
      setLiveActionItems(restoredActions);
      setLiveAdvice(restoredAdvice);
      setLiveSummary(restoredSummary);
      if (isResuming) {
        if (restoredTitle) {
          setMeetingTitle(restoredTitle);
          liveAiTitleRef.current = restoredTitle;
        }
        if (restoredUserNotes) setUserLiveNotes(restoredUserNotes);
      }
      setLiveChatMessages([
        {
          role: 'assistant',
          text: isResuming
            ? `Sesión reanudada (${restoredTranscript.split(/\s+/).filter(Boolean).length} palabras conservadas). Continúo grabando y tomando notas en vivo.`
            : '¡Hola! Estoy grabando y tomando notas del seminario/reunión en tiempo real. Puedes preguntarme cualquier cosa sobre lo dicho hasta este instante sin cortar la grabación.'
        }
      ]);

      const sessionId = isResuming ? resumeSnapshot.id : ('meet_live_' + Date.now());
      const createdAt = (isResuming && resumeSnapshot.createdAt) ? resumeSnapshot.createdAt : new Date().toISOString();
      sessionMeetingIdRef.current = sessionId;
      sessionCreatedAtRef.current = createdAt;
      fullTranscriptRef.current = restoredTranscript;
      speechDeltaRef.current = '';
      pcmBufferRef.current = [];
      pcmSampleCountRef.current = 0;
      audioChunksRef.current = [];
      lastLiveAnalysisTimeRef.current = Date.now();
      lastCheckpointTimeRef.current = 0;
      autoSwitchedRef.current = false;

      stateRef.current = {
        ...stateRef.current,
        title: isResuming ? restoredTitle : meetingTitle,
        transcript: restoredTranscript,
        summary: restoredSummary,
        topics: restoredTopics,
        decisions: restoredDecisions,
        actionItems: restoredActions,
        advice: restoredAdvice,
        userNotes: restoredUserNotes
      };

      // Inicializar la caja negra en IndexedDB y preservar snapshot si se reanudó
      await initEmergencyRecording(isResuming ? restoredTitle : meetingTitle, sessionId);
      if (isResuming) {
        await saveLiveSessionSnapshot({
          id: sessionId,
          createdAt,
          title: restoredTitle || 'Sesión en Vivo',
          summary: restoredSummary,
          keyTopics: restoredTopics,
          keyDecisions: restoredDecisions,
          actionItems: restoredActions,
          proactiveAdvice: restoredAdvice,
          transcript: restoredTranscript,
          userNotes: restoredUserNotes
        });
      }

      // Abrir micrófonos físicos reales (ignorando Wonder Microphone / virtuales mudos)
      const mobile = isMobileDevice();
      const { streams, label: activeMicsLabel } = await openPhysicalAudioStreams(selectedDeviceId || 'auto-mix');

      const createdMs = isResuming && createdAt ? new Date(createdAt).getTime() : NaN;
      const keepElapsed = isResuming && Number.isFinite(createdMs) && createdMs <= Date.now() && (Date.now() - createdMs) < 16 * 3600 * 1000;
      const effectiveStart = keepElapsed ? createdMs : Date.now();

      zeroAudioSecondsRef.current = 0;
      setZeroMicWarning(false);
      isRecordingRef.current = true;
      setIsRecording(true);
      setRecordingTime(keepElapsed ? Math.floor((Date.now() - createdMs) / 1000) : 0);
      startTimeRef.current = effectiveStart;

      const analysisIntervalMs = mobile ? 15000 : 12000;
      await attachRecorderToStream(streams, analysisIntervalMs);

      // Web Worker timer inmune al throttling de pestañas en segundo plano / ventana minimizada
      try {
        if (workerTimerRef.current) workerTimerRef.current.terminate();
        const workerBlob = new Blob([
          'setInterval(() => { postMessage("tick"); }, 1000);'
        ], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(workerBlob);
        const worker = new Worker(workerUrl);
        URL.revokeObjectURL(workerUrl);
        worker.onmessage = async () => {
          if (!isRecordingRef.current || !startTimeRef.current) return;
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setRecordingTime(elapsed);

          if (audioLevelRef.current === 0) {
            zeroAudioSecondsRef.current += 1;
            if (zeroAudioSecondsRef.current >= 5 && !autoSwitchedRef.current) {
              autoSwitchedRef.current = true;
              try {
                if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                  mediaRecorderRef.current.onstop = null;
                  mediaRecorderRef.current.stop();
                }
                stopAllCaptureStreams();
                setSelectedDeviceId('auto-mix');
                const { streams: nextStreams, label: nextLabel } = await openPhysicalAudioStreams('auto-mix');
                if (isRecordingRef.current && nextStreams.length > 0) {
                  await attachRecorderToStream(nextStreams, analysisIntervalMs);
                  setLiveStatusMessage(`⚡ Auto-conmutado a micrófono físico real: ${nextLabel}`);
                }
              } catch (_) {}
            }
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

      // 4. Servicio Nativo en Primer Plano Android (Capacitor): evita suspensión con pantalla apagada
      try {
        window.Capacitor?.Plugins?.RecordingService?.start?.({
          title: restoredTitle || meetingTitle || 'Grabando sesión en vivo'
        })?.catch?.(() => {});
      } catch (_) {}

      // Reconocimiento de voz nativo en paralelo
      recognitionRef.current = initSpeechRecognition();
      setLiveStatusMessage(`🎙️ Capturando: ${activeMicsLabel} (resiste minimizado y cambio de pestañas).`);

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
      setLiveChatMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          text: data.answer || 'No pude procesar la consulta.',
          model: data.model || null,
          provider: data.provider || null,
          grounded: Boolean(data.grounded),
          sources: Array.isArray(data.sources) ? data.sources : []
        }
      ]);
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
      window.Capacitor?.Plugins?.RecordingService?.stop?.()?.catch?.(() => {});
    } catch (_) {}
    startTimeRef.current = null;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (_) {}
    }
    stopAllCaptureStreams();

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

  // Reanudar grabación continua sobre una sesión previa guardada en caja negra / nube
  const handleResumeUnfinalized = async () => {
    setRecovering(true);
    setError(null);
    try {
      const recovered = await recoverUnfinalizedAudio();
      let snap = recovered?.snapshot || null;
      if (!snap) {
        try {
          const backupRaw = localStorage.getItem('proactur_live_snapshot_backup');
          if (backupRaw) snap = JSON.parse(backupRaw);
        } catch (_) {}
      }
      if (!snap) {
        snap = {
          id: 'meet_live_' + Date.now(),
          createdAt: recovered?.startTime ? new Date(recovered.startTime).toISOString() : new Date().toISOString(),
          title: recovered?.title || 'Sesión Reanudada',
          summary: '',
          keyTopics: [],
          keyDecisions: [],
          actionItems: [],
          proactiveAdvice: [],
          transcript: '',
          userNotes: ''
        };
      }

      if (navigator.onLine && snap.id) {
        try {
          const res = await fetch(`${API}/api/meetings/${encodeURIComponent(snap.id)}`);
          if (res.ok) {
            const cloud = await res.json();
            if (cloud && cloud.id) {
              snap = {
                ...snap,
                title: cloud.title || snap.title,
                createdAt: cloud.createdAt || snap.createdAt,
                transcript: (cloud.transcript || '').length >= (snap.transcript || '').length ? cloud.transcript : snap.transcript,
                summary: (cloud.summary && !isPoisonedClientItem(cloud.summary)) ? cloud.summary : snap.summary,
                keyTopics: Array.isArray(cloud.keyTopics) && cloud.keyTopics.length > 0 ? cloud.keyTopics : snap.keyTopics,
                keyDecisions: Array.isArray(cloud.keyDecisions) && cloud.keyDecisions.length > 0 ? cloud.keyDecisions : snap.keyDecisions,
                actionItems: Array.isArray(cloud.actionItems) && cloud.actionItems.length > 0 ? cloud.actionItems : snap.actionItems,
                proactiveAdvice: Array.isArray(cloud.proactiveAdvice) && cloud.proactiveAdvice.length > 0 ? cloud.proactiveAdvice : snap.proactiveAdvice
              };
            }
          }
        } catch (_) {}
      }

      setHasRecoverableAudio(false);
      await startRecording(snap);
    } catch (err) {
      setError('No se pudo reanudar la sesión previa: ' + err.message);
    } finally {
      setRecovering(false);
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
        <div className="mb-5 p-4 rounded-2xl bg-amber-950/35 border border-amber-500/40 shadow-lg animate-fade-in flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
              <RotateCcw className="w-4 h-4 animate-spin-slow" />
            </div>
            <div className="min-w-0 flex-1">
              <h5 className="text-xs font-bold text-amber-200 leading-snug">
                Sesión Previa Recuperada en Disco Local
              </h5>
              <p className="text-[11px] text-slate-300 leading-relaxed mt-1">
                Se detectaron datos sin finalizar ({recoverableSeconds}) guardados en la caja negra antes del refresco o cierre.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full pt-1">
            <button
              type="button"
              onClick={handleResumeUnfinalized}
              disabled={recovering}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow transition-all"
            >
              {recovering ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <Play className="w-3.5 h-3.5 fill-slate-950 shrink-0" />}
              <span className="truncate">Continuar Grabando</span>
            </button>
            <button
              type="button"
              onClick={handleRecoverUnfinalized}
              disabled={recovering}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow transition-all"
            >
              {recovering ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <Sparkles className="w-3.5 h-3.5 shrink-0" />}
              <span className="truncate">Recuperar Minuta</span>
            </button>
            <button
              type="button"
              onClick={handleDiscardUnfinalized}
              disabled={recovering}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-900/70 hover:bg-slate-800 border border-slate-700/70 transition-colors"
            >
              Descartar
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
        <div className="w-full grid grid-cols-3 p-1 bg-slate-950/80 border border-slate-800/80 rounded-2xl mb-4 shadow-inner gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('record')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'record'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Mic className="w-3.5 h-3.5 shrink-0" />
            <span>En Vivo</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'upload'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Upload className="w-3.5 h-3.5 shrink-0" />
            <span>Subir Audio</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('text')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'text'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span>Minuta</span>
          </button>
        </div>
      )}

      {/* Titulo de la reunion con Acceso a Cuaderno Integrado */}
      {!isRecording && (
        <div className="mb-4">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold whitespace-nowrap">
              Título de la sesión
            </label>
            {onOpenNotebook && (
              <button
                type="button"
                onClick={onOpenNotebook}
                className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-bold transition-all active:scale-95 shrink-0 group px-2 py-0.5 rounded-lg hover:bg-amber-500/10 whitespace-nowrap"
                title="Abrir cuaderno ejecutivo de notas en pantalla completa"
              >
                <BookOpen className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
                <span>Cuaderno Fino</span>
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
            placeholder="Ej. Seminario o reunión (opcional, la IA lo titula)"
            className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
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
                onClick={() => startRecording(null)}
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
                        value={selectedDeviceId || 'auto-mix'}
                        onChange={async (e) => {
                          const newId = e.target.value;
                          setSelectedDeviceId(newId);
                          try {
                            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                              mediaRecorderRef.current.onstop = null;
                              mediaRecorderRef.current.stop();
                            }
                            stopAllCaptureStreams();
                            const { streams: nextStreams, label: nextLabel } = await openPhysicalAudioStreams(newId);
                            zeroAudioSecondsRef.current = 0;
                            setZeroMicWarning(false);
                            await attachRecorderToStream(nextStreams, isMobileDevice() ? 15000 : 12000);
                            setLiveStatusMessage(`✓ Capturando con: ${nextLabel}`);
                          } catch (switchErr) {
                            setLiveStatusMessage('⚠️ No se pudo cambiar de micrófono: ' + switchErr.message);
                          }
                        }}
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="auto-mix">🎙️ Automático (Micrófonos reales + Ganancia x2.5)</option>
                        {audioInputDevices.map((d, i) => (
                          <option key={d.deviceId || i} value={d.deviceId}>
                            {isVirtualOrSilentMic(d.label) ? `⚠️ ${d.label} (Virtual)` : (d.label || `Micrófono ${i + 1}`)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {audioCtxSuspended && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
                            await audioContextRef.current.resume();
                          }
                          if (audioContextRef.current?.state === 'running') {
                            setAudioCtxSuspended(false);
                          }
                        } catch (_) {}
                      }}
                      className="w-full p-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-200 text-xs font-bold flex items-center justify-center gap-2 transition-all animate-pulse"
                    >
                      <Volume2 className="w-4 h-4 text-emerald-300 shrink-0" />
                      <span>🔊 Haz clic aquí para reactivar el micrófono tras el refresco</span>
                    </button>
                  )}

                  {zeroMicWarning && audioLevel === 0 && !audioCtxSuspended && (
                    <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-[11px] leading-snug">
                      ⚠️ No entra señal del micrófono (0%). Si Chrome te pide arriba <strong>&quot;Volver a cargar&quot;</strong> por permisos o estás usando otro micrófono, recarga la página o cambia el <strong>Micrófono activo</strong> arriba.
                    </div>
                  )}
                </div>

                {/* Fila 3: Botones de Accion Lado a Lado en Móvil y Compactos en Desktop */}
                <div className="grid grid-cols-2 sm:flex sm:items-center sm:justify-end gap-2.5 sm:gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => triggerLiveAnalysis(userLiveNotes)}
                    disabled={isAnalyzingLive}
                    className="flex items-center justify-center gap-1.5 px-3 sm:px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold bg-slate-800/90 hover:bg-slate-700 text-indigo-300 border border-white/[0.08] hover:border-indigo-500/40 transition-all shadow-sm disabled:opacity-50 active:scale-95"
                  >
                    {isAnalyzingLive ? <Loader2 className="w-4 h-4 animate-spin text-amber-400 shrink-0" /> : <Zap className="w-4 h-4 text-amber-400 shrink-0" />}
                    <span className="truncate">{isAnalyzingLive ? 'Analizando...' : 'Analizar'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={stopAndFinalizeRecording}
                    className="flex items-center justify-center gap-1.5 px-3 sm:px-6 py-3 rounded-2xl text-xs sm:text-sm font-black bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-lg shadow-red-600/25 transition-all active:scale-95"
                  >
                    <Square className="w-3.5 h-3.5 fill-white shrink-0" />
                    <span className="truncate">Guardar Minuta</span>
                  </button>
                </div>
              </div>

              {/* PANEL UNIFICADO EN VIVO (4 Tabs en Móvil / 3 Tabs + Pilares en Desktop) */}
              <div className="bg-slate-900/90 border border-white/[0.08] rounded-3xl p-3 sm:p-5 shadow-xl space-y-4">
                {/* Control Segmentado de Pestañas */}
                <div className="grid grid-cols-4 md:grid-cols-3 p-1 bg-slate-950/90 rounded-2xl border border-white/[0.06] gap-1 shadow-inner">
                  <button
                    type="button"
                    onClick={() => setActiveLiveTab('summary')}
                    className={`md:hidden flex items-center justify-center gap-1 py-2.5 px-1.5 rounded-xl text-[11px] font-bold transition-all duration-200 ${
                      activeLiveTab === 'summary'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">En Vivo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveLiveTab('notes')}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-1.5 sm:px-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all duration-200 ${
                      activeLiveTab === 'notes'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/70'
                    }`}
                  >
                    <PenTool className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Notas</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveLiveTab('transcript')}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-1.5 sm:px-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all duration-200 ${
                      activeLiveTab === 'transcript'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-emerald-400/80 hover:text-emerald-300 hover:bg-slate-900/70'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      Texto ({(liveTranscript || '').split(/\s+/).filter(Boolean).length})
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveLiveTab('chat')}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-1.5 sm:px-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all duration-200 ${
                      activeLiveTab === 'chat'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-purple-400 hover:text-purple-300 hover:bg-slate-900/70'
                    }`}
                  >
                    <Brain className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">IA</span>
                  </button>
                </div>

                {/* Sub-barra de Modo de Entrada (Solo cuando la pestaña Notas está activa) */}
                {(activeLiveTab === 'notes' || (activeLiveTab === 'summary' && !isMobileDevice())) && (
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
                          <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                            m.role === 'user' ? 'bg-indigo-600 text-white whitespace-pre-wrap' : 'bg-slate-900 border border-slate-800 text-slate-200 space-y-1.5'
                          }`}>
                            {m.role === 'user' ? m.text : <MarkdownText text={m.text} />}
                            {m.role === 'assistant' && (m.model || m.grounded || (m.sources && m.sources.length > 0)) && (
                              <div className="pt-1.5 mt-1.5 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                                {m.model && (
                                  <span className="px-1.5 py-0.5 rounded-full bg-slate-950 border border-slate-700/70 text-slate-300 font-mono">
                                    {m.model}
                                  </span>
                                )}
                                {m.grounded && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold">
                                    <Globe className="w-2.5 h-2.5" /> Web
                                  </span>
                                )}
                                {Array.isArray(m.sources) && m.sources.slice(0, 2).map((src, sIdx) => (
                                  <a
                                    key={sIdx}
                                    href={src.uri}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 hover:text-indigo-200 truncate max-w-[140px]"
                                    title={src.title}
                                  >
                                    <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                    <span className="truncate">{src.title}</span>
                                  </a>
                                ))}
                              </div>
                            )}
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
                ) : activeLiveTab === 'summary' && isMobileDevice() ? null : (
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
              <div className={`${activeLiveTab === 'summary' ? 'grid' : 'hidden md:grid'} grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 pt-1 md:pt-2`}>
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
                        <p className="text-xs sm:text-sm text-slate-200 leading-relaxed max-h-[320px] overflow-y-auto pr-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800 whitespace-pre-line">
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
                      <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
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
                      <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
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
                      <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
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