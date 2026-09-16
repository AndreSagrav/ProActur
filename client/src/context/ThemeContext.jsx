import React, { createContext, useContext, useState, useEffect } from 'react';

export const THEMES = [
  {
    id: 'obsidian',
    name: 'Obsidian Dark',
    label: 'Modo Oscuro Ejecutivo',
    desc: 'Contraste balanceado slate e índigo',
    icon: '🌑',
    type: 'dark',
    previewColor: '#0f172a',
    accentColor: '#6366f1'
  },
  {
    id: 'colorblind-safe',
    name: 'Accesible Daltonismo',
    label: 'Protan / Deutan Seguro',
    desc: 'Paleta Okabe-Ito (azul cobalto + ámbar oro)',
    icon: '👁️',
    type: 'colorblind',
    previewColor: '#1e3a8a',
    accentColor: '#3b82f6'
  },
  {
    id: 'tritanopia',
    name: 'Tritanopía',
    label: 'Tritan Seguro',
    desc: 'Paleta de alto contraste magenta y verde azulado',
    icon: '🎨',
    type: 'colorblind',
    previewColor: '#86198f',
    accentColor: '#d946ef'
  },
  {
    id: 'high-contrast',
    name: 'Alto Contraste',
    label: 'Contraste Extremo OLED',
    desc: 'Negro absoluto con bordes amarillos y texto hiperlegible',
    icon: '🕶️',
    type: 'contrast',
    previewColor: '#000000',
    accentColor: '#facc15'
  },
  {
    id: 'soft-light',
    name: 'Luz Suave Diurna',
    label: 'Descanso Ocular',
    desc: 'Fondo diurno apergaminado de alto contraste',
    icon: '☀️',
    type: 'light',
    previewColor: '#f8fafc',
    accentColor: '#4f46e5'
  }
];

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('proactur_theme') || 'obsidian';
    } catch (_) {
      return 'obsidian';
    }
  });

  const [fontSize, setFontSize] = useState(() => {
    try {
      return localStorage.getItem('proactur_font_size') || 'normal'; // 'normal' | 'large' | 'xlarge'
    } catch (_) {
      return 'normal';
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-font-size', fontSize);
    try {
      localStorage.setItem('proactur_theme', theme);
      localStorage.setItem('proactur_font_size', fontSize);
    } catch (_) {}
  }, [theme, fontSize]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, THEMES, fontSize, setFontSize }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme debe ser usado dentro de un ThemeProvider');
  }
  return context;
}
