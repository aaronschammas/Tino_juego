'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { isSuperAdmin } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import { ShieldCheck, Plus, Pencil, Trash2 } from 'lucide-react';
import { apiGet, apiDelete } from '@/lib/api';
import { Plan } from '@/types/organization';
import PlanModal from '@/components/admin/PlanModal';

export default function EditPlanPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  // Modal states
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  useEffect(() => {
    if (!isLoading && !isSuperAdmin(user)) {
      router.replace('/dashboard');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (isSuperAdmin(user)) {
      fetchPlans();
    }
  }, [user]);

  const fetchPlans = async () => {
    setLoadingPlans(true);
    try {
      const data = await apiGet<Plan[]>('/admin/plans');
      setPlans(data);
    } catch (error) {
      console.error('Error fetching plans:', error);
    } finally {
      setLoadingPlans(false);
    }
  };

  const handleDeletePlan = async (id: string) => {
    if (!window.confirm('¿Estás seguro de eliminar este plan?')) {
      return;
    }

    try {
      await apiDelete(`/admin/plans/${id}`);
      fetchPlans();
    } catch (error) {
      console.error('Error deleting plan:', error);
      alert(error instanceof Error ? error.message : 'Error al eliminar el plan');
    }
  };

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
              <h1 className="text-3xl font-extrabold tracking-tight">Gestión de Planes</h1>
            </div>
            <p className="text-slate-500 font-medium ml-11">
              Administración de planes de suscripción, precios y límites.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-xl font-bold text-slate-900">Planes Disponibles</h2>
            <button 
              onClick={() => {
                setSelectedPlan(null);
                setIsPlanModalOpen(true);
              }}
              className="flex items-center gap-2 bg-[#1e3a5f] text-white px-4 py-2 rounded-lg hover:bg-[#152a46] transition-colors w-full sm:w-auto justify-center"
            >
              <Plus size={16} />
              Nuevo Plan
            </button>
          </div>

          {loadingPlans ? (
            <div className="text-center text-slate-500 py-8">Cargando planes...</div>
          ) : (
            <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Título</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Identificador</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Precio</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Límites</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {plans.map((plan) => (
                      <tr key={plan.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-medium text-slate-900">{plan.title}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-slate-600">{plan.name}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-slate-600">${plan.price}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-slate-600 text-sm">
                          <div>Users: {plan.maxUsers ?? 'Ilimitado'}</div>
                          <div>Projects: {plan.maxProjects ?? 'Ilimitado'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => {
                                setSelectedPlan(plan);
                                setIsPlanModalOpen(true);
                              }}
                              className="text-blue-600 hover:text-blue-900 p-1"
                            >
                              <Pencil size={16} />
                            </button>
                            <button 
                              onClick={() => handleDeletePlan(plan.id)}
                              className="text-red-600 hover:text-red-900 p-1"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      <PlanModal 
        isOpen={isPlanModalOpen} 
        onClose={() => setIsPlanModalOpen(false)} 
        onSuccess={fetchPlans} 
        plan={selectedPlan}
      />
    </div>
  );
}
