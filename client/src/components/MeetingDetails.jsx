import React, { useState, useEffect } from 'react';
import {
  CheckSquare, Square, ExternalLink, Share2, CheckCircle2,
  AlertTriangle, ChevronDown, ChevronUp, Calendar, User, Clock,
  Lightbulb, Target, FileText, Loader2, Trash2, BookOpen, CalendarPlus, Copy, Check, Volume2
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

export default function MeetingDetails({ meeting, onUpdateMeeting, onDeleteMeeting, onScheduleFollowUp, onCreateNote }) {
  const [syncingNotion, setSyncingNotion] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [copied, setCopied] = useState(false);
  const [actionItems, setActionItems] = useState(meeting.actionItems || []);

  useEffect(() => {
    setActionItems(meeting.actionItems || []);
    setSyncStatus(null);
  }, [meeting.id]);

  const handleCopyTranscript = () => {
    if (!meeting.transcript) return;
    navigator.clipboard.writeText(meeting.transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleTask = async (idx) => {
    const updated = [...actionItems];
    updated[idx] = { ...updated[idx], completed: !updated[idx].completed };
    setActionItems(updated);

    if (onUpdateMeeting) {
      onUpdateMeeting(meeting.id, { actionItems: updated });
    }
  };

  const syncToNotion = async () => {
    setSyncingNotion(true);
    setSyncStatus(null);

    try {
      const res = await fetch(`${API}/api/meetings/${meeting.id}/sync-notion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (data.success) {
        setSyncStatus({ success: true, url: data.url });
      } else {
        setSyncStatus({ success: false, error: data.error || 'Error al sincronizar.' });
      }
    } catch (err) {
      setSyncStatus({ success: false, error: err.message });
    } finally {
      setSyncingNotion(false);
    }
  };

  const priorityColor = (p) => {
    const l = (p || '').toLowerCase();
    if (l === 'alta' || l === 'high') return 'bg-red-500/15 text-red-400 border-red-500/30';
    if (l === 'media' || l === 'medium') return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    return 'bg-slate-700/40 text-slate-400 border-slate-600/30';
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100">{meeting.title || 'Reunion sin titulo'}</h2>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(meeting.createdAt || Date.now()).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
            {meeting.source && (
              <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-[10px] font-semibold">
                {meeting.source === 'audio' ? 'Audio' : 'Texto'}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Copiar Resumen y Acuerdos */}
          <button
            onClick={() => {
              const text = `# ${meeting.title}\n\n## Resumen\n${meeting.summary}\n\n## Acuerdos Clave\n${(meeting.keyDecisions || []).map(d => '- ' + d).join('\n')}\n\n## Tareas\n${(meeting.tasks || []).map(t => '- [ ] ' + t.text + (t.assignee ? ' (@' + t.assignee + ')' : '')).join('\n')}`;
              navigator.clipboard.writeText(text);
              alert('¡Resumen, acuerdos y tareas copiados al portapapeles!');
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-all"
            title="Copiar resumen y acuerdos al portapapeles"
          >
            <Share2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Copiar Acuerdos</span>
          </button>

          {/* Schedule Follow-up */}
          {onScheduleFollowUp && (
            <button
              onClick={() => onScheduleFollowUp(meeting)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-300 border border-emerald-500/25 transition-all"
              title="Agendar seguimiento"
            >
              <CalendarPlus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Agendar</span>
            </button>
          )}

          {/* Create Note */}
          {onCreateNote && (
            <button
              onClick={() => onCreateNote(meeting)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-violet-600/15 hover:bg-violet-600/25 text-violet-300 border border-violet-500/25 transition-all"
              title="Crear nota vinculada"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Nota</span>
            </button>
          )}

          {/* Delete */}
          {onDeleteMeeting && (
            <button
              onClick={() => onDeleteMeeting(meeting.id)}
              className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-slate-800/80 transition-colors"
              title="Eliminar reunion"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Executive Summary */}
      <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-xl p-4">
        <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-2">
          <Lightbulb className="w-4 h-4" /> Resumen Ejecutivo
        </div>
        <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">{meeting.summary}</p>
      </div>

      {/* Grid: Decisions & Proactive Advice */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-200 text-xs font-bold uppercase tracking-wider mb-3">
            <Target className="w-4 h-4 text-amber-400" /> Decisiones Clave
          </div>
          {meeting.keyDecisions && meeting.keyDecisions.length > 0 ? (
            <ul className="space-y-2">
              {meeting.keyDecisions.map((dec, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                  <span>{dec}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500 italic">No se registraron decisiones formales.</p>
          )}
        </div>

        <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-200 text-xs font-bold uppercase tracking-wider mb-3">
            <AlertTriangle className="w-4 h-4 text-indigo-400" /> Consejos Proactivos del Asistente
          </div>
          {meeting.proactiveAdvice && meeting.proactiveAdvice.length > 0 ? (
            <ul className="space-y-2">
              {meeting.proactiveAdvice.map((adv, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-indigo-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                  <span>{adv}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500 italic">Sin alertas ni riesgos identificados.</p>
          )}
        </div>
      </div>

      {/* Action Items */}
      <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-slate-200 text-xs font-bold uppercase tracking-wider">
            <CheckSquare className="w-4 h-4 text-emerald-400" />
            Tareas y Compromisos ({actionItems.filter(a => a.completed).length}/{actionItems.length})
          </div>
        </div>

        {actionItems && actionItems.length > 0 ? (
          <div className="space-y-2">
            {actionItems.map((item, idx) => (
              <div
                key={idx}
                onClick={() => toggleTask(idx)}
                className={`flex items-start justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                  item.completed
                    ? 'bg-slate-900/40 border-slate-800/50 opacity-60'
                    : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <button className="mt-0.5 text-slate-400 hover:text-emerald-400 transition-colors">
                    {item.completed ? <CheckSquare className="w-4 h-4 text-emerald-400" /> : <Square className="w-4 h-4 text-slate-500" />}
                  </button>
                  <div>
                    <p className={`text-sm text-slate-100 ${item.completed ? 'line-through text-slate-400' : ''}`}>
                      {item.task}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                      {item.assignee && (
                        <span className="flex items-center gap-1"><User className="w-3 h-3 text-slate-500" />{item.assignee}</span>
                      )}
                      {item.deadline && (
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-slate-500" />{item.deadline}</span>
                      )}
                    </div>
                  </div>
                </div>

                {item.priority && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border uppercase shrink-0 ${priorityColor(item.priority)}`}>
                    {item.priority}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">No se detectaron tareas pendientes.</p>
        )}
      </div>

      {/* Seccion Dedicada: Grabacion & Transcripcion Completa */}
      {(meeting.transcript || meeting.audioUrl) && (
        <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/60 shadow-md">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="w-full flex items-center justify-between p-4 bg-slate-800/40 hover:bg-slate-800/70 text-left transition-colors text-xs font-bold text-slate-300"
          >
            <span className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>Registro Completo: Grabación y Transcripción Textual</span>
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-400 font-normal">
                {meeting.transcript ? meeting.transcript.split(/\s+/).filter(Boolean).length + ' palabras' : ''}
              </span>
              {showTranscript ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {showTranscript && (
            <div className="p-4 bg-slate-950/80 border-t border-slate-800 space-y-3">
              {meeting.audioUrl && (
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center gap-3">
                  <Volume2 className="w-4 h-4 text-indigo-400 shrink-0" />
                  <audio controls src={meeting.audioUrl} className="w-full h-8" />
                </div>
              )}

              {meeting.transcript && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Transcripción Íntegra de la Sesión
                    </span>
                    <button
                      onClick={handleCopyTranscript}
                      className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      {copied ? 'Copiado' : 'Copiar Texto'}
                    </button>
                  </div>
                  <div className="p-3.5 bg-slate-900/90 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 leading-relaxed max-h-80 overflow-y-auto whitespace-pre-wrap selection:bg-indigo-600">
                    {meeting.transcript}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
