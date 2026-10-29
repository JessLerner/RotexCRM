import React, { useState } from 'react';
import { Lead, Vendor, VendorStatus } from '../types/crm';
import { LiveTimer } from './LiveTimers';
import { RankingsView } from './RankingsView';
import { OperationalMetrics } from '../services/leadRepository';
import { PresenceRecord } from '../services/presenceRepository';
import { PresencePanel } from './PresencePanel';
import { OperationsOverview } from './OperationsOverview';
import {
  Users,
  Clock,
  AlertTriangle,
  Upload,
  UserPlus,
  Trophy,
  CheckCircle2,
  PauseCircle,
  XCircle,
  Eye,
  MessageSquare,
  Phone,
  Flame,
  Award,
  Filter,
} from 'lucide-react';

interface SupervisorDashboardProps {
  supervisorName: string;
  activeTab: 'monitoring' | 'team' | 'rankings';
  onTabChange: (tab: 'monitoring' | 'team' | 'rankings') => void;
  vendors: Vendor[];
  allLeads: Lead[];
  metrics: OperationalMetrics;
  presence: PresenceRecord[];
  onOpenDetail: (lead: Lead) => void;
  onOpenImportModal: () => void;
  onToggleVendorStatus: (vendorId: string, currentStatus: VendorStatus) => void;
  onUpdateVendorCapacity: (vendorId: string, newMax: number) => void;
  onAddNewVendorToTeam: (newVendor: { name: string; email: string; maxAssignments: number }) => Promise<void>;
  onWhatsAppClick: (lead: Lead) => void;
  onCallClick: (lead: Lead) => void;
}

