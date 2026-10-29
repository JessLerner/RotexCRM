import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { VendorsBar } from './components/VendorsBar';
import { VendorsTable } from './components/VendorsTable';
import { LeadsBoard } from './components/LeadsBoard';
import { RotationLogsView } from './components/RotationLogsView';
import { LeadDetailModal } from './components/LeadDetailModal';
import { TaskModal } from './components/TaskModal';
import { ClosureModal } from './components/ClosureModal';
import { GoogleSheetSyncModal } from './components/GoogleSheetSyncModal';
import { FoxCrmImportModal } from './components/FoxCrmImportModal';
import { ToastContainer } from './components/ToastContainer';
import { VendorDashboard } from './components/VendorDashboard';
import { SupervisorDashboard } from './components/SupervisorDashboard';
import { GerenciaDashboard } from './components/GerenciaDashboard';
import { RankingsView } from './components/RankingsView';
import { AuthScreen } from './components/AuthScreen';
import { InviteSellerModal } from './components/InviteSellerModal';
import { NoResponseModal } from './components/NoResponseModal';
import { ManageVendorModal } from './components/ManageVendorModal';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { importFoxLeads } from './services/foxImportRepository';
import { loadRoster } from './services/rosterRepository';
import { loadStructureOptions, MemberStructure, retireMember, setMemberStatus, StructureBrand, StructureSupervisor, updateMemberStructure } from './services/structureRepository';
import {
  closeMyLead,
  fillRotationCupos,
  loadOperationalLeads,
  loadOperationalMetrics,
  OperationalMetrics,
  processDueRotations,
  registerNoResponse,
  requestNextLead,
  rotateMyLead,
  saveFollowUp,
} from './services/leadRepository';

import {
  Lead,
  Vendor,
  RotationLog,
  GoogleSheetConfig,
  VendorStatus,
  ClosureOutcome,
  ScheduledTask,
  UserSession,
} from './types/crm';
import {
  getStoredLeads,
  saveStoredLeads,
  getStoredVendors,
  saveStoredVendors,
  getStoredRotationLogs,
  saveStoredRotationLogs,
  getStoredSheetConfig,
  saveStoredSheetConfig,
  subscribeToSync,
} from './services/storageService';
import { processLeadClosure, getOutcomeLabel, assignLeadToVendor } from './utils/rotationEngine';
import { sendLeadPushNotification } from './utils/pushNotifications';
import { playSaleFanfare, playAssignChime } from './utils/soundAlerts';

