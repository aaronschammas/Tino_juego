/**
 * useTasks.ts - useTasks Hook Tests
 * AAA Pattern: Arrange, Act, Assert
 */

import { renderHook, act } from '@testing-library/react';
import { useTasks } from './useTasks';
import * as apiLib from '@/lib/api';
import { Task, CreateTaskDto, UpdateTaskDto, TaskStatus } from '@/types/task';
import { Priority } from '@/types/project';

// Mock the API library
jest.mock('@/lib/api');

describe('useTasks Hook', () => {
  const mockTasks: Task[] = [
    {
      id: 'task-1',
      title: 'Task 1',
      description: 'Description 1',
      status: 'TODO' as TaskStatus,
      priority: Priority.MEDIUM,
      projectId: 'project-1',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
    {
      id: 'task-2',
      title: 'Task 2',
      description: 'Description 2',
      status: 'IN_PROGRESS' as TaskStatus,
      priority: Priority.HIGH,
      projectId: 'project-1',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial state', () => {
    it('should initialize with empty tasks array', () => {
      // Arrange & Act
      const { result } = renderHook(() => useTasks('project-1'));

      // Assert
      expect(result.current.tasks).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should provide task management functions', () => {
      // Arrange & Act
      const { result } = renderHook(() => useTasks('project-1'));

      // Assert
      expect(typeof result.current.fetchTasks).toBe('function');
      expect(typeof result.current.createTask).toBe('function');
      expect(typeof result.current.updateTask).toBe('function');
      expect(typeof result.current.updateTaskStatus).toBe('function');
      expect(typeof result.current.getTaskById).toBe('function');
    });
  });

  describe('fetchTasks', () => {
    it('should fetch tasks for a project', async () => {
      // Arrange
      (apiLib.apiGet as jest.Mock).mockResolvedValue(mockTasks);

      // Act
      const { result } = renderHook(() => useTasks('project-1'));
      await act(async () => {
        await result.current.fetchTasks();
      });

      // Assert
      expect(apiLib.apiGet).toHaveBeenCalledWith('/projects/project-1/tasks');
      expect(result.current.tasks).toEqual(mockTasks);
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it('should accept projectId parameter', async () => {
      // Arrange
      (apiLib.apiGet as jest.Mock).mockResolvedValue(mockTasks);

      // Act
      const { result } = renderHook(() => useTasks());
      await act(async () => {
        await result.current.fetchTasks('project-2');
      });

      // Assert
      expect(apiLib.apiGet).toHaveBeenCalledWith('/projects/project-2/tasks');
    });

    it('should use constructor projectId when parameter not provided', async () => {
      // Arrange
      (apiLib.apiGet as jest.Mock).mockResolvedValue(mockTasks);

      // Act
      const { result } = renderHook(() => useTasks('project-1'));
      await act(async () => {
        await result.current.fetchTasks();
      });

      // Assert
      expect(apiLib.apiGet).toHaveBeenCalledWith('/projects/project-1/tasks');
    });

    it('should error when no projectId is available', async () => {
      // Arrange & Act
      const { result } = renderHook(() => useTasks());
      await act(async () => {
        await result.current.fetchTasks();
      });

      // Assert
      expect(result.current.error).toBe('Project ID is required');
      expect(apiLib.apiGet).not.toHaveBeenCalled();
    });

    it('should handle fetch error', async () => {
      // Arrange
      const error = new Error('Failed to fetch tasks');
      (apiLib.apiGet as jest.Mock).mockRejectedValue(error);

      // Act
      const { result } = renderHook(() => useTasks('project-1'));
      await act(async () => {
        try {
          await result.current.fetchTasks();
        } catch {
          // Expected
        }
      });

      // Assert
      expect(result.current.error).toBe('Failed to fetch tasks');
      expect(result.current.tasks).toEqual([]);
    });

    it('should use fallback error message', async () => {
      // Arrange
      (apiLib.apiGet as jest.Mock).mockRejectedValue('Unknown error');

      // Act
      const { result } = renderHook(() => useTasks('project-1'));
      await act(async () => {
        try {
          await result.current.fetchTasks();
        } catch {
          // Expected
        }
      });

      // Assert
      expect(result.current.error).toBe('Error al cargar tareas');
    });
  });

  describe('createTask', () => {
    it('should create a new task', async () => {
      // Arrange
      const newTask: Task = {
        id: 'task-3',
        title: 'New Task',
        description: 'New Description',
        status: 'TODO' as TaskStatus,
        priority: Priority.LOW,
        projectId: 'project-1',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };
      const createDto: CreateTaskDto = {
        title: 'New Task',
        description: 'New Description',
      };
      (apiLib.apiPost as jest.Mock).mockResolvedValue(newTask);

      // Act
      const { result } = renderHook(() => useTasks('project-1'));
      await act(async () => {
        await result.current.createTask('project-1', createDto);
      });

      // Assert
      expect(apiLib.apiPost).toHaveBeenCalledWith(
        '/projects/project-1/tasks',
        createDto
      );
      expect(result.current.tasks).toContainEqual(newTask);
    });

    it('should prepend new task to tasks list', async () => {
      // Arrange
      (apiLib.apiGet as jest.Mock).mockResolvedValue(mockTasks);
      const newTask: Task = {
        id: 'task-3',
        title: 'New Task',
        description: 'New Description',
        status: 'TODO' as TaskStatus,
        priority: Priority.LOW,
        projectId: 'project-1',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };
      (apiLib.apiPost as jest.Mock).mockResolvedValue(newTask);

      // Act
      const { result } = renderHook(() => useTasks('project-1'));
      await act(async () => {
        await result.current.fetchTasks();
        await result.current.createTask('project-1', {
          title: 'New Task',
          description: 'New Description',
        });
      });

      // Assert
      expect(result.current.tasks[0]).toEqual(newTask);
      expect(result.current.tasks.length).toBe(3);
    });

    it('should handle create error', async () => {
      // Arrange
      const error = new Error('Creation failed');
      (apiLib.apiPost as jest.Mock).mockRejectedValue(error);

      // Act
      const { result } = renderHook(() => useTasks('project-1'));
      await act(async () => {
        try {
          await result.current.createTask('project-1', {
            title: 'New Task',
          });
        } catch {
          // Expected
        }
      });

      // Assert
      expect(result.current.error).toBe('Creation failed');
    });
  });

  describe('updateTask', () => {
    it('should update an existing task', async () => {
      // Arrange
      const updatedTask: Task = {
        ...mockTasks[0],
        status: 'DONE' as TaskStatus,
      };
      const updateDto: UpdateTaskDto = { status: 'DONE' as TaskStatus };
      (apiLib.apiPatch as jest.Mock).mockResolvedValue(updatedTask);

      // Act
      const { result } = renderHook(() => useTasks('project-1'));
      await act(async () => {
        await result.current.updateTask('project-1', 'task-1', updateDto);
      });

      // Assert
      expect(apiLib.apiPatch).toHaveBeenCalledWith(
        '/projects/project-1/tasks/task-1',
        updateDto
      );
    });

    it('should handle update error', async () => {
      // Arrange
      const error = new Error('Update failed');
      (apiLib.apiPatch as jest.Mock).mockRejectedValue(error);
      // Act
      const { result } = renderHook(() => useTasks('project-1'));
      await act(async () => {
        try {
          await result.current.updateTask('project-1', 'task-1', {
            status: TaskStatus.DONE,
          });
        } catch {
          // Expected
        }
      });

      // Assert
      expect(result.current.error).toBe('Update failed');
    });
  });

  describe('tree operations', () => {
    const parentTask: Task = {
      id: 'parent-1',
      title: 'Parent',
      description: 'Parent task',
      status: TaskStatus.TODO,
      priority: Priority.MEDIUM,
      projectId: 'project-1',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
      subTasks: [
        {
          id: 'sub-1',
          title: 'Sub 1',
          status: TaskStatus.TODO,
          priority: Priority.LOW,
          projectId: 'project-1',
          parentTaskId: 'parent-1',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      ],
    };

    it('inserts a created subtask under its parent', async () => {
      const subTask: Task = {
        id: 'sub-2',
        title: 'Sub 2',
        status: TaskStatus.TODO,
        priority: Priority.LOW,
        projectId: 'project-1',
        parentTaskId: 'parent-1',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };
      (apiLib.apiPost as jest.Mock).mockResolvedValue(subTask);

      const { result } = renderHook(() => useTasks('project-1'));
      act(() => {
        result.current.setTasks([parentTask]);
      });

      await act(async () => {
        await result.current.createTask('project-1', { title: 'Sub 2', parentTaskId: 'parent-1' });
      });

      expect(result.current.tasks[0].subTasks?.map((task) => task.id)).toEqual(['sub-2', 'sub-1']);
    });

    it('updates a nested subtask in place', async () => {
      const updatedSubTask: Task = {
        ...parentTask.subTasks![0],
        title: 'Updated subtask',
      };
      (apiLib.apiPatch as jest.Mock).mockResolvedValue(updatedSubTask);

      const { result } = renderHook(() => useTasks('project-1'));
      act(() => {
        result.current.setTasks([parentTask]);
      });

      await act(async () => {
        await result.current.updateTask('project-1', 'sub-1', { title: 'Updated subtask' });
      });

      expect(result.current.tasks[0].subTasks?.[0].title).toBe('Updated subtask');
    });

    it('cascades parent status optimistically before applying backend response', async () => {
      const updatedParent = {
        ...parentTask,
        status: TaskStatus.IN_PROGRESS,
        subTasks: parentTask.subTasks?.map((subTask) => ({
          ...subTask,
          status: TaskStatus.IN_PROGRESS,
        })),
      };
      (apiLib.apiPatch as jest.Mock).mockResolvedValue(updatedParent);

      const { result } = renderHook(() => useTasks('project-1'));
      act(() => {
        result.current.setTasks([parentTask]);
      });

      await act(async () => {
        await result.current.updateTaskStatus('project-1', 'parent-1', TaskStatus.IN_PROGRESS);
      });

      expect(apiLib.apiPatch).toHaveBeenCalledWith('/projects/project-1/tasks/parent-1/status', {
        status: TaskStatus.IN_PROGRESS,
      });
      expect(result.current.tasks[0]).toEqual(updatedParent);
    });

    it('updates a subtask status and refetches to sync the parent', async () => {
      const updatedSubTask = {
        ...parentTask.subTasks![0],
        status: TaskStatus.IN_PROGRESS,
      };
      const freshTree = [
        {
          ...parentTask,
          status: TaskStatus.IN_PROGRESS,
          subTasks: [updatedSubTask],
        },
      ];
      (apiLib.apiPatch as jest.Mock).mockResolvedValue(updatedSubTask);
      (apiLib.apiGet as jest.Mock).mockResolvedValue(freshTree);

      const { result } = renderHook(() => useTasks('project-1'));
      act(() => {
        result.current.setTasks([parentTask]);
      });

      await act(async () => {
        await result.current.updateTaskStatus('project-1', 'sub-1', TaskStatus.IN_PROGRESS);
      });

      expect(apiLib.apiGet).toHaveBeenCalledWith('/projects/project-1/tasks');
      expect(result.current.tasks).toEqual(freshTree);
    });

    it('rolls back optimistic status when status update fails', async () => {
      (apiLib.apiPatch as jest.Mock).mockRejectedValue(new Error('Status failed'));

      const { result } = renderHook(() => useTasks('project-1'));
      act(() => {
        result.current.setTasks([parentTask]);
      });

      await act(async () => {
        await expect(
          result.current.updateTaskStatus('project-1', 'sub-1', TaskStatus.BLOCKED),
        ).rejects.toThrow('Status failed');
      });

      expect(result.current.tasks).toEqual([parentTask]);
      expect(result.current.error).toBe('Status failed');
    });

    it('removes parent tasks and nested subtasks from local state', async () => {
      (apiLib.apiDelete as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useTasks('project-1'));
      act(() => {
        result.current.setTasks([parentTask, mockTasks[0]]);
      });

      await act(async () => {
        await result.current.deleteTask('project-1', 'sub-1');
      });

      expect(result.current.tasks[0].subTasks).toEqual([]);

      await act(async () => {
        await result.current.deleteTask('project-1', 'parent-1');
      });

      expect(result.current.tasks.map((task) => task.id)).toEqual(['task-1']);
    });

    it('gets a task by id and handles get/delete errors', async () => {
      (apiLib.apiGet as jest.Mock).mockResolvedValueOnce(parentTask);
      (apiLib.apiDelete as jest.Mock).mockRejectedValueOnce(new Error('Delete failed'));

      const { result } = renderHook(() => useTasks('project-1'));

      await act(async () => {
        await expect(result.current.getTaskById('project-1', 'parent-1')).resolves.toEqual(parentTask);
      });
      expect(apiLib.apiGet).toHaveBeenCalledWith('/projects/project-1/tasks/parent-1');

      await act(async () => {
        await expect(result.current.deleteTask('project-1', 'parent-1')).rejects.toThrow('Delete failed');
      });
      expect(result.current.error).toBe('Delete failed');
    });
  });

  describe('Multiple operations', () => {
    it('should handle sequential fetch and create', async () => {
      // Arrange
      const mockApiGet = jest.spyOn(apiLib, 'apiGet').mockResolvedValue(mockTasks);
      const mockApiPost = jest.spyOn(apiLib, 'apiPost').mockResolvedValue({
        id: 'task-3',
        title: 'New Task',
        description: 'Description',
        status: 'TODO' as TaskStatus,
        projectId: 'project-1',
      });

      // Act
      const { result } = renderHook(() => useTasks('project-1'));
      await act(async () => {
        await result.current.fetchTasks();
      });

      // Assert after fetch
      expect(result.current.tasks).toEqual(mockTasks);

      // Act - Create new task
      await act(async () => {
        await result.current.createTask('project-1', {
          title: 'New Task',
          description: 'Description',
        });
      });

      // Assert after create
      expect(result.current.tasks.length).toBe(3);
      expect(result.current.tasks[0].id).toBe('task-3');

      // Cleanup
      mockApiGet.mockRestore();
      mockApiPost.mockRestore();
    });

    it('should handle concurrent operations', async () => {
      // Arrange
      const task1: Task = { ...mockTasks[0] };
      const task2: Task = { ...mockTasks[1] };
      (apiLib.apiGet as jest.Mock)
        .mockResolvedValueOnce([task1])
        .mockResolvedValueOnce([task1, task2]);

      // Act
      const { result } = renderHook(() => useTasks('project-1'));
      await act(async () => {
        await Promise.all([
          result.current.fetchTasks(),
          result.current.fetchTasks(),
        ]);
      });

      // Assert
      expect(apiLib.apiGet).toHaveBeenCalledTimes(2);
    });
  });

  describe('State management', () => {
    it('should set isLoading during fetch', async () => {
      // Arrange
      let loadingStates: boolean[] = [];
      (apiLib.apiGet as jest.Mock).mockImplementation(() => {
        loadingStates.push(true);
        return new Promise(resolve => {
          setTimeout(() => {
            loadingStates.push(false);
            resolve(mockTasks);
          }, 50);
        });
      });

      // Act
      const { result } = renderHook(() => useTasks('project-1'));
      await act(async () => {
        await result.current.fetchTasks();
      });

      // Assert
      expect(result.current.isLoading).toBe(false);
    });

    it('should clear error on successful fetch', async () => {
      // Arrange
      (apiLib.apiGet as jest.Mock)
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce(mockTasks);

      // Act
      const { result } = renderHook(() => useTasks('project-1'));

      await act(async () => {
        try {
          await result.current.fetchTasks();
        } catch {
          // Expected
        }
      });

      expect(result.current.error).not.toBeNull();

      await act(async () => {
        await result.current.fetchTasks();
      });

      // Assert
      expect(result.current.error).toBeNull();
    });
  });
});
