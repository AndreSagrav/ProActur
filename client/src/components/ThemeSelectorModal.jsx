import React from 'react';
import { X, Check, Eye, Sun, Moon, Palette, Type, ShieldCheck } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeSelectorModal({ isOpen, onClose }) {
  const { theme, setTheme, THEMES, fontSize, setFontSize } = useTheme();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Encabezado */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5 text-slate-100 font-bold text-sm sm:text-base">
            <Palette className="w-5 h-5 text-indigo-400" />
            <span>Accesibilidad Visual y Temas</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto">
          {/* Mensaje de Accesibilidad WCAG */}
          <div className="p-3.5 rounded-xl bg-indigo-950/25 border border-indigo-500/25 flex items-start gap-2.5 text-xs text-slate-300">
            <Eye className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Diseñado según estándares <strong>WCAG 2.1 AAA</strong> para personas con daltonismo (protanopía, deuteranopía, tritanopía) o fatiga visual. Ninguna información depende únicamente del color.
            </p>
          </div>

          {/* Selector de Temas */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
              Esquema de Color Adaptado
            </label>
            <div className="space-y-2.5">
              {THEMES.map((t) => {
                const isSelected = theme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`w-full p-3.5 rounded-xl border text-left transition-all flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-indigo-600/20 border-indigo-500 text-white ring-1 ring-indigo-500/50 shadow-md'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-800/80 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xl shrink-0">{t.icon}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs sm:text-sm text-slate-100">{t.name}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-700/60 text-slate-300 font-medium">
                            {t.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{t.desc}</p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isSelected ? (
                        <div className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full border border-slate-600" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tamaño de Tipografía Accesible */}
          <div className="pt-2 border-t border-slate-800">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
              <Type className="w-4 h-4 text-slate-400" />
              <span>Tamaño de Texto (Para baja visión)</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'normal', label: 'Estándar', sample: 'Aa' },
                { id: 'large', label: 'Mediano (+15%)', sample: 'Aa' },
                { id: 'xlarge', label: 'Grande (+30%)', sample: 'Aa' }
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFontSize(f.id)}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    fontSize === f.id
                      ? 'bg-indigo-600/25 border-indigo-500 text-white font-bold'
                      : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="text-base sm:text-lg mb-1">{f.sample}</div>
                  <div className="text-[11px]">{f.label}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Pie */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/90 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow transition-all"
          >
            Aplicar y Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
