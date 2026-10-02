import { useCallback, useState } from 'react';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { Task, CreateTaskDto, UpdateTaskDto, TaskStatus } from '@/types/task';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function insertTask(tasks: Task[], newTask: Task) {
  if (!newTask.parentTaskId) return [newTask, ...tasks];

  return tasks.map((task) =>
    task.id === newTask.parentTaskId
      ? { ...task, subTasks: [newTask, ...(task.subTasks || [])] }
      : task,
  );
}

function updateTaskInTree(tasks: Task[], taskId: string, updatedTask: Task) {
  return tasks.map((task) => {
    if (task.id === taskId) return updatedTask;

    if (task.subTasks?.some((subTask) => subTask.id === taskId)) {
      return {
        ...task,
        subTasks: task.subTasks.map((subTask) =>
          subTask.id === taskId ? updatedTask : subTask,
        ),
      };
    }

    return task;
  });
}

function updateTaskStatusInTree(tasks: Task[], taskId: string, status: TaskStatus) {
  return tasks.map((task) => {
    if (task.id === taskId) {
      // Si es una tarea padre con subtareas, refleja la cascada tambien de forma
      // optimista en el estado local (el backend hace lo mismo al recibir el PATCH).
      return {
        ...task,
        status,
        subTasks: task.subTasks?.length
          ? task.subTasks.map((subTask) => ({ ...subTask, status }))
          : task.subTasks,
      };
    }

    if (task.subTasks?.some((subTask) => subTask.id === taskId)) {
      return {
        ...task,
        subTasks: task.subTasks.map((subTask) =>
          subTask.id === taskId ? { ...subTask, status } : subTask,
        ),
      };
    }

    return task;
  });
}

function removeTaskFromTree(tasks: Task[], taskId: string) {
  return tasks
    .filter((task) => task.id !== taskId)
    .map((task) => ({
      ...task,
      subTasks: task.subTasks?.filter((subTask) => subTask.id !== taskId),
    }));
}

export function useTasks(projectId?: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async (projectIdParam?: string) => {
    const id = projectIdParam || projectId;
    if (!id) {
      setError('Project ID is required');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const data = await apiGet<Task[]>(`/projects/${id}/tasks`);
      setTasks(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Error al cargar tareas'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  const createTask = useCallback(async (projectIdParam: string, data: CreateTaskDto) => {
    try {
      setIsLoading(true);
      setError(null);
      const newTask = await apiPost<Task>(`/projects/${projectIdParam}/tasks`, data);
      setTasks((prev) => insertTask(prev, newTask));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('task:updated'));
        window.dispatchEvent(new Event('projects:updated'));
      }
      return newTask;
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Error al crear tarea'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateTask = useCallback(async (
    projectIdParam: string,
    taskId: string,
    data: UpdateTaskDto
  ) => {
    try {
      setIsLoading(true);
      setError(null);
      const updatedTask = await apiPatch<Task>(
        `/projects/${projectIdParam}/tasks/${taskId}`,
        data
      );
      setTasks((prev) =>
        updateTaskInTree(prev, taskId, updatedTask)
      );
      // Dispatch event so dashboard and analytics re-fetch
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('task:updated'));
        window.dispatchEvent(new Event('projects:updated'));
      }
      return updatedTask;
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Error al actualizar tarea'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateTaskStatus = useCallback(async (
    projectIdParam: string,
    taskId: string,
    status: TaskStatus
  ) => {
    let previousTasks: Task[] = tasks;
    setTasks((prev) => {
      previousTasks = prev;
      return updateTaskStatusInTree(prev, taskId, status);
    });

    try {
      setIsLoading(true);
      setError(null);
      const updatedTask = await apiPatch<Task>(
        `/projects/${projectIdParam}/tasks/${taskId}/status`,
        { status }
      );
      setTasks((prev) =>
        updateTaskInTree(prev, taskId, updatedTask)
      );
      // Si es una subtarea, refetch completo para reflejar el nuevo estado del padre
      if (updatedTask.parentTaskId) {
        const freshTasks = await apiGet<Task[]>(`/projects/${projectIdParam}/tasks`);
        setTasks(freshTasks);
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('task:updated'));
        window.dispatchEvent(new Event('projects:updated'));
      }
      return updatedTask;
    } catch (err: unknown) {
      setTasks(previousTasks);
      setError(getErrorMessage(err, 'Error al cambiar estado de la tarea'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [tasks]);

  const deleteTask = useCallback(async (projectIdParam: string, taskId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      await apiDelete(`/projects/${projectIdParam}/tasks/${taskId}`);
      setTasks((prev) => removeTaskFromTree(prev, taskId));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('task:updated'));
        window.dispatchEvent(new Event('projects:updated'));
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Error al eliminar tarea'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getTaskById = useCallback(async (projectIdParam: string, taskId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const task = await apiGet<Task>(`/projects/${projectIdParam}/tasks/${taskId}`);
      return task;
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Error al obtener tarea'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    tasks,
    isLoading,
    error,
    fetchTasks,
    createTask,
    updateTask,
    updateTaskStatus,
    getTaskById,
    deleteTask,
    setTasks,
  };
}
