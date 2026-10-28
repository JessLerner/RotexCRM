import React, { useState } from 'react';
import { X, Upload, FileText, CheckCircle2, AlertCircle, ArrowRight, Download, RefreshCw, Car, ShieldCheck } from 'lucide-react';
import { decodeCsvFile, parseCSV, matchFoxCrmColumns } from '../utils/csvParser';
import { UserRole } from '../types/crm';
import { sendLeadPushNotification } from '../utils/pushNotifications';
import { FoxImportResult, FoxLeadImportRow } from '../services/foxImportRepository';
import { resolveVehicleBrand } from '../utils/vehicleBrand';
import { assessPhone } from '../utils/phoneValidation';

interface FoxCrmImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportLeads: (rows: FoxLeadImportRow[]) => Promise<FoxImportResult>;
  currentUserRole?: UserRole;
  currentSupervisorName?: string;
  currentStructure?: string;
}

export const FoxCrmImportModal: React.FC<FoxCrmImportModalProps> = ({
  isOpen,
  onClose,
  onImportLeads,
  currentUserRole = 'administracion',
  currentSupervisorName,
  currentStructure,
}) => {
  const [csvContent, setCsvContent] = useState('');
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Supervisor team restriction (checked by default for supervisors)
  const [restrictToSupervisorTeam, setRestrictToSupervisorTeam] = useState<boolean>(
    currentUserRole === 'supervisor' && Boolean(currentSupervisorName)
  );

  // Gerencia structure restriction
  const [restrictToStructure, setRestrictToStructure] = useState<boolean>(
    currentUserRole === 'gerencia'
  );

  if (!isOpen) return null;

  // Vendors are cannot import leads
  if (currentUserRole === 'vendedor') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
        <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 text-center">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900 mb-2">Acceso Restringido</h3>
          <p className="text-xs text-slate-500 mb-4">
            Los asesores de ventas no tienen permisos para cargar datos nuevos. Por favor solicitá la carga a tu supervisor o administración.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
          >
            Entendido
          </button>
        </div>
      </div>
    );
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      processCsvText(decodeCsvFile(event.target?.result as ArrayBuffer));
    };
    reader.readAsArrayBuffer(file);
  };

  const processCsvText = (text: string) => {
    setError(null);
    if (!text.trim()) {
      setError('El archivo o texto está vacío.');
      return;
    }

    try {
      const { headers, rows } = parseCSV(text);
      if (headers.length === 0 || rows.length === 0) {
        setError('No se pudieron detectar columnas válidas en el CSV.');
        return;
      }

      const map = matchFoxCrmColumns(headers);
      setCsvContent(text);
      setParsedHeaders(headers);
      setParsedRows(rows);
      setColumnMap(map);
      setStep('mapping');
    } catch (err: any) {
      setError('Error al parsear el archivo CSV: ' + err.message);
    }
  };

  const handleApplyMapping = () => {
    if (!columnMap.clientName) {
      setError('Debés mapear al menos la columna "Nombre del Cliente".');
      return;
    }
    setError(null);
    setStep('preview');
  };

  const handleConfirmImport = async () => {
    setIsProcessing(true);
    setError(null);
    const rows: FoxLeadImportRow[] = parsedRows.flatMap((row, idx) => {
      const clientName = [columnMap.clientName ? row[columnMap.clientName] : '', columnMap.lastName ? row[columnMap.lastName] : '']
        .map((value) => value.trim()).filter(Boolean).join(' ');
      if (!clientName) return [];

      const modelInterest = (columnMap.modelInterest ? row[columnMap.modelInterest] : '').trim();
      const brandResolution = resolveVehicleBrand(columnMap.brand ? row[columnMap.brand] : '', modelInterest);
      const phone = (columnMap.phone ? row[columnMap.phone] : '').trim();
      const phoneAssessment = assessPhone(phone);
      return [{
        foxLeadId: (columnMap.foxLeadId ? row[columnMap.foxLeadId] : '').trim() || `FOX-${idx + 1001}`,
        clientName,
        brand: brandResolution.brand,
        phone,
        email: (columnMap.email ? row[columnMap.email] : '').trim(),
        modelInterest,
        foxOriginalCloseDate: (columnMap.foxOriginalCloseDate ? row[columnMap.foxOriginalCloseDate] : '').trim(),
        foxOriginalCloseReason: (columnMap.foxOriginalCloseReason ? row[columnMap.foxOriginalCloseReason] : '').trim(),
        foxBranch: (columnMap.foxBranch ? row[columnMap.foxBranch] : '').trim(),
        foxNotes: (columnMap.foxNotes ? row[columnMap.foxNotes] : '').trim(),
        sourceMetadata: { ...Object.fromEntries([['sourceStatus', columnMap.sourceStatus], ['sourceOrigin', columnMap.sourceOrigin], ['sourceTeam', columnMap.sourceTeam], ['sourceManager', columnMap.sourceManager]].map(([key, column]) => [key, column ? row[column].trim() : '']).filter(([, value]) => Boolean(value))), brandResolution: brandResolution.resolution, phoneValidation: phoneAssessment.valid ? 'valid' : 'review', phoneReviewReason: phoneAssessment.reason || '' },
      }];
    });

    try {
      const result = await onImportLeads(rows);
      sendLeadPushNotification('Datos de Fox CRM Importados', `${result.inserted - result.review} datos quedaron en cola${result.review ? ` y ${result.review} requieren revisión de teléfono` : ''}.`, 'assignment');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la importación.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadTemplate = () => {
    const csvHeader = 'ID Fox,Nombre Cliente,Telefono WhatsApp,Email,Marca,Modelo Interes,Fecha Cierre Fox,Motivo Cierre Fox,Sucursal,Notas Fox\n';
    const sampleRows = `FX-9481,Horacio Dominguez,5491145229011,hdominguez@gmail.com,Toyota,Corolla Cross XEI,2026-09-14,Desestimó por plazo,Sucursal Norte,Buscaba entrega inmediata de Corolla Cross
FX-9482,Mariela Soria,5491158993214,msoria@yahoo.com.ar,Volkswagen,Taos Highline 250,2026-09-18,Sin respuesta de crédito,Sucursal Centro,Aprobación crediticia demorada en Fox CRM
FX-9483,Federico Albarracin,5491167884123,falbarracin@outlook.com,Ford,Ranger Limited 4x4,2026-09-22,Precio elevado,Sucursal Oeste,Consultó por Ranger nueva generación
FX-9484,Ignacio Cabrera,5491132448900,icabrera@gmail.com,Toyota,Hilux SRV 4x4,2026-09-25,Enfriado en seguimiento,Sucursal Norte,Pidió retoma de usado Hilux 2020`;

    const blob = new Blob([csvHeader + sampleRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'plantilla_datos_fox_crm.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLoadOfficialSampleData = () => {
    const sampleCsv = `ID Fox;Nombre Cliente;Telefono WhatsApp;Email;Marca;Modelo Interes;Fecha Cierre Fox;Motivo Cierre Fox;Sucursal;Notas Fox
FOX-7821;Gonzalo Menendez;5491145981234;gmenendez@gmail.com;Toyota;Corolla Cross XEI;2026-09-15;Sin contacto reiterado;Sucursal Norte;Llamado 3 veces en Fox sin éxito. Interesado en Corolla Cross gris plata.
FOX-7822;Valeria Quintana;5491138765432;valequintana@hotmail.com;Volkswagen;Amarok V6 Highline;2026-09-18;No llegó con el anticipo;Sucursal Panamericana;Buscaba plan con entrega pactada cuota 3.
FOX-7823;Esteban Morales;5491165432198;emorales_arq@gmail.com;Ford;Ranger XLT Biturbo;2026-09-21;Compraba de contado;Sucursal Oeste;Pedía bonificación adicional por pago transferencia.
FOX-7824;Patricia Almada;5491143219876;palmada@yahoo.com.ar;Toyota;Yaris Hatchback XLS;2026-09-24;Enfriado;Sucursal Norte;Buscaba primer 0km para su hijo.
FOX-7825;Rodrigo Funes;5491176543210;rfunes@transporte.com;Volkswagen;Nivus Highline;2026-09-26;Desestimó por tasa interés;Sucursal Centro;Ofrecer nueva tasa subsidiada de este mes.`;

    processCsvText(sampleCsv);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-600" />
              <span>Importar Datos Cerrados de Fox CRM</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Carga tu CSV descargado de Fox CRM para activar la rotación inteligente por marca
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Steps indicator */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-2.5 bg-slate-50/50 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center font-bold ${
                step === 'upload' ? 'bg-blue-600 text-white' : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              1
            </span>
            <span className={step === 'upload' ? 'font-bold text-slate-800' : ''}>Cargar Archivo CSV</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
          <div className="flex items-center gap-2">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center font-bold ${
                step === 'mapping' ? 'bg-blue-600 text-white' : step === 'preview' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
              }`}
            >
              2
            </span>
            <span className={step === 'mapping' ? 'font-bold text-slate-800' : ''}>Mapeo de Columnas</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
          <div className="flex items-center gap-2">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center font-bold ${
                step === 'preview' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}
            >
              3
            </span>
            <span className={step === 'preview' ? 'font-bold text-slate-800' : ''}>Vista Previa y Asignación</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2.5 flex items-start gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {step === 'upload' && (
            <div className="space-y-4">
              {/* Supervisor Team Restriction Option */}
              {currentUserRole === 'supervisor' && currentSupervisorName && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="restrictSupervisorCheck"
                    checked={restrictToSupervisorTeam}
                    onChange={(e) => setRestrictToSupervisorTeam(e.target.checked)}
                    className="mt-1 h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="restrictSupervisorCheck" className="text-xs text-blue-900 cursor-pointer">
                    <span className="font-bold block">
                      Rotar ÚNICAMENTE entre los vendedores de mi propia estructura ({currentSupervisorName})
                    </span>
                    <span className="text-blue-700">
                      Si está marcado, los datos solo rotarán entre los asesores a tu cargo. Si lo destildás, los datos podrán rotar entre toda la red si tu equipo no tiene disponibilidad.
                    </span>
                  </label>
                </div>
              )}

              {/* Gerencia Structure Restriction Option */}
              {currentUserRole === 'gerencia' && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="restrictGerenciaCheck"
                    checked={restrictToStructure}
                    onChange={(e) => setRestrictToStructure(e.target.checked)}
                    className="mt-1 h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="restrictGerenciaCheck" className="text-xs text-slate-800 cursor-pointer">
                    <span className="font-bold block">
                      Rotar prioritariamente dentro de mi estructura / sucursal
                    </span>
                    <span className="text-slate-500">
                      Asigna y rota únicamente dentro de los equipos supervisados de tu estructura.
                    </span>
                  </label>
                </div>
              )}

              {/* Drag and Drop Box */}
              <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-50 hover:bg-blue-50/30">
                <Upload className="w-10 h-10 text-slate-400 mb-2" />
                <span className="text-sm font-semibold text-slate-800">
                  Seleccioná o arrastrá el archivo CSV de Fox CRM
                </span>
                <span className="text-xs text-slate-500 mt-1">
                  Formatos compatibles: CSV delimitado por coma (,) o punto y coma (;)
                </span>
                <input
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {/* Or Paste CSV box */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  O pegá el texto CSV directamente:
                </label>
                <textarea
                  rows={4}
                  value={csvContent}
                  onChange={(e) => setCsvContent(e.target.value)}
                  placeholder="ID;Nombre;Telefono;Marca;Modelo..."
                  className="w-full font-mono text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {csvContent.trim() && (
                  <button
                    type="button"
                    onClick={() => processCsvText(csvContent)}
                    className="mt-2 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Procesar texto pegado
                  </button>
                )}
              </div>

              {/* Tools row: Download template & load official sample */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar Plantilla CSV Oficial de Fox CRM</span>
                </button>

                <button
                  type="button"
                  onClick={handleLoadOfficialSampleData}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <Car className="w-3.5 h-3.5" />
                  <span>Cargar Listado de Prueba Fox CRM (Marcas Reales)</span>
                </button>
              </div>
            </div>
          )}

          {step === 'mapping' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-600">
                Se detectaron <strong>{parsedHeaders.length}</strong> columnas y <strong>{parsedRows.length}</strong> registros en el CSV. Verificá que los campos correspondan a los atributos de Rotex:
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                {[
                  { key: 'clientName', label: 'Nombre del Cliente / Contacto *', required: true },
                  { key: 'lastName', label: 'Apellido (se combina con Nombre)', required: false },
                  { key: 'brand', label: 'Marca del Vehículo (si está disponible)', required: false },
                  { key: 'phone', label: 'Teléfono / WhatsApp', required: false },
                  { key: 'email', label: 'Correo Electrónico', required: false },
                  { key: 'modelInterest', label: 'Modelo o Versión de Interés', required: false },
                  { key: 'foxLeadId', label: 'ID Lead en Fox CRM', required: false },
                  { key: 'foxOriginalCloseDate', label: 'Fecha Cierre Fox CRM', required: false },
                  { key: 'foxOriginalCloseReason', label: 'Motivo Cierre Previo Fox', required: false },
                  { key: 'foxBranch', label: 'Sucursal / Concesionario', required: false },
                  { key: 'foxNotes', label: 'Notas Previas de Fox CRM', required: false },
                ].map((field) => (
                  <div key={field.key} className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                      <span>{field.label}</span>
                      {columnMap[field.key] ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : field.required ? (
                        <span className="text-red-500 text-[10px]">Requerido</span>
                      ) : null}
                    </label>
                    <select
                      value={columnMap[field.key] || ''}
                      onChange={(e) => setColumnMap({ ...columnMap, [field.key]: e.target.value })}
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">-- No asignar / Sin columna --</option>
                      {parsedHeaders.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
                >
                  Volver atrás
                </button>
                <button
                  type="button"
                  onClick={handleApplyMapping}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
                >
                  <span>Continuar a Vista Previa</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-600 flex items-center justify-between">
                <span>
                  Vista previa de los primeros {Math.min(5, parsedRows.length)} datos a ingresar en la rotación:
                </span>
                <span className="font-semibold text-slate-800">Total: {parsedRows.length} registros</span>
              </div>

              {/* Table preview */}
              <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-60">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
                    <tr>
                      <th className="py-2 px-3">Cliente</th>
                      <th className="py-2 px-3">Marca</th>
                      <th className="py-2 px-3">Modelo</th>
                      <th className="py-2 px-3">Teléfono</th>
                      <th className="py-2 px-3">Cierre Previo Fox</th>
                      <th className="py-2 px-3">Destino de Asignación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.slice(0, 5).map((row, i) => {
                      const brand = resolveVehicleBrand(columnMap.brand ? row[columnMap.brand] : '', columnMap.modelInterest ? row[columnMap.modelInterest] : '');
                      return (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-semibold text-slate-900">
                            {columnMap.clientName ? row[columnMap.clientName] : ''}
                          </td>
                          <td className="py-2 px-3">
                            <span className="font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded text-[11px]">
                              {brand.brand || 'Sin marca · cartera general'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-600">
                            {columnMap.modelInterest ? row[columnMap.modelInterest] : '-'}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-600">
                            {columnMap.phone ? row[columnMap.phone] : '-'}
                          </td>
                          <td className="py-2 px-3 text-slate-500">
                            {columnMap.foxOriginalCloseReason ? row[columnMap.foxOriginalCloseReason] : '-'}
                          </td>
                          <td className="py-2 px-3">
                            <span className="text-amber-600 font-medium">En cola hasta habilitar la nómina</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Assignment info */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Configuración de Asignación y Rotación:</span>
                </div>
                <p>
                  Los datos se guardarán en Supabase con estado <strong>En cola</strong>. No se asignarán ni iniciarán plazos hasta que habilitemos la nómina comercial real.
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setStep('mapping')}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
                >
                  Volver al mapeo
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  {isProcessing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  <span>Confirmar e Importar a la Cola</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
