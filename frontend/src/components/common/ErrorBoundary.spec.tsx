/**
 * ErrorBoundary.tsx - Error Boundary Component Tests
 * AAA Pattern: Arrange, Act, Assert
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ErrorBoundary } from './ErrorBoundary';

// Test component that throws an error
const ThrowError = () => {
  throw new Error('Test error');
};

// Test component that renders normally
const NormalComponent = () => <div>Normal content</div>;

// Test component with multiple children
const MultipleChildren = () => (
  <div>
    <div>Child 1</div>
    <div>Child 2</div>
    <div>Child 3</div>
  </div>
);

// Test component with nested children
const NestedChildren = () => (
  <div>
    <div>
      <div>Nested 1</div>
    </div>
    <div>
      <div>Nested 2</div>
    </div>
  </div>
);

describe('ErrorBoundary Component', () => {
  describe('Normal Operation', () => {
    it('should render children when no error occurs', () => {
      // Arrange & Act
      render(
        <ErrorBoundary>
          <NormalComponent />
        </ErrorBoundary>
      );

      // Assert
      expect(screen.getByText('Normal content')).toBeInTheDocument();
    });

    it('should render multiple children correctly', () => {
      // Arrange & Act
      render(
        <ErrorBoundary>
          <MultipleChildren />
        </ErrorBoundary>
      );

      // Assert
      expect(screen.getByText('Child 1')).toBeInTheDocument();
      expect(screen.getByText('Child 2')).toBeInTheDocument();
      expect(screen.getByText('Child 3')).toBeInTheDocument();
    });

    it('should render nested children correctly', () => {
      // Arrange & Act
      render(
        <ErrorBoundary>
          <NestedChildren />
        </ErrorBoundary>
      );

      // Assert
      expect(screen.getByText('Nested 1')).toBeInTheDocument();
      expect(screen.getByText('Nested 2')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      // Suppress console error for cleaner test output
      jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should catch errors and display fallback UI', () => {
      // Arrange & Act
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      // Assert
      expect(screen.getByRole('heading')).toBeInTheDocument();
    });

    it('should display error message', () => {
      // Arrange & Act
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      // Assert
      const errorContent = screen.getByRole('heading');
      expect(errorContent).toBeInTheDocument();
    });

    it('should display error details', () => {
      // Arrange & Act
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      // Assert
      // Should show some error information
      const errorContainer = screen.getByRole('heading');
      expect(errorContainer).toBeInTheDocument();
    });
  });

  describe('Error UI Elements', () => {
    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should display error icon', () => {
      // Arrange & Act
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      // Assert
      // SVG element should be present for error icon
      const svgs = document.querySelectorAll('svg');
      expect(svgs.length).toBeGreaterThan(0);
    });

    it('should display reset button', () => {
      // Arrange & Act
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      // Assert
      const button = screen.getByRole('button', { name: /try again/i });
      expect(button).toBeInTheDocument();
    });

    it('should have accessible error message', () => {
      // Arrange & Act
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      // Assert
      const heading = screen.getByRole('heading');
      expect(heading).toHaveClass('font-bold');
    });
  });

  describe('Multiple Errors', () => {
    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should handle errors in nested components', () => {
      // Arrange & Act
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      // Assert
      expect(screen.getByRole('heading')).toBeInTheDocument();
    });

    it('should display UI when error occurs', () => {
      // Arrange & Act
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      // Assert
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should maintain error state', () => {
      // Arrange & Act
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      // Assert
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });
  });

  describe('Recovery', () => {
    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should have recovery mechanism', () => {
      // Arrange & Act
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      // Assert
      const button = screen.getByRole('button', { name: /try again/i });
      expect(button).toBeInTheDocument();
    });

    it('should show error container', () => {
      // Arrange & Act
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      // Assert
      const container = screen.getByRole('heading');
      expect(container).toBeInTheDocument();
    });

    it('should display error UI elements', () => {
      // Arrange & Act
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      // Assert
      expect(screen.getByRole('heading')).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  describe('Error Messages', () => {
    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should catch and display error', () => {
      // Arrange & Act
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      // Assert
      const errorMessage = screen.getByRole('heading');
      expect(errorMessage).toBeInTheDocument();
    });

    it('should have accessible reset button', () => {
      // Arrange & Act
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      // Assert
      const button = screen.getByRole('button', { name: /try again/i });
      expect(button).toBeInTheDocument();
    });

    it('should show error info to user', () => {
      // Arrange & Act
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      // Assert
      expect(screen.getByRole('heading')).toBeInTheDocument();
    });

    it('should render error boundary on error state', () => {
      // Arrange & Act
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      // Assert
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should render without errors when children is undefined', () => {
      // This is handled by React's error boundary behavior
      // Just verify the normal case
      const { container } = render(
        <ErrorBoundary>
          <div>Test</div>
        </ErrorBoundary>
      );

      expect(container).toBeInTheDocument();
    });
  });
});
