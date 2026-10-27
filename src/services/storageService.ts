import { Lead, Vendor, RotationLog, GoogleSheetConfig } from '../types/crm';
import { parseCSV, matchParteDiarioColumns } from '../utils/csvParser';
import { evaluateLeadSLA } from '../utils/rotationEngine';
import { sendLeadPushNotification } from '../utils/pushNotifications';

const LEADS_KEY = 'rotex_leads_v1';
const VENDORS_KEY = 'rotex_vendors_v1';
const LOGS_KEY = 'rotex_rotation_logs_v1';
const SHEET_CONFIG_KEY = 'rotex_sheet_config_v1';

// BroadcastChannel for instant cross-tab real-time synchronization
let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel('rotex_realtime_bus');
  } catch {
    broadcastChannel = null;
  }
}

type SyncCallback = () => void;
const syncListeners: Set<SyncCallback> = new Set();

export function subscribeToSync(cb: SyncCallback) {
  syncListeners.add(cb);
  return () => {
    syncListeners.delete(cb);
  };
}

function broadcastLocalChange(type: string, payload?: any) {
  syncListeners.forEach((fn) => fn());
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type, payload, timestamp: Date.now() });
    } catch {
      // Ignore
    }
  }
}

// Listen to broadcast messages from other tabs
if (broadcastChannel) {
  broadcastChannel.onmessage = () => {
    syncListeners.forEach((fn) => fn());
  };
}

/**
 * Lead Storage
 */
export function getStoredLeads(): Lead[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LEADS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredLeads(leads: Lead[], triggerBroadcast = true) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
    if (triggerBroadcast) {
      broadcastLocalChange('leads_updated');
    }
  } catch (e) {
    console.error('Failed to save leads to storage', e);
  }
}

/**
 * Vendors Storage ("Parte Diario")
 */
export function getStoredVendors(): Vendor[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(VENDORS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
    // Default Parte Diario structure with real supervisors and brands
    const defaultParteDiario: Vendor[] = [
      {
        id: 'v_1',
        name: 'Martin Gomez',
        supervisor: 'Mariana Lopez',
        brand: 'Toyota',
        status: 'active',
        maxAssignments: 15,
        activeAssignments: 0,
        phone: '5491145229011',
        totalAssignedCount: 0,
        totalConversions: 4,
        avgResponseMinutes: 6.2,
      },
      {
        id: 'v_2',
        name: 'Florencia Diaz',
        supervisor: 'Mariana Lopez',
        brand: 'Toyota',
        status: 'active',
        maxAssignments: 15,
        activeAssignments: 0,
        phone: '5491145229012',
        totalAssignedCount: 0,
        totalConversions: 3,
        avgResponseMinutes: 9.1,
      },
      {
        id: 'v_3',
        name: 'Lucas Rossi',
        supervisor: 'Esteban Ramirez',
        brand: 'Volkswagen',
        status: 'active',
        maxAssignments: 15,
        activeAssignments: 0,
        phone: '5491145229013',
        totalAssignedCount: 0,
        totalConversions: 5,
        avgResponseMinutes: 5.4,
      },
      {
        id: 'v_4',
        name: 'Camila Fernandez',
        supervisor: 'Esteban Ramirez',
        brand: 'Volkswagen',
        status: 'active',
        maxAssignments: 15,
        activeAssignments: 0,
        phone: '5491145229014',
        totalAssignedCount: 0,
        totalConversions: 2,
        avgResponseMinutes: 11.0,
      },
      {
        id: 'v_5',
        name: 'Nicolas Benitez',
        supervisor: 'Gonzalo Morales',
        brand: 'Ford',
        status: 'active',
        maxAssignments: 15,
        activeAssignments: 0,
        phone: '5491145229015',
        totalAssignedCount: 0,
        totalConversions: 3,
        avgResponseMinutes: 7.8,
      },
      {
        id: 'v_6',
        name: 'Sofia Romero',
        supervisor: 'Gonzalo Morales',
        brand: 'Ford',
        status: 'active',
        maxAssignments: 15,
        activeAssignments: 0,
        phone: '5491145229016',
        totalAssignedCount: 0,
        totalConversions: 4,
        avgResponseMinutes: 8.0,
      },
    ];
    localStorage.setItem(VENDORS_KEY, JSON.stringify(defaultParteDiario));
    return defaultParteDiario;
  } catch {
    return [];
  }
}

