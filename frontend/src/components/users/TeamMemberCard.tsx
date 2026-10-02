'use client';

import { memo } from 'react';
import { formatUserDisplayName, getUserInitials } from '@/lib/user-display';
import { MoreHorizontal, UserPlus, Mail, Shield, ExternalLink, Edit3 } from 'lucide-react';

export interface TeamMember {
  userId: string;
  membershipId: string;
  email: string;
  name: string;
  lastname: string;
  status: 'ACTIVE' | 'PENDING';
  role: string;
  joinedAt?: string;
  inviteLink?: string;
  inviteId?: string;
  projectIds?: string[];
}

export interface EditProjectsTarget {
  memberId: string;
  email: string;
  projectIds: string[];
}

interface TeamMemberCardProps {
  member: TeamMember;
  onCopyLink: (link: string, email: string) => void;
  onCancelInvite: (member: TeamMember) => void;
  onResendInvite: (member: TeamMember) => void;
  onEditProjects: (target: EditProjectsTarget) => void;
  onRemoveUser?: (member: TeamMember) => void;
  canEdit?: boolean;
  canRemove?: boolean;
}

const TeamMemberCard = ({
  member,
  onCopyLink,
  onCancelInvite,
  onResendInvite,
  onEditProjects,
  onRemoveUser,
  canEdit = false,
  canRemove = false,
}: TeamMemberCardProps) => {
  const initials = getUserInitials(member.name, member.lastname);
  const isPending = member.status === 'PENDING';
  const displayName = formatUserDisplayName(member.name, member.lastname) || member.email.split('@')[0];
  const roleLabel =
    member.role === 'ORG_OWNER' ? 'Propietario' : (member.role === 'ADMIN' || member.role === 'SUPERADMIN') ? 'Admin' : 'Miembro';
  
  const formattedDate = member.joinedAt
    ? new Date(member.joinedAt).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'America/Argentina/Buenos_Aires',
      })
    : null;

  return (
    <div
      className={`group relative flex flex-col gap-5 rounded-[24px] border border-slate-200/60 bg-white p-6 transition-all hover:shadow-xl hover:shadow-slate-200/40 ${
        isPending ? 'border-dashed border-orange-200 bg-orange-50/30' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold shrink-0 transition-transform group-hover:scale-105 ${
              isPending
                ? 'bg-orange-100 text-orange-600'
                : 'bg-[#1e3a5f] text-white shadow-lg shadow-blue-900/20'
            }`}
          >
            {isPending ? <Mail size={20} /> : initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-slate-900">
              {isPending ? member.email.split('@')[0] : displayName}
            </p>
            <p className="truncate text-[13px] font-medium text-slate-500">{member.email}</p>
          </div>
        </div>
        
        <button className="rounded-full p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors">
          <MoreHorizontal size={20} />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${
            isPending
              ? 'bg-orange-100 text-orange-700'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${isPending ? 'bg-orange-500' : 'bg-emerald-500'}`} />
          {isPending ? 'Pendiente' : 'Activo'}
        </span>
        <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-600 border border-slate-200">
          {roleLabel}
        </span>
      </div>

      <div className="space-y-1">
        {formattedDate ? (
          <p className="text-[12px] font-medium text-slate-400">
            {isPending ? `Expira: ${formattedDate}` : `Se unio: ${formattedDate}`}
          </p>
        ) : null}
      </div>

      <div className="mt-2 flex items-center gap-3 border-t border-slate-100 pt-5">
        {!isPending && (
          <div className="flex w-full flex-col gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => canEdit && onEditProjects({
                  memberId: member.userId,
                  email: member.email,
                  projectIds: member.projectIds || [],
                })}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-[13px] font-bold text-slate-700 transition-all hover:bg-slate-50 active:scale-[0.98]"
              >
                <Edit3 size={16} />
                Editar
              </button>
              <button
                onClick={() => onEditProjects({
                  memberId: member.userId,
                  email: member.email,
                  projectIds: member.projectIds || [],
                })}
                className="flex-1 text-[13px] font-bold text-slate-500 hover:text-[#1e3a5f] transition-colors"
              >
                Proyectos asignados
              </button>
            </div>
            {canRemove && onRemoveUser && (
              <button
                onClick={() => onRemoveUser(member)}
                className="w-full text-center text-[12px] font-bold text-red-500 hover:text-red-700 transition-colors pt-2 border-t border-slate-50"
              >
                Eliminar de la organizacion
              </button>
            )}
          </div>
        )}

        {isPending && (
          <div className="flex w-full flex-col gap-2">
            {member.inviteLink && (
              <button
                onClick={() => onCopyLink(member.inviteLink!, member.email)}
                className="w-full rounded-xl bg-[#1e3a5f] px-4 py-2.5 text-[13px] font-bold text-white transition-all hover:bg-[#2c4f7c]"
              >
                Copiar invitacion
              </button>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => onResendInvite(member)}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-[13px] font-bold text-slate-700 transition-all hover:bg-slate-50"
              >
                Reenviar
              </button>
              <button
                onClick={() => onCancelInvite(member)}
                className="flex-1 rounded-xl border border-red-100 px-4 py-2.5 text-[13px] font-bold text-red-600 transition-all hover:bg-red-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(TeamMemberCard);
