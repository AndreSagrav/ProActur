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
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
)
