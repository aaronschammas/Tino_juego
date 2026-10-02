'use client';

/**
 * Panel del detalle de proyecto que muestra si esta conectado a Trello.
 *
 * `ProjectIntegrationPanel()` no muestra nada si el proyecto no tiene conexion
 * (o mientras carga). Si la tiene, muestra:
 * - el tablero con enlace, cuando y quien lo conecto;
 * - la actualizacion automatica: activa (con el ultimo cambio recibido) o
 *   inactiva, con boton "Reintentar" para el owner;
 * - la fecha de la ultima revision completa y, para el owner, "Sincronizar
 *   ahora", que corre la revision al instante y muestra un resumen
 *   (`describeSync()` arma ese texto);
 * - la equivalencia lista -> estado. Las listas "por definir" (por ejemplo, una
 *   lista nueva creada en Trello) quedan resaltadas. El owner puede cambiar
 *   cualquier equivalencia y guardar; los cambios pendientes se guardan en
 *   `edits` hasta apretar "Guardar equivalencias";
 * - "Desconectar" (solo owner), con confirmacion; las tareas quedan en el proyecto.
 *
 * `runAction()` ejecuta una accion del owner mostrando el error si falla.
 */
import { useState } from 'react';
import { ExternalLink, Link2, RefreshCw } from 'lucide-react';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useProjectIntegration } from '@/hooks/useIntegrations';
import { cn } from '@/lib/cn';
import { formatDateUTC } from '@/lib/time';
import { ReconcileResult } from '@/types/integration';
import { TaskStatus, taskStatusLabels } from '@/types/task';

function describeSync(result: ReconcileResult) {
  const parts = [
    [result.created, 'nuevas'],
    [result.updated, 'actualizadas'],
    [result.archived, 'archivadas'],
    [result.restored, 'restauradas'],
    [result.subtasksChanged, 'cambios en subtareas'],
    [result.commentsAdded + result.commentsUpdated, 'comentarios'],
  ]
    .filter(([count]) => Number(count) > 0)
    .map(([count, label]) => `${count} ${label}`);
  return parts.length > 0
    ? `Sincronizado: ${parts.join(', ')}.`
    : 'Sincronizado: no habia cambios pendientes.';
}

interface ProjectIntegrationPanelProps {
  projectId: string;
  canManage: boolean;
}

