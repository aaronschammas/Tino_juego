import { fireEvent, render, screen } from '@testing-library/react';
import TaskTable from './TaskTable';
import { DashboardCriticalTask } from '@/types/analytics';

const data: DashboardCriticalTask[] = [{
  id: 'task-1',
  title: 'Tarea bloqueada',
  projectId: 'project-1',
  projectName: 'Proyecto Alpha',
  status: 'BLOCKED',
  priority: 'HIGH',
  assignedTo: { id: 'user-1', name: 'Ada' },
  estimatedHours: 5,
  actualHours: 8,
  deviationHours: 3,
  dueDate: '2026-06-20T00:00:00.000Z',
  createdAt: '2026-06-01T00:00:00.000Z',
}];

describe('TaskTable v2', () => {
  it('renders criticalTasks items and backend total', () => {
    render(<TaskTable data={data} total={12} />);
    expect(screen.getByText('Tareas que requieren atención')).toBeInTheDocument();
    expect(screen.getByText('1 de 12 registros')).toBeInTheDocument();
    expect(screen.getByText('Tarea bloqueada')).toBeInTheDocument();
    expect(screen.getByText('Proyecto Alpha')).toBeInTheDocument();
    expect(screen.getByText('+03:00:00')).toHaveClass('text-[var(--color-danger)]');
  });

  it('supports cursor pagination without slicing locally', () => {
    const onLoadMore = jest.fn();
    render(<TaskTable data={data} total={12} nextCursor="task-1" onLoadMore={onLoadMore} />);
    fireEvent.click(screen.getByRole('button', { name: /cargar más tareas/i }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('renders the critical-task empty state', () => {
    render(<TaskTable data={[]} total={0} />);
    expect(screen.getByText(/sin tareas que requieran atención/i)).toBeInTheDocument();
  });
});