export default function App() {
  // Until Supabase resolves the session, the application exposes no CRM data.
  const [currentSession, setCurrentSession] = useState<UserSession>({
    id: '',
    name: '',
    role: 'vendedor',
  });
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [passwordSetup, setPasswordSetup] = useState(() => /type=(invite|recovery)/.test(window.location.hash));

  const [activeTab, setActiveTab] = useState<string>('leads');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [operationalMetrics, setOperationalMetrics] = useState<OperationalMetrics>({ total: 0, queued: 0, review: 0, assigned: 0, in_progress: 0, closed_won: 0, closed_lost: 0 });
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [rotationLogs, setRotationLogs] = useState<RotationLog[]>([]);
  const [sheetConfig, setSheetConfig] = useState<GoogleSheetConfig>(getStoredSheetConfig());

  // Filter states
  const [currentVendorFilter, setCurrentVendorFilter] = useState<string>('all');
  const [vendorStatusFilter, setVendorStatusFilter] = useState<'all' | VendorStatus>('all');
  const [vendorVolumeFilter, setVendorVolumeFilter] = useState<'all' | 'available' | 'full' | 'zero'>('all');
  const [vendorBrandFilter, setVendorBrandFilter] = useState<string>('all');
  const [vendorSearchQuery, setVendorSearchQuery] = useState<string>('');

  // Modals
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isInviteSellerOpen, setIsInviteSellerOpen] = useState(false);
  const [selectedLeadForDetail, setSelectedLeadForDetail] = useState<Lead | null>(null);
  const [selectedLeadForTask, setSelectedLeadForTask] = useState<Lead | null>(null);
  const [selectedLeadForClosure, setSelectedLeadForClosure] = useState<Lead | null>(null);
  const [selectedLeadForNoResponse, setSelectedLeadForNoResponse] = useState<Lead | null>(null);
  const [vendorToManage, setVendorToManage] = useState<Vendor | null>(null);
  const [structureSupervisors, setStructureSupervisors] = useState<StructureSupervisor[]>([]);
  const [structureBrands, setStructureBrands] = useState<StructureBrand[]>([]);
  const [memberStructures, setMemberStructures] = useState<Map<string, { reports_to: string | null; capacity: number; daily_target?: number }>>(new Map());
  const [memberBrandNames, setMemberBrandNames] = useState<Map<string, string[]>>(new Map());

  const refreshRoster = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const roster = await loadRoster();
    setVendors(roster);
  }, []);
  const refreshOperationalData = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const [operationalLeads, metrics] = await Promise.all([loadOperationalLeads(), loadOperationalMetrics()]);
    setLeads(operationalLeads);
    setOperationalMetrics(metrics);
  }, []);
  const refreshStructureOptions = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const options = await loadStructureOptions();
    setStructureSupervisors(options.supervisors);
    setStructureBrands(options.brands);
    setMemberStructures(options.memberships);
    setMemberBrandNames(options.brandNames);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthLoading(false);
      return;
    }

    const loadProfile = async (userId: string) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, role, status')
        .eq('id', userId)
        .maybeSingle();
      if (error || !data || data.status !== 'active') {
        await supabase.auth.signOut();
        setAuthError(error?.message || 'Tu cuenta no está habilitada para usar Rotex.');
        setAuthLoading(false);
        return;
      }
      setCurrentSession({ id: data.id, name: data.display_name, role: data.role, vendorId: data.role === 'vendedor' ? data.id : undefined, supervisorName: data.role === 'supervisor' ? data.display_name : undefined });
      // A session may be restored after a different role was used. Always land on a valid
      // first view for the authenticated role instead of rendering an empty viewport.
      setActiveTab(data.role === 'vendedor' ? 'assigned' : data.role === 'supervisor' ? 'monitoring' : data.role === 'gerencia' ? 'metrics' : 'leads');
      setAuthError(null);
      setAuthLoading(false);
    };

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void loadProfile(data.session.user.id);
      else setAuthLoading(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || /type=(invite|recovery)/.test(window.location.hash)) setPasswordSetup(true);
      if (session) void loadProfile(session.user.id);
      else {
        setCurrentSession({ id: '', name: '', role: 'vendedor' });
        setAuthLoading(false);
      }
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  // Load state from local storage & server
  const reloadState = useCallback(() => {
    const loadedLeads = getStoredLeads();
    const loadedVendors = isSupabaseConfigured ? [] : getStoredVendors();
    const loadedLogs = getStoredRotationLogs();
    const loadedConfig = getStoredSheetConfig();

    // Recompute live active assignments for each vendor
    const counts = new Map<string, number>();
    loadedLeads.forEach((l) => {
      if (l.currentVendorId && (l.status === 'pending_contact' || l.status === 'in_progress' || l.status === 'reopened')) {
        counts.set(l.currentVendorId, (counts.get(l.currentVendorId) || 0) + 1);
      }
    });

    const updatedVendors = loadedVendors.map((v) => ({
      ...v,
      activeAssignments: counts.get(v.id) || 0,
    }));

    if (!isSupabaseConfigured) setLeads(loadedLeads);
    if (!isSupabaseConfigured) setVendors(updatedVendors);
    setRotationLogs(loadedLogs);
    setSheetConfig(loadedConfig);

    // Keep selected lead synced if detail modal is open
    if (selectedLeadForDetail) {
      const fresh = loadedLeads.find((l) => l.id === selectedLeadForDetail.id);
      if (fresh) setSelectedLeadForDetail(fresh);
    }
  }, [selectedLeadForDetail]);

  // Temporary local view refresh while each dashboard repository is migrated.
  // Supabase Realtime replaces the removed unauthenticated SSE endpoint.
  useEffect(() => {
    reloadState();
    const unsub = subscribeToSync(reloadState);
    return unsub;
  }, [reloadState]);

  // Personnel is always loaded from Supabase. This deliberately replaces the old demo roster.
  useEffect(() => {
    if (!currentSession.id || !isSupabaseConfigured) return;
    refreshRoster().catch((error) => console.error('No se pudo cargar la nómina:', error));
  }, [currentSession.id, refreshRoster]);

  useEffect(() => {
    if (!currentSession.id || !isSupabaseConfigured) return;
    refreshStructureOptions().catch((error) => console.error('No se pudieron cargar opciones de estructura:', error));
  }, [currentSession.id, refreshStructureOptions]);

  useEffect(() => {
    if (!currentSession.id || !isSupabaseConfigured) return;
    const initialiseOperationalQueue = async () => {
      // Management profiles seed each active seller to its daily target. This is server-side,
      // idempotent, and also distributes records that were imported before this feature existed.
      await processDueRotations();
      if (currentSession.role !== 'vendedor') {
        await fillRotationCupos();
        await refreshRoster();
      }
      await refreshOperationalData();
    };
    initialiseOperationalQueue().catch((error) => console.error('No se pudo cargar la operación:', error));
  }, [currentSession.id, currentSession.role, refreshOperationalData]);

  // A connected Rotex session checks expired operational deadlines every minute. The database
  // function is idempotent and locks records, so multiple open sessions cannot rotate a lead twice.
  useEffect(() => {
    if (!currentSession.id || !isSupabaseConfigured) return;
    const timer = window.setInterval(() => {
      processDueRotations()
        .then((rotated) => rotated > 0 ? Promise.all([refreshOperationalData(), refreshRoster()]) : undefined)
        .catch((error) => console.error('No se pudieron procesar rotaciones vencidas:', error));
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [currentSession.id, refreshOperationalData, refreshRoster]);

  // WhatsApp click handler
  const handleWhatsAppClick = (lead: Lead) => {
    const cleanPhone = (lead.phone || '').replace(/[^0-9]/g, '');
    const greeting = encodeURIComponent(
      `Hola ${lead.clientName}, ¿cómo estás? Te contacto de la concesionaria oficial ${lead.brand} respecto a tu consulta por el ${lead.modelInterest || 'vehículo'}. ¿Seguís interesado/a en la entrega inmediata o financiación?`
    );

    const waUrl = `https://wa.me/${cleanPhone}?text=${greeting}`;
    window.open(waUrl, '_blank');
  };

  // Call click handler
  const handleCallClick = (lead: Lead) => {
    window.location.href = `tel:${(lead.phone || '').replace(/[^0-9+]/g, '')}`;
  };

  // Schedule Next Task (enforces <= 5 hours)
  const handleScheduleTask = async (taskData: Omit<ScheduledTask, 'id' | 'createdAt' | 'completed'>) => {
    if (!selectedLeadForTask) return;

    if (isSupabaseConfigured) {
      const minutes = Math.max(15, Math.min(300, Math.round((new Date(taskData.dueAt).getTime() - Date.now()) / 60000)));
      try {
        await saveFollowUp(selectedLeadForTask.id, taskData.description, taskData.type, minutes);
        await refreshOperationalData();
        await refreshRoster();
        setSelectedLeadForTask(null);
      } catch (error: any) {
        window.alert(`No se pudo programar la tarea: ${error.message}`);
      }
      return;
    }

    const lead = selectedLeadForTask;
    const nowIso = new Date().toISOString();
    const currentVendor = vendors.find((v) => v.id === lead.currentVendorId);

    const newTask: ScheduledTask = {
      id: 'tsk_' + Date.now(),
      description: taskData.description,
      type: taskData.type,
      dueAt: taskData.dueAt,
      createdAt: nowIso,
      completed: false,
    };

    const dueFormatted = new Date(taskData.dueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const taskComment = {
      id: 'cmt_' + Date.now(),
      leadId: lead.id,
      authorId: currentVendor?.id || 'vendedor',
      authorName: currentVendor?.name || 'Asesor',
      authorRole: 'vendedor' as const,
      type: 'tarea' as const,
      text: `Próxima tarea programada [${taskData.type.toUpperCase()}]: "${taskData.description}" con vencimiento a las ${dueFormatted} (≤ 5h). Lead retenido.`,
      createdAt: nowIso,
    };

    const updatedLead: Lead = {
      ...lead,
      hasContacted: true,
      status: 'in_progress',
      activeTaskDeadline: taskData.dueAt,
      currentTask: newTask,
      comments: [taskComment, ...lead.comments],
    };

    const nextLeads = leads.map((l) => (l.id === lead.id ? updatedLead : l));
    saveStoredLeads(nextLeads);
    reloadState();

    sendLeadPushNotification(
      'Tarea Programada (Lead Retenido)',
      `Próxima tarea agendada para ${lead.clientName} a las ${dueFormatted}.`,
      'assignment'
    );

    setSelectedLeadForTask(null);
  };

  // Closure handling (Venta or Non-Sale with Automatic Reopening)
  const handleConfirmClosure = async (outcome: ClosureOutcome, notes: string) => {
    if (!selectedLeadForClosure) return;

    if (isSupabaseConfigured) {
      try {
        await closeMyLead(selectedLeadForClosure.id, outcome, notes);
        await refreshOperationalData();
        await refreshRoster();
        setSelectedLeadForClosure(null);
      } catch (error: any) {
        window.alert(`No se pudo registrar el cierre: ${error.message}`);
      }
      return;
    }

    const lead = selectedLeadForClosure;
    const currentVendor = vendors.find((v) => v.id === lead.currentVendorId);
    if (!currentVendor) return;

    const { updatedLead, rotationLog, reopened } = processLeadClosure(
      lead,
      currentVendor,
      outcome,
      notes,
      vendors,
      leads
    );

    let nextLeads = leads.map((l) => (l.id === lead.id ? updatedLead : l));

    let nextVendors = vendors;
    if (outcome === 'venta') {
      nextVendors = vendors.map((v) =>
        v.id === currentVendor.id ? { ...v, totalConversions: (v.totalConversions || 0) + 1 } : v
      );
      playSaleFanfare();
      sendLeadPushNotification(
        '¡VENTA CONFIRMADA!',
        `${currentVendor.name} cerró la venta de ${lead.clientName} (${lead.brand} ${lead.modelInterest})`,
        'sale'
      );
    } else if (reopened && rotationLog) {
      saveStoredRotationLogs([rotationLog, ...rotationLogs]);
      sendLeadPushNotification(
        'Dato Reabierto y Rotado',
        `Lead ${lead.clientName} se cerró como [${getOutcomeLabel(outcome)}]. Reabierto y asignado a ${rotationLog.toVendorName} (${lead.brand}).`,
        'reopened'
      );
    }

    saveStoredLeads(nextLeads);
    saveStoredVendors(nextVendors);
    reloadState();
    setSelectedLeadForClosure(null);
  };

  // Add comment to lead thread
  const handleAddComment = (leadId: string, text: string) => {
    const targetLead = leads.find((l) => l.id === leadId);
    if (!targetLead) return;

    const currentVendor = vendors.find((v) => v.id === targetLead.currentVendorId);
    const newComment = {
      id: 'cmt_' + Date.now(),
      leadId,
      authorId: currentSession.id,
      authorName: currentSession.name,
      authorRole: currentSession.role,
      type: 'comentario' as const,
      text,
      createdAt: new Date().toISOString(),
    };

    const updatedLead: Lead = {
      ...targetLead,
      comments: [newComment, ...targetLead.comments],
    };

    const nextLeads = leads.map((l) => (l.id === leadId ? updatedLead : l));
    saveStoredLeads(nextLeads);
    reloadState();
  };

  // Toggle vendor activity status (Activo, Pausa, Inactivo)
  const handleToggleVendorStatus = async (vendorId: string, currentStatus: VendorStatus) => {
    let nextStatus: VendorStatus = 'active';
    if (currentStatus === 'active') nextStatus = 'paused';
    else if (currentStatus === 'paused') nextStatus = 'inactive';
    else nextStatus = 'active';

    if (isSupabaseConfigured) {
      try {
        const result = await setMemberStatus(vendorId, nextStatus);
        if (nextStatus !== 'active') await fillRotationCupos();
        await Promise.all([refreshRoster(), refreshOperationalData(), refreshStructureOptions()]);
        if (result.released_leads > 0) window.alert(`Se liberaron ${result.released_leads} dato(s) para rotación.`);
      } catch (error: any) {
        window.alert(`No se pudo actualizar el estado: ${error.message}`);
        return;
      }
    } else {
      const updated = vendors.map((v) => (v.id === vendorId ? { ...v, status: nextStatus } : v));
      saveStoredVendors(updated);
      reloadState();
    }

    sendLeadPushNotification(
      'Estado de Asesor Actualizado',
      `Asesor ${vendors.find((v) => v.id === vendorId)?.name} ahora en estado: ${
        nextStatus === 'active' ? 'Activo' : nextStatus === 'paused' ? 'En Pausa' : 'Inactivo'
      }`,
      'info'
    );
  };

  const getInitialStructure = (vendor: Vendor): MemberStructure | null => {
    const membership = memberStructures.get(vendor.id);
    if (!membership) return null;
    const names = memberBrandNames.get(vendor.id) || [];
    return {
      supervisorId: membership.reports_to || '',
      brandIds: structureBrands.filter((brand) => names.includes(brand.name)).map((brand) => brand.id),
      capacity: membership.capacity || vendor.maxAssignments || 15,
      dailyTarget: membership.daily_target || 5,
    };
  };
  const handleSaveVendorStructure = async (vendorId: string, structure: MemberStructure) => {
    await updateMemberStructure(vendorId, structure);
    await fillRotationCupos();
    await Promise.all([refreshRoster(), refreshOperationalData(), refreshStructureOptions()]);
  };
  const handleRetireVendor = async (vendor: Vendor) => {
    if (!window.confirm(`¿Retirar a ${vendor.name}? Se conserva todo su historial y sus datos activos volverán a la cola.`)) return;
    try {
      await retireMember(vendor.id, 'Retiro desde control de estructura');
      await fillRotationCupos();
      await Promise.all([refreshRoster(), refreshOperationalData(), refreshStructureOptions()]);
    } catch (error: any) { window.alert(`No se pudo retirar al asesor: ${error.message}`); }
  };

  // Toggle all vendors under a supervisor
  const handleToggleSupervisorTeamStatus = async (supervisorName: string, activate: boolean) => {
    const nextStatus: VendorStatus = activate ? 'active' : 'paused';
    const teamVendorIds = vendors
      .filter((v) => v.supervisor.trim().toLowerCase() === supervisorName.trim().toLowerCase())
      .map((v) => v.id);
    if (isSupabaseConfigured) {
      try {
        await Promise.all(teamVendorIds.map((vendorId) => setMemberStatus(vendorId, nextStatus)));
        if (!activate) await fillRotationCupos();
        await Promise.all([refreshRoster(), refreshOperationalData(), refreshStructureOptions()]);
      } catch (error: any) {
        window.alert(`No se pudo actualizar el equipo: ${error.message}`);
        return;
      }
    } else {
      const updated = vendors.map((v) => teamVendorIds.includes(v.id) ? { ...v, status: nextStatus } : v);
      saveStoredVendors(updated);
      reloadState();
    }

    sendLeadPushNotification(
      'Equipo Actualizado',
      `Se ${activate ? 'activaron' : 'pausaron'} los asesores del equipo de ${supervisorName}.`,
      'info'
    );
  };

  // Add new vendor to a supervisor team
  const handleAddNewVendorToTeam = async (newVendorData: {
    name: string;
    email: string;
    maxAssignments: number;
    role?: 'vendedor' | 'supervisor';
    supervisorId?: string;
    brandIds?: string[];
    dailyTarget?: number;
  }) => {
    const { data, error } = await supabase.functions.invoke('invite-team-member', { body: newVendorData });
    if (error || data?.error) throw new Error(data?.error || error.message);
    await fillRotationCupos();
    const roster = await loadRoster();
    setVendors(roster);
    await Promise.all([refreshOperationalData(), refreshStructureOptions()]);
    sendLeadPushNotification('Invitación enviada', `${newVendorData.name} recibirá un correo para crear su contraseña.`, 'assignment');
  };

  // Update vendor capacity
  const handleUpdateVendorMaxCapacity = async (vendorId: string, newMax: number) => {
    if (isSupabaseConfigured) {
      const vendor = vendors.find((item) => item.id === vendorId);
      const current = vendor ? getInitialStructure(vendor) : null;
      if (!current) { window.alert('No se pudo obtener la estructura actual del asesor.'); return; }
      try {
        await updateMemberStructure(vendorId, { ...current, capacity: newMax });
        await Promise.all([refreshRoster(), refreshStructureOptions()]);
      } catch (error: any) { window.alert(`No se pudo actualizar la capacidad: ${error.message}`); }
      return;
    }
    const updated = vendors.map((v) => (v.id === vendorId ? { ...v, maxAssignments: newMax } : v));
    saveStoredVendors(updated);
    reloadState();
  };

  // VENDOR: Request Lead Module ("Pedir Dato")
  const handleVendorRequestLead = async (vendor: Vendor) => {
    if (isSupabaseConfigured) {
      try {
        const result = await requestNextLead();
        if (!result.assigned) window.alert(result.reason || 'En este momento no hay datos disponibles para asignar.');
        await refreshOperationalData();
        await refreshRoster();
      } catch (error: any) {
        window.alert(`No se pudo asignar el dato: ${error.message}`);
      }
      return;
    }
    // Look for an unassigned lead for this brand
    const normBrand = vendor.brand.trim().toLowerCase();
    const candidateLead = leads.find((l) => {
      const matchBrand =
        l.brand.trim().toLowerCase() === normBrand ||
        l.brand.trim().toLowerCase().includes(normBrand) ||
        normBrand.includes(l.brand.trim().toLowerCase());
      const isUnassigned = !l.currentVendorId || l.status === 'expired_unassigned';
      return matchBrand && isUnassigned;
    });

    if (candidateLead) {
      const { lead: assignedLead, log } = assignLeadToVendor(
        candidateLead,
        vendor,
        'requested_by_vendor',
        `Solicitado por ${vendor.name} (${vendor.brand})`,
        new Date().toISOString()
      );

      const nextLeads = leads.map((l) => (l.id === candidateLead.id ? assignedLead : l));
      saveStoredLeads(nextLeads);
      saveStoredRotationLogs([log, ...rotationLogs]);
      reloadState();

      playAssignChime();
      sendLeadPushNotification(
        '¡Nuevo Dato Asignado!',
        `Se te asignó el lead ${candidateLead.clientName} (${candidateLead.brand} ${candidateLead.modelInterest}). Tenés 30 minutos para gestionarlo.`,
        'assignment'
      );
    } else {
      // If none is unassigned, check if there is an uncontacted lead from an inactive vendor of the same brand
      const inactiveVendorIds = new Set(
        vendors.filter((v) => v.status === 'inactive' || v.status === 'paused').map((v) => v.id)
      );
      const reassignableLead = leads.find((l) => {
        const matchBrand =
          l.brand.trim().toLowerCase() === normBrand ||
          l.brand.trim().toLowerCase().includes(normBrand) ||
          normBrand.includes(l.brand.trim().toLowerCase());
        const isWithInactive = l.currentVendorId && inactiveVendorIds.has(l.currentVendorId) && !l.hasContacted;
        return matchBrand && isWithInactive;
      });

      if (reassignableLead) {
        const { lead: assignedLead, log } = assignLeadToVendor(
          reassignableLead,
          vendor,
          'requested_by_vendor',
          `Reasignado por solicitud de ${vendor.name} desde asesor en pausa`,
          new Date().toISOString()
        );

        const nextLeads = leads.map((l) => (l.id === reassignableLead.id ? assignedLead : l));
        saveStoredLeads(nextLeads);
        saveStoredRotationLogs([log, ...rotationLogs]);
        reloadState();

        playAssignChime();
        sendLeadPushNotification(
          '¡Dato Reasignado a tu Bandeja!',
          `Se te asignó el lead ${reassignableLead.clientName} (${reassignableLead.brand}). Tenés 30 minutos para contactarlo.`,
          'assignment'
        );
      } else {
        alert(
          'En este momento no hay datos pendientes en espera. Apenas ingrese un nuevo dato o rote por vencimiento, se te asignará automáticamente.'
        );
      }
    }
  };

  const handleNoResponse = async (afterMinutes: number, notes: string) => {
    if (!selectedLeadForNoResponse) return;
    await registerNoResponse(selectedLeadForNoResponse.id, afterMinutes, notes);
    await refreshOperationalData();
  };

  const handleRotateLead = async () => {
    if (!selectedLeadForNoResponse) return;
    await rotateMyLead(selectedLeadForNoResponse.id);
    await refreshOperationalData();
    await refreshRoster();
  };

  // A vendedor account exists in Supabase before its commercial roster is enabled.
  // Render an informative workspace instead of a blank screen in that interim state.
  const loggedVendor = vendors.find((v) => v.id === currentSession.vendorId);
  const profileVendor: Vendor | null =
    currentSession.role === 'vendedor' && !loggedVendor
      ? {
          id: currentSession.id,
          name: currentSession.name,
          supervisor: 'Pendiente de asignación',
          brand: 'Sin marca asignada',
          status: 'active',
          maxAssignments: 0,
          activeAssignments: 0,
          totalAssignedCount: 0,
          totalConversions: 0,
        }
      : null;
  const activeVendor = loggedVendor || profileVendor;
  const vendorAssignedLeads = activeVendor
    ? leads.filter((l) => l.currentVendorId === activeVendor.id)
    : [];

  const activeLeadsCount = leads.filter(
    (l) => l.status === 'pending_contact' || l.status === 'in_progress' || l.status === 'reopened'
  ).length;

  const activeVendorsCount = vendors.filter((v) => v.status === 'active').length;

  if (authLoading) return <div className="min-h-screen bg-slate-950" />;
  if (passwordSetup) return <AuthScreen error={authError} passwordSetup onPasswordUpdated={() => setPasswordSetup(false)} />;
  if (!currentSession.id) return <AuthScreen error={authError} />;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900">
      {/* Top Bar Header with Role-Based Navigation & Session Switcher */}
      <Header
        currentSession={currentSession}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeLeadsCount={activeLeadsCount}
        activeVendorsCount={activeVendorsCount}
        vendors={vendors}
      />

      {/* Main View Port according to Role */}
      <main className="flex-1">
        {/* ==================== 1. VENDEDORES VIEW ==================== */}
        {currentSession.role === 'vendedor' && activeVendor && (
          <VendorDashboard
            activeTab={activeTab === 'ranking' ? 'ranking' : 'assigned'}
            onTabChange={setActiveTab}
            currentVendor={activeVendor}
            assignedLeads={vendorAssignedLeads}
            allVendors={profileVendor ? [...vendors, profileVendor] : vendors}
            allLeads={leads}
            onOpenDetail={(lead) => setSelectedLeadForDetail(lead)}
            onOpenTaskModal={(lead) => setSelectedLeadForTask(lead)}
            onOpenClosureModal={(lead) => setSelectedLeadForClosure(lead)}
            onWhatsAppClick={handleWhatsAppClick}
            onCallClick={handleCallClick}
            onRequestLead={handleVendorRequestLead}
            onNoResponse={(lead) => setSelectedLeadForNoResponse(lead)}
            onToggleStatus={handleToggleVendorStatus}
            canReceiveLeads={Boolean(loggedVendor)}
          />
        )}

        {/* ==================== 2. SUPERVISORES VIEW ==================== */}
        {currentSession.role === 'supervisor' && (
          <SupervisorDashboard
            supervisorName={currentSession.name}
            activeTab={activeTab === 'team' || activeTab === 'rankings' ? activeTab : 'monitoring'}
            onTabChange={setActiveTab}
            vendors={vendors}
            allLeads={leads}
            metrics={operationalMetrics}
            onOpenDetail={(lead) => setSelectedLeadForDetail(lead)}
            onOpenImportModal={() => setIsImportModalOpen(true)}
            onToggleVendorStatus={handleToggleVendorStatus}
            onUpdateVendorCapacity={handleUpdateVendorMaxCapacity}
            onAddNewVendorToTeam={handleAddNewVendorToTeam}
            onWhatsAppClick={handleWhatsAppClick}
            onCallClick={handleCallClick}
          />
        )}

        {/* ==================== 3. GERENCIA VIEW ==================== */}
        {currentSession.role === 'gerencia' && (
          <GerenciaDashboard
            activeTab={activeTab === 'structure' || activeTab === 'rankings' ? activeTab : 'metrics'}
            onTabChange={setActiveTab}
            vendors={vendors}
            leads={leads}
            metrics={operationalMetrics}
            onOpenImportModal={() => setIsImportModalOpen(true)}
            onOpenInviteSeller={() => setIsInviteSellerOpen(true)}
            onToggleVendorStatus={handleToggleVendorStatus}
            onToggleSupervisorTeamStatus={handleToggleSupervisorTeamStatus}
            onOpenLeadDetail={(lead) => setSelectedLeadForDetail(lead)}
            onManageVendor={(vendor) => setVendorToManage(vendor)}
          />
        )}

        {/* ==================== 4. ADMINISTRACIÓN VIEW ==================== */}
        {currentSession.role === 'administracion' && (
          <>
            {activeTab === 'leads' && (
              <LeadsBoard
                leads={leads}
                vendors={vendors}
                currentVendorFilter={currentVendorFilter}
                onOpenDetail={(lead) => setSelectedLeadForDetail(lead)}
                onOpenTaskModal={(lead) => setSelectedLeadForTask(lead)}
                onOpenClosureModal={(lead) => setSelectedLeadForClosure(lead)}
                onWhatsAppClick={handleWhatsAppClick}
                onCallClick={handleCallClick}
                onOpenImportModal={() => setIsImportModalOpen(true)}
                onOpenSyncModal={() => setIsSyncModalOpen(true)}
              />
            )}

            {activeTab === 'vendors' && (
              <div className="space-y-4">
                <VendorsBar
                  vendors={vendors}
                  statusFilter={vendorStatusFilter}
                  setStatusFilter={setVendorStatusFilter}
                  volumeFilter={vendorVolumeFilter}
                  setVolumeFilter={setVendorVolumeFilter}
                  brandFilter={vendorBrandFilter}
                  setBrandFilter={setVendorBrandFilter}
                  searchQuery={vendorSearchQuery}
                  setSearchQuery={setVendorSearchQuery}
                  onOpenSyncModal={() => setIsSyncModalOpen(true)}
                  onToggleStatus={handleToggleVendorStatus}
                  onAddManualVendor={() => setIsInviteSellerOpen(true)}
                />
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
                  <VendorsTable
                    vendors={vendors}
                    onToggleStatus={handleToggleVendorStatus}
                    onUpdateMaxCapacity={handleUpdateVendorMaxCapacity}
                    onManageVendor={(vendor) => setVendorToManage(vendor)}
                    onDeleteVendor={(vendorId) => { const vendor = vendors.find((item) => item.id === vendorId); if (vendor) void handleRetireVendor(vendor); }}
                    onOpenSyncModal={() => setIsSyncModalOpen(true)}
                  />
                </div>
              </div>
            )}

            {activeTab === 'rankings' && (
              <RankingsView vendors={vendors} leads={leads} showSupervisorRanking={true} />
            )}

            {activeTab === 'history' && (
              <RotationLogsView
                logs={rotationLogs}
                onSelectLead={(leadId) => {
                  const lead = leads.find((l) => l.id === leadId);
                  if (lead) {
                    setSelectedLeadForDetail(lead);
                  }
                }}
              />
            )}
          </>
        )}
      </main>

      {/* Floating Push Toast Alerts */}
      <ToastContainer />

      {/* Modals */}
      {selectedLeadForDetail && (
        <LeadDetailModal
          lead={selectedLeadForDetail}
          isOpen={true}
          onClose={() => setSelectedLeadForDetail(null)}
          onAddComment={handleAddComment}
          onOpenTaskModal={() => {
            setSelectedLeadForTask(selectedLeadForDetail);
            setSelectedLeadForDetail(null);
          }}
          onOpenClosureModal={() => {
            setSelectedLeadForClosure(selectedLeadForDetail);
            setSelectedLeadForDetail(null);
          }}
          onDirectWhatsApp={handleWhatsAppClick}
          onDirectCall={handleCallClick}
          currentVendor={vendors.find((v) => v.id === selectedLeadForDetail.currentVendorId)}
        />
      )}

      {selectedLeadForTask && (
        <TaskModal
          lead={selectedLeadForTask}
          isOpen={true}
          onClose={() => setSelectedLeadForTask(null)}
          onScheduleTask={handleScheduleTask}
        />
      )}

      {selectedLeadForClosure && (
        <ClosureModal
          lead={selectedLeadForClosure}
          isOpen={true}
          onClose={() => setSelectedLeadForClosure(null)}
          onConfirmClosure={handleConfirmClosure}
        />
      )}

      {selectedLeadForNoResponse && (
        <NoResponseModal
          lead={selectedLeadForNoResponse}
          isOpen={true}
          onClose={() => setSelectedLeadForNoResponse(null)}
          onConfirm={handleNoResponse}
          onRotate={handleRotateLead}
        />
      )}

      <ManageVendorModal
        vendor={vendorToManage}
        supervisors={structureSupervisors}
        brands={structureBrands}
        initial={vendorToManage ? getInitialStructure(vendorToManage) : null}
        onClose={() => setVendorToManage(null)}
        onSave={handleSaveVendorStructure}
      />

      {isSyncModalOpen && (
        <GoogleSheetSyncModal
          isOpen={isSyncModalOpen}
          onClose={() => setIsSyncModalOpen(false)}
          config={sheetConfig}
          onSuccess={(newVendors) => {
            setVendors(newVendors);
            reloadState();
          }}
        />
      )}

      {isImportModalOpen && (
        <FoxCrmImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          currentUserRole={currentSession.role}
          currentSupervisorName={currentSession.supervisorName}
          currentStructure={currentSession.structure}
          onImportLeads={async (rows) => {
            const result = await importFoxLeads('fox-crm.csv', rows);
            await fillRotationCupos();
            await refreshOperationalData();
            await refreshRoster();
            return result;
          }}
        />
      )}
      <InviteSellerModal isOpen={isInviteSellerOpen} onClose={() => setIsInviteSellerOpen(false)} onInvite={handleAddNewVendorToTeam} supervisors={structureSupervisors} brands={structureBrands} canChooseStructure={currentSession.role === 'administracion' || currentSession.role === 'gerencia'} />
    </div>
  );
}
