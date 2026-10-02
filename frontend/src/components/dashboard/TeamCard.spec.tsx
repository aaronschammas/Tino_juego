/**
 * TeamCard.tsx - Team Card Component Tests
 * AAA Pattern: Arrange, Act, Assert
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import TeamCard from './TeamCard';

describe('TeamCard Component', () => {
  const mockListMembers = [
    { id: 'user-1', name: 'John Doe', email: 'john@example.com', statusLabel: 'Activo', initials: 'JD' },
    { id: 'user-2', name: 'Jane Smith', email: 'jane@example.com', statusLabel: 'Activo', initials: 'JS' },
  ];

  const mockTableMembers = [
    { userId: 'user-1', name: 'John Doe', email: 'john@example.com', totalHours: 40, tasksCompleted: 15 },
    { userId: 'user-2', name: 'Jane Smith', email: 'jane@example.com', totalHours: 35, tasksCompleted: 12 },
  ];

  const mockAvatarPalette = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];

  describe('Rendering with List Members', () => {
    it('should render title and description', () => {
      // Arrange & Act
      render(
        <TeamCard
          title="Equipo Activo"
          description="Miembros que trabajan actualmente"
          listMembers={mockListMembers}
          emptyLabel="Sin miembros"
          avatarPalette={mockAvatarPalette}
        />
      );

      // Assert
      expect(screen.getByText('Equipo Activo')).toBeInTheDocument();
      expect(screen.getByText('Miembros que trabajan actualmente')).toBeInTheDocument();
    });

    it('should render all team members', () => {
      // Arrange & Act
      render(
        <TeamCard
          title="Equipo"
          description="Miembros del equipo"
          listMembers={mockListMembers}
          emptyLabel="Sin miembros"
          avatarPalette={mockAvatarPalette}
        />
      );

      // Assert
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    it('should display member emails', () => {
      // Arrange & Act
      render(
        <TeamCard
          title="Equipo"
          description="Miembros del equipo"
          listMembers={mockListMembers}
          emptyLabel="Sin miembros"
          avatarPalette={mockAvatarPalette}
        />
      );

      // Assert
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
      expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    });

    it('should display member status', () => {
      // Arrange & Act
      render(
        <TeamCard
          title="Equipo"
          description="Miembros del equipo"
          listMembers={mockListMembers}
          emptyLabel="Sin miembros"
          avatarPalette={mockAvatarPalette}
        />
      );

      // Assert
      expect(screen.getAllByText('Activo')).toHaveLength(2);
    });
  });

  describe('Rendering with Table Members', () => {
    it('should render table with member stats', () => {
      // Arrange & Act
      render(
        <TeamCard
          title="Estadísticas"
          description="Productividad del equipo"
          tableMembers={mockTableMembers}
          emptyLabel="Sin datos"
          avatarPalette={mockAvatarPalette}
        />
      );

      // Assert
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    it('should display total hours worked', () => {
      // Arrange & Act
      render(
        <TeamCard
          title="Estadísticas"
          description="Productividad del equipo"
          tableMembers={mockTableMembers}
          emptyLabel="Sin datos"
          avatarPalette={mockAvatarPalette}
        />
      );

      // Assert
      expect(screen.getByText('15 tareas | 40h')).toBeInTheDocument();
      expect(screen.getByText('12 tareas | 35h')).toBeInTheDocument();
    });

    it('should display tasks completed', () => {
      // (Testing both hours and tasks above, so we can just verify the regex or exact text here)
      // Arrange & Act
      render(
        <TeamCard
          title="Estadísticas"
          description="Productividad del equipo"
          tableMembers={mockTableMembers}
          emptyLabel="Sin datos"
          avatarPalette={mockAvatarPalette}
        />
      );

      // Assert
      expect(screen.getByText(/15 tareas/)).toBeInTheDocument();
      expect(screen.getByText(/12 tareas/)).toBeInTheDocument();
    });
  });

  describe('Empty States', () => {
    it('should display empty label when no list members', () => {
      // Arrange & Act
      render(
        <TeamCard
          title="Equipo"
          description="Miembros del equipo"
          listMembers={[]}
          emptyLabel="Sin miembros disponibles"
          avatarPalette={mockAvatarPalette}
        />
      );

      // Assert
      expect(screen.getByText('Sin miembros disponibles')).toBeInTheDocument();
    });

    it('should display empty label when no table members', () => {
      // Arrange & Act
      render(
        <TeamCard
          title="Estadísticas"
          description="Productividad"
          tableMembers={[]}
          emptyLabel="Sin datos disponibles"
          avatarPalette={mockAvatarPalette}
        />
      );

      // Assert
      expect(screen.getByText('Sin datos disponibles')).toBeInTheDocument();
    });

    it('should handle undefined members', () => {
      // Arrange & Act
      render(
        <TeamCard
          title="Equipo"
          description="Miembros del equipo"
          emptyLabel="Sin miembros"
          avatarPalette={mockAvatarPalette}
        />
      );

      // Assert
      expect(screen.getByText('Sin miembros')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle single member', () => {
      // Arrange & Act
      render(
        <TeamCard
          title="Equipo"
          description="Un miembro"
          listMembers={[mockListMembers[0]]}
          emptyLabel="Sin miembros"
          avatarPalette={mockAvatarPalette}
        />
      );

      // Assert
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should handle long member names', () => {
      // Arrange
      const longNameMembers = [{
        id: 'user-1',
        name: 'This is a very long member name that might wrap',
        email: 'long@example.com',
        statusLabel: 'Activo',
        initials: 'TWA',
      }];

      // Act
      render(
        <TeamCard
          title="Equipo"
          description="Miembros"
          listMembers={longNameMembers}
          emptyLabel="Sin miembros"
          avatarPalette={mockAvatarPalette}
        />
      );

      // Assert
      expect(screen.getByText('This is a very long member name that might wrap')).toBeInTheDocument();
    });

    it('should handle zero hours and tasks', () => {
      // Arrange
      const inactiveMembers = [{
        userId: 'user-1',
        name: 'Inactive User',
        email: 'inactive@example.com',
        totalHours: 0,
        tasksCompleted: 0,
      }];

      // Act
      render(
        <TeamCard
          title="Estadísticas"
          description="Productividad"
          tableMembers={inactiveMembers}
          emptyLabel="Sin datos"
          avatarPalette={mockAvatarPalette}
        />
      );

      // Assert
      expect(screen.getByText('Inactive User')).toBeInTheDocument();
    });
  });
});

