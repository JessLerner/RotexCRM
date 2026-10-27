import { Lead, Vendor, RotationLog, LeadComment, ClosureOutcome, ScheduledTask } from '../types/crm';

export interface RotationResult {
  updatedLead: Lead;
  rotationLog?: RotationLog;
  reassigned: boolean;
  message: string;
}

/**
 * Finds the best active vendor for a given brand:
 * - Must be 'active' status
 * - Must handle the same brand (case-insensitive)
 * - Excludes vendor IDs from excludedVendorIds (e.g. current vendor or vendor who just closed it)
 * - If restrictedSupervisor is set, vendor's supervisor must match!
 * - Must have activeAssignments < maxAssignments
 * - Prioritizes lowest activeAssignments (load balancing), then oldest lastAssignedAt
 */
export function findBestVendorForBrand(
  brand: string,
  vendors: Vendor[],
  activeLeads: Lead[],
  excludedVendorIds: string[] = [],
  restrictedSupervisor?: string | null
): Vendor | null {
  const normBrand = brand.trim().toLowerCase();

  // Compute live active assignments for each vendor
  const vendorLoads = new Map<string, number>();
  activeLeads.forEach((lead) => {
    if (lead.currentVendorId && (lead.status === 'pending_contact' || lead.status === 'in_progress' || lead.status === 'reopened')) {
      vendorLoads.set(lead.currentVendorId, (vendorLoads.get(lead.currentVendorId) || 0) + 1);
    }
  });

  const eligible = vendors.filter((v) => {
    const vBrand = v.brand.trim().toLowerCase();
    const matchesBrand = vBrand === normBrand || vBrand.includes(normBrand) || normBrand.includes(vBrand);
    const isActive = v.status === 'active';
    const notExcluded = !excludedVendorIds.includes(v.id);
    const currentLoad = vendorLoads.get(v.id) || 0;
    const hasCapacity = currentLoad < (v.maxAssignments || 15);

    // Supervisor structure restriction if specified
    const matchesSupervisor = restrictedSupervisor
      ? v.supervisor.trim().toLowerCase() === restrictedSupervisor.trim().toLowerCase()
      : true;

    return matchesBrand && isActive && notExcluded && hasCapacity && matchesSupervisor;
  });

  if (eligible.length === 0) {
    // If all other vendors were excluded (e.g. team has only 1 vendor for this brand in team),
    // check if we can fall back to the supervisor's active vendors without the exclusion
    const fallback = vendors.filter((v) => {
      const vBrand = v.brand.trim().toLowerCase();
      const matchesBrand = vBrand === normBrand || vBrand.includes(normBrand) || normBrand.includes(vBrand);
      const isActive = v.status === 'active';
      const currentLoad = vendorLoads.get(v.id) || 0;
      const matchesSupervisor = restrictedSupervisor
        ? v.supervisor.trim().toLowerCase() === restrictedSupervisor.trim().toLowerCase()
        : true;
      return matchesBrand && isActive && currentLoad < (v.maxAssignments || 15) && matchesSupervisor;
    });

    if (fallback.length === 0) return null;
    eligible.push(...fallback);
  }

  // Sort by lowest load first, then oldest lastAssignedAt
  eligible.sort((a, b) => {
    const loadA = vendorLoads.get(a.id) || 0;
    const loadB = vendorLoads.get(b.id) || 0;
    if (loadA !== loadB) return loadA - loadB;

    const timeA = a.lastAssignedAt ? new Date(a.lastAssignedAt).getTime() : 0;
    const timeB = b.lastAssignedAt ? new Date(b.lastAssignedAt).getTime() : 0;
    return timeA - timeB;
  });

  return eligible[0] || null;
}

/**
 * Assigns or rotates a lead to a new vendor
 */
