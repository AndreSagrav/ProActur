import React, { useState } from 'react';
import { X, Key, Database, CheckCircle2, AlertCircle, Loader2, Sparkles, Cpu, Layers } from 'lucide-react';

export default function SettingsModal({ isOpen, onClose, healthData, onRefreshHealth }) {
  const [notionKey, setNotionKey] = useState('');
  const [notionDb, setNotionDb] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  if (!isOpen) return null;

  const handleTestNotion = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/notion/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: notionKey.trim() || undefined,
          databaseId: notionDb.trim() || undefined
        })
      });

      const data = await res.json();
      setTestResult(data);
      if (onRefreshHealth) onRefreshHealth();
    } catch (err) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  const providers = healthData?.aiProviders || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2 text-slate-100 font-bold">
            <Key className="w-5 h-5 text-indigo-400" />
            Configuración, Base de Datos e IA
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Base de Datos & Supabase */}
          <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-xl space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Database className="w-4 h-4 text-emerald-400" />
                Base de Datos (Supabase):
              </span>
              <span className={`px-2 py-0.5 rounded font-mono font-semibold ${
                healthData?.supabase?.tableReady
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : healthData?.supabase?.configured
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'bg-red-500/10 text-red-400 border border-red-500/30'
              }`}>
                {healthData?.supabase?.tableReady
                  ? 'Tabla Lista en Supabase'
                  : healthData?.supabase?.configured
                  ? 'Conectado (Falta correr SQL)'
                  : 'No Configurado'}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              {healthData?.supabase?.tableReady ? (
                'Tus reuniones y tareas se sincronizan en tiempo real con Supabase Cloud.'
              ) : (
                <>
                  Las credenciales están conectadas. Para activar la persistencia en la nube, copia y ejecuta el archivo{' '}
                  <code className="text-indigo-300 font-mono bg-slate-800 px-1 py-0.5 rounded">supabase/schema.sql</code>{' '}
                  en el <strong>SQL Editor</strong> de Supabase. (Mientras tanto, se guarda en caché local automáticamente).
                </>
              )}
            </p>
          </div>

          {/* Modelos de Inteligencia Artificial */}
          <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-xl space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-indigo-400" />
                Motores de IA Multimodal Conectados:
              </span>
              <span className="text-[10px] text-emerald-400 font-mono font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Multi-Provider Activo
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {/* Google Gemini */}
              <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-700/80 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-100 flex items-center gap-1">
                    Google Gemini
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">{providers.gemini?.model || 'gemini-3.6-flash'}</div>
                  <div className="text-[9px] text-indigo-300 mt-0.5">Audio Nativo + Transcripción</div>
                </div>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Activo
                </span>
              </div>

              {/* OpenRouter */}
              <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-700/80 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-100">OpenRouter</div>
                  <div className="text-[10px] text-slate-400 font-mono">{providers.openrouter?.model || 'deepseek/deepseek-chat'}</div>
                  <div className="text-[9px] text-purple-300 mt-0.5">Segundo Cerebro & Síntesis</div>
                </div>
                <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                  Activo
                </span>
              </div>

              {/* Groq LPU */}
              <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-700/80 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-100">Groq LPU</div>
                  <div className="text-[10px] text-slate-400 font-mono">{providers.groq?.model || 'openai/gpt-oss-120b'}</div>
                  <div className="text-[9px] text-amber-300 mt-0.5">Inferencia Ultrarrápida</div>
                </div>
                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  Activo
                </span>
              </div>

              {/* Auto-Fallback */}
              <div className="p-2.5 rounded-lg bg-slate-900/50 border border-dashed border-slate-700 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-300">Cascada Auto-Fallback</div>
                  <div className="text-[10px] text-slate-400">Si un motor falla, salta al siguiente</div>
                </div>
                <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                  Auto
                </span>
              </div>
            </div>
          </div>

          {/* Test Notion Credentials Live */}
          <div className="space-y-3 pt-1">
            <h4 className="text-xs uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              Integración con Notion (Opcional)
            </h4>
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Notion Secret Key (Internal Integration Token):
              </label>
              <input
                type="password"
                value={notionKey}
                onChange={(e) => setNotionKey(e.target.value)}
                placeholder="secret_..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Notion Database ID o Page ID:
              </label>
              <input
                type="text"
                value={notionDb}
                onChange={(e) => setNotionDb(e.target.value)}
                placeholder="ID de 32 caracteres de tu página o base en Notion..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <button
              onClick={handleTestNotion}
              disabled={testing}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50"
            >
              {testing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Probando conexión con Notion...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Probar Conexión con Notion
                </>
              )}
            </button>
          </div>

          {/* Test result display */}
          {testResult && (
            <div
              className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
                testResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}
            >
              {testResult.success ? (
                <>
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <div>
                    <div className="font-semibold">¡Conexión Exitosa con Notion!</div>
                    <div>Bot/Usuario: {testResult.user}</div>
                    <div className="text-[11px] opacity-80">{testResult.connectedTo}</div>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <div>
                    <div className="font-semibold">Error al conectar:</div>
                    <div>{testResult.error}</div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
