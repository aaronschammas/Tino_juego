'use client';

import { useEffect, useState } from 'react';
import { useOrganizations } from '@/hooks/useOrganizations';
import { useAuth } from '@/hooks/useAuth';
import { OrganizationRole } from '@/types/organization';
import NoticeBanner from '@/components/ui/NoticeBanner';

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (email: string) => void;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }

  return fallback;
}

import Portal from '@/components/ui/Portal';

export default function InviteUserModal({ isOpen, onClose, onSuccess }: InviteUserModalProps) {
  const { user } = useAuth();
  const { inviteMember } = useOrganizations();
  const [formData, setFormData] = useState({
    email: '',
    role: 'ORG_MEMBER' as OrganizationRole,
  });
  const [step, setStep] = useState<'form' | 'confirm' | 'success'>('form');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [copyStatus, setCopyStatus] = useState('');

  useEffect(() => {
    if (isOpen) return;
    setFormData({ email: '', role: 'ORG_MEMBER' });
    setStep('form');
    setError('');
    setIsLoading(false);
    setInviteLink('');
    setCopyStatus('');
  }, [isOpen]);

  const handleClose = () => {
    setFormData({ email: '', role: 'ORG_MEMBER' });
    setStep('form');
    setError('');
    setIsLoading(false);
    setInviteLink('');
    setCopyStatus('');
    onClose();
  };

  const planName = typeof user?.organizationPlan === 'string' 
    ? user.organizationPlan 
    : user?.organizationPlan?.name;
  const isFreePlan = !planName || planName.toLowerCase() === 'free';

  if (!isOpen) return null;

  if (isFreePlan) {
    return (
      <Portal>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl animate-page-enter">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-[var(--color-ink-900)]">Invitaciones bloqueadas</h2>
              <button
                onClick={handleClose}
                className="text-xl font-semibold text-[var(--color-ink-400)] transition-colors hover:text-[var(--color-ink-700)]"
              >
                x
              </button>
            </div>

            <NoticeBanner title={`Plan ${planName} activo`} tone="warning">
              El plan {planName} permite hasta {user?.organizationPlan?.maxUsers || 1} {user?.organizationPlan?.maxUsers === 1 ? 'persona' : 'personas'} por organizacion. 
              Actualiza tu plan para sumar mas miembros.
            </NoticeBanner>

            <div className="pt-5">
              <button
                type="button"
                onClick={handleClose}
                className="w-full rounded-[14px] border border-[var(--color-border-soft)] px-4 py-2 font-semibold text-[var(--color-ink-700)] transition-colors hover:bg-[var(--color-ink-050)]"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </Portal>
    );
  }

  const handleSubmitForm = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!formData.email || !formData.email.includes('@')) {
      setError('Ingresa un email valido.');
      return;
    }

    setStep('confirm');
  };

  const handleConfirm = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await inviteMember({
        email: formData.email,
        role: formData.role,
      });

      setInviteLink(response.inviteLink);
      setStep('success');
      onSuccess?.(formData.email);
    } catch (inviteError) {
      setError(getErrorMessage(inviteError, 'No se pudo enviar la invitacion.'));
      setStep('form');
      setIsLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!inviteLink) return;

    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopyStatus('Link copiado');
    } catch {
      setCopyStatus('No se pudo copiar el link');
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl animate-page-enter">
          {step === 'form' ? (
            <>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-[var(--color-ink-900)]">Invitar miembro</h2>
                  <p className="mt-1 text-sm text-[var(--color-ink-500)]">
                    Envia acceso y define el rol inicial.
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="text-xl font-semibold text-[var(--color-ink-400)] transition-colors hover:text-[var(--color-ink-700)]"
                >
                  x
                </button>
              </div>

              <form onSubmit={handleSubmitForm} className="space-y-4">
                {error ? (
                  <NoticeBanner tone="error" title="No pudimos continuar">
                    {error}
                  </NoticeBanner>
                ) : null}

                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-semibold text-[var(--color-ink-900)]">
                    Email del miembro
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                    required
                    className="app-input"
                    placeholder="usuario@ejemplo.com"
                  />
                </div>

                <div>
                  <label htmlFor="role" className="mb-2 block text-sm font-semibold text-[var(--color-ink-900)]">
                    Rol
                  </label>
                  <select
                    id="role"
                    value={formData.role}
                    onChange={(event) =>
                      setFormData({ ...formData, role: event.target.value as OrganizationRole })
                    }
                    className="app-input"
                  >
                    <option value="ORG_MEMBER">Miembro</option>
                    <option value="ORG_OWNER">Propietario</option>
                  </select>
                </div>

                <NoticeBanner tone="info" title="Asignacion de proyectos">
                  Primero invita a la persona a la organizacion. Cuando acepte la invitacion, vas a poder asignarla a proyectos.
                </NoticeBanner>

                <NoticeBanner tone="info" title="Aceptacion con Google">
                  Compartí este link con la persona invitada. Para aceptar, deberá iniciar sesión con la cuenta de Google correspondiente a ese correo.
                </NoticeBanner>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 rounded-[14px] border border-[var(--color-border-soft)] px-4 py-2 font-semibold text-[var(--color-ink-700)] transition-colors hover:bg-[var(--color-ink-050)]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-[14px] bg-[var(--color-primary-600)] px-4 py-2 font-semibold text-white transition-colors hover:bg-[var(--color-primary-700)]"
                  >
                    Revisar invitacion
                  </button>
                </div>
              </form>
            </>
          ) : null}

          {step === 'confirm' ? (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-[var(--color-ink-900)]">Confirmar invitacion</h2>
                <p className="mt-1 text-sm text-[var(--color-ink-500)]">
                  Revisa los datos antes de enviarla.
                </p>
              </div>

              <div className="mb-6 space-y-3 rounded-[20px] border border-[var(--color-primary-soft)] bg-[var(--color-primary-soft)]/30 p-4">
                <p className="text-sm text-[var(--color-ink-700)]">
                  <span className="font-semibold">Email:</span> {formData.email}
                </p>
                <p className="text-sm text-[var(--color-ink-700)]">
                  <span className="font-semibold">Rol:</span>{' '}
                  {formData.role === 'ORG_OWNER' ? 'Propietario' : 'Miembro'}
                </p>
                <p className="text-sm text-[var(--color-ink-700)]">
                  Primero invita a la persona a la organizacion. Cuando acepte la invitacion, vas a poder asignarla a proyectos.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('form')}
                  disabled={isLoading}
                  className="flex-1 rounded-[14px] border border-[var(--color-border-soft)] px-4 py-2 font-semibold text-[var(--color-ink-700)] transition-colors hover:bg-[var(--color-ink-050)] disabled:opacity-50"
                >
                  Volver
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={isLoading}
                  className="flex-1 rounded-[14px] bg-[var(--color-primary-600)] px-4 py-2 font-semibold text-white transition-colors hover:bg-[var(--color-primary-700)] disabled:opacity-50"
                >
                  {isLoading ? 'Enviando...' : 'Enviar invitacion'}
                </button>
              </div>
            </>
          ) : null}

          {step === 'success' ? (
            <div className="py-6">
              <div className="mb-4 text-5xl">OK</div>
              <h2 className="mb-2 text-2xl font-bold text-[var(--color-ink-900)]">
                Invitacion enviada
              </h2>
              <p className="mb-4 text-sm text-[var(--color-ink-500)]">
                Compartí este link con la persona invitada. Para aceptar, deberá iniciar sesión con la cuenta de Google correspondiente a ese correo.
              </p>
              <div className="mb-4 rounded-[16px] border border-[var(--color-border-soft)] bg-[var(--color-ink-050)] p-3 text-left">
                <p className="break-all text-sm text-[var(--color-ink-700)]">{inviteLink}</p>
              </div>
              {copyStatus ? (
                <p className="mb-3 text-center text-sm font-medium text-[var(--color-ink-600)]">{copyStatus}</p>
              ) : null}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex-1 rounded-[14px] bg-[var(--color-primary-600)] px-4 py-2 font-semibold text-white transition-colors hover:bg-[var(--color-primary-700)]"
                >
                  Copiar link
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 rounded-[14px] border border-[var(--color-border-soft)] px-4 py-2 font-semibold text-[var(--color-ink-700)] transition-colors hover:bg-[var(--color-ink-050)]"
                >
                  Cerrar
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Portal>
  );
}