export default function ProjectIntegrationPanel({
  projectId,
  canManage,
}: ProjectIntegrationPanelProps) {
  const {
    connection,
    disconnect,
    enableLiveSync,
    updateStatusMappings,
    syncNow,
  } = useProjectIntegration(projectId);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [edits, setEdits] = useState<Record<string, TaskStatus>>({});
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!connection) return null;

  const runAction = async (action: () => Promise<unknown>, fallback: string) => {
    try {
      setBusy(true);
      setActionError(null);
      await action();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  };

  const pendingCount = connection.statusMappings.filter(
    (mapping) => !mapping.status && !edits[mapping.externalGroupId],
  ).length;
  const hasEdits = Object.keys(edits).length > 0;
  const { liveSync } = connection;

  return (
    <section
      aria-label="Integracion con Trello"
      className="mb-6 rounded-lg border border-blue-100 bg-white p-5 shadow-md"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-blue-700">
            <Link2 size={14} />
            Conectado a Trello
          </p>
          <p className="mt-1 truncate text-lg font-bold text-gray-900">
            {connection.container.url ? (
              <a
                href={connection.container.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:underline"
              >
                {connection.container.name}
                <ExternalLink size={14} />
              </a>
            ) : (
              connection.container.name
            )}
          </p>
          <p className="text-xs text-gray-500">
            Conectado el {formatDateUTC(connection.connectedAt)}
            {connection.connectedBy ? ` por ${connection.connectedBy.name}` : ''}
          </p>
        </div>
        {canManage ? (
          <Button variant="secondary" onClick={() => setConfirming(true)} disabled={busy}>
            Desconectar
          </Button>
        ) : null}
      </div>

      <div
        className={cn(
          'mt-4 flex flex-col gap-2 rounded-xl px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between',
          liveSync.active ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800',
        )}
      >
        <p className="font-semibold">
          {liveSync.active
            ? `Actualizacion automatica activa${
                liveSync.lastEventAt
                  ? ` · ultimo cambio ${formatDateUTC(liveSync.lastEventAt)}`
                  : ''
              }`
            : 'Actualizacion automatica inactiva: los cambios de Trello no se reflejan solos.'}
          {liveSync.lastSyncError ? ` (ultimo error: ${liveSync.lastSyncError})` : ''}
        </p>
        {canManage && !liveSync.active ? (
          <Button
            variant="secondary"
            onClick={() =>
              runAction(enableLiveSync, 'No se pudo activar la actualizacion automatica.')
            }
            disabled={busy}
          >
            <RefreshCw size={14} className="mr-1" />
            Reintentar
          </Button>
        ) : null}
      </div>

      <div className="mt-3 flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>
          {connection.lastSyncedAt
            ? `Ultima revision completa: ${formatDateUTC(connection.lastSyncedAt)}`
            : 'Todavia no hubo una revision completa.'}
          {syncMessage ? ` · ${syncMessage}` : ''}
        </p>
        {canManage ? (
          <Button
            variant="secondary"
            onClick={() =>
              runAction(async () => {
                const result = await syncNow();
                if (result) setSyncMessage(describeSync(result));
              }, 'No se pudo sincronizar con Trello.')
            }
            disabled={busy}
          >
            Sincronizar ahora
          </Button>
        ) : null}
      </div>

      <div className="mt-4">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
          Listas y estados
          {pendingCount > 0 ? ` · ${pendingCount} por definir` : ''}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {connection.statusMappings.map((mapping) => {
            const value = edits[mapping.externalGroupId] ?? mapping.status ?? '';
            return canManage ? (
              <label
                key={mapping.externalGroupId}
                className={cn(
                  'flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium',
                  value ? 'bg-slate-100 text-slate-700' : 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
                )}
              >
                {mapping.name} →
                <select
                  aria-label={`Estado para ${mapping.name}`}
                  value={value}
                  onChange={(event) =>
                    setEdits((current) => ({
                      ...current,
                      [mapping.externalGroupId]: event.target.value as TaskStatus,
                    }))
                  }
                  className="bg-transparent text-xs font-semibold outline-none"
                >
                  <option value="" disabled>
                    Por definir
                  </option>
                  {Object.values(TaskStatus).map((status) => (
                    <option key={status} value={status}>
                      {taskStatusLabels[status]}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <span
                key={mapping.externalGroupId}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
              >
                {mapping.name} → {mapping.status ? taskStatusLabels[mapping.status] : 'Por definir'}
              </span>
            );
          })}
        </div>
        {canManage && hasEdits ? (
          <div className="mt-3 flex gap-2">
            <Button
              onClick={() =>
                runAction(async () => {
                  await updateStatusMappings(
                    Object.entries(edits).map(([externalGroupId, status]) => ({
                      externalGroupId,
                      status,
                    })),
                  );
                  setEdits({});
                }, 'No se pudieron guardar las equivalencias.')
              }
              disabled={busy}
            >
              Guardar equivalencias
            </Button>
            <Button variant="secondary" onClick={() => setEdits({})} disabled={busy}>
              Descartar
            </Button>
          </div>
        ) : null}
      </div>

      {actionError ? (
        <p role="alert" className="mt-3 text-sm font-semibold text-red-700">
          {actionError}
        </p>
      ) : null}

      <ConfirmDialog
        isOpen={confirming}
        title="Desconectar Trello"
        description="El proyecto deja de estar conectado al tablero y se desactiva la actualizacion automatica. Las tareas ya importadas se mantienen."
        confirmLabel="Desconectar"
        tone="danger"
        onConfirm={() => {
          setConfirming(false);
          void runAction(disconnect, 'No se pudo desconectar el tablero.');
        }}
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
}
