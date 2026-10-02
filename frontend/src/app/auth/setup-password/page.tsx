'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiPost } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { User } from '@/types/user';

interface SetInternalPasswordResponse {
  user: User;
}

export default function SetupPasswordPage() {
  const router = useRouter();
  const { user, isLoading, updateUser } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (!user.requiresInternalPasswordSetup) {
      router.replace('/dashboard');
    }
  }, [isLoading, router, user]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setIsSaving(true);
    try {
      const response = await apiPost<SetInternalPasswordResponse>(
        '/auth/set-internal-password',
        { password },
      );
      updateUser(response.user);
      router.replace('/dashboard');
    } catch (setupError) {
      setError(
        setupError instanceof Error
          ? setupError.message
          : 'No se pudo guardar la contraseña.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !user || !user.requiresInternalPasswordSetup) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-4">
        <p className="text-sm font-medium text-slate-500">Preparando acceso...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl"
      >
        <div className="mb-6 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
            Seguridad de cuenta
          </p>
          <h1 className="text-2xl font-bold text-slate-900">Crear contraseña interna</h1>
          <p className="text-sm text-slate-600">
            Creá una contraseña interna para poder acceder también con email y contraseña.
          </p>
        </div>

        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="space-y-4">
          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-slate-700">
              Confirmar contraseña
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="mt-6 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
        >
          {isSaving ? 'Guardando...' : 'Guardar contraseña'}
        </button>
      </form>
    </main>
  );
}
