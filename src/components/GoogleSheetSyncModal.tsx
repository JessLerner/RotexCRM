import React, { useState } from 'react';
import { X, FileSpreadsheet, RefreshCw, CheckCircle2, AlertCircle, Copy, ExternalLink, Database } from 'lucide-react';
import { GoogleSheetConfig, Vendor } from '../types/crm';
import { syncVendorsFromGoogleSheet } from '../services/storageService';

interface GoogleSheetSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: GoogleSheetConfig;
  onSuccess: (vendors: Vendor[]) => void;
}

export const GoogleSheetSyncModal: React.FC<GoogleSheetSyncModalProps> = ({
  isOpen,
  onClose,
  config,
  onSuccess,
}) => {
  const [sheetUrl, setSheetUrl] = useState(config.sheetUrl || '');
  const [tabName, setTabName] = useState(config.tabName || 'Parte Diario');
  const [pastedData, setPastedData] = useState('');
  const [activeMode, setActiveMode] = useState<'url' | 'paste'>('url');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleSyncUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheetUrl.trim()) {
      setError('Por favor ingresá la URL de la Google Sheet');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessCount(null);

    const result = await syncVendorsFromGoogleSheet(sheetUrl.trim(), tabName.trim());
    setLoading(false);

    if (result.success) {
      setSuccessCount(result.vendors.length);
      onSuccess(result.vendors);
      setTimeout(() => {
        onClose();
      }, 1200);
    } else {
      setError(result.error || 'No se pudo sincronizar la Google Sheet.');
    }
  };

  const handleSyncPaste = async () => {
    if (!pastedData.trim()) {
      setError('Pegá los datos de la pestaña Parte Diario copiados de Google Sheets');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessCount(null);

    const result = await syncVendorsFromGoogleSheet('', tabName.trim(), pastedData.trim());
    setLoading(false);

    if (result.success) {
      setSuccessCount(result.vendors.length);
      onSuccess(result.vendors);
      setTimeout(() => {
        onClose();
      }, 1200);
    } else {
      setError(result.error || 'No se pudo procesar el contenido pegado.');
    }
  };

  const handleLoadOfficialStructure = async () => {
    // Official structure as specified by the user: Vendedor, Supervisor, Marca, Estado, Capacidad
    const standardParteDiarioCsv = `Vendedor,Supervisor,Marca,Estado,Capacidad Maxima,Telefono
Martin Gomez,Mariana Lopez,Toyota,Activo,15,5491123456781
Florencia Diaz,Mariana Lopez,Toyota,Activo,15,5491123456782
Lucas Rossi,Esteban Ramirez,Volkswagen,Activo,15,5491123456783
Camila Fernandez,Esteban Ramirez,Volkswagen,Activo,15,5491123456784
Nicolas Benitez,Gonzalo Morales,Ford,Activo,15,5491123456785
Sofia Romero,Gonzalo Morales,Ford,Activo,15,5491123456786
Agustin Perez,Mariana Lopez,Chevrolet,Activo,15,5491123456787
Valeria Castro,Gonzalo Morales,Peugeot,Activo,15,5491123456788`;

    setLoading(true);
    const result = await syncVendorsFromGoogleSheet('', 'Parte Diario', standardParteDiarioCsv);
    setLoading(false);

    if (result.success) {
      setSuccessCount(result.vendors.length);
      onSuccess(result.vendors);
      setTimeout(() => {
        onClose();
      }, 1000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-xl w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              <span>Conexión Google Sheet · Parte Diario</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Sincroniza la nómina activa de asesores, sus marcas asignadas y supervisores
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Requirements info banner */}
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-3 text-xs text-blue-900 space-y-1">
          <div className="font-semibold flex items-center gap-1.5">
            <Database className="w-4 h-4 text-blue-600" />
            <span>Estructura de la pestaña:</span>
          </div>
          <p className="text-blue-800">
            La pestaña debe contener las columnas: <code className="bg-blue-100 px-1 py-0.5 rounded font-mono">Vendedor</code>,{' '}
            <code className="bg-blue-100 px-1 py-0.5 rounded font-mono">Supervisor</code> y{' '}
            <code className="bg-blue-100 px-1 py-0.5 rounded font-mono">Marca</code> (opcional: Estado, Capacidad, Teléfono).
          </p>
        </div>

        {/* Tab Mode switcher */}
        <div className="flex border-b border-slate-200 px-6 pt-3 bg-white">
          <button
            onClick={() => setActiveMode('url')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeMode === 'url' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Enlace de Google Sheet
          </button>
          <button
            onClick={() => setActiveMode('paste')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeMode === 'paste' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Pegar Filas de la Planilla
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeMode === 'url' ? (
            <form onSubmit={handleSyncUrl} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  URL del Documento de Google Sheet
                </label>
                <input
                  type="url"
                  placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Tip: Asegurate de que la planilla esté en &quot;Cualquiera con el enlace puede leer&quot; (Compartir).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nombre de la Pestaña
                </label>
                <input
                  type="text"
                  value={tabName}
                  onChange={(e) => setTabName(e.target.value)}
                  placeholder="Parte Diario"
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {error && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2.5 flex items-start gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {successCount !== null && (
                <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-2.5 flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>¡Éxito! Se sincronizaron {successCount} asesores desde la planilla.</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleLoadOfficialStructure}
                  className="text-xs text-slate-600 hover:text-slate-900 underline"
                >
                  Cargar plantilla inicial con marcas
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-lg"
                  >
                    Cerrar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                  >
                    {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                    <span>{loading ? 'Conectando...' : 'Sincronizar Parte Diario'}</span>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pegá el contenido copiado de la pestaña &quot;Parte Diario&quot;
                </label>
                <textarea
                  rows={6}
                  placeholder={`Vendedor\tSupervisor\tMarca\tEstado\nMartin Gomez\tMariana Lopez\tToyota\tActivo\nLucas Rossi\tEsteban Ramirez\tVolkswagen\tActivo`}
                  value={pastedData}
                  onChange={(e) => setPastedData(e.target.value)}
                  className="w-full font-mono text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Seleccioná las columnas en Google Sheets, presioná Ctrl+C y pegalas aquí.
                </p>
              </div>

              {error && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2.5 flex items-start gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {successCount !== null && (
                <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-2.5 flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>¡Procesado! Se cargaron {successCount} asesores.</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-lg"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={handleSyncPaste}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                  <span>{loading ? 'Procesando...' : 'Cargar Vendedores'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
