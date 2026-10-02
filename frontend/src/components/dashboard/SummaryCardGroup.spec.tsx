/**
 * SummaryCardGroup.tsx - Summary Card Group Component Tests
 * AAA Pattern: Arrange, Act, Assert
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import SummaryCardGroup from './SummaryCardGroup';

describe('SummaryCardGroup Component', () => {
  describe('Rendering', () => {
    it('should render section title and description', () => {
      // Arrange & Act
      render(
        <SummaryCardGroup
          completedTasks={10}
          inProgressTasks={5}
          remainingTasks={15}
          blockedTasks={2}
        />
      );

      // Assert
      expect(screen.getByText('Vista sintetica del dia')).toBeInTheDocument();
      expect(screen.getByText('Resumen operativo')).toBeInTheDocument();
    });

    it('should display all stat boxes', () => {
      // Arrange & Act
      render(
        <SummaryCardGroup
          completedTasks={10}
          inProgressTasks={5}
          remainingTasks={15}
          blockedTasks={2}
        />
      );

      // Assert
      expect(screen.getByText('Completadas')).toBeInTheDocument();
      expect(screen.getByText('En progreso')).toBeInTheDocument();
      expect(screen.getByText('Por hacer')).toBeInTheDocument();
      expect(screen.getByText('Bloqueadas')).toBeInTheDocument();
    });

    it('should display correct values for each stat box', () => {
      // Arrange & Act
      render(
        <SummaryCardGroup
          completedTasks={10}
          inProgressTasks={5}
          remainingTasks={15}
          blockedTasks={2}
        />
      );

      // Assert
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('should display meta descriptions for each stat', () => {
      // Arrange & Act
      render(
        <SummaryCardGroup
          completedTasks={10}
          inProgressTasks={5}
          remainingTasks={15}
          blockedTasks={2}
        />
      );

      // Assert
      expect(screen.getByText('Tareas cerradas')).toBeInTheDocument();
      expect(screen.getByText('Trabajo en ejecucion')).toBeInTheDocument();
      expect(screen.getByText('Pendientes por iniciar')).toBeInTheDocument();
      expect(screen.getByText('Con impedimentos activos')).toBeInTheDocument();
    });
  });

  describe('Different Values', () => {
    it('should handle zero values', () => {
      // Arrange & Act
      render(
        <SummaryCardGroup
          completedTasks={0}
          inProgressTasks={0}
          remainingTasks={0}
          blockedTasks={0}
        />
      );

      // Assert
      const zeros = screen.getAllByText('0');
      expect(zeros.length).toBeGreaterThanOrEqual(4);
    });

    it('should handle large values', () => {
      // Arrange & Act
      render(
        <SummaryCardGroup
          completedTasks={1000}
          inProgressTasks={500}
          remainingTasks={750}
          blockedTasks={250}
        />
      );

      // Assert
      expect(screen.getByText('1000')).toBeInTheDocument();
      expect(screen.getByText('500')).toBeInTheDocument();
      expect(screen.getByText('750')).toBeInTheDocument();
      expect(screen.getByText('250')).toBeInTheDocument();
    });

    it('should handle high completed tasks ratio', () => {
      // Arrange & Act
      render(
        <SummaryCardGroup
          completedTasks={80}
          inProgressTasks={10}
          remainingTasks={5}
          blockedTasks={1}
        />
      );

      // Assert
      expect(screen.getByText('80')).toBeInTheDocument();
    });

    it('should handle all tasks blocked', () => {
      // Arrange & Act
      render(
        <SummaryCardGroup
          completedTasks={0}
          inProgressTasks={0}
          remainingTasks={0}
          blockedTasks={25}
        />
      );

      // Assert
      expect(screen.getByText('25')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle negative values gracefully', () => {
      // Arrange & Act
      render(
        <SummaryCardGroup
          completedTasks={-1}
          inProgressTasks={0}
          remainingTasks={0}
          blockedTasks={0}
        />
      );

      // Assert - should still render
      expect(screen.getByText('Vista sintetica del dia')).toBeInTheDocument();
    });

    it('should maintain grid layout with varying values', () => {
      // Arrange & Act
      const { container } = render(
        <SummaryCardGroup
          completedTasks={10}
          inProgressTasks={5}
          remainingTasks={15}
          blockedTasks={2}
        />
      );

      // Assert - check grid exists
      const grid = container.querySelector('.grid');
      expect(grid).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should render semantic structure', () => {
      // Arrange & Act
      render(
        <SummaryCardGroup
          completedTasks={10}
          inProgressTasks={5}
          remainingTasks={15}
          blockedTasks={2}
        />
      );

      // Assert
      const headings = screen.getByRole('heading', { level: 2 });
      expect(headings).toBeInTheDocument();
    });

    it('should have proper text hierarchy', () => {
      // Arrange & Act
      render(
        <SummaryCardGroup
          completedTasks={10}
          inProgressTasks={5}
          remainingTasks={15}
          blockedTasks={2}
        />
      );

      // Assert
      expect(screen.getByText('Vista sintetica del dia')).toHaveClass('app-section-title');
    });
  });
});
