import React, { useState, useRef, useEffect } from 'react';
import { Brain, Send, Loader2, Sparkles, MessageSquare, BookOpen, CheckSquare, Calendar, RefreshCw } from 'lucide-react';

const SUGGESTED_QUESTIONS = [
  '¿Qué tareas o entregas tengo pendientes?',
  '¿Cuáles fueron los últimos acuerdos tomados?',
  '¿Qué anoté en mis libretas y bocetos?',
  '¿Quién es el responsable de cada entrega?',
  'Hazme un resumen ejecutivo de las últimas reuniones',
  '¿Qué temas críticos requieren mi atención hoy?'
];

export default function ChatView({ totalMeetings = 0 }) {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: '¡Hola! Soy tu Asistente IA de Proactor. Tengo acceso a todas tus reuniones grabadas y a tus libretas de notas. Puedes hacerme cualquier pregunta sobre compromisos, acuerdos, fechas o temas discutidos.'
    }
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

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
      if (!res.ok) throw new Error(data.error || 'Error consultando a la IA');

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
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl backdrop-blur-xl shadow-2xl flex flex-col h-[calc(100vh-160px)] min-h-[500px] overflow-hidden">
      {/* Chat View Header */}
      <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              Chat con la IA (Segundo Cerebro Proactor)
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                IA Activa
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Conversación en vivo sobre tus reuniones, acuerdos y libretas canvas
            </p>
          </div>
        </div>

        <button
          onClick={() => setMessages([{
            role: 'assistant',
            text: 'Conversación reiniciada. ¿Qué deseas consultar sobre tus reuniones o libretas?'
          }])}
          className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors text-xs flex items-center gap-1"
          title="Reiniciar conversación"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Limpiar Chat</span>
        </button>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-xl bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4 text-indigo-400" />
              </div>
            )}
            <div
              className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'bg-slate-950/80 border border-slate-800 text-slate-200'
              }`}
            >
              <div className="whitespace-pre-line">{msg.text}</div>
              {(msg.meetingsCount !== undefined || msg.notesCount !== undefined) && (
                <div className="mt-2.5 pt-2 border-t border-slate-800 text-[10px] text-slate-400 flex items-center gap-2 font-mono">
                  <span>Reuniones: {msg.meetingsCount || 0}</span>
                  <span>•</span>
                  <span>Libretas: {msg.notesCount || 0}</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 items-center text-slate-400 text-xs">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/30 flex items-center justify-center text-indigo-400 shrink-0">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
            <span>La IA está consultando tus reuniones y libretas en tiempo real...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions Ribbon */}
      <div className="px-4 py-2.5 bg-slate-950/70 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-400" /> Sugerencias:
        </span>
        {SUGGESTED_QUESTIONS.map((sug, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => askAi(sug)}
            disabled={loading}
            className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 hover:text-white whitespace-nowrap transition-all disabled:opacity-50"
          >
            {sug}
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <form onSubmit={handleAsk} className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950/90">
        <div className="relative flex items-center max-w-4xl mx-auto">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Pregúntale a la IA en vivo: '¿Qué acordamos con el equipo?', '¿Qué tareas tengo para mañana?'..."
            className="w-full bg-slate-900 border border-slate-700 rounded-2xl pl-4 pr-12 py-3.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-inner"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="absolute right-2 p-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white disabled:opacity-40 transition-all shadow-md"
            title="Enviar mensaje a la IA"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
