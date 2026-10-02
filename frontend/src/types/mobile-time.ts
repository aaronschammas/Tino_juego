import type { Project } from "./project";

export interface TimeSummaryItem {
  id: string;
  projectId: string;
  taskId: string | null;
  startTime: string;
  endTime: string;
  totalPausedMs: number;
  project: Pick<Project, "id" | "name">;
  task: { id: string; title: string } | null;
}

export interface TimeSummaryPage {
  todayMilliseconds: number;
  weekMilliseconds: number;
  timezone: string;
  items: TimeSummaryItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
