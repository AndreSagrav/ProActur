import React, { useState, useEffect, useCallback, useRef } from 'react';;
import {
  Sparkles, Brain, Settings, Palette, Plus, Search, Calendar, Share2, CheckCircle2,
  Clock, CheckSquare, ChevronRight, Radio, FileText, BookOpen, PenTool,
  ArrowLeft, Activity, ShieldCheck, GitMerge, Loader2, X
} from 'lucide-react';

import AudioRecorder from './components/AudioRecorder';
import MeetingDetails from './components/MeetingDetails';
import SecondBrainModal from './components/SecondBrainModal';
import ChatView from './components/ChatView';
import SettingsModal from './components/SettingsModal';
import ThemeSelectorModal from './components/ThemeSelectorModal';
import { useTheme } from './context/ThemeContext.jsx';
import CalendarView from './components/CalendarView';
import EventModal from './components/EventModal';
import NotebookList from './components/NotebookList';
import NoteEditor from './components/NoteEditor';
import ExecutiveNotebook from './components/ExecutiveNotebook';

const API = import.meta.env.VITE_API_URL || '';

export default function App() {
  const { theme, setTheme, THEMES, fontSize, setFontSize } = useTheme();
  const [meetings, setMeetings] = useState([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMergeMode, setIsMergeMode] = useState(false);
  const [selectedMergeIds, setSelectedMergeIds] = useState([]);
  const [isMerging, setIsMerging] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeDirective, setMergeDirective] = useState('');
  const [mergeSuccessToast, setMergeSuccessToast] = useState('');
  const [healthData, setHealthData] = useState(null);
  const [keepAliveData, setKeepAliveData] = useState(null);
  const [isSecondBrainOpen, setIsSecondBrainOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isThemeOpen, setIsThemeOpen] = useState(false);

  // Tabs: 'meetings' | 'calendar' | 'notebook'
  const [activeTab, setActiveTab] = useState('meetings');

  // En movil, controla si mostramos la lista o el detalle de reunion
  const [showMobileDetail, setShowMobileDetail] = useState(false);

  // Calendar state
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventInitialDate, setEventInitialDate] = useState(null);

  // Estado de Grabación Persistente en 2do Plano (Zero-Interrupción)
  const recorderRef = useRef(null);
  const [recordingState, setRecordingState] = useState({
    isRecording: false,
    recordingTime: 0,
    audioLevel: 0,
    decisionsCount: 0,
    actionItemsCount: 0,
    title: ''
  });
  const [executiveNotebookText, setExecutiveNotebookText] = useState('');
  const [showNotebookOverlay, setShowNotebookOverlay] = useState(false);
  const [notebookViewMode, setNotebookViewMode] = useState('executive'); // 'executive' | 'list'

  // Notebook state
  const [selectedNote, setSelectedNote] = useState(null);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [linkedMeetingForNote, setLinkedMeetingForNote] = useState(null);

  // Carga inicial y heartbeat keep-alive
  useEffect(() => {
    fetchMeetings();
    fetchHealth();
    triggerKeepAlive();

    // Heartbeat proactivo cada 15 minutos para mantener Supabase caliente
    const interval = setInterval(() => {
      triggerKeepAlive();
    }, 15 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const triggerKeepAlive = async () => {
    try {
      const res = await fetch(`${API}/api/keep-alive`);
      if (res.ok) {
        const data = await res.json();
        setKeepAliveData(data);
      }
    } catch (err) {
      console.warn('[Keep-Alive] Ping warn:', err.message);
    }
  };

  const fetchMeetings = async () => {
    try {
      const res = await fetch(`${API}/api/meetings`);
      if (res.ok) {
        const data = await res.json();
        setMeetings(data);
        if (data.length > 0 && !selectedMeetingId) {
          setSelectedMeetingId(data[0].id);
        }
      }
    } catch (err) {
      console.error('Error cargando reuniones:', err);
    }
  };

  const fetchHealth = async () => {
    try {
      const res = await fetch(`${API}/api/health`);
      if (res.ok) setHealthData(await res.json());
    } catch (err) {
      console.error('Error en health check:', err);
    }
  };

  const handleMergeMeetings = async () => {
    if (selectedMergeIds.length < 2 || isMerging) return;
    setIsMerging(true);
    try {
      const res = await fetch(`${API}/api/meetings/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingIds: selectedMergeIds,
          directive: mergeDirective.trim()
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const mergedMeeting = await res.json();
      setMeetings(prev => [mergedMeeting, ...prev]);
      setSelectedMeetingId(mergedMeeting.id);
      setShowMobileDetail(true);
      setIsMergeMode(false);
      setSelectedMergeIds([]);
      setShowMergeModal(false);
      setMergeDirective('');
      setMergeSuccessToast('¡Minuta Maestra creada con éxito a partir de las sesiones fusionadas!');
      setTimeout(() => setMergeSuccessToast(''), 4500);
    } catch (err) {
      console.error('[Merge Error]', err);
      alert('Error al fusionar sesiones: ' + err.message);
    } finally {
      setIsMerging(false);
    }
  };

  const handleMeetingProcessed = (meeting) => {
    setMeetings(prev => [meeting, ...prev]);
    setSelectedMeetingId(meeting.id);
    setActiveTab('meetings');
    setShowMobileDetail(true);
  };

  const handleUpdateMeeting = async (id, updates) => {
    try {
      const res = await fetch(`${API}/api/meetings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const updated = await res.json();
        setMeetings(prev => prev.map(m => m.id === id ? updated : m));
      }
    } catch (err) {
      console.error('Error actualizando reunion:', err);
    }
  };

  const handleDeleteMeeting = async (id) => {
    if (!confirm('Eliminar esta reunion y todas sus notas?')) return;
    try {
      await fetch(`${API}/api/meetings/${id}`, { method: 'DELETE' });
      setMeetings(prev => prev.filter(m => m.id !== id));
      setSelectedMeetingId(null);
      setShowMobileDetail(false);
    } catch (err) {
      console.error('Error eliminando reunion:', err);
    }
  };

  // Calendar handlers
  const handleCreateEvent = (opts = {}) => {
    setEditingEvent(null);
    setEventInitialDate(opts.date || new Date());
    setEventModalOpen(true);
  };

  const handleEditEvent = (event) => {
    setEditingEvent(event);
    setEventInitialDate(null);
    setEventModalOpen(true);
  };

  const handleEventSaved = () => {
    setEventModalOpen(false);
    setEditingEvent(null);
  };

  const handleSelectMeetingFromCalendar = (meetingId) => {
    setSelectedMeetingId(meetingId);
    setActiveTab('meetings');
    setShowMobileDetail(true);
  };

  // Notebook handlers
    const handleSaveExecutiveNote = async (noteData) => {
    try {
      const res = await fetch(`${API}/api/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: noteData.title,
          content: noteData.content,
          meetingId: selectedMeeting?.id || null,
          tags: ['cuaderno-ejecutivo', noteData.paperStyle]
        })
      });
      if (res.ok) {
        // Recargar notas si se desea
      }
    } catch (e) {
      console.error('Error guardando nota ejecutiva:', e);
    }
  };

const handleNewNote = (linkedMeeting = null) => {
    setSelectedNote(null);
    setLinkedMeetingForNote(linkedMeeting);
    setIsEditingNote(true);
  };

  const handleSelectNote = (note) => {
    setSelectedNote(note);
    setLinkedMeetingForNote(null);
    setIsEditingNote(true);
  };

  const handleNoteSaved = (savedNote) => {
    setSelectedNote(savedNote);
    setIsEditingNote(false);
  };

  // Schedule follow-up from MeetingDetails
  const handleScheduleFollowUp = (meeting) => {
    setEditingEvent(null);
    setEventInitialDate(new Date());
    setEventModalOpen(true);
  };

  const handleCreateNoteFromMeeting = (meeting) => {
    setActiveTab('notebook');
    setLinkedMeetingForNote(meeting);
    setSelectedNote(null);
    setIsEditingNote(true);
  };

  const selectedMeeting = meetings.find(m => m.id === selectedMeetingId);

  const filteredMeetings = meetings.filter(m => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (m.title || '').toLowerCase().includes(q) ||
      (m.summary || '').toLowerCase().includes(q) ||
      (m.tags || []).some(t => t.toLowerCase().includes(q))
    );
  });

  const TABS = [
    { key: 'meetings', label: 'Reuniones', icon: FileText },
    { key: 'chat', label: 'Chat con IA', icon: Brain },
    { key: 'notebook', label: 'Cuaderno Ejecutivo', icon: BookOpen },
    { key: 'calendar', label: 'Agenda', icon: Calendar },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col pb-20 lg:pb-6">
      {/* Header Responsivo */}
      <header className="border-b border-slate-800/80 bg-slate-950/95 backdrop-blur-2xl sticky top-0 z-40 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 space-y-3">
          {/* Fila Superior: Logo, Titulo, Estado del Sistema y Ajustes */}
          <div className="flex items-center justify-between gap-4">
            {/* Logo y Titulo */}
            <div className="flex items-center gap-3">
              <div className="relative group shrink-0">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur-sm opacity-50 group-hover:opacity-100 transition duration-300" />
                <img
                  src="/favicon.svg"
                  alt="ProActur Logo"
                  className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl shadow-2xl shadow-indigo-500/40 shrink-0 object-cover border border-white/25 ring-2 ring-indigo-500/30 transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white leading-none bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text">
                    ProActur
                  </h1>
                  <span className="text-[11px] sm:text-xs px-2.5 py-0.5 rounded-full bg-gradient-to-r from-indigo-500/25 to-purple-500/25 text-indigo-300 font-extrabold border border-indigo-500/40 shadow-sm">
                    AI Proactivo
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 hidden sm:block font-medium">
                  Copiloto ejecutivo de reuniones, libretas canvas y segundo cerebro
                </p>
              </div>
            </div>

            {/* Acciones de Cabecera: Supabase, Temas Modal y Ajustes */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* Indicador Supabase Activo */}
              {keepAliveData?.success && (
                <div
                  className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  title={`Supabase activo: Latencia ${keepAliveData.latencyMs}ms`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Base de Datos Activa</span>
                </div>
              )}

              {/* Boton Accesibilidad */}
              <button
                onClick={() => setIsThemeOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all shadow-sm"
                title="Configuración de Accesibilidad y Guía de Daltonismo"
              >
                <Palette className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Accesibilidad</span>
              </button>

              {/* Ajustes */}
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors border border-slate-800 hover:border-slate-700"
                title="Diagnóstico del Sistema"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Fila Inferior: Navegacion Principal Holgada + Selector de Temas Visible */}
          <div className="hidden md:flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
            {/* Pestañas de Navegacion con Espacio Vertical y Sin Compresion */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-2xl p-1.5 shadow-inner gap-1 overflow-x-auto">
              {TABS.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => {
                      setActiveTab(tab.key);
                      if (tab.key === 'meetings') setShowMobileDetail(false);
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Selector de Temas Holgado con Etiquetas de Color y Escalador de Fuente */}
            <div className="flex items-center justify-between sm:justify-end gap-2 bg-slate-900 border border-slate-800 rounded-2xl px-3 py-1.5 shadow-inner">
              <span className="text-xs text-slate-400 font-bold whitespace-nowrap">Temas:</span>
              <div className="flex items-center gap-1.5">
                {THEMES && Object.values(THEMES).map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTheme(t.id)}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all text-xs border ${
                      theme === t.id
                        ? 'ring-2 ring-indigo-500 border-white scale-110 shadow-lg font-bold'
                        : 'border-slate-700/60 opacity-75 hover:opacity-100 hover:scale-105'
                    }`}
                    style={{ backgroundColor: t.previewColor }}
                    title={`${t.name}: ${t.desc || t.label}`}
                  >
                    <span>{t.icon}</span>
                  </button>
                ))}
              </div></div>
          </div>
        </div>
      </header>

      {/* Contenedor Principal Adaptativo */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 flex-1 w-full relative">
        {/* PÍLDORA DINÁMICA FLOTANTE (DYNAMIC ISLAND): Grabación e IA activas en 2do plano */}
        {recordingState.isRecording && activeTab !== 'meetings' && (
          <div className="sticky top-2 z-50 max-w-xl mx-auto px-2 mb-4 animate-fade-in">
            <div className="bg-slate-950/95 border border-red-500/50 rounded-full px-4 sm:px-5 py-2.5 shadow-2xl shadow-red-500/20 backdrop-blur-2xl flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="relative flex h-3 w-3 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <span className="font-mono font-black text-slate-100 text-xs sm:text-sm shrink-0">
                  {Math.floor(recordingState.recordingTime / 60).toString().padStart(2, '0')}:{(recordingState.recordingTime % 60).toString().padStart(2, '0')}
                </span>
                <div className="hidden sm:flex items-center gap-0.5 h-3.5 w-10 shrink-0">
                  {[...Array(6)].map((_, i) => (
                    <span
                      key={i}
                      className={`w-1 rounded-full transition-all duration-75 ${
                        recordingState.audioLevel > i * 16 ? 'bg-red-400 h-3.5' : 'bg-slate-800 h-1'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[11px] text-slate-300 font-medium truncate">
                  {recordingState.decisionsCount > 0 ? `${recordingState.decisionsCount} acuerdos en vivo` : 'IA escuchando...'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('meetings')}
                  className="px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold text-xs border border-slate-700 transition-all active:scale-95 shadow-sm"
                >
                  Ver Reunión
                </button>
                <button
                  type="button"
                  onClick={() => recorderRef.current?.stopAndFinalize?.()}
                  className="px-3 py-1.5 rounded-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs shadow-md transition-all active:scale-95"
                >
                  Finalizar
                </button>
              </div>
            </div>
          </div>
        )}
        {/* =================================================================== */}
        {/* PESTAÑA: REUNIONES                                                  */}
        {/* =================================================================== */}
        <div className={activeTab === 'meetings' ? 'block' : 'hidden'}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
            {/* Columna Izquierda: Grabadora + Lista de Reuniones (Desktop o Movil si no hay detalle) */}
            <aside className={`lg:col-span-4 flex flex-col gap-4 ${showMobileDetail ? 'hidden lg:flex' : 'flex'}`}>
              {/* Grabador de Audio siempre visible en el listado para movil y desktop */}
              <div className="lg:hidden">
                <AudioRecorder
                  onMeetingProcessed={handleMeetingProcessed}
                  onRecordingStatusChange={(st) => setRecordingState(st)}
                  externalNotebookNotes={executiveNotebookText}
                  recorderRef={recorderRef}
                  onOpenNotebook={() => setShowNotebookOverlay(true)}
                />
              </div>

              {/* Encabezado de Historial con Buscador y Fusión */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-400" />
                    Reuniones ({filteredMeetings.length})
                  </h3>
                  <div className="flex items-center gap-1.5">
                    {filteredMeetings.length >= 2 && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsMergeMode(!isMergeMode);
                          setSelectedMergeIds([]);
                        }}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                          isMergeMode
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
                        }`}
                        title="Fusionar múltiples reuniones (ej. capacitaciones de varios días o serie de proyectos)"
                      >
                        <GitMerge className="w-3.5 h-3.5 text-amber-400" />
                        <span>{isMergeMode ? 'Cancelar' : 'Fusionar'}</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setSelectedMeetingId(null);
                        setShowMobileDetail(false);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Nueva
                    </button>
                  </div>
                </div>

                {/* Banner Activo de Selección Múltiple para Fusión */}
                {isMergeMode && (
                  <div className="p-3 bg-gradient-to-r from-amber-500/15 via-indigo-500/15 to-purple-500/15 border border-amber-500/40 rounded-xl shadow-lg space-y-2 animate-fade-in">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-amber-200 flex items-center gap-1.5">
                        <GitMerge className="w-4 h-4 text-amber-400" />
                        {selectedMergeIds.length} seleccionadas
                      </span>
                      <button
                        type="button"
                        disabled={selectedMergeIds.length < 2 || isMerging}
                        onClick={() => setShowMergeModal(true)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow ${
                          selectedMergeIds.length >= 2 && !isMerging
                            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                        }`}
                      >
                        {isMerging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        <span>Fusionar con IA</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      Marca 2 o más sesiones para que la IA genere una Minuta Maestra consolidada de capacitación.
                    </p>
                  </div>
                )}

                {mergeSuccessToast && (
                  <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-medium flex items-center gap-2 animate-fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{mergeSuccessToast}</span>
                  </div>
                )}

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar reuniones o temas..."
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              {/* Lista de Reuniones */}
              <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
                {filteredMeetings.length === 0 ? (
                  <div className="p-8 text-center bg-slate-900/40 border border-slate-800/60 rounded-2xl text-xs text-slate-500">
                    No hay reuniones registradas todavía. Graba o sube un audio para empezar.
                  </div>
                ) : (
                  filteredMeetings.map((m) => {
                    const isSelected = m.id === selectedMeetingId;
                    const tasksCount = m.actionItems?.length || 0;
                    const isChecked = selectedMergeIds.includes(m.id);

                    return (
                      <div
                        key={m.id}
                        onClick={() => {
                          if (isMergeMode) {
                            if (isChecked) {
                              setSelectedMergeIds(prev => prev.filter(id => id !== m.id));
                            } else {
                              setSelectedMergeIds(prev => [...prev, m.id]);
                            }
                          } else {
                            setSelectedMeetingId(m.id);
                            setShowMobileDetail(true);
                          }
                        }}
                        className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer text-left relative overflow-hidden group ${
                          isChecked
                            ? 'bg-amber-950/25 border-amber-500/60 shadow-md shadow-amber-500/10'
                            : isSelected
                            ? 'bg-slate-800/90 border-indigo-500/60 shadow-lg shadow-indigo-500/10'
                            : 'bg-slate-900/70 hover:bg-slate-800/60 border-slate-800'
                        }`}
                      >
                        {isSelected && !isMergeMode && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />}
                        {isChecked && <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500" />}

                        <div className="flex items-start gap-3">
                          {isMergeMode && (
                            <div className="pt-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedMergeIds(prev => [...prev, m.id]);
                                  } else {
                                    setSelectedMergeIds(prev => prev.filter(id => id !== m.id));
                                  }
                                }}
                                className="w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-400 bg-slate-900 cursor-pointer"
                              />
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(m.createdAt || Date.now()).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}
                              </span>

                              {(m.isMergedSeries || m.source === 'merged-series') && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                                  <GitMerge className="w-3 h-3" />
                                  Maestra
                                </span>
                              )}
                            </div>

                            <h4 className="text-sm font-semibold text-slate-100 group-hover:text-indigo-300 transition-colors line-clamp-1">
                              {m.title || 'Reunión sin título'}
                            </h4>
                            <p className="text-xs text-slate-400 line-clamp-2 mt-1">{m.summary}</p>
                            <div className="flex items-center justify-between mt-3 text-[11px] text-slate-500 border-t border-slate-800/80 pt-2">
                              <span className="flex items-center gap-1">
                                <CheckSquare className="w-3 h-3" /> {tasksCount} tareas
                              </span>
                              <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-300 transition-colors" />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </aside>

            {/* Columna Derecha: AudioRecorder (Desktop) + Detalle de Reunion */}
            <section className={`lg:col-span-8 space-y-5 sm:space-y-6 ${!showMobileDetail ? 'hidden lg:block' : 'block'}`}>
              {/* Boton de regreso en vista movil */}
              <div className="lg:hidden">
                <button
                  onClick={() => setShowMobileDetail(false)}
                  className="flex items-center gap-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300 mb-2 py-1 px-2 rounded-lg bg-indigo-950/40 border border-indigo-900/50"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Volver al listado de reuniones
                </button>
              </div>

              {/* Grabador en desktop */}
              <div className="hidden lg:block">
                <AudioRecorder
                  onMeetingProcessed={handleMeetingProcessed}
                  onRecordingStatusChange={(st) => setRecordingState(st)}
                  externalNotebookNotes={executiveNotebookText}
                  recorderRef={recorderRef}
                  onOpenNotebook={() => setShowNotebookOverlay(true)}
                />
              </div>

                            {/* Detalle de reunión seleccionada */}
              {selectedMeeting && (
                <MeetingDetails
                  meeting={selectedMeeting}
                  onUpdateMeeting={handleUpdateMeeting}
                  onDeleteMeeting={handleDeleteMeeting}
                  onScheduleFollowUp={handleScheduleFollowUp}
                  onCreateNote={handleCreateNoteFromMeeting}
                />
              )}
            </section>
          </div>
        </div>

        {/* =================================================================== */}
        {/* PESTAÑA: AGENDA / CALENDARIO                                        */}
        {/* =================================================================== */}
        {activeTab === 'calendar' && (
          <div className="w-full">
            <CalendarView
              onSelectMeeting={handleSelectMeetingFromCalendar}
              onCreateEvent={handleCreateEvent}
              onEditEvent={handleEditEvent}
            />
          </div>
        )}

        {/* =================================================================== */}
        {/* PESTAÑA: LIBRETA DE NOTAS                                           */}
        {/* =================================================================== */}
        {/* =================================================================== */}
        {/* PESTAÑA: CHAT CON IA (SEGUNDO CEREBRO A PANTALLA COMPLETA)           */}
        {/* =================================================================== */}
        {activeTab === 'chat' && (
          <div className="w-full">
            <ChatView totalMeetings={meetings.length} />
          </div>
        )}

        {/* =================================================================== */}
        {/* PESTAÑA: LIBRETA CANVAS                                             */}
        {/* =================================================================== */}
        {/* PESTAÑA: LIBRETA / CUADERNO EJECUTIVO                               */}
        {/* =================================================================== */}
        {activeTab === 'notebook' && (
          <div className="w-full space-y-4">
            {/* Header con botón para abrir el cuaderno */}
            <div className="flex items-center justify-between bg-slate-900/80 border border-slate-800/80 rounded-2xl p-3 px-4 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-200">Archivo de Notas</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNotebookOverlay(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-indigo-600 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all active:scale-95"
              >
                <BookOpen className="w-4 h-4" />
                <span>Abrir Cuaderno</span>
              </button>
            </div>

            <div className="w-full">
              {isEditingNote ? (
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden min-h-[75vh]">
                  <NoteEditor
                    note={selectedNote}
                    linkedMeeting={linkedMeetingForNote}
                    meetings={meetings}
                    onSave={handleNoteSaved}
                    onClose={() => {
                      setIsEditingNote(false);
                      setSelectedNote(null);
                      setLinkedMeetingForNote(null);
                    }}
                  />
                </div>
              ) : (
                <NotebookList
                  onSelectNote={handleSelectNote}
                  onNewNote={() => handleNewNote()}
                />
              )}
            </div>
          </div>
        )}
      </main>

      {/* =================================================================== */}
      {/* BARRA DE NAVEGACION INFERIOR PARA MOVILES Y TABLETS (< md)          */}
      {/* =================================================================== */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-2xl border-t border-slate-800/80 px-2 pt-1.5 pb-4 safe-bottom shadow-2xl">
        <div className="grid grid-cols-4 items-center">
          {/* 1. Reuniones */}
          <button
            onClick={() => {
              setActiveTab('meetings');
              setShowMobileDetail(false);
            }}
            className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all ${
              activeTab === 'meetings'
                ? 'text-indigo-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'meetings' ? 'bg-indigo-600/20 text-indigo-400 shadow-sm' : ''}`}>
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-0.5 font-medium">Reuniones</span>
          </button>

          {/* 2. Libreta Canvas */}
          <button
            onClick={() => {
              setActiveTab('notebook');
            }}
            className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all ${
              activeTab === 'notebook'
                ? 'text-indigo-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'notebook' ? 'bg-indigo-600/20 text-indigo-400 shadow-sm' : ''}`}>
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-0.5 font-medium">Libreta</span>
          </button>

          {/* 3. Agenda */}
          <button
            onClick={() => {
              setActiveTab('calendar');
            }}
            className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all ${
              activeTab === 'calendar'
                ? 'text-indigo-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'calendar' ? 'bg-indigo-600/20 text-indigo-400 shadow-sm' : ''}`}>
              <Calendar className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-0.5 font-medium">Agenda</span>
          </button>

          {/* 4. Chat con IA (Único, con badge reactivo) */}
          <button
            onClick={() => {
              setActiveTab('chat');
            }}
            className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all ${
              activeTab === 'chat'
                ? 'text-indigo-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className={`p-1.5 rounded-xl relative transition-all ${activeTab === 'chat' ? 'bg-indigo-600/20 text-indigo-400 shadow-sm' : ''}`}>
              <Brain className="w-5 h-5" />
              {meetings.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-indigo-600 text-[9px] text-white rounded-full flex items-center justify-center font-bold border border-slate-950 shadow-sm">
                  {meetings.length}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5 font-medium">Chat IA</span>
          </button>
        </div>
      </nav>

      {/* Modals */}
      <SecondBrainModal
        isOpen={isSecondBrainOpen}
        onClose={() => setIsSecondBrainOpen(false)}
        totalMeetings={meetings.length}
      />

      <ThemeSelectorModal
        isOpen={isThemeOpen}
        onClose={() => setIsThemeOpen(false)}
      />

      {/* Fullscreen Notebook Overlay */}
      {showNotebookOverlay && (
        <ExecutiveNotebook
          initialContent={executiveNotebookText}
          onContentChange={(val) => setExecutiveNotebookText(val)}
          activeMeeting={selectedMeeting || (recordingState.isRecording ? { title: recordingState.title } : null)}
          isRecordingActive={recordingState.isRecording}
          recordingTime={recordingState.recordingTime}
          onSaveToNotes={handleSaveExecutiveNote}
          onClose={() => setShowNotebookOverlay(false)}
        />
      )}

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        healthData={healthData}
        keepAliveData={keepAliveData}
        onTriggerKeepAlive={triggerKeepAlive}
        onRefreshHealth={fetchHealth}
      />

      <EventModal
        isOpen={eventModalOpen}
        onClose={() => setEventModalOpen(false)}
        event={editingEvent}
        initialDate={eventInitialDate}
        meetings={meetings}
        onSaved={handleEventSaved}
      />
    
      {/* Modal de Fusión de Sesiones / Capacitación */}
      {showMergeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  <GitMerge className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    Fusionar {selectedMergeIds.length} Sesiones con IA
                  </h3>
                  <p className="text-xs text-slate-400">
                    Se sintetizarán las jornadas en una Minuta Maestra Integral.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMergeModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nombre de la Capacitación o Serie (Opcional)
                </label>
                <input
                  type="text"
                  value={mergeDirective}
                  onChange={(e) => setMergeDirective(e.target.value)}
                  placeholder="Ej. Capacitación en Mantenimiento Preventivo (Días 1 a 3)..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Si lo dejas en blanco, la IA analizará los temas tratados y titulará la serie automáticamente.
                </p>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                  Sesiones que se consolidarán:
                </label>
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {meetings
                    .filter(m => selectedMergeIds.includes(m.id))
                    .map(m => (
                      <div key={m.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs">
                        <span className="text-slate-200 font-medium truncate max-w-[280px]">
                          {m.title}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {new Date(m.createdAt || Date.now()).toLocaleDateString('es-ES')}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowMergeModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isMerging}
                onClick={handleMergeMeetings}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-md shadow-amber-500/20 transition-all active:scale-95"
              >
                {isMerging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>{isMerging ? 'Sintetizando...' : 'Consolidar Minuta Maestra'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}