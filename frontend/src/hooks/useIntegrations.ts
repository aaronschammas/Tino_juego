/**
 * Hooks de lectura de integraciones.
 *
 * - `useIntegrationAvailability()`: consulta una vez si la organizacion activa
 *   puede usar integraciones. Ante un error queda en `null`, asi la UI
 *   simplemente no muestra el boton.
 * - `useProjectIntegration()`: conexion de un proyecto con `refresh()`,
 *   `disconnect()` (vuelve a `null` y avisa con `projects:updated`),
 *   `enableLiveSync()` (reintenta la actualizacion automatica) y
 *   `updateStatusMappings()` (guarda equivalencias y avisa con `task:updated`
 *   porque pueden cambiar estados) y `syncNow()` (revision inmediata contra
 *   Trello; avisa con `task:updated` y `projects:updated`). Las ultimas tres
 *   recargan la conexion.
 */
import { useCallback, useEffect, useState } from 'react';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';
import {
  IntegrationAvailability,
  LiveSyncStatus,
  ProjectIntegrationConnection,
  ReconcileResult,
  StatusMappingEntry,
} from '@/types/integration';

export function useIntegrationAvailability() {
  const [availability, setAvailability] = useState<IntegrationAvailability | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiGet<IntegrationAvailability>('/integrations/availability')
      .then((data) => {
        if (!cancelled) setAvailability(data);
      })
      .catch(() => {
        if (!cancelled) setAvailability(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { availability, isLoading };
}

export function useProjectIntegration(projectId: string | undefined) {
  const [connection, setConnection] = useState<ProjectIntegrationConnection | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(projectId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiGet<{ connection: ProjectIntegrationConnection | null }>(
        `/integrations/projects/${projectId}`,
      );
      setConnection(data?.connection ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al consultar la integracion');
      setConnection(null);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  const disconnect = useCallback(async () => {
    if (!projectId) return;
    await apiDelete(`/integrations/projects/${projectId}`);
    setConnection(null);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('projects:updated'));
    }
  }, [projectId]);

  const enableLiveSync = useCallback(async () => {
    if (!projectId) return null;
    const status = await apiPost<LiveSyncStatus>(
      `/integrations/projects/${projectId}/live-sync`,
    );
    await refresh();
    return status;
  }, [projectId, refresh]);

  const updateStatusMappings = useCallback(
    async (statusMapping: StatusMappingEntry[]) => {
      if (!projectId) return;
      await apiPatch(`/integrations/projects/${projectId}/status-mappings`, {
        statusMapping,
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('task:updated'));
      }
      await refresh();
    },
    [projectId, refresh],
  );

  const syncNow = useCallback(async () => {
    if (!projectId) return null;
    const result = await apiPost<ReconcileResult>(
      `/integrations/projects/${projectId}/sync`,
    );
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('task:updated'));
      window.dispatchEvent(new Event('projects:updated'));
    }
    await refresh();
    return result;
  }, [projectId, refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    connection,
    isLoading,
    error,
    refresh,
    disconnect,
    enableLiveSync,
    updateStatusMappings,
    syncNow,
  };
}
