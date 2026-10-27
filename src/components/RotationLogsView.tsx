import React, { useState } from 'react';
import { RotationLog } from '../types/crm';
import { History, RotateCw, Clock, AlertTriangle, ArrowRight, Search, FileText } from 'lucide-react';

interface RotationLogsViewProps {
  logs: RotationLog[];
  onSelectLead?: (leadId: string) => void;
}

export const RotationLogsView: React.FC<RotationLogsViewProps> = ({ logs, onSelectLead }) => {
  const [filterReason, setFilterReason] = useState<string>('all');
  const [search, setSearch] = useState('');

  const filteredLogs = logs.filter((log) => {
    if (filterReason !== 'all' && log.reason !== filterReason) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = log.leadName.toLowerCase().includes(q);
      const matchBrand = log.brand.toLowerCase().includes(q);
      const matchFrom = log.fromVendorName ? log.fromVendorName.toLowerCase().includes(q) : false;
      const matchTo = log.toVendorName.toLowerCase().includes(q);
      const matchNotes = log.notes.toLowerCase().includes(q);
      return matchName || matchBrand || matchFrom || matchTo || matchNotes;
    }
    return true;
  });

  const getReasonBadge = (reason: RotationLog['reason']) => {
    switch (reason) {
      case 'timeout_30m':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
            <Clock className="w-3 h-3 text-red-600" />
            Vencimiento 30 Minutos
          </span>
        );
      case 'timeout_5h_task':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            Vencimiento Tarea 5 Horas
          </span>
        );
      case 'reopened_after_closure':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
            <RotateCw className="w-3 h-3 text-purple-600" />
            Reapertura No-Venta
          </span>
        );
      case 'initial_assignment':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
            Ingreso Fox CRM
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
            Rotación Manual
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      {/* Header and filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" />
            <span>Auditoría de Rotaciones en Tiempo Real</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Registro cronológico inmutable de cada rotación, vencimiento de SLA de 30m, 5h o reapertura
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative min-w-[200px]">
            <input
              type="text"
              placeholder="Buscar lead, vendedor o marca..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Reason filter */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
            <span className="text-slate-500">Causa:</span>
            <select
              value={filterReason}
              onChange={(e) => setFilterReason(e.target.value)}
              className="bg-transparent text-slate-800 font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">Todas las causas</option>
              <option value="timeout_30m">Vencimiento 30 min</option>
              <option value="timeout_5h_task">Vencimiento Tarea 5h</option>
              <option value="reopened_after_closure">Reapertura No-Venta</option>
              <option value="initial_assignment">Ingreso Fox CRM</option>
            </select>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      {filteredLogs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <History className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700 mb-1">Sin Registros de Rotación Aún</h3>
          <p className="text-xs text-slate-500">
            A medida que los leads se asignen, venzan los plazos de 30m o se reabran tras un cierre no-venta, quedarán auditados aquí.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                <tr>
                  <th className="py-3 px-4">Fecha y Hora</th>
                  <th className="py-3 px-4">Lead / Contacto</th>
                  <th className="py-3 px-4">Marca</th>
                  <th className="py-3 px-4">Traspaso Asesor</th>
                  <th className="py-3 px-4">Causa del Traspaso</th>
                  <th className="py-3 px-4">Observaciones / Anexo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    {/* Timestamp */}
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>

                    {/* Lead */}
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {onSelectLead ? (
                        <button
                          onClick={() => onSelectLead(log.leadId)}
                          className="text-blue-600 hover:underline text-left"
                        >
                          {log.leadName}
                        </button>
                      ) : (
                        log.leadName
                      )}
                    </td>

                    {/* Brand */}
                    <td className="py-3 px-4">
                      <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[11px] uppercase">
                        {log.brand}
                      </span>
                    </td>

                    {/* From -> To */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 font-medium">
                        <span className="text-slate-500">{log.fromVendorName || 'Origen / Fox CRM'}</span>
                        <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="text-emerald-700 font-semibold">{log.toVendorName}</span>
                      </div>
                    </td>

                    {/* Reason */}
                    <td className="py-3 px-4">{getReasonBadge(log.reason)}</td>

                    {/* Notes */}
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={log.notes}>
                      {log.notes || '-'}
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
