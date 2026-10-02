import React from 'react';
import { render, screen } from '@testing-library/react';
import Breadcrumb from './Breadcrumb';
import { usePathname } from 'next/navigation';
import { useProjects } from '@/hooks/useProjects';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}));

// Mock hooks
jest.mock('@/hooks/useProjects', () => ({
  useProjects: jest.fn(),
}));

describe('Breadcrumb Component', () => {
  const mockProjects = [
    { id: 'proj-123', name: 'Proyecto Increíble' },
    { id: 'proj-456', name: 'Otro Proyecto' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (useProjects as jest.Mock).mockReturnValue({ projects: mockProjects });
  });

  it('renders nothing when on root path', () => {
    // Arrange
    (usePathname as jest.Mock).mockReturnValue('/');

    // Act
    const { container } = render(<Breadcrumb />);

    // Assert
    expect(container.firstChild).toBeNull();
  });

  it('renders standard route labels', () => {
    // Arrange
    (usePathname as jest.Mock).mockReturnValue('/dashboard');

    // Act
    render(<Breadcrumb />);

    // Assert
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders nested standard route labels', () => {
    // Arrange
    (usePathname as jest.Mock).mockReturnValue('/projects/analytics');

    // Act
    render(<Breadcrumb />);

    // Assert
    expect(screen.getByText('Proyectos')).toBeInTheDocument();
    expect(screen.getByText('Analitica')).toBeInTheDocument();
  });

  it('resolves project name from ID in URL', () => {
    // Arrange
    (usePathname as jest.Mock).mockReturnValue('/projects/proj-123');

    // Act
    render(<Breadcrumb />);

    // Assert
    expect(screen.getByText('Proyectos')).toBeInTheDocument();
    expect(screen.getByText('Proyecto Increíble')).toBeInTheDocument();
  });

  it('uses raw path segment if no label is found', () => {
    // Arrange
    (usePathname as jest.Mock).mockReturnValue('/unknown-path');

    // Act
    render(<Breadcrumb />);

    // Assert
    expect(screen.getByText('unknown-path')).toBeInTheDocument();
  });

  it('links to parent segments', () => {
    // Arrange
    (usePathname as jest.Mock).mockReturnValue('/projects/proj-123');

    // Act
    render(<Breadcrumb />);

    // Assert
    const projectsLink = screen.getByRole('link', { name: 'Proyectos' });
    expect(projectsLink).toHaveAttribute('href', '/projects');
  });

  it('does not link the current (last) segment', () => {
    // Arrange
    (usePathname as jest.Mock).mockReturnValue('/dashboard');

    // Act
    render(<Breadcrumb />);

    // Assert
    const dashboardSegment = screen.getByText('Dashboard');
    expect(dashboardSegment.tagName).toBe('SPAN');
    expect(dashboardSegment.closest('a')).toBeNull();
  });
});
