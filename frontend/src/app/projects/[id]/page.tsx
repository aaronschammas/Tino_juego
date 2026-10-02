"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import ProtectedLayout from "@/components/layout/ProtectedLayout";
import TaskList from "@/components/tasks/TaskList";
import TaskForm from "@/components/tasks/TaskForm";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import NoticeBanner from "@/components/ui/NoticeBanner";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Project, ProjectTimeEntry } from "@/types/project";
import { Task, TaskStatus, CreateTaskDto, UpdateTaskDto } from "@/types/task";
import { TimeEntry } from "@/types/time";
import { ApiClientError, apiGet, apiPost } from "@/lib/api";
import { useTasks } from "@/hooks/useTasks";
import { useAuth } from "@/hooks/useAuth";
import { canManageProject } from "@/lib/auth";
import { useTimerControls } from "@/context/TimerContext";
import { useOrganizationMembers } from "@/hooks/useOrganizationMembers";
import { formatDateUTC, secondsToHMS } from "@/lib/time";
import LinkTimeModal from "@/components/projects/LinkTimeModal";
import TaskDetailPanel from "@/components/tasks/TaskDetailPanel";
import StartTimerDurationModal from "@/components/tasks/StartTimerDurationModal";
import ProjectMemberModal from "@/components/projects/ProjectMemberModal";

