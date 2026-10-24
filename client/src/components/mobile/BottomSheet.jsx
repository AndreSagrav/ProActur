import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function BottomSheet({ isOpen, onClose, title, subtitle, children }) {
  const sheetRef = useRef(null);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTouchStart = (e) => {
    startYRef.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e) => {
    currentYRef.current = e.touches[0].clientY;
    const deltaY = currentYRef.current - startYRef.current;
    if (deltaY > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${deltaY}px)`;
    }
  };

  const handleTouchEnd = () => {
    const deltaY = currentYRef.current - startYRef.current;
    if (deltaY > 100) {
      onClose();
    } else if (sheetRef.current) {
      sheetRef.current.style.transform = 'translateY(0px)';
    }
    startYRef.current = 0;
    currentYRef.current = 0;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-sm animate-fade-in">
      {/* Fondo clicable para cerrar */}
      <div className="flex-1" onClick={onClose} />

      {/* Lámina Deslizante Inferior */}
      <div
        ref={sheetRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="w-full bg-slate-900 border-t border-slate-800 rounded-t-3xl shadow-2xl max-h-[88vh] flex flex-col transition-transform duration-200 safe-bottom"
      >
        {/* Barra superior de arrastre (Grab Handle) */}
        <div className="pt-3 pb-2 flex justify-center cursor-grab active:cursor-grabbing">
          <div className="w-12 h-1.5 bg-slate-700 rounded-full" />
        </div>

        {/* Encabezado */}
        <div className="px-5 py-3 border-b border-slate-800/80 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-base font-bold text-white">{title}</h3>
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido Desplazable */}
        <div className="p-5 overflow-y-auto flex-1 overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );
}
