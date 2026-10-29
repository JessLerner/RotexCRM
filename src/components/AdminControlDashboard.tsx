import React from 'react';
import { AlertTriangle, ArrowRight, BriefcaseBusiness, Clock3, Database, UserCheck, Users, Wifi } from 'lucide-react';
import { OperationalMetrics } from '../services/leadRepository';
import { PresenceRecord } from '../services/presenceRepository';
import { Vendor } from '../types/crm';

type Props = {
  metrics: OperationalMetrics;
  presence: PresenceRecord[];
  vendors: Vendor[];
  onOpenPortfolio: () => void;
  onOpenRoster: () => void;
};

const number = (value: number) => new Intl.NumberFormat('es-AR').format(value);

export const AdminControlDashboard: React.FC<Props> = ({ metrics, presence, vendors, onOpenPortfolio, onOpenRoster }) => {
  const connected = presence.filter((person) => person.connected).length;
  const activeSellers = vendors.filter((vendor) => vendor.status === 'active').length;
  const pausedSellers = vendors.filter((vendor) => vendor.status === 'paused').length;
  const assigned = metrics.assigned + metrics.in_progress;
  const attention = metrics.due_soon + metrics.overdue;
  const sellerLoad = [...(metrics.seller_breakdown || [])].sort((a, b) => b.active_leads - a.active_leads || a.name.localeCompare(b.name, 'es'));

  const cards = [
    { label: 'Datos en cartera', value: metrics.total, help: 'Total cargado y operativo', icon: Database, tone: 'blue' },
    { label: 'Disponibles para asignar', value: metrics.queued, help: 'En cola de rotación', icon: BriefcaseBusiness, tone: 'indigo' },
    { label: 'Actualmente asignados', value: assigned, help: `${metrics.assigned} sin gestionar · ${metrics.in_progress} en seguimiento`, icon: UserCheck, tone: 'emerald' },
    { label: 'Requieren atención', value: attention, help: `${metrics.due_soon} próximos · ${metrics.overdue} vencidos`, icon: AlertTriangle, tone: attention > 0 ? 'amber' : 'slate' },
    { label: 'Equipo comercial en línea', value: connected, help: `${activeSellers} asesores activos · ${pausedSellers} en franco`, icon: Wifi, tone: 'cyan' },
  ] as const;

  const toneClasses: Record<string, string> = {
    blue: 'border-blue-200 bg-blue-50 text-blue-800',
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    cyan: 'border-cyan-200 bg-cyan-50 text-cyan-800',
    slate: 'border-slate-200 bg-slate-50 text-slate-800',
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-blue-700 font-bold">Administración</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Control operativo</h1>
            <p className="mt-1 text-sm text-slate-600">Resumen de cartera, carga comercial y actividad del equipo.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={onOpenPortfolio} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
              Revisar cartera <ArrowRight className="h-4 w-4" />
            </button>
            <button onClick={onOpenRoster} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Ver vendedores <Users className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {cards.map(({ label, value, help, icon: Icon, tone }) => (
          <div key={label} className={`rounded-xl border p-4 ${toneClasses[tone]}`}>
            <Icon className="h-4 w-4 mb-3" aria-hidden="true" />
            <p className="text-2xl font-bold tabular-nums">{number(value)}</p>
            <p className="mt-1 text-xs font-bold">{label}</p>
            <p className="mt-1 text-[11px] opacity-80 leading-snug">{help}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Carga por asesor</h2>
              <p className="mt-0.5 text-xs text-slate-500">Cupo diario, cartera vigente y actividad comercial.</p>
            </div>
            <button onClick={onOpenRoster} className="text-xs font-semibold text-blue-700 hover:text-blue-900">Gestionar vendedores</button>
          </div>
          {sellerLoad.length === 0 ? <p className="p-7 text-center text-sm text-slate-500">No hay asesores operativos para mostrar.</p> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-600"><tr><th className="px-5 py-3">Asesor</th><th className="px-3 py-3 text-center">Cupo</th><th className="px-3 py-3 text-center">Activos</th><th className="px-3 py-3 text-center">Recibidos hoy</th><th className="px-5 py-3 text-center">Ventas</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{sellerLoad.map((seller) => <tr key={seller.profile_id} className="hover:bg-slate-50"><td className="px-5 py-3"><p className="font-bold text-slate-900">{seller.name}</p><p className="text-[11px] text-slate-500">{seller.status === 'active' ? 'Disponible' : seller.status === 'paused' ? 'En franco' : 'Deshabilitado/a'}</p></td><td className="px-3 py-3 text-center font-mono">{seller.daily_target} / {seller.capacity}</td><td className="px-3 py-3 text-center font-mono font-bold text-indigo-700">{seller.active_leads}</td><td className="px-3 py-3 text-center font-mono">{seller.received_today}</td><td className="px-5 py-3 text-center font-mono font-bold text-emerald-700">{seller.sales_total}</td></tr>)}</tbody>
            </table></div>
          )}
        </div>

        <div className="xl:col-span-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4"><h2 className="text-sm font-bold text-slate-900">Conexión del equipo comercial</h2><p className="mt-0.5 text-xs text-slate-500">Sesiones y última actividad en Rotex.</p></div>
          {presence.length === 0 ? <p className="p-7 text-center text-sm text-slate-500">Sin actividad registrada todavía.</p> : <div className="divide-y divide-slate-100">{[...presence].sort((a, b) => Number(b.connected) - Number(a.connected) || a.name.localeCompare(b.name, 'es')).slice(0, 8).map((person) => <div key={person.profile_id} className="flex items-center gap-3 px-5 py-3"><span className={`h-2.5 w-2.5 rounded-full ${person.connected ? 'bg-emerald-500' : 'bg-slate-300'}`} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-900">{person.name}</p><p className="text-[11px] text-slate-500">{person.role === 'vendedor' ? 'Asesor/a' : 'Supervisor/a'}</p></div><p className={`text-[11px] font-semibold ${person.connected ? 'text-emerald-700' : 'text-slate-500'}`}>{person.connected ? 'En línea' : 'Sin conexión'}</p></div>)}</div>}
          <div className="border-t border-slate-200 px-5 py-3 text-[11px] text-slate-500 flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />La actividad se actualiza aproximadamente cada minuto.</div>
        </div>
      </section>
    </div>
  );
};
