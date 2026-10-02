'use client';

import React, { useState, useEffect } from 'react';
import Portal from '@/components/ui/Portal';
import { apiPost, apiPut, apiGet } from '@/lib/api';

interface OrgModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  organization?: { id: string; name: string; isActive: boolean; planId?: string | null } | null;
}

export default function OrgModal({ isOpen, onClose, onSuccess, organization }: OrgModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    planId: '',
    isActive: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [plans, setPlans] = useState<{ id: string; name: string; title: string }[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetchPlans();
    }
  }, [isOpen]);

  const fetchPlans = async () => {
    try {
      const data = await apiGet<{ id: string; name: string; title: string }[]>('/plans');
      setPlans(data);
    } catch (err) {
      console.error('Error fetching plans:', err);
    }
  };

  useEffect(() => {
    if (organization) {
      setFormData({
        name: organization.name,
        planId: organization.planId || '',
        isActive: organization.isActive,
      });
    } else {
      setFormData({
        name: '',
        planId: '',
        isActive: true,
      });
    }
  }, [organization, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const dataToSend = {
        ...formData,
        planId: formData.planId === '' ? null : formData.planId,
      };
      if (organization) {
        await apiPut(`/admin/orgs/${organization.id}`, dataToSend);
      } else {
        await apiPost('/admin/orgs', dataToSend);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error al guardar la organización');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
        <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl animate-page-enter">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-900">
              {organization ? 'Editar Organización' : 'Nueva Organización'}
            </h2>
            <button
              onClick={onClose}
              className="text-xl font-semibold text-slate-400 hover:text-slate-700 transition-colors"
            >
              x
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="name" className="mb-2 block text-sm font-semibold text-slate-900">
                Nombre de la Organización
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ej. Mi Empresa"
              />
            </div>

            <div>
              <label htmlFor="planId" className="mb-2 block text-sm font-semibold text-slate-900">
                Plan
              </label>
              <select
                id="planId"
                value={formData.planId}
                onChange={(e) => setFormData({ ...formData, planId: e.target.value })}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sin Plan</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.title || plan.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="isActive"
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="isActive" className="text-sm font-semibold text-slate-900">
                Organización Activa
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 rounded-lg bg-[#1e3a5f] px-4 py-2 font-semibold text-white transition-colors hover:bg-[#152a46] disabled:opacity-50"
              >
                {isLoading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
}
