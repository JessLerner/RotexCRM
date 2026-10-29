import React, { useState } from 'react';
import { StructureSupervisor } from '../services/structureRepository';

type Action = 'move_to_supervisor' | 'leave_with_manager' | 'disable_sellers';

export const RetireSupervisorModal: React.FC<{ supervisor: StructureSupervisor | null; supervisors: StructureSupervisor[]; onClose: () => void; onConfirm: (action: Action, replacementId?: string) => Promise<void> }> = ({ supervisor, supervisors, onClose, onConfirm }) => {
  const [action, setAction] = useState<Action>('move_to_supervisor');
  const [replacementId, setReplacementId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!supervisor) return null;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (action === 'move_to_supervisor' && !replacementId) { setError('Seleccioná el supervisor que recibirá a los asesores.'); return; }
    try { setSaving(true); setError(null); await onConfirm(action, action === 'move_to_supervisor' ? replacementId : undefined); onClose(); }
    catch (cause: any) { setError(cause?.message || 'No se pudo deshabilitar al supervisor.'); }
    finally { setSaving(false); }
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4">
    <form onSubmit={submit} className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
      <h3 className="text-base font-bold text-slate-900">Deshabilitar permanentemente a {supervisor.name}</h3>
      <p className="mt-1 text-xs text-slate-500">La baja conserva su historial. Elegí cómo continuar con sus asesores antes de confirmar.</p>
      <fieldset className="mt-5 space-y-3 text-xs"><legend className="font-semibold text-slate-700 mb-2">Asesores actualmente a su cargo</legend>
        <label className="block rounded-lg border border-slate-200 p-3 cursor-pointer"><input className="mr-2" type="radio" checked={action === 'move_to_supervisor'} onChange={() => setAction('move_to_supervisor')} />Reasignarlos a otro supervisor activo
          {action === 'move_to_supervisor' && <select value={replacementId} onChange={(event) => setReplacementId(event.target.value)} className="mt-3 block w-full rounded border border-slate-300 p-2"><option value="">Seleccionar supervisor</option>{supervisors.filter((item) => item.id !== supervisor.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}
        </label>
        <label className="block rounded-lg border border-slate-200 p-3 cursor-pointer"><input className="mr-2" type="radio" checked={action === 'leave_with_manager'} onChange={() => setAction('leave_with_manager')} />Dejarlos sin supervisor: quedan a cargo de Gerencia</label>
        <label className="block rounded-lg border border-red-200 bg-red-50 p-3 cursor-pointer text-red-800"><input className="mr-2" type="radio" checked={action === 'disable_sellers'} onChange={() => setAction('disable_sellers')} />Deshabilitar también a todos sus asesores y devolver sus datos a la cartera</label>
      </fieldset>
      {error && <p className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</p>}
      <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={saving} onClick={onClose} className="px-3 py-2 text-xs text-slate-600">Cancelar</button><button disabled={saving} className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60">{saving ? 'Procesando…' : 'Confirmar baja permanente'}</button></div>
    </form>
  </div>;
};
