import React from 'react';
import { Filter, Users, RefreshCw, FileSpreadsheet, Plus, AlertCircle, Shield, CheckCircle2, PauseCircle, XCircle } from 'lucide-react';
import { Vendor, VendorStatus } from '../types/crm';

interface VendorsBarProps {
  vendors: Vendor[];
  statusFilter: 'all' | VendorStatus;
  setStatusFilter: (status: 'all' | VendorStatus) => void;
  volumeFilter: 'all' | 'available' | 'full' | 'zero';
  setVolumeFilter: (filter: 'all' | 'available' | 'full' | 'zero') => void;
  brandFilter: string;
  setBrandFilter: (brand: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onOpenSyncModal: () => void;
  onToggleStatus: (vendorId: string, currentStatus: VendorStatus) => void;
  onAddManualVendor?: () => void;
}

export const VendorsBar: React.FC<VendorsBarProps> = ({
  vendors,
  statusFilter,
  setStatusFilter,
  volumeFilter,
  setVolumeFilter,
  brandFilter,
  setBrandFilter,
  searchQuery,
  setSearchQuery,
  onOpenSyncModal,
  onToggleStatus,
  onAddManualVendor,
}) => {
  // Extract unique brands from vendors list
  const availableBrands = Array.from(new Set(vendors.map((v) => v.brand.trim()).filter(Boolean))).sort();

  // Compute counts
  const totalVendors = vendors.length;
  const activeVendors = vendors.filter((v) => v.status === 'active').length;
  const pausedVendors = vendors.filter((v) => v.status === 'paused').length;
  const inactiveVendors = vendors.filter((v) => v.status === 'inactive').length;

  return (
    <div className="bg-white border-b border-slate-200 py-4 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-3">
        {/* Top line: Title & Google Sheet Sync Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span>Base Activa de Vendedores · Parte Diario</span>
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
              <span>{totalVendors} registrados</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-600 font-medium">{activeVendors} activos para rotación</span>
              <span aria-hidden="true">·</span>
              <span className="text-amber-600">{pausedVendors} en pausa</span>
              <span aria-hidden="true">·</span>
              <span>{inactiveVendors} inactivos</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onOpenSyncModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Conectar Google Sheet</span>
            </button>
            {onAddManualVendor && (
              <button
                onClick={onAddManualVendor}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Invitar integrante</span>
              </button>
            )}
          </div>
        </div>

        {/* Filters row: Search, Estado de Actividad, Volumen, Marca */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          {/* Search */}
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <input
              type="text"
              placeholder="Buscar vendedor o supervisor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Estado de Actividad Filter (Segmented control) */}
          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                statusFilter === 'all' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos los estados
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
                statusFilter === 'active' ? 'bg-white text-emerald-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Activos ({activeVendors})</span>
            </button>
            <button
              onClick={() => setStatusFilter('paused')}
              className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
                statusFilter === 'paused' ? 'bg-white text-amber-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PauseCircle className="w-3 h-3 text-amber-600" />
              <span>En Pausa ({pausedVendors})</span>
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
                statusFilter === 'inactive' ? 'bg-white text-slate-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <XCircle className="w-3 h-3 text-slate-400" />
              <span>Inactivos ({inactiveVendors})</span>
            </button>
          </div>

          {/* Volumen de Asignaciones Actuales Filter */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
            <span className="text-slate-500">Volumen:</span>
            <select
              value={volumeFilter}
              onChange={(e) => setVolumeFilter(e.target.value as any)}
              className="bg-transparent text-slate-800 font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">Todo volumen</option>
              <option value="available">Con cupo disponible</option>
              <option value="full">Al límite de capacidad</option>
              <option value="zero">Sin asignaciones (0)</option>
            </select>
          </div>

          {/* Marca Asignada Filter */}
          {availableBrands.length > 0 && (
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
              <span className="text-slate-500">Marca:</span>
              <select
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                className="bg-transparent text-slate-800 font-medium focus:outline-none cursor-pointer"
              >
                <option value="all">Todas las marcas</option>
                {availableBrands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
