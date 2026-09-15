import React, { useState } from 'react';
import { X, Brain, Send, Loader2, Sparkles, MessageSquare, BookOpen, CheckSquare, Calendar } from 'lucide-react';

const SUGGESTED_QUESTIONS = [
  '¿Qué tareas o entregas tengo pendientes?',
  '¿Cuáles fueron los últimos acuerdos tomados?',
  '¿Qué anoté en mis libretas y bocetos?',
  '¿Quién es el responsable de cada tarea?'
];

export default function SecondBrainModal({ isOpen, onClose, totalMeetings }) {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: '¡Hola! Soy tu Asistente IA y Segundo Cerebro. Tengo acceso a todas tus reuniones y libretas de notas. Puedes preguntarme sobre cualquier acuerdo, tarea pendiente, fecha o idea que hayas registrado.'
    }
  ]);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const askAi = async (qText) => {
    if (!qText.trim() || loading) return;

    setQuestion('');
    setMessages(prev => [...prev, { role: 'user', text: qText }]);
    setLoading(true);

    try {
      const res = await fetch('/api/second-brain/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: qText })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error consultando al Asistente IA');

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          text: data.answer,
          meetingsCount: data.totalMeetingsAnalyzed,
          notesCount: data.totalNotesAnalyzed
        }
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', text: `❌ Error conectando con la IA: ${err.message}` }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAsk = (e) => {
    e.preventDefault();
    askAi(question);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col h-[640px] max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/95 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 flex items-center gap-2 text-base">
                Chat con la IA (Segundo Cerebro)
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-bold">
                  {totalMeetings} reuniones + libretas indexadas
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Pregúntale cualquier cosa a tu memoria cruzada de reuniones y libretas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/20'
                    : 'bg-slate-800/90 border border-slate-700/80 text-slate-200'
                }`}
              >
                <div className="whitespace-pre-line">{msg.text}</div>
                {(msg.meetingsCount !== undefined || msg.notesCount !== undefined) && (
                  <div className="mt-2 pt-2 border-t border-slate-700/60 text-[10px] text-slate-400 flex items-center gap-2">
                    <span>Indexado: {msg.meetingsCount || 0} reuniones</span>
                    <span>•</span>
                    <span>{msg.notesCount || 0} libretas</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3 items-center text-slate-400 text-xs">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/30 flex items-center justify-center text-indigo-400 shrink-0">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
              <span>La IA está consultando tus reuniones y libretas en tiempo real...</span>
            </div>
          )}
        </div>

        {/* Quick Suggestion Pills */}
        <div className="px-4 py-2 bg-slate-950/60 border-t border-slate-800/80 flex items-center gap-1.5 overflow-x-auto">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" /> Sugerencias:
          </span>
          {SUGGESTED_QUESTIONS.map((sug, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => askAi(sug)}
              disabled={loading}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-300 hover:text-white whitespace-nowrap transition-colors disabled:opacity-50"
            >
              {sug}
            </button>
          ))}
        </div>

        {/* Query Input Form */}
        <form onSubmit={handleAsk} className="p-3 sm:p-4 border-t border-slate-800 bg-slate-900/95">
          <div className="relative flex items-center">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Chatea con la IA: '¿Qué acordamos con el equipo?', '¿Qué tareas tengo para mañana?'..."
              className="w-full bg-slate-800/90 border border-slate-700 rounded-xl pl-4 pr-12 py-3 text-xs sm:text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="absolute right-2 p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-all shadow-md"
              title="Enviar mensaje a la IA"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
