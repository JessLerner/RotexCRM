import React, { useEffect, useState } from 'react';
import { LockKeyhole, Trophy } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Item = { lead_id: string; contact: string; phone_hint: string; brand: string; model: string | null; closed_at: string };
export const VendorAnonymizedHistory: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]); const [error, setError] = useState('');
  useEffect(() => { supabase.rpc('get_vendor_anonymized_sales_history').then(({ data, error }) => { if (error) setError(error.message); else setItems((data || []) as Item[]); }); }, []);
  return <section className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden"><div className="border-b border-slate-200 bg-slate-50 px-5 py-4"><h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><Trophy className="h-4 w-4 text-amber-500" />Historial de cartera</h3><p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><LockKeyhole className="h-3 w-3" />Datos protegidos: sólo ves que un contacto que trabajaste terminó en venta.</p></div>{error ? <p className="p-5 text-xs text-red-700">{error}</p> : items.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">Todavía no hay ventas de tu cartera anterior para mostrar.</p> : <div className="divide-y divide-slate-100">{items.map(item => <div key={item.lead_id} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-mono text-sm font-bold text-slate-900">{item.contact}</p><p className="text-xs text-slate-500">{item.phone_hint} · {item.brand}{item.model ? ` · ${item.model}` : ''}</p></div><p className="text-xs font-semibold text-emerald-700">Venta cerrada · {new Date(item.closed_at).toLocaleDateString('es-AR')}</p></div>)}</div>}</section>;
};
