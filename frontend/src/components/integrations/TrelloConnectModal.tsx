'use client';

/**
 * Modal "Conectar Trello" para owners con Plan Max (version temprana para QA).
 *
 * Pasos: 1) autorizar a Tino en Trello (ventana emergente, el token queda en
 * memoria); 2) elegir tablero y destino (proyecto nuevo o existente);
 * 3) revisar la equivalencia lista -> estado: viene sugerida y las listas sin
 * equivalencia quedan resaltadas hasta que se elija un estado; 4) conectar, lo
 * que importa todo y deja el proyecto conectado.
 *
 * - `TrelloConnectModal()`: arma los pasos con `useTrelloConnection`. El padre
 *   lo monta solo mientras esta abierto, asi al cerrarlo se descarta todo el
 *   estado, incluido el token. Al cambiar de tablero o destino se descarta la
 *   vista previa; la equivalencia mostrada es la sugerida mas lo que el usuario
 *   cambio a mano (`edits`).
 * - `buildInitialMapping()`: toma los estados sugeridos por el backend como
 *   punto de partida editable.
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Link2, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import Portal from '@/components/ui/Portal';
import { useTrelloConnection } from '@/hooks/useTrelloConnection';
import { cn } from '@/lib/cn';
import {
  ConnectionTargetMode,
  StatusMappingSuggestion,
} from '@/types/integration';
import { Project } from '@/types/project';
import { TaskStatus, taskStatusLabels } from '@/types/task';

interface TrelloConnectModalProps {
  projects: Project[];
  onClose: () => void;
  onConnected: () => Promise<void> | void;
}

type MappingState = Record<string, TaskStatus | ''>;

function buildInitialMapping(suggestions: StatusMappingSuggestion[]): MappingState {
  return Object.fromEntries(
    suggestions.map((entry) => [entry.externalGroupId, entry.suggestedStatus ?? '']),
  );
}

export default function TrelloConnectModal({
  projects,
  onClose,
  onConnected,
}: TrelloConnectModalProps) {
  const {
    token,
    boards,
    previewData,
    result,
    isLoading,
    error,
    authorize,
    preview,
    connect,
    clearPreview,
  } = useTrelloConnection();
  const [chosenBoardId, setChosenBoardId] = useState('');
  const [mode, setMode] = useState<ConnectionTargetMode>(ConnectionTargetMode.NEW_PROJECT);
  const [chosenProjectId, setChosenProjectId] = useState('');
  const [edits, setEdits] = useState<MappingState>({});

  const boardId = chosenBoardId || boards[0]?.id || '';
  const projectId = chosenProjectId || projects[0]?.id || '';

  const mapping = useMemo<MappingState>(
    () => ({
      ...(previewData ? buildInitialMapping(previewData.statusMapping) : {}),
      ...edits,
    }),
    [previewData, edits],
  );
  const unmappedCount = Object.values(mapping).filter((status) => !status).length;

  const changeTarget = (apply: () => void) => {
    apply();
    setEdits({});
    clearPreview();
  };

  const request = () => ({
    token: token ?? '',
    boardId,
    mode,
    ...(mode === ConnectionTargetMode.EXISTING_PROJECT ? { projectId } : {}),
  });

  const handlePreview = async () => {
    await preview(request()).catch(() => undefined);
  };

  const handleConnect = async () => {
    if (!previewData || unmappedCount > 0) return;
    const statusMapping = Object.entries(mapping)
      .filter((entry): entry is [string, TaskStatus] => Boolean(entry[1]))
      .map(([externalGroupId, status]) => ({ externalGroupId, status }));
    const done = await connect({ ...request(), statusMapping }).catch(() => null);
    if (done) await onConnected();
  };

  const canPreview =
    Boolean(token && boardId) &&
    (mode === ConnectionTargetMode.NEW_PROJECT || Boolean(projectId));
  const connectDisabled =
    isLoading || !previewData || previewData.importDisabled || unmappedCount > 0 || !!result;

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-primary)]/40 p-4 backdrop-blur-[2px]">
        <div
          role="dialog"
          aria-labelledby="trello-connect-title"
          className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[28px] bg-white shadow-[var(--shadow-lg)] animate-page-enter"
        >
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white px-6 py-5">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                Trello · Version de prueba
              </p>
              <h2 id="trello-connect-title" className="text-2xl font-black tracking-tight text-slate-900">
                Conectar tablero
              </h2>
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={18} />
            </button>
          </div>

          <div className="grid gap-6 px-6 py-6 lg:grid-cols-[340px_1fr]">
            <div className="space-y-5">
              {token ? (
                <div className="flex items-center gap-2 rounded-2xl border border-green-100 bg-green-50 p-3 text-sm font-bold text-green-800">
                  <CheckCircle2 size={16} />
                  Trello autorizado
                </div>
              ) : (
                <Button
                  onClick={() => authorize().catch(() => undefined)}
                  disabled={isLoading}
                  fullWidth
                  className="h-12 rounded-xl font-bold"
                >
                  <Link2 size={18} className="mr-2" />
                  Autorizar Trello
                </Button>
              )}

              <div>
                <label htmlFor="trello-connect-board" className="app-label">
                  Tablero
                </label>
                <select
                  id="trello-connect-board"
                  value={boardId}
                  disabled={!token}
                  onChange={(event) => changeTarget(() => setChosenBoardId(event.target.value))}
                  className="app-select"
                >
                  <option value="">Selecciona un tablero</option>
                  {boards.map((board) => (
                    <option key={board.id} value={board.id}>
                      {board.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="trello-connect-mode" className="app-label">
                  Destino
                </label>
                <select
                  id="trello-connect-mode"
                  value={mode}
                  disabled={!token}
                  onChange={(event) =>
                    changeTarget(() => setMode(event.target.value as ConnectionTargetMode))
                  }
                  className="app-select"
                >
                  <option value={ConnectionTargetMode.NEW_PROJECT}>Crear proyecto nuevo</option>
                  <option value={ConnectionTargetMode.EXISTING_PROJECT}>
                    Conectar a un proyecto existente
                  </option>
                </select>
              </div>

              {mode === ConnectionTargetMode.EXISTING_PROJECT ? (
                <div>
                  <label htmlFor="trello-connect-project" className="app-label">
                    Proyecto Tino
                  </label>
                  <select
                    id="trello-connect-project"
                    value={projectId}
                    onChange={(event) => changeTarget(() => setChosenProjectId(event.target.value))}
                    className="app-select"
                  >
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <Button
                onClick={handlePreview}
                disabled={isLoading || !canPreview}
                variant="secondary"
                fullWidth
                className="h-12 rounded-xl font-bold"
              >
                Ver vista previa
              </Button>

              {error ? (
                <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">
                  {error}
                </div>
              ) : null}
            </div>

            <div className="min-h-[480px] rounded-[24px] border border-slate-100 bg-slate-50/70 p-5">
              {!previewData ? (
                <div className="flex h-full min-h-[440px] flex-col items-center justify-center text-center">
                  <Link2 size={42} className="text-slate-300" />
                  <h3 className="mt-4 text-lg font-black text-slate-900">Vista previa pendiente</h3>
                  <p className="mt-2 max-w-md text-sm font-medium text-slate-500">
                    Autoriza Trello, elegi el tablero y el destino. Antes de escribir en Tino vas a
                    revisar como se traduce cada lista.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                      {previewData.board.name}
                    </p>
                    <h3 className="text-xl font-black text-slate-900">Listas y estados</h3>
                  </div>

                  {previewData.blockedReason ? (
                    <div className="flex gap-2 rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                      <AlertTriangle size={18} className="shrink-0" />
                      {previewData.blockedReason}
                    </div>
                  ) : null}

                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-black text-slate-900">
                      {unmappedCount > 0
                        ? `Falta definir ${unmappedCount} ${unmappedCount === 1 ? 'lista' : 'listas'}`
                        : 'Todas las listas tienen estado'}
                    </p>
                    <div className="mt-3 space-y-2">
                      {previewData.statusMapping.map((entry) => {
                        const value = mapping[entry.externalGroupId] ?? '';
                        return (
                          <div
                            key={entry.externalGroupId}
                            className={cn(
                              'flex flex-col gap-2 rounded-xl px-3 py-2 sm:flex-row sm:items-center sm:justify-between',
                              value ? 'bg-slate-50' : 'bg-amber-50 ring-1 ring-amber-200',
                            )}
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-slate-900">{entry.name}</p>
                              <p className="text-xs font-medium text-slate-500">
                                {entry.itemCount} tarjetas
                                {entry.suggestedStatus ? ' · sugerido automaticamente' : ' · definir a mano'}
                              </p>
                            </div>
                            <select
                              aria-label={`Estado para ${entry.name}`}
                              value={value}
                              onChange={(event) =>
                                setEdits((current) => ({
                                  ...current,
                                  [entry.externalGroupId]: event.target.value as TaskStatus | '',
                                }))
                              }
                              className="app-select sm:w-48"
                            >
                              <option value="">Elegir estado</option>
                              {Object.values(TaskStatus).map((status) => (
                                <option key={status} value={status}>
                                  {taskStatusLabels[status]}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      ['Tareas nuevas', previewData.totals.newTasks],
                      ['Subtareas nuevas', previewData.totals.newSubtasks],
                      ['Ya en Tino', previewData.totals.duplicateTasks],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl bg-white p-4 shadow-sm">
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</p>
                        <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
                      </div>
                    ))}
                  </div>

                  {result ? (
                    <div className="rounded-xl border border-green-100 bg-green-50 p-4 text-sm font-semibold text-green-800">
                      Tablero conectado: {result.result.createdTasks} tareas y{' '}
                      {result.result.createdSubtasks} subtareas importadas.
                      {result.liveSync?.active
                        ? ' Los cambios de Trello se van a ver en Tino automaticamente.'
                        : ' La actualizacion automatica no se pudo activar; podes reintentarla desde el proyecto.'}
                    </div>
                  ) : null}

                  <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                    <Button variant="secondary" onClick={onClose}>
                      Cerrar
                    </Button>
                    <Button
                      onClick={handleConnect}
                      disabled={connectDisabled}
                      className="min-w-44 rounded-xl font-bold"
                    >
                      {isLoading ? 'Conectando...' : 'Conectar e importar'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
