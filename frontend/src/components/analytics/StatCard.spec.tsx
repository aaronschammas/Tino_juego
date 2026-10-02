/**
 * StatCard.tsx - Stat Card Component Tests
 * AAA Pattern: Arrange, Act, Assert
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import StatCard from './StatCard';

describe('StatCard Component', () => {
  describe('Rendering', () => {
    it('should render title and value', () => {
      // Arrange & Act
      render(
        <StatCard
          title="Total Tasks"
          value={42}
        />
      );

      // Assert
      expect(screen.getByText('Total Tasks')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('should render with string value', () => {
      // Arrange & Act
      render(
        <StatCard
          title="Completion Rate"
          value="75%"
        />
      );

      // Assert
      expect(screen.getByText('Completion Rate')).toBeInTheDocument();
      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('should render with numeric value', () => {
      // Arrange & Act
      render(
        <StatCard
          title="Active Users"
          value={128}
        />
      );

      // Assert
      expect(screen.getByText('Active Users')).toBeInTheDocument();
      expect(screen.getByText('128')).toBeInTheDocument();
    });
  });

  describe('Color Styling', () => {
    it('should apply blue color by default', () => {
      // Arrange & Act
      const { container } = render(
        <StatCard
          title="Metric"
          value={10}
          icon="📊"
        />
      );

      // Assert
      const card = container.querySelector('.bg-blue-50');
      expect(card).toBeInTheDocument();
    });

    it('should apply green color', () => {
      // Arrange & Act
      const { container } = render(
        <StatCard
          title="Metric"
          value={10}
          color="green"
          icon="✓"
        />
      );

      // Assert
      const card = container.querySelector('.bg-green-50');
      expect(card).toBeInTheDocument();
    });

    it('should apply orange color', () => {
      // Arrange & Act
      const { container } = render(
        <StatCard
          title="Metric"
          value={10}
          color="orange"
          icon="⚠"
        />
      );

      // Assert
      const card = container.querySelector('.bg-orange-50');
      expect(card).toBeInTheDocument();
    });

    it('should apply red color', () => {
      // Arrange & Act
      const { container } = render(
        <StatCard
          title="Metric"
          value={10}
          color="red"
          icon="✕"
        />
      );

      // Assert
      const card = container.querySelector('.bg-red-50');
      expect(card).toBeInTheDocument();
    });

    it('should apply purple color', () => {
      // Arrange & Act
      const { container } = render(
        <StatCard
          title="Metric"
          value={10}
          color="purple"
          icon="★"
        />
      );

      // Assert
      const card = container.querySelector('.bg-purple-50');
      expect(card).toBeInTheDocument();
    });
  });

  describe('Icon Rendering', () => {
    it('should render without icon', () => {
      // Arrange & Act
      const { container } = render(
        <StatCard
          title="Metric"
          value={10}
        />
      );

      // Assert - card should still render
      expect(screen.getByText('Metric')).toBeInTheDocument();
    });

    it('should render with icon', () => {
      // Arrange & Act
      const { container } = render(
        <StatCard
          title="Metric"
          value={10}
          icon="✓"
        />
      );

      // Assert
      expect(screen.getByText('✓')).toBeInTheDocument();
    });

    it('should render emoji icon', () => {
      // Arrange & Act
      render(
        <StatCard
          title="Metric"
          value={10}
          icon="📊"
        />
      );

      // Assert
      expect(screen.getByText('📊')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero value', () => {
      // Arrange & Act
      render(
        <StatCard
          title="Metric"
          value={0}
        />
      );

      // Assert
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should handle large numbers', () => {
      // Arrange & Act
      render(
        <StatCard
          title="Metric"
          value={999999}
        />
      );

      // Assert
      expect(screen.getByText('999999')).toBeInTheDocument();
    });

    it('should handle long title', () => {
      // Arrange & Act
      render(
        <StatCard
          title="This is a very long title that might wrap to multiple lines"
          value={42}
        />
      );

      // Assert
      expect(screen.getByText('This is a very long title that might wrap to multiple lines')).toBeInTheDocument();
    });

    it('should handle special characters in title', () => {
      // Arrange & Act
      render(
        <StatCard
          title="Tasks & Projects (Q1)"
          value={42}
        />
      );

      // Assert
      expect(screen.getByText('Tasks & Projects (Q1)')).toBeInTheDocument();
    });

    it('should handle percentage values', () => {
      // Arrange & Act
      render(
        <StatCard
          title="Success Rate"
          value="100%"
        />
      );

      // Assert
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });

  describe('Visual Feedback', () => {
    it('should have hover shadow effect', () => {
      // Arrange & Act
      const { container } = render(
        <StatCard
          title="Metric"
          value={10}
        />
      );

      // Assert
      const card = container.firstChild;
      expect(card).toHaveClass('hover:shadow-lg');
    });

    it('should have rounded corners', () => {
      // Arrange & Act
      const { container } = render(
        <StatCard
          title="Metric"
          value={10}
        />
      );

      // Assert
      const card = container.firstChild;
      expect(card).toHaveClass('rounded-lg');
    });
  });
});
