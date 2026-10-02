import { Priority } from './project';
import { TaskStatus } from './task';

export type TaskAssignmentSource = 'direct' | 'subtask' | 'none';

export interface TaskListItem {
  id: string;
  projectId: string;
  project: { id: string; name: string };
  title: string;
  status: TaskStatus;
  priority: Priority;
  dueDate?: string | null;
  assignedToId?: string | null;
  assignedTo?: { id: string; name: string; lastname: string } | null;
  estimatedHours?: number | null;
  updatedAt: string;
  hasSubTasks: boolean;
  assignmentSource: TaskAssignmentSource;
}

export interface TasksPage {
  items: TaskListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface MobileTaskFilters {
  search: string;
  projectId: string;
  status: TaskStatus | '';
  priority: Priority | '';
  assignedTo: 'me' | '';
  overdue: boolean | null;
}