export function assignLeadToVendor(
  lead: Lead,
  targetVendor: Vendor,
  reason: RotationLog['reason'],
  notes: string,
  nowIso = new Date().toISOString()
): { lead: Lead; log: RotationLog } {
  const previousVendorId = lead.currentVendorId;
  const previousVendorName = lead.currentVendorName;

  const contactDeadline = new Date(new Date(nowIso).getTime() + 30 * 60 * 1000).toISOString();
  // 10 days from initial assignment or from rotation
  const globalDeadline = lead.globalClosureDeadline || new Date(new Date(nowIso).getTime() + 10 * 24 * 60 * 60 * 1000).toISOString();

  let commentText = '';
  if (reason === 'initial_assignment') {
    commentText = `Dato importado asignado a ${targetVendor.name} (${targetVendor.brand} · Equipo ${targetVendor.supervisor}). Plazo inicial: 30 minutos para gestionar.`;
  } else if (reason === 'requested_by_vendor') {
    commentText = `Dato asignado a petición del vendedor ${targetVendor.name} (${targetVendor.brand}). Plazo inicial: 30 minutos para gestionar.`;
  } else if (reason === 'reopened_after_closure') {
    commentText = `Reapertura automática: ${previousVendorName || 'Asesor anterior'} cerró sin venta con motivo "${notes}". Rotado inmediatamente a ${targetVendor.name}.`;
  } else {
    commentText = `Rotación automática: Lead transferido de ${previousVendorName || 'Anterior'} a ${targetVendor.name}. Motivo: ${notes}. Nuevo plazo de 30m activado.`;
  }

  const newComment: LeadComment = {
    id: 'cmt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    leadId: lead.id,
    authorId: 'system',
    authorName: 'Motor de Rotación',
    authorRole: 'sistema',
    type: reason === 'initial_assignment' || reason === 'requested_by_vendor' ? 'sistema' : reason === 'reopened_after_closure' ? 'reapertura' : 'rotacion',
    text: commentText,
    createdAt: nowIso,
  };

  const updatedLead: Lead = {
    ...lead,
    currentVendorId: targetVendor.id,
    currentVendorName: targetVendor.name,
    currentSupervisorName: targetVendor.supervisor,
    status: reason === 'reopened_after_closure' ? 'reopened' : 'pending_contact',
    assignedAt: nowIso,
    hasContacted: false,
    firstGestionAt: null,
    contactDeadline,
    activeTaskDeadline: null,
    currentTask: null,
    globalClosureDeadline: globalDeadline,
    rotationCount: (lead.rotationCount || 0) + 1,
    previousVendorIds: previousVendorId ? Array.from(new Set([...(lead.previousVendorIds || []), previousVendorId])) : (lead.previousVendorIds || []),
    comments: [newComment, ...(lead.comments || [])],
  };

  const log: RotationLog = {
    id: 'rot_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    timestamp: nowIso,
    leadId: lead.id,
    leadName: lead.clientName,
    brand: lead.brand,
    fromVendorId: previousVendorId,
    fromVendorName: previousVendorName,
    toVendorId: targetVendor.id,
    toVendorName: targetVendor.name,
    reason,
    notes,
  };

  return { lead: updatedLead, log };
}

/**
 * Checks all active leads against SLA rules:
 * Rule 1: 30 minutes without contact -> rotates to another vendor of the same brand
 * Rule 2: In contact without next task within 5 hours -> rotates to another vendor of the same brand
 * Rule 3: 10 full days SLA warning/closure
 */
