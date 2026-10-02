import { Priority } from './project';

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  BLOCKED = 'BLOCKED',
  DONE = 'DONE',
}

export const taskStatusLabels: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: 'Por hacer',
  [TaskStatus.IN_PROGRESS]: 'En progreso',
  [TaskStatus.BLOCKED]: 'Bloqueada',
  [TaskStatus.DONE]: 'Completada',
};

export const taskStatusColumnLabels: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: 'Por hacer',
  [TaskStatus.IN_PROGRESS]: 'En progreso',
  [TaskStatus.BLOCKED]: 'Bloqueadas',
  [TaskStatus.DONE]: 'Completadas',
};

export const allowedTaskStatusTransitions: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.TODO]:        [TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED, TaskStatus.DONE],
  [TaskStatus.IN_PROGRESS]: [TaskStatus.DONE, TaskStatus.BLOCKED, TaskStatus.TODO],
  [TaskStatus.BLOCKED]:     [TaskStatus.IN_PROGRESS, TaskStatus.DONE, TaskStatus.TODO],
  [TaskStatus.DONE]:        [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED],
};

export function getTaskStatusOptions(currentStatus?: TaskStatus) {
  if (!currentStatus) {
    return Object.values(TaskStatus);
  }

  return [currentStatus, ...allowedTaskStatusTransitions[currentStatus]];
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  dueDate?: string;
  
  // Relations
  projectId: string;
  project?: { id: string; name: string };
  assignedToId?: string | null;
  assignedTo?: {
    id: string;
    name: string;
    lastname: string;
    email: string;
  };
  responsibles?: Array<{
    id: string;
    name: string;
    lastname: string;
    email: string;
  }>;
  
  // Subtasks
  parentTaskId?: string;
  subTasks?: Task[];
  
  estimatedHours?: number;
  actualHours?: number;

  externalSource?: string | null;
  externalUrl?: string | null;

  
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskDto {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  dueDate?: string;
  parentTaskId?: string;
  assignedToId?: string;
  estimatedHours?: number;
}

export interface UpdateTaskDto {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  dueDate?: string;
  assignedToId?: string;
  estimatedHours?: number;
}
