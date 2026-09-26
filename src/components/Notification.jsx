import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export default function Notification({ notification, onClose }) {
  if (!notification) return null;

  const { type, message } = notification;

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-600" />,
    error: <XCircle className="w-5 h-5 text-rose-600" />,
    info: <Info className="w-5 h-5 text-sky-600" />
  };

  const bgs = {
    success: 'bg-emerald-50 border-emerald-300 text-emerald-900',
    warning: 'bg-amber-50 border-amber-300 text-amber-900',
    error: 'bg-rose-50 border-rose-300 text-rose-900',
    info: 'bg-sky-50 border-sky-300 text-sky-900'
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md animate-slide-up no-print">
      <div className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg ${bgs[type] || bgs.info}`}>
        <div className="shrink-0 mt-0.5">{icons[type] || icons.info}</div>
        <div className="flex-1 text-sm font-medium">{message}</div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 transition-colors p-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
