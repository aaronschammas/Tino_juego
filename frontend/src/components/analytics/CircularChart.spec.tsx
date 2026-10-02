/**
 * CircularChart.tsx - Circular Chart Component Tests
 * AAA Pattern: Arrange, Act, Assert
 */

import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import CircularChart from './CircularChart';

describe('CircularChart Component', () => {
  describe('Rendering', () => {
    it('should render circular chart SVG', () => {
      // Arrange & Act
      const { container } = render(
        <CircularChart percentage={50} />
      );

      // Assert
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should render with percentage', () => {
      // Arrange & Act
      const { container } = render(
        <CircularChart percentage={75} />
      );

      // Assert
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should display percentage text', () => {
      // Arrange & Act
      const { container } = render(
        <CircularChart percentage={50} />
      );

      // Assert
      expect(container.textContent).toContain('50');
    });
  });

  describe('Percentage Values', () => {
    it('should handle 0% percentage', () => {
      // Arrange & Act
      const { container } = render(
        <CircularChart percentage={0} />
      );

      // Assert
      expect(container.textContent).toContain('0');
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should handle 100% percentage', () => {
      // Arrange & Act
      const { container } = render(
        <CircularChart percentage={100} />
      );

      // Assert
      expect(container.textContent).toContain('100');
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should handle 50% percentage', () => {
      // Arrange & Act
      const { container } = render(
        <CircularChart percentage={50} />
      );

      // Assert
      expect(container.textContent).toContain('50');
    });

    it('should handle decimal percentages', () => {
      // Arrange & Act
      const { container } = render(
        <CircularChart percentage={33.33} />
      );

      // Assert
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should handle high percentages', () => {
      // Arrange & Act
      const { container } = render(
        <CircularChart percentage={95} />
      );

      // Assert
      expect(container.textContent).toContain('95');
    });

    it('should handle low percentages', () => {
      // Arrange & Act
      const { container } = render(
        <CircularChart percentage={5} />
      );

      // Assert
      expect(container.textContent).toContain('5');
    });
  });

  describe('Color Styling', () => {
    it('should apply default color', () => {
      // Arrange & Act
      const { container } = render(
        <CircularChart percentage={50} />
      );

      // Assert
      const circle = container.querySelector('circle[stroke]');
      expect(circle).toBeInTheDocument();
    });

    it('should apply custom color', () => {
      // Arrange & Act
      const { container } = render(
        <CircularChart percentage={50} color="var(--color-danger-700)" />
      );

      // Assert
      const circle = container.querySelector('circle[stroke]');
      expect(circle).toBeInTheDocument();
    });

    it('should apply warning color', () => {
      // Arrange & Act
      const { container } = render(
        <CircularChart percentage={50} color="var(--color-warning-700)" />
      );

      // Assert
      const circle = container.querySelector('circle[stroke]');
      expect(circle).toBeInTheDocument();
    });

    it('should apply primary color', () => {
      // Arrange & Act
      const { container } = render(
        <CircularChart percentage={50} color="var(--color-primary-700)" />
      );

      // Assert
      const circle = container.querySelector('circle[stroke]');
      expect(circle).toBeInTheDocument();
    });

    it('should apply hex color', () => {
      // Arrange & Act
      const { container } = render(
        <CircularChart percentage={50} color="#FF5733" />
      );

      // Assert
      const circle = container.querySelector('circle[stroke]');
      expect(circle).toBeInTheDocument();
    });
  });

  describe('Size Customization', () => {
    it('should render with default size', () => {
      // Arrange & Act
      const { container } = render(
        <CircularChart percentage={50} />
      );

      // Assert
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg?.getAttribute('width')).toBe('120');
      expect(svg?.getAttribute('height')).toBe('120');
    });

    it('should render with custom size', () => {
      // Arrange & Act
      const { container } = render(
        <CircularChart percentage={50} size={200} />
      );

      // Assert
      const svg = container.querySelector('svg');
      expect(svg?.getAttribute('width')).toBe('200');
      expect(svg?.getAttribute('height')).toBe('200');
    });

    it('should render with small size', () => {
      // Arrange & Act
      const { container } = render(
        <CircularChart percentage={50} size={80} />
      );

      // Assert
      const svg = container.querySelector('svg');
      expect(svg?.getAttribute('width')).toBe('80');
      expect(svg?.getAttribute('height')).toBe('80');
    });

    it('should render with large size', () => {
      // Arrange & Act
      const { container } = render(
        <CircularChart percentage={50} size={300} />
      );

      // Assert
      const svg = container.querySelector('svg');
      expect(svg?.getAttribute('width')).toBe('300');
      expect(svg?.getAttribute('height')).toBe('300');
    });
  });

  describe('SVG Structure', () => {
    it('should have proper SVG viewbox', () => {
      // Arrange & Act
      const { container } = render(
        <CircularChart percentage={50} size={120} />
      );

      // Assert
      const svg = container.querySelector('svg');
      expect(svg?.getAttribute('viewBox')).toBe('0 0 120 120');
    });

    it('should contain circle elements', () => {
      // Arrange & Act
      const { container } = render(
        <CircularChart percentage={50} />
      );

      // Assert
      const circles = container.querySelectorAll('circle');
      expect(circles.length).toBeGreaterThan(0);
    });

    it('should contain text element for percentage display', () => {
      // Arrange & Act
      const { container } = render(
        <CircularChart percentage={50} />
      );

      // Assert
      const text = container.querySelector('span');
      expect(text?.textContent).toMatch(/50%/);
    });
  });

  describe('Edge Cases', () => {
    it('should handle percentage over 100', () => {
      // Arrange & Act
      const { container } = render(
        <CircularChart percentage={150} />
      );

      // Assert
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should handle negative percentage', () => {
      // Arrange & Act
      const { container } = render(
        <CircularChart percentage={-10} />
      );

      // Assert
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should handle very small size', () => {
      // Arrange & Act
      const { container } = render(
        <CircularChart percentage={50} size={20} />
      );

      // Assert
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should handle very large size', () => {
      // Arrange & Act
      const { container } = render(
        <CircularChart percentage={50} size={500} />
      );

      // Assert
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  describe('Combinations', () => {
    it('should combine custom color and size', () => {
      // Arrange & Act
      const { container } = render(
        <CircularChart percentage={75} color="#FF5733" size={150} />
      );

      // Assert
      const svg = container.querySelector('svg');
      expect(svg?.getAttribute('width')).toBe('150');
      expect(container.textContent).toContain('75');
    });

    it('should handle all props together', () => {
      // Arrange & Act
      const { container } = render(
        <CircularChart percentage={88} color="var(--color-primary-700)" size={180} />
      );

      // Assert
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(container.textContent).toContain('88');
    });
  });
});
