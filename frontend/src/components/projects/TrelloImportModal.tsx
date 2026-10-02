'use client';

/**
 * Importacion manual de un tablero de Trello (solo SUPERADMIN).
 *
 * - `TrelloImportModal()`: en vez de pegar API key y token, el SUPERADMIN toca
 *   "Autorizar Trello": se abre la ventana de Trello, entra con su cuenta (puede
 *   ser con Google) y acepta el acceso de solo lectura. Con eso se cargan sus
 *   tableros y se elige el primero. Despues elige tablero y destino, genera la
 *   vista previa e importa. "Cambiar cuenta" vuelve a abrir la autorizacion.
 *   Al cerrar el modal se descarta todo, incluido el token.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  DownloadCloud,
  Link2,
  X,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Portal from '@/components/ui/Portal';
import { Project } from '@/types/project';
import { TrelloImportMode, TrelloImportRequest } from '@/types/trello-import';
import { useTrelloImport } from '@/hooks/useTrelloImport';
import { cn } from '@/lib/cn';

interface TrelloImportModalProps {
  isOpen: boolean;
  projects: Project[];
  onClose: () => void;
  onImported: () => Promise<void> | void;
}

export default function TrelloImportModal({
  isOpen,
  projects,
  onClose,
  onImported,
}: TrelloImportModalProps) {
  const {
    token,
    boards,
    previewData,
    result,
    isLoading,
    error,
    authorize,
    preview,
    executeImport,
    reset,
  } = useTrelloImport();
  const [boardId, setBoardId] = useState('');
  const [mode, setMode] = useState<TrelloImportMode>(TrelloImportMode.NEW_PROJECT);
  const [projectId, setProjectId] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      reset();
      setBoardId('');
      setProjectId('');
      setMode(TrelloImportMode.NEW_PROJECT);
      setLocalError(null);
    }
  }, [isOpen, reset]);

  useEffect(() => {
    if (!projectId && projects[0]?.id) {
      setProjectId(projects[0].id);
    }
  }, [projectId, projects]);

  const selectedBoard = useMemo(
    () => boards.find((board) => board.id === boardId),
    [boardId, boards],
  );

  if (!isOpen) return null;

  const authorized = Boolean(token);
  const canPreview =
    authorized &&
    boardId &&
    (mode === TrelloImportMode.NEW_PROJECT || projectId);

  const buildRequest = (): TrelloImportRequest => ({
    token: token ?? '',
    boardId,
    mode,
    ...(mode === TrelloImportMode.EXISTING_PROJECT ? { projectId } : {}),
  });

  const handleAuthorize = async () => {
    setLocalError(null);
    const loadedBoards = await authorize().catch(() => null);
    if (loadedBoards) setBoardId(loadedBoards[0]?.id || '');
  };

  const handlePreview = async () => {
    setLocalError(null);
    if (!authorized) {
      setLocalError('Primero autoriza a Tino en Trello');
      return;
    }
    if (!canPreview) {
      setLocalError('Selecciona tablero y destino');
      return;
    }

    await preview(buildRequest());
  };

  const handleImport = async () => {
    setLocalError(null);
    if (!previewData || previewData.importDisabled) return;
    await executeImport(buildRequest());
    await onImported();
  };

  const visibleError = localError || error;

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-primary)]/40 p-4 backdrop-blur-[2px]">
        <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[28px] bg-white shadow-[var(--shadow-lg)] animate-page-enter">
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white px-6 py-5">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                Trello
              </p>
              <h2 className="text-2xl font-black tracking-tight text-slate-900">
                Importar proyectos
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

          <div className="grid gap-6 px-6 py-6 lg:grid-cols-[360px_1fr]">
            <div className="space-y-5">
              <div
                className={cn(
                  'rounded-2xl border p-4',
                  authorized
                    ? 'border-green-100 bg-green-50'
                    : 'border-slate-100 bg-slate-50',
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                      authorized ? 'bg-green-600 text-white' : 'bg-[#1e3a5f] text-white',
                    )}
                  >
                    {authorized ? <CheckCircle2 size={18} /> : <Link2 size={18} />}
                  </span>
                  <div>
                    <p className="text-sm font-black text-slate-900">
                      {authorized ? 'Trello autorizado' : 'Conectar con Trello'}
                    </p>
                    <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">
                      {authorized
                        ? 'Ya podés elegir un tablero. El acceso es de solo lectura y vence en una hora.'
                        : 'Se abre la ventana de Trello. Entrá con tu cuenta (podés usar "Continuar con Google") y aceptá el acceso de solo lectura.'}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleAuthorize}
                  disabled={isLoading}
                  variant={authorized ? 'secondary' : 'primary'}
                  fullWidth
                  className="mt-4 h-12 rounded-xl font-bold"
                >
                  {authorized ? 'Cambiar cuenta' : 'Autorizar Trello'}
                </Button>
              </div>

              <div>
                <label htmlFor="trello-board" className="app-label">
                  Tablero
                </label>
                <select
                  id="trello-board"
                  value={boardId}
                  onChange={(event) => setBoardId(event.target.value)}
                  disabled={!authorized}
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
                <label htmlFor="trello-mode" className="app-label">
                  Modo
                </label>
                <select
                  id="trello-mode"
                  value={mode}
                  onChange={(event) =>
                    setMode(event.target.value as TrelloImportMode)
                  }
                  className="app-select"
                >
                  <option value={TrelloImportMode.NEW_PROJECT}>
                    Crear proyecto nuevo
                  </option>
                  <option value={TrelloImportMode.EXISTING_PROJECT}>
                    Agregar a proyecto existente
                  </option>
                </select>
              </div>

              {mode === TrelloImportMode.EXISTING_PROJECT ? (
                <div>
                  <label htmlFor="trello-project" className="app-label">
                    Proyecto Tino
                  </label>
                  <select
                    id="trello-project"
                    value={projectId}
                    onChange={(event) => setProjectId(event.target.value)}
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
                disabled={isLoading}
                fullWidth
                className="h-12 rounded-xl font-bold"
              >
                Generar preview
              </Button>

              {visibleError ? (
                <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">
                  {visibleError}
                </div>
              ) : null}
            </div>

            <div className="min-h-[520px] rounded-[24px] border border-slate-100 bg-slate-50/70 p-5">
              {!previewData ? (
                <div className="flex h-full min-h-[480px] flex-col items-center justify-center text-center">
                  <DownloadCloud size={42} className="text-slate-300" />
                  <h3 className="mt-4 text-lg font-black text-slate-900">
                    Preview pendiente
                  </h3>
                  <p className="mt-2 max-w-md text-sm font-medium text-slate-500">
                    Carga tus tableros, elige destino y genera un resumen antes de escribir en Tino.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                        {selectedBoard?.name || previewData.board.name}
                      </p>
                      <h3 className="text-xl font-black text-slate-900">
                        Resumen de importacion
                      </h3>
                    </div>
                    <span
                      className={cn(
                        'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black',
                        previewData.importDisabled
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-green-100 text-green-800',
                      )}
                    >
                      {previewData.importDisabled ? (
                        <AlertTriangle size={14} />
                      ) : (
                        <CheckCircle2 size={14} />
                      )}
                      {previewData.importDisabled ? 'Ya importado' : 'Listo'}
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      ['Tareas nuevas', previewData.totals.newTasks],
                      ['Subtareas nuevas', previewData.totals.newSubtasks],
                      ['Duplicadas', previewData.totals.duplicateTasks],
                      ['Alertas', previewData.totals.warnings],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl bg-white p-4 shadow-sm">
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                          {label}
                        </p>
                        <p className="mt-2 text-3xl font-black text-slate-900">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {previewData.importDisabled ? (
                    <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                      Este tablero ya tiene datos importados. El boton queda bloqueado para evitar errores en esta instancia.
                    </div>
                  ) : null}

                  {result ? (
                    <div className="rounded-xl border border-green-100 bg-green-50 p-4 text-sm font-semibold text-green-800">
                      Importacion realizada: {result.result.createdTasks} tareas y {result.result.createdSubtasks} subtareas creadas.
                    </div>
                  ) : null}

                  {previewData.warnings.length > 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-sm font-black text-slate-900">Alertas</p>
                      <ul className="mt-2 space-y-1 text-sm font-medium text-slate-600">
                        {previewData.warnings.slice(0, 4).map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-black text-slate-900">
                      Primeras tareas
                    </p>
                    <div className="mt-3 space-y-2">
                      {previewData.tasks.slice(0, 6).map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-900">
                              {task.title}
                            </p>
                            <p className="text-xs font-medium text-slate-500">
                              {task.listName} - {task.subtasks.length} subtareas
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-black text-slate-500">
                            {task.duplicate ? 'Omitida' : task.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                    <Button variant="secondary" onClick={onClose}>
                      Cerrar
                    </Button>
                    <Button
                      onClick={handleImport}
                      disabled={isLoading || previewData.importDisabled || !!result}
                      className="min-w-40 rounded-xl font-bold"
                    >
                      {isLoading ? 'Importando...' : 'Importar a Tino'}
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
