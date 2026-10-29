import React from 'react';
import { Activity, Clock3, Users } from 'lucide-react';
import { PresenceRecord } from '../services/presenceRepository';

interface PresencePanelProps {
  people: PresenceRecord[];
  title?: string;
  emptyMessage?: string;
}

const roleLabel: Record<string, string> = {
  administracion: 'Administración',
  gerencia: 'Gerencia',
  supervisor: 'Supervisor/a',
  vendedor: 'Asesor/a',
};

const minutesAgo = (value: string | null) => {
  if (!value) return 'Sin actividad registrada';
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return 'Ahora mismo';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h ${minutes % 60} min`;
  return `Hace ${Math.floor(hours / 24)} día(s)`;
};

const connectedFor = (minutes: number | null) => {
  if (minutes === null || minutes < 1) return 'Conectado recién';
  if (minutes < 60) return `Conectado hace ${minutes} min`;
  return `Conectado hace ${Math.floor(minutes / 60)} h ${minutes % 60} min`;
};

export const PresencePanel: React.FC<PresencePanelProps> = ({
  people,
  title = 'Actividad del equipo',
  emptyMessage = 'Todavía no hay actividad registrada para mostrar.',
}) => {
  const orderedPeople = [...people].sort((a, b) => Number(b.connected) - Number(a.connected) || a.name.localeCompare(b.name, 'es'));

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Activity className="w-4 h-4 text-cyan-600" />{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">Conexión actual y última actividad registrada en Rotex.</p>
        </div>
        <span className="shrink-0 text-xs font-bold text-cyan-700 bg-cyan-50 border border-cyan-200 rounded-full px-2.5 py-1">
          {orderedPeople.filter((person) => person.connected).length} en línea
        </span>
      </div>
      {orderedPeople.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500"><Users className="w-5 h-5 mx-auto mb-2 text-slate-300" />{emptyMessage}</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {orderedPeople.map((person) => (
            <div key={person.profile_id} className="px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${person.connected ? 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,.12)]' : 'bg-slate-300'}`} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 truncate">{person.name}</p>
                <p className="text-[11px] text-slate-500">{roleLabel[person.role] || person.role}</p>
              </div>
              <div className="sm:text-right text-xs">
                <p className={`font-semibold ${person.connected ? 'text-emerald-700' : 'text-slate-600'}`}>{person.connected ? connectedFor(person.connected_minutes) : 'Desconectado/a'}</p>
                <p className="text-[11px] text-slate-500 inline-flex items-center gap-1"><Clock3 className="w-3 h-3" />{person.connected ? 'Última actividad: ahora' : `Última actividad: ${minutesAgo(person.last_seen_at)}`}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
