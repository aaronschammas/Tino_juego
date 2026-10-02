import { Task } from './task';

export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface ProjectTimeEntry {
  id: string;
  startTime: string;
  endTime: string;
  totalPausedMs: number;
  userId: string;
  user: {
    name: string;
    lastname: string;
    email: string;
  };
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  dueDate?: string;
  priority: Priority;
  ownerId: string;
  isActive: boolean;
  tasks?: Task[];
  taskStats?: {
    total: number;
    completed: number;
  };
  members?: Array<{
    id: string;
    role: 'OWNER' | 'MEMBER';
    user: {
      id: string;
      email: string;
      name: string;
      lastname: string;
    };
  }>;
  timeEntries?: ProjectTimeEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectDto {
  name: string;
  description?: string;
  dueDate?: string;
  priority?: Priority;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
  dueDate?: string;
  priority?: Priority;
}
