import React, { useEffect, useState } from 'react';
import { Lock, ShieldCheck, Loader2, AlertCircle } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';
const TOKEN_KEY = 'proactur_auth_token';

export default function AuthGate({ children }) {
  const [checking, setChecking] = useState(true);
  const [pinRequired, setPinRequired] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const verifyStatus = async () => {
    try {
      const res = await fetch(`${API}/api/auth/status`);
      if (!res.ok) {
        // Si el backend no responde o está offline, permitir modo offline/local
        setAuthenticated(true);
        setPinRequired(false);
        return;
      }
      const data = await res.json();
      setPinRequired(Boolean(data.pinRequired));
      setAuthenticated(!data.pinRequired || Boolean(data.authenticated));
    } catch (_) {
      setAuthenticated(true);
      setPinRequired(false);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    verifyStatus();

    const onAuthRequired = () => {
      try {
        localStorage.removeItem(TOKEN_KEY);
      } catch (_) {}
      setPinRequired(true);
      setAuthenticated(false);
    };

    window.addEventListener('proactur:auth-required', onAuthRequired);
    return () => window.removeEventListener('proactur:auth-required', onAuthRequired);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pin.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin.trim() })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'PIN incorrecto');
        return;
      }
      if (data.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
      }
      setPin('');
      setAuthenticated(true);
    } catch (_) {
      setError('No se pudo conectar con el servidor');
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-7 h-7 text-indigo-400 animate-spin" />
          <p className="text-xs text-slate-400 font-medium tracking-wide">Verificando sesión segura...</p>
        </div>
      </div>
    );
  }

  if (pinRequired && !authenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl shadow-indigo-950/40">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center mb-3">
              <ShieldCheck className="w-6 h-6 text-indigo-400" />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-white">ProActur Protegido</h1>
            <p className="text-xs text-slate-400 mt-1">
              Ingresa tu PIN de acceso ejecutivo para desbloquear tus datos.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                inputMode="numeric"
                autoFocus
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="PIN de acceso"
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition-colors"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !pin.trim()}
              className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold transition-all shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              <span>{submitting ? 'Verificando...' : 'Desbloquear'}</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return children;
}
