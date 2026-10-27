import React from 'react';
import { Vendor, Lead } from '../types/crm';
import { Award, Trophy, Medal, Clock, TrendingUp, Users, CheckCircle2 } from 'lucide-react';

interface RankingsViewProps {
  vendors: Vendor[];
  leads: Lead[];
  showSupervisorRanking?: boolean;
}

export const RankingsView: React.FC<RankingsViewProps> = ({
  vendors,
  leads,
  showSupervisorRanking = true,
}) => {
  // Compute rankings for vendors
  const sortedVendors = [...vendors].sort((a, b) => {
    // 1st criteria: Total conversions (sales)
    if (b.totalConversions !== a.totalConversions) {
      return b.totalConversions - a.totalConversions;
    }
    // 2nd criteria: Lowest average response minutes
    const respA = a.avgResponseMinutes || 15;
    const respB = b.avgResponseMinutes || 15;
    return respA - respB;
  });

  // Compute rankings for supervisors
  const supervisorMap = new Map<
    string,
    {
      supervisorName: string;
      vendorCount: number;
      totalConversions: number;
      totalAssigned: number;
      activeLeads: number;
    }
  >();

  vendors.forEach((v) => {
    const sName = v.supervisor.trim() || 'General';
    const current = supervisorMap.get(sName) || {
      supervisorName: sName,
      vendorCount: 0,
      totalConversions: 0,
      totalAssigned: 0,
      activeLeads: 0,
    };

    current.vendorCount += 1;
    current.totalConversions += v.totalConversions || 0;
    current.totalAssigned += v.totalAssignedCount || 0;
    current.activeLeads += v.activeAssignments || 0;

    supervisorMap.set(sName, current);
  });

  const sortedSupervisors = Array.from(supervisorMap.values()).sort(
    (a, b) => b.totalConversions - a.totalConversions
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <span>Ranking Oficial de Rendimiento Comercial</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Métricas acumuladas del mes: ventas confirmadas, velocidad de respuesta en primera gestión y efectividad de cartera
          </p>
        </div>

        {sortedVendors.length > 0 && (
          <div className="flex items-center gap-3 bg-amber-50/70 border border-amber-200 rounded-lg px-4 py-2 shrink-0">
            <Award className="w-5 h-5 text-amber-600" />
            <div>
              <div className="text-[11px] text-amber-800 font-medium">Líder del Mes</div>
              <div className="text-xs font-bold text-amber-950">
                {sortedVendors[0].name} ({sortedVendors[0].totalConversions || 0} ventas)
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Vendedores Ranking Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Medal className="w-4 h-4 text-blue-600" />
            <span>Mejores Vendedores del Mes</span>
          </div>
          <span className="text-xs text-slate-500">{sortedVendors.length} asesores clasificados</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
              <tr>
                <th className="py-3 px-4 text-center w-16">Puesto</th>
                <th className="py-3 px-4">Asesor de Ventas</th>
                <th className="py-3 px-4">Marca</th>
                <th className="py-3 px-4">Supervisor / Equipo</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-center">Datos Activos</th>
                <th className="py-3 px-4 text-center">Ventas Cerradas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedVendors.map((vendor, index) => {
                const isTop1 = index === 0;
                const isTop2 = index === 1;
                const isTop3 = index === 2;

                return (
                  <tr
                    key={vendor.id}
                    className={`transition-colors hover:bg-slate-50 ${
                      isTop1
                        ? 'bg-amber-50/30'
                        : isTop2
                        ? 'bg-slate-50/50'
                        : isTop3
                        ? 'bg-orange-50/20'
                        : ''
                    }`}
                  >
                    {/* Rank Position */}
                    <td className="py-3 px-4 text-center">
                      {isTop1 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-400 text-amber-950 font-bold text-xs shadow-xs">
                          1
                        </span>
                      ) : isTop2 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-300 text-slate-800 font-bold text-xs">
                          2
                        </span>
                      ) : isTop3 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700/30 text-amber-900 font-bold text-xs">
                          3
                        </span>
                      ) : (
                        <span className="font-mono tabular-nums text-slate-500 font-semibold">
                          #{index + 1}
                        </span>
                      )}
                    </td>

                    {/* Vendor Name */}
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <div>{vendor.name}</div>
                      {vendor.phone && <div className="text-[11px] text-slate-400 font-normal">{vendor.phone}</div>}
                    </td>

                    {/* Brand */}
                    <td className="py-3 px-4">
                      <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[11px] uppercase">
                        {vendor.brand}
                      </span>
                    </td>

                    {/* Supervisor */}
                    <td className="py-3 px-4 text-slate-600 font-medium">
                      {vendor.supervisor || 'General'}
                    </td>

                    {/* Activity Status */}
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${
                          vendor.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700'
                            : vendor.status === 'paused'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {vendor.status === 'active' ? 'Activo' : vendor.status === 'paused' ? 'En Pausa' : 'Inactivo'}
                      </span>
                    </td>

                    {/* Active Leads */}
                    <td className="py-3 px-4 text-center font-mono tabular-nums text-slate-700 font-medium">
                      {vendor.activeAssignments} / {vendor.maxAssignments || 15}
                    </td>

                    {/* Won Sales */}
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 font-mono tabular-nums font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded text-xs">
                        <Award className="w-3.5 h-3.5 text-emerald-600" />
                        {vendor.totalConversions || 0}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supervisors Ranking Table */}
      {showSupervisorRanking && sortedSupervisors.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-600" />
              <span>Ranking de Equipos de Venta y Supervisores</span>
            </div>
            <span className="text-xs text-slate-500">{sortedSupervisors.length} equipos clasificados</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                <tr>
                  <th className="py-3 px-4 text-center w-16">Puesto</th>
                  <th className="py-3 px-4">Supervisor / Estructura</th>
                  <th className="py-3 px-4 text-center">Asesores a Cargo</th>
                  <th className="py-3 px-4 text-center">Leads Activos en Equipo</th>
                  <th className="py-3 px-4 text-center">Ventas Totales del Equipo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedSupervisors.map((sup, index) => (
                  <tr key={sup.supervisorName} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 text-center font-mono tabular-nums font-bold text-slate-600">
                      #{index + 1}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {sup.supervisorName}
                    </td>
                    <td className="py-3 px-4 text-center font-mono tabular-nums text-slate-700">
                      {sup.vendorCount} vendedores
                    </td>
                    <td className="py-3 px-4 text-center font-mono tabular-nums text-slate-700">
                      {sup.activeLeads}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 font-mono tabular-nums font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded text-xs">
                        <Award className="w-3.5 h-3.5 text-purple-600" />
                        {sup.totalConversions} ventas
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
