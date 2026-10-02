'use client';

import { useMemo, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { Search, UserPlus, Mail, Shield, Grid, List, Plus, Users, Filter, LayoutGrid } from 'lucide-react';
import ProtectedLayout from '@/components/layout/ProtectedLayout';
import { useUsers } from '@/hooks/useUsers';
import { useOrganizationMembers } from '@/hooks/useOrganizationMembers';
import { useOrganizations } from '@/hooks/useOrganizations';
import { useAuth } from '@/hooks/useAuth';
import { isAdmin, isSuperAdmin, isOrgOwner } from '@/lib/auth';
import Navbar from '@/components/layout/Navbar';
import UserCard from '@/components/users/UserCard';
import TeamMemberCard, { TeamMember, EditProjectsTarget } from '@/components/users/TeamMemberCard';
import UserSkeletonCard from '@/components/users/UserSkeletonCard';
import InviteUserModal from '@/components/users/InviteUserModal';
import EditMemberProjectsModal from '@/components/users/EditMemberProjectsModal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import NoticeBanner from '@/components/ui/NoticeBanner';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { formatUserDisplayName } from '@/lib/user-display';

type FilterType = 'all' | 'admin' | 'user';
type TabType = 'team' | 'system';
type ToastType = 'success' | 'error' | 'warning';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const show = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++counterRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 3200);
  }, []);

  return { toasts, show };
}

