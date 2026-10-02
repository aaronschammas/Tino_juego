/**
 * OverviewCards.tsx - Overview Cards Component Tests
 * AAA Pattern: Arrange, Act, Assert
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import OverviewCards from './OverviewCards';
import { OverviewAnalytics } from '@/types/analytics';

jest.mock('./StatCard', () => {
  return function DummyStatCard({ title, value }: any) {
    return <div data-testid="stat-card">{title}: {value}</div>;
  };
});

describe('OverviewCards Component', () => {
  const mockData: OverviewAnalytics = {
    totalTasks: 50,
    completedTasks: 25,
    tasksInProgress: 15,
    blockedTasks: 3,
    overdueTasks: 2,
    completionRate: 50,
    totalSecondsWorked: 36000, // 10 hours in seconds
    totalHoursWorked: 10,
  };

  describe('Rendering', () => {
    it('should render all stat cards', () => {
      // Arrange & Act
      render(<OverviewCards data={mockData} />);

      // Assert
      const cards = screen.getAllByTestId('stat-card');
      expect(cards).toHaveLength(8);
    });

    it('should display total tasks', () => {
      // Arrange & Act
      render(<OverviewCards data={mockData} />);

      // Assert
      expect(screen.getByText('Total de tareas: 50')).toBeInTheDocument();
    });

    it('should display completed tasks', () => {
      // Arrange & Act
      render(<OverviewCards data={mockData} />);

      // Assert
      expect(screen.getByText('Tareas completadas: 25')).toBeInTheDocument();
    });

    it('should display tasks in progress', () => {
      // Arrange & Act
      render(<OverviewCards data={mockData} />);

      // Assert
      expect(screen.getByText('En progreso: 15')).toBeInTheDocument();
    });

    it('should display completion rate with percentage', () => {
      // Arrange & Act
      render(<OverviewCards data={mockData} />);

      // Assert
      expect(screen.getByText('Tasa de completado: 50%')).toBeInTheDocument();
    });

    it('should display blocked tasks', () => {
      // Arrange & Act
      render(<OverviewCards data={mockData} />);

      // Assert
      expect(screen.getByText('Tareas bloqueadas: 3')).toBeInTheDocument();
    });

    it('should display overdue tasks', () => {
      // Arrange & Act
      render(<OverviewCards data={mockData} />);

      // Assert
      expect(screen.getByText('Tareas vencidas: 2')).toBeInTheDocument();
    });

    it('should display hours worked with unit', () => {
      // Arrange & Act
      render(<OverviewCards data={mockData} />);

      // Assert
      expect(screen.getByText('Horas trabajadas: 10h')).toBeInTheDocument();
    });

    it('should display pending tasks (total - completed)', () => {
      // Arrange & Act
      render(<OverviewCards data={mockData} />);

      // Assert
      // 50 - 25 = 25
      expect(screen.getByText('Tareas pendientes: 25')).toBeInTheDocument();
    });
  });

  describe('Different Data Values', () => {
    it('should handle zero values', () => {
      // Arrange
      const zeroData: OverviewAnalytics = {
        totalTasks: 0,
        completedTasks: 0,
        tasksInProgress: 0,
        blockedTasks: 0,
        overdueTasks: 0,
        completionRate: 0,
        totalSecondsWorked: 0,
        totalHoursWorked: 0,
      };

      // Act
      render(<OverviewCards data={zeroData} />);

      // Assert
      expect(screen.getByText('Total de tareas: 0')).toBeInTheDocument();
      expect(screen.getByText('Tasa de completado: 0%')).toBeInTheDocument();
    });

    it('should handle all tasks completed', () => {
      // Arrange
      const completeData: OverviewAnalytics = {
        totalTasks: 50,
        completedTasks: 50,
        tasksInProgress: 0,
        blockedTasks: 0,
        overdueTasks: 0,
        completionRate: 100,
        totalSecondsWorked: 72000, // 20 hours
        totalHoursWorked: 20,
      };

      // Act
      render(<OverviewCards data={completeData} />);

      // Assert
      expect(screen.getByText('Tareas completadas: 50')).toBeInTheDocument();
      expect(screen.getByText('Tasa de completado: 100%')).toBeInTheDocument();
      expect(screen.getByText('Tareas pendientes: 0')).toBeInTheDocument();
    });

    it('should handle high hours worked', () => {
      // Arrange
      const highHoursData: OverviewAnalytics = {
        ...mockData,
        totalHoursWorked: 40,
      };

      // Act
      render(<OverviewCards data={highHoursData} />);

      // Assert
      expect(screen.getByText('Horas trabajadas: 40h')).toBeInTheDocument();
    });

    it('should handle decimal completion rate', () => {
      // Arrange
      const decimalData: OverviewAnalytics = {
        ...mockData,
        completionRate: 33.33,
      };

      // Act
      render(<OverviewCards data={decimalData} />);

      // Assert
      expect(screen.getByText('Tasa de completado: 33.33%')).toBeInTheDocument();
    });
  });

  describe('Grid Layout', () => {
    it('should render grid container', () => {
      // Arrange & Act
      const { container } = render(<OverviewCards data={mockData} />);

      // Assert
      const grid = container.querySelector('.grid');
      expect(grid).toBeInTheDocument();
      expect(grid).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-4');
    });

    it('should have proper gap between cards', () => {
      // Arrange & Act
      const { container } = render(<OverviewCards data={mockData} />);

      // Assert
      const grid = container.querySelector('.grid');
      expect(grid).toHaveClass('gap-6');
    });
  });

  describe('Edge Cases', () => {
    it('should handle large numbers', () => {
      // Arrange
      const largeData: OverviewAnalytics = {
        totalTasks: 10000,
        completedTasks: 9999,
        tasksInProgress: 1,
        blockedTasks: 0,
        overdueTasks: 0,
        completionRate: 99.99,
        totalSecondsWorked: 3600000,
        totalHoursWorked: 1000,
      };

      // Act
      render(<OverviewCards data={largeData} />);

      // Assert
      expect(screen.getByText('Total de tareas: 10000')).toBeInTheDocument();
      expect(screen.getByText('Horas trabajadas: 1000h')).toBeInTheDocument();
    });

    it('should handle when completed tasks exceed total (edge case)', () => {
      // Arrange
      const edgeData: OverviewAnalytics = {
        totalTasks: 25,
        completedTasks: 30, // More than total
        tasksInProgress: 0,
        blockedTasks: 0,
        overdueTasks: 0,
        completionRate: 120,
        totalSecondsWorked: 36000,
        totalHoursWorked: 10,
      };

      // Act
      render(<OverviewCards data={edgeData} />);

      // Assert
      // Pending should be 25 - 30 = -5
      expect(screen.getByText('Tareas pendientes: -5')).toBeInTheDocument();
    });

    it('should handle many blocked tasks', () => {
      // Arrange
      const blockedData: OverviewAnalytics = {
        ...mockData,
        blockedTasks: 20,
      };

      // Act
      render(<OverviewCards data={blockedData} />);

      // Assert
      expect(screen.getByText('Tareas bloqueadas: 20')).toBeInTheDocument();
    });
  });

  describe('Data Consistency', () => {
    it('should display consistent total and completed tasks', () => {
      // Arrange & Act
      render(<OverviewCards data={mockData} />);

      // Assert
      expect(screen.getByText('Total de tareas: 50')).toBeInTheDocument();
      expect(screen.getByText('Tareas completadas: 25')).toBeInTheDocument();
    });

    it('should calculate correct pending tasks', () => {
      // Arrange
      const testData: OverviewAnalytics = {
        totalTasks: 100,
        completedTasks: 60,
        tasksInProgress: 25,
        blockedTasks: 10,
        overdueTasks: 5,
        completionRate: 60,
        totalSecondsWorked: 180000,
        totalHoursWorked: 50,
      };

      // Act
      render(<OverviewCards data={testData} />);

      // Assert
      // 100 - 60 = 40
      expect(screen.getByText('Tareas pendientes: 40')).toBeInTheDocument();
    });
  });
});
