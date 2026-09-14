import React, { createContext, useContext, useState, useEffect } from 'react';

export const THEMES = [
  {
    id: 'obsidian',
    name: 'Obsidian Dark',
    label: 'Modo Oscuro Ejecutivo',
    desc: 'Contraste balanceado slate e índigo',
    icon: '🌑',
    type: 'dark'
  },
  {
    id: 'colorblind-safe',
    name: 'Accesible Daltonismo (Rojo-Verde)',
    label: 'Protan / Deutan Seguro',
    desc: 'Paleta Okabe-Ito (azul cobalto + ámbar oro, sin rojo/verde ambiguos)',
    icon: '👁️',
    type: 'colorblind'
  },
  {
    id: 'tritanopia',
    name: 'Accesible Daltonismo (Azul-Amarillo)',
    label: 'Tritan Seguro',
    desc: 'Paleta de alto contraste magenta y verde azulado',
    icon: '🎨',
    type: 'colorblind'
  },
  {
    id: 'high-contrast',
    name: 'Baja Visión (Alto Contraste)',
    label: 'Contraste Extremo OLED',
    desc: 'Negro absoluto con bordes amarillos y texto hiperlegible',
    icon: '🕶️',
    type: 'contrast'
  },
  {
    id: 'soft-light',
    name: 'Luz Suave Diurna',
    label: 'Descanso Ocular',
    desc: 'Fondo apergaminado sin reflejos ni luz azul dañina',
    icon: '☀️',
    type: 'light'
  }
];

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('proactor_theme') || 'obsidian';
    } catch (_) {
      return 'obsidian';
    }
  });

  const [fontSize, setFontSize] = useState(() => {
    try {
      return localStorage.getItem('proactor_font_size') || 'normal'; // 'normal' | 'large' | 'xlarge'
    } catch (_) {
      return 'normal';
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-font-size', fontSize);
    try {
      localStorage.setItem('proactor_theme', theme);
      localStorage.setItem('proactor_font_size', fontSize);
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
