export type UserRole = 'vendedor' | 'supervisor' | 'gerencia' | 'administracion';

export interface UserSession {
  id: string;
  name: string;
  role: UserRole;
  vendorId?: string; // If role === 'vendedor'
  supervisorName?: string; // If role === 'supervisor' or 'vendedor'
  structure?: string; // Branch or department
}

export type VendorStatus = 'active' | 'paused' | 'inactive';

export interface Vendor {
  id: string;
  name: string; // Vendedor
  supervisor: string; // Supervisor
  brand: string; // Marca que tiene asignada para vender
  status: VendorStatus; // Estado de actividad
  statusReason?: string; // e.g. "Almuerzo", "Llamadas externas", "Fuera de turno"
  maxAssignments: number; // Capacidad máxima simultánea (default: 15)
  activeAssignments: number; // Volumen actual de asignaciones
  phone?: string;
  email?: string;
  lastAssignedAt?: string;
  totalAssignedCount: number;
  totalConversions: number; // Ventas cerradas
  avgResponseMinutes?: number; // Tiempo promedio de primera gestión en minutos
}

export interface SupervisorProfile {
  id: string;
  name: string;
  structure: string;
  active: boolean;
  phone?: string;
  email?: string;
}

export type LeadStatus =
  | 'pending_contact' // Recién asignado, 30 min para gestionar
  | 'in_progress' // Gestionado, con próxima tarea <= 5 horas
  | 'closed_won' // Venta cerrada exitosa
  | 'reopened' // Reabierto tras cierre no-venta y rotado a otro vendedor
  | 'expired_unassigned'; // No hay vendedor disponible de la misma marca

export type ClosureOutcome =
  | 'venta'
  | 'dato_erroneo'
  | 'ya_compro_en_otro_lado'
  | 'ya_es_cliente_nuestro'
  | 'otro';

export interface ScheduledTask {
  id: string;
  description: string;
  type: 'llamada' | 'whatsapp' | 'visita' | 'cotizacion' | 'seguimiento';
  dueAt: string; // ISO String, must be <= 5 hours from scheduling!
  createdAt: string;
  completed: boolean;
  completedAt?: string;
  notes?: string;
}

export interface LeadClosure {
  closedByVendorId: string;
  closedByVendorName: string;
  closedAt: string;
  outcome: ClosureOutcome;
  notes: string; // Breve descripción anexa obligatoria en cierres no-venta
  wasReopened: boolean;
  reopenedAt?: string;
  reassignedToVendorId?: string;
  reassignedToVendorName?: string;
}

export interface LeadComment {
  id: string;
  leadId: string;
  authorId: string;
  authorName: string;
  authorRole: 'vendedor' | 'supervisor' | 'gerencia' | 'administracion' | 'sistema';
  text: string;
  type: 'comentario' | 'gestion' | 'tarea' | 'rotacion' | 'reapertura' | 'cierre' | 'sistema';
  createdAt: string;
}

export interface Lead {
  id: string;
  foxLeadId: string; // ID original de Fox CRM
  clientName: string; // Nombre y apellido del contacto
  phone: string; // Teléfono / Celular / WhatsApp
  email: string; // Correo electrónico
  brand: string; // Marca de interés (debe coincidir con la marca del vendedor)
  modelInterest: string; // Modelo o versión de interés (ej. Corolla Cross, Hilux, Amarok)
  foxOriginalCloseDate?: string; // Fecha en que se cerró originalmente en Fox CRM
  foxOriginalCloseReason?: string; // Motivo de cierre previo en Fox CRM
  foxBranch?: string; // Sucursal o Concesionario de Fox CRM
  foxNotes?: string; // Historial o notas previas de Fox CRM

  // Estado dentro de Rotex
  status: LeadStatus;

  // Asignación activa
  currentVendorId: string | null;
  currentVendorName: string | null;
  currentSupervisorName?: string | null;
  assignedAt: string; // ISO String
  firstGestionAt: string | null; // Momento de la primera gestión (WhatsApp, llamada, etc.)
  lastGestionAt: string | null;
  hasContacted: boolean; // Si ya se le dio gestión dentro de los 30 min

  // Restricciones de rotación por estructura/supervisor
  restrictedSupervisor?: string | null; // Si se subió para rotar únicamente en el equipo del supervisor
  restrictedStructure?: string | null; // Si se subió para rotar únicamente en una sucursal/estructura de gerencia

  // Plazos y SLA
  contactDeadline: string; // assignedAt + 30 minutos
  activeTaskDeadline: string | null; // <= 5 horas tras la gestión
  currentTask: ScheduledTask | null;
  globalClosureDeadline: string; // assignedAt + 10 días completos (240 horas)

  // Rotaciones y auditoría
  rotationCount: number; // Veces que ha rotado
  previousVendorIds: string[]; // Historial de vendedores que tuvieron el dato
  comments: LeadComment[]; // Todos los comentarios son visibles por todos los vendedores
  closure?: LeadClosure | null;
  closureHistory: LeadClosure[];

  importedAt: string;
}

export interface RotationLog {
  id: string;
  timestamp: string;
  leadId: string;
  leadName: string;
  brand: string;
  fromVendorId?: string | null;
  fromVendorName?: string | null;
  toVendorId: string;
  toVendorName: string;
  reason:
    | 'timeout_30m' // Venció el plazo de 30 minutos sin gestión
    | 'timeout_5h_task' // No estableció o no cumplió la tarea en menos de 5 horas
    | 'reopened_after_closure' // El vendedor cerró sin venta y se reabre a otro vendedor
    | 'manual_rotation' // Reasignación manual por supervisor
    | 'initial_assignment' // Primera asignación tras importar de Fox CRM
    | 'requested_by_vendor'; // Solicitado desde el módulo de pedir datos
  notes: string;
}

export interface GoogleSheetConfig {
  sheetUrl: string;
  tabName: string;
  lastSyncAt: string | null;
  status: 'idle' | 'syncing' | 'connected' | 'error';
  errorMessage?: string;
  autoSyncMinutes: number;
}
