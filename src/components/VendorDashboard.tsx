import React, { useState } from 'react';
import { Lead, Vendor, ScheduledTask, ClosureOutcome } from '../types/crm';
import { LiveTimer } from './LiveTimers';
import { RankingsView } from './RankingsView';
import {
  MessageSquare,
  Phone,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  RotateCw,
  PlusCircle,
  Award,
  Calendar,
  Sparkles,
  Inbox,
  Flame,
  Search,
} from 'lucide-react';

interface VendorDashboardProps {
  currentVendor: Vendor;
  assignedLeads: Lead[];
  allVendors: Vendor[];
  allLeads: Lead[];
  onOpenDetail: (lead: Lead) => void;
  onOpenTaskModal: (lead: Lead) => void;
  onOpenClosureModal: (lead: Lead) => void;
  onWhatsAppClick: (lead: Lead) => void;
  onCallClick: (lead: Lead) => void;
  onRequestLead: (vendor: Vendor) => void;
  onToggleStatus: (vendorId: string, currentStatus: Vendor['status']) => void;
}

export const VendorDashboard: React.FC<VendorDashboardProps> = ({
  currentVendor,
  assignedLeads,
  allVendors,
  allLeads,
  onOpenDetail,
  onOpenTaskModal,
  onOpenClosureModal,
  onWhatsAppClick,
  onCallClick,
  onRequestLead,
  onToggleStatus,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'assigned' | 'ranking'>('assigned');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_progress'>('all');

  const maxCap = currentVendor.maxAssignments || 15;
  const currentCount = assignedLeads.filter(
    (l) => l.status === 'pending_contact' || l.status === 'in_progress' || l.status === 'reopened'
  ).length;
  const hasCapacity = currentCount < maxCap;
  const isActive = currentVendor.status === 'active';

  // Filter assigned leads
  const filteredLeads = assignedLeads.filter((lead) => {
    if (statusFilter === 'pending' && (lead.hasContacted || lead.status === 'closed_won')) return false;
    if (statusFilter === 'in_progress' && !lead.hasContacted) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = lead.clientName.toLowerCase().includes(q);
      const matchPhone = lead.phone ? lead.phone.includes(q) : false;
      const matchModel = lead.modelInterest ? lead.modelInterest.toLowerCase().includes(q) : false;
      return matchName || matchPhone || matchModel;
    }
    return true;
  });

  // Calculate elapsed time text
  const getElapsedText = (isoString: string) => {
    if (!isoString) return '-';
    const assignedTime = new Date(isoString).getTime();
    const diffMs = Date.now() - assignedTime;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const timeFormatted = new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (diffMins < 1) return `Recién asignado (${timeFormatted})`;
    if (diffMins < 60) return `Hace ${diffMins} min (${timeFormatted})`;
    const diffHours = Math.floor(diffMins / 60);
    return `Hace ${diffHours}h ${diffMins % 60}m (${timeFormatted})`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner: Vendor Profile & "Módulo Pedir Datos" */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Profile & status */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">{currentVendor.name}</h2>
            <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded uppercase tracking-wide">
              {currentVendor.brand}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Supervisor: <strong>{currentVendor.supervisor || 'General'}</strong>
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span>
              Capacidad actual:{' '}
              <strong className="font-mono tabular-nums text-slate-900">
                {currentCount} / {maxCap} datos
              </strong>
            </span>
            <span>·</span>
            <span>
              Ventas cerradas este mes:{' '}
              <strong className="font-mono tabular-nums text-emerald-700 font-bold">
                {currentVendor.totalConversions || 0}
              </strong>
            </span>
            <span>·</span>
            <button
              onClick={() => onToggleStatus(currentVendor.id, currentVendor.status)}
              className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded cursor-pointer transition-colors ${
                isActive
                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span>{isActive ? 'Activo para Rotación' : 'En Pausa'}</span>
            </button>
          </div>
        </div>

        {/* Right: MÓDULO PARA PEDIR DATOS */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
          <button
            onClick={() => onRequestLead(currentVendor)}
            disabled={!hasCapacity || !isActive}
            className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold rounded-lg shadow-sm transition-all ${
              hasCapacity && isActive
                ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer active:scale-98'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Pedir Nuevo Dato de Cartera</span>
          </button>
        </div>
      </div>

      {!hasCapacity && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            Alcanzaste tu capacidad máxima de <strong>{maxCap} datos simultáneos</strong>. Para recibir o pedir más datos, dale gestión o cierre a tus leads en cartera.
          </span>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-4 border-b border-slate-200 text-xs font-semibold">
        <button
          onClick={() => setActiveSubTab('assigned')}
          className={`pb-3 border-b-2 flex items-center gap-1.5 transition-colors ${
            activeSubTab === 'assigned'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span>Mis Datos Asignados ({currentCount})</span>
        </button>
        <button
          onClick={() => setActiveSubTab('ranking')}
          className={`pb-3 border-b-2 flex items-center gap-1.5 transition-colors ${
            activeSubTab === 'ranking'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Ranking del Mes</span>
        </button>
      </div>

      {activeSubTab === 'ranking' ? (
        <RankingsView vendors={allVendors} leads={allLeads} showSupervisorRanking={false} />
      ) : (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative min-w-[220px] flex-1 max-w-sm">
              <input
                type="text"
                placeholder="Buscar en mis datos por nombre o teléfono..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center p-0.5 bg-slate-100 rounded-lg text-xs">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos ({assignedLeads.length})
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === 'pending'
                    ? 'bg-white text-amber-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sin Gestión (30m)
              </button>
              <button
                onClick={() => setStatusFilter('in_progress')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === 'in_progress'
                    ? 'bg-white text-blue-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Gestionados (5h)
              </button>
            </div>
          </div>

          {/* Assigned Leads Table */}
          {assignedLeads.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center max-w-lg mx-auto">
              <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900 mb-1">Tu Bandeja de Datos está Vacía</h3>
              <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                No tenés datos asignados en este momento. Hacé clic en el botón para solicitar un nuevo dato de la cartera o esperá la próxima rotación automática de tu marca ({currentVendor.brand}).
              </p>
              <button
                onClick={() => onRequestLead(currentVendor)}
                disabled={!isActive}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Pedir Nuevo Dato</span>
              </button>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-500">
              No tenés datos que coincidan con la búsqueda.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                    <tr>
                      <th className="py-3 px-4">Contacto / Interés</th>
                      <th className="py-3 px-4">Cuándo se te Asignó</th>
                      <th className="py-3 px-4">Estado de Gestión</th>
                      <th className="py-3 px-4">Tiempo para no Perderlo</th>
                      <th className="py-3 px-4 text-right">Opciones de Gestión y Cierre</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLeads.map((lead) => {
                      const isWon = lead.status === 'closed_won';
                      const isReopened = lead.status === 'reopened';
                      const hasContacted = lead.hasContacted;

                      return (
                        <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                          {/* Contacto & Modelo */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => onOpenDetail(lead)}
                                className="font-bold text-slate-900 hover:text-blue-600 text-left transition-colors"
                              >
                                {lead.clientName}
                              </button>
                              {isReopened && (
                                <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                                  Reabierto
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-slate-500 mt-0.5 font-mono tabular-nums text-[11px]">
                              <span>{lead.phone}</span>
                              <span>·</span>
                              <span className="font-sans font-medium text-slate-700">
                                {lead.modelInterest || lead.brand}
                              </span>
                            </div>
                          </td>

                          {/* Cuándo se asignó */}
                          <td className="py-3.5 px-4 font-mono tabular-nums text-slate-600">
                            <div>{getElapsedText(lead.assignedAt)}</div>
                            {lead.rotationCount > 0 && (
                              <div className="text-[10px] text-amber-700 font-sans">
                                (Rotado {lead.rotationCount} veces previas)
                              </div>
                            )}
                          </td>

                          {/* Si está o no gestionado */}
                          <td className="py-3.5 px-4">
                            {isWon ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                                <Award className="w-3.5 h-3.5" />
                                Venta Concretada
                              </span>
                            ) : hasContacted ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  Gestionado OK
                                </span>
                                {lead.currentTask && (
                                  <div className="text-[11px] text-slate-600 font-medium truncate max-w-[150px]">
                                    Tarea: {lead.currentTask.description}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-800 font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded animate-pulse">
                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                                Sin Gestión (30m)
                              </span>
                            )}
                          </td>

                          {/* Cuánto tiempo le queda antes de perderlo */}
                          <td className="py-3.5 px-4">
                            {isWon ? (
                              <span className="text-slate-400 font-mono">Dato ganado</span>
                            ) : !hasContacted ? (
                              <div className="space-y-1">
                                <LiveTimer deadline={lead.contactDeadline} type="30m" />
                                <div className="text-[10px] text-slate-400">Si vence, rotará a otro asesor</div>
                              </div>
                            ) : lead.currentTask ? (
                              <div className="space-y-1">
                                <LiveTimer deadline={lead.currentTask.dueAt} type="5h" isCompleted={lead.currentTask.completed} />
                                <div className="text-[10px] text-slate-400">Cumplir tarea en ≤ 5h</div>
                              </div>
                            ) : (
                              <div className="text-amber-700 text-xs font-semibold flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                                <span>Agendá tarea (≤5h) para retener</span>
                              </div>
                            )}
                          </td>

                          {/* Opciones de gestión o cierre */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* WhatsApp Directo */}
                              <button
                                onClick={() => onWhatsAppClick(lead)}
                                title="Enviar WhatsApp y registrar primera gestión"
                                className="px-2.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors flex items-center gap-1"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>WhatsApp</span>
                              </button>

                              {/* Llamada */}
                              <button
                                onClick={() => onCallClick(lead)}
                                title="Registrar llamada realizada"
                                className="p-1.5 text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors"
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </button>

                              {!isWon && (
                                <>
                                  {/* Agendar Próxima Tarea (≤5h) */}
                                  <button
                                    onClick={() => onOpenTaskModal(lead)}
                                    title="Agendar próxima tarea para retener el dato (≤ 5 horas)"
                                    className="px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1"
                                  >
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>Próxima Tarea</span>
                                  </button>

                                  {/* Cerrar Dato */}
                                  <button
                                    onClick={() => onOpenClosureModal(lead)}
                                    title="Cerrar dato (Venta o reapertura automática si es otro motivo)"
                                    className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                  >
                                    Cerrar Dato
                                  </button>
                                </>
                              )}

                              {/* Ficha e historial de comentarios */}
                              <button
                                onClick={() => onOpenDetail(lead)}
                                title="Ver ficha completa y comentarios"
                                className="p-1.5 text-slate-400 hover:text-slate-700 rounded transition-colors"
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
