import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, Flame } from 'lucide-react';

interface LiveTimerProps {
  deadline: string; // ISO String
  type: '30m' | '5h' | '10d';
  onExpire?: () => void;
  isCompleted?: boolean;
}

export const LiveTimer: React.FC<LiveTimerProps> = ({ deadline, type, onExpire, isCompleted }) => {
  const [timeLeft, setTimeLeft] = useState<{
    totalMs: number;
    hours: number;
    minutes: number;
    seconds: number;
    days?: number;
    isOverdue: boolean;
  }>({
    totalMs: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isOverdue: false,
  });

  useEffect(() => {
    if (isCompleted || !deadline) return;

    const calculate = () => {
      const target = new Date(deadline).getTime();
      const now = Date.now();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft({
          totalMs: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          days: 0,
          isOverdue: true,
        });
        if (onExpire) {
          onExpire();
        }
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({
        totalMs: diff,
        days,
        hours,
        minutes,
        seconds,
        isOverdue: false,
      });
    };

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [deadline, isCompleted, onExpire]);

  if (isCompleted) {
    return (
      <span className="text-xs text-emerald-600 font-medium inline-flex items-center gap-1">
        Cumplido
      </span>
    );
  }

  if (type === '30m') {
    // 30 min timer
    const total30mMs = 30 * 60 * 1000;
    const progressPercent = Math.max(0, Math.min(100, (timeLeft.totalMs / total30mMs) * 100));
    const isCritical = timeLeft.totalMs < 5 * 60 * 1000 && !timeLeft.isOverdue; // less than 5 min

    if (timeLeft.isOverdue) {
      return (
        <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-red-50 text-red-700 rounded border border-red-200 text-xs font-mono tabular-nums">
          <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
          <span className="font-semibold">00:00 (Rotando...)</span>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-1 min-w-[130px]">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 flex items-center gap-1">
            <Clock className={`w-3 h-3 ${isCritical ? 'text-amber-600 animate-pulse' : 'text-slate-400'}`} />
            SLA Contacto
          </span>
          <span
            className={`font-mono tabular-nums font-semibold ${
              isCritical ? 'text-amber-600 animate-pulse' : 'text-slate-800'
            }`}
          >
            {String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
          </span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-1000 ${
              isCritical ? 'bg-amber-500' : progressPercent > 50 ? 'bg-emerald-500' : 'bg-blue-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    );
  }

  if (type === '5h') {
    // 5 hour task timer
    if (timeLeft.isOverdue) {
      return (
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-red-50 text-red-700 rounded border border-red-200 text-xs font-mono tabular-nums">
          <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
          <span>Tarea Vencida (Rotando...)</span>
        </div>
      );
    }

    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-100 text-xs">
        <Clock className="w-3 h-3 text-indigo-500" />
        <span className="font-medium">Tarea:</span>
        <span className="font-mono tabular-nums font-semibold">
          {timeLeft.hours}h {String(timeLeft.minutes).padStart(2, '0')}m
        </span>
      </div>
    );
  }

  // 10 days global closure SLA
  return (
    <div className="text-xs text-slate-500 font-mono tabular-nums flex items-center gap-1">
      <Flame className="w-3 h-3 text-slate-400" />
      <span>
        {timeLeft.days ? `${timeLeft.days}d ` : ''}
        {timeLeft.hours}h para cierre
      </span>
    </div>
  );
};
