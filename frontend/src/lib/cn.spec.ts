/**
 * cn.ts - CSS Class Name Utility Tests
 * AAA Pattern: Arrange, Act, Assert
 */

import { cn } from './cn';

describe('cn - CSS Class Name Utility', () => {
  describe('Basic functionality', () => {
    it('should combine multiple class names', () => {
      // Arrange
      const class1 = 'px-4';
      const class2 = 'py-2';
      const class3 = 'bg-blue-500';

      // Act
      const result = cn(class1, class2, class3);

      // Assert
      expect(result).toBe('px-4 py-2 bg-blue-500');
    });

    it('should filter out falsy values (false)', () => {
      // Arrange
      const class1 = 'text-white';
      const shouldNotInclude = false;
      const class2 = 'font-bold';

      // Act
      const result = cn(class1, shouldNotInclude, class2);

      // Assert
      expect(result).toBe('text-white font-bold');
    });

    it('should filter out null values', () => {
      // Arrange
      const class1 = 'rounded';
      const nullValue = null;
      const class2 = 'shadow-md';

      // Act
      const result = cn(class1, nullValue, class2);

      // Assert
      expect(result).toBe('rounded shadow-md');
    });

    it('should filter out undefined values', () => {
      // Arrange
      const class1 = 'text-center';
      const undefinedValue = undefined;
      const class2 = 'items-center';

      // Act
      const result = cn(class1, undefinedValue, class2);

      // Assert
      expect(result).toBe('text-center items-center');
    });

    it('should handle mixed truthy and falsy values', () => {
      // Arrange
      const values: Array<string | false | null | undefined> = ['p-4', false, 'text-lg', null, 'border', undefined, 'rounded'];

      // Act
      const result = cn(...values);

      // Assert
      expect(result).toBe('p-4 text-lg border rounded');
    });

    it('should return empty string when all values are falsy', () => {
      // Arrange
      const values: Array<false | null | undefined> = [false, null, undefined];

      // Act
      const result = cn(...values);

      // Assert
      expect(result).toBe('');
    });

    it('should handle single class name', () => {
      // Arrange
      const singleClass = 'container';

      // Act
      const result = cn(singleClass);

      // Assert
      expect(result).toBe('container');
    });

    it('should handle no arguments', () => {
      // Arrange - no arguments

      // Act
      const result = cn();

      // Assert
      expect(result).toBe('');
    });
  });

  describe('Real-world scenarios', () => {
    it('should combine conditional styles', () => {
      // Arrange
      const isActive = true;
      const isDisabled = false;

      // Act
      const result = cn(
        'btn',
        isActive && 'btn-active',
        isDisabled && 'btn-disabled'
      );

      // Assert
      expect(result).toBe('btn btn-active');
    });

    it('should combine variant styles', () => {
      // Arrange
      const size = 'lg';
      const color = 'primary';

      // Act
      const result = cn(
        'btn',
        size === 'lg' && 'text-lg px-6 py-3',
        color === 'primary' && 'bg-blue-500 text-white'
      );

      // Assert
      expect(result).toBe('btn text-lg px-6 py-3 bg-blue-500 text-white');
    });

    it('should handle responsive design classes', () => {
      // Arrange
      const isHidden = false;
      const classes: Array<string | false | null | undefined> = [
        'flex',
        'md:flex-row',
        'lg:gap-4',
        isHidden && 'hidden',
        'justify-between'
      ];

      // Act
      const result = cn(...classes);

      // Assert
      expect(result).toBe('flex md:flex-row lg:gap-4 justify-between');
    });
  });
});
