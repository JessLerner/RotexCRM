import React, { useState } from 'react';
import { X, Clock, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Lead, ScheduledTask } from '../types/crm';

interface TaskModalProps {
  lead: Lead;
  isOpen: boolean;
  onClose: () => void;
  onScheduleTask: (task: Omit<ScheduledTask, 'id' | 'createdAt' | 'completed'>) => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({ lead, isOpen, onClose, onScheduleTask }) => {
  const [description, setDescription] = useState('');
  const [taskType, setTaskType] = useState<ScheduledTask['type']>('llamada');
  const [hoursFromNow, setHoursFromNow] = useState<number>(2); // default 2 hours
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError('Por favor ingresá un detalle o compromiso de la tarea.');
      return;
    }

    if (hoursFromNow <= 0 || hoursFromNow > 5) {
      setError('El plazo de la próxima tarea NO puede superar las 5 horas.');
      return;
    }

    const dueAt = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();

    onScheduleTask({
      description: description.trim(),
      type: taskType,
      dueAt,
    });
    onClose();
  };

  const setPresetHours = (h: number) => {
    setHoursFromNow(h);
    setError(null);
  };

  const calculatedDueDate = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <span>Programar Próxima Tarea (Retención de Lead)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Lead: {lead.clientName} · Marca: <span className="font-semibold text-slate-700">{lead.brand}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Regla de 5 Horas Banner */}
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-start gap-2.5 text-xs text-amber-900">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Regla de 5 Horas:</span> Para quedarte con el dato debés fijar una próxima tarea en <strong>no más de 5 horas</strong>. Si vence sin gestión, el dato rotará a otro asesor de {lead.brand}.
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Tipo de tarea */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Tipo de Compromiso
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { type: 'llamada', label: '📞 Llamada' },
                { type: 'whatsapp', label: '💬 WhatsApp' },
                { type: 'cotizacion', label: '📄 Cotización' },
                { type: 'visita', label: '🏢 Concesionario' },
                { type: 'seguimiento', label: '🔄 Seguimiento' },
              ].map((item) => (
                <button
                  type="button"
                  key={item.type}
                  onClick={() => setTaskType(item.type as any)}
                  className={`py-2 px-2.5 text-xs font-medium rounded-lg border text-center transition-colors ${
                    taskType === item.type
                      ? 'bg-blue-50 border-blue-300 text-blue-700 font-bold'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Plazo en horas (<= 5h) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Plazo de Ejecución (Máximo 5 horas)
              </label>
              <span className="text-xs font-mono tabular-nums text-blue-600 font-bold">
                En {hoursFromNow} hora{hoursFromNow !== 1 ? 's' : ''} ({calculatedDueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
              </span>
            </div>

            {/* Quick buttons */}
            <div className="grid grid-cols-4 gap-2 mb-2">
              {[1, 2, 3, 4.5].map((h) => (
                <button
                  type="button"
                  key={h}
                  onClick={() => setPresetHours(h)}
                  className={`py-1.5 text-xs font-mono tabular-nums font-semibold rounded border transition-colors ${
                    hoursFromNow === h
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  +{h} h
                </button>
              ))}
            </div>

            {/* Slider */}
            <input
              type="range"
              min="0.5"
              max="5"
              step="0.5"
              value={hoursFromNow}
              onChange={(e) => setPresetHours(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Detalle de la Tarea / Compromiso acordado
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej. Enviar propuesta de financiación por WhatsApp y llamarlo para confirmar recepción..."
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
            >
              Guardar Tarea y Retener Lead
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
