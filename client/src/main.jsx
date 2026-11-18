// Supresión proactiva de advertencias de consola (React Router Future Flags)
if (typeof window !== 'undefined') {
  const _warn = console.warn;
  console.warn = function (...args) {
    if (
      args[0] &&
      typeof args[0] === 'string' &&
      (args[0].includes('React Router Future Flag') ||
       args[0].includes('v7_startTransition') ||
       args[0].includes('v7_relativeSplatPath'))
    ) {
      return;
    }
    return _warn.apply(console, args);
  };

  const _err = console.error;
  console.error = function (...args) {
    if (
      args[0] &&
      typeof args[0] === 'string' &&
      (args[0].includes('React Router Future Flag') ||
       args[0].includes('v7_startTransition') ||
       args[0].includes('v7_relativeSplatPath'))
    ) {
      return;
    }
    return _err.apply(console, args);
  };

  // Interceptor global de fetch para adjuntar token Bearer en llamadas a la API
  const _origFetch = window.fetch.bind(window);
  window.fetch = async function (input, init = {}) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const isApiCall = url.startsWith('/api') || url.includes('/api/');
    if (isApiCall) {
      const token = (() => {
        try { return localStorage.getItem('proactur_auth_token'); } catch (_) { return null; }
      })();
      if (token) {
        const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
        if (!headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${token}`);
        }
        init = { ...init, headers };
      }
    }
    const response = await _origFetch(input, init);
    if (isApiCall && response.status === 401 && !url.includes('/api/auth/')) {
      window.dispatchEvent(new Event('proactur:auth-required'));
    }
    return response;
  };
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import AuthGate from './components/AuthGate.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <AuthGate>
          <App />
        </AuthGate>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
)
