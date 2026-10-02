'use client';

import { useEffect, useMemo, useState } from 'react';
import ProtectedLayout from '@/components/layout/ProtectedLayout';
import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/hooks/useAuth';
import { isAdmin, isSuperAdmin, isOrgOwner, canManageProject } from '@/lib/auth';
import { useOrganizations } from '@/hooks/useOrganizations';
import ProjectCard from '@/components/projects/ProjectCard';
import ProjectForm from '@/components/projects/ProjectForm';
import TrelloImportModal from '@/components/projects/TrelloImportModal';
import TrelloConnectModal from '@/components/integrations/TrelloConnectModal';
import { useIntegrationAvailability } from '@/hooks/useIntegrations';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import NoticeBanner from '@/components/ui/NoticeBanner';
import { Project, CreateProjectDto } from '@/types/project';
import { translateErrorMessage } from '@/lib/errorMessages';
import { cn } from '@/lib/cn';
import { Search, Plus, Folder, Activity, Pause, DownloadCloud, CheckCircle2, ListTodo, Users, Link2 } from 'lucide-react';

type FilterType = 'all' | 'active' | 'paused';

function ProjectSkeletonCard() {
  return (
    <div className="animate-pulse rounded-[28px] border border-gray-100 bg-white p-7 shadow-sm space-y-5">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="h-6 w-40 rounded-full bg-gray-100" />
          <div className="h-4 w-60 rounded-full bg-gray-50" />
        </div>
        <div className="h-6 w-16 rounded-full bg-gray-100" />
      </div>
      <div className="flex gap-4">
        <div className="h-4 w-20 rounded-full bg-gray-50" />
        <div className="h-4 w-24 rounded-full bg-gray-50" />
      </div>
      <div className="space-y-2">
        <div className="h-2 w-full rounded-full bg-gray-50" />
      </div>
      <div className="pt-4 border-t border-gray-50 flex gap-4">
        <div className="h-4 w-16 rounded-full bg-gray-50" />
        <div className="h-4 w-16 rounded-full bg-gray-50" />
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const {
    projects,
    isLoading,
    isFetching,
    error,
    createProject,
    updateProject,
    deleteProject,
    refetch,
  } = useProjects();
  const { user } = useAuth();
  const { getMyOrganization } = useOrganizations();
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | undefined>();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [roleFetchError, setRoleFetchError] = useState(false);
  const [projectPendingDeletion, setProjectPendingDeletion] = useState<Project | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showTrelloImport, setShowTrelloImport] = useState(false);
  const [showTrelloConnect, setShowTrelloConnect] = useState(false);
  const { availability: integrations } = useIntegrationAvailability();

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const organization = await getMyOrganization();
        setUserRole(organization.userRole || null);
        setRoleFetchError(false);
      } catch (fetchError) {
        console.error('Error fetching organization:', fetchError);
        setRoleFetchError(true);
      }
    };

    if (user?.id) {
      fetchRole();
    }
  }, [getMyOrganization, user?.id]);

  const canCreateProject = isOrgOwner(user, userRole);
  const canManageThisProject = (project: Project) => canManageProject(user, userRole, project);
  const planName = typeof user?.organizationPlan === 'string' 
    ? user.organizationPlan 
    : user?.organizationPlan?.name;
  const maxProjects = user?.organizationPlan?.maxProjects;
  const projectLimitReached = maxProjects !== null && projects.length >= (maxProjects ?? 2);

  const filteredProjects = useMemo(() => {
    let filtered = projects;

    if (searchTerm) {
      filtered = filtered.filter(
        (project) =>
          project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          project.description?.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    switch (filterType) {
      case 'active':
        filtered = filtered.filter((project) => project.isActive);
        break;
      case 'paused':
        filtered = filtered.filter((project) => !project.isActive);
        break;
      default:
        break;
    }

    return filtered;
  }, [filterType, projects, searchTerm]);

  const handleCreate = async (data: CreateProjectDto) => {
    await createProject(data);
    setShowForm(false);
  };

  const handleUpdate = async (data: CreateProjectDto) => {
    if (!editingProject) return;
    await updateProject(editingProject.id, data);
    setEditingProject(undefined);
  };

  const handleDelete = async (id: string) => {
    const project = projects.find((currentProject) => currentProject.id === id);
    if (!project) return;
    setProjectPendingDeletion(project);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingProject(undefined);
  };

  const activeCount = projects.filter((project) => project.isActive).length;
  const pausedCount = projects.filter((project) => !project.isActive).length;
  const showFirstProjectOnboarding = !isLoading && projects.length === 0;
  const firstProjectSteps = [
    { label: 'Crea el proyecto', icon: Folder },
    { label: 'Agrega tareas', icon: ListTodo },
    { label: 'Asigna responsables', icon: Users },
    { label: 'Revisa métricas', icon: CheckCircle2 },
  ];

  return (
    <ProtectedLayout>
      <div className="mx-auto max-w-[1600px] px-8 py-12 space-y-12 overflow-x-hidden">
        {/* Header Section */}
        <div className="space-y-6">
          <nav className="flex items-center gap-2 text-[13px] font-medium text-slate-400">
            <span>Workspace</span>
          </nav>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2">
              <h1 className="text-[32px] md:text-[40px] font-extrabold tracking-tight text-slate-900 leading-none">
                Proyectos
              </h1>
              <p className="text-[15px] text-slate-500 font-medium leading-relaxed max-w-2xl">
                Gestiona el portafolio activo, revisa capacidad y mantiene una vista clara de cada iniciativa.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
              {integrations?.canManage ? (
                <Button
                  onClick={() => setShowTrelloConnect(true)}
                  variant="secondary"
                  className="h-14 rounded-2xl px-8 font-bold shadow-sm"
                >
                  <Link2 size={20} className="mr-2" />
                  Conectar Trello
                </Button>
              ) : null}

              {isSuperAdmin(user) ? (
                <Button
                  onClick={() => setShowTrelloImport(true)}
                  variant="secondary"
                  className="h-14 rounded-2xl px-8 font-bold shadow-sm"
                >
                  <DownloadCloud size={20} className="mr-2" />
                  Importar desde Trello
                </Button>
              ) : null}

              <Button
                onClick={() => setShowForm(true)}
                disabled={!canCreateProject || projectLimitReached}
                className="h-14 px-8 rounded-2xl shadow-xl shadow-blue-900/10 font-bold bg-[#1e3a5f] hover:bg-[#2c4f7c]"
              >
                <Plus size={20} className="mr-2" />
                Nuevo proyecto
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <NoticeBanner title="Error al cargar proyectos" tone="error">
            {error}
          </NoticeBanner>
        )}

        {roleFetchError && (
          <NoticeBanner title="No pudimos verificar tus permisos" tone="warning">
            Recargá la página para volver a intentarlo.
          </NoticeBanner>
        )}

        {deleteError && (
          <NoticeBanner title="No se pudo eliminar el proyecto" tone="error" onDismiss={() => setDeleteError(null)}>
            {deleteError}
          </NoticeBanner>
        )}

        {showFirstProjectOnboarding ? (
          <div className="rounded-[32px] border border-slate-100 bg-white p-8 shadow-sm md:p-12">
            <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div className="space-y-7">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-[#1e3a5f]">
                  <Folder size={28} />
                </div>
                <div className="space-y-3">
                  <h2 className="text-[30px] font-extrabold leading-tight tracking-tight text-slate-900 md:text-[38px]">
                    Crea tu primer proyecto
                  </h2>
                  <p className="max-w-2xl text-[15px] font-medium leading-relaxed text-slate-500">
                    Los proyectos son el punto de partida para cargar tareas, sumar personas y empezar a ver métricas operativas.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    onClick={() => setShowForm(true)}
                    disabled={!canCreateProject || projectLimitReached}
                    className="h-14 rounded-2xl bg-[#1e3a5f] px-7 font-bold shadow-xl shadow-blue-900/10 hover:bg-[#2c4f7c]"
                  >
                    <Plus size={20} className="mr-2" />
                    Crear primer proyecto
                  </Button>

                  {isSuperAdmin(user) ? (
                    <Button
                      onClick={() => setShowTrelloImport(true)}
                      variant="secondary"
                      className="h-14 rounded-2xl px-7 font-bold"
                    >
                      <DownloadCloud size={20} className="mr-2" />
                      Importar desde Trello
                    </Button>
                  ) : null}
                </div>

                {!canCreateProject ? (
                  <NoticeBanner title="Necesitas permisos para crear proyectos" tone="warning">
                    Pide al propietario de la organización que cree el primer proyecto o ajuste tus permisos.
                  </NoticeBanner>
                ) : projectLimitReached ? (
                  <NoticeBanner title="Límite de proyectos alcanzado" tone="warning">
                    El plan actual no permite crear más proyectos.
                  </NoticeBanner>
                ) : null}
              </div>

              <div className="rounded-[28px] border border-slate-100 bg-slate-50/60 p-5">
                <div className="space-y-3">
                  {firstProjectSteps.map((step, index) => (
                    <div key={step.label} className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#1e3a5f]">
                        <step.icon size={20} />
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                          Paso {index + 1}
                        </p>
                        <p className="text-sm font-extrabold text-slate-900">{step.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
        {/* Stats Section */}
        <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
          {[
            { label: 'Total', value: projects.length, desc: 'Todos los proyectos cargados', icon: Folder, color: 'bg-blue-50 text-blue-600' },
            { label: 'Activos', value: activeCount, desc: 'Con trabajo en curso', icon: Activity, color: 'bg-green-50 text-green-600' },
            { label: 'Pausados', value: pausedCount, desc: 'Sin actividad actual', icon: Pause, color: 'bg-slate-100 text-slate-600' },
          ].map((stat, idx) => (
            <div key={idx} className="bg-white border border-slate-100 rounded-[32px] p-7 shadow-sm transition-all hover:shadow-md flex flex-col gap-6">
              <div className="flex items-center gap-4">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0", stat.color)}>
                  <stat.icon size={22} />
                </div>
                <p className="text-[12px] font-bold uppercase tracking-widest text-slate-400">{stat.label}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[40px] font-black text-slate-900 leading-none">{stat.value}</span>
                <p className="text-[14px] font-medium text-slate-500">{stat.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters Card */}
        <div className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm overflow-hidden">
          <div className="flex flex-col gap-6">
            <div className="relative w-full">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Buscar por nombre o descripcion"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-14 pl-14 pr-6 rounded-2xl bg-slate-50 border-transparent focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-[#1e3a5f]/20 transition-all text-sm font-bold placeholder:text-slate-400"
              />
            </div>
            
            <div className="flex bg-slate-50 p-1.5 rounded-2xl w-full overflow-x-auto scrollbar-hide">
              <div className="flex flex-nowrap min-w-full">
                {[
                  { value: 'all', label: 'Todos', count: projects.length },
                  { value: 'active', label: 'Activos', count: activeCount },
                  { value: 'paused', label: 'Pausados', count: pausedCount },
                ].map((filter) => (
                  <button
                    key={filter.value}
                    onClick={() => setFilterType(filter.value as FilterType)}
                    className={cn(
                      "flex-1 px-4 py-3 rounded-xl text-[13px] font-extrabold transition-all flex items-center justify-center gap-2 whitespace-nowrap",
                      filterType === filter.value
                        ? "bg-white text-[#1e3a5f] shadow-sm ring-1 ring-slate-100"
                        : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    {filter.label}
                    <span className={cn(
                      "text-[10px] px-2 py-0.5 rounded-md font-black",
                      filterType === filter.value ? "bg-slate-100 text-[#1e3a5f]" : "bg-slate-200 text-slate-500"
                    )}>
                      {filter.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Project List */}
        <div className="space-y-8">
          <div className="space-y-2">
            <h2 className="text-[24px] font-extrabold text-slate-900 tracking-tight">
              Listado de proyectos
            </h2>
            <p className="text-[15px] text-slate-500 font-medium">
              Una vista consistente para revisar estado, prioridad y avance sin perder contexto.
            </p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <ProjectSkeletonCard key={index} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 pb-20">
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onEdit={canManageThisProject(project) ? (p) => setEditingProject(p) : undefined}
                  onDelete={canManageThisProject(project) ? handleDelete : undefined}
                />
              ))}
              
              {canCreateProject && !projectLimitReached && (
                <EmptyState
                  variant="dashed"
                  icon={<Plus size={32} />}
                  title="Crea tu proximo proyecto"
                  description="Organiza iniciativas y mantene el avance bajo control."
                  action={
                    <Button 
                      onClick={() => setShowForm(true)} 
                      className="bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 rounded-xl px-6 h-12 font-bold shadow-sm"
                    >
                      Nuevo proyecto
                    </Button>
                  }
                  className="min-h-[400px]"
                />
              )}
            </div>
          )}
        </div>
          </>
        )}

        {/* Modals */}
        {(showForm || editingProject) && (
          <ProjectForm
            project={editingProject}
            onSubmit={editingProject ? handleUpdate : handleCreate}
            onCancel={handleCancel}
          />
        )}

        <TrelloImportModal
          isOpen={showTrelloImport}
          projects={projects}
          onClose={() => setShowTrelloImport(false)}
          onImported={async () => {
            await refetch({ background: true });
          }}
        />

        {showTrelloConnect ? (
          <TrelloConnectModal
            projects={projects}
            onClose={() => setShowTrelloConnect(false)}
            onConnected={async () => {
              await refetch({ background: true });
            }}
          />
        ) : null}

        <ConfirmDialog
          isOpen={projectPendingDeletion !== null}
          title="Eliminar proyecto"
          description={
            projectPendingDeletion
              ? `¿Estás seguro de que deseas eliminar "${projectPendingDeletion.name}"? Esta acción no se puede deshacer.`
              : ''
          }
          confirmLabel="Eliminar proyecto"
          tone="danger"
          onConfirm={async () => {
            if (!projectPendingDeletion) return;
            try {
              setDeleteError(null);
              await deleteProject(projectPendingDeletion.id);
              setProjectPendingDeletion(null);
            } catch (err) {
              setDeleteError(
                translateErrorMessage(
                  err instanceof Error ? err.message : undefined,
                  'No se pudo eliminar el proyecto.',
                ),
              );
              setProjectPendingDeletion(null);
            }
          }}
          onCancel={() => setProjectPendingDeletion(null)}
        />
      </div>
    </ProtectedLayout>
  );
}
