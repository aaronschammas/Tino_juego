/**
 * UserCard.tsx - User Card Component Tests
 * AAA Pattern: Arrange, Act, Assert
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserCard from './UserCard';
import { User } from '@/types/user';

jest.mock('@/lib/user-display', () => ({
  formatUserDisplayName: jest.fn((name, lastname) => `${name} ${lastname}`),
  getUserInitials: jest.fn((name, lastname) => name?.[0]?.toUpperCase() + lastname?.[0]?.toUpperCase()),
}));

describe('UserCard Component', () => {
  const mockUser: User = {
    id: 'user-1',
    email: 'john@example.com',
    name: 'John',
    lastname: 'Doe',
    role: 'USER',
    isActive: true,
    projectMembers: [
      {
        id: 'pm1',
        userId: 'user-1',
        projectId: 'proj-1',
        role: 'OWNER',
        project: { id: 'proj-1', name: 'Project 1', isActive: true },
      },
      {
        id: 'pm2',
        userId: 'user-1',
        projectId: 'proj-2',
        role: 'MEMBER',
        project: { id: 'proj-2', name: 'Project 2', isActive: true },
      },
    ],
    assignedTasks: [
      { id: 'task-1', status: 'DONE' },
      { id: 'task-2', status: 'IN_PROGRESS' },
      { id: 'task-3', status: 'TODO' },
    ],
  };

  const mockOnEdit = jest.fn();
  const mockOnDeactivate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    window.confirm = jest.fn(() => true);
  });

  describe('Rendering', () => {
    it('should render user name and email', () => {
      // Arrange & Act
      render(
        <UserCard
          user={mockUser}
          onEdit={mockOnEdit}
          onDeactivate={mockOnDeactivate}
        />
      );

      // Assert
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
    });

    it('should display user role', () => {
      // Arrange & Act
      render(
        <UserCard
          user={mockUser}
          onEdit={mockOnEdit}
          onDeactivate={mockOnDeactivate}
        />
      );

      // Assert
      const miembroElements = screen.queryAllByText('Miembro');
      expect(miembroElements.length).toBeGreaterThan(0);
    });

    it('should display project count', () => {
      // Arrange & Act
      render(
        <UserCard
          user={mockUser}
          onEdit={mockOnEdit}
          onDeactivate={mockOnDeactivate}
        />
      );

      // Assert
      expect(screen.getAllByText('2').length).toBeGreaterThan(0);
      expect(screen.getByText('Proyectos')).toBeInTheDocument();
    });

    it('should display task statistics', () => {
      // Arrange & Act
      render(
        <UserCard
          user={mockUser}
          onEdit={mockOnEdit}
          onDeactivate={mockOnDeactivate}
        />
      );

      // Assert
      // Should show tasks completed: 1, total: 3
      expect(screen.getAllByText('1').length).toBeGreaterThan(0);
      expect(screen.getByText('Completadas')).toBeInTheDocument();
      expect(screen.getAllByText('3').length).toBeGreaterThan(0);
      expect(screen.getByText('Tareas')).toBeInTheDocument();
    });
  });

  describe('User Roles', () => {
    it('should display ADMIN role correctly', () => {
      // Arrange
      const adminUser: User = { ...mockUser, role: 'ADMIN' };

      // Act
      render(
        <UserCard
          user={adminUser}
          onEdit={mockOnEdit}
          onDeactivate={mockOnDeactivate}
        />
      );

      // Assert
      expect(screen.getByText('Administrador')).toBeInTheDocument();
    });

    it('should display USER role correctly', () => {
      // Arrange & Act
      render(
        <UserCard
          user={mockUser}
          onEdit={mockOnEdit}
          onDeactivate={mockOnDeactivate}
        />
      );

      // Assert
      const miembroElements = screen.queryAllByText('Miembro');
      expect(miembroElements.length).toBeGreaterThan(0);
    });
  });

  describe('User Activity', () => {
    it('should show active status', () => {
      // Arrange & Act
      render(
        <UserCard
          user={mockUser}
          onEdit={mockOnEdit}
          onDeactivate={mockOnDeactivate}
        />
      );

      // Assert
      const activeIndicator = screen.getByText(/activo/i);
      expect(activeIndicator).toBeInTheDocument();
    });

    it('should show inactive status', () => {
      // Arrange
      const inactiveUser = { ...mockUser, isActive: false };

      // Act
      render(
        <UserCard
          user={inactiveUser}
          onEdit={mockOnEdit}
          onDeactivate={mockOnDeactivate}
        />
      );

      // Assert
      const inactiveIndicator = screen.getByText(/inactivo/i);
      expect(inactiveIndicator).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onEdit when edit button is clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      render(
        <UserCard
          user={mockUser}
          onEdit={mockOnEdit}
          onDeactivate={mockOnDeactivate}
        />
      );

      // Act
      const editButton = screen.getByRole('button', { name: /editar/i });
      await user.click(editButton);

      // Assert
      expect(mockOnEdit).toHaveBeenCalledWith(mockUser);
    });

    it('should not show deactivate button if not rendered', () => {
      render(
        <UserCard
          user={mockUser}
          onDeactivate={mockOnDeactivate}
        />
      );

      expect(screen.queryByRole('button', { name: /desactivar|deactivate/i })).not.toBeInTheDocument();
    });
  });

  describe('Task Counts', () => {
    it('should display correct completion rate', () => {
      // Arrange & Act
      render(
        <UserCard
          user={mockUser}
          onEdit={mockOnEdit}
          onDeactivate={mockOnDeactivate}
        />
      );

      // Assert
      // 1 task done out of 3
      expect(screen.getAllByText('3').length).toBeGreaterThan(0);
      expect(screen.getAllByText('1').length).toBeGreaterThan(0);
    });

    it('should handle zero tasks', () => {
      // Arrange
      const userNoTasks = { ...mockUser, assignedTasks: [] };

      // Act
      render(
        <UserCard
          user={userNoTasks}
          onEdit={mockOnEdit}
          onDeactivate={mockOnDeactivate}
        />
      );

      // Assert
      expect(screen.getAllByText('0').length).toBeGreaterThan(0);
      expect(screen.getByText('Tareas')).toBeInTheDocument();
    });

    it('should handle all tasks completed', () => {
      // Arrange
      const userCompletedAll: User = {
        ...mockUser,
        assignedTasks: [
          { id: 'task-1', status: 'DONE' },
          { id: 'task-2', status: 'DONE' },
        ],
      };

      // Act
      render(
        <UserCard
          user={userCompletedAll}
          onEdit={mockOnEdit}
          onDeactivate={mockOnDeactivate}
        />
      );

      // Assert
      expect(screen.getAllByText('2').length).toBeGreaterThan(0);
    });
  });

  describe('Project Counts', () => {
    it('should display zero projects', () => {
      // Arrange
      const userNoProjects = { ...mockUser, projectMembers: [] };

      // Act
      render(
        <UserCard
          user={userNoProjects}
          onEdit={mockOnEdit}
          onDeactivate={mockOnDeactivate}
        />
      );

      // Assert
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should display multiple projects', () => {
      // Arrange & Act
      render(
        <UserCard
          user={mockUser}
          onEdit={mockOnEdit}
          onDeactivate={mockOnDeactivate}
        />
      );

      // Assert
      expect(screen.getAllByText('2').length).toBeGreaterThan(0);
    });
  });

  describe('Optional Props', () => {
    it('should render without onEdit callback', () => {
      // Arrange & Act
      render(
        <UserCard
          user={mockUser}
          onDeactivate={mockOnDeactivate}
        />
      );

      // Assert
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should render without onDeactivate callback', () => {
      // Arrange & Act
      render(
        <UserCard
          user={mockUser}
          onEdit={mockOnEdit}
        />
      );

      // Assert
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should render without any callbacks', () => {
      // Arrange & Act
      render(
        <UserCard user={mockUser} />
      );

      // Assert
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle user with only name', () => {
      // Arrange
      const minimalUser = { ...mockUser, lastname: '' };

      // Act
      render(
        <UserCard
          user={minimalUser}
          onEdit={mockOnEdit}
          onDeactivate={mockOnDeactivate}
        />
      );

      // Assert
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
    });

    it('should handle user without projects or tasks', () => {
      // Arrange
      const emptyUser = {
        ...mockUser,
        projectMembers: undefined,
        assignedTasks: undefined,
      };

      // Act
      render(
        <UserCard
          user={emptyUser}
          onEdit={mockOnEdit}
          onDeactivate={mockOnDeactivate}
        />
      );

      // Assert
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });
});
