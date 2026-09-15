import React, { useState } from 'react';
import { X, CheckCircle2, AlertCircle, Loader2, Sparkles, Cpu, Layers, Activity, RefreshCw, ShieldCheck, Database, HardDrive, Keyboard } from 'lucide-react';

export default function SettingsModal({
  isOpen,
  onClose,
  healthData,
  keepAliveData,
  onTriggerKeepAlive,
  onRefreshHealth
}) {
  const [pingingKeepAlive, setPingingKeepAlive] = useState(false);
  const [keepAliveResult, setKeepAliveResult] = useState(null);

  if (!isOpen) return null;

  const handleManualKeepAlive = async () => {
    setPingingKeepAlive(true);
    setKeepAliveResult(null);
    try {
      if (onTriggerKeepAlive) {
        const result = await onTriggerKeepAlive();
        setKeepAliveResult(result);
      } else {
        const res = await fetch('/api/keep-alive');
        const data = await res.json();
        setKeepAliveResult(data);
      }
    } catch (err) {
      setKeepAliveResult({ success: false, message: err.message });
    } finally {
      setPingingKeepAlive(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900/95 backdrop-blur z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Panel del Sistema y Diagnóstico</h2>
              <p className="text-xs text-slate-400">Estado de la base de datos, memoria y seguridad local</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-6">
          {/* Card: Base de datos Supabase & Keep-Alive */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs sm:text-sm">
                <Database className="w-4 h-4" />
                <span>Base de Datos Supabase (PostgreSQL)</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Conectado
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              El motor de persistencia guarda tus libretas, notas, reuniones y transcripciones en la nube.
              El servicio Keep-Alive previene automáticamente que la instancia de Supabase sea pausada por inactividad.
            </p>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
              <div className="text-[11px] text-slate-400">
                {keepAliveData?.latencyMs ? (
                  <span>Latencia actual: <strong className="text-emerald-400 font-mono">{keepAliveData.latencyMs}ms</strong></span>
                ) : (
                  <span>Servicio activo en segundo plano</span>
                )}
              </div>

              <button
                onClick={handleManualKeepAlive}
                disabled={pingingKeepAlive}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-all disabled:opacity-50"
              >
                {pingingKeepAlive ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>Verificar Latencia</span>
              </button>
            </div>

            {keepAliveResult && (
              <div className={`mt-2 p-2.5 rounded-lg text-xs flex items-center gap-2 border ${
                keepAliveResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                  : 'bg-red-500/10 border-red-500/20 text-red-300'
              }`}>
                {keepAliveResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{keepAliveResult.message || 'Comprobación completada con éxito.'} ({keepAliveResult.latencyMs}ms)</span>
              </div>
            )}
          </div>

          {/* Card: Grabación Segura Offline (IndexedDB Caja Negra) */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs sm:text-sm">
                <HardDrive className="w-4 h-4" />
                <span>Caja Negra de Audio (IndexedDB Local)</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Activo
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Durante las sesiones de audio, los fragmentos se almacenan automáticamente en el almacenamiento protegido del navegador. Si la página se recarga por accidente o se pierde la red, la sesión no se pierde.
            </p>
          </div>

          {/* Card: Atajos y Funcionamiento Autónomo */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs sm:text-sm">
              <Keyboard className="w-4 h-4" />
              <span>Funciones de Libreta y Accesibilidad</span>
            </div>
            <ul className="text-xs text-slate-400 space-y-1.5 pt-1">
              <li>• <strong className="text-slate-200">Libretas Canvas</strong>: Múltiples estilos visuales con texturas y portadas artísticas.</li>
              <li>• <strong className="text-slate-200">Temas y Daltonismo</strong>: Barra de temas visibles en el encabezado con paleta Okabe-Ito, Tritanopia y Alto Contraste.</li>
              <li>• <strong className="text-slate-200">Segundo Cerebro</strong>: Búsqueda y conexión entre notas y transcripciones sin depender de apps externas.</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
