import { render, screen } from '@testing-library/react';
import BurndownChart from './BurndownChart';

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

const data = [
  { status: 'DONE' as const, count: 4 },
  { status: 'IN_PROGRESS' as const, count: 2 },
];

describe('BurndownChart v2', () => {
  it('renders the backend status distribution', () => {
    render(<BurndownChart data={data} />);
    expect(screen.getByText('Distribución de tareas')).toBeInTheDocument();
    expect(screen.getByText(/estado actual/i)).toBeInTheDocument();
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('renders an empty state for an empty distribution', () => {
    render(<BurndownChart data={[]} />);
    expect(screen.getByText('Aún no hay tareas para mostrar')).toBeInTheDocument();
    expect(screen.queryByTestId('responsive-container')).not.toBeInTheDocument();
  });
});
