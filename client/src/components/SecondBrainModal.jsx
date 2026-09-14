import React, { useState } from 'react';
import { X, Brain, Send, Loader2, Sparkles } from 'lucide-react';

export default function SecondBrainModal({ isOpen, onClose, totalMeetings }) {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: '¡Hola! Soy tu Segundo Cerebro (Second Brain). Puedo responder cualquier duda, recuperar acuerdos, buscar responsables o comparar decisiones entre todas tus reuniones registradas. ¿Qué deseas consultar?'
    }
  ]);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleAsk = async (e) => {
    e.preventDefault();
    if (!question.trim() || loading) return;

    const userQ = question.trim();
    setQuestion('');
    setMessages(prev => [...prev, { role: 'user', text: userQ }]);
    setLoading(true);

    try {
      const res = await fetch('/api/second-brain/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userQ })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error consultando al Segundo Cerebro');

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          text: data.answer,
          meetingsCount: data.totalMeetingsAnalyzed
        }
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', text: `❌ Error: ${err.message}` }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col h-[600px] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 flex items-center gap-2 text-base">
                Segundo Cerebro
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold">
                  {totalMeetings} reuniones indexadas
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Memoria cruzada de acuerdos, fechas y responsables
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
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl p-4 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                    : 'bg-slate-800/80 border border-slate-700/60 text-slate-200'
                }`}
              >
                <div className="whitespace-pre-line">{msg.text}</div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3 items-center text-slate-400 text-xs">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/30 flex items-center justify-center text-indigo-400 shrink-0">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
              <span>El Segundo Cerebro está analizando tus reuniones...</span>
            </div>
          )}
        </div>

        {/* Query Input Form */}
        <form onSubmit={handleAsk} className="p-4 border-t border-slate-800 bg-slate-900/60">
          <div className="relative flex items-center">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Pregunta algo: '¿Qué acordamos con el equipo sobre el presupuesto?'"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-4 pr-12 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="absolute right-2 p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
