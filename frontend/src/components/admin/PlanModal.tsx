'use client';

import React, { useState, useEffect } from 'react';
import Portal from '@/components/ui/Portal';
import { apiPost, apiPut } from '@/lib/api';
import { Plan } from '@/types/organization';

interface PlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  plan?: Plan | null;
}

export default function PlanModal({ isOpen, onClose, onSuccess, plan }: PlanModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    title: '',
    description: '',
    price: 0,
    maxUsers: '',
    maxProjects: '',
    hasAnalytics: false,
    hasSso: false,
    hasPrioritySupport: false,
    hasEmailInvites: false,
    hasAdvancedPerms: false,
    hasAudit: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (plan) {
      setFormData({
        name: plan.name,
        title: plan.title,
        description: plan.description || '',
        price: plan.price,
        maxUsers: plan.maxUsers?.toString() || '',
        maxProjects: plan.maxProjects?.toString() || '',
        hasAnalytics: plan.hasAnalytics,
        hasSso: plan.hasSso,
        hasPrioritySupport: plan.hasPrioritySupport,
        hasEmailInvites: plan.hasEmailInvites,
        hasAdvancedPerms: plan.hasAdvancedPerms,
        hasAudit: plan.hasAudit,
      });
    } else {
      setFormData({
        name: '',
        title: '',
        description: '',
        price: 0,
        maxUsers: '',
        maxProjects: '',
        hasAnalytics: false,
        hasSso: false,
        hasPrioritySupport: false,
        hasEmailInvites: false,
        hasAdvancedPerms: false,
        hasAudit: false,
      });
    }
  }, [plan, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const dataToSend = {
        ...formData,
        price: Number(formData.price),
        maxUsers: formData.maxUsers === '' ? null : Number(formData.maxUsers),
        maxProjects: formData.maxProjects === '' ? null : Number(formData.maxProjects),
      };
      if (plan) {
        await apiPut(`/admin/plans/${plan.id}`, dataToSend);
      } else {
        await apiPost('/admin/plans', dataToSend);
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar el plan');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm overflow-y-auto">
        <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl rounded-[24px] bg-white p-6 shadow-2xl animate-page-enter my-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-900">
              {plan ? 'Editar Plan' : 'Nuevo Plan'}
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="mb-2 block text-sm font-semibold text-slate-900">
                  Identificador (slug)
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej. pro"
                />
              </div>

              <div>
                <label htmlFor="title" className="mb-2 block text-sm font-semibold text-slate-900">
                  Título
                </label>
                <input
                  id="title"
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej. Plan Pro"
                />
              </div>
            </div>

            <div>
              <label htmlFor="description" className="mb-2 block text-sm font-semibold text-slate-900">
                Descripción
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Descripción del plan"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="price" className="mb-2 block text-sm font-semibold text-slate-900">
                  Precio
                </label>
                <input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                  required
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="maxUsers" className="mb-2 block text-sm font-semibold text-slate-900">
                  Max Usuarios
                </label>
                <input
                  id="maxUsers"
                  type="number"
                  value={formData.maxUsers}
                  onChange={(e) => setFormData({ ...formData, maxUsers: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ilimitado"
                />
              </div>

              <div>
                <label htmlFor="maxProjects" className="mb-2 block text-sm font-semibold text-slate-900">
                  Max Proyectos
                </label>
                <input
                  id="maxProjects"
                  type="number"
                  value={formData.maxProjects}
                  onChange={(e) => setFormData({ ...formData, maxProjects: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ilimitado"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <input
                  id="hasAnalytics"
                  type="checkbox"
                  checked={formData.hasAnalytics}
                  onChange={(e) => setFormData({ ...formData, hasAnalytics: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="hasAnalytics" className="text-sm font-semibold text-slate-900">
                  Analytics
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="hasSso"
                  type="checkbox"
                  checked={formData.hasSso}
                  onChange={(e) => setFormData({ ...formData, hasSso: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="hasSso" className="text-sm font-semibold text-slate-900">
                  SSO
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="hasPrioritySupport"
                  type="checkbox"
                  checked={formData.hasPrioritySupport}
                  onChange={(e) => setFormData({ ...formData, hasPrioritySupport: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="hasPrioritySupport" className="text-sm font-semibold text-slate-900">
                  Soporte Prioritario
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="hasEmailInvites"
                  type="checkbox"
                  checked={formData.hasEmailInvites}
                  onChange={(e) => setFormData({ ...formData, hasEmailInvites: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="hasEmailInvites" className="text-sm font-semibold text-slate-900">
                  Invites por Email
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="hasAdvancedPerms"
                  type="checkbox"
                  checked={formData.hasAdvancedPerms}
                  onChange={(e) => setFormData({ ...formData, hasAdvancedPerms: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="hasAdvancedPerms" className="text-sm font-semibold text-slate-900">
                  Permisos Avanzados
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="hasAudit"
                  type="checkbox"
                  checked={formData.hasAudit}
                  onChange={(e) => setFormData({ ...formData, hasAudit: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="hasAudit" className="text-sm font-semibold text-slate-900">
                  Auditoría
                </label>
              </div>
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
