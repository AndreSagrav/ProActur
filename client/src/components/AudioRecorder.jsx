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

  // Medidor de voz en vivo (Audio Activity Analyzer)
  const [audioLevel, setAudioLevel] = useState(0);
  const isRecordingRef = useRef(false);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);

  // Estados del copiloto en tiempo real (Live ProActur AI)
  const [liveTranscript, setLiveTranscript] = useState('');
  const [liveInterim, setLiveInterim] = useState('');
  const [liveDecisions, setLiveDecisions] = useState([]);
  const [liveActionItems, setLiveActionItems] = useState([]);
  const [liveAdvice, setLiveAdvice] = useState([]);
  const [userLiveNotes, setUserLiveNotes] = useState('');
  const [liveNotesMode, setLiveNotesMode] = useState('keyboard'); // 'keyboard' | 'pencil'
  const [liveNotesStrokes, setLiveNotesStrokes] = useState([]);
  const [liveStatusMessage, setLiveStatusMessage] = useState('');
  const [activeLiveTab, setActiveLiveTab] = useState('notes'); // 'notes' | 'chat'
  const [liveChatMessages, setLiveChatMessages] = useState([
    { role: 'assistant', text: '¡Hola! Estoy escuchando la reunión. Puedes hacerme preguntas en vivo o pedirme que registre acuerdos o tareas puntuales.' }
  ]);
  const [liveChatInput, setLiveChatInput] = useState('');
  const [liveChatLoading, setLiveChatLoading] = useState(false);
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
    userNotes: userLiveNotes,
      decisions: liveDecisions,
      actionItems: liveActionItems,
      advice: liveAdvice,
      summary: liveSummary,
      title: meetingTitle,
      isRecording,
      isAnalyzing: isAnalyzingLive
    };
  }, [liveTranscript, liveDecisions, liveActionItems, liveAdvice, liveSummary, meetingTitle, isRecording, isAnalyzingLive]);

  // Sincronización continua de estado con la aplicación y Dynamic Island
  useEffect(() => {
    if (recorderRef) {
      recorderRef.current = {
        stopAndFinalize: stopAndFinalizeRecording,
        triggerAnalysis: triggerLiveAnalysis
      };
    }
  }, [meetingTitle, liveDecisions, liveActionItems, liveSummary, liveTranscript]);

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
        }, 1500);
      }
    };

    const handleOffline = () => {
      console.warn('[ProActur Network] Pérdida de conexión a internet.');
      if (isRecordingRef.current) {
        setLiveStatusMessage('📡 Sin internet: Grabación segura en disco (Caja Negra). Se sincronizará al reconectar.');
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
        setAudioLevel(normalized);

        animFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (err) {
      console.warn('[AudioContext] Error en setupAudioAnalyzer:', err);
    }
  };

  // Reconocimiento de voz continuo en segundo plano
  const initSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[ProActur] SpeechRecognition no disponible en este navegador/WebView. Se usará Whisper del servidor.');
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

  // Analisis incremental continuo con Gemini enviando audio y notas en vivo
  const triggerLiveAnalysis = async (explicitNotes = null) => {
    const current = stateRef.current;
    if (!isRecordingRef.current || current.isAnalyzing) return;

    // Si no hay internet, no intentamos llamar a la nube: el micrófono sigue grabando en disco local
    if (!navigator.onLine) {
      setLiveStatusMessage('📡 Sin conexión: Audio seguro en disco (Caja Negra). Esperando internet...');
      return;
    }

    const externalNotes = typeof externalNotebookNotes === 'string' ? externalNotebookNotes : '';
    const internalNotes = typeof explicitNotes === 'string' ? explicitNotes : (current.userNotes || '');
    const notesToUse = [internalNotes, externalNotes].filter(Boolean).join('\n\n');
    const userNotesText = notesToUse.trim();
    const textToAnalyze = (current.transcript || '').trim();
    const hasAudio = audioChunksRef.current && audioChunksRef.current.length > 0;

    if (!hasAudio && textToAnalyze.length < 3 && userNotesText.length < 3) {
      setLiveStatusMessage('ℹ️ Habla al micrófono o escribe notas para que la IA extraiga acuerdos.');
      return;
    }

    setIsAnalyzingLive(true);
    setLiveStatusMessage('⚡ Analizando con IA...');

    const controller = new AbortController();
    // MOBILE FIX: 20s en móvil (red lenta + Whisper + Gemini), 8s en desktop
    const timeoutMs = isMobileDevice() ? 20000 : 8000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // Payload JSON (compatible con Vercel Serverless — no usa multipart/FormData)
      const payload = {
        title: current.title || 'Reunión en Vivo',
        transcript: textToAnalyze || '',
        userNotes: userNotesText || ''
      };

      // Empaquetar audio reciente para envío al servidor (Whisper / Gemini multimodal)
      if (hasAudio) {
        try {
          const recordedMime = mediaRecorderRef.current?.mimeType || 'audio/webm';
          // Tomar los últimos chunks disponibles manteniendo encabezados válidos
          const totalChunks = audioChunksRef.current.length;
          const chunksToSend = totalChunks <= 25
            ? audioChunksRef.current
            : [audioChunksRef.current[0], ...audioChunksRef.current.slice(-20)];
          
          const audioBlob = new Blob(chunksToSend, { type: recordedMime });
          if (audioBlob.size > 500) {
            const arrayBuf = await audioBlob.arrayBuffer();
            const bytes = new Uint8Array(arrayBuf);
            let binary = '';
            const chunkSize = 8192;
            for (let i = 0; i < bytes.length; i += chunkSize) {
              const sub = bytes.subarray(i, i + chunkSize);
              binary += String.fromCharCode.apply(null, sub);
            }
            payload.audioBase64 = btoa(binary);
            payload.audioMimeType = recordedMime;
          }
        } catch (packErr) {
          console.warn('[Audio Packing Warn]:', packErr.message);
        }
      }

      if (current.actionItems.length > 0 || current.decisions.length > 0) {
        payload.previousContext = {
          actionItems: current.actionItems,
          keyDecisions: current.decisions
        };
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
      if (data.title && typeof data.title === 'string' && data.title.trim().length > 3) {
        liveAiTitleRef.current = data.title.trim();
        if (!userEditedTitleRef.current) {
          setMeetingTitle(data.title.trim());
        }
      }
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
      if (data.transcript) {
        setLiveTranscript(data.transcript);
      }
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLiveStatusMessage(`✓ Actualizado (${timeStr})`);
    } catch (err) {
      if (err.name === 'AbortError') {
        console.warn('[Live Analysis] Request timeout, reanudando...');
        setLiveStatusMessage('⚡ Reanudando escucha...');
      } else {
        console.warn('[Live Analysis Warn]', err.message);
        setLiveStatusMessage(`Aviso: ${err.message}`);
      }
    } finally {
      clearTimeout(timeoutId);
      setIsAnalyzingLive(false); // Siempre se libera inmediatamente
    }
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
      setLiveDecisions([]);
      setLiveActionItems([]);
      setLiveAdvice([]);
      setLiveSummary('');

      // Inicializar la caja negra en IndexedDB
      await initEmergencyRecording(meetingTitle);

      // Solicitar micrófono con constraints optimizadas para móvil
      const mobile = isMobileDevice();
      let stream;
      try {
        const audioConstraints = mobile
          ? {
              // MOBILE: NO pedir sampleRate fijo (muchos Android no soportan 44100)
              // NO activar noiseSuppression (Android la aplica muy agresivamente, aplana la señal)
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
        stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      } catch (micErr) {
        // Reintentar con constraint mínima si la primera falla
        console.warn('[ProActur Mic] Reintentando con constraint básica:', micErr.message);
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      isRecordingRef.current = true;
      setIsRecording(true);

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

      // MOBILE FIX: Si SpeechRecognition no está disponible (WebView),
      // forzar análisis temprano para que Whisper transcriba el audio del servidor
      if (!recognitionRef.current) {
        console.log('[ProActur Mobile] SpeechRecognition no disponible, activando Whisper remoto');
        setLiveStatusMessage('🎙️ Modo WebView: Transcripción vía servidor activada');
        // Primer análisis después de 5 segundos para acumular audio suficiente
        setTimeout(() => {
          if (isRecordingRef.current) triggerLiveAnalysis();
        }, 5000);
      }

      // Análisis periódico: 15s en móvil (más tiempo para red + Whisper), 10s en desktop
      const analysisInterval = isMobileDevice() ? 15000 : 10000;
      liveAnalysisTimerRef.current = setInterval(() => {
        triggerLiveAnalysis();
      }, analysisInterval);

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
      const res = await fetch(`${API}/api/second-brain/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: `[Reunión en Curso: "${current.title || 'Sesión en vivo'}" | Notas: "${current.userNotes || ''}" | Transcripción: "${current.transcript || ''}"] Pregunta del usuario: ${q}`
        })
      });
      const data = await res.json();
      setLiveChatMessages(prev => [...prev, { role: 'assistant', text: data.answer || 'No pude procesar la consulta.' }]);
    } catch (e) {
      setLiveChatMessages(prev => [...prev, { role: 'assistant', text: 'Error conectando con la IA: ' + e.message }]);
    } finally {
      setLiveChatLoading(false);
    }
  };

  const stopAndFinalizeRecording = async () => {
    isRecordingRef.current = false;
    setAudioLevel(0);
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
            title: userEditedTitleRef.current ? current.title.trim() : (liveAiTitleRef.current || current.title.trim()),
            aiTitle: liveAiTitleRef.current || undefined,
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-3">
                    <div className="relative flex items-center justify-center shrink-0">
                      <span className="absolute w-5 h-5 rounded-full bg-red-500/40 animate-ping" />
                      <span className="w-3.5 h-3.5 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl sm:text-2xl font-black text-slate-100 font-mono tracking-tight">
                          {formatTime(recordingTime)}
                        </span>
                        <span className="px-2.5 py-1 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 text-xs font-black uppercase tracking-wider">
                          ● En Vivo
                        </span>
                        {isAnalyzingLive && (
                          <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-xs font-bold flex items-center gap-1.5 animate-pulse">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Analizando con IA...</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1 font-medium">
                        {meetingTitle || 'Reunión en vivo'} &bull; Escucha activa y estructuración continua
                      </p>
                    </div>
                  </div>

                  {/* Estado de la Grabacion / Caja Negra */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Caja Negra Activa</span>
                    </div>
                  </div>
                </div>

                {/* Fila 2: Ecualizador de Voz Amplio con Diagnostico Claro */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                          : 'Micrófono en silencio o esperando que comiences a hablar'}
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

                            {/* PANEL DUAL: MIS NOTAS EN VIVO & CHAT CON LA IA DE LA SESION */}
              <div className="bg-slate-900/90 border border-indigo-500/30 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-4">
                {/* Control Segmentado Premium de Pestañas (100% responsive sin solapamiento) */}
                <div className="grid grid-cols-2 p-1.5 bg-slate-950/90 rounded-2xl border border-slate-800/80 gap-1.5 shadow-inner">
                  <button
                    type="button"
                    onClick={() => setActiveLiveTab('notes')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 ${
                      activeLiveTab === 'notes'
                        ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-500/25'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/70'
                    }`}
                  >
                    <PenTool className="w-4 h-4 shrink-0" />
                    <span className="truncate">Notas en Vivo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveLiveTab('chat')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 ${
                      activeLiveTab === 'chat'
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25'
                        : 'text-purple-400 hover:text-purple-300 hover:bg-slate-900/70'
                    }`}
                  >
                    <Brain className="w-4 h-4 shrink-0" />
                    <span className="truncate">Copiloto IA</span>
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
                {activeLiveTab === 'chat' ? (
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
                            m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-200'
                          }`}>
                            {m.text}
                          </div>
                        </div>
                      ))}
                      {liveChatLoading && (
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                          <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                          <span>La IA está consultando la reunión en vivo...</span>
                        </div>
                      )}
                    </div>

                    <form onSubmit={(e) => { e.preventDefault(); askSessionAi(liveChatInput); }} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={liveChatInput}
                        onChange={(e) => setLiveChatInput(e.target.value)}
                        placeholder="Pregúntale a la IA en vivo: '¿Qué acuerdos llevamos?', 'Anota que la entrega es el viernes'..."
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
                      <p className="text-xs sm:text-sm text-slate-200 leading-relaxed max-h-[160px] overflow-y-auto pr-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800">
                        {liveSummary}
                      </p>
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