import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-red-500/30 rounded-3xl p-8 max-w-lg w-full text-center shadow-2xl space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto border border-red-500/20">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-slate-100">Se produjo un error visual</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              La aplicación detectó una excepción en la vista. Puedes recargar para restaurar el estado normal:
            </p>
            <div className="bg-black/50 p-3 rounded-xl text-[11px] font-mono text-red-300 text-left overflow-x-auto max-h-32 border border-slate-800">
              {this.state.error?.message || String(this.state.error)}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Recargar Aplicación</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
