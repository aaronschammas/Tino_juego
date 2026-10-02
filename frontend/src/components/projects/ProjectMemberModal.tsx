'use client';

import { useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import Portal from '@/components/ui/Portal';
import { OrganizationMember } from '@/types/organization';

interface ProjectMemberModalProps {
  isOpen: boolean;
  members: OrganizationMember[];
  currentMembersCount: number;
  error: string | null;
  pendingMemberId: string | null;
  onAddMember: (userId: string) => void;
  onClose: () => void;
}

export default function ProjectMemberModal(props: ProjectMemberModalProps) {
  if (!props.isOpen) return null;
  return <ProjectMemberDialog {...props} />;
}

function ProjectMemberDialog({
  members,
  currentMembersCount,
  error,
  pendingMemberId,
  onAddMember,
  onClose,
}: ProjectMemberModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const filteredMembers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return members;
    return members.filter((member) => {
      const fullName = `${member.name} ${member.lastname}`.trim().toLowerCase();
      return fullName.includes(term) || member.email.toLowerCase().includes(term);
    });
  }, [members, searchTerm]);

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
        <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl animate-page-enter">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Equipo del proyecto</p>
            <h2 className="mt-1 text-2xl font-extrabold text-slate-900">Agregar persona</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">
              {currentMembersCount} {currentMembersCount === 1 ? 'persona asignada' : 'personas asignadas'}
            </p>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700" aria-label="Cerrar modal">
            x
          </button>
        </div>

        <div className="mt-6">
          <input type="text" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar por nombre o email" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none transition-all placeholder:text-slate-400 focus:border-[#1e3a5f] focus:bg-white focus:ring-4 focus:ring-blue-100" />
        </div>

        {error ? <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div> : null}

        <div className="mt-5 max-h-80 space-y-2 overflow-y-auto pr-1">
          {filteredMembers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <p className="text-sm font-bold text-slate-900">{members.length === 0 ? 'No hay personas disponibles' : 'No encontramos coincidencias'}</p>
              <p className="mt-1 text-xs font-medium text-slate-500">{members.length === 0 ? 'Todos los miembros activos de la organización ya están en este proyecto.' : 'Probá con otro nombre o email.'}</p>
            </div>
          ) : filteredMembers.map((member) => {
            const displayName = `${member.name} ${member.lastname}`.trim() || member.email;
            const initials = displayName.split(' ').map((part) => part[0]).join('').substring(0, 2).toUpperCase();
            return (
              <div key={member.userId} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1e3a5f] text-sm font-bold text-white">{initials}</div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">{displayName}</p>
                    <p className="truncate text-xs font-medium text-slate-500">{member.email}</p>
                  </div>
                </div>
                <Button size="sm" onClick={() => onAddMember(member.userId)} disabled={pendingMemberId !== null} className="shrink-0 rounded-xl">
                  {pendingMemberId === member.userId ? 'Agregando...' : 'Agregar'}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
          <Button variant="secondary" onClick={onClose} className="rounded-xl">Cerrar</Button>
        </div>
        </div>
      </div>
    </Portal>
  );
}
