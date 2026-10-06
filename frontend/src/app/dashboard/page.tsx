'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { LayoutGrid, Plus } from 'lucide-react';
import ProtectedLayout from '@/components/layout/ProtectedLayout';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import DashboardSlicers from '@/components/dashboard/DashboardSlicers';

const BurndownChart = dynamic(() => import('@/components/dashboard/BurndownChart'), { ssr: false });
const ProjectDeviationChart = dynamic(() => import('@/components/dashboard/ProjectDeviationChart'), { ssr: false });
const PriorityDistributionChart = dynamic(() => import('@/components/dashboard/PriorityDistributionChart'), { ssr: false });
const HealthStatusCard = dynamic(() => import('@/components/dashboard/HealthStatusCard'), { ssr: false });
const ActivityHeatmap = dynamic(() => import('@/components/dashboard/ActivityHeatmap'), { ssr: false });
const TaskTable = dynamic(() => import('@/components/dashboard/TaskTable'), { ssr: false });
const KPIStatCard = dynamic(() => import('@/components/dashboard/KPIStatCard'), { ssr: false });
const TaskForm = dynamic(() => import('@/components/tasks/TaskForm'), { ssr: false });
const ReportModal = dynamic(() => import('@/components/reports/ReportModal'), { ssr: false });
import EmptyState from '@/components/ui/EmptyState';
import NoticeBanner from '@/components/ui/NoticeBanner';
import { useDashboardV2 } from '@/hooks/useDashboardV2';
import { useProjects } from '@/hooks/useProjects';
import { useTasks } from '@/hooks/useTasks';
import { useAuth } from '@/hooks/useAuth';
import { useOrganizations } from '@/hooks/useOrganizations';
import { CreateTaskDto } from '@/types/task';
import { OrganizationWorkspaceState } from '@/types/organization';
import { secondsToHMS } from '@/lib/time';

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-gray-200 ${className}`} />;
}

function DashboardOnboarding({
  hasOrganizationProjects,
  canCreateProjects,
  onOpenProjects,
}: {
  hasOrganizationProjects: boolean;
  canCreateProjects: boolean;
  onOpenProjects: () => void;
}) {
  const hasNoAssignedProjects = !hasOrganizationProjects && !canCreateProjects;
  return (
    <div className="mx-auto max-w-[1600px] px-0 md:px-0">
      <div className="flex flex-col items-center rounded-[16px] border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm md:px-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-[#2C63E8]">
          <LayoutGrid size={30} />
        </div>
        <h2 className="mt-5 text-[19px] font-extrabold text-slate-900">
          {hasNoAssignedProjects
            ? 'Todavía no tenés proyectos asignados'
            : hasOrganizationProjects
              ? 'Creá una tarea para ver tus métricas'
              : 'Creá un proyecto para ver tus métricas'}
        </h2>
        <p className="mt-3 max-w-md text-[14.5px] font-medium leading-relaxed text-slate-500">
          {hasNoAssignedProjects
            ? 'Cuando el propietario te asigne a un proyecto, vas a poder ver acá sus tareas y métricas.'
            : hasOrganizationProjects
            ? 'La organización ya tiene un proyecto, pero todavía no hay tareas para analizar. En cuanto cargues la primera tarea vas a ver acá las métricas.'
            : 'Todavía no hay datos que mostrar. En cuanto crees tu primer proyecto vas a ver acá las métricas.'}
        </p>
        <button
          onClick={onOpenProjects}
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-[11px] bg-[#17213B] px-6 py-3 text-[15px] font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-[#1E2C4F] hover:shadow-lg"
        >
          <Plus size={18} />
          {hasNoAssignedProjects || hasOrganizationProjects
            ? 'Ir a proyectos'
            : 'Crear tu primer proyecto'}
        </button>
      </div>
    </div>
  );
}

/**
 * Operational dashboard. Metrics load in parallel with the workspace state;
 * only a workspace already known to have no tasks skips them.
 */
/** Proyecto que llega en `?projectId=` (pantalla final del juego de la feria): el Dashboard abre ya filtrado. */
function projectIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('projectId');
}

export default function BIDashboardPage() {
  const router = useRouter();
  const { activeMembership, activeOrganization, user } = useAuth();
  const { getMyOrganization } = useOrganizations();
  const [workspaceSnapshot, setWorkspaceSnapshot] = useState<{
    organizationId: string | null;
    state: OrganizationWorkspaceState | null;
    loaded: boolean;
  }>({ organizationId: null, state: null, loaded: false });
  const [urlProjectId] = useState(projectIdFromUrl);
  const workspaceState =
    workspaceSnapshot.organizationId === activeOrganization?.id
      ? workspaceSnapshot.state
      : null;
  const workspaceStateLoading =
    Boolean(activeOrganization?.id) &&
    (workspaceSnapshot.organizationId !== activeOrganization?.id ||
      !workspaceSnapshot.loaded);
  const {
    summary,
    tasks,
    heatmap,
    projects: dashboardProjects,
    filters,
    setFilters,
    isLoading,
    isFetching,
    isLoadingMore,
    sectionErrors,
    isEmpty,
    error,
    loadMoreTasks,
    refetch,
  } = useDashboardV2({
    enabled: workspaceState?.hasAccessibleTasks !== false,
    initialFilters: urlProjectId ? { projectId: urlProjectId } : undefined,
  });
  const { projects, isLoading: projectsLoading, error: projectsError } = useProjects();
  const { createTask } = useTasks();
  const [selectedTaskId] = useState<string | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  const handleClearFilters = useCallback(
    () => setFilters({ projectId: 'all', startDate: null, endDate: null, status: 'all' }),
    [setFilters],
  );
  const handleCreateFirstProject = useCallback(() => router.push('/projects'), [router]);

  useEffect(() => {
    let mounted = true;
    const organizationId = activeOrganization?.id ?? null;

    if (!organizationId) return () => undefined;

    getMyOrganization({ force: true })
      .then((organization) => {
        if (mounted) {
          setWorkspaceSnapshot({
            organizationId,
            state: organization.workspaceState ?? null,
            loaded: true,
          });
        }
      })
      .catch(() => {
        if (mounted) {
          setWorkspaceSnapshot({ organizationId, state: null, loaded: true });
        }
      });

    return () => {
      mounted = false;
    };
  }, [activeOrganization?.id, getMyOrganization]);

  useEffect(() => {
    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const refreshWorkspace = () => {
      if (!activeOrganization?.id) return;
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        void getMyOrganization({ force: true }).then((organization) => {
          if (mounted) setWorkspaceSnapshot({
            organizationId: activeOrganization.id,
            state: organization.workspaceState ?? null,
            loaded: true,
          });
        });
      }, 100);
    };
    window.addEventListener('projects:updated', refreshWorkspace);
    window.addEventListener('task:updated', refreshWorkspace);
    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('projects:updated', refreshWorkspace);
      window.removeEventListener('task:updated', refreshWorkspace);
    };
  }, [activeOrganization?.id, getMyOrganization]);

  const handleSubmitTask = useCallback(async (data: CreateTaskDto, projectId: string) => {
    await createTask(projectId, data);
    setShowTaskForm(false);
  }, [createTask]);

  const handleOpenProjects = useCallback(() => {}, []);

  const hasFilters =
    filters.projectId !== 'all' || filters.status !== 'all' || Boolean(filters.startDate || filters.endDate);
  const hasAnyDashboardData = Boolean(summary || tasks || heatmap);
  const hasAccessibleProjects =
    workspaceState?.hasAccessibleProjects ?? projects.length > 0;
  const canCreateProjects =
    user?.role === 'SUPERADMIN' || activeMembership?.role === 'ORG_OWNER';
  const showOrganizationOnboarding =
    !workspaceStateLoading &&
    workspaceState !== null &&
    (!workspaceState.hasAccessibleProjects ||
      !workspaceState.hasAccessibleTasks);

  const realTimeDeviation = summary?.kpis.effortDeviationHours ?? 0;
  const realTimeMeta = realTimeDeviation > 0 
    ? `+${realTimeDeviation.toFixed(1)}h sobre lo estimado`
    : realTimeDeviation < 0
      ? `${realTimeDeviation.toFixed(1)}h bajo lo estimado`
      : 'Alineado con el estimado';
  const realTimeTone = realTimeDeviation > 0 ? 'danger' : 'success';

  return (
    <ProtectedLayout>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="mx-auto w-full max-w-[1600px] px-0 md:px-0">
          <div className="bg-white rounded-[32px] border border-slate-200/60 shadow-sm mt-4 mb-6 px-3 py-8 md:px-8">
            <DashboardHeader
              title="Panel operativo"
              description="Visualizá tareas, tiempos, avance y carga de trabajo."
              organizationName={activeOrganization?.name}
              onNewTask={() => setShowTaskForm(true)}
              onOpenReport={() => setShowReport(true)}
            />
          </div>
        </div>

        {!showOrganizationOnboarding ? (
          <DashboardSlicers
            filters={filters}
            setFilters={setFilters}
            projects={projects}
            projectsLoading={projectsLoading}
            projectsError={projectsError}
          />
        ) : null}

        <div className="flex-1 p-2 md:p-5 overflow-auto">
          {isFetching && !isLoading ? (
            <div className="mb-4 flex justify-end">
              <span className="rounded-full bg-[var(--color-primary-050)] px-3 py-1 text-xs font-medium text-[var(--color-primary-700)]">
                Actualizando dashboard…
              </span>
            </div>
          ) : null}

          {error && !hasAnyDashboardData ? (
            <div className="max-w-[1600px] mx-auto px-0 md:px-0">
              <NoticeBanner tone="error" title="No pudimos cargar las métricas del dashboard">
                <div className="flex flex-col gap-3 items-start mt-1">
                  <p className="text-sm">{error}</p>
                  <button
                    onClick={() => void refetch({ force: true })}
                    className="rounded-xl bg-red-600 px-4.5 py-2 text-xs font-bold text-white transition-colors hover:bg-red-700"
                  >
                    Reintentar
                  </button>
                </div>
              </NoticeBanner>
            </div>
          ) : isLoading && !hasAnyDashboardData ? (
            <div className="grid grid-cols-12 gap-5">
              <Skeleton className="col-span-12 h-24" />
              <Skeleton className="col-span-8 h-80" />
              <Skeleton className="col-span-4 h-80" />
              <Skeleton className="col-span-12 h-96" />
            </div>
          ) : showOrganizationOnboarding ? (
            <DashboardOnboarding
              hasOrganizationProjects={hasAccessibleProjects}
              canCreateProjects={canCreateProjects}
              onOpenProjects={handleCreateFirstProject}
            />
          ) : isEmpty ? (
            <EmptyState
              icon="[]"
              title="Todavía no hay datos para analizar"
              description={
                hasFilters
                  ? 'Los filtros actuales no devolvieron actividad. Probá otra combinación.'
                  : 'Creá proyectos, tareas y registros de tiempo para empezar a ver métricas.'
              }
              action={
                hasFilters ? (
                  <button
                    onClick={handleClearFilters}
                    className="rounded-[14px] bg-[var(--color-primary-600)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-700)]"
                  >
                    Limpiar filtros
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className="flex flex-col gap-8 max-w-[1600px] mx-auto px-0 md:px-0">
              {/* KPIs superiores */}
              {summary ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <KPIStatCard
                    label="Total de tareas"
                    value={summary.kpis.totalTasks}
                    meta={`${summary.kpis.openTasks} abiertas`}
                    tone="primary"
                  />
                  <KPIStatCard
                    label="Tasa de completitud"
                    value={`${summary.kpis.completionRate}%`}
                    meta={`${summary.kpis.completedTasks} tareas completadas`}
                    tone="success"
                  />
                  <KPIStatCard
                    label="Tiempo planificado"
                    value={secondsToHMS(summary.kpis.estimatedHours * 3600)}
                    meta="Carga estimada en el rango"
                    tone="secondary"
                  />
                  <KPIStatCard
                    label="Tiempo registrado"
                    value={secondsToHMS(summary.kpis.actualHours * 3600)}
                    meta={realTimeMeta}
                    tone={realTimeTone}
                  />
                </div>
              ) : sectionErrors.summary ? (
                <NoticeBanner tone="error" title="No pudimos cargar los KPIs">
                  <p className="text-sm">{sectionErrors.summary}</p>
                </NoticeBanner>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <Skeleton className="h-28" />
                  <Skeleton className="h-28" />
                  <Skeleton className="h-28" />
                  <Skeleton className="h-28" />
                </div>
              )}

              {/* Sección de Salud Operativa */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-[20px] font-extrabold text-slate-800 tracking-tight">Salud operativa</h2>
                  <p className="text-[13px] text-slate-400 font-medium">Lectura de riesgos, prioridades y estado del backlog</p>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
                  {summary ? (
                    <HealthStatusCard
                      overdueTasks={summary.kpis.overdueTasks}
                      blockedTasks={summary.kpis.blockedTasks}
                      remainingTasks={summary.kpis.openTasks}
                      tasksWithoutTime={summary.kpis.tasksWithoutTime}
                      unassignedTasks={summary.kpis.unassignedTasks}
                      activeUsers={summary.kpis.activeUsers}
                      onOpenProjects={handleOpenProjects}
                    />
                  ) : sectionErrors.summary ? (
                    <NoticeBanner tone="error" title="No pudimos cargar salud operativa">
                      <p className="text-sm">{sectionErrors.summary}</p>
                    </NoticeBanner>
                  ) : (
                    <Skeleton className="h-80" />
                  )}
                  {tasks ? (
                    <BurndownChart data={tasks.statusDistribution} />
                  ) : sectionErrors.tasks ? (
                    <NoticeBanner tone="error" title="No pudimos cargar estados de tareas">
                      <p className="text-sm">{sectionErrors.tasks}</p>
                    </NoticeBanner>
                  ) : (
                    <Skeleton className="h-80" />
                  )}
                  {tasks ? (
                    <PriorityDistributionChart data={tasks.priorityDistribution} />
                  ) : sectionErrors.tasks ? (
                    <NoticeBanner tone="error" title="No pudimos cargar prioridades">
                      <p className="text-sm">{sectionErrors.tasks}</p>
                    </NoticeBanner>
                  ) : (
                    <Skeleton className="h-80" />
                  )}
                </div>
              </div>

              {/* Desvío de esfuerzo por proyecto y Mapa de actividad */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5">
                  {dashboardProjects ? (
                    <ProjectDeviationChart data={dashboardProjects} className="h-[400px]" />
                  ) : sectionErrors.projects ? (
                    <NoticeBanner tone="error" title="No pudimos cargar desvíos por proyecto">
                      <p className="text-sm">{sectionErrors.projects}</p>
                    </NoticeBanner>
                  ) : (
                    <Skeleton className="h-[400px]" />
                  )}
                </div>
                <div className="lg:col-span-7">
                  {heatmap ? (
                    <ActivityHeatmap data={heatmap} className="h-[400px]" />
                  ) : sectionErrors.heatmap ? (
                    <NoticeBanner tone="error" title="No pudimos cargar el mapa de actividad">
                      <p className="text-sm">{sectionErrors.heatmap}</p>
                    </NoticeBanner>
                  ) : (
                    <Skeleton className="h-[400px]" />
                  )}
                </div>
              </div>

              {/* Tabla de tareas críticas */}
              <div className="mb-10 overflow-x-auto" ref={tableRef}>
                {tasks ? (
                  <TaskTable
                    data={tasks.criticalTasks.items}
                    total={tasks.criticalTasks.total}
                    nextCursor={tasks.criticalTasks.nextCursor}
                    selectedTaskId={selectedTaskId}
                    isLoadingMore={isLoadingMore}
                    onLoadMore={loadMoreTasks}
                  />
                ) : sectionErrors.tasks ? (
                  <NoticeBanner tone="error" title="No pudimos cargar tareas críticas">
                    <p className="text-sm">{sectionErrors.tasks}</p>
                  </NoticeBanner>
                ) : (
                  <Skeleton className="h-96" />
                )}
              </div>
            </div>
          )}
        </div>

        {showTaskForm ? (
          <TaskForm
            projects={projects}
            onSubmit={handleSubmitTask}
            onCancel={() => setShowTaskForm(false)}
          />
        ) : null}
        <ReportModal isOpen={showReport} onClose={() => setShowReport(false)} />
      </div>
    </ProtectedLayout>
  );
}
