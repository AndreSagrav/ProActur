import React, { useState } from 'react';
import { X, Key, Database, CheckCircle2, AlertCircle, Loader2, Sparkles } from 'lucide-react';

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2 text-slate-100 font-bold">
            <Key className="w-5 h-5 text-indigo-400" />
            Configuración e Integraciones
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Status Overview */}
          <div className="p-3.5 bg-slate-800/40 border border-slate-800 rounded-xl space-y-2 text-xs">
            <div className="font-semibold text-slate-300">Estado de variables (.env):</div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Google Gemini API:</span>
              <span className={`px-2 py-0.5 rounded font-mono ${healthData?.hasGeminiKey ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                {healthData?.hasGeminiKey ? 'Configurada' : 'Faltante'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Notion Integration Token:</span>
              <span className={`px-2 py-0.5 rounded font-mono ${healthData?.hasNotionKey ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'}`}>
                {healthData?.hasNotionKey ? 'Configurada' : 'No detectada'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Notion Database ID:</span>
              <span className={`px-2 py-0.5 rounded font-mono ${healthData?.hasNotionDb ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-slate-700 text-slate-400'}`}>
                {healthData?.hasNotionDb ? 'Configurada' : 'Pendiente'}
              </span>
            </div>
          </div>

          {/* Test Notion Credentials Live */}
          <div className="space-y-3">
            <h4 className="text-xs uppercase tracking-wider font-bold text-slate-400">
              Probar o Sobrescribir Conexión con Notion
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
                placeholder="32 caracteres hex del enlace de tu base de datos..."
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

          {/* Tips */}
          <div className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-800 pt-3">
            💡 Puedes definir tus claves fijas en el archivo <code className="text-slate-400">.env</code> en la raíz del proyecto para no tener que ingresarlas nuevamente.
          </div>
        </div>
      </div>
    </div>
  );
}
