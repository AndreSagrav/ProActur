import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Brain, 
  Settings, 
  Plus, 
  Search, 
  Calendar, 
  Share2, 
  CheckCircle2, 
  Clock, 
  CheckSquare, 
  ChevronRight,
  Radio,
  FileText
} from 'lucide-react';

import AudioRecorder from './components/AudioRecorder';
import MeetingDetails from './components/MeetingDetails';
import SecondBrainModal from './components/SecondBrainModal';
import SettingsModal from './components/SettingsModal';

export default function App() {
  const [meetings, setMeetings] = useState([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [healthData, setHealthData] = useState(null);
  const [isSecondBrainOpen, setIsSecondBrainOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Fetch initial meetings and health
  useEffect(() => {
    fetchMeetings();
    fetchHealth();
  }, []);

  const fetchMeetings = async () => {
    try {
      const res = await fetch('/api/meetings');
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
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setHealthData(data);
      }
    } catch (err) {
      console.error('Error consultando estado:', err);
    }
  };

  const handleMeetingProcessed = (newMeeting) => {
    setMeetings(prev => [newMeeting, ...prev.filter(m => m.id !== newMeeting.id)]);
    setSelectedMeetingId(newMeeting.id);
  };

  const handleUpdateMeeting = (updated) => {
    setMeetings(prev => prev.map(m => (m.id === updated.id ? updated : m)));
  };

  const handleDeleteMeeting = async (id) => {
    if (!confirm('¿Seguro que deseas eliminar esta reunión del historial?')) return;
    try {
      await fetch(`/api/meetings/${id}`, { method: 'DELETE' });
      const nextMeetings = meetings.filter(m => m.id !== id);
      setMeetings(nextMeetings);
      if (selectedMeetingId === id) {
        setSelectedMeetingId(nextMeetings[0]?.id || null);
      }
    } catch (err) {
      console.error('Error eliminando:', err);
    }
  };

  const selectedMeeting = meetings.find(m => m.id === selectedMeetingId);

  const filteredMeetings = meetings.filter(m => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.title?.toLowerCase().includes(q) ||
      m.summary?.toLowerCase().includes(q) ||
      m.tags?.some(t => t.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-200 bg-clip-text text-transparent">
                  PROACTOR
                </span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  AI + Notion
                </span>
              </div>
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
              <span>Segundo Cerebro</span>
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
        {/* Left Column: Meetings History (Sidebar) */}
        <aside className="lg:col-span-4 flex flex-col gap-4">
          {/* New Meeting trigger & search */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                Historial de Reuniones
              </h3>
              <button
                onClick={() => setSelectedMeetingId(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Nueva
              </button>
            </div>

            {/* Search */}
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

          {/* List of Meetings */}
          <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
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
                    onClick={() => setSelectedMeetingId(m.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer text-left relative overflow-hidden group ${
                      isSelected
                        ? 'bg-slate-800/90 border-indigo-500/60 shadow-lg shadow-indigo-500/10'
                        : 'bg-slate-900/70 hover:bg-slate-800/60 border-slate-800'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />
                    )}
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(m.createdAt || Date.now()).toLocaleDateString('es-ES', {
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                      {isSynced && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Notion
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-semibold text-slate-100 group-hover:text-indigo-300 transition-colors line-clamp-1">
                      {m.title || 'Reunión sin título'}
                    </h4>
                    <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                      {m.summary}
                    </p>
                    <div className="flex items-center justify-between mt-3 text-[11px] text-slate-500 border-t border-slate-800/80 pt-2">
                      <span className="flex items-center gap-1">
                        <CheckSquare className="w-3 h-3" />
                        {tasksCount} tareas
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-300 transition-colors" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Column: Audio Recorder & Active Meeting Details */}
        <main className="lg:col-span-8 space-y-6">
          {/* Always have AudioRecorder accessible or when creating a new meeting */}
          <AudioRecorder onMeetingProcessed={handleMeetingProcessed} />

          {/* Active Meeting View */}
          {selectedMeeting ? (
            <MeetingDetails
              meeting={selectedMeeting}
              onUpdateMeeting={handleUpdateMeeting}
              onDeleteMeeting={handleDeleteMeeting}
            />
          ) : (
            <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto mb-3">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-200">
                Selecciona una reunión o graba una nueva
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                Proactor AI transcribirá el audio, extraerá los acuerdos, asignará tareas y te permitirá exportarlo directamente a tu Notion con un solo clic.
              </p>
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
    </div>
  );
}
