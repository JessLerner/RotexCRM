import React, { useState } from 'react';

interface InviteSellerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (data: { name: string; email: string; maxAssignments: number }) => Promise<void>;
}

export const InviteSellerModal: React.FC<InviteSellerModalProps> = ({ isOpen, onClose, onInvite }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [capacity, setCapacity] = useState(15);
  const [error, setError] = useState<string | null>(null);
  if (!isOpen) return null;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setError(null);
      await onInvite({ name, email, maxAssignments: capacity });
      setName(''); setEmail(''); onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo enviar la invitación.'); }
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
    <form onSubmit={submit} className="w-full max-w-md space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-xl text-xs">
      <div><h3 className="text-base font-bold">Invitar nuevo asesor</h3><p className="mt-1 text-slate-500">Se asignará al supervisor activo de este equipo y heredará su marca.</p></div>
      {error && <p className="rounded border border-red-200 bg-red-50 p-2 text-red-700">{error}</p>}
      <label className="block font-semibold">Nombre completo<input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded border border-slate-300 p-2" /></label>
      <label className="block font-semibold">Correo electrónico<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded border border-slate-300 p-2" /></label>
      <label className="block font-semibold">Capacidad máxima<input required type="number" min="1" max="100" value={capacity} onChange={(e) => setCapacity(Number(e.target.value) || 15)} className="mt-1 w-full rounded border border-slate-300 p-2" /></label>
      <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="px-3 py-2 text-slate-600">Cancelar</button><button className="rounded bg-indigo-600 px-4 py-2 font-bold text-white">Enviar invitación</button></div>
    </form>
  </div>;
};
