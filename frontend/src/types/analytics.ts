export interface OverviewAnalytics {
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  tasksInProgress: number;
  blockedTasks: number;
  overdueTasks: number;
  totalSecondsWorked: number;
  totalHoursWorked: number;
}

export interface ProjectAnalytics {
  projectId: string;
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  tasksInProgress: number;
  blockedTasks: number;
  overdueTasks: number;
  totalSecondsWorked: number;
  totalHoursWorked: number;
  avgTaskHours: number;
  members: Array<{
    userId: string;
    name: string;
    email: string;
    totalHours: number;
    tasksCompleted: number;
  }>;
}

export interface UserAnalytics {
  userId: string;
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  totalSecondsWorked: number;
  totalHoursWorked: number;
  avgHoursPerTask: number;
}

export interface BITask {
  id: string;
  title: string;
  status: 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  projectId: string;
  assignedToId?: string;
  createdAt: string;
  updatedAt: string;
  estimatedHours: number;
  actualHours: number;
  timeEntries: Array<{
    startTime: string;
    endTime: string;
  }>;
}

export type DashboardTaskStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE';
export type DashboardPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface DashboardRange {
  from: string;
  to: string;
}

export interface DashboardScope {
  organizationId: string;
  projectIds: string[];
  userIds: string[];
}

export interface DashboardResponseContext {
  range: DashboardRange;
  timezone: string;
  scope: DashboardScope;
}

export interface DashboardSummaryResponse extends DashboardResponseContext {
  metricSemantics: {
    tasks: string;
    time: string;
  };
  kpis: {
    totalTasks: number;
    openTasks: number;
    completedTasks: number;
    overdueTasks: number;
    blockedTasks: number;
    completionRate: number;
    estimatedHours: number;
    actualHours: number;
    effortDeviationHours: number;
    activeUsers: number;
    tasksWithoutTime: number;
    unassignedTasks: number;
  };
}

export interface DashboardDistribution<T extends string> {
  count: number;
  status?: T;
  priority?: T;
}

export interface DashboardCriticalTask {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  status: DashboardTaskStatus;
  priority: DashboardPriority;
  assignedTo: { id: string; name: string } | null;
  estimatedHours: number;
  actualHours: number;
  deviationHours: number;
  dueDate: string | null;
  createdAt: string;
}

export interface DashboardTasksResponse extends DashboardResponseContext {
  statusDistribution: Array<{ status: DashboardTaskStatus; count: number }>;
  priorityDistribution: Array<{ priority: DashboardPriority; count: number }>;
  criticalTasks: {
    items: DashboardCriticalTask[];
    nextCursor: string | null;
    total: number;
  };
}

export interface DashboardTimeTask {
  taskId: string;
  title: string;
  projectName: string;
  status: DashboardTaskStatus;
  priority: DashboardPriority;
  estimatedHours: number;
  actualHours: number;
  deviationHours: number;
}

export interface DashboardTimeResponse extends DashboardResponseContext {
  totals: {
    estimatedHours: number;
    actualHours: number;
    deviationHours: number;
    deviationPercent: number | null;
  };
  topTasksByTime: DashboardTimeTask[];
  topTasksByDeviation: DashboardTimeTask[];
  timeByStatus: Array<{
    status: DashboardTaskStatus;
    estimatedHours: number;
    actualHours: number;
  }>;
  timeByPriority: Array<{
    priority: DashboardPriority;
    estimatedHours: number;
    actualHours: number;
  }>;
}

export interface DashboardProjectMetric {
  projectId: string;
  projectName: string;
  totalTasks: number;
  openTasks: number;
  completedTasks: number;
  overdueTasks: number;
  blockedTasks: number;
  estimatedHours: number;
  actualHours: number;
  deviationHours: number;
  deviationPercent: number | null;
  activeUsers: number;
}

export interface DashboardProjectsResponse extends DashboardResponseContext {
  projects: DashboardProjectMetric[];
}

export interface DashboardUserMetric {
  userId: string;
  name: string;
  assignedTasks: number;
  completedTasks: number;
  estimatedHours: number;
  actualHours: number;
  activeDays: number;
  lastActivityAt: string | null;
}

export interface DashboardUsersResponse extends DashboardResponseContext {
  privacy: 'organization-aggregate' | 'self-only';
  users: DashboardUserMetric[];
}

export interface DashboardHeatmapCell {
  dayOfWeek: number;
  hour: number;
  minutes: number;
  entries: number;
  users: number;
  projects: number;
  outsideBusinessHours: boolean;
  intensity: number;
}

export interface DashboardHeatmapResponse {
  range: DashboardRange;
  timezone: string;
  groupBy: 'hourOfWeek';
  totals: {
    minutes: number;
    entries: number;
    users: number;
    projects: number;
  };
  cells: DashboardHeatmapCell[];
  normalization: {
    method: 'p95';
    maxMinutes: number;
  };
}

export interface ReportSummary {
  totalTasks: number;
  completedTasks: number;
  incompleteTasks: number;
  overdueTasks: number;
  completionRate: number;
  totalEstimatedHours: number;
  totalActualHours: number;
  deviationHours: number;
}

export interface ReportStatusDistribution {
  status: DashboardTaskStatus;
  label: string;
  count: number;
}

export interface ReportUserMetric {
  name: string;
  totalTasks: number;
  completedTasks: number;
  actualHours: number;
}

export interface ReportProjectMetric {
  name: string;
  totalTasks: number;
  completedTasks: number;
  actualHours: number;
}

export interface ReportTaskRow {
  id: string;
  title: string;
  projectName: string;
  assignedTo: string;
  status: DashboardTaskStatus;
  estimatedHours: number;
  actualHours: number;
  deviationHours: number;
  dueDate: string | null;
  createdAt: string;
}

export interface ReportPreviewResponse {
  range: DashboardRange;
  timezone: string;
  summary: ReportSummary;
  statusDistribution: ReportStatusDistribution[];
  users: ReportUserMetric[];
  projects: ReportProjectMetric[];
  topTasksByTime: ReportTaskRow[];
  incompleteTasks: ReportTaskRow[];
}