export function evaluateLeadSLA(
  lead: Lead,
  vendors: Vendor[],
  allActiveLeads: Lead[],
  now = new Date()
): RotationResult {
  const nowMs = now.getTime();

  // If already won or unassigned, no rotation check needed
  if (lead.status === 'closed_won' || lead.status === 'expired_unassigned' || !lead.currentVendorId) {
    return { updatedLead: lead, reassigned: false, message: 'Lead en estado inactivo o cerrado' };
  }

  // Check supervisor team restriction if applicable
  const restrictedSupervisor = lead.restrictedSupervisor || null;

  // RULE 1: 30 Minutes without first gestion
  if (!lead.hasContacted) {
    const deadlineMs = new Date(lead.contactDeadline).getTime();
    if (nowMs > deadlineMs) {
      // Rotate!
      const currentVendor = vendors.find((v) => v.id === lead.currentVendorId);
      const nextVendor = findBestVendorForBrand(
        lead.brand,
        vendors,
        allActiveLeads,
        [lead.currentVendorId],
        restrictedSupervisor
      );

      if (nextVendor) {
        const { lead: rotatedLead, log } = assignLeadToVendor(
          lead,
          nextVendor,
          'timeout_30m',
          `Venció el plazo de 30 minutos sin gestión por ${currentVendor?.name || 'asesor'}`,
          now.toISOString()
        );
        return {
          updatedLead: rotatedLead,
          rotationLog: log,
          reassigned: true,
          message: `Dato rotado a ${nextVendor.name} por vencimiento de 30 minutos.`,
        };
      } else {
        // No other vendor available for this brand right now
        return {
          updatedLead: {
            ...lead,
            status: 'expired_unassigned',
            comments: [
              {
                id: 'cmt_' + Date.now(),
                leadId: lead.id,
                authorId: 'system',
                authorName: 'Motor de Rotación',
                authorRole: 'sistema',
                type: 'rotacion',
                text: `Alerta: Venció plazo de 30m para ${currentVendor?.name || 'asesor'} pero no hay otros asesores activos con cupo disponible para la marca ${lead.brand}${restrictedSupervisor ? ` en el equipo de ${restrictedSupervisor}` : ''}.`,
                createdAt: now.toISOString(),
              },
              ...lead.comments,
            ],
          },
          reassigned: false,
          message: `Plazo de 30m vencido sin asesores alternativos disponibles para la marca ${lead.brand}.`,
        };
      }
    }
  }

  // RULE 2: If contacted, vendor must keep it by scheduling next task within <= 5 hours
  if (lead.hasContacted && (lead.status === 'in_progress' || lead.status === 'reopened')) {
    // If task is scheduled and overdue
    if (lead.activeTaskDeadline) {
      const taskDeadlineMs = new Date(lead.activeTaskDeadline).getTime();
      if (nowMs > taskDeadlineMs && (!lead.currentTask || !lead.currentTask.completed)) {
        // Exceeded 5 hours without task resolution/rescheduling
        const currentVendor = vendors.find((v) => v.id === lead.currentVendorId);
        const nextVendor = findBestVendorForBrand(
          lead.brand,
          vendors,
          allActiveLeads,
          [lead.currentVendorId],
          restrictedSupervisor
        );

        if (nextVendor) {
          const { lead: rotatedLead, log } = assignLeadToVendor(
            lead,
            nextVendor,
            'timeout_5h_task',
            `Venció el plazo de 5 horas sin cumplimiento de tarea programada por ${currentVendor?.name || 'asesor'}`,
            now.toISOString()
          );
          return {
            updatedLead: rotatedLead,
            rotationLog: log,
            reassigned: true,
            message: `Dato rotado a ${nextVendor.name} por plazo de 5h sin seguimiento.`,
          };
        }
      }
    } else if (lead.firstGestionAt) {
      // Has contacted, but never scheduled a task within 5 hours of first gestion
      const firstGestionMs = new Date(lead.firstGestionAt).getTime();
      const fiveHoursMs = firstGestionMs + 5 * 60 * 60 * 1000;
      if (nowMs > fiveHoursMs) {
        const currentVendor = vendors.find((v) => v.id === lead.currentVendorId);
        const nextVendor = findBestVendorForBrand(
          lead.brand,
          vendors,
          allActiveLeads,
          [lead.currentVendorId],
          restrictedSupervisor
        );

        if (nextVendor) {
          const { lead: rotatedLead, log } = assignLeadToVendor(
            lead,
            nextVendor,
            'timeout_5h_task',
            `Pasaron más de 5 horas desde la primera gestión sin programar próxima tarea`,
            now.toISOString()
          );
          return {
            updatedLead: rotatedLead,
            rotationLog: log,
            reassigned: true,
            message: `Dato rotado a ${nextVendor.name} por no programar tarea en 5 horas.`,
          };
        }
      }
    }
  }

  return { updatedLead: lead, reassigned: false, message: 'En plazo SLA normal' };
}

/**
 * Handles closing a lead by a vendor.
 * - If outcome === 'venta': Closed Won permanently!
 * - If outcome in non-sale reasons ('dato_erroneo', 'ya_compro_en_otro_lado', 'ya_es_cliente_nuestro', 'otro'):
 *   Lead is immediately REOPENED, vendor's note is attached as mandatory comment,
 *   and it is rotated to another vendor who works the same brand!
 */
