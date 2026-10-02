import type { TaskListItem } from './task-list';

export type MobileSummaryPeriod = 'week' | 'month';

export interface MobileSummaryOwn {
  pendingTasks: number;
  inProgressTasks: number;
  blockedTasks: number;
  overdueTasks: number;
  confirmedHours: number;
  activeProjects: number;
}

export interface MobileSummaryOrganization {
  confirmedHours: number;
  overdueTasks: number;
  unassignedTasks: number;
  activeProjects: number;
  statusDistribution: Array<{ status: string; count: number }>;
  hoursByUser: Array<{
    userId: string;
    name: string;
    confirmedHours: number;
  }>;
}

export interface MobileSummaryResponse {
  period: MobileSummaryPeriod;
  range: { from: string; to: string };
  timezone: string;
  privacy: 'self-only' | 'organization-aggregate';
  completedInPeriod: null;
  completedMetricReason: string;
  own: MobileSummaryOwn;
  organization?: MobileSummaryOrganization;
}

export interface MobileHomeTasks {
  overdue: TaskListItem[];
  upcoming: TaskListItem[];
  inProgress: TaskListItem[];
}
