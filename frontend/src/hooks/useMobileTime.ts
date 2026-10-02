"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./useAuth";
import { useTimer } from "@/context/TimerContext";
import { apiGet } from "@/lib/api";
import type { Project } from "@/types/project";
import { TaskStatus } from "@/types/task";
import type { TaskListItem, TasksPage } from "@/types/task-list";
import type { TimeSummaryPage } from "@/types/mobile-time";

const ZONE = "America/Argentina/Buenos_Aires";
const emptySummary: TimeSummaryPage = {
  todayMilliseconds: 0,
  weekMilliseconds: 0,
  timezone: ZONE,
  items: [],
  page: 0,
  pageSize: 10,
  total: 0,
  totalPages: 0,
};

export function useMobileTime() {
  const { user, activeOrganization } = useAuth();
  const timer = useTimer();
  const { refreshTimer, startTimer, pauseTimer, resumeTimer, stopTimer } =
    timer;
  const organizationId = activeOrganization?.id ?? null;
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [projectId, setProjectIdState] = useState("");
  const [taskId, setTaskId] = useState("");
  const [summary, setSummary] = useState(emptySummary);
  const [loading, setLoading] = useState(true);
  const [secondaryError, setSecondaryError] = useState<string | null>(null);
  const generation = useRef(0);
  const mounted = useRef(true);
  const actionLock = useRef(false);

  const valid = useCallback(
    (g: number, org: string) =>
      mounted.current &&
      generation.current === g &&
      activeOrganization?.id === org,
    [activeOrganization?.id],
  );
  const loadSummary = useCallback(
    async (page = 1, append = false) => {
      if (!organizationId) return;
      const g = generation.current;
      const org = organizationId;
      try {
        const result = await apiGet<TimeSummaryPage>(
          `/time/summary?page=${page}&pageSize=10&timezone=${encodeURIComponent(ZONE)}`,
        );
        if (!valid(g, org)) return;
        setSummary((current) =>
          append
            ? { ...result, items: [...current.items, ...result.items] }
            : result,
        );
        setSecondaryError(null);
      } catch (error) {
        if (valid(g, org))
          setSecondaryError(
            error instanceof Error
              ? error.message
              : "No se pudo cargar el historial.",
          );
      }
    },
    [organizationId, valid],
  );

  const loadInitial = useCallback(async () => {
    if (!organizationId || !user?.id) return;
    const g = ++generation.current;
    const org = organizationId;
    setLoading(true);
    setSecondaryError(null);
    try {
      const [accessible] = await Promise.all([
        apiGet<Project[]>("/projects"),
        refreshTimer(),
        loadSummary(1),
      ]);
      if (!valid(g, org)) return;
      setProjects(accessible.filter((project) => project.isActive !== false));
    } catch (error) {
      if (valid(g, org))
        setSecondaryError(
          error instanceof Error
            ? error.message
            : "No se pudo cargar el módulo de tiempo.",
        );
    } finally {
      if (valid(g, org)) setLoading(false);
    }
  }, [loadSummary, organizationId, refreshTimer, user?.id, valid]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);
  useEffect(() => {
    const clear = () => {
      generation.current += 1;
      actionLock.current = false;
      setProjects([]);
      setTasks([]);
      setProjectIdState("");
      setTaskId("");
      setSummary(emptySummary);
      setLoading(true);
    };
    window.addEventListener("organization:changed", clear);
    window.addEventListener("auth:cleared", clear);
    return () => {
      mounted.current = false;
      generation.current += 1;
      window.removeEventListener("organization:changed", clear);
      window.removeEventListener("auth:cleared", clear);
    };
  }, []);

  const setProjectId = useCallback(
    async (next: string) => {
      setProjectIdState(next);
      setTaskId("");
      setTasks([]);
      if (!next || !organizationId) return;
      const g = ++generation.current;
      const org = organizationId;
      try {
        const page = await apiGet<TasksPage>(
          `/tasks?projectId=${encodeURIComponent(next)}&page=1&pageSize=50`,
        );
        if (valid(g, org))
          setTasks(
            page.items.filter(
              (task) => task.status !== TaskStatus.DONE && !task.hasSubTasks,
            ),
          );
      } catch (error) {
        if (valid(g, org))
          setSecondaryError(
            error instanceof Error
              ? error.message
              : "No se pudieron cargar las tareas.",
          );
      }
    },
    [organizationId, valid],
  );

  const act = useCallback(
    async (kind: "start" | "pause" | "resume" | "stop") => {
      if (actionLock.current || !organizationId) return;
      actionLock.current = true;
      const g = generation.current;
      const org = organizationId;
      try {
        if (kind === "start") await startTimer(projectId, taskId || undefined);
        if (kind === "pause") await pauseTimer();
        if (kind === "resume") await resumeTimer();
        if (kind === "stop") await stopTimer();
        if (valid(g, org)) await Promise.all([refreshTimer(), loadSummary(1)]);
      } catch {
        if (valid(g, org)) await refreshTimer();
      } finally {
        actionLock.current = false;
      }
    },
    [
      loadSummary,
      organizationId,
      pauseTimer,
      projectId,
      refreshTimer,
      resumeTimer,
      startTimer,
      stopTimer,
      taskId,
      valid,
    ],
  );

  return {
    ...timer,
    projects,
    tasks,
    projectId,
    taskId,
    summary,
    loading,
    secondaryError,
    setProjectId,
    setTaskId,
    start: () => act("start"),
    pause: () => act("pause"),
    resume: () => act("resume"),
    stop: () => act("stop"),
    retry: loadInitial,
    loadMore: () => loadSummary(summary.page + 1, true),
    actionPending: actionLock.current,
  };
}
