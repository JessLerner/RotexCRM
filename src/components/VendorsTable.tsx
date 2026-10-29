import React from 'react';
import { Vendor, VendorStatus } from '../types/crm';
import { CheckCircle2, PauseCircle, XCircle, Shield, Award, Edit3, Trash2 } from 'lucide-react';

interface VendorsTableProps {
  vendors: Vendor[];
  onToggleStatus: (vendorId: string, currentStatus: VendorStatus) => void;
  onSetAvailability?: (vendorId: string, status: 'active' | 'paused') => void;
  onUpdateMaxCapacity: (vendorId: string, newMax: number) => void;
  onManageVendor?: (vendor: Vendor) => void;
  onDeleteVendor?: (vendorId: string) => void;
  onOpenSyncModal: () => void;
}

export const VendorsTable: React.FC<VendorsTableProps> = ({
  vendors,
  onToggleStatus,
  onSetAvailability,
  onUpdateMaxCapacity,
  onManageVendor,
  onDeleteVendor,
  onOpenSyncModal,
}) => {
  if (vendors.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center max-w-2xl mx-auto my-8">
        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Shield className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">Sin Asesores Registrados en Parte Diario</h3>
        <p className="text-sm text-slate-500 mb-6">
          Conectá tu Google Sheet oficial del Parte Diario (con columnas Vendedor, Supervisor y Marca) para cargar la base activa del equipo.
        </p>
        <button
          onClick={onOpenSyncModal}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          Conectar Google Sheet Parte Diario
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
              <th className="py-3 px-4">Vendedor</th>
              <th className="py-3 px-4">Supervisor</th>
              <th className="py-3 px-4">Marca Asignada</th>
              <th className="py-3 px-4">Estado de Actividad</th>
              <th className="py-3 px-4 text-center">Volumen Actual</th>
              <th className="py-3 px-4 text-center">Capacidad Máx</th>
              <th className="py-3 px-4 text-center">Ventas Cerradas</th>
              <th className="py-3 px-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {vendors.map((vendor) => {
              const capacityPercent = Math.min(
                100,
                Math.round((vendor.activeAssignments / (vendor.maxAssignments || 15)) * 100)
              );
              const isAtCapacity = vendor.activeAssignments >= (vendor.maxAssignments || 15);

              return (
                <tr key={vendor.id} className="hover:bg-slate-50/70 transition-colors">
                  {/* Vendedor */}
                  <td className="py-3.5 px-4 font-semibold text-slate-900">
                    <div>{vendor.name}</div>
                    {vendor.phone && <div className="text-xs text-slate-400 font-normal">{vendor.phone}</div>}
                  </td>

                  {/* Supervisor */}
                  <td className="py-3.5 px-4 text-slate-600">
                    <span className="text-xs font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                      {vendor.supervisor || 'General'}
                    </span>
                  </td>

                  {/* Marca Asignada */}
                  <td className="py-3.5 px-4">
                    <span className="font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded text-xs uppercase tracking-wide">
                      {vendor.brand}
                    </span>
                  </td>

                  {/* Estado de Actividad */}
                  <td className="py-3.5 px-4">
                    {onSetAvailability ? <select value={vendor.status === 'active' ? 'active' : 'paused'} onChange={(e) => onSetAvailability(vendor.id, e.target.value as 'active' | 'paused')} className={`rounded border px-2 py-1 text-xs font-semibold ${vendor.status === 'active' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}><option value="active">Activo</option><option value="paused">Inactivo / Franco</option></select> : <button onClick={() => onToggleStatus(vendor.id, vendor.status)} className="rounded border px-2 py-1 text-xs">{vendor.status === 'active' ? 'Activo' : 'Inactivo / Franco'}</button>}
                  </td>

                  {/* Volumen Actual */}
                  <td className="py-3.5 px-4 text-center">
                    <div className="flex flex-col items-center gap-1 min-w-[100px]">
                      <span className="font-mono tabular-nums text-xs font-semibold text-slate-800">
                        {vendor.activeAssignments} / {vendor.maxAssignments || 15} datos
                      </span>
                      <div className="w-20 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            isAtCapacity
                              ? 'bg-red-500'
                              : capacityPercent > 70
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${capacityPercent}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Capacidad Máxima */}
                  <td className="py-3.5 px-4 text-center">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={vendor.maxAssignments || 15}
                      onChange={(e) => onUpdateMaxCapacity(vendor.id, parseInt(e.target.value, 10) || 15)}
                      className="w-16 text-center text-xs font-mono tabular-nums border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>

                  {/* Ventas */}
                  <td className="py-3.5 px-4 text-center font-mono tabular-nums text-slate-700">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      <Award className="w-3 h-3 text-emerald-600" />
                      {vendor.totalConversions || 0}
                    </span>
                  </td>

                  {/* Acciones */}
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {onManageVendor && (
                        <button onClick={() => onManageVendor(vendor)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded transition-colors" title="Editar supervisor, marcas y cupos">
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}
                      {onDeleteVendor && (
                        <button
                          onClick={() => onDeleteVendor(vendor.id)}
                          className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors"
                          title="Deshabilitar usuario (baja real)"
                        >
                          <Trash2 className="w-4 h-4" />
                          Deshabilitar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
