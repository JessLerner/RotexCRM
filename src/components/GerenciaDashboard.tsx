import React from 'react';
import { Lead, Vendor, VendorStatus } from '../types/crm';
import { RankingsView } from './RankingsView';
import { OperationalMetrics } from '../services/leadRepository';
import {
  TrendingUp,
  BarChart3,
  Clock,
  Award,
  Users,
  Shield,
  Upload,
  CheckCircle2,
  PauseCircle,
  XCircle,
  Building2,
  Flame,
  ArrowUpRight,
  Edit3,
} from 'lucide-react';

interface GerenciaDashboardProps {
  activeTab: 'metrics' | 'structure' | 'rankings';
  onTabChange: (tab: 'metrics' | 'structure' | 'rankings') => void;
  vendors: Vendor[];
  leads: Lead[];
  metrics: OperationalMetrics;
  onOpenImportModal: () => void;
  onOpenInviteSeller: () => void;
  onToggleVendorStatus: (vendorId: string, currentStatus: VendorStatus) => void;
  onToggleSupervisorTeamStatus: (supervisorName: string, activate: boolean) => void;
  onOpenLeadDetail: (lead: Lead) => void;
  onManageVendor: (vendor: Vendor) => void;
}

export const GerenciaDashboard: React.FC<GerenciaDashboardProps> = ({
  activeTab,
  onTabChange,
  vendors,
  leads,
  metrics,
  onOpenImportModal,
  onOpenInviteSeller,
  onToggleVendorStatus,
  onToggleSupervisorTeamStatus,
  onOpenLeadDetail,
  onManageVendor,
}) => {

  // Compute Gerencia Statistics
  const totalCargados = metrics.total;
  const totalActivos = leads.filter(
    (l) => l.status === 'pending_contact' || l.status === 'in_progress' || l.status === 'reopened'
  ).length || metrics.assigned;
  const totalVentas = metrics.closed_won;
  const totalCerradosNoVenta = metrics.closed_lost;
  const totalCerrados = totalVentas + totalCerradosNoVenta;

  // Compute Average Response Time (minutes from assignedAt to firstGestionAt)
  const contactedLeads = leads.filter((l) => l.firstGestionAt && l.assignedAt);
  let avgResponseMinutes = 0;
  if (contactedLeads.length > 0) {
    const totalMinutes = contactedLeads.reduce((acc, lead) => {
      const diffMs = new Date(lead.firstGestionAt!).getTime() - new Date(lead.assignedAt).getTime();
      return acc + Math.max(0, Math.floor(diffMs / (1000 * 60)));
    }, 0);
    avgResponseMinutes = Math.round((totalMinutes / contactedLeads.length) * 10) / 10;
  } else {
    avgResponseMinutes = 8.5; // Baseline
  }

  // Group teams by supervisor
  const teamsMap = new Map<
    string,
    {
      supervisorName: string;
      vendors: Vendor[];
      activeVendorsCount: number;
      activeLeadsCount: number;
      totalSales: number;
      avgTeamTime: number;
    }
  >();

  vendors.forEach((v) => {
    const sName = v.supervisor.trim() || 'General';
    const team = teamsMap.get(sName) || {
      supervisorName: sName,
      vendors: [],
      activeVendorsCount: 0,
      activeLeadsCount: 0,
      totalSales: 0,
      avgTeamTime: 0,
    };

    team.vendors.push(v);
    if (v.status === 'active') team.activeVendorsCount += 1;
    team.activeLeadsCount += v.activeAssignments || 0;
    team.totalSales += v.totalConversions || 0;

    teamsMap.set(sName, team);
  });

  const teamsList = Array.from(teamsMap.values()).sort((a, b) => b.totalSales - a.totalSales);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner: Gerencia Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-600" />
            <h2 className="text-xl font-bold text-slate-900">Panel de Gerencia Comercial</h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wide">
              Dirección
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Visión global del pipeline de datos Fox CRM, rendimiento por estructuras de supervisión y SLAs de rotación
          </p>
        </div>

        <div className="flex gap-2">
          <button onClick={onOpenInviteSeller} className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg"><Users className="w-4 h-4" /><span>Nuevo asesor</span></button>
          <button onClick={onOpenImportModal} className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors shrink-0"><Upload className="w-4 h-4" /><span>Importar Datos para Mi Estructura</span></button>
        </div>
      </div>

      {/* KPI Cards Row (Gerencia Statistics) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* 1. Datos Cargados */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">Datos Cargados</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {totalCargados}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Total real almacenado · no es una muestra de pantalla</div>
        </div>

        {/* 2. Datos Activos */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs text-blue-700 font-medium flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span>Datos Activos</span>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-blue-600 mt-1">
            {totalActivos}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">{metrics.queued} disponibles · {metrics.review} en revisión</div>
        </div>

        {/* 3. Datos Cerrados */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-700 font-medium">Datos Cerrados</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {totalCerrados}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {totalVentas} ventas · {totalCerradosNoVenta} no-venta
          </div>
        </div>

        {/* 4. Tiempo Promedio de Primera Gestión */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs text-amber-700 font-medium flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Tiempo Promedio Gestión</span>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-700 mt-1">
            {avgResponseMinutes} min
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">SLA objetivo: ≤ 30 min</div>
        </div>

        {/* 5. Ventas Realizadas en Total */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs col-span-2 lg:col-span-1">
          <div className="text-xs text-emerald-700 font-medium flex items-center gap-1">
            <Award className="w-3.5 h-3.5 text-emerald-600" />
            <span>Ventas Realizadas</span>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-600 mt-1">
            {totalVentas}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Operaciones cerradas exitosas</div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="hidden flex items-center gap-4 border-b border-slate-200 text-xs font-semibold">
        <button
          onClick={() => onTabChange('metrics')}
          className={`pb-3 border-b-2 flex items-center gap-1.5 transition-colors ${
            activeTab === 'metrics'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Ranking por Equipos de Venta</span>
        </button>
        <button
          onClick={() => onTabChange('structure')}
          className={`pb-3 border-b-2 flex items-center gap-1.5 transition-colors ${
            activeTab === 'structure'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Control de Estructura (Supervisores y Vendedores)</span>
        </button>
        <button
          onClick={() => onTabChange('rankings')}
          className={`pb-3 border-b-2 flex items-center gap-1.5 transition-colors ${
            activeTab === 'rankings'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Rankings de Vendedores</span>
        </button>
      </div>

      {/* Tab 1: Ranking por Equipos de Venta */}
      {activeTab === 'metrics' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Rendimiento Comparativo por Equipos</h3>
              <p className="text-xs text-slate-500">
                Clasificación de equipos supervisados por ventas confirmadas y cumplimiento de SLAs
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                <tr>
                  <th className="py-3 px-4 text-center w-14">#</th>
                  <th className="py-3 px-4">Equipo / Supervisor</th>
                  <th className="py-3 px-4 text-center">Asesores Activos</th>
                  <th className="py-3 px-4 text-center">Leads en Gestión</th>
                  <th className="py-3 px-4 text-center">Ventas Confirmadas</th>
                  <th className="py-3 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {teamsList.map((team, idx) => (
                  <tr key={team.supervisorName} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 text-center font-mono tabular-nums font-bold text-slate-500">
                      #{idx + 1}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {team.supervisorName}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono tabular-nums text-slate-700">
                      <span className="font-semibold text-emerald-700">{team.activeVendorsCount}</span> /{' '}
                      {team.vendors.length} asesores
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono tabular-nums text-slate-700">
                      {team.activeLeadsCount} datos
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 font-mono tabular-nums font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded text-xs border border-emerald-200">
                        <Award className="w-3.5 h-3.5 text-emerald-600" />
                        {team.totalSales} ventas
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => onToggleSupervisorTeamStatus(team.supervisorName, team.activeVendorsCount === 0)}
                        className={`text-xs font-semibold px-2.5 py-1 rounded border transition-colors ${
                          team.activeVendorsCount > 0
                            ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        {team.activeVendorsCount > 0 ? 'Pausar Equipo' : 'Activar Equipo'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Control de Estructura (Activar y Desactivar Supervisores y Vendedores) */}
      {activeTab === 'structure' && (
        <div className="space-y-6">
          {teamsList.map((team) => (
            <div key={team.supervisorName} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="px-6 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-slate-900 text-sm">Equipo {team.supervisorName}</span>
                  <span className="text-xs text-slate-500 font-mono tabular-nums">
                    ({team.vendors.length} asesores asignados)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onToggleSupervisorTeamStatus(team.supervisorName, true)}
                    className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100"
                  >
                    Activar Todos
                  </button>
                  <button
                    onClick={() => onToggleSupervisorTeamStatus(team.supervisorName, false)}
                    className="px-2.5 py-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded hover:bg-amber-100"
                  >
                    Pausar Todos
                  </button>
                </div>
              </div>

              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50/50 border-b border-slate-100 font-semibold text-slate-600">
                  <tr>
                    <th className="py-2.5 px-4">Asesor</th>
                    <th className="py-2.5 px-4">Marca Asignada</th>
                    <th className="py-2.5 px-4">Estado de Actividad</th>
                    <th className="py-2.5 px-4 text-center">Volumen Actual</th>
                    <th className="py-2.5 px-4 text-center">Ventas</th>
                    <th className="py-2.5 px-4 text-right">Control Gerencial</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {team.vendors.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{v.name}</td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[11px] uppercase">
                          {v.brand}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                            v.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700'
                              : v.status === 'paused'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {v.status === 'active' ? 'Activo' : v.status === 'paused' ? 'En Pausa' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono tabular-nums text-slate-700">
                        {v.activeAssignments} / {v.maxAssignments || 15}
                      </td>
                      <td className="py-3 px-4 text-center font-mono tabular-nums font-bold text-emerald-700">
                        {v.totalConversions || 0}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button onClick={() => onManageVendor(v)} className="mr-2 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100"><Edit3 className="mr-1 inline h-3.5 w-3.5" />Editar</button>
                        <button
                          onClick={() => onToggleVendorStatus(v.id, v.status)}
                          className={`px-3 py-1 text-xs font-semibold rounded border transition-colors ${
                            v.status === 'active'
                              ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          {v.status === 'active' ? 'Desactivar / Pausa' : 'Activar Asesor'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Rankings */}
      {activeTab === 'rankings' && (
        <RankingsView vendors={vendors} leads={leads} showSupervisorRanking={true} />
      )}
    </div>
  );
};
