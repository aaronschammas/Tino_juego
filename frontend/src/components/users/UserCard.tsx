import { memo } from 'react';
import { User } from '@/types/user';
import { formatUserDisplayName, getUserInitials } from '@/lib/user-display';
import { isAdmin, isSuperAdmin } from '@/lib/auth';

interface UserCardProps {
  user: User;
  onEdit?: (user: User) => void;
  onDeactivate?: (id: string) => void;
}

const UserCard = ({ user, onEdit, onDeactivate }: UserCardProps) => {
  const projectCount = user.projectMembers?.length || 0;
  const taskCount = user.assignedTasks?.length || 0;
  const tasksDone = user.assignedTasks?.filter((t) => t.status === 'DONE').length || 0;

  const initials = getUserInitials(user.name, user.lastname);
  const displayName = formatUserDisplayName(user.name, user.lastname) || user.email;

  const roleLabel = isSuperAdmin(user) ? 'Super Admin' : isAdmin(user) ? 'Administrador' : 'Miembro';
  
  return (
    <div className="group relative flex flex-col gap-6 rounded-[24px] border border-slate-200/60 bg-white p-6 transition-all hover:shadow-xl hover:shadow-slate-200/40">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1e3a5f] text-white shadow-lg shadow-blue-900/10 font-bold text-lg shrink-0 transition-transform group-hover:scale-105">
            {initials}
          </div>
  
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 truncate text-base">{displayName}</h3>
              {onEdit && (
                <button
                  onClick={() => onEdit(user)}
                  className="text-[12px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
                >
                  Editar
                </button>
              )}
            </div>
            <p className="text-[13px] font-medium text-slate-500 truncate">{user.email}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200`}>
          {roleLabel}
        </span>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${
          user.isActive
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
            : 'bg-slate-100 text-slate-400 border border-slate-200'
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${user.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          {user.isActive ? 'Activo' : 'Inactivo'}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 rounded-2xl bg-slate-50/80 p-4 border border-slate-100/50">
        <div className="flex flex-col items-center gap-1">
          <span className="text-[15px] font-extrabold text-slate-900 leading-none">{taskCount}</span>
          <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Tareas</span>
        </div>
        <div className="flex flex-col items-center gap-1 border-x border-slate-200">
          <span className="text-[15px] font-extrabold text-slate-900 leading-none">{tasksDone}</span>
          <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400 text-center">Completadas</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-[15px] font-extrabold text-slate-900 leading-none">{projectCount}</span>
          <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Proyectos</span>
        </div>
      </div>
    </div>
  );
};

export default memo(UserCard);
