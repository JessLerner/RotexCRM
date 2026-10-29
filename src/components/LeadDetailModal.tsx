import React, { useState } from 'react';
import { X, MessageSquare, Phone, Send, Clock, User, Calendar, AlertCircle, History, RotateCw, CheckCircle2, Award } from 'lucide-react';
import { Lead, LeadComment, Vendor } from '../types/crm';
import { LiveTimer } from './LiveTimers';
import { getOutcomeLabel } from '../utils/rotationEngine';

interface LeadDetailModalProps {
  lead: Lead;
  isOpen: boolean;
  onClose: () => void;
  onAddComment: (leadId: string, text: string) => void;
  onOpenTaskModal: () => void;
  onOpenClosureModal: () => void;
  onDirectWhatsApp: (lead: Lead) => void;
  onDirectCall: (lead: Lead) => void;
  currentVendor?: Vendor | null;
}

export const LeadDetailModal: React.FC<LeadDetailModalProps> = ({
  lead,
  isOpen,
  onClose,
  onAddComment,
  onOpenTaskModal,
  onOpenClosureModal,
  onDirectWhatsApp,
  onDirectCall,
  currentVendor,
}) => {
  const [commentText, setCommentText] = useState('');

  if (!isOpen) return null;

  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    onAddComment(lead.id, commentText.trim());
    setCommentText('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-900">{lead.clientName}</h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800 uppercase tracking-wide">
                {lead.brand}
              </span>
              {lead.status === 'reopened' && (
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-amber-100 text-amber-800 flex items-center gap-1">
                  <RotateCw className="w-3 h-3 animate-spin-reverse" />
                  Reabierto
                </span>
              )}
              {lead.status === 'closed_won' && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 flex items-center gap-1">
                  <Award className="w-3 h-3 text-emerald-600" />
                  Venta Confirmada
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
              <span>Interés: <strong>{lead.modelInterest || 'Vehículo ' + lead.brand}</strong></span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body (Scrollable) */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1">
          {/* Top Info Bar: Contact & Fast Actions */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs text-slate-500 font-medium">Datos de Contacto</div>
              <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <span className="font-mono tabular-nums">{lead.phone}</span>
                {lead.email && <span className="text-xs font-normal text-slate-500">({lead.email})</span>}
              </div>
              <div className="text-xs text-slate-600">
                Asesor Asignado: <strong>{lead.currentVendorName || 'Sin asignar'}</strong>
                {lead.rotationCount > 0 && (
                  <span className="text-amber-700 ml-2">({lead.rotationCount} rotaciones acumuladas)</span>
                )}
              </div>
            </div>

            {/* Quick action buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => onDirectWhatsApp(lead)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                <span>WhatsApp (Registra Gestión)</span>
              </button>
              <button
                onClick={() => onDirectCall(lead)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-xs transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Llamar</span>
              </button>
              {lead.status !== 'closed_won' && (
                <>
                  <button
                    onClick={onOpenTaskModal}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Próxima Tarea (≤5h)</span>
                  </button>
                  <button
                    onClick={onOpenClosureModal}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    <span>Cerrar Dato</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* SLA Timers Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* SLA 30m */}
            <div className="p-3 bg-white border border-slate-200 rounded-lg">
              <div className="text-xs text-slate-500 font-medium mb-1">1. Primer Contacto (30m)</div>
              {lead.hasContacted ? (
                <div className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Gestionado a tiempo</span>
                </div>
              ) : (
                <LiveTimer deadline={lead.contactDeadline} type="30m" />
              )}
            </div>

            {/* SLA 5h Task */}
            <div className="p-3 bg-white border border-slate-200 rounded-lg">
              <div className="text-xs text-slate-500 font-medium mb-1">2. Próxima Tarea (≤5h)</div>
              {lead.currentTask ? (
                <div>
                  <div className="text-xs font-semibold text-slate-800 truncate">
                    {lead.currentTask.type.toUpperCase()}: {lead.currentTask.description}
                  </div>
                  <LiveTimer
                    deadline={lead.currentTask.dueAt}
                    type="5h"
                    isCompleted={lead.currentTask.completed}
                  />
                </div>
              ) : (
                <span className="text-xs text-slate-400">Sin tarea programada</span>
              )}
            </div>

            {/* SLA 10 Days */}
            <div className="p-3 bg-white border border-slate-200 rounded-lg">
              <div className="text-xs text-slate-500 font-medium mb-1">3. Cierre Global (10 Días)</div>
              <LiveTimer deadline={lead.globalClosureDeadline} type="10d" isCompleted={lead.status === 'closed_won'} />
            </div>
          </div>

          {/* Comments & Audit Trail ("Todos los comentarios que escriban los vendedores pueden ser visto por otros vendedores") */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-4 h-4 text-slate-500" />
                <span>Hilo Compartido de Comentarios y Auditoría ({lead.comments?.length || 0})</span>
              </h4>
              <span className="text-xs text-slate-400">Visible por todos los asesores</span>
            </div>

            {/* List of comments */}
            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {lead.comments && lead.comments.length > 0 ? (
                lead.comments.map((comment) => (
                  <div
                    key={comment.id}
                    className={`p-3 rounded-lg border text-xs ${
                      comment.type === 'reapertura'
                        ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                        : comment.type === 'rotacion'
                        ? 'bg-blue-50/70 border-blue-200 text-blue-900'
                        : comment.type === 'cierre'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-semibold flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" />
                        {comment.authorName} ({comment.authorRole})
                      </span>
                      <span className="text-slate-400 font-mono text-[11px]">
                        {new Date(comment.createdAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="whitespace-pre-wrap leading-relaxed">{comment.text}</div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded-lg">
                  No hay comentarios aún en este lead.
                </div>
              )}
            </div>

            {/* Add new comment form */}
            <form onSubmit={handleSendComment} className="mt-3 flex gap-2">
              <input
                type="text"
                placeholder="Escribí un comentario u observación visible para todo el equipo..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="flex-1 text-xs border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Publicar</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
