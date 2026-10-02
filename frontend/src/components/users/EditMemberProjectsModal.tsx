'use client';

import { useState, useEffect } from 'react';
import { useProjects } from '@/hooks/useProjects';
import { useOrganizations } from '@/hooks/useOrganizations';
import { useAuth } from '@/hooks/useAuth';
import { isAdmin } from '@/lib/auth';
import { translateErrorMessage } from '@/lib/errorMessages';

interface EditMemberProjectsModalProps {
  isOpen: boolean;
  memberId: string;
  memberEmail: string;
  currentProjectIds: string[];
  onClose: () => void;
  onSuccess?: () => void;
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

export default function EditMemberProjectsModal({
  isOpen,
  memberId,
  memberEmail,
  currentProjectIds,
  onClose,
  onSuccess,
}: EditMemberProjectsModalProps) {
  const { projects, isLoading: projectsLoading, refetch } = useProjects();
  const { updateMemberProjects } = useOrganizations();
  const { user, activeMembership } = useAuth();
  const canManageMemberProjects = isAdmin(user) || activeMembership?.role === 'ORG_OWNER';
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(currentProjectIds);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    setSearchTerm('');
    const initProjects = async () => {
      setIsInitializing(true);
      try {
        await refetch();
      } finally {
        setIsInitializing(false);
      }
    };

    initProjects();
  }, [isOpen, refetch]);

  useEffect(() => {
    if (!isOpen) return;

    const syncProjects = () => {
      refetch();
    };

    window.addEventListener('projects:updated', syncProjects);
    return () => {
      window.removeEventListener('projects:updated', syncProjects);
    };
  }, [isOpen, refetch]);

  if (!isOpen) return null;

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchTerm.trim().toLowerCase()),
  );

  const toggleProject = (projectId: string) => {
    setSelectedProjectIds((prev) =>
      prev.includes(projectId) ? prev.filter((id) => id !== projectId) : [...prev, projectId]
    );
  };

  const handleSave = async () => {
    if (!canManageMemberProjects) return;
    setIsLoading(true);
    setError('');

    try {
      await updateMemberProjects(memberId, selectedProjectIds);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(translateErrorMessage(getErrorMessage(err, ''), 'Error al actualizar proyectos'));
      setIsLoading(false);
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 animate-page-enter">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Asignar proyectos</h2>
              <p className="text-sm text-gray-500 mt-1">{memberEmail}</p>
            </div>
            <button
              onClick={onClose}
              disabled={isLoading}
              className="text-gray-400 hover:text-gray-600 text-xl font-semibold disabled:opacity-50"
            >
              ✕
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {!canManageMemberProjects && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
              Solo los propietarios de la organización pueden asignar proyectos a un miembro.
            </div>
          )}

          {/* Projects List */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Selecciona en qué proyectos participa esta persona
            </label>

            {projects.length > 5 ? (
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar proyecto"
                className="mb-3 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-medium outline-none transition-all placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            ) : null}

            {isInitializing || projectsLoading ? (
              <div className="text-sm text-gray-500 py-4 text-center">Cargando proyectos...</div>
            ) : projects.length === 0 ? (
              <div className="text-sm text-gray-500 py-4 text-center p-3 bg-gray-50 rounded-lg">
                No hay proyectos cargados.
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="text-sm text-gray-500 py-4 text-center p-3 bg-gray-50 rounded-lg">
                No encontramos proyectos con ese nombre.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3">
                {filteredProjects.map((project) => (
                  <div key={project.id} className="flex items-center">
                    <input
                      type="checkbox"
                      id={`project-${project.id}`}
                      checked={selectedProjectIds.includes(project.id)}
                      onChange={() => toggleProject(project.id)}
                      disabled={isLoading || !canManageMemberProjects}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    />
                    <label
                      htmlFor={`project-${project.id}`}
                      className="ml-3 text-sm font-medium text-gray-700 cursor-pointer"
                    >
                      {project.name}
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">Participa en:</span>{' '}
              {selectedProjectIds.length === 0 ? (
                <span className="text-gray-500">ninguno</span>
              ) : (
                selectedProjectIds.length
              )}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading || !canManageMemberProjects}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

