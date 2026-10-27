import React from 'react';
import { Lead, Vendor } from '../types/crm';
import { LiveTimer } from './LiveTimers';
import { MessageSquare, Phone, Clock, FileText, CheckCircle2, RotateCw, AlertTriangle, User, Award, ArrowRight } from 'lucide-react';

interface LeadRowProps {
  lead: Lead;
  onOpenDetail: (lead: Lead) => void;
  onOpenTaskModal: (lead: Lead) => void;
  onOpenClosureModal: (lead: Lead) => void;
  onWhatsAppClick: (lead: Lead) => void;
  onCallClick: (lead: Lead) => void;
}

export const LeadRow: React.FC<LeadRowProps> = ({
  lead,
  onOpenDetail,
  onOpenTaskModal,
  onOpenClosureModal,
  onWhatsAppClick,
  onCallClick,
}) => {
  const isWon = lead.status === 'closed_won';
  const isReopened = lead.status === 'reopened';
  const isUnassigned = lead.status === 'expired_unassigned' || !lead.currentVendorId;
  const isPendingContact = !lead.hasContacted && !isWon && !isUnassigned;

  // Latest comment preview (especially helpful if reopened)
  const lastComment = lead.comments && lead.comments[0];

  return (
    <tr className="hover:bg-slate-50/80 transition-colors group">
      {/* Lead info: Name, ID Fox, Phone */}
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpenDetail(lead)}
            className="font-bold text-slate-900 hover:text-blue-600 transition-colors text-left"
          >
            {lead.clientName}
          </button>
          {isReopened && (
            <span
              className="text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded flex items-center gap-1"
              title="Reabierto tras cierre previo no-venta"
            >
              <RotateCw className="w-2.5 h-2.5 animate-spin-reverse" />
              Reabierto
            </span>
          )}
          {isWon && (
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded flex items-center gap-1">
              <Award className="w-2.5 h-2.5 text-emerald-600" />
              Venta
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
          <span className="font-mono tabular-nums">{lead.phone || 'Sin tel'}</span>
          <span>·</span>
          <span>ID Fox: <span className="font-mono text-slate-700">{lead.foxLeadId || lead.id}</span></span>
        </div>
        {/* If reopened, show the previous reason preview */}
        {isReopened && lastComment && (
          <div className="mt-1 text-[11px] text-purple-900 bg-purple-50/70 p-1 rounded border border-purple-100 line-clamp-1">
            <strong>Anexo anterior:</strong> {lastComment.text}
          </div>
        )}
      </td>

      {/* Brand & Model */}
      <td className="py-3 px-4">
        <span className="font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded text-xs uppercase tracking-wide">
          {lead.brand}
        </span>
        <div className="text-xs text-slate-600 mt-0.5 font-medium truncate max-w-[140px]">
          {lead.modelInterest || 'Interés general'}
        </div>
      </td>

      {/* Assigned Vendor */}
      <td className="py-3 px-4">
        {lead.currentVendorName ? (
          <div>
            <div className="font-semibold text-slate-900 flex items-center gap-1 text-xs">
              <User className="w-3 h-3 text-slate-400" />
              <span>{lead.currentVendorName}</span>
            </div>
            <div className="text-[11px] text-slate-400">
              {lead.rotationCount > 0 ? `${lead.rotationCount} rotaciones` : '1ra asignación'}
            </div>
          </div>
        ) : (
          <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
            En espera de asesor
          </span>
        )}
      </td>

      {/* SLA 1: 30-Minute Contact Timer */}
      <td className="py-3 px-4">
        {isWon ? (
          <span className="text-xs text-emerald-600 font-medium">Finalizado</span>
        ) : lead.hasContacted ? (
          <div className="text-xs text-emerald-700 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Gestionado OK</span>
          </div>
        ) : (
          <LiveTimer deadline={lead.contactDeadline} type="30m" />
        )}
      </td>

      {/* SLA 2: 5-Hour Next Task Timer */}
      <td className="py-3 px-4">
        {isWon ? (
          <span className="text-xs text-slate-400">-</span>
        ) : lead.currentTask ? (
          <LiveTimer
            deadline={lead.currentTask.dueAt}
            type="5h"
            isCompleted={lead.currentTask.completed}
          />
        ) : lead.hasContacted ? (
          <span className="text-xs text-amber-600 font-semibold flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Fijar tarea (≤5h)
          </span>
        ) : (
          <span className="text-xs text-slate-400">Pendiente contacto</span>
        )}
      </td>

      {/* Actions */}
      <td className="py-3 px-4 text-right">
        <div className="flex items-center justify-end gap-1.5">
          {/* Quick WhatsApp Action (stops 30m timer!) */}
          <button
            onClick={() => onWhatsAppClick(lead)}
            title="Enviar WhatsApp y registrar primera gestión"
            className="p-1.5 text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>

          {/* Quick Call */}
          <button
            onClick={() => onCallClick(lead)}
            title="Registrar llamada realizada"
            className="p-1.5 text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors"
          >
            <Phone className="w-3.5 h-3.5" />
          </button>

          {!isWon && (
            <>
              {/* Schedule Task <= 5h */}
              <button
                onClick={() => onOpenTaskModal(lead)}
                title="Agendar próxima tarea (obligatorio en ≤ 5 horas para retener)"
                className="p-1.5 text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg transition-colors"
              >
                <Clock className="w-3.5 h-3.5" />
              </button>

              {/* Close lead */}
              <button
                onClick={() => onOpenClosureModal(lead)}
                title="Cerrar lead (Venta o motivo con reapertura automática)"
                className="px-2 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cerrar
              </button>
            </>
          )}

          {/* View comments & details */}
          <button
            onClick={() => onOpenDetail(lead)}
            title="Ver ficha completa y comentarios"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
};
