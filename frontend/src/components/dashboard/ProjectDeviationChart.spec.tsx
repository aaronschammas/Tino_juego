import { render, screen } from '@testing-library/react';
import ProjectDeviationChart from './ProjectDeviationChart';
import { DashboardProjectsResponse } from '@/types/analytics';

const mockProjectsResponse: DashboardProjectsResponse = {
  range: { from: '2026-06-01T00:00:00.000Z', to: '2026-06-30T00:00:00.000Z' },
  timezone: 'UTC',
  scope: { organizationId: 'org-1', projectIds: ['p-1'], userIds: [] },
  projects: [
    {
      projectId: 'p-1',
      projectName: 'Proyecto A',
      totalTasks: 5,
      openTasks: 2,
      completedTasks: 3,
      overdueTasks: 0,
      blockedTasks: 0,
      estimatedHours: 10,
      actualHours: 15,
      deviationHours: 5,
      deviationPercent: 50,
      activeUsers: 2,
    },
    {
      projectId: 'p-2',
      projectName: 'Proyecto B',
      totalTasks: 3,
      openTasks: 1,
      completedTasks: 2,
      overdueTasks: 0,
      blockedTasks: 0,
      estimatedHours: 12,
      actualHours: 8,
      deviationHours: -4,
      deviationPercent: -33.3,
      activeUsers: 1,
    },
  ],
};

describe('ProjectDeviationChart Component', () => {
  it('renders empty state when no projects exist', () => {
    render(<ProjectDeviationChart data={null} />);
    expect(screen.getByText('No hay datos de proyectos para este rango.')).toBeInTheDocument();
  });

  it('renders projects details and deviation hours', () => {
    render(<ProjectDeviationChart data={mockProjectsResponse} />);
    
    expect(screen.getByText('Proyecto A')).toBeInTheDocument();
    
    // Debería renderizar "+5.0h (+50%)" para Proyecto A
    expect(screen.getByText('+5.0h (+50%)')).toBeInTheDocument();
    
    expect(screen.getByText('Proyecto B')).toBeInTheDocument();
    // Debería renderizar "-4.0h (-33%)" o similar para Proyecto B
    expect(screen.getByText('-4.0h (-33%)')).toBeInTheDocument();
  });
});
