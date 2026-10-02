import { render, screen } from '@testing-library/react';
import PriorityDistributionChart from './PriorityDistributionChart';
import { DashboardPriority } from '@/types/analytics';

const mockPriorityDistribution = [
  { priority: 'CRITICAL' as DashboardPriority, count: 2 },
  { priority: 'HIGH' as DashboardPriority, count: 4 },
  { priority: 'MEDIUM' as DashboardPriority, count: 0 },
  { priority: 'LOW' as DashboardPriority, count: 1 },
];

describe('PriorityDistributionChart Component', () => {
  it('renders empty state when there are no priority tasks', () => {
    render(<PriorityDistributionChart data={[]} />);
    expect(screen.getByText('No hay tareas con prioridad definida.')).toBeInTheDocument();
  });

  it('renders all priorities and counts with percentages', () => {
    render(<PriorityDistributionChart data={mockPriorityDistribution} />);
    
    // Total de tareas = 2 + 4 + 0 + 1 = 7
    // Porcentaje de Crítica = 2 / 7 = 29%
    // Porcentaje de Alta = 4 / 7 = 57%
    // Porcentaje de Baja = 1 / 7 = 14%
    expect(screen.getByText('Crítica')).toBeInTheDocument();
    expect(screen.getByText('2 tareas')).toBeInTheDocument();
    expect(screen.getByText('29%')).toBeInTheDocument();

    expect(screen.getByText('Alta')).toBeInTheDocument();
    expect(screen.getByText('4 tareas')).toBeInTheDocument();
    expect(screen.getByText('57%')).toBeInTheDocument();

    expect(screen.getByText('Baja')).toBeInTheDocument();
    expect(screen.getByText('1 tarea')).toBeInTheDocument();
    expect(screen.getByText('14%')).toBeInTheDocument();
  });
});
