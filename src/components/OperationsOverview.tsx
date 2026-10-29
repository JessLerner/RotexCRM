import React from 'react';
import { AlertTriangle, CheckCircle2, RotateCw, Users } from 'lucide-react';
import { OperationalMetrics } from '../services/leadRepository';

export const OperationsOverview: React.FC<{ metrics: OperationalMetrics; title?: string }> = ({ metrics, title = 'Estado operativo de la cartera' }) => {
  const sellers = metrics.seller_breakdown || [];
  const cards = [
    ['Disponibles', metrics.queued, 'text-blue-700 bg-blue-50 border-blue-200'],
    ['En gestión', metrics.assigned, 'text-indigo-700 bg-indigo-50 border-indigo-200'],
    ['Próximos a rotar', metrics.due_soon, 'text-amber-700 bg-amber-50 border-amber-200'],
    ['Vencidos', metrics.overdue, 'text-red-700 bg-red-50 border-red-200'],
    ['Rotados hoy', metrics.rotated_today, 'text-purple-700 bg-purple-50 border-purple-200'],
    ['Cerrados', metrics.closed_won + metrics.closed_lost, 'text-emerald-700 bg-emerald-50 border-emerald-200'],
  ] as const;

  return (
    <section className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div><h3 className="text-sm font-bold text-slate-900">{title}</h3><p className="text-xs text-slate-500 mt-0.5">Totales reales en Supabase; no dependen de la cantidad de filas visibles.</p></div>
          <span className="text-xs text-slate-500 font-medium">{metrics.total} datos en total</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {cards.map(([label, value, color]) => <div key={label} className={`rounded-lg border px-3 py-2.5 ${color}`}><p className="text-[11px] font-semibold">{label}</p><p className="font-mono tabular-nums text-xl font-bold mt-1">{value}</p></div>)}
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2"><Users className="w-4 h-4 text-indigo-600" /><div><h3 className="text-sm font-bold text-slate-900">Seguimiento por asesor</h3><p className="text-xs text-slate-500">Cupo, actividad del día, recontactos y ventas acumuladas.</p></div></div>
        {sellers.length === 0 ? <div className="p-7 text-center text-xs text-slate-500">No hay asesores visibles en esta estructura.</div> : <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-50/60 text-slate-600"><tr><th className="px-4 py-3">Asesor</th><th className="px-3 py-3 text-center">Cupo</th><th className="px-3 py-3 text-center">Activos</th><th className="px-3 py-3 text-center">Recibidos hoy</th><th className="px-3 py-3 text-center">Gestiones hoy</th><th className="px-3 py-3 text-center">Recontactos</th><th className="px-4 py-3 text-center">Ventas</th></tr></thead><tbody className="divide-y divide-slate-100">{sellers.map((seller) => <tr key={seller.profile_id} className="hover:bg-slate-50"><td className="px-4 py-3"><p className="font-bold text-slate-900">{seller.name}</p><p className={seller.status === 'active' ? 'text-emerald-700 text-[11px]' : 'text-amber-700 text-[11px]'}>{seller.status === 'active' ? 'Activo/a' : seller.status === 'paused' ? 'En franco' : 'Deshabilitado/a'}</p></td><td className="px-3 py-3 text-center font-mono">{seller.daily_target} / {seller.capacity}</td><td className="px-3 py-3 text-center font-mono font-bold text-indigo-700">{seller.active_leads}</td><td className="px-3 py-3 text-center font-mono">{seller.received_today}</td><td className="px-3 py-3 text-center font-mono">{seller.managed_today}</td><td className="px-3 py-3 text-center font-mono">{seller.recontacts_today}</td><td className="px-4 py-3 text-center font-mono font-bold text-emerald-700">{seller.sales_total}</td></tr>)}</tbody></table></div>}
      </div>
    </section>
  );
};
