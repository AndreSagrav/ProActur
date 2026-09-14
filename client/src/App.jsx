import React, { useState, useEffect } from 'react';
import {
  Sparkles, Brain, Settings, Plus, Search, Calendar, Share2, CheckCircle2,
  Clock, CheckSquare, ChevronRight, Radio, FileText, BookOpen, PenTool
} from 'lucide-react';

import AudioRecorder from './components/AudioRecorder';
import MeetingDetails from './components/MeetingDetails';
import SecondBrainModal from './components/SecondBrainModal';
import SettingsModal from './components/SettingsModal';
import CalendarView from './components/CalendarView';
import EventModal from './components/EventModal';
import NotebookList from './components/NotebookList';
import NoteEditor from './components/NoteEditor';

const API = import.meta.env.VITE_API_URL || '';

export default function App() {
  const [meetings, setMeetings] = useState([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [healthData, setHealthData] = useState(null);
  const [isSecondBrainOpen, setIsSecondBrainOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Tabs: 'meetings' | 'calendar' | 'notebook'
  const [activeTab, setActiveTab] = useState('meetings');

  // Calendar state
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventInitialDate, setEventInitialDate] = useState(null);

  // Notebook state
  const [selectedNote, setSelectedNote] = useState(null);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [linkedMeetingForNote, setLinkedMeetingForNote] = useState(null);

  useEffect(() => {
    fetchMeetings();
    fetchHealth();
  }, []);

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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Radio className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-slate-100 leading-tight">
                Proactor
                <span className="text-[10px] ml-1.5 px-1.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                  AI + Notion
                </span>
              </h1>
              <p className="text-[11px] text-slate-400">
                Tu asistente proactivo de reuniones y segundo cerebro
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5">
            {/* Second Brain */}
            <button
              onClick={() => setIsSecondBrainOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-all shadow-sm"
            >
              <Brain className="w-4 h-4 text-indigo-400" />
              <span className="hidden sm:inline">Segundo Cerebro</span>
              <span className="w-5 h-5 rounded-full bg-indigo-500/30 text-indigo-300 text-[10px] flex items-center justify-center font-bold">
                {meetings.length}
              </span>
            </button>

            {/* Settings */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700"
              title="Ajustes e Integraciones"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Grid Content */}
      <div className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Sidebar with Tabs */}
        <aside className="lg:col-span-4 flex flex-col gap-4">
          {/* Tab Switcher */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-1.5 shadow-md">
            <div className="flex gap-1">
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === tab.key
                      ? 'bg-indigo-600/25 text-indigo-300 shadow-sm border border-indigo-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'meetings' && (
            <>
              {/* Meetings Header + Search */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-400" />
                    Historial
                  </h3>
                  <button
                    onClick={() => setSelectedMeetingId(null)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow transition-all"
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
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Meetings List */}
              <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
                {filteredMeetings.length === 0 ? (
                  <div className="p-8 text-center bg-slate-900/40 border border-slate-800/60 rounded-2xl text-xs text-slate-500">
                    No hay reuniones registradas todavia. Graba o sube un audio para empezar.
                  </div>
                ) : (
                  filteredMeetings.map((m) => {
                    const isSelected = m.id === selectedMeetingId;
                    const tasksCount = m.actionItems?.length || 0;
                    const isSynced = Boolean(m.notionSync?.url);

                    return (
                      <div
                        key={m.id}
                        onClick={() => setSelectedMeetingId(m.id)}
                        className={`p-4 rounded-xl border transition-all cursor-pointer text-left relative overflow-hidden group ${
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
                          {isSynced && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Notion
                            </span>
                          )}
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
            </>
          )}

          {activeTab === 'calendar' && (
            <CalendarView
              onSelectMeeting={handleSelectMeetingFromCalendar}
              onCreateEvent={handleCreateEvent}
              onEditEvent={handleEditEvent}
            />
          )}

          {activeTab === 'notebook' && !isEditingNote && (
            <NotebookList
              onSelectNote={handleSelectNote}
              onNewNote={() => handleNewNote()}
            />
          )}

          {activeTab === 'notebook' && isEditingNote && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-md">
              <button
                onClick={() => { setIsEditingNote(false); setSelectedNote(null); }}
                className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors mb-2"
              >
                <ChevronRight className="w-3 h-3 rotate-180" /> Volver a la lista
              </button>
              <p className="text-[11px] text-slate-500">
                {selectedNote ? `Editando: ${selectedNote.title}` : 'Creando nueva nota...'}
              </p>
            </div>
          )}
        </aside>

        {/* Right Column: Main Content */}
        <main className="lg:col-span-8 space-y-6">
          {/* Audio Recorder - always accessible in meetings tab */}
          {activeTab === 'meetings' && (
            <AudioRecorder onMeetingProcessed={handleMeetingProcessed} />
          )}

          {/* Content based on active tab */}
          {activeTab === 'meetings' && (
            <>
              {selectedMeeting ? (
                <MeetingDetails
                  meeting={selectedMeeting}
                  onUpdateMeeting={handleUpdateMeeting}
                  onDeleteMeeting={handleDeleteMeeting}
                  onScheduleFollowUp={handleScheduleFollowUp}
                  onCreateNote={handleCreateNoteFromMeeting}
                />
              ) : (
                <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-12 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto mb-3">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-200">Selecciona una reunion o graba una nueva</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                    Proactor AI transcribira el audio, extraera los acuerdos, asignara tareas y te permitira exportarlo directamente a tu Notion.
                  </p>
                </div>
              )}
            </>
          )}

          {activeTab === 'calendar' && (
            <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-8 text-center">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto mb-3">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-200">Agenda ProActur</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                Selecciona un dia en el calendario para ver tus eventos o crear uno nuevo. Los eventos vinculados a reuniones te llevaran directamente a las notas.
              </p>
              <button
                onClick={() => handleCreateEvent({ date: new Date() })}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 transition-all"
              >
                <Plus className="w-4 h-4" /> Crear Evento
              </button>
            </div>
          )}

          {activeTab === 'notebook' && isEditingNote && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-md overflow-hidden" style={{ minHeight: '70vh' }}>
              <NoteEditor
                note={selectedNote}
                linkedMeeting={linkedMeetingForNote}
                meetings={meetings}
                onSave={handleNoteSaved}
                onClose={() => { setIsEditingNote(false); setSelectedNote(null); setLinkedMeetingForNote(null); }}
              />
            </div>
          )}

          {activeTab === 'notebook' && !isEditingNote && (
            <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-8 text-center">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto mb-3">
                <PenTool className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-200">Libreta ProActur</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                Crea notas con teclado o escribe a mano con lapiz. Dibuja diagramas, tablas y arboles de estudio directamente en el canvas.
              </p>
              <button
                onClick={() => handleNewNote()}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 transition-all"
              >
                <Plus className="w-4 h-4" /> Nueva Nota
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      <SecondBrainModal
        isOpen={isSecondBrainOpen}
        onClose={() => setIsSecondBrainOpen(false)}
        totalMeetings={meetings.length}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        healthData={healthData}
        onRefreshHealth={fetchHealth}
      />

      <EventModal
        isOpen={eventModalOpen}
        onClose={() => { setEventModalOpen(false); setEditingEvent(null); }}
        event={editingEvent}
        initialDate={eventInitialDate}
        meetings={meetings}
        onSaved={handleEventSaved}
      />
    </div>
  );
}
