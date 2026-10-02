import { fireEvent, render, screen } from '@testing-library/react';
import ScatterChart from './ScatterChart';
import { DashboardTimeTask } from '@/types/analytics';

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  ScatterChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Scatter: (props: { data: Array<{ id: string }>; onClick: (point: { id: string }) => void }) => (
    <button data-testid="scatter-plot" onClick={() => props.onClick(props.data[0])}>Tareas</button>
  ),
  CartesianGrid: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
  ZAxis: () => null,
}));

const data: DashboardTimeTask[] = [{
  taskId: 'task-1',
  title: 'Tarea importante',
  projectName: 'Proyecto',
  status: 'IN_PROGRESS',
  priority: 'HIGH',
  estimatedHours: 8,
  actualHours: 10,
  deviationHours: 2,
}];

describe('ScatterChart v2', () => {
  it('renders effort data returned by the time endpoint', () => {
    render(<ScatterChart data={data} />);
    expect(screen.getByText('Relación de esfuerzo')).toBeInTheDocument();
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('returns the selected v2 task', () => {
    const onTaskClick = jest.fn();
    render(<ScatterChart data={data} onTaskClick={onTaskClick} />);
    fireEvent.click(screen.getByTestId('scatter-plot'));
    expect(onTaskClick).toHaveBeenCalledWith(data[0]);
  });

  it('handles empty effort arrays', () => {
    render(<ScatterChart data={[]} />);
    expect(screen.getByText(/no hay datos de estimación o tiempo/i)).toBeInTheDocument();
  });
});
