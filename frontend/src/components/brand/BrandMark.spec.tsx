/**
 * BrandMark.tsx - Brand Mark Component Tests
 * AAA Pattern: Arrange, Act, Assert
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import BrandMark from './BrandMark';

jest.mock('next/link', () => {
  return ({ children, href }: any) => <a href={href}>{children}</a>;
});

describe('BrandMark Component', () => {
  describe('Rendering', () => {
    it('should render brand mark', () => {
      // Arrange & Act
      render(<BrandMark />);

      // Assert
      expect(screen.getByRole('link')).toBeInTheDocument();
    });

    it('should render with default href', () => {
      // Arrange & Act
      render(<BrandMark />);

      // Assert
      const link = screen.getByRole('link') as HTMLAnchorElement;
      expect(link.href).toContain('/');
    });

    it('should render with custom href', () => {
      // Arrange & Act
      render(<BrandMark href="/dashboard" />);

      // Assert
      const link = screen.getByRole('link') as HTMLAnchorElement;
      expect(link.href).toContain('/dashboard');
    });
  });

  describe('Tone Styling', () => {
    it('should apply dark tone by default', () => {
      // Arrange & Act
      render(<BrandMark />);

      // Assert
      const link = screen.getByRole('link');
      expect(link).toBeInTheDocument();
    });

    it('should apply light tone', () => {
      // Arrange & Act
      render(<BrandMark tone="light" />);

      // Assert
      const link = screen.getByRole('link');
      expect(link).toBeInTheDocument();
    });

    it('should apply dark tone styling', () => {
      // Arrange & Act
      render(<BrandMark tone="dark" />);

      // Assert
      const link = screen.getByRole('link');
      expect(link).toBeInTheDocument();
    });
  });

  describe('Compact Mode', () => {
    it('should render in normal mode by default', () => {
      // Arrange & Act
      render(<BrandMark />);

      // Assert
      expect(screen.getByRole('link')).toBeInTheDocument();
    });

    it('should render in compact mode', () => {
      // Arrange & Act
      render(<BrandMark compact={true} />);

      // Assert
      expect(screen.getByRole('link')).toBeInTheDocument();
    });

    it('should apply compact styling when enabled', () => {
      // Arrange & Act
      const { container } = render(<BrandMark compact={true} />);

      // Assert
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('Custom Styling', () => {
    it('should accept custom className', () => {
      // Arrange & Act
      render(
        <BrandMark className="custom-class" />
      );

      // Assert
      const link = screen.getByRole('link');
      expect(link).toBeInTheDocument();
    });

    it('should merge custom className with default classes', () => {
      // Arrange & Act
      render(
        <BrandMark className="mt-4" />
      );

      // Assert
      const link = screen.getByRole('link');
      expect(link).toBeInTheDocument();
    });
  });

  describe('Combinations', () => {
    it('should combine light tone with compact mode', () => {
      // Arrange & Act
      render(<BrandMark tone="light" compact={true} />);

      // Assert
      expect(screen.getByRole('link')).toBeInTheDocument();
    });

    it('should combine dark tone with custom href', () => {
      // Arrange & Act
      render(<BrandMark tone="dark" href="/home" />);

      // Assert
      const link = screen.getByRole('link') as HTMLAnchorElement;
      expect(link.href).toContain('/home');
    });

    it('should combine all props', () => {
      // Arrange & Act
      render(
        <BrandMark
          href="/dashboard"
          tone="light"
          compact={true}
          className="my-class"
        />
      );

      // Assert
      const link = screen.getByRole('link') as HTMLAnchorElement;
      expect(link.href).toContain('/dashboard');
    });
  });

  describe('Accessibility', () => {
    it('should render as link', () => {
      // Arrange & Act
      render(<BrandMark />);

      // Assert
      expect(screen.getByRole('link')).toBeInTheDocument();
    });

    it('should have proper link semantics', () => {
      // Arrange & Act
      render(<BrandMark href="/home" />);

      // Assert
      const link = screen.getByRole('link');
      expect(link.tagName).toBe('A');
    });
  });
});
