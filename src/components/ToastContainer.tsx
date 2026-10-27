import React, { useEffect, useState } from 'react';
import { ToastAlert, subscribeToasts, removeToast } from '../utils/pushNotifications';
import { X, Bell, RotateCw, AlertTriangle, CheckCircle2, Award, Clock } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastAlert[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToasts((updated) => {
      setToasts(updated);
    });
    return unsubscribe;
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const isRotation = toast.type === 'rotation';
        const isWarning = toast.type === 'warning';
        const isSale = toast.type === 'sale';
        const isReopened = toast.type === 'reopened';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-xl border shadow-xl flex items-start gap-3 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 ${
              isSale
                ? 'bg-emerald-950 text-white border-emerald-700'
                : isRotation
                ? 'bg-slate-900 text-white border-blue-500'
                : isWarning
                ? 'bg-amber-950 text-amber-100 border-amber-600'
                : isReopened
                ? 'bg-purple-950 text-purple-100 border-purple-600'
                : 'bg-slate-900 text-white border-slate-700'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {isSale && <Award className="w-5 h-5 text-emerald-400" />}
              {isRotation && <RotateCw className="w-5 h-5 text-blue-400 animate-spin-reverse" />}
              {isWarning && <Clock className="w-5 h-5 text-amber-400 animate-pulse" />}
              {isReopened && <RotateCw className="w-5 h-5 text-purple-400" />}
              {!isSale && !isRotation && !isWarning && !isReopened && <Bell className="w-5 h-5 text-blue-400" />}
            </div>

            <div className="flex-1 text-xs">
              <div className="font-bold text-sm leading-tight mb-0.5">{toast.title}</div>
              <p className="opacity-90 leading-relaxed">{toast.message}</p>
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 opacity-60 hover:opacity-100 rounded transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
