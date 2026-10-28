import React, { useState } from 'react';
import { X, CheckCircle2, RotateCw, AlertTriangle, FileText } from 'lucide-react';
import { Lead, ClosureOutcome } from '../types/crm';
import { getOutcomeLabel } from '../utils/rotationEngine';

interface ClosureModalProps {
  lead: Lead;
  isOpen: boolean;
  onClose: () => void;
  onConfirmClosure: (outcome: ClosureOutcome, notes: string) => void;
}

export const ClosureModal: React.FC<ClosureModalProps> = ({ lead, isOpen, onClose, onConfirmClosure }) => {
  const [outcome, setOutcome] = useState<ClosureOutcome>('venta');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isSale = outcome === 'venta';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSale && notes.trim().length < 5) {
      setError('Debés anexar una breve descripción detallando el motivo para el próximo asesor.');
      return;
    }

    onConfirmClosure(outcome, notes.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-slate-900/60 p-4">
      <div className="my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-700" />
              <span>Cierre de Gestión · {lead.clientName}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Marca: <span className="font-semibold text-slate-700">{lead.brand}</span> · Modelo: {lead.modelInterest}
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dynamic rule banner */}
        {isSale ? (
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-3 flex items-start gap-2.5 text-xs text-emerald-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">¡Venta Exitosa!</span> El lead quedará archivado como venta confirmada y se sumará a tus métricas de conversión.
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-start gap-2.5 text-xs text-amber-900">
            <RotateCw className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 animate-spin-reverse" />
            <div>
              <span className="font-bold">Cierre con trazabilidad:</span> el dato saldrá de la bandeja activa y quedará conservado en el historial con este motivo, tu nota, fecha y responsable. No se elimina.
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-4">
          {/* Motivo de cierre */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Motivo de Cierre
            </label>
            <div className="space-y-2">
              {[
                { id: 'venta', label: '🎉 Venta Confirmada', desc: 'Operación cerrada exitosamente' },
                { id: 'dato_erroneo', label: '❌ Dato erróneo', desc: 'Teléfono inexistente, persona equivocada' },
                { id: 'ya_compro_en_otro_lado', label: '🚗 Ya compró en otro lado', desc: 'Compró en otra agencia o competidor' },
                { id: 'ya_es_cliente_nuestro', label: '🤝 Ya es cliente nuestro', desc: 'Tiene operación abierta o ya atendido' },
                { id: 'otro', label: '📝 Otro motivo', desc: 'Requiere descripción obligatoria' },
              ].map((opt) => (
                <label
                  key={opt.id}
                  onClick={() => {
                    setOutcome(opt.id as ClosureOutcome);
                    setError(null);
                  }}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    outcome === opt.id
                      ? opt.id === 'venta'
                        ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-400'
                        : 'bg-amber-50 border-amber-300 ring-1 ring-amber-400'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="outcome"
                    checked={outcome === opt.id}
                    onChange={() => {}}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-xs font-semibold text-slate-900">{opt.label}</div>
                    <div className="text-xs text-slate-500">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Anexo obligatorio para motivos no-venta */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {isSale ? 'Notas de la Venta (Opcional)' : 'Breve Descripción Anexa (OBLIGATORIA)'}
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setError(null);
              }}
              placeholder={
                isSale
                  ? 'Ej. Modelo cerrado: Corolla Cross XEI Blanco. Facturado.'
                  : 'Detallá qué respondió el cliente, objeción o detalle para que el próximo asesor que lo reciba tenga el contexto exacto...'
              }
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
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
              className={`px-4 py-2 text-xs font-semibold text-white rounded-lg shadow-sm transition-colors ${
                isSale ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {isSale ? 'Confirmar Venta' : 'Cerrar y Guardar en Historial'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
