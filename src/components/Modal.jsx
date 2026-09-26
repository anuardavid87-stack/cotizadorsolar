import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-2xl' }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto no-print">
      <div className="flex min-h-screen items-end sm:items-center justify-center p-0 sm:p-4 text-center">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity animate-fade-in"
          onClick={onClose}
        />

        {/* Modal / Bottom Sheet Box */}
        <div className={`relative transform overflow-hidden rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 text-left shadow-2xl transition-all w-full ${maxWidth} my-0 sm:my-8 z-10 border-t sm:border border-slate-200 dark:border-slate-800 max-h-[92vh] sm:max-h-[85vh] flex flex-col`}>
          {/* Mobile Drag Indicator Handle */}
          <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto sm:hidden mt-2.5 shrink-0" />

          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4 py-3.5 sm:px-6 sm:py-4 bg-slate-50/90 dark:bg-slate-800/80 shrink-0">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 pr-2 leading-tight">
              {title}
            </h3>
            <button
              onClick={onClose}
              type="button"
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer shrink-0 active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Content with smooth touch scrolling */}
          <div className="px-4 py-4 sm:px-6 sm:py-5 overflow-y-auto overscroll-contain flex-1">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