export function processLeadClosure(
  lead: Lead,
  vendor: Vendor,
  outcome: ClosureOutcome,
  notes: string,
  vendors: Vendor[],
  allActiveLeads: Lead[],
  now = new Date()
): { updatedLead: Lead; rotationLog?: RotationLog; reopened: boolean } {
  const nowIso = now.toISOString();

  // If WON:
  if (outcome === 'venta') {
    const closureComment: LeadComment = {
      id: 'cmt_' + Date.now(),
      leadId: lead.id,
      authorId: vendor.id,
      authorName: vendor.name,
      authorRole: 'vendedor',
      type: 'cierre',
      text: `¡VENTA CONFIRMADA! Lead cerrado exitosamente por ${vendor.name} (${vendor.brand}). ${notes ? `Nota: "${notes}"` : ''}`,
      createdAt: nowIso,
    };

    const updatedLead: Lead = {
      ...lead,
      status: 'closed_won',
      closure: {
        closedByVendorId: vendor.id,
        closedByVendorName: vendor.name,
        closedAt: nowIso,
        outcome: 'venta',
        notes: notes || 'Venta realizada con éxito',
        wasReopened: false,
      },
      comments: [closureComment, ...lead.comments],
    };

    return { updatedLead, reopened: false };
  }

  // NON-SALE CLOSURE -> AUTOMATIC REOPENING & ROTATION!
  const closureRecord = {
    closedByVendorId: vendor.id,
    closedByVendorName: vendor.name,
    closedAt: nowIso,
    outcome,
    notes: notes || 'Sin notas adicionales',
    wasReopened: true,
    reopenedAt: nowIso,
  };

  const explanationComment: LeadComment = {
    id: 'cmt_' + Date.now() + '_closure',
    leadId: lead.id,
    authorId: vendor.id,
    authorName: vendor.name,
    authorRole: 'vendedor',
    type: 'reapertura',
    text: `Cierre no-venta por ${vendor.name}: [Motivo: ${getOutcomeLabel(outcome)}]. Anexo: "${notes}". Este dato se reabre para reintento por otro asesor de ${lead.brand}.`,
    createdAt: nowIso,
  };

  // Find another vendor of the same brand, strictly excluding this closing vendor!
  const nextVendor = findBestVendorForBrand(
    lead.brand,
    vendors,
    allActiveLeads,
    [vendor.id],
    lead.restrictedSupervisor
  );

  if (nextVendor) {
    const contactDeadline = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

    const reassignmentComment: LeadComment = {
      id: 'cmt_' + Date.now() + '_reassign',
      leadId: lead.id,
      authorId: 'system',
      authorName: 'Motor de Rotación',
      authorRole: 'sistema',
      type: 'reapertura',
      text: `Dato reabierto y reasignado a ${nextVendor.name} (${nextVendor.brand}) para un nuevo abordaje comercial. Plazo: 30 minutos.`,
      createdAt: nowIso,
    };

    const rotationLog: RotationLog = {
      id: 'rot_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      timestamp: nowIso,
      leadId: lead.id,
      leadName: lead.clientName,
      brand: lead.brand,
      fromVendorId: vendor.id,
      fromVendorName: vendor.name,
      toVendorId: nextVendor.id,
      toVendorName: nextVendor.name,
      reason: 'reopened_after_closure',
      notes: `Reabierto tras cierre [${getOutcomeLabel(outcome)}]: "${notes}"`,
    };

    const updatedLead: Lead = {
      ...lead,
      status: 'reopened',
      currentVendorId: nextVendor.id,
      currentVendorName: nextVendor.name,
      currentSupervisorName: nextVendor.supervisor,
      assignedAt: nowIso,
      hasContacted: false,
      firstGestionAt: null,
      contactDeadline,
      activeTaskDeadline: null,
      currentTask: null,
      rotationCount: (lead.rotationCount || 0) + 1,
      previousVendorIds: Array.from(new Set([...(lead.previousVendorIds || []), vendor.id])),
      closure: {
        ...closureRecord,
        reassignedToVendorId: nextVendor.id,
        reassignedToVendorName: nextVendor.name,
      },
      closureHistory: [...(lead.closureHistory || []), closureRecord],
      comments: [reassignmentComment, explanationComment, ...lead.comments],
    };

    return { updatedLead, rotationLog, reopened: true };
  } else {
    // No other vendor available for this brand
    const updatedLead: Lead = {
      ...lead,
      status: 'expired_unassigned',
      currentVendorId: null,
      currentVendorName: null,
      closure: closureRecord,
      closureHistory: [...(lead.closureHistory || []), closureRecord],
      comments: [
        {
          id: 'cmt_' + Date.now() + '_no_vendor',
          leadId: lead.id,
          authorId: 'system',
          authorName: 'Motor de Rotación',
          authorRole: 'sistema',
          type: 'sistema',
          text: `Dato reabierto pero quedó en cola pendiente: no hay otro asesor activo disponible para la marca ${lead.brand}${lead.restrictedSupervisor ? ` en el equipo de ${lead.restrictedSupervisor}` : ''}.`,
          createdAt: nowIso,
        },
        explanationComment,
        ...lead.comments,
      ],
    };

    return { updatedLead, reopened: true };
  }
}

export function getOutcomeLabel(outcome: ClosureOutcome): string {
  switch (outcome) {
    case 'venta':
      return 'Venta Confirmada';
    case 'dato_erroneo':
      return 'Dato Erróneo';
    case 'ya_compro_en_otro_lado':
      return 'Ya compró en otro lado';
    case 'ya_es_cliente_nuestro':
      return 'Ya es cliente nuestro';
    case 'otro':
      return 'Otro Motivo';
    default:
      return outcome;
  }
}