export default function UsersPage() {
  const { users, isLoading, isFetching, error, deactivateUser } = useUsers();
  const {
    members,
    pendingInvites,
    userRole,
    isLoading: isMembersLoading,
    isFetching: isMembersFetching,
    error: membersError,
    refreshMembers,
  } = useOrganizationMembers();
  const { resendInvite, revokeInvite, removeMember } = useOrganizations();
  const { user } = useAuth();

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [activeTab, setActiveTab] = useState<TabType>('team');
  const [editTarget, setEditTarget] = useState<EditProjectsTarget | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    description: '',
    confirmLabel: '',
    onConfirm: () => {},
  });

  const { toasts, show: showToast } = useToast();

  const planName = typeof user?.organizationPlan === 'string' 
    ? user.organizationPlan 
    : user?.organizationPlan?.name;
  const isFreePlan = !planName || planName.toLowerCase() === 'free';
  const canManageTeam = isOrgOwner(user, userRole);
  const canInviteUsers = canManageTeam && !isFreePlan;

  const activeMembers: TeamMember[] = useMemo(() => members.map((member) => ({
    ...member,
    status: 'ACTIVE',
  })), [members]);

  const pendingTeamMembers: TeamMember[] = useMemo(() => pendingInvites.map((invite) => ({
    userId: '',
    membershipId: `invite-${invite.id}`,
    email: invite.email,
    name: invite.email.split('@')[0],
    lastname: '',
    status: 'PENDING',
    role: invite.role,
    joinedAt: invite.expiresAt,
    inviteLink: invite.inviteLink,
    inviteId: invite.id,
  })), [pendingInvites]);

  const filteredUsers = useMemo(() => {
    let filtered = users;

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (currentUser) =>
          currentUser.name.toLowerCase().includes(lower) ||
          currentUser.lastname.toLowerCase().includes(lower) ||
          currentUser.email.toLowerCase().includes(lower),
      );
    }

    if (filterType === 'admin') {
      filtered = filtered.filter((currentUser) => isAdmin(currentUser));
    }

    if (filterType === 'user') {
      filtered = filtered.filter((currentUser) => currentUser.role === 'USER');
    }

    return filtered;
  }, [filterType, searchTerm, users]);

  const inviteButtonTitle = !canManageTeam
    ? 'Solo el propietario de la organizacion puede gestionar el equipo'
    : isFreePlan
      ? `El plan ${planName} permite hasta ${user?.organizationPlan?.maxUsers} miembros`
      : '';

  const handleCopyInviteLink = useCallback(async (link: string, email: string) => {
    try {
      await navigator.clipboard.writeText(link);
      showToast(`Link copiado para ${email}`, 'success');
    } catch {
      showToast('No se pudo copiar el link', 'error');
    }
  }, [showToast]);

  const handleCancelInvite = useCallback((member: TeamMember) => {
    setConfirmDialog({
      open: true,
      title: 'Cancelar invitacion',
      description: `La invitacion de ${member.email} dejara de funcionar.`,
      confirmLabel: 'Cancelar invitacion',
      onConfirm: async () => {
        setConfirmDialog((current) => ({ ...current, open: false }));
        try {
          if (member.inviteId) await revokeInvite(member.inviteId);
          showToast(`Invitacion cancelada para ${member.email}`, 'success');
          refreshMembers();
        } catch {
          showToast('No se pudo cancelar la invitacion', 'error');
        }
      },
    });
  }, [revokeInvite, showToast, refreshMembers]);

  const handleResendInvite = useCallback(async (member: TeamMember) => {
    try {
      if (member.inviteId) await resendInvite(member.inviteId);
      showToast(`Invitacion reenviada a ${member.email}`, 'success');
      refreshMembers();
    } catch {
      showToast('No se pudo reenviar la invitacion', 'error');
    }
  }, [resendInvite, showToast, refreshMembers]);

  const handleRemoveUser = useCallback((member: TeamMember) => {
    setConfirmDialog({
      open: true,
      title: 'Eliminar miembro',
      description: `${member.email} perdera acceso a la organizacion y sus proyectos.`,
      confirmLabel: 'Eliminar',
      onConfirm: async () => {
        setConfirmDialog((current) => ({ ...current, open: false }));
        try {
          await removeMember(member.userId);
          showToast(`${member.email} fue eliminado del equipo`, 'success');
          refreshMembers();
        } catch {
          showToast('No se pudo eliminar el miembro', 'error');
        }
      },
    });
  }, [removeMember, showToast, refreshMembers]);

  const handleDeactivate = useCallback((id: string) => {
    setConfirmDialog({
      open: true,
      title: 'Desactivar usuario',
      description: 'El usuario perdera acceso al sistema hasta que vuelva a activarse.',
      confirmLabel: 'Desactivar',
      onConfirm: async () => {
        setConfirmDialog((current) => ({ ...current, open: false }));
        try {
          await deactivateUser(id);
          showToast('Usuario desactivado', 'success');
        } catch {
          showToast('No se pudo desactivar el usuario', 'error');
        }
      },
    });
  }, [deactivateUser, showToast]);

  const handleInviteSuccess = useCallback(() => {
    refreshMembers();
    showToast('Invitacion enviada correctamente', 'success');
  }, [refreshMembers, showToast]);

  return (
    <ProtectedLayout>
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-[1400px] px-0 md:px-8 py-12">
          {/* Header Section */}
          <div className="mb-12">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2">ORGANIZACION</p>
                <h1 className="text-[32px] md:text-[40px] font-extrabold tracking-tight text-slate-900 leading-none mb-3">
                  Equipo
                </h1>
                <p className="text-[15px] text-slate-500 font-medium">
                  Revisa miembros activos, accesos y bloqueos del plan en un solo lugar.
                </p>
              </div>

              <div className="flex shrink-0">
                <button
                  onClick={() => setShowInviteModal(true)}
                  disabled={!canInviteUsers}
                  title={inviteButtonTitle}
                  className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 bg-[#1e3a5f] text-white px-6 py-3.5 rounded-2xl text-[14px] font-bold shadow-lg shadow-blue-900/10 hover:bg-[#2c4f7c] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <UserPlus size={18} />
                  Invitar miembro
                </button>
              </div>
            </div>
          </div>

          {membersError && (
            <div className="mb-10">
              <NoticeBanner title="No pudimos verificar tus permisos" tone="warning">
                Recargá la página para volver a intentarlo.
              </NoticeBanner>
            </div>
          )}

          {/* Plan Banner */}
          {isFreePlan && (
            <div className="mb-10 rounded-2xl bg-orange-50 border border-orange-100 p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                  <Shield size={20} />
                </div>
                <div>
                  <h4 className="text-[14px] font-bold text-orange-900">Estas en el plan Free</h4>
                  <p className="text-[13px] font-medium text-orange-700/80">
                    Por ahora solo el plan Free esta disponible. Los planes Pro y Max llegaran proximamente con mas usuarios e invitaciones.
                  </p>
                </div>
              </div>
              <Link 
                href="/perfil?tab=billing"
                className="bg-white px-5 py-2 rounded-lg text-[13px] font-bold text-slate-800 shadow-sm border border-slate-100 hover:bg-slate-50 transition-colors shrink-0 flex items-center justify-center"
              >
                Ver planes
              </Link>
            </div>
          )}

          {/* Tabs Navigation */}
          <div className="mb-10 border-b border-slate-100">
            <div className="flex gap-8">
              <button
                onClick={() => setActiveTab('team')}
                className={`pb-4 text-[14px] font-bold transition-all relative ${
                  activeTab === 'team'
                    ? 'text-[#1e3a5f]'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Equipo
                {activeTab === 'team' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#1e3a5f] rounded-full" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('system')}
                className={`pb-4 text-[14px] font-bold transition-all relative ${
                  activeTab === 'system'
                    ? 'text-[#1e3a5f]'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Usuarios del sistema
                {activeTab === 'system' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#1e3a5f] rounded-full" />
                )}
              </button>
            </div>
          </div>

          <InviteUserModal
            isOpen={showInviteModal}
            onClose={() => setShowInviteModal(false)}
            onSuccess={handleInviteSuccess}
          />

          <ConfirmDialog
            isOpen={confirmDialog.open}
            title={confirmDialog.title}
            description={confirmDialog.description}
            confirmLabel={confirmDialog.confirmLabel}
            onConfirm={confirmDialog.onConfirm}
            onCancel={() => setConfirmDialog((current) => ({ ...current, open: false }))}
          />

          <EditMemberProjectsModal
            key={`${editTarget?.memberId ?? 'closed'}-${(editTarget?.projectIds ?? []).join(',')}`}
            isOpen={editTarget !== null}
            memberId={editTarget?.memberId ?? ''}
            memberEmail={editTarget?.email ?? ''}
            currentProjectIds={editTarget?.projectIds ?? []}
            onClose={() => setEditTarget(null)}
            onSuccess={() => {
              setEditTarget(null);
              refreshMembers();
              showToast('Proyectos actualizados correctamente', 'success');
            }}
          />

          {activeTab === 'team' ? (
            <div className="space-y-12">
              {/* KPI Section */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                <Card className="p-6 border-slate-100/60 shadow-sm transition-all hover:shadow-md">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                      <Users size={20} />
                    </div>
                    <p className="text-[13px] font-bold text-slate-500 uppercase tracking-wide">Miembros activos</p>
                  </div>
                  <p className="text-4xl font-extrabold text-slate-900">{activeMembers.length}</p>
                  <p className="mt-2 text-[12px] font-medium text-slate-400">Con acceso a la organización</p>
                </Card>
                <Card className="p-6 border-slate-100/60 shadow-sm transition-all hover:shadow-md">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <Mail size={20} />
                    </div>
                    <p className="text-[13px] font-bold text-slate-500 uppercase tracking-wide">Invitaciones pendientes</p>
                  </div>
                  <p className="text-4xl font-extrabold text-slate-900">{pendingTeamMembers.length}</p>
                  <p className="mt-2 text-[12px] font-medium text-slate-400">Esperando aceptacion</p>
                </Card>
                <Card className="p-6 border-slate-100/60 shadow-sm transition-all hover:shadow-md">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                      <Shield size={20} />
                    </div>
                    <p className="text-[13px] font-bold text-slate-500 uppercase tracking-wide">Limite del plan</p>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <p className="text-4xl font-extrabold text-slate-900">{activeMembers.length}</p>
                    <p className="text-xl font-bold text-slate-300">
                      /{user?.organizationPlan?.maxUsers === null ? '∞' : (user?.organizationPlan?.maxUsers ?? 1)}
                    </p>
                  </div>
                  <p className="mt-2 text-[12px] font-medium text-slate-400">Capacidad total del plan {user?.organizationPlan?.title || 'Free'}</p>
                </Card>
              </div>

              {/* Members Section */}
              <section className="space-y-6">
                <div className="flex flex-col gap-1">
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Miembros activos</h2>
                  <p className="text-[14px] font-medium text-slate-500">
                    Quienes tienen acceso a la organización y sus proyectos.
                  </p>
                </div>

                {isMembersLoading ? (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <UserSkeletonCard key={`team-skeleton-${index}`} />
                    ))}
                  </div>
                ) : activeMembers.length === 0 ? (
                  <EmptyState
                    icon="[]"
                    title="Todavia no hay miembros activos"
                    description={
                      canInviteUsers
                        ? 'Invita al primer miembro para empezar a trabajar en equipo.'
                        : 'El plan actual permite una sola persona por organizacion.'
                    }
                    action={
                      canInviteUsers ? (
                        <Button onClick={() => setShowInviteModal(true)}>Invitar miembro</Button>
                      ) : undefined
                    }
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {activeMembers.map((member) => (
                      <TeamMemberCard
                        key={member.membershipId}
                        member={member}
                        onCopyLink={handleCopyInviteLink}
                        onCancelInvite={handleCancelInvite}
                        onResendInvite={handleResendInvite}
                        onEditProjects={(target) => setEditTarget(target)}
                        onRemoveUser={handleRemoveUser}
                        canEdit={canManageTeam}
                        canRemove={canManageTeam && member.userId !== user?.id}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* Pending Invites Section */}
              <section className="space-y-6">
                <div className="flex flex-col gap-1">
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Invitaciones pendientes</h2>
                  <p className="text-[14px] font-medium text-slate-500">
                    Invitaciones enviadas que todavia no fueron aceptadas.
                  </p>
                </div>

                {isFreePlan ? (
                  <div className="rounded-[32px] border-2 border-dashed border-slate-100 bg-slate-50/30 py-20 flex flex-col items-center justify-center text-center px-6">
                    <div className="h-16 w-16 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center text-[#1e3a5f] mb-6">
                      <Mail size={28} />
                    </div>
                    <h3 className="text-xl font-extrabold text-slate-900 mb-2">Limite de miembros alcanzado</h3>
                    <p className="max-w-md text-slate-500 text-[14px] font-medium leading-relaxed mb-8">
                      Tu plan {user?.organizationPlan?.title || 'actual'} tiene un limite de {user?.organizationPlan?.maxUsers || 1} {user?.organizationPlan?.maxUsers === 1 ? 'miembro' : 'miembros'}. 
                      Para sumar mas personas, deberas actualizar a un plan superior.
                    </p>
                    <Link 
                      href="/perfil?tab=billing"
                      className="bg-white px-6 py-2.5 rounded-xl text-[14px] font-bold text-slate-800 shadow-sm border border-slate-100 hover:bg-slate-50 transition-colors flex items-center justify-center"
                    >
                      Ver planes disponibles
                    </Link>
                  </div>
                ) : pendingTeamMembers.length === 0 ? (
                  <EmptyState
                    icon="@"
                    title="No hay invitaciones pendientes"
                    description="Cuando invites a alguien, el seguimiento del estado aparecera en esta seccion."
                    action={
                      canInviteUsers ? (
                        <Button onClick={() => setShowInviteModal(true)}>Enviar invitacion</Button>
                      ) : undefined
                    }
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {pendingTeamMembers.map((member) => (
                      <TeamMemberCard
                        key={member.membershipId}
                        member={member}
                        onCopyLink={handleCopyInviteLink}
                        onCancelInvite={handleCancelInvite}
                        onResendInvite={handleResendInvite}
                        onEditProjects={(target) => setEditTarget(target)}
                        onRemoveUser={handleRemoveUser}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>
          ) : (
            <div className="space-y-10">
              {/* System KPIs */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                <Card className="p-6 border-slate-100/60 shadow-sm transition-all hover:shadow-md">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-600">
                      <LayoutGrid size={20} />
                    </div>
                    <p className="text-[13px] font-bold text-slate-500 uppercase tracking-wide">Total</p>
                  </div>
                  <p className="text-4xl font-extrabold text-slate-900">{users.length}</p>
                  <p className="mt-2 text-[12px] font-medium text-slate-400">Usuarios registrados</p>
                </Card>
                <Card className="p-6 border-slate-100/60 shadow-sm transition-all hover:shadow-md">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <Shield size={20} />
                    </div>
                    <p className="text-[13px] font-bold text-slate-500 uppercase tracking-wide">Admins</p>
                  </div>
                  <p className="text-4xl font-extrabold text-slate-900">{users.filter(u => isAdmin(u)).length}</p>
                  <p className="mt-2 text-[12px] font-medium text-slate-400">Con permisos elevados</p>
                </Card>
                <Card className="p-6 border-slate-100/60 shadow-sm transition-all hover:shadow-md">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                      <Users size={20} />
                    </div>
                    <p className="text-[13px] font-bold text-slate-500 uppercase tracking-wide">Miembros</p>
                  </div>
                  <p className="text-4xl font-extrabold text-slate-900">{users.filter(u => u.role === 'USER').length}</p>
                  <p className="mt-2 text-[12px] font-medium text-slate-400">Sin permisos administrativos</p>
                </Card>
              </div>

              {/* Filters & Actions Bar */}
              <div className="rounded-[24px] border border-slate-100 bg-slate-50/40 p-4 space-y-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o email"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-7 text-[14px] font-medium placeholder:text-slate-400 focus:bg-white focus:border-[#1e3a5f] focus:ring-4 focus:ring-blue-100 transition-all shadow-sm"
                  />
                </div>
                
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex gap-2">
                    {[
                      { id: 'all', label: 'Todos', count: users.length },
                      { id: 'admin', label: 'Admins', count: users.filter(u => isAdmin(u)).length },
                      { id: 'user', label: 'Miembros', count: users.filter(u => u.role === 'USER').length }
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setFilterType(f.id as FilterType)}
                        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-bold transition-all ${
                          filterType === f.id
                            ? 'bg-blue-50 text-[#1e3a5f] ring-1 ring-blue-200'
                            : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
                        }`}
                      >
                        {f.label}
                        <span className={`px-1.5 rounded-full text-[10px] ${filterType === f.id ? 'bg-blue-200 text-[#1e3a5f]' : 'bg-slate-100 text-slate-400'}`}>
                          {f.count}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                    <button
                      onClick={() => setViewMode('cards')}
                      className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[12px] font-bold transition-all ${
                        viewMode === 'cards' ? 'bg-[#1e3a5f] text-white' : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      <LayoutGrid size={16} />
                      Tarjetas
                    </button>
                    <button
                      onClick={() => setViewMode('table')}
                      className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[12px] font-bold transition-all ${
                        viewMode === 'table' ? 'bg-[#1e3a5f] text-white' : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      <List size={16} />
                      Tabla
                    </button>
                  </div>
                </div>
              </div>

              {/* Users Grid */}
              {isLoading ? (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <UserSkeletonCard key={`user-skeleton-${index}`} />
                  ))}
                </div>
              ) : filteredUsers.length === 0 ? (
                <EmptyState
                  icon="?"
                  title="No encontramos coincidencias"
                  description="Prueba con otro termino o ajusta los filtros para volver a ver resultados."
                />
              ) : viewMode === 'cards' ? (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {filteredUsers.map((currentUser) => {
                    const userWithCurrent = { ...currentUser, isCurrentUser: user?.id === currentUser.id };
                    const memberRecord = members.find((member) => member.userId === currentUser.id);

                    return (
                      <UserCard
                        key={currentUser.id}
                        user={userWithCurrent}
                        onEdit={
                          canManageTeam
                            ? () =>
                                setEditTarget({
                                  memberId: currentUser.id,
                                  email: currentUser.email,
                                  projectIds: memberRecord?.projectIds ?? [],
                                })
                            : undefined
                        }
                        onDeactivate={
                          isSuperAdmin(user) ? () => handleDeactivate(currentUser.id) : undefined
                        }
                      />
                    );
                  })}
                </div>
              ) : (
                <Card className="overflow-hidden p-0 border-slate-100 shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[14px]">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="px-6 py-4 font-bold text-slate-600 uppercase tracking-wider text-[11px]">Usuario</th>
                          <th className="px-6 py-4 font-bold text-slate-600 uppercase tracking-wider text-[11px]">Rol</th>
                          <th className="px-6 py-4 font-bold text-slate-600 uppercase tracking-wider text-[11px]">Estado</th>
                          <th className="px-6 py-4 font-bold text-slate-600 uppercase tracking-wider text-[11px]">Email</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {filteredUsers.map((currentUser) => (
                          <tr key={currentUser.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-bold text-slate-900">
                              {formatUserDisplayName(currentUser.name, currentUser.lastname) || currentUser.email}
                            </td>
                            <td className="px-6 py-4 font-medium text-slate-500">
                              {isAdmin(currentUser) ? 'Admin' : 'Miembro'}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                                currentUser.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-400'
                              }`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${currentUser.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                {currentUser.isActive ? 'Activo' : 'Inactivo'}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-medium text-slate-400">{currentUser.email}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Toasts */}
      <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-2xl px-6 py-4 text-[14px] font-bold text-white shadow-2xl animate-in slide-in-from-right-full duration-300 ${
              toast.type === 'success'
                ? 'bg-[#1e3a5f]'
                : toast.type === 'error'
                  ? 'bg-red-600'
                  : 'bg-orange-500'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ProtectedLayout>
  );
}
