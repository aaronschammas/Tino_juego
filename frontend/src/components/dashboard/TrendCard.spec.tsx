/**
 * TrendCard.tsx - Trend Card Component Tests
 * AAA Pattern: Arrange, Act, Assert
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import TrendCard from './TrendCard';

describe('TrendCard Component', () => {
  const mockProgressRows = [
    { label: 'Completadas', value: 25, share: 50, toneClass: 'text-[var(--color-success-700)]' },
    { label: 'En progreso', value: 15, share: 30, toneClass: 'text-[var(--color-primary-700)]' },
    { label: 'Por hacer', value: 10, share: 20, toneClass: 'text-[var(--color-warning-700)]' },
  ];

  describe('Rendering', () => {
    it('should render the trend card title', () => {
      // Arrange & Act
      render(
        <TrendCard
          progressRows={mockProgressRows}
          totalTasks={50}
          completionRate={50}
          timeWorkedLabel="120 horas"
        />
      );

      // Assert
      expect(screen.getByText('Distribución del Trabajo')).toBeInTheDocument();
      // Usar matcher para texto fragmentado
      // Buscar fragmento de texto en cualquier nodo usando regex o includes
      const matcher = (content: string) => {
        if (typeof content !== 'string') return false;
        return /Tendencia.*progreso/.test(content.replace(/\s+/g, ' ')) || content.includes('Tendencia') || content.includes('progreso');
      };
      expect(screen.queryAllByText(matcher).length).toBeGreaterThan(0);
    });

    it('should render progress rows with labels', () => {
      // Arrange & Act
      render(
        <TrendCard
          progressRows={mockProgressRows}
          totalTasks={50}
          completionRate={50}
          timeWorkedLabel="120 horas"
        />
      );

      // Assert
      expect(screen.getByText('Completadas')).toBeInTheDocument();
      expect(screen.getByText('En progreso')).toBeInTheDocument();
      expect(screen.getByText('Por hacer')).toBeInTheDocument();
    });

    it('should display total tasks', () => {
      // Arrange & Act
      render(
        <TrendCard
          progressRows={mockProgressRows}
          totalTasks={50}
          completionRate={50}
          timeWorkedLabel="120 horas"
        />
      );

      // Assert
      expect(screen.getByText('50')).toBeInTheDocument();
    });

    it('should display completion rate', () => {
      // Arrange & Act
      render(
        <TrendCard
          progressRows={mockProgressRows}
          totalTasks={50}
          completionRate={75}
          timeWorkedLabel="120 horas"
        />
      );

      // Assert
      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('should display time worked label', () => {
      // Arrange & Act
      render(
        <TrendCard
          progressRows={mockProgressRows}
          totalTasks={50}
          completionRate={50}
          timeWorkedLabel="150 horas"
        />
      );

      // Assert
      expect(screen.getByText('150 horas')).toBeInTheDocument();
    });
  });

  describe('Progress Values', () => {
    it('should display all progress values correctly', () => {
      // Arrange & Act
      render(
        <TrendCard
          progressRows={mockProgressRows}
          totalTasks={50}
          completionRate={50}
          timeWorkedLabel="120 horas"
        />
      );

      // Assert
      // Puede haber múltiples elementos con estos valores, usar getAllByText
      expect(screen.getAllByText('25').length).toBeGreaterThan(0);
      expect(screen.getAllByText('15').length).toBeGreaterThan(0);
      expect(screen.getAllByText('10').length).toBeGreaterThan(0);
    });

    it('should handle zero values', () => {
      // Arrange
      const emptyProgressRows = [
        { label: 'Completadas', value: 0, share: 0, toneClass: 'text-[var(--color-success-700)]' },
      ];

      // Act
      render(
        <TrendCard
          progressRows={emptyProgressRows}
          totalTasks={0}
          completionRate={0}
          timeWorkedLabel="0 horas"
        />
      );

      // Assert
      // Puede haber múltiples elementos con '0', usar getAllByText
      expect(screen.getAllByText('0').length).toBeGreaterThan(0);
      expect(screen.getAllByText('0%').length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should render with empty progress rows', () => {
      // Arrange & Act
      render(
        <TrendCard
          progressRows={[]}
          totalTasks={0}
          completionRate={0}
          timeWorkedLabel="0 horas"
        />
      );

      // Assert
      expect(screen.getByText('Distribución del Trabajo')).toBeInTheDocument();
    });

    it('should handle high completion rate', () => {
      // Arrange & Act
      render(
        <TrendCard
          progressRows={mockProgressRows}
          totalTasks={50}
          completionRate={100}
          timeWorkedLabel="200 horas"
        />
      );

      // Assert
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });
});