export function saveStoredVendors(vendors: Vendor[], triggerBroadcast = true) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(VENDORS_KEY, JSON.stringify(vendors));
    if (triggerBroadcast) {
      broadcastLocalChange('vendors_updated');
    }
  } catch (e) {
    console.error('Failed to save vendors to storage', e);
  }
}

/**
 * Rotation Logs
 */
export function getStoredRotationLogs(): RotationLog[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredRotationLogs(logs: RotationLog[], triggerBroadcast = true) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOGS_KEY, JSON.stringify(logs.slice(0, 500)));
    if (triggerBroadcast) {
      broadcastLocalChange('logs_updated');
    }
  } catch (e) {
    console.error('Failed to save logs to storage', e);
  }
}

/**
 * Google Sheet Config
 */
export function getStoredSheetConfig(): GoogleSheetConfig {
  const defaultConfig: GoogleSheetConfig = {
    sheetUrl: '',
    tabName: 'Parte Diario',
    lastSyncAt: null,
    status: 'idle',
    autoSyncMinutes: 15,
  };
  if (typeof window === 'undefined') return defaultConfig;
  try {
    const raw = localStorage.getItem(SHEET_CONFIG_KEY);
    return raw ? { ...defaultConfig, ...JSON.parse(raw) } : defaultConfig;
  } catch {
    return defaultConfig;
  }
}

export function saveStoredSheetConfig(config: GoogleSheetConfig) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SHEET_CONFIG_KEY, JSON.stringify(config));
    broadcastLocalChange('sheet_config_updated');
  } catch (e) {
    console.error('Failed to save sheet config', e);
  }
}

/**
 * Converts a regular Google Sheet link into a direct CSV export link
 */
