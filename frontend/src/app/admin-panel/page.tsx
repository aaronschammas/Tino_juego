'use client';

import { useAuth } from '@/hooks/useAuth';
import { isSuperAdmin } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Navbar from '@/components/layout/Navbar';
import { ShieldCheck, Users } from 'lucide-react';
import Link from 'next/link';

export default function AdminPanelPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isSuperAdmin(user)) {
      router.replace('/dashboard');
    }
  }, [user, isLoading, router]);

  if (isLoading || !isSuperAdmin(user)) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-[1600px] px-4 pt-28 pb-8 md:px-8">
        <div className="flex flex-col gap-8 animate-page-enter">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 text-[#1e3a5f]">
              <ShieldCheck size={32} />
              <h1 className="text-3xl font-extrabold tracking-tight">Panel de Administración</h1>
            </div>
            <p className="text-slate-500 font-medium ml-11">
              Gestión global del sistema (Acceso exclusivo para Super Admins)
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Link href="/admin-panel/users-orgs" className="rounded-[32px] border border-slate-100 bg-white p-8 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col gap-4">
              <div className="flex items-center gap-3 text-[#1e3a5f]">
                <Users size={24} />
                <h2 className="text-xl font-bold text-slate-900">Gestión de Organizaciones</h2>
              </div>
              <p className="text-slate-500">
                Ver y gestionar organizaciones, miembros y planes.
              </p>
            </Link>

            {/* Card de prueba */}
            <div className="rounded-[32px] border border-slate-100 bg-white p-8 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Métricas Globales</h2>
              <p className="text-slate-500">
                Próximamente: Estadísticas de uso de todas las organizaciones.
              </p>
            </div>

            <Link href="/admin-panel/edit-plan" className="rounded-[32px] border border-slate-100 bg-white p-8 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col gap-4">
              <div className="flex items-center gap-3 text-[#1e3a5f]">
                <ShieldCheck size={24} />
                <h2 className="text-xl font-bold text-slate-900">Gestión de Planes</h2>
              </div>
              <p className="text-slate-500">
                Ver y gestionar planes, precios y límites.
              </p>
            </Link>

            <div className="rounded-[32px] border border-slate-100 bg-white p-8 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Soporte</h2>
              <p className="text-slate-500">
                Próximamente: Tickets y mensajes del sistema.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
