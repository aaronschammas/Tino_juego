'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiGet } from '@/lib/api';

interface InvitePreview {
  email: string;
  organizationName: string;
  expiresAt: string;
}

interface GoogleInviteUrlResponse {
  url: string;
}

const INVITE_REASON_LABELS: Record<string, string> = {
  invite_google_rejected:
    'Esta invitación fue generada para otro correo. Iniciá sesión con la cuenta Google correcta.',
  invalid_state: 'La sesión de Google expiró. Intentá nuevamente.',
  missing_params: 'Faltan parámetros del callback de Google.',
  oauth_not_configured: 'Google OAuth no está configurado.',
  oauth_exchange_failed: 'No se pudo validar la cuenta Google.',
  invalid_google_profile: 'Google no devolvió un perfil válido.',
  missing_access_token: 'Google no devolvió un token válido.',
  invite_accept_failed: 'No se pudo aceptar la invitación.',
};

export function AcceptInviteForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const googleReason = searchParams.get('reason');
  const googleMessage = searchParams.get('message');
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(token));
  const [isStartingGoogle, setIsStartingGoogle] = useState(false);
  const [error, setError] = useState<string | null>(
    googleMessage || (googleReason ? INVITE_REASON_LABELS[googleReason] : null),
  );

  useEffect(() => {
    if (!token) return;

    let mounted = true;
    setIsLoading(true);

    apiGet<InvitePreview>(`/invites/${encodeURIComponent(token)}`, {
      skipAuthRedirect: true,
    })
      .then((data) => {
        if (!mounted) return;
        setInvite(data);
      })
      .catch((previewError) => {
        if (!mounted) return;
        setError(
          previewError instanceof Error
            ? previewError.message
            : 'La invitación no es válida o expiró.',
        );
      })
      .finally(() => {
        if (!mounted) return;
        setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [token]);

  const handleAcceptWithGoogle = async () => {
    if (!token) {
      setError('Invalid invitation token');
      return;
    }

    setIsStartingGoogle(true);
    setError(null);

    try {
      const response = await apiGet<GoogleInviteUrlResponse>(
        `/auth/google/invite-url?token=${encodeURIComponent(token)}`,
        { skipAuthRedirect: true },
      );
      window.location.href = response.url;
    } catch (inviteError) {
      setError(
        inviteError instanceof Error
          ? inviteError.message
          : 'No se pudo iniciar la aceptación con Google.',
      );
      setIsStartingGoogle(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-lg bg-red-100 p-6 text-red-700">
          <p>Invalid invitation link. Missing or invalid token.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
        <div className="mb-6 space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
            Invitación a organización
          </p>
          <h1 className="text-2xl font-bold text-gray-900">Aceptar con Google</h1>
          <p className="text-sm text-gray-600">
            Para aceptar, iniciá sesión con la cuenta de Google correspondiente al correo invitado.
          </p>
        </div>

        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
            Cargando invitación...
          </div>
        ) : invite ? (
          <div className="mb-5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
            <p>
              <span className="font-semibold">Organización:</span> {invite.organizationName}
            </p>
            <p>
              <span className="font-semibold">Correo invitado:</span> {invite.email}
            </p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleAcceptWithGoogle}
          disabled={isLoading || isStartingGoogle}
          className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
        >
          {isStartingGoogle ? 'Redirigiendo...' : 'Aceptar con Google'}
        </button>
      </div>
    </div>
  );
}