export function getGoogleSheetCsvExportUrl(url: string, tabName = 'Parte Diario'): string {
  if (!url) return '';
  const trimmed = url.trim();

  // If already a direct export or published csv
  if (trimmed.includes('output=csv') || trimmed.includes('export?format=csv')) {
    return trimmed;
  }

  // Extract Sheet ID: /d/([a-zA-Z0-9-_]+)
  const match = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    const sheetId = match[1];
    const encodedTab = encodeURIComponent(tabName || 'Parte Diario');
    return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodedTab}`;
  }

  return trimmed;
}

/**
 * Sync vendors from a Google Sheet CSV content or fetch URL
 */
export async function syncVendorsFromGoogleSheet(
  sheetUrl: string,
  tabName = 'Parte Diario',
  rawCsvInput?: string
): Promise<{ success: boolean; vendors: Vendor[]; error?: string }> {
  try {
    let csvData = rawCsvInput || '';

    if (!csvData && sheetUrl) {
      const exportUrl = getGoogleSheetCsvExportUrl(sheetUrl, tabName);

      // Attempt to fetch via proxy or direct
      try {
        const res = await fetch(`/api/google-sheet/sync?url=${encodeURIComponent(exportUrl)}`);
        if (res.ok) {
          const json = await res.json();
          csvData = json.csv || '';
        } else {
          // Try direct client fetch if server route isn't running or CORS permits
          const directRes = await fetch(exportUrl);
          if (directRes.ok) {
            csvData = await directRes.text();
          }
        }
      } catch {
        // Fallback to direct fetch
        const directRes = await fetch(exportUrl);
        if (directRes.ok) {
          csvData = await directRes.text();
        }
      }
    }

    if (!csvData || !csvData.trim()) {
      return {
        success: false,
        vendors: [],
        error:
          'No se pudo obtener el contenido de la Google Sheet. Asegurate de que la planilla esté compartida con "Cualquiera con el enlace puede leer" o pegá el contenido de las filas directamente.',
      };
    }

    const { headers, rows } = parseCSV(csvData);
    if (rows.length === 0) {
      return { success: false, vendors: [], error: 'La planilla no contiene filas de datos.' };
    }

    const map = matchParteDiarioColumns(headers);
    if (!map.name || !map.brand) {
      return {
        success: false,
        vendors: [],
        error: `No se encontraron las columnas requeridas. Detectamos encabezados: [${headers.join(', ')}]. Se requiere al menos "Vendedor" y "Marca".`,
      };
    }

    // Existing vendors map to preserve custom capacity and stats if matching name
    const existing = getStoredVendors();
    const existingMap = new Map<string, Vendor>();
    existing.forEach((v) => existingMap.set(v.name.trim().toLowerCase(), v));

    const newVendors: Vendor[] = rows
      .filter((r) => r[map.name] && r[map.name].trim().length > 0)
      .map((r, index) => {
        const name = r[map.name].trim();
        const supervisor = map.supervisor && r[map.supervisor] ? r[map.supervisor].trim() : 'Sin Supervisor';
        const brand = r[map.brand] ? r[map.brand].trim() : 'General';
        const rawStatus = map.status && r[map.status] ? r[map.status].trim().toLowerCase() : 'activo';

        let status: Vendor['status'] = 'active';
        if (rawStatus.includes('pausa') || rawStatus.includes('almuerzo')) {
          status = 'paused';
        } else if (rawStatus.includes('inactiv') || rawStatus.includes('baja') || rawStatus.includes('fuera')) {
          status = 'inactive';
        }

        const rawMax = map.maxAssignments && r[map.maxAssignments] ? parseInt(r[map.maxAssignments], 10) : NaN;
        const maxAssignments = !isNaN(rawMax) && rawMax > 0 ? rawMax : 15;

        const prev = existingMap.get(name.toLowerCase());

        return {
          id: prev ? prev.id : 'v_' + Date.now() + '_' + index,
          name,
          supervisor,
          brand,
          status: prev ? prev.status : status,
          statusReason: prev ? prev.statusReason : undefined,
          maxAssignments: prev ? prev.maxAssignments : maxAssignments,
          activeAssignments: prev ? prev.activeAssignments : 0,
          phone: map.phone && r[map.phone] ? r[map.phone].trim() : prev?.phone || '',
          email: map.email && r[map.email] ? r[map.email].trim() : prev?.email || '',
          totalAssignedCount: prev ? prev.totalAssignedCount : 0,
          totalConversions: prev ? prev.totalConversions : 0,
        };
      });

    saveStoredVendors(newVendors);
    saveStoredSheetConfig({
      sheetUrl,
      tabName,
      lastSyncAt: new Date().toISOString(),
      status: 'connected',
      autoSyncMinutes: 15,
    });

    sendLeadPushNotification(
      'Parte Diario Sincronizado',
      `Se actualizaron ${newVendors.length} vendedores de la Google Sheet.`,
      'info'
    );

    return { success: true, vendors: newVendors };
  } catch (err: any) {
    return {
      success: false,
      vendors: [],
      error: err?.message || 'Error al conectar con la Google Sheet',
    };
  }
}

/**
 * Runs the global rotation ticker: evaluates 30m, 5h task, and reallocates leads
 */
export function runRotationHeartbeat(): { rotatedCount: number } {
  const leads = getStoredLeads();
  const vendors = getStoredVendors();
  const logs = getStoredRotationLogs();

  if (leads.length === 0 || vendors.length === 0) {
    return { rotatedCount: 0 };
  }

  let rotatedCount = 0;
  const newLogs: RotationLog[] = [];
  const updatedLeads: Lead[] = [];
  const now = new Date();

  leads.forEach((lead) => {
    const res = evaluateLeadSLA(lead, vendors, leads, now);
    if (res.reassigned && res.rotationLog) {
      rotatedCount++;
      newLogs.push(res.rotationLog);
      updatedLeads.push(res.updatedLead);

      sendLeadPushNotification(
        'Rotación Automática Ejecutada',
        `${lead.clientName} (${lead.brand}) rotó a ${res.rotationLog.toVendorName}. Motivo: ${res.rotationLog.notes}`,
        'rotation'
      );
    } else {
      updatedLeads.push(res.updatedLead);
    }
  });

  if (rotatedCount > 0) {
    saveStoredLeads(updatedLeads, false);
    saveStoredRotationLogs([...newLogs, ...logs], false);
    broadcastLocalChange('rotation_occurred');
  }

  return { rotatedCount };
}
