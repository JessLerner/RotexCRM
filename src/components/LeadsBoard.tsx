import React, { useState } from 'react';
import { Lead, Vendor } from '../types/crm';
import { LeadRow } from './LeadRow';
import { Search, Filter, Clock, RotateCw, Award, AlertCircle, Plus, Upload, CheckCircle2, Flame } from 'lucide-react';

interface LeadsBoardProps {
  leads: Lead[];
  vendors: Vendor[];
  currentVendorFilter: string; // 'all' or vendorId
  onOpenDetail: (lead: Lead) => void;
  onOpenTaskModal: (lead: Lead) => void;
  onOpenClosureModal: (lead: Lead) => void;
  onWhatsAppClick: (lead: Lead) => void;
  onCallClick: (lead: Lead) => void;
  onOpenImportModal: () => void;
  onOpenImportReview: () => void;
  onOpenSyncModal: () => void;
}

export const LeadsBoard: React.FC<LeadsBoardProps> = ({
  leads,
  vendors,
  currentVendorFilter,
  onOpenDetail,
  onOpenTaskModal,
  onOpenClosureModal,
  onWhatsAppClick,
  onCallClick,
  onOpenImportModal,
  onOpenImportReview,
  onOpenSyncModal,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'reopened' | 'won'>('all');
  const [brandFilter, setBrandFilter] = useState<string>('all');

  // Filter leads based on supervisor/vendor view, search, status, and brand
  const filteredLeads = leads.filter((lead) => {
    // Current vendor filter
    if (currentVendorFilter !== 'all' && lead.currentVendorId !== currentVendorFilter) {
      return false;
    }

    // Status filter
    if (statusFilter === 'pending' && (lead.hasContacted || lead.status === 'closed_won')) return false;
    if (statusFilter === 'in_progress' && (lead.status !== 'in_progress' || !lead.hasContacted)) return false;
    if (statusFilter === 'reopened' && lead.status !== 'reopened') return false;
    if (statusFilter === 'won' && lead.status !== 'closed_won') return false;

    // Brand filter
    if (brandFilter !== 'all' && lead.brand.toLowerCase() !== brandFilter.toLowerCase()) return false;

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = lead.clientName.toLowerCase().includes(q);
      const matchPhone = lead.phone ? lead.phone.includes(q) : false;
      const matchId = lead.foxLeadId ? lead.foxLeadId.toLowerCase().includes(q) : false;
      const matchModel = lead.modelInterest ? lead.modelInterest.toLowerCase().includes(q) : false;
      const matchVendor = lead.currentVendorName ? lead.currentVendorName.toLowerCase().includes(q) : false;
      return matchName || matchPhone || matchId || matchModel || matchVendor;
    }

    return true;
  });

  // Extract unique brands for the filter
  const brandsList = Array.from(new Set(leads.map((l) => l.brand.trim()).filter(Boolean))).sort();

  // Metric counts
  const totalLeads = leads.length;
  const pending30mCount = leads.filter((l) => !l.hasContacted && l.status !== 'closed_won').length;
  const inProgressTaskCount = leads.filter((l) => l.hasContacted && l.status !== 'closed_won' && l.currentTask).length;
  const reopenedCount = leads.filter((l) => l.status === 'reopened').length;
  const wonCount = leads.filter((l) => l.status === 'closed_won').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* KPI Cards Row (Clean anti-slop metric strip) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Total Activos */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">Total en Cartera</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {totalLeads}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Leads importados de Fox CRM</div>
        </div>

        {/* SLA 30m Pendientes */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs text-amber-700 font-medium flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>SLA 30m Activo</span>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-600 mt-1">
            {pending30mCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Sin primera gestión</div>
        </div>

        {/* Tareas 5h en Seguimiento */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs text-blue-700 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Retenidos con Tarea</span>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-blue-600 mt-1">
            {inProgressTaskCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Próxima tarea ≤ 5 horas</div>
        </div>

        {/* Reabiertos tras cierre no-venta */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs text-purple-700 font-medium flex items-center gap-1">
            <RotateCw className="w-3.5 h-3.5 text-purple-600" />
            <span>Reabiertos (No-Venta)</span>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-purple-600 mt-1">
            {reopenedCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Cerrados sin venta reasignados</div>
        </div>

        {/* Ventas Confirmadas */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs col-span-2 lg:col-span-1">
          <div className="text-xs text-emerald-700 font-medium flex items-center gap-1">
            <Award className="w-3.5 h-3.5 text-emerald-600" />
            <span>Ventas Confirmadas</span>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-600 mt-1">
            {wonCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Cierres exitosos</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search */}
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <input
              type="text"
              placeholder="Buscar cliente, teléfono, ID Fox o modelo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Status tabs */}
          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                statusFilter === 'all' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos ({totalLeads})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                statusFilter === 'pending' ? 'bg-white text-amber-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sin Contacto (30m)
            </button>
            <button
              onClick={() => setStatusFilter('in_progress')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                statusFilter === 'in_progress' ? 'bg-white text-blue-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              En Gestión (5h)
            </button>
            <button
              onClick={() => setStatusFilter('reopened')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                statusFilter === 'reopened' ? 'bg-white text-purple-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Reabiertos
            </button>
            <button
              onClick={() => setStatusFilter('won')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                statusFilter === 'won' ? 'bg-white text-emerald-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ventas
            </button>
          </div>

          {/* Brand filter */}
          {brandsList.length > 0 && (
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
              <span className="text-slate-500">Marca:</span>
              <select
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                className="bg-transparent text-slate-800 font-medium focus:outline-none cursor-pointer"
              >
                <option value="all">Todas las marcas</option>
                {brandsList.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="shrink-0 flex items-center gap-2">
          <button
            onClick={onOpenImportReview}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg transition-colors"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Revisar importaciones</span>
          </button>
          <button
            onClick={onOpenImportModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Cargar CSV Fox CRM</span>
          </button>
        </div>
      </div>

      {/* Leads Table */}
      {leads.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center max-w-xl mx-auto my-8">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Upload className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">Sin Datos en Rotación Activa</h3>
          <p className="text-xs text-slate-500 mb-6 leading-relaxed">
            Cargá el archivo CSV descargado de Fox CRM con los datos previamente cerrados. El motor de rotación continua los asignará automáticamente a los asesores activos según su marca y volumen.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={onOpenImportModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span>Importar CSV de Fox CRM</span>
            </button>
            <button
              onClick={onOpenSyncModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg transition-colors"
            >
              <span>Conectar Google Sheet</span>
            </button>
          </div>
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-500">
          No se encontraron datos que coincidan con los filtros seleccionados.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                <tr>
                  <th className="py-3 px-4">Contacto / Lead Fox CRM</th>
                  <th className="py-3 px-4">Marca y Modelo</th>
                  <th className="py-3 px-4">Asesor Asignado</th>
                  <th className="py-3 px-4">SLA 1: Contacto (30m)</th>
                  <th className="py-3 px-4">SLA 2: Próxima Tarea (≤5h)</th>
                  <th className="py-3 px-4 text-right">Acciones Rápidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLeads.map((lead) => (
                  <LeadRow
                    key={lead.id}
                    lead={lead}
                    onOpenDetail={onOpenDetail}
                    onOpenTaskModal={onOpenTaskModal}
                    onOpenClosureModal={onOpenClosureModal}
                    onWhatsAppClick={onWhatsAppClick}
                    onCallClick={onCallClick}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
