import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Upload, FileText, Loader2, Sparkles, Volume2, AlertCircle } from 'lucide-react';

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

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      setError(null);
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

      mediaRecorder.start(250); // chunks every 250ms
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error accediendo al micrófono:', err);
      setError('No se pudo acceder al micrófono. Por favor permite los permisos en tu navegador.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!meetingTitle) {
        setMeetingTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
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
      const res = await fetch('/api/meetings/process-audio', {
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
    if (!rawText.trim()) {
      setError('Por favor introduce el contenido o notas de la reunión.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/meetings/process-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText,
          title: meetingTitle.trim() || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al procesar notas');
      }

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
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Tabs */}
      <div className="flex border-b border-slate-800 mb-6 gap-2">
        <button
          onClick={() => setActiveTab('record')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
            activeTab === 'record'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Mic className="w-4 h-4" />
          Grabar en Vivo
        </button>
        <button
          onClick={() => setActiveTab('upload')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
            activeTab === 'upload'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Upload className="w-4 h-4" />
          Subir Audio
        </button>
        <button
          onClick={() => setActiveTab('text')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
            activeTab === 'text'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          Pegar Minuta / Notas
        </button>
      </div>

      {/* Optional Title Input */}
      <div className="mb-4">
        <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1.5">
          Título de la Reunión (Opcional)
        </label>
        <input
          type="text"
          value={meetingTitle}
          onChange={(e) => setMeetingTitle(e.target.value)}
          placeholder="Ej. Sincronización Estratégica Semanal..."
          className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
        />
      </div>

      {/* TAB 1: Mic Recording */}
      {activeTab === 'record' && (
        <div className="flex flex-col items-center justify-center py-6">
          <div className="relative mb-6">
            {isRecording && (
              <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
            )}
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={loading}
              className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${
                isRecording
                  ? 'bg-red-600 hover:bg-red-700 text-white scale-105 shadow-red-500/30'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white hover:scale-105 shadow-indigo-500/30'
              }`}
            >
              {isRecording ? <Square className="w-8 h-8 fill-current" /> : <Mic className="w-8 h-8" />}
            </button>
          </div>

          <div className="text-center">
            {isRecording ? (
              <div>
                <div className="text-3xl font-mono font-bold text-red-400 tracking-wider mb-1">
                  {formatTime(recordingTime)}
                </div>
                <div className="flex items-center justify-center gap-2 text-xs text-red-300 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  Grabando reunión en vivo... Pulsa para detener
                </div>
              </div>
            ) : audioBlob ? (
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-emerald-400 font-medium">
                  <Volume2 className="w-4 h-4" />
                  Grabación lista ({formatTime(recordingTime)})
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setAudioBlob(null);
                      setRecordingTime(0);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  >
                    Descartar
                  </button>
                  <button
                    onClick={() => processAudioMeeting(audioBlob, 'reunion_grabada.webm')}
                    disabled={loading}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 transition-all"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Analizando con Proactor AI...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Analizar Reunión
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                Haz clic en el micrófono para comenzar a grabar la reunión
              </p>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Upload Audio File */}
      {activeTab === 'upload' && (
        <div className="py-4">
          <div className="border-2 border-dashed border-slate-700/80 hover:border-indigo-500/60 rounded-xl p-6 text-center transition-all bg-slate-800/30">
            <input
              type="file"
              id="audio-file-input"
              accept="audio/*,video/mp4,video/webm"
              onChange={handleFileUpload}
              className="hidden"
            />
            <label
              htmlFor="audio-file-input"
              className="cursor-pointer flex flex-col items-center justify-center gap-2"
            >
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-indigo-400">
                <Upload className="w-6 h-6" />
              </div>
              <span className="text-sm font-medium text-slate-200">
                {selectedFile ? selectedFile.name : 'Haz clic para seleccionar o arrastra tu archivo de audio'}
              </span>
              <span className="text-xs text-slate-400">
                Formatos compatibles: MP3, WAV, M4A, WEBM, MP4 (Hasta 50MB)
              </span>
            </label>
          </div>

          {selectedFile && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => processAudioMeeting(selectedFile, selectedFile.name)}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 transition-all"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Transcribiendo y analizando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Procesar con Proactor AI
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Paste Notes / Raw Text */}
      {activeTab === 'text' && (
        <div className="py-2">
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={5}
            placeholder="Pega aquí la transcripción automática de Teams/Zoom, notas desordenadas o apuntes de la reunión..."
            className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
          />
          <div className="mt-4 flex justify-end">
            <button
              onClick={processTextMeeting}
              disabled={loading || !rawText.trim()}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Estructurando con Proactor AI...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Estructurar y Extraer Tareas
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
