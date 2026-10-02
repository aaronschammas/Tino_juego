/**
 * ProjectCard.tsx - Project Card Component Tests
 * AAA Pattern: Arrange, Act, Assert
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProjectCard from './ProjectCard';
import { Project } from '@/types/project';
import { Priority } from '@/types/project';

jest.mock('next/link', () => {
  return ({ children, href }: any) => <a href={href}>{children}</a>;
});

describe('ProjectCard Component', () => {
  const mockProject: Project = {
    id: 'proj-1',
    name: 'Website Redesign',
    description: 'Comprehensive website redesign project',
    dueDate: '2025-12-31',
    priority: Priority.HIGH,
    ownerId: 'user-1',
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-15T00:00:00Z',
  };

  const mockOnEdit = jest.fn();
  const mockOnDelete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render project name', () => {
      // Arrange & Act
      render(
        <ProjectCard
          project={mockProject}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Assert
      expect(screen.getByText('Website Redesign')).toBeInTheDocument();
    });

    it('should render project description', () => {
      // Arrange & Act
      render(
        <ProjectCard
          project={mockProject}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Assert
      expect(screen.getByText('Comprehensive website redesign project')).toBeInTheDocument();
    });

    it('should render project as a link', () => {
      // Arrange & Act
      render(
        <ProjectCard
          project={mockProject}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Assert
      const link = screen.getByRole('link', { name: /Website Redesign/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href');
    });

    it('should display priority badge', () => {
      // Arrange & Act
      render(
        <ProjectCard
          project={mockProject}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Assert
      expect(screen.getByText('Alta')).toBeInTheDocument();
    });

    it('should display due date', () => {
      // Arrange & Act
      render(
        <ProjectCard
          project={mockProject}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Assert
      expect(screen.getByText(/31|dic|december/i)).toBeInTheDocument();
    });
  });

  describe('Priority Levels', () => {
    it('should display LOW priority', () => {
      // Arrange
      const lowPriorityProject = { ...mockProject, priority: Priority.LOW };

      // Act
      render(
        <ProjectCard
          project={lowPriorityProject}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Assert
      expect(screen.getByText('Baja')).toBeInTheDocument();
    });

    it('should display MEDIUM priority', () => {
      // Arrange
      const mediumPriorityProject = { ...mockProject, priority: Priority.MEDIUM };

      // Act
      render(
        <ProjectCard
          project={mediumPriorityProject}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Assert
      expect(screen.getByText('Media')).toBeInTheDocument();
    });

    it('should display CRITICAL priority', () => {
      // Arrange
      const criticalProject = { ...mockProject, priority: Priority.CRITICAL };

      // Act
      render(
        <ProjectCard
          project={criticalProject}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Assert
      expect(screen.getByText('Critica')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onEdit when edit button is clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      render(
        <ProjectCard
          project={mockProject}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Act
      const editButton = screen.getByRole('button', { name: /editar/i });
      await user.click(editButton);

      // Assert
      expect(mockOnEdit).toHaveBeenCalledWith(mockProject);
    });

    it('should call onDelete when delete button is clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      render(
        <ProjectCard
          project={mockProject}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Act
      const deleteButton = screen.getByRole('button', { name: /eliminar/i });
      await user.click(deleteButton);

      // Assert
      expect(mockOnDelete).toHaveBeenCalledWith('proj-1');
    });
  });

  describe('Project Status', () => {
    it('should display active status', () => {
      // Arrange & Act
      render(
        <ProjectCard
          project={mockProject}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Assert
      const activeIndicator = screen.getByText(/activo|active/i);
      expect(activeIndicator).toBeInTheDocument();
    });

    it('should display inactive status', () => {
      // Arrange
      const inactiveProject = { ...mockProject, isActive: false };

      // Act
      render(
        <ProjectCard
          project={inactiveProject}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Assert
      const inactiveIndicator = screen.queryByText(/inactivo|inactive/i);
      expect(inactiveIndicator).toBeDefined();
    });
  });

  describe('Optional Props', () => {
    it('should render without onEdit callback', () => {
      // Arrange & Act
      render(
        <ProjectCard
          project={mockProject}
          onDelete={mockOnDelete}
        />
      );

      // Assert
      expect(screen.getByText('Website Redesign')).toBeInTheDocument();
    });

    it('should render without onDelete callback', () => {
      // Arrange & Act
      render(
        <ProjectCard
          project={mockProject}
          onEdit={mockOnEdit}
        />
      );

      // Assert
      expect(screen.getByText('Website Redesign')).toBeInTheDocument();
    });

    it('should render without both callbacks', () => {
      // Arrange & Act
      render(
        <ProjectCard
          project={mockProject}
        />
      );

      // Assert
      expect(screen.getByText('Website Redesign')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle project without description', () => {
      // Arrange
      const projectNoDesc = { ...mockProject, description: undefined };

      // Act
      render(
        <ProjectCard
          project={projectNoDesc}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Assert
      expect(screen.getByText('Website Redesign')).toBeInTheDocument();
    });

    it('should handle project without due date', () => {
      // Arrange
      const projectNoDueDate = { ...mockProject, dueDate: undefined };

      // Act
      render(
        <ProjectCard
          project={projectNoDueDate}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Assert
      expect(screen.getByText('Website Redesign')).toBeInTheDocument();
    });

    it('should handle long project name', () => {
      // Arrange
      const longNameProject = {
        ...mockProject,
        name: 'This is a very long project name that might need to be truncated or wrapped',
      };

      // Act
      render(
        <ProjectCard
          project={longNameProject}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Assert
      expect(screen.getByText(/This is a very long project name/)).toBeInTheDocument();
    });
  });
});
