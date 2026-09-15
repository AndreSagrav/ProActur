import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles, Brain, Settings, Palette, Plus, Search, Calendar, Share2, CheckCircle2,
  Clock, CheckSquare, ChevronRight, Radio, FileText, BookOpen, PenTool,
  ArrowLeft, Activity, ShieldCheck
} from 'lucide-react';

import AudioRecorder from './components/AudioRecorder';
import MeetingDetails from './components/MeetingDetails';
import SecondBrainModal from './components/SecondBrainModal';
import SettingsModal from './components/SettingsModal';
import ThemeSelectorModal from './components/ThemeSelectorModal';
import { useTheme } from './context/ThemeContext.jsx';
import CalendarView from './components/CalendarView';
import EventModal from './components/EventModal';
import NotebookList from './components/NotebookList';
import NoteEditor from './components/NoteEditor';

const API = import.meta.env.VITE_API_URL || '';

export default function App() {
  const { theme, setTheme, THEMES, fontSize, setFontSize } = useTheme();
  const [meetings, setMeetings] = useState([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
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
    { key: 'calendar', label: 'Agenda', icon: Calendar },
    { key: 'notebook', label: 'Libreta', icon: BookOpen },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col pb-20 lg:pb-6">
      {/* Header Responsivo */}
      <header className="border-b border-slate-800/70 bg-slate-950/85 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2">
          {/* Logo y Titulo */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
              <Radio className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm sm:text-base font-bold tracking-tight text-slate-100 truncate leading-tight">
                  Proactor
                </h1>
                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30 hidden xs:inline-block">
                  AI Proactivo
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block truncate">
                Asistente proactivo, agenda y libreta inteligente
              </p>
            </div>
          </div>

          {/* Selector de pestañas para Desktop / Tablet Grande */}
          <div className="hidden md:flex items-center bg-slate-900/90 border border-slate-800 rounded-xl p-1 shadow-inner">
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
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Selector Rapido de Temas y Accesibilidad Visible en Pantalla */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-xl px-2 py-1 shadow-inner">
            <span className="text-[10px] text-slate-400 font-bold hidden xl:inline">Temas:</span>
            <div className="flex items-center gap-1">
              {THEMES && Object.values(THEMES).map(t => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`w-5 h-5 sm:w-6 sm:h-6 rounded-lg flex items-center justify-center transition-all ${
                    theme === t.id
                      ? 'ring-2 ring-white scale-110 shadow-lg'
                      : 'opacity-70 hover:opacity-100 hover:scale-105'
                  }`}
                  style={{ backgroundColor: t.previewColor }}
                  title={`${t.name}: ${t.description}`}
                >
                  {theme === t.id && <span className="w-1.5 h-1.5 rounded-full bg-white shadow" />}
                </button>
              ))}
            </div>

            <div className="w-[1px] h-4 bg-slate-700 mx-0.5" />

            {/* Alternador de Tamano de Fuente */}
            <button
              onClick={() => setFontSize(fontSize === 'xlarge' ? 'normal' : fontSize === 'large' ? 'xlarge' : 'large')}
              className="px-1.5 py-0.5 text-[11px] font-extrabold text-amber-300 hover:text-white rounded hover:bg-slate-800 transition-colors"
              title="Cambiar tamano de letra (Normal / Grande / Extra Grande)"
            >
              {fontSize === 'xlarge' ? 'A+++' : fontSize === 'large' ? 'A++' : 'A+'}
            </button>
          </div>

          {/* Botones de Accion */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Supabase Keep-Alive Indicator */}
            {keepAliveData?.success && (
              <div
                className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                title={`Keep-Alive activo: Latencia ${keepAliveData.latencyMs}ms. Base de datos protegida de suspension.`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Supabase Activo</span>
              </div>
            )}

            {/* Segundo Cerebro */}
            <button
              onClick={() => setIsSecondBrainOpen(true)}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-all shadow-sm"
              title="Consultar Segundo Cerebro"
            >
              <Brain className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="hidden sm:inline">Segundo Cerebro</span>
              <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-indigo-500/30 text-indigo-300 text-[10px] flex items-center justify-center font-bold">
                {meetings.length}
              </span>
            </button>

            {/* Temas y Accesibilidad Visual */}
            <button
              onClick={() => setIsThemeOpen(true)}
              className="p-1.5 sm:p-2 rounded-xl text-amber-400/90 hover:text-amber-300 hover:bg-amber-500/10 transition-colors border border-amber-500/20 flex items-center gap-1.5"
              title="Temas y Accesibilidad Visual (Daltónicos / Alto Contraste / Tamaño de letra)"
              aria-label="Configuración de Accesibilidad y Temas"
            >
              <Palette className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden lg:inline text-xs font-medium text-amber-300">Accesibilidad</span>
            </button>

            {/* Ajustes */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700"
              title="Ajustes y Conexiones"
            >
              <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Contenedor Principal Adaptativo */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 flex-1 w-full">
        {/* =================================================================== */}
        {/* PESTAÑA: REUNIONES                                                  */}
        {/* =================================================================== */}
        {activeTab === 'meetings' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
            {/* Columna Izquierda: Grabadora + Lista de Reuniones (Desktop o Movil si no hay detalle) */}
            <aside className={`lg:col-span-4 flex flex-col gap-4 ${showMobileDetail ? 'hidden lg:flex' : 'flex'}`}>
              {/* Grabador de Audio siempre visible en el listado para movil y desktop */}
              <div className="lg:hidden">
                <AudioRecorder onMeetingProcessed={handleMeetingProcessed} />
              </div>

              {/* Encabezado de Historial con Buscador */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-400" />
                    Reuniones ({filteredMeetings.length})
                  </h3>
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
                    const isSynced = Boolean(m.notionSync?.url);

                    return (
                      <div
                        key={m.id}
                        onClick={() => {
                          setSelectedMeetingId(m.id);
                          setShowMobileDetail(true);
                        }}
                        className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer text-left relative overflow-hidden group ${
                          isSelected
                            ? 'bg-slate-800/90 border-indigo-500/60 shadow-lg shadow-indigo-500/10'
                            : 'bg-slate-900/70 hover:bg-slate-800/60 border-slate-800'
                        }`}
                      >
                        {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />}
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(m.createdAt || Date.now()).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}
                          </span>
                          
                        </div>
                        <h4 className="text-sm font-semibold text-slate-100 group-hover:text-indigo-300 transition-colors line-clamp-1">
                          {m.title || 'Reunion sin titulo'}
                        </h4>
                        <p className="text-xs text-slate-400 line-clamp-2 mt-1">{m.summary}</p>
                        <div className="flex items-center justify-between mt-3 text-[11px] text-slate-500 border-t border-slate-800/80 pt-2">
                          <span className="flex items-center gap-1">
                            <CheckSquare className="w-3 h-3" /> {tasksCount} tareas
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-300 transition-colors" />
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
                <AudioRecorder onMeetingProcessed={handleMeetingProcessed} />
              </div>

              {/* Detalle o Placeholder */}
              {selectedMeeting ? (
                <MeetingDetails
                  meeting={selectedMeeting}
                  onUpdateMeeting={handleUpdateMeeting}
                  onDeleteMeeting={handleDeleteMeeting}
                  onScheduleFollowUp={handleScheduleFollowUp}
                  onCreateNote={handleCreateNoteFromMeeting}
                />
              ) : (
                <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-8 sm:p-12 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto mb-3">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-200">Selecciona una reunion o graba una nueva</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                    Proactor AI analiza tus conversaciones, extrae acuerdos, crea tareas automáticas y las sincroniza en tu libreta inteligente y segundo cerebro.
                  </p>
                </div>
              )}
            </section>
          </div>
        )}

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
        {activeTab === 'notebook' && (
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
        )}
      </main>

      {/* =================================================================== */}
      {/* BARRA DE NAVEGACION INFERIOR PARA MOVILES Y TABLETS (< md)          */}
      {/* =================================================================== */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-2xl border-t border-slate-800/80 px-2 py-1.5 safe-bottom shadow-2xl">
        <div className="flex items-center justify-around">
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
                className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
                  isActive
                    ? 'text-indigo-400 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className={`p-1 rounded-lg ${isActive ? 'bg-indigo-600/20' : ''}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] mt-0.5">{tab.label}</span>
              </button>
            );
          })}

          {/* Boton Segundo Cerebro en Barra Movil */}
          <button
            onClick={() => setIsSecondBrainOpen(true)}
            className="flex flex-col items-center justify-center py-1 px-3 rounded-xl text-slate-400 hover:text-indigo-300 transition-all"
          >
            <div className="p-1 rounded-lg relative">
              <Brain className="w-5 h-5 text-indigo-400" />
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-indigo-600 text-[9px] text-white rounded-full flex items-center justify-center font-bold">
                {meetings.length}
              </span>
            </div>
            <span className="text-[10px] mt-0.5">Cerebro</span>
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
    </div>
  );
}