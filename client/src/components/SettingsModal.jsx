import React, { useState } from 'react';
import { X, Key, Database, CheckCircle2, AlertCircle, Loader2, Sparkles, Cpu, Layers, Activity, RefreshCw } from 'lucide-react';

export default function SettingsModal({
  isOpen,
  onClose,
  healthData,
  keepAliveData,
  onTriggerKeepAlive,
  onRefreshHealth
}) {
  const [notionKey, setNotionKey] = useState('');
  const [notionDb, setNotionDb] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [pingingKeepAlive, setPingingKeepAlive] = useState(false);

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

  const handleManualPing = async () => {
    setPingingKeepAlive(true);
    try {
      if (onTriggerKeepAlive) await onTriggerKeepAlive();
    } finally {
      setPingingKeepAlive(false);
    }
  };

  const providers = healthData?.aiProviders || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2 text-slate-100 font-bold text-sm sm:text-base">
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

        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto">
          {/* Base de Datos & Supabase */}
          <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-xl space-y-2.5 text-xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
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
                  ? 'Tablas Listas en Supabase'
                  : healthData?.supabase?.configured
                  ? 'Conectado (Pendiente correr SQL)'
                  : 'No Configurado'}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              {healthData?.supabase?.tableReady ? (
                'Tus reuniones, eventos de agenda y libretas de notas se sincronizan en tiempo real con Supabase Cloud.'
              ) : (
                <>
                  Las credenciales están conectadas. Para activar las tablas, copia y ejecuta en el <strong>SQL Editor</strong> de Supabase los scripts:{' '}
                  <code className="text-indigo-300 font-mono bg-slate-800 px-1 py-0.5 rounded">schema.sql</code>,{' '}
                  <code className="text-indigo-300 font-mono bg-slate-800 px-1 py-0.5 rounded">schema_events.sql</code> y{' '}
                  <code className="text-indigo-300 font-mono bg-slate-800 px-1 py-0.5 rounded">schema_notes.sql</code>.
                </>
              )}
            </p>
          </div>

          {/* Supabase Keep-Alive (Prevencion de suspension) */}
          <div className="p-4 bg-emerald-950/20 border border-emerald-500/20 rounded-xl space-y-2.5 text-xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-semibold text-emerald-300 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-emerald-400" />
                Supabase Keep-Alive (Anti-Suspensión):
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {keepAliveData?.success ? `Activo (${keepAliveData.latencyMs}ms)` : 'Activo (Automático)'}
              </span>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed">
              El plan gratuito de Supabase pausa los proyectos tras 7 días de inactividad. Proactor implementa un <strong>sistema de Keep-Alive triple</strong>:
            </p>
            <ul className="text-[10px] text-slate-400 space-y-1 pl-4 list-disc">
              <li><strong>Vercel Cron:</strong> Toca automáticamente <code className="text-indigo-300 bg-slate-900 px-1 py-0.2 rounded">/api/keep-alive</code> todos los días a las 12:00 UTC.</li>
              <li><strong>GitHub Actions:</strong> Ejecuta pings programados a las 06:00 y 18:00 UTC como respaldo.</li>
              <li><strong>Heartbeat Proactivo:</strong> Pulso cada 15 min mientras la app esté abierta.</li>
            </ul>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-slate-400">
                Último pulso: {keepAliveData?.timestamp ? new Date(keepAliveData.timestamp).toLocaleTimeString() : 'Al cargar'}
              </span>
              <button
                onClick={handleManualPing}
                disabled={pingingKeepAlive}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/40 transition-all"
              >
                {pingingKeepAlive ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                <span>Ping Supabase Ahora</span>
              </button>
            </div>
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

            <div className="space-y-2">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/50">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${providers.gemini ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                  <div>
                    <div className="font-semibold text-slate-200">Google Gemini 2.5 Flash</div>
                    <div className="text-[10px] text-slate-400">Transcribe audio nativo (hasta 2 horas) + síntesis avanzada</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  {providers.gemini ? 'Conectado' : 'No detectado'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/50">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${providers.groq ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                  <div>
                    <div className="font-semibold text-slate-200">Groq Whisper Large v3</div>
                    <div className="text-[10px] text-slate-400">Transcripción de voz ultra-rápida (fallback automático)</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  {providers.groq ? 'Conectado' : 'Opcional'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/50">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${providers.openai ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                  <div>
                    <div className="font-semibold text-slate-200">OpenAI Whisper + GPT-4o</div>
                    <div className="text-[10px] text-slate-400">Motor de respaldo adicional para procesamiento</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  {providers.openai ? 'Conectado' : 'Opcional'}
                </span>
              </div>
            </div>
          </div>

          {/* Notion Integration */}
          <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-xl space-y-3 text-xs">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-violet-400" />
              Sincronización con Notion:
            </span>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Notion API Key (Secret Key):
                </label>
                <input
                  type="password"
                  placeholder="secret_... (déjalo vacío si usas variable de entorno)"
                  value={notionKey}
                  onChange={(e) => setNotionKey(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Notion Database ID:
                </label>
                <input
                  type="text"
                  placeholder="ID de 32 caracteres (déjalo vacío si usas variable)"
                  value={notionDb}
                  onChange={(e) => setNotionDb(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={handleTestNotion}
                  disabled={testing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-600/30 hover:bg-violet-600/40 text-violet-300 border border-violet-500/40 transition-all disabled:opacity-50"
                >
                  {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Probar Conexión con Notion
                </button>

                {testResult && (
                  <div className={`text-xs flex items-center gap-1 font-medium ${testResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
                    {testResult.success ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Conectado a "{testResult.databaseTitle}"
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3.5 h-3.5" />
                        {testResult.error || 'Fallo de conexión'}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/90 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}