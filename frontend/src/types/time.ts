import { Project } from './project';
import { TaskStatus } from './task';

export interface TimeEntry {
  id: string;
  userId: string;
  projectId: string;
  startTime: string;
  endTime: string | null;
  pausedAt: string | null;
  createdAt: string;
  totalPausedMs: number;
  targetMinutes?: number;
  
  // Relations
  project?: Project;
  taskId?: string;
  task?: {
    id: string;
    title: string;
    status?: TaskStatus;
  } | null;
}

export interface StartTimeDto {
  projectId: string;
  taskId?: string;
  targetMinutes?: number;
}

export interface ActiveTimeResponse extends TimeEntry {
  project: Project;
  serverTime?: string;
}
