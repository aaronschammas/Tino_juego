'use client';

import { Suspense, useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { User, Lock, Trash2, Star, CheckCircle2, AlertCircle } from 'lucide-react';
import ProtectedLayout from '@/components/layout/ProtectedLayout';
import Card from '@/components/ui/Card';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { apiDelete, apiGetCached, apiPatch, apiPost, invalidateApiCache } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useOrganizations } from '@/hooks/useOrganizations';
import { UpdateUserDto, User as UserType } from '@/types/user';
import { isAdmin, isSuperAdmin } from '@/lib/auth';
import { clearClientSession } from '@/lib/session-cleanup';
import { cn } from '@/lib/cn';

type TabType = 'personal' | 'security' | 'account' | 'billing';

const PLANS_DATA = {
  free: {
    name: 'Free',
    desc: 'Perfecto para empezar y probar la herramienta.',
    features: ['1 usuario por organizacion', 'Hasta 2 proyectos', 'Dashboard de analytics']
  },
  pro: {
    name: 'Pro',
    desc: 'Para equipos que necesitan colaborar.',
    features: ['Hasta 10 usuarios', 'Proyectos ilimitados', 'Invitaciones por email', 'Reportes avanzados']
  },
  max: {
    name: 'Max',
    desc: 'Para organizaciones grandes con necesidades avanzadas.',
    features: ['Usuarios ilimitados', 'SSO y permisos avanzados', 'Auditoria y compliance', 'Soporte prioritario 24/7']
  }
} as const;
export default function PerfilPage() {
  return (
    <Suspense fallback={<PerfilPageFallback />}>
      <PerfilPageContent />
    </Suspense>
  );
}

function PerfilPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user: authUser, updateUser: updateSessionUser } = useAuth();
  const { getMyOrganization } = useOrganizations();

  const [activeTab, setActiveTab] = useState<TabType>('personal');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'personal') setActiveTab('personal');
    if (tab === 'account') setActiveTab('account');
    if (tab === 'security') setActiveTab('security');
  }, [searchParams]);
  const [profile, setProfile] = useState<UserType | null>(null);
  const [organizationName, setOrganizationName] = useState('');
  const [formValues, setFormValues] = useState<UpdateUserDto>({
    email: '',
    name: '',
    lastname: '',
  });
  const [passwordValues, setPasswordValues] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!authUser?.id) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      setIsLoading(true);

      const [me, organization] = await Promise.all([
        apiGetCached<UserType>('/users/me', { staleTime: 45_000 }),
        getMyOrganization().catch(() => null),
      ]);

      setProfile(me);
      setOrganizationName(organization?.name || '');
      setFormValues({
        email: me.email || '',
        name: me.name || '',
        lastname: me.lastname || '',
      });
    } catch (loadError: any) {
      setError(loadError?.message || 'No se pudo cargar el perfil de usuario.');
    } finally {
      setIsLoading(false);
    }
  }, [authUser?.id, getMyOrganization]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleFieldChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const { id, value } = event.target;
    setFormValues((currentValues) => ({
      ...currentValues,
      [id]: value,
    }));
  }, []);

  const handleProfileSave = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authUser?.id || !profile) return;

    const payload: UpdateUserDto = {
      name: formValues.name?.trim(),
      lastname: formValues.lastname?.trim(),
    };

    try {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);

      const updatedProfile = await apiPatch<UserType>(`/users/${authUser.id}`, payload);
      invalidateApiCache(['/users/me', '/users']);
      setProfile(updatedProfile);
      updateSessionUser(updatedProfile);
      setSuccessMessage('Datos actualizados correctamente.');
    } catch (saveError: any) {
      setError(saveError?.message || 'No se pudo actualizar el perfil.');
    } finally {
      setIsSaving(false);
    }
  }, [authUser?.id, profile, formValues, updateSessionUser]);

  const hasInternalPassword = Boolean(profile?.hasInternalPassword);

  const handlePasswordFieldChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const { id, value } = event.target;
    setPasswordValues((currentValues) => ({
      ...currentValues,
      [id]: value,
    }));
  }, []);

  const handlePasswordSave = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authUser?.id || !profile) return;

    const newPassword = passwordValues.newPassword.trim();
    const confirmPassword = passwordValues.confirmPassword.trim();
    const currentPassword = passwordValues.currentPassword;

    if (hasInternalPassword && !currentPassword) {
      setError('La contraseña actual es requerida.');
      setSuccessMessage(null);
      return;
    }

    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      setSuccessMessage(null);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      setSuccessMessage(null);
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);

      if (hasInternalPassword) {
        await apiPost<{ message: string }>('/auth/change-password', {
          currentPassword,
          newPassword,
          confirmPassword,
        });
        setSuccessMessage('Contraseña actualizada correctamente');
      } else {
        const response = await apiPost<{ user: UserType }>('/auth/set-internal-password', {
          password: newPassword,
        });
        setProfile(response.user);
        updateSessionUser(response.user);
        invalidateApiCache(['/users/me']);
        setSuccessMessage('Contraseña creada correctamente');
      }

      setPasswordValues({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (saveError: any) {
      setError(saveError?.message || 'No se pudo actualizar la contraseña.');
    } finally {
      setIsSaving(false);
    }
  }, [authUser?.id, profile, passwordValues, hasInternalPassword, updateSessionUser]);

  const handleDeleteAccount = useCallback(async () => {
    try {
      setIsDeletingAccount(true);
      setError(null);
      await apiDelete<{ success: boolean; message: string }>('/users/me', {
        skipAuthRedirect: true,
        silent: true,
        suppressStatuses: [401],
      });
      clearClientSession();
      router.replace('/');
    } catch (deleteError: any) {
      if (deleteError?.status === 401) {
        clearClientSession();
        router.replace('/login');
        return;
      }

      setError(deleteError?.message || 'No se pudo eliminar la cuenta.');
      setIsDeletingAccount(false);
      setShowDeleteConfirm(false);
    }
  }, [router]);

  const tabItems = [
    { id: 'personal', label: 'Datos personales', icon: User },
    { id: 'security', label: 'Seguridad', icon: Lock },
    { id: 'account', label: 'Cuenta', icon: Trash2 },
    { id: 'billing', label: 'Plan y facturacion', icon: Star },
  ] as const;

  const planName = typeof authUser?.organizationPlan === 'string' 
    ? authUser.organizationPlan 
    : authUser?.organizationPlan?.name;
    
  const currentPlanKey = (planName?.toLowerCase() || 'free') as keyof typeof PLANS_DATA;
  const currentPlan = PLANS_DATA[currentPlanKey] || PLANS_DATA.free;
  const otherPlans = Object.entries(PLANS_DATA).filter(([key]) => key !== currentPlanKey);

  return (
    <ProtectedLayout>
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-[1400px] px-0 md:px-8 py-12">
          
          {/* Header */}
          <div className="mb-12">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">CUENTA</p>
            <h1 className="text-[36px] md:text-[40px] font-extrabold tracking-tight text-slate-900 leading-none mb-3">Mi perfil</h1>
            <p className="text-[15px] text-slate-500 font-medium">
              Gestiona tus datos personales, accesos y plan de la organizacion.
            </p>
          </div>

          {/* Navigation Tabs Card */}
          <div className="mb-10 bg-white border border-slate-100 rounded-[24px] p-2 shadow-sm overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-1 min-w-max">
              {tabItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-6 py-3.5 text-[14.5px] font-bold transition-all",
                      active
                        ? "bg-blue-50 text-[#1e3a5f]"
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                    )}
                  >
                    <Icon size={19} className={active ? "text-[#1e3a5f]" : "text-slate-400"} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content Area */}
          <div className="w-full">
            {error && (
              <div className="mb-6 flex items-center gap-3 rounded-2xl bg-red-50 border border-red-100 p-4 text-red-800">
                <AlertCircle size={20} />
                <p className="text-[14px] font-bold">{error}</p>
              </div>
            )}

              {successMessage && (
                <div className="mb-6 flex items-center gap-3 rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-emerald-800">
                  <CheckCircle2 size={20} />
                  <p className="text-[14px] font-bold">{successMessage}</p>
                </div>
              )}

              {activeTab === 'personal' && (
                <div className="space-y-6 animate-page-enter">
                  <Card className="rounded-[32px] border-slate-100 p-8 shadow-sm">
                    <div className="mb-8">
                      <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Datos personales</h2>
                      <p className="text-[14px] font-medium text-slate-500">Informacion basica de tu cuenta.</p>
                    </div>

                    <form onSubmit={handleProfileSave} className="space-y-8">
                      <div className="grid gap-6 sm:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-[12px] font-bold text-slate-900 ml-1" htmlFor="name">
                            Nombre <span className="text-red-500">*</span>
                          </label>
                          <input
                            id="name"
                            className="w-full rounded-2xl border-slate-200 bg-slate-50 border-slate-200/60 shadow-sm transition-all hover:bg-slate-100/50 focus:bg-white px-7 py-3.5"
                            value={formValues.name || ''}
                            onChange={handleFieldChange}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[12px] font-bold text-slate-900 ml-1" htmlFor="lastname">
                            Apellido <span className="text-red-500">*</span>
                          </label>
                          <input
                            id="lastname"
                            className="w-full rounded-2xl border-slate-200 bg-slate-50 border-slate-200/60 shadow-sm transition-all hover:bg-slate-100/50 focus:bg-white px-7 py-3.5"
                            value={formValues.lastname || ''}
                            onChange={handleFieldChange}
                            required
                          />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <label className="text-[12px] font-bold text-slate-900 ml-1">Email</label>
                          <div className="w-full rounded-2xl border-slate-100 bg-slate-50 py-3.5 px-7 text-[14px] font-bold text-slate-600">
                            {profile?.email}
                          </div>
                          <p className="text-[12px] font-medium text-slate-400 mt-2">
                            El email de la cuenta no puede ser modificado.
                          </p>
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <label className="text-[12px] font-bold text-slate-900 ml-1">Rol</label>
                          <div className="w-full rounded-2xl border-slate-100 bg-slate-50 py-3.5 px-7 text-[14px] font-bold text-slate-600">
                            {isSuperAdmin(profile) ? 'Super Admin' : isAdmin(profile) ? 'Administrador' : 'Miembro'}
                          </div>
                          <p className="text-[12px] font-medium text-slate-400 mt-2">
                            El rol es asignado por el propietario de la organizacion.
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col-reverse md:flex-row items-center justify-end gap-3 md:gap-4 pt-4">
                        <button type="button" className="w-full md:w-auto text-[14px] font-bold text-slate-400 hover:text-slate-800 transition-colors py-3 md:py-0">
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={isSaving}
                          className="w-full md:w-auto rounded-xl bg-[#1e3a5f] px-10 py-3.5 text-[14px] font-bold text-white shadow-lg shadow-blue-900/20 transition-all hover:bg-[#2c4f7c] disabled:opacity-50"
                        >
                          {isSaving ? 'Guardando...' : 'Guardar cambios'}
                        </button>
                      </div>
                    </form>
                  </Card>
                </div>
              )}

            {activeTab === 'security' && (
              <div className="space-y-6 animate-page-enter">
                <Card className="rounded-[32px] border-slate-100 p-8 shadow-sm">
                  <div className="mb-8">
                    <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                      {hasInternalPassword ? 'Cambiar contraseña' : 'Crear contraseña interna'}
                    </h2>
                    <p className="text-[14px] font-medium text-slate-500">
                      {hasInternalPassword
                        ? 'Actualiza tu contraseña periodicamente.'
                        : 'Creá una contraseña para poder ingresar también con tu email y contraseña.'}
                    </p>
                  </div>

                  <form onSubmit={handlePasswordSave} className="space-y-6">
                    {hasInternalPassword && (
                      <div className="space-y-2">
                        <label className="text-[12px] font-bold text-slate-900 ml-1" htmlFor="currentPassword">Contraseña actual</label>
                        <div className="relative">
                          <input
                            id="currentPassword"
                            type={showCurrentPassword ? "text" : "password"}
                            placeholder="Ingresa tu contraseña actual"
                            className="w-full rounded-2xl border border-slate-200 bg-white shadow-sm transition-all focus:ring-4 focus:ring-blue-50 focus:border-blue-400 px-7 py-3.5 text-[15px] pr-12"
                            value={passwordValues.currentPassword}
                            onChange={handlePasswordFieldChange}
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                          >
                            {showCurrentPassword ? (
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-slate-900 ml-1" htmlFor="newPassword">Nueva contraseña</label>
                      <div className="relative">
                        <input
                          id="newPassword"
                          type={showNewPassword ? "text" : "password"}
                          placeholder="Minimo 8 caracteres"
                          className="w-full rounded-2xl border border-slate-200 bg-white shadow-sm transition-all focus:ring-4 focus:ring-blue-50 focus:border-blue-400 px-7 py-3.5 text-[15px] pr-12"
                          value={passwordValues.newPassword}
                          onChange={handlePasswordFieldChange}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                        >
                          {showNewPassword ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                          )}
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-slate-900 ml-1" htmlFor="confirmPassword">Confirmar contraseña</label>
                      <div className="relative">
                        <input
                          id="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Repetí la contraseña"
                          className="w-full rounded-2xl border border-slate-200 bg-white shadow-sm transition-all focus:ring-4 focus:ring-blue-50 focus:border-blue-400 px-7 py-3.5 text-[15px] pr-12"
                          value={passwordValues.confirmPassword}
                          onChange={handlePasswordFieldChange}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                        >
                          {showConfirmPassword ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-50">
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="w-full rounded-xl bg-[#1e3a5f] py-4 text-[15px] font-bold text-white shadow-xl shadow-blue-900/10 transition-all hover:bg-[#2c4f7c] disabled:opacity-50"
                      >
                        {isSaving
                          ? 'Guardando...'
                          : hasInternalPassword
                            ? 'Actualizar contraseña'
                            : 'Crear contraseña'}
                      </button>
                    </div>
                  </form>
                </Card>
              </div>
            )}

            {activeTab === 'account' && (
              <div className="space-y-6 animate-page-enter">
                <Card className="rounded-[32px] border-slate-100 p-8 shadow-sm border-red-100 bg-red-50/10">
                  <div className="mb-8">
                    <h2 className="text-xl font-extrabold text-red-600 tracking-tight">Zona de peligro</h2>
                    <p className="text-[14px] font-medium text-slate-500">
                      Eliminar tu cuenta es una acción irreversible.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-red-100 bg-white p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                      <h4 className="text-[15px] font-bold text-slate-900 mb-1">Eliminar cuenta permanentemente</h4>
                      <p className="text-[13px] font-medium text-slate-500 max-w-lg">
                        {isAdmin(profile) 
                          ? 'Al eliminar tu cuenta, también se eliminará toda la organización, incluyendo a todos los miembros, proyectos, tareas y registros de tiempo asociados. Esta acción no se puede deshacer.'
                          : 'Se eliminará tu cuenta y tus registros de tiempo. Tus tareas asignadas quedarán disponibles para otros miembros. Esta acción no se puede deshacer.'}
                      </p>
                    </div>

                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="rounded-xl border border-red-200 bg-red-50 px-6 py-3 text-[14px] font-bold text-red-600 hover:bg-red-100 hover:border-red-300 transition-all whitespace-nowrap"
                    >
                      Eliminar cuenta
                    </button>
                  </div>
                </Card>
              </div>
            )}

            {activeTab === 'billing' && (
              <div className="space-y-12 animate-page-enter">
                <Card className="rounded-[32px] border-slate-100 p-8 shadow-sm">
                  <div className="mb-8">
                    <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Plan actual</h2>
                    <p className="text-[14px] font-medium text-slate-500">Detalles de tu suscripcion en Tino Tasks.</p>
                  </div>

                  <div className="rounded-[32px] border-[3px] border-[#1e3a5f] bg-white p-7 md:p-10 relative overflow-hidden group">
                    <div className="md:absolute top-8 right-8 flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 text-emerald-600 w-fit mb-6 md:mb-0">
                      <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[12px] font-black uppercase tracking-widest">Plan activo</span>
                    </div>

                    <div className="space-y-8">
                      <div>
                        <h3 className="text-4xl font-black text-[#1e3a5f] tracking-tight">{currentPlan.name}</h3>
                        <p className="text-[15px] font-bold text-slate-400 mt-3 max-w-md">{currentPlan.desc}</p>
                      </div>
                      
                      <ul className="space-y-4">
                        {currentPlan.features.map((feature, i) => (
                          <li key={i} className="flex items-center gap-4 text-[15px] font-bold text-slate-700">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
                              <CheckCircle2 size={16} />
                            </div>
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </Card>

                <section className="space-y-8">
                  <div className="px-2">
                    <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Otros planes</h2>
                    <p className="text-[15px] font-medium text-slate-500 mt-1">Estamos trabajando en planes con mas capacidad. Te avisamos cuando esten disponibles.</p>
                  </div>

                  <div className="grid gap-8 md:grid-cols-2">
                    {otherPlans.map(([key, plan]) => (
                      <div key={key} className="rounded-[40px] border border-slate-100 bg-slate-50/40 p-10 flex flex-col transition-all hover:bg-white hover:shadow-xl hover:shadow-slate-200/40">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-3xl font-black text-slate-400 tracking-tight">{plan.name}</h3>
                          <span className="rounded-full bg-amber-50 px-4 py-1.5 text-[11px] font-black text-amber-600 uppercase tracking-widest border border-amber-100">Proximamente</span>
                        </div>
                        <p className="text-[14px] font-bold text-slate-400 mb-10 leading-relaxed">{plan.desc}</p>
                        
                        <ul className="space-y-5 flex-1">
                          {plan.features.map((f, j) => (
                            <li key={j} className="flex items-center gap-4 text-[14px] font-bold text-slate-300">
                              <CheckCircle2 size={18} />
                              {f}
                            </li>
                          ))}
                        </ul>

                        <button disabled className="mt-12 w-full rounded-2xl border-2 border-dashed border-slate-200 bg-transparent py-4 text-[14px] font-black text-slate-300 flex items-center justify-center gap-3">
                          <Lock size={18} />
                          No disponible aun
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}


          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteAccount}
        title="¿Eliminar cuenta permanentemente?"
        description={
          isAdmin(profile)
            ? "Atención: Al ser administrador, esta acción eliminará completamente la organización, incluyendo a todos los usuarios miembros, proyectos, tareas y tiempos registrados. Esta acción no se puede deshacer."
            : "Esta acción eliminará tu cuenta y tus registros de tiempo. Tus tareas asignadas quedarán disponibles. Esta acción no se puede deshacer."
        }
        confirmLabel="Eliminar cuenta"
        cancelLabel="Cancelar"
        tone="danger"
      />
    </ProtectedLayout>
  );
}

function PerfilPageFallback() {
  return (
    <ProtectedLayout>
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center">
          <p className="text-slate-400 font-medium">Cargando perfil...</p>
        </div>
      </div>
    </ProtectedLayout>
  );
}
