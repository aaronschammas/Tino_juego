import { render, screen } from '@testing-library/react';
import TaskDetailPanel from './TaskDetailPanel';
import { Priority } from '@/types/project';
import { Task, TaskStatus } from '@/types/task';

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1', role: 'USER' } }),
}));
jest.mock('@/components/ui/Portal', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/components/task-comments/TaskCommentsSection', () => {
  function TaskCommentsSection() {
    return null;
  }
  return TaskCommentsSection;
});

const baseTask: Task = {
  id: 'task-1',
  title: 'Tarea de Trello',
  status: TaskStatus.TODO,
  priority: Priority.MEDIUM,
  projectId: 'project-1',
  createdAt: '2026-09-25T10:00:00.000Z',
  updatedAt: '2026-09-25T10:00:00.000Z',
};

const renderPanel = (task: Task) =>
  render(
    <TaskDetailPanel
      task={task}
      onClose={jest.fn()}
      onEditTask={jest.fn()}
      onCreateSubTask={jest.fn()}
      onStatusChange={jest.fn()}
    />,
  );

describe('TaskDetailPanel Trello link', () => {
  it('links to the original Trello card', () => {
    renderPanel({ ...baseTask, externalUrl: 'https://trello.com/c/abc' });

    const link = screen.getByRole('link', { name: /ver en trello/i });
    expect(link).toHaveAttribute('href', 'https://trello.com/c/abc');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('shows no link for tasks created in Tino', () => {
    renderPanel(baseTask);

    expect(screen.queryByRole('link', { name: /ver en trello/i })).not.toBeInTheDocument();
  });
});
