import { Prisma, TaskStatus } from '@prisma/client';

export interface ReportScope {
  organizationId: string;
  projectIds: string[];
  userIds?: string[];
  canViewOrganization: boolean;
}

export interface ReportTaskRow {
  id: string;
  title: string;
  parentTitle: string | null;
  projectName: string;
  userId: string | null;
  assignedTo: string;
  status: TaskStatus;
  estimatedHours: number;
  actualHours: number;
  deviationHours: number;
  createdAt: Date;
  dueDate: Date | null;
}

export interface ReportUserMetric {
  userId: string;
  name: string;
  totalTasks: number;
  completedTasks: number;
  incompleteTasks: number;
  estimatedHours: number;
  actualHours: number;
  deviationHours: number;
}

export interface ReportDocument {
  organization: { id: string; name: string };
  generatedAt: string;
  range: { from: string; to: string };
  timezone: string;
  filters: { project: string; user: string; status: string };
  summary: {
    totalTasks: number;
    completedTasks: number;
    incompleteTasks: number;
    overdueTasks: number;
    completionRate: number;
    totalEstimatedHours: number;
    totalActualHours: number;
    deviationHours: number;
  };
  statusDistribution: Array<{
    status: TaskStatus;
    label: string;
    count: number;
  }>;
  users: ReportUserMetric[];
  tasks: ReportTaskRow[];
}

export type ReportTask = Prisma.TaskGetPayload<{
  include: {
    project: { select: { name: true } };
    assignedTo: { select: { id: true; name: true; lastname: true } };
    timeEntries: {
      select: { startTime: true; endTime: true; totalPausedMs: true };
    };
    subTasks: {
      include: {
        assignedTo: { select: { id: true; name: true; lastname: true } };
        timeEntries: {
          select: { startTime: true; endTime: true; totalPausedMs: true };
        };
      };
    };
  };
}>;