const PROJECT_REFRESH_DELAY_MS = 250;

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [history, setHistory] = useState<TimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const projectRequestSequence = useRef(0);

  const {
    tasks,
    fetchTasks,
    createTask,
    updateTask,
    updateTaskStatus,
    deleteTask,
  } = useTasks();
  const {
    members: organizationMembers,
    userRole,
    error: membersError,
    refreshMembers,
  } = useOrganizationMembers();
  const { activeTimer, startTimer, stopTimer } = useTimerControls();
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [subTaskParent, setSubTaskParent] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "board">("board");
  const [pendingStatusTaskIds, setPendingStatusTaskIds] = useState<string[]>(
    [],
  );
  const [selectedEntryToLink, setSelectedEntryToLink] =
    useState<ProjectTimeEntry | null>(null);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [showProjectMemberModal, setShowProjectMemberModal] = useState(false);
  const [memberActionError, setMemberActionError] = useState<string | null>(
    null,
  );
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null);
  const [durationPromptTask, setDurationPromptTask] = useState<Task | null>(
    null,
  );

  // Siempre refleja el estado más reciente del árbol de tareas
  const detailTask = useMemo(() => {
    if (!detailTaskId) return null;
    const root = tasks.find((t) => t.id === detailTaskId);
    if (root) return root;
    for (const t of tasks) {
      const sub = t.subTasks?.find((st) => st.id === detailTaskId);
      if (sub) return sub;
    }
    return null;
  }, [detailTaskId, tasks]);

  // Cierra el panel si la tarea que mostraba fue eliminada
  useEffect(() => {
    if (detailTaskId && !detailTask) {
      setDetailTaskId(null);
    }
  }, [detailTask, detailTaskId]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setViewMode("list");
    }
  }, []);

  /**
   * Loads the project. Only the first load shows the loading screen; background
   * refreshes keep the current view, ignore transient errors and still redirect
   * when the project is no longer accessible.
   */
  const fetchProject = useCallback(
    async ({ background = false }: { background?: boolean } = {}) => {
      if (!projectId) return;
      const requestId = ++projectRequestSequence.current;
      try {
        if (!background) {
          setIsLoading(true);
          setError(null);
        }
        const data = await apiGet<Project>(`/projects/${projectId}`);
        if (requestId === projectRequestSequence.current) {
          setProject(data);
          setError(null);
        }
      } catch (fetchError: unknown) {
        if (requestId !== projectRequestSequence.current) return;
        if (
          fetchError instanceof ApiClientError &&
          (fetchError.status === 403 || fetchError.status === 404)
        ) {
          setProject(null);
          router.replace("/projects");
          return;
        }
        if (background) return;
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Error al cargar proyecto",
        );
      } finally {
        if (requestId === projectRequestSequence.current) setIsLoading(false);
      }
    },
    [projectId, router],
  );

  useEffect(() => {
    if (projectId) {
      void fetchProject();
      void fetchTasks(projectId).catch(() => undefined);
    }
  }, [fetchProject, fetchTasks, projectId]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!projectId) return;

      try {
        const entries = await apiGet<TimeEntry[]>("/time/history?limit=20");
        setHistory(
          entries.filter((entry) => entry.projectId === projectId).slice(0, 8),
        );
      } catch (fetchError) {
        console.error("Error al cargar historial de tiempo:", fetchError);
        setHistory([]);
      }
    };

    fetchHistory();

    let refreshTimeout: ReturnType<typeof setTimeout> | null = null;
    /** Coalesces events fired together (e.g. task:updated + projects:updated) into one background refresh. */
    const syncProjectData = () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(() => {
        void fetchProject({ background: true });
        void fetchTasks(projectId).catch(() => undefined);
        void fetchHistory();
      }, PROJECT_REFRESH_DELAY_MS);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("task:updated", syncProjectData);
      window.addEventListener("time:updated", syncProjectData);
      window.addEventListener("projects:updated", syncProjectData);
    }

    return () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      if (typeof window !== "undefined") {
        window.removeEventListener("task:updated", syncProjectData);
        window.removeEventListener("time:updated", syncProjectData);
        window.removeEventListener("projects:updated", syncProjectData);
      }
    };
  }, [fetchTasks, projectId, fetchProject]);

  const handleCreateTask = () => {
    setEditingTask(undefined);
    setSubTaskParent(null);
    setShowTaskForm(true);
  };

  const handleCreateSubTask = (parentTask: Task) => {
    setEditingTask(undefined);
    setSubTaskParent(parentTask);
    setShowTaskForm(true);
  };

  const handleEditTask = (task: Task) => {
    setDetailTaskId(task.id);
    setShowTaskForm(false);
    setEditingTask(undefined);
  };

  // Editar desde el panel → abre el formulario (el panel queda abierto detrás)
  const handleEditFromPanel = (task: Task) => {
    setEditingTask(task);
    setSubTaskParent(null);
    setShowTaskForm(true);
  };

  // Crear subtarea desde el panel → abre el formulario (el panel queda abierto detrás)
  const handleCreateSubTaskFromPanel = (parentTask: Task) => {
    setEditingTask(undefined);
    setSubTaskParent(parentTask);
    setShowTaskForm(true);
  };

  const handleSubmitTask = async (
    data: CreateTaskDto,
    selectedProjectId: string,
  ) => {
    if (editingTask) {
      await updateTask(
        selectedProjectId,
        editingTask.id,
        data as UpdateTaskDto,
      );
    } else {
      await createTask(selectedProjectId, data);
    }
    setShowTaskForm(false);
    setEditingTask(undefined);
    setSubTaskParent(null);
  };

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    setPendingStatusTaskIds((prev) =>
      prev.includes(taskId) ? prev : [...prev, taskId],
    );
    try {
      await updateTaskStatus(projectId, taskId, status);
    } finally {
      setPendingStatusTaskIds((prev) => prev.filter((id) => id !== taskId));
    }
  };

  const handleTakeTask = async (taskId: string) => {
    if (!user?.id) return;
    await updateTask(projectId, taskId, { assignedToId: user.id });
  };

  const handleDeleteTask = (taskId: string) => {
    const task =
      tasks.find((t) => t.id === taskId) ||
      tasks
        .flatMap((parentTask) => parentTask.subTasks || [])
        .find((subTask) => subTask.id === taskId);
    if (task) setTaskToDelete(task);
  };

  const handleConfirmDeleteTask = async () => {
    if (!taskToDelete) return;
    try {
      await deleteTask(projectId, taskToDelete.id);
      setTaskToDelete(null);
    } catch (err) {
      console.error("Error al eliminar tarea:", err);
    }
  };

  const handleCancelDeleteTask = () => {
    setTaskToDelete(null);
  };

  const handleAddMemberToProject = async (userIdToAdd: string) => {
    setPendingMemberId(userIdToAdd);
    setMemberActionError(null);

    try {
      await apiPost(`/projects/${projectId}/members`, { userIdToAdd });
      await Promise.all([
        fetchProject({ background: true }),
        refreshMembers({ force: true, background: true }),
      ]);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("projects:updated"));
      }
    } catch (addError) {
      setMemberActionError(
        addError instanceof Error
          ? addError.message
          : "No se pudo agregar la persona al proyecto.",
      );
    } finally {
      setPendingMemberId(null);
    }
  };

  const handleTrackTaskTime = async (task: Task) => {
    setActionMessage(null);

    try {
      if (activeTimer?.taskId === task.id) {
        await stopTimer();
        return;
      }

      if (activeTimer && activeTimer.taskId !== task.id) {
        setActionMessage(
          "Ya tienes un timer activo. Detenlo antes de cambiar de tarea.",
        );
        return;
      }

      // Asignar automáticamente si no tiene responsable
      setDurationPromptTask(task);
    } catch (timerError: unknown) {
      setActionMessage(
        timerError instanceof Error
          ? timerError.message
          : "No se pudo iniciar el timer para esta tarea.",
      );
    }
  };

  const handleConfirmDurationPrompt = async (minutes: number) => {
    if (!durationPromptTask) return;
    const task = durationPromptTask;
    try {
      if (!task.assignedToId && user?.id) {
        await updateTask(projectId, task.id, { assignedToId: user.id });
      }
      await startTimer(projectId, task.id, minutes);
      setDurationPromptTask(null);
    } catch (timerError: unknown) {
      setActionMessage(
        timerError instanceof Error
          ? timerError.message
          : "No se pudo iniciar el timer para esta tarea.",
      );
      setDurationPromptTask(null);
    }
  };

  const unlinkedTimeMs = useMemo(() => {
    if (!project?.timeEntries) return 0;
    return project.timeEntries.reduce((acc, entry) => {
      const start = new Date(entry.startTime).getTime();
      const end = new Date(entry.endTime).getTime();
      const duration = end - start - (entry.totalPausedMs || 0);
      return acc + (duration > 0 ? duration : 0);
    }, 0);
  }, [project?.timeEntries]);

  const totalEstimated = tasks.reduce(
    (acc, task) => acc + (task.estimatedHours || 0),
    0,
  );
  const totalActual =
    tasks.reduce((acc, task) => acc + (task.actualHours || 0), 0) +
    unlinkedTimeMs / 1000 / 3600;
  const completedTasks = tasks.filter(
    (task) => task.status === TaskStatus.DONE,
  ).length;
  const blockedTasks = tasks.filter(
    (task) => task.status === TaskStatus.BLOCKED,
  ).length;
  const parentTasks = tasks.filter(
    (task) => (task.subTasks?.length || 0) > 0,
  ).length;
  const totalSubTasks = tasks.reduce(
    (acc, task) => acc + (task.subTasks?.length || 0),
    0,
  );
  const activeProjectTimer =
    activeTimer?.projectId === projectId ? activeTimer : null;
  const recentEntries = history.slice(0, 5);

  const canManageProjectMembers = canManageProject(user, userRole, project);
  const canDeleteTasks = canManageProjectMembers;

  const memberCards = useMemo(
    () =>
      (project?.members || []).map((member) => ({
        id: member.id,
        userId: member.user.id,
        name:
          `${member.user.name} ${member.user.lastname}`.trim() ||
          member.user.email,
        email: member.user.email,
        role: member.role === "OWNER" ? "Owner" : "Miembro",
      })),
    [project?.members],
  );
  const projectMemberUserIds = useMemo(
    () => new Set((project?.members || []).map((member) => member.user.id)),
    [project?.members],
  );
  const availableOrganizationMembers = useMemo(
    () =>
      organizationMembers.filter(
        (member) => !projectMemberUserIds.has(member.userId),
      ),
    [organizationMembers, projectMemberUserIds],
  );

  const priorityColors = {
    LOW: "bg-gray-100 text-gray-800",
    MEDIUM: "bg-blue-100 text-blue-800",
    HIGH: "bg-orange-100 text-orange-800",
    CRITICAL: "bg-red-100 text-red-800",
  };

  const priorityLabels = {
    LOW: "Baja",
    MEDIUM: "Media",
    HIGH: "Alta",
    CRITICAL: "Critica",
  };

  const formatLongDate = (dateString?: string) => {
    if (!dateString) return "No definida";
    return formatDateUTC(dateString, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatShortTime = (dateString: string) =>
    new Date(dateString).toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "America/Argentina/Buenos_Aires",
    });

  if (isLoading) {
    return (
      <ProtectedLayout>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-lg text-gray-600">Cargando proyecto...</div>
        </div>
      </ProtectedLayout>
    );
  }

  if (error || !project) {
    return (
      <ProtectedLayout>
        <div className="min-h-screen bg-gray-50 p-8">
          <div className="mx-auto max-w-3xl">
            <NoticeBanner title="No pudimos cargar el proyecto" tone="error">
              {error || "Proyecto no encontrado"}
            </NoticeBanner>
            <Button onClick={() => router.push("/projects")} className="mt-4">
              Volver a proyectos
            </Button>
          </div>
        </div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <div className="min-h-screen bg-gray-50 overflow-x-hidden">
        <div className="mx-auto max-w-[1600px] px-0 md:px-8 py-8 lg:px-12">
          <div className="mb-6">
            <button
              onClick={() => router.push("/projects")}
              className="mb-4 flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900 sm:text-sm"
            >
              ← Volver a proyectos
            </button>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h1 className="wrap-break-word text-2xl font-bold text-gray-900 sm:text-3xl">
                  {project.name}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium sm:text-sm ${priorityColors[project.priority]}`}
                  >
                    {priorityLabels[project.priority]}
                  </span>
                  <span
                    className={`whitespace-nowrap rounded-full px-3 py-1 text-xs sm:text-sm ${
                      project.isActive
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {project.isActive ? "Activo" : "Inactivo"}
                  </span>
                  {activeProjectTimer ? (
                    <span className="whitespace-nowrap rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800 sm:text-sm">
                      Timer activo
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          {actionMessage ? (
            <div className="mb-6">
              <NoticeBanner tone="warning" title="Seguimiento de tiempo">
                {actionMessage}
              </NoticeBanner>
            </div>
          ) : null}

          {membersError ? (
            <div className="mb-6">
              <NoticeBanner tone="warning" title="No pudimos verificar tus permisos">
                Recargá la página para volver a intentarlo.
              </NoticeBanner>
            </div>
          ) : null}

          {project.description ? (
            <div className="mb-6 rounded-lg bg-white p-6 shadow-md">
              <h2 className="mb-2 text-xl font-semibold text-gray-900">
                Descripcion
              </h2>
              <p className="whitespace-pre-wrap text-gray-600">
                {project.description}
              </p>
            </div>
          ) : null}
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
            <Card className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-500)]">
                Tareas
              </p>
              <p className="mt-2 text-3xl font-bold text-[var(--color-ink-900)]">
                {tasks.length}
              </p>
              <p className="mt-1 text-xs text-[var(--color-ink-500)]">
                {completedTasks} completadas, {blockedTasks} bloqueadas
              </p>
            </Card>
            <Card className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-500)]">
                Estimado total
              </p>
              <p className="mt-2 text-[28px] font-bold text-[var(--color-primary-700)] font-mono">
                {secondsToHMS(totalEstimated * 3600)}
              </p>
              <p className="mt-1 text-xs text-[var(--color-ink-500)]">
                Planificado (HH:mm:ss)
              </p>
            </Card>
            <Card className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-500)]">
                Tiempo real
              </p>
              <p className="mt-2 text-[28px] font-bold text-[var(--color-ink-900)] font-mono">
                {secondsToHMS(totalActual * 3600)}
              </p>
              <p className="mt-1 text-xs text-[var(--color-ink-500)]">
                Registrado (HH:mm:ss)
              </p>
            </Card>
            <Card className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-500)]">
                Subtareas
              </p>
              <p className="mt-2 text-3xl font-bold text-[var(--color-ink-900)]">
                {totalSubTasks}
              </p>
              <p className="mt-1 text-xs text-[var(--color-ink-500)]">
                {parentTasks} tareas padre
              </p>
            </Card>
          </div>{" "}
          {/* Tasks Section */}
          <div className="mb-12">
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                    Tareas
                  </h2>
                  <span className="flex h-6 items-center justify-center rounded-full bg-blue-100 px-3 text-xs font-bold text-blue-700">
                    {tasks.length}
                  </span>
                </div>
                <p className="max-w-2xl text-sm text-slate-500">
                  Las tareas padre organizan el trabajo. El timer se inicia en
                  tareas simples o subtareas.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center rounded-lg bg-slate-100 p-1 shadow-inner">
                  <button
                    onClick={() => setViewMode("list")}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                      viewMode === "list"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <span>☰</span> Lista
                  </button>
                  <button
                    onClick={() => setViewMode("board")}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                      viewMode === "board"
                        ? "bg-white text-blue-600 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <span>⧉</span> Tablero
                  </button>
                </div>

                <button
                  onClick={handleCreateTask}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1e3a5f] px-6 py-3 text-sm font-bold text-white shadow-lg transition-all hover:bg-[#2c4f7c] hover:-translate-y-0.5 active:translate-y-0"
                >
                  <span className="text-lg">+</span> Crear tarea
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm sm:p-4">
              {tasks.length === 0 ? (
                <EmptyState
                  icon="[]"
                  title="Todavia no hay tareas"
                  description="Crea la primera tarea para empezar a medir estimacion, ejecucion y tiempo real."
                  action={
                    <Button onClick={handleCreateTask}>Crear tarea</Button>
                  }
                />
              ) : (
                <TaskList
                  tasks={tasks}
                  onEdit={handleEditTask}
                  onCreateTask={handleCreateTask}
                  onStatusChange={handleStatusChange}
                  onTakeTask={handleTakeTask}
                  onTrackTime={handleTrackTaskTime}
                  onDelete={handleDeleteTask}
                  onCreateSubTask={handleCreateSubTask}
                  canDelete={canDeleteTasks}
                  activeTaskId={activeProjectTimer?.taskId || null}
                  groupByStatus={viewMode === "board"}
                  pendingStatusTaskIds={pendingStatusTaskIds}
                />
              )}
            </div>
          </div>
          {/* Tiempo asignado al proyecto, pero sin vinculación con tareas */}
          <div className="mb-12">
            <div className="mb-6 space-y-1">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                Tiempo asignado al proyecto, pero sin vinculación con tareas
              </h2>
              <p className="text-slate-500 text-sm">
                Horas registradas directamente en el proyecto sin asociar a
                ninguna tarea en específico. Puedes vincularlas total o
                parcialmente.
              </p>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
              {!project.timeEntries || project.timeEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <span className="text-3xl">⏱️</span>
                  <h3 className="mt-3 text-sm font-semibold text-slate-900">
                    Todo el tiempo está vinculado
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    No hay entradas de tiempo pendientes de vincular en este
                    proyecto.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-6 py-4 rounded-l-xl">Miembro</th>
                        <th className="px-6 py-4">Fecha</th>
                        <th className="px-6 py-4">Rango</th>
                        <th className="px-6 py-4">Duración</th>
                        <th className="px-6 py-4 text-right rounded-r-xl">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {project.timeEntries.map((entry) => {
                        const start = new Date(entry.startTime);
                        const end = new Date(entry.endTime);
                        const activeDurationSecs = Math.max(
                          Math.round(
                            (end.getTime() -
                              start.getTime() -
                              (entry.totalPausedMs || 0)) /
                              1000,
                          ),
                          0,
                        );

                        return (
                          <tr
                            key={entry.id}
                            className="hover:bg-slate-50/50 transition-colors"
                          >
                            <td className="px-6 py-4 font-semibold text-slate-900">
                              {entry.user.name} {entry.user.lastname}
                            </td>
                            <td className="px-6 py-4 text-slate-500">
                              {formatLongDate(entry.startTime)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-mono text-xs">
                              {formatShortTime(entry.startTime)} –{" "}
                              {formatShortTime(entry.endTime)}
                            </td>
                            <td className="px-6 py-4 font-mono font-bold text-blue-600 text-sm">
                              {secondsToHMS(activeDurationSecs)}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => setSelectedEntryToLink(entry)}
                                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 transition-all hover:bg-blue-100 active:scale-95"
                              >
                                🔗 Vincular a tarea
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
          <div className="mb-12 grid grid-cols-1 gap-8 lg:grid-cols-3">
            <Card className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Equipo</h2>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    Personas con acceso a este proyecto.
                  </p>
                </div>
                {canManageProjectMembers ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setMemberActionError(null);
                      setShowProjectMemberModal(true);
                    }}
                    className="rounded-xl"
                  >
                    Agregar persona
                  </Button>
                ) : null}
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                {memberCards.map((member) => {
                  const initials = member.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .substring(0, 2)
                    .toUpperCase();
                  return (
                    <div
                      key={member.id}
                      className="group relative flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600 ring-2 ring-white transition-all hover:-translate-y-1 hover:bg-blue-600 hover:text-white hover:ring-blue-200 cursor-default"
                    >
                      {initials}
                      <div className="absolute bottom-full left-0 mb-2 hidden w-max rounded bg-slate-900 px-2 py-1 text-[10px] text-white group-hover:block z-30">
                        {member.name} • {member.role}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-bold text-slate-900">Seguimiento</h2>
              {activeProjectTimer ? (
                <div className="mt-4 flex items-center justify-between rounded-2xl bg-blue-50 p-4">
                  <div>
                    <p className="text-sm font-bold text-blue-900">En curso</p>
                    <p className="text-xs text-blue-700 line-clamp-1">
                      {activeProjectTimer.task?.title}
                    </p>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => stopTimer()}
                    className="rounded-xl"
                  >
                    Detener
                  </Button>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">Sin timer activo</p>
              )}
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-bold text-slate-900">Reciente</h2>
              <div className="mt-4 space-y-3">
                {recentEntries.slice(0, 3).map((entry) => {
                  const seconds = entry.endTime
                    ? Math.round(
                        (new Date(entry.endTime).getTime() -
                          new Date(entry.startTime).getTime() -
                          (entry.totalPausedMs || 0)) /
                          1000,
                      )
                    : 0;
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between"
                    >
                      <p className="text-xs font-medium text-slate-700 line-clamp-1">
                        {entry.task?.title || "Proyecto"}
                      </p>
                      <span className="text-[10px] font-bold text-blue-600 font-mono">
                        {secondsToHMS(seconds)}
                      </span>
                    </div>
                  );
                })}
                {recentEntries.length === 0 && (
                  <p className="text-xs text-slate-400">Sin actividad</p>
                )}
              </div>
            </Card>
          </div>
          <div className="rounded-lg bg-white p-4 shadow-md sm:p-6">
            <h2 className="mb-4 text-base font-semibold text-gray-900 sm:text-lg">
              Informacion del proyecto
            </h2>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500 sm:text-sm">
                  Fecha de vencimiento
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:text-base">
                  {formatLongDate(project.dueDate)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500 sm:text-sm">
                  Creado
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:text-base">
                  {formatLongDate(project.createdAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500 sm:text-sm">
                  Ultima actualizacion
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:text-base">
                  {formatLongDate(project.updatedAt)}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {detailTask && (
        <TaskDetailPanel
          task={detailTask}
          activeTaskId={activeProjectTimer?.taskId || null}
          canDelete={canDeleteTasks}
          onClose={() => setDetailTaskId(null)}
          onEditTask={handleEditFromPanel}
          onSelectTask={(task) => setDetailTaskId(task.id)}
          onCreateSubTask={handleCreateSubTaskFromPanel}
          onStatusChange={handleStatusChange}
          onTakeTask={handleTakeTask}
          onTrackTime={handleTrackTaskTime}
          onDelete={handleDeleteTask}
        />
      )}

      {showTaskForm ? (
        <TaskForm
          projectId={projectId}
          task={editingTask}
          parentTaskId={subTaskParent?.id}
          parentTaskTitle={subTaskParent?.title}
          canFullyEdit={canManageProjectMembers}
          onSubmit={handleSubmitTask}
          onCancel={() => {
            setShowTaskForm(false);
            setEditingTask(undefined);
            setSubTaskParent(null);
          }}
        />
      ) : null}

      <ProjectMemberModal
        isOpen={showProjectMemberModal}
        members={availableOrganizationMembers}
        currentMembersCount={memberCards.length}
        error={memberActionError}
        pendingMemberId={pendingMemberId}
        onAddMember={(userIdToAdd) =>
          void handleAddMemberToProject(userIdToAdd)
        }
        onClose={() => setShowProjectMemberModal(false)}
      />

      <ConfirmDialog
        isOpen={!!taskToDelete}
        title="Eliminar tarea"
        description={`¿Estás seguro de que deseas eliminar la tarea "${taskToDelete?.title}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        tone="danger"
        onConfirm={handleConfirmDeleteTask}
        onCancel={handleCancelDeleteTask}
      />

      <LinkTimeModal
        isOpen={!!selectedEntryToLink}
        onClose={() => setSelectedEntryToLink(null)}
        entry={selectedEntryToLink}
        tasks={tasks}
        onLinkSuccess={() => {
          void fetchProject({ background: true });
          void fetchTasks(projectId).catch(() => undefined);
        }}
      />

      <StartTimerDurationModal
        isOpen={!!durationPromptTask}
        task={durationPromptTask}
        onClose={() => setDurationPromptTask(null)}
        onConfirm={handleConfirmDurationPrompt}
      />
    </ProtectedLayout>
  );
}
