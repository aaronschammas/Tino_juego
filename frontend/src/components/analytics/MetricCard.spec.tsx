/**
 * MetricCard.tsx - Metric Card Component Tests
 * AAA Pattern: Arrange, Act, Assert
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import MetricCard from './MetricCard';

describe('MetricCard Component', () => {
  describe('Rendering', () => {
    it('should render title and value', () => {
      // Arrange & Act
      render(
        <MetricCard
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
        <MetricCard
          title="Completion"
          value="85%"
        />
      );

      // Assert
      expect(screen.getByText('Completion')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
    });

    it('should render with numeric value', () => {
      // Arrange & Act
      render(
        <MetricCard
          title="Active Projects"
          value={15}
        />
      );

      // Assert
      expect(screen.getByText('Active Projects')).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument();
    });

    it('should render optional subtitle', () => {
      // Arrange & Act
      render(
        <MetricCard
          title="Completed Tasks"
          value={32}
          subtitle="This week"
        />
      );

      // Assert
      expect(screen.getByText('Completed Tasks')).toBeInTheDocument();
      expect(screen.getByText('This week')).toBeInTheDocument();
    });
  });

  describe('Tone Styling', () => {
    it('should apply primary tone by default', () => {
      // Arrange & Act
      const { container } = render(
        <MetricCard
          title="Metric"
          value={10}
        />
      );

      // Assert
      const card = container.querySelector('[class*="primary"]');
      expect(card).toBeInTheDocument();
    });

    it('should apply secondary tone', () => {
      // Arrange & Act
      const { container } = render(
        <MetricCard
          title="Metric"
          value={10}
          tone="secondary"
        />
      );

      // Assert
      const card = container.querySelector('[class*="secondary"]');
      expect(card).toBeInTheDocument();
    });

    it('should apply accent tone', () => {
      // Arrange & Act
      const { container } = render(
        <MetricCard
          title="Metric"
          value={10}
          tone="accent"
        />
      );

      // Assert
      const card = container.querySelector('[class*="accent"]');
      expect(card).toBeInTheDocument();
    });

    it('should apply warning tone', () => {
      // Arrange & Act
      const { container } = render(
        <MetricCard
          title="Metric"
          value={10}
          tone="warning"
        />
      );

      // Assert
      const card = container.querySelector('[class*="warning"]');
      expect(card).toBeInTheDocument();
    });

    it('should apply danger tone', () => {
      // Arrange & Act
      const { container } = render(
        <MetricCard
          title="Metric"
          value={10}
          tone="danger"
        />
      );

      // Assert
      const card = container.querySelector('[class*="danger"]');
      expect(card).toBeInTheDocument();
    });
  });

  describe('Value Formatting', () => {
    it('should handle zero value', () => {
      // Arrange & Act
      render(
        <MetricCard
          title="Blocked Tasks"
          value={0}
        />
      );

      // Assert
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should handle large numbers', () => {
      // Arrange & Act
      render(
        <MetricCard
          title="Total Hours"
          value={10000}
        />
      );

      // Assert
      expect(screen.getByText('10000')).toBeInTheDocument();
    });

    it('should handle percentage strings', () => {
      // Arrange & Act
      render(
        <MetricCard
          title="Success Rate"
          value="100%"
        />
      );

      // Assert
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('should handle decimal values', () => {
      // Arrange & Act
      render(
        <MetricCard
          title="Average Rating"
          value="4.8"
        />
      );

      // Assert
      expect(screen.getByText('4.8')).toBeInTheDocument();
    });
  });

  describe('Text Content', () => {
    it('should handle long title', () => {
      // Arrange & Act
      render(
        <MetricCard
          title="This is a very long metric title that spans multiple words"
          value={42}
        />
      );

      // Assert
      expect(screen.getByText('This is a very long metric title that spans multiple words')).toBeInTheDocument();
    });

    it('should handle long subtitle', () => {
      // Arrange & Act
      render(
        <MetricCard
          title="Metric"
          value={42}
          subtitle="This is a detailed explanation about the metric"
        />
      );

      // Assert
      expect(screen.getByText('This is a detailed explanation about the metric')).toBeInTheDocument();
    });

    it('should handle special characters', () => {
      // Arrange & Act
      render(
        <MetricCard
          title="Tasks & Projects (Q1)"
          value="42 / 50"
        />
      );

      // Assert
      expect(screen.getByText('Tasks & Projects (Q1)')).toBeInTheDocument();
      expect(screen.getByText('42 / 50')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should render without subtitle', () => {
      // Arrange & Act
      render(
        <MetricCard
          title="Metric"
          value={42}
        />
      );

      // Assert
      expect(screen.getByText('Metric')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('should handle negative values', () => {
      // Arrange & Act
      render(
        <MetricCard
          title="Change"
          value={-5}
        />
      );

      // Assert
      expect(screen.getByText('-5')).toBeInTheDocument();
    });

    it('should handle very large numbers', () => {
      // Arrange & Act
      render(
        <MetricCard
          title="Total"
          value={999999999}
        />
      );

      // Assert
      expect(screen.getByText('999999999')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have semantic structure', () => {
      // Arrange & Act
      render(
        <MetricCard
          title="Metric Title"
          value={42}
          subtitle="Subtitle text"
        />
      );

      // Assert
      expect(screen.getByText('Metric Title')).toBeInTheDocument();
    });

    it('should properly display all text content', () => {
      // Arrange & Act
      render(
        <MetricCard
          title="Title"
          value="Value"
          subtitle="Sub"
        />
      );

      // Assert
      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Value')).toBeInTheDocument();
      expect(screen.getByText('Sub')).toBeInTheDocument();
    });
  });
});
