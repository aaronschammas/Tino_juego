'use client';

import { memo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download, FileText, RefreshCcw, Table2, X } from 'lucide-react';
import Portal from '@/components/ui/Portal';
import { useProjects } from '@/hooks/useProjects';
import { useUsers } from '@/hooks/useUsers';
import { useReport } from '@/hooks/useReport';
import { secondsToHMS } from '@/lib/time';
import { taskStatusLabels } from '@/types/task';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const statusColors: Record<string, string> = {
  TODO: '#94a3b8',
  IN_PROGRESS: '#3b82f6',
  BLOCKED: '#f59e0b',
  DONE: '#10b981',
};

function formatHours(hours: number) {
  const sign = hours < 0 ? '-' : '';
  return `${sign}${secondsToHMS(Math.round(Math.abs(hours) * 3600))}`;
}

function ReportModal({ isOpen, onClose }: ReportModalProps) {
  const { projects } = useProjects();
  const { users } = useUsers();
  const {
    filters,
    setFilters,
    preview,
    isLoading,
    downloadingFormat,
    error,
    refetch,
    download,
  } = useReport(isOpen);

  if (!isOpen) return null;

  const userChartData = preview?.users.slice(0, 8).map((user) => ({
    name: user.name || 'Sin nombre',
    Tareas: user.completedTasks,
    Horas: user.actualHours,
  })) ?? [];
  const statusChartData = preview?.statusDistribution.map((item) => ({
    statusKey: item.status,
    estado: taskStatusLabels[item.status] ?? item.label,
    Tareas: item.count,
  })) ?? [];

  return (
    <Portal>
      <div className="fixed inset-0 z-50 bg-slate-950/40 px-3 py-4 backdrop-blur-sm md:px-8 md:py-8">
        <div className="mx-auto flex h-full max-w-[1320px] flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-7">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Informe</p>
              <h2 className="text-[24px] font-extrabold tracking-tight text-slate-900">Resumen operativo</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => void refetch()}
                disabled={isLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2 text-[13px] font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCcw size={16} />
                Actualizar
              </button>
              <button
                onClick={() => void download('excel')}
                disabled={downloadingFormat !== null || isLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-[13px] font-bold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
              >
                <Table2 size={16} />
                {downloadingFormat === 'excel' ? 'Generando…' : 'Excel'}
              </button>
              <button
                onClick={() => void download('pdf')}
                disabled={downloadingFormat !== null || isLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1e3a5f] px-3.5 py-2 text-[13px] font-bold text-white transition-colors hover:bg-[#2c4f7c] disabled:opacity-50"
              >
                <Download size={16} />
                {downloadingFormat === 'pdf' ? 'Generando…' : 'PDF'}
              </button>
              <button
                onClick={onClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                aria-label="Cerrar informe"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[320px_1fr]">
            <aside className="border-b border-slate-200 bg-slate-50/80 p-5 lg:border-b-0 lg:border-r">
              <div className="grid grid-cols-1 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Proyecto</label>
                  <select
                    value={filters.projectId}
                    onChange={(event) => setFilters((current) => ({ ...current, projectId: event.target.value }))}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] font-semibold text-slate-700 outline-none transition-all focus:border-[#1e3a5f] focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="all">Toda la organización</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Usuario</label>
                  <select
                    value={filters.userId}
                    onChange={(event) => setFilters((current) => ({ ...current, userId: event.target.value }))}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] font-semibold text-slate-700 outline-none transition-all focus:border-[#1e3a5f] focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="all">Todos los usuarios</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>{`${user.name} ${user.lastname}`.trim()}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Estado</label>
                  <select
                    value={filters.status}
                    onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] font-semibold text-slate-700 outline-none transition-all focus:border-[#1e3a5f] focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="all">Todos</option>
                    <option value="TODO">Por hacer</option>
                    <option value="IN_PROGRESS">En progreso</option>
                    <option value="BLOCKED">Bloqueada</option>
                    <option value="DONE">Completada</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Fecha inicio</label>
                    <input
                      type="date"
                      value={filters.startDate ?? ''}
                      max={filters.endDate ?? ''}
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          startDate: event.target.value || null,
                          endDate:
                            event.target.value && current.endDate && event.target.value > current.endDate
                              ? event.target.value
                              : current.endDate,
                        }))
                      }
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] font-semibold text-slate-700 outline-none transition-all focus:border-[#1e3a5f] focus:ring-4 focus:ring-blue-100"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Fecha fin</label>
                    <input
                      type="date"
                      value={filters.endDate ?? ''}
                      min={filters.startDate ?? ''}
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          endDate: event.target.value || null,
                          startDate:
                            event.target.value && current.startDate && event.target.value < current.startDate
                              ? event.target.value
                              : current.startDate,
                        }))
                      }
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] font-semibold text-slate-700 outline-none transition-all focus:border-[#1e3a5f] focus:ring-4 focus:ring-blue-100"
                    />
                  </div>
                </div>
              </div>
            </aside>

            <main className="min-h-0 overflow-y-auto bg-white p-5 md:p-7">
              {error ? (
                <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {error}
                </div>
              ) : null}

              {isLoading && !preview ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
                  ))}
                </div>
              ) : preview ? (
                <div className="flex flex-col gap-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Completadas</p>
                      <strong className="mt-2 block text-3xl font-extrabold text-slate-900">{preview.summary.completedTasks}</strong>
                      <span className="text-sm font-medium text-slate-500">{preview.summary.completionRate}% del total</span>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">No completadas</p>
                      <strong className="mt-2 block text-3xl font-extrabold text-slate-900">{preview.summary.incompleteTasks}</strong>
                      <span className="text-sm font-medium text-slate-500">{preview.summary.overdueTasks} vencidas</span>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Tiempo real</p>
                      <strong className="mt-2 block text-3xl font-extrabold text-slate-900">{formatHours(preview.summary.totalActualHours)}</strong>
                      <span className="text-sm font-medium text-slate-500">registrado</span>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Desvío</p>
                      <strong className="mt-2 block text-3xl font-extrabold text-slate-900">{formatHours(preview.summary.deviationHours)}</strong>
                      <span className="text-sm font-medium text-slate-500">real vs estimado</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                    <section className="rounded-2xl border border-slate-100 p-5">
                      <h3 className="text-base font-extrabold text-slate-900">Tareas por estado</h3>
                      <div className="mt-4 h-72 min-w-0">
                        <ResponsiveContainer width="100%" height="100%" minHeight={288} minWidth={0} debounce={100}>
                          <BarChart data={statusChartData} margin={{ left: -20, right: 10, top: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                            <XAxis dataKey="estado" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                            <Tooltip />
                            <Bar dataKey="Tareas" radius={[8, 8, 0, 0]}>
                              {statusChartData.map((entry) => (
                                <Cell key={entry.statusKey} fill={statusColors[entry.statusKey] ?? '#94a3b8'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </section>

                    <section className="rounded-2xl border border-slate-100 p-5">
                      <h3 className="text-base font-extrabold text-slate-900">Usuarios por tiempo</h3>
                      <div className="mt-4 h-72 min-w-0">
                        <ResponsiveContainer width="100%" height="100%" minHeight={288} minWidth={0} debounce={100}>
                          <BarChart data={userChartData} layout="vertical" margin={{ left: 20, right: 20, top: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef2f7" />
                            <XAxis type="number" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                            <YAxis type="category" dataKey="name" width={105} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                            <Tooltip />
                            <Bar dataKey="Horas" fill="#1e3a5f" radius={[0, 8, 8, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </section>
                  </div>

                  <section className="rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
                      <FileText size={18} className="text-[#1e3a5f]" />
                      <h3 className="text-base font-extrabold text-slate-900">Tareas con más tiempo registrado</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[760px] text-left text-sm">
                        <thead className="bg-slate-50 text-[11px] uppercase tracking-widest text-slate-400">
                          <tr>
                            <th className="px-5 py-3">Tarea</th>
                            <th className="px-5 py-3">Proyecto</th>
                            <th className="px-5 py-3">Usuario</th>
                            <th className="px-5 py-3">Estado</th>
                            <th className="px-5 py-3">Tiempo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {preview.topTasksByTime.length === 0 ? (
                            <tr>
                              <td className="px-5 py-6 text-center font-semibold text-slate-400" colSpan={5}>No hay tareas para este rango.</td>
                            </tr>
                          ) : (
                            preview.topTasksByTime.map((task) => (
                              <tr key={task.id}>
                                <td className="px-5 py-3 font-bold text-slate-800">{task.title}</td>
                                <td className="px-5 py-3 text-slate-600">{task.projectName}</td>
                                <td className="px-5 py-3 text-slate-600">{task.assignedTo}</td>
                                <td className="px-5 py-3 text-slate-600">{taskStatusLabels[task.status] ?? task.status}</td>
                                <td className="px-5 py-3 font-bold text-slate-800">{formatHours(task.actualHours)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
              ) : null}
            </main>
          </div>
        </div>
      </div>
    </Portal>
  );
}

export default memo(ReportModal);