export const SupervisorDashboard: React.FC<SupervisorDashboardProps> = ({
  supervisorName,
  activeTab,
  onTabChange,
  vendors,
  allLeads,
  metrics,
  presence,
  onOpenDetail,
  onOpenImportModal,
  onToggleVendorStatus,
  onUpdateVendorCapacity,
  onAddNewVendorToTeam,
  onWhatsAppClick,
  onCallClick,
}) => {
  const [isAddVendorOpen, setIsAddVendorOpen] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorEmail, setNewVendorEmail] = useState('');
  const [newVendorCapacity, setNewVendorCapacity] = useState(15);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Filter sellers of this supervisor
  const myVendors = vendors.filter(
    (v) => v.supervisor.trim().toLowerCase() === supervisorName.trim().toLowerCase()
  );
  const myVendorIds = new Set(myVendors.map((v) => v.id));

  // Leads assigned to this supervisor's team
  const myTeamLeads = allLeads.filter(
    (l) => l.currentVendorId && myVendorIds.has(l.currentVendorId) && l.status !== 'closed_won'
  );

  // Compute remaining time in milliseconds for sorting "de menos a más que les quedan para perderlos"
  const getRemainingMs = (lead: Lead): number => {
    const now = Date.now();
    if (!lead.hasContacted) {
      return new Date(lead.contactDeadline).getTime() - now;
    }
    if (lead.activeTaskDeadline) {
      return new Date(lead.activeTaskDeadline).getTime() - now;
    }
    if (lead.firstGestionAt) {
      return new Date(lead.firstGestionAt).getTime() + 5 * 60 * 60 * 1000 - now;
    }
    return 10 * 24 * 60 * 60 * 1000;
  };

  // SORTED: De menos a más tiempo restante antes de rotar (Mayor urgencia primero)
  const sortedTeamLeads = [...myTeamLeads].sort((a, b) => getRemainingMs(a) - getRemainingMs(b));

  const urgentCount = sortedTeamLeads.filter((l) => getRemainingMs(l) < 5 * 60 * 1000).length;
  const activeSellersCount = myVendors.filter((v) => v.status === 'active').length;
  const teamSalesCount = myVendors.reduce((acc, v) => acc + (v.totalConversions || 0), 0);
  const connectedTeamCount = presence.filter((person) => person.connected && myVendorIds.has(person.profile_id)).length;
  const teamPresence = presence.filter((person) => myVendorIds.has(person.profile_id));

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVendorName.trim() || !newVendorEmail.trim()) return;

    try {
      setInviteError(null);
      await onAddNewVendorToTeam({
        name: newVendorName.trim(),
        email: newVendorEmail.trim(),
        maxAssignments: newVendorCapacity || 15,
      });
      setNewVendorName('');
      setNewVendorEmail('');
      setIsAddVendorOpen(false);
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'No se pudo enviar la invitación.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner: Supervisor Profile & Actions */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">Equipo {supervisorName}</h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 uppercase tracking-wide">
              Panel de Supervisión
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
            <span>{myVendors.length} asesores a cargo</span>
            <span>·</span>
            <span className="text-emerald-700 font-semibold">{activeSellersCount} activos</span>
            <span>·</span>
            <span className="font-mono tabular-nums text-slate-700 font-medium">
              {metrics.assigned} leads en gestión
            </span>
            <span>·</span>
            <span className="font-mono tabular-nums text-blue-700 font-medium">{metrics.queued} disponibles para asignar</span>
            <span>·</span>
            <span className="text-emerald-700 font-bold">{teamSalesCount} ventas del equipo</span>
            <span>·</span>
            <span className="text-cyan-700 font-semibold">{connectedTeamCount} conectados ahora</span>
          </div>
        </div>

        {/* Action Buttons for Supervisor */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setIsAddVendorOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Agregar Asesor a Mi Nómina</span>
          </button>
          <button
            onClick={onOpenImportModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Subir Datos Fox CRM para Mi Equipo</span>
          </button>
        </div>
      </div>

      {urgentCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-center gap-3 text-xs text-red-900 animate-pulse">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <div>
            <span className="font-bold">¡Atención Supervisor!</span> Hay{' '}
            <strong>{urgentCount} dato(s) con menos de 5 minutos</strong> para perderse por vencimiento de SLA de primer contacto o tarea.
          </div>
        </div>
      )}

      {activeTab === 'team' && <PresencePanel
        people={teamPresence}
        title="Conexión de mi equipo"
        emptyMessage="Tus asesores todavía no registraron actividad en la plataforma."
      />}

      {activeTab === 'monitoring' && <OperationsOverview metrics={metrics} title="Operación de mi equipo" />}

      {/* Tabs */}
      <div className="hidden flex items-center gap-4 border-b border-slate-200 text-xs font-semibold">
        <button
          onClick={() => onTabChange('monitoring')}
          className={`pb-3 border-b-2 flex items-center gap-1.5 transition-colors ${
            activeTab === 'monitoring'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Monitoreo de Datos (Urgencia de Menos a Más)</span>
          <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-mono tabular-nums">
            {myTeamLeads.length}
          </span>
        </button>
        <button
          onClick={() => onTabChange('team')}
          className={`pb-3 border-b-2 flex items-center gap-1.5 transition-colors ${
            activeTab === 'team'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Mis Vendedores ({myVendors.length})</span>
        </button>
        <button
          onClick={() => onTabChange('rankings')}
          className={`pb-3 border-b-2 flex items-center gap-1.5 transition-colors ${
            activeTab === 'rankings'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>Rankings de Vendedores y Supervisores</span>
        </button>
      </div>

      {/* Tab 1: Monitoreo de Datos del Equipo ordenados de Menos a Más tiempo restante */}
      {activeTab === 'monitoring' && (
        <div className="space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-medium">
              <Filter className="w-3.5 h-3.5 text-blue-600" />
              <span>Listado de datos asignados a tu equipo, <strong>ordenados de menor a mayor tiempo restante</strong> antes de rotar.</span>
            </span>
            <span className="text-slate-400 font-mono text-[11px]">Orden automático en tiempo real</span>
          </div>

          {sortedTeamLeads.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-xs text-slate-500">
              No hay datos activos asignados a tu equipo en este momento.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                    <tr>
                      <th className="py-3 px-4">Prioridad / Tiempo para Perderlo</th>
                      <th className="py-3 px-4">Contacto</th>
                      <th className="py-3 px-4">Marca y Modelo</th>
                      <th className="py-3 px-4">Asesor Asignado</th>
                      <th className="py-3 px-4">Estado de Gestión</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedTeamLeads.map((lead) => {
                      const remainingMs = getRemainingMs(lead);
                      const isCritical = remainingMs < 5 * 60 * 1000 && remainingMs > 0;
                      const isExpired = remainingMs <= 0;

                      return (
                        <tr
                          key={lead.id}
                          className={`transition-colors hover:bg-slate-50 ${
                            isExpired
                              ? 'bg-red-50/40'
                              : isCritical
                              ? 'bg-amber-50/40'
                              : ''
                          }`}
                        >
                          {/* Tiempo para perderlo (de menos a más) */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              {isExpired ? (
                                <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">
                                  Vencido (Rotando)
                                </span>
                              ) : isCritical ? (
                                <div className="space-y-0.5">
                                  <LiveTimer deadline={lead.hasContacted ? (lead.activeTaskDeadline || '') : lead.contactDeadline} type={lead.hasContacted ? '5h' : '30m'} />
                                  <span className="text-[10px] text-red-600 font-bold flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 text-red-600" />
                                    ¡Alerta de rotación inminente!
                                  </span>
                                </div>
                              ) : (
                                <LiveTimer
                                  deadline={lead.hasContacted ? (lead.activeTaskDeadline || '') : lead.contactDeadline}
                                  type={lead.hasContacted ? '5h' : '30m'}
                                />
                              )}
                            </div>
                          </td>

                          {/* Contacto */}
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            <button
                              onClick={() => onOpenDetail(lead)}
                              className="hover:text-blue-600 text-left"
                            >
                              {lead.clientName}
                            </button>
                            <div className="font-mono tabular-nums text-[11px] text-slate-400 font-normal">
                              {lead.phone}
                            </div>
                          </td>

                          {/* Marca & Modelo */}
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[11px] uppercase">
                              {lead.brand}
                            </span>
                            <div className="text-[11px] text-slate-600 truncate max-w-[140px]">
                              {lead.modelInterest || 'General'}
                            </div>
                          </td>

                          {/* Asesor */}
                          <td className="py-3.5 px-4 font-semibold text-slate-800">
                            {lead.currentVendorName}
                          </td>

                          {/* Estado de gestión */}
                          <td className="py-3.5 px-4">
                            {lead.hasContacted ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded">
                                <CheckCircle2 className="w-3 h-3" />
                                Gestionado OK
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded animate-pulse">
                                <Clock className="w-3 h-3" />
                                Sin Primer Contacto
                              </span>
                            )}
                          </td>

                          {/* Acciones */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => onWhatsAppClick(lead)}
                                title="Enviar WhatsApp al cliente"
                                className="p-1.5 text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onOpenDetail(lead)}
                                title="Ver ficha e historial de auditoría"
                                className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Ver Ficha</span>
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

      {/* Tab 2: Mis Vendedores (Marcar activos/inactivos y agregar) */}
      {activeTab === 'team' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Nómina del Equipo · {supervisorName}</h3>
              <p className="text-xs text-slate-500">
                Podés marcar si están activos o en pausa para recibir datos de la rotación y definir sus capacidades
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                <tr>
                  <th className="py-3 px-4">Asesor</th>
                  <th className="py-3 px-4">Marca Asignada</th>
                  <th className="py-3 px-4">Estado de Actividad</th>
                  <th className="py-3 px-4 text-center">Volumen Actual</th>
                  <th className="py-3 px-4 text-center">Capacidad Máx</th>
                  <th className="py-3 px-4 text-center">Ventas Cerradas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {myVendors.map((vendor) => (
                  <tr key={vendor.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div>{vendor.name}</div>
                      {vendor.phone && <div className="text-[11px] text-slate-400 font-normal">{vendor.phone}</div>}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[11px] uppercase">
                        {vendor.brand}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => onToggleVendorStatus(vendor.id, vendor.status)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                          vendor.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : vendor.status === 'paused'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                            : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {vendor.status === 'active' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                        {vendor.status === 'paused' && <PauseCircle className="w-3.5 h-3.5 text-amber-600" />}
                        {vendor.status === 'inactive' && <XCircle className="w-3.5 h-3.5 text-slate-400" />}
                        <span>
                          {vendor.status === 'active' ? 'Activo' : vendor.status === 'paused' ? 'En Pausa' : 'Inactivo'}
                        </span>
                      </button>
                    </td>

                    <td className="py-3.5 px-4 text-center font-mono tabular-nums font-semibold text-slate-800">
                      {vendor.activeAssignments} / {vendor.maxAssignments || 15} datos
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={vendor.maxAssignments || 15}
                        onChange={(e) => onUpdateVendorCapacity(vendor.id, parseInt(e.target.value, 10) || 15)}
                        className="w-16 text-center text-xs font-mono tabular-nums border border-slate-200 rounded px-1.5 py-1"
                      />
                    </td>

                    <td className="py-3.5 px-4 text-center font-mono tabular-nums font-bold text-emerald-700">
                      {vendor.totalConversions || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Rankings tanto de vendedores como de supervisores */}
      {activeTab === 'rankings' && (
        <RankingsView vendors={vendors} leads={allLeads} showSupervisorRanking={true} />
      )}

      {/* Modal: Agregar Asesor a Mi Nómina */}
      {isAddVendorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Agregar Asesor al Equipo de {supervisorName}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              El nuevo asesor quedará asignado bajo tu supervisión para recibir datos en rotación.
            </p>

            <form onSubmit={handleCreateVendor} className="space-y-3 text-xs">
              {inviteError && <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-700">{inviteError}</p>}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nombre Completo del Asesor *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Lucas Rossi"
                  value={newVendorName}
                  onChange={(e) => setNewVendorName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Correo electrónico *</label>
                <input
                  type="email"
                  required
                  placeholder="asesor@empresa.com"
                  value={newVendorEmail}
                  onChange={(e) => setNewVendorEmail(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <p className="mt-1 text-[11px] text-slate-500">Recibirá una invitación para crear su contraseña. La marca se hereda del equipo.</p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Capacidad Máxima de Datos</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={newVendorCapacity}
                  onChange={(e) => setNewVendorCapacity(parseInt(e.target.value, 10) || 15)}
                  className="w-full border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddVendorOpen(false)}
                  className="px-3.5 py-2 text-slate-600 hover:text-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
                >
                  Dar de Alta Asesor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
