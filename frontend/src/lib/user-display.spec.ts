/**
 * user-display.ts - User Display Formatting Utility Tests
 * AAA Pattern: Arrange, Act, Assert
 */

import {
  isPlaceholderLastname,
  formatUserDisplayName,
  getUserInitials,
} from './user-display';

describe('User Display Utilities', () => {
  describe('isPlaceholderLastname', () => {
    describe('Placeholder detection', () => {
      it('should return true for undefined lastname', () => {
        // Arrange
        const lastname = undefined;

        // Act
        const result = isPlaceholderLastname(lastname);

        // Assert
        expect(result).toBe(true);
      });

      it('should return true for null lastname', () => {
        // Arrange
        const lastname = null;

        // Act
        const result = isPlaceholderLastname(lastname);

        // Assert
        expect(result).toBe(true);
      });

      it('should return true for empty string lastname', () => {
        // Arrange
        const lastname = '';

        // Act
        const result = isPlaceholderLastname(lastname);

        // Assert
        expect(result).toBe(true);
      });

      it('should return true for "pending" lastname', () => {
        // Arrange
        const lastname = 'pending';

        // Act
        const result = isPlaceholderLastname(lastname);

        // Assert
        expect(result).toBe(true);
      });

      it('should return true for "PENDING" lastname (case-insensitive)', () => {
        // Arrange
        const lastname = 'PENDING';

        // Act
        const result = isPlaceholderLastname(lastname);

        // Assert
        expect(result).toBe(true);
      });

      it('should return true for whitespace-only lastname', () => {
        // Arrange
        const lastname = '   ';

        // Act
        const result = isPlaceholderLastname(lastname);

        // Assert
        expect(result).toBe(true);
      });

      it('should return false for valid lastname', () => {
        // Arrange
        const lastname = 'Morabito';

        // Act
        const result = isPlaceholderLastname(lastname);

        // Assert
        expect(result).toBe(false);
      });

      it('should return false for lastname with special characters', () => {
        // Arrange
        const lastname = "O'Connor";

        // Act
        const result = isPlaceholderLastname(lastname);

        // Assert
        expect(result).toBe(false);
      });
    });
  });

  describe('formatUserDisplayName', () => {
    describe('Valid name combinations', () => {
      it('should format name and lastname', () => {
        // Arrange
        const name = 'Leonardo';
        const lastname = 'Morabito';

        // Act
        const result = formatUserDisplayName(name, lastname);

        // Assert
        expect(result).toBe('Leonardo Morabito');
      });

      it('should return only name when lastname is placeholder', () => {
        // Arrange
        const name = 'Leonardo';
        const lastname = 'pending';

        // Act
        const result = formatUserDisplayName(name, lastname);

        // Assert
        expect(result).toBe('Leonardo');
      });

      it('should return only name when lastname is undefined', () => {
        // Arrange
        const name = 'Leonardo';
        const lastname = undefined;

        // Act
        const result = formatUserDisplayName(name, lastname);

        // Assert
        expect(result).toBe('Leonardo');
      });

      it('should return only name when lastname is null', () => {
        // Arrange
        const name = 'Leonardo';
        const lastname = null;

        // Act
        const result = formatUserDisplayName(name, lastname);

        // Assert
        expect(result).toBe('Leonardo');
      });

      it('should return only lastname when name is undefined', () => {
        // Arrange
        const name = undefined;
        const lastname = 'Morabito';

        // Act
        const result = formatUserDisplayName(name, lastname);

        // Assert
        expect(result).toBe('Morabito');
      });

      it('should handle whitespace in names', () => {
        // Arrange
        const name = '  Leonardo  ';
        const lastname = '  Morabito  ';

        // Act
        const result = formatUserDisplayName(name, lastname);

        // Assert
        expect(result).toBe('Leonardo Morabito');
      });

      it('should return empty string when both are missing or placeholder', () => {
        // Arrange
        const name = undefined;
        const lastname = 'pending';

        // Act
        const result = formatUserDisplayName(name, lastname);

        // Assert
        expect(result).toBe('');
      });
    });

    describe('Edge cases', () => {
      it('should handle empty string for name', () => {
        // Arrange
        const name = '';
        const lastname = 'Morabito';

        // Act
        const result = formatUserDisplayName(name, lastname);

        // Assert
        expect(result).toBe('Morabito');
      });

      it('should handle empty string for lastname', () => {
        // Arrange
        const name = 'Leonardo';
        const lastname = '';

        // Act
        const result = formatUserDisplayName(name, lastname);

        // Assert
        expect(result).toBe('Leonardo');
      });

      it('should handle both undefined', () => {
        // Arrange
        const name = undefined;
        const lastname = undefined;

        // Act
        const result = formatUserDisplayName(name, lastname);

        // Assert
        expect(result).toBe('');
      });
    });
  });

  describe('getUserInitials', () => {
    describe('Valid initials generation', () => {
      it('should generate initials from name and lastname', () => {
        // Arrange
        const name = 'Leonardo';
        const lastname = 'Morabito';

        // Act
        const result = getUserInitials(name, lastname);

        // Assert
        expect(result).toBe('LM');
      });

      it('should generate initials from single name', () => {
        // Arrange
        const name = 'Leonardo';
        const lastname = undefined;

        // Act
        const result = getUserInitials(name, lastname);

        // Assert
        expect(result).toBe('L');
      });

      it('should generate initials from lastname when name is missing', () => {
        // Arrange
        const name = undefined;
        const lastname = 'Morabito';

        // Act
        const result = getUserInitials(name, lastname);

        // Assert
        expect(result).toBe('M');
      });

      it('should return "?" when both name and lastname are missing', () => {
        // Arrange
        const name = undefined;
        const lastname = undefined;

        // Act
        const result = getUserInitials(name, lastname);

        // Assert
        expect(result).toBe('?');
      });

      it('should return "?" when both are empty strings', () => {
        // Arrange
        const name = '';
        const lastname = '';

        // Act
        const result = getUserInitials(name, lastname);

        // Assert
        expect(result).toBe('?');
      });

      it('should handle placeholder lastname as missing', () => {
        // Arrange
        const name = 'Leonardo';
        const lastname = 'pending';

        // Act
        const result = getUserInitials(name, lastname);

        // Assert
        expect(result).toBe('L');
      });

      it('should handle whitespace in names', () => {
        // Arrange
        const name = '  Leonardo  ';
        const lastname = '  Morabito  ';

        // Act
        const result = getUserInitials(name, lastname);

        // Assert
        expect(result).toBe('LM');
      });

      it('should uppercase initials', () => {
        // Arrange
        const name = 'leonardo';
        const lastname = 'morabito';

        // Act
        const result = getUserInitials(name, lastname);

        // Assert
        expect(result).toBe('LM');
      });

      it('should handle single character names', () => {
        // Arrange
        const name = 'L';
        const lastname = 'M';

        // Act
        const result = getUserInitials(name, lastname);

        // Assert
        expect(result).toBe('LM');
      });

      it('should handle unicode characters', () => {
        // Arrange
        const name = 'André';
        const lastname = 'José';

        // Act
        const result = getUserInitials(name, lastname);

        // Assert
        expect(result).toBe('AJ');
      });
    });

    describe('Edge cases', () => {
      it('should return "?" when lastname is placeholder and name is empty', () => {
        // Arrange
        const name = '';
        const lastname = 'pending';

        // Act
        const result = getUserInitials(name, lastname);

        // Assert
        expect(result).toBe('?');
      });

      it('should handle null values', () => {
        // Arrange
        const name = null;
        const lastname = null;

        // Act
        const result = getUserInitials(name, lastname);

        // Assert
        expect(result).toBe('?');
      });

      it('should handle mixed null and valid values', () => {
        // Arrange
        const name = 'Leonardo';
        const lastname = null;

        // Act
        const result = getUserInitials(name, lastname);

        // Assert
        expect(result).toBe('L');
      });
    });
  });
});
