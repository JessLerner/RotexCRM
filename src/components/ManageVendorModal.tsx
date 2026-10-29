import React, { useEffect, useState } from 'react';
import { Vendor } from '../types/crm';
import { MemberStructure, StructureBrand, StructureSupervisor } from '../services/structureRepository';

interface ManageVendorModalProps {
  vendor: Vendor | null;
  supervisors: StructureSupervisor[];
  brands: StructureBrand[];
  initial: MemberStructure | null;
  onClose: () => void;
  onSave: (vendorId: string, value: MemberStructure) => Promise<void>;
}

export const ManageVendorModal: React.FC<ManageVendorModalProps> = ({ vendor, supervisors, brands, initial, onClose, onSave }) => {
  const [supervisorId, setSupervisorId] = useState('');
  const [brandIds, setBrandIds] = useState<string[]>([]);
  const [capacity, setCapacity] = useState(15);
  const [dailyTarget, setDailyTarget] = useState(5);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (vendor && initial) { setSupervisorId(initial.supervisorId); setBrandIds(initial.brandIds); setCapacity(initial.capacity); setDailyTarget(initial.dailyTarget); setError(null); } }, [vendor, initial]);
  if (!vendor || !initial) return null;
  const toggleBrand = (id: string) => setBrandIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supervisorId || brandIds.length === 0) { setError('Seleccioná un supervisor y al menos una marca.'); return; }
    try { setSaving(true); setError(null); await onSave(vendor.id, { supervisorId, brandIds, capacity, dailyTarget }); onClose(); }
    catch (cause: any) { setError(cause?.message || 'No se pudo guardar la estructura.'); }
    finally { setSaving(false); }
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4">
    <form onSubmit={submit} className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
      <h3 className="text-base font-bold text-slate-900">Editar estructura de {vendor.name}</h3>
      <p className="mt-1 text-xs text-slate-500">Los cambios quedan auditados. Si el asesor queda sin disponibilidad, sus datos vuelven a la cola para rotación.</p>
      <div className="mt-5 space-y-4 text-xs">
        <label className="block font-semibold text-slate-700">Supervisor responsable<select required value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2"><option value="">Seleccionar supervisor</option>{supervisors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <fieldset><legend className="font-semibold text-slate-700">Marcas habilitadas</legend><div className="mt-2 grid grid-cols-2 gap-2">{brands.map((brand) => <label key={brand.id} className="flex items-center gap-2 rounded border border-slate-200 p-2 text-slate-700"><input type="checkbox" checked={brandIds.includes(brand.id)} onChange={() => toggleBrand(brand.id)} />{brand.name}</label>)}</div></fieldset>
        <div className="grid grid-cols-2 gap-3"><label className="font-semibold text-slate-700">Capacidad máxima<input type="number" min="1" max="100" value={capacity} onChange={(e) => setCapacity(Number(e.target.value) || 1)} className="mt-1 w-full rounded-lg border border-slate-300 p-2" /></label><label className="font-semibold text-slate-700">Cupo diario inicial<input type="number" min="1" max="10" value={dailyTarget} onChange={(e) => setDailyTarget(Number(e.target.value) || 1)} className="mt-1 w-full rounded-lg border border-slate-300 p-2" /></label></div>
        {error && <p className="rounded border border-red-200 bg-red-50 p-2 text-red-700">{error}</p>}
      </div>
      <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} disabled={saving} className="px-3 py-2 text-xs text-slate-600">Cancelar</button><button disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60">{saving ? 'Guardando…' : 'Guardar cambios'}</button></div>
    </form>
  </div>;
};
