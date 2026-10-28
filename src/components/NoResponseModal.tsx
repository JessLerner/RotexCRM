import React, { useState } from 'react';
import { Clock, RotateCw, X } from 'lucide-react';
import { Lead } from '../types/crm';

interface NoResponseModalProps {
  lead: Lead;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (afterMinutes: number, notes: string) => Promise<void>;
  onRotate: () => Promise<void>;
}

export const NoResponseModal: React.FC<NoResponseModalProps> = ({ lead, isOpen, onClose, onConfirm, onRotate }) => {
  const [afterMinutes, setAfterMinutes] = useState(60);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!isOpen) return null;
  const attempt = lead.noResponseCount || 0;
  const mustRotate = attempt >= 5;

  const submit = async () => {
    try {
      setSaving(true); setError(null);
      if (mustRotate) await onRotate(); else await onConfirm(afterMinutes, notes);
      onClose();
    } catch (cause: any) {
      setError(cause?.message || 'No se pudo guardar la gestión.');
    } finally { setSaving(false); }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4">
    <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
        <div><h3 className="flex items-center gap-2 text-base font-bold text-slate-900"><Clock className="h-5 w-5 text-amber-600" />No responde</h3><p className="mt-0.5 text-xs text-slate-500">{lead.clientName} · intento {Math.min(attempt + 1, 6)} de 6</p></div>
        <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
      </div>
      <div className="space-y-4 p-5">
        {mustRotate ? <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-xs text-purple-900"><strong>Se completaron cinco reprogramaciones.</strong> En el sexto intento no se puede volver a agendar: el dato debe rotar para que otro asesor pueda gestionarlo.</div> : <>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Podés reprogramar este dato hasta cinco veces. El horario se calcula solo dentro de la franja laboral de 09:00 a 20:00.</div>
          <div><label className="mb-2 block text-xs font-semibold text-slate-700">Volver a contactar en</label><div className="grid grid-cols-4 gap-2">{[30, 60, 120, 300].map(value => <button key={value} onClick={() => setAfterMinutes(value)} className={`rounded border py-2 text-xs font-semibold ${afterMinutes === value ? 'border-amber-600 bg-amber-600 text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>+{value < 60 ? `${value}m` : `${value / 60}h`}</button>)}</div></div>
          <div><label className="mb-1 block text-xs font-semibold text-slate-700">Nota opcional</label><textarea value={notes} onChange={event => setNotes(event.target.value)} rows={3} placeholder="Ej. Se llamó y no atendió." className="w-full rounded-lg border border-slate-300 p-2 text-xs" /></div>
        </>}
        {error && <p className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</p>}
      </div>
      <div className="flex justify-end gap-3 border-t border-slate-100 px-5 py-3"><button onClick={onClose} disabled={saving} className="px-3 py-2 text-xs text-slate-600">Cancelar</button><button onClick={submit} disabled={saving} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold text-white ${mustRotate ? 'bg-purple-600 hover:bg-purple-700' : 'bg-amber-600 hover:bg-amber-700'}`}>{mustRotate && <RotateCw className="h-3.5 w-3.5" />}{saving ? 'Guardando…' : mustRotate ? 'Rotar dato' : 'Guardar y reprogramar'}</button></div>
    </div>
  </div>;
};
