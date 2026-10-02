/**
 * time.ts - Time Formatting Utility Tests
 * AAA Pattern: Arrange, Act, Assert
 */

import { normalizeDurationParts, secondsToHMS } from './time';

describe('Time Formatting Utility - secondsToHMS', () => {
  describe('Valid time conversions', () => {
    it('should convert 0 seconds to 00:00:00', () => {
      // Arrange
      const seconds = 0;

      // Act
      const result = secondsToHMS(seconds);

      // Assert
      expect(result).toBe('00:00:00');
    });

    it('should convert 45 seconds to 00:00:45', () => {
      // Arrange
      const seconds = 45;

      // Act
      const result = secondsToHMS(seconds);

      // Assert
      expect(result).toBe('00:00:45');
    });

    it('should convert 1 minute (60 seconds) to 00:01:00', () => {
      // Arrange
      const seconds = 60;

      // Act
      const result = secondsToHMS(seconds);

      // Assert
      expect(result).toBe('00:01:00');
    });

    it('should convert 1 minute 30 seconds (90 seconds) to 00:01:30', () => {
      // Arrange
      const seconds = 90;

      // Act
      const result = secondsToHMS(seconds);

      // Assert
      expect(result).toBe('00:01:30');
    });

    it('should convert 1 hour (3600 seconds) to 01:00:00', () => {
      // Arrange
      const seconds = 3600;

      // Act
      const result = secondsToHMS(seconds);

      // Assert
      expect(result).toBe('01:00:00');
    });

    it('should convert 1 hour 5 minutes 30 seconds (3930 seconds) to 01:05:30', () => {
      // Arrange
      const seconds = 3930;

      // Act
      const result = secondsToHMS(seconds);

      // Assert
      expect(result).toBe('01:05:30');
    });

    it('should convert 2 hours 45 minutes 15 seconds (9915 seconds) to 02:45:15', () => {
      // Arrange
      const seconds = 9915;

      // Act
      const result = secondsToHMS(seconds);

      // Assert
      expect(result).toBe('02:45:15');
    });

    it('should convert 10 hours (36000 seconds) to 10:00:00', () => {
      // Arrange
      const seconds = 36000;

      // Act
      const result = secondsToHMS(seconds);

      // Assert
      expect(result).toBe('10:00:00');
    });

    it('should pad single digit values with leading zeros', () => {
      // Arrange
      const seconds = 3661; // 1 hour, 1 minute, 1 second

      // Act
      const result = secondsToHMS(seconds);

      // Assert
      expect(result).toBe('01:01:01');
    });
  });

  describe('Edge cases and invalid inputs', () => {
    it('should return 00:00:00 for negative seconds', () => {
      // Arrange
      const seconds = -100;

      // Act
      const result = secondsToHMS(seconds);

      // Assert
      expect(result).toBe('00:00:00');
    });

    it('should return 00:00:00 for NaN', () => {
      // Arrange
      const seconds = NaN;

      // Act
      const result = secondsToHMS(seconds);

      // Assert
      expect(result).toBe('00:00:00');
    });

    it('should return 00:00:00 for Infinity', () => {
      // Arrange
      const seconds = Infinity;

      // Act
      const result = secondsToHMS(seconds);

      // Assert
      expect(result).toBe('00:00:00');
    });

    it('should return 00:00:00 for negative Infinity', () => {
      // Arrange
      const seconds = -Infinity;

      // Act
      const result = secondsToHMS(seconds);

      // Assert
      expect(result).toBe('00:00:00');
    });
  });

  describe('Large time values', () => {
    it('should handle very large hour values', () => {
      // Arrange
      const seconds = 86400; // 24 hours

      // Act
      const result = secondsToHMS(seconds);

      // Assert
      expect(result).toBe('24:00:00');
    });

    it('should handle 100+ hours', () => {
      // Arrange
      const seconds = 360000; // 100 hours

      // Act
      const result = secondsToHMS(seconds);

      // Assert
      expect(result).toBe('100:00:00');
    });

    it('should correctly format large values with all components', () => {
      // Arrange
      const seconds = 360125; // 100 hours, 2 minutes, 5 seconds

      // Act
      const result = secondsToHMS(seconds);

      // Assert
      expect(result).toBe('100:02:05');
    });
  });

  describe('Decimal and float values', () => {
    it('should floor decimal seconds', () => {
      // Arrange
      const seconds = 45.5;

      // Act
      const result = secondsToHMS(seconds);

      // Assert
      expect(result).toMatch(/^00:00:(45|46)/);
    });

    it('should floor decimal minutes', () => {
      // Arrange
      const seconds = 90.9;

      // Act
      const result = secondsToHMS(seconds);

      // Assert
      expect(result).toMatch(/^00:01:(30|31)/);
    });
  });
});

describe('normalizeDurationParts', () => {
  it('should carry excess minutes into hours', () => {
    // Arrange
    const hours = '2';
    const minutes = '130';

    // Act
    const result = normalizeDurationParts(hours, minutes);

    // Assert
    expect(result).toEqual({ hours: '4', minutes: '10' });
  });

  it('should turn exactly 60 minutes into one hour', () => {
    // Arrange & Act
    const result = normalizeDurationParts('0', '60');

    // Assert
    expect(result).toEqual({ hours: '1', minutes: '0' });
  });

  it('should leave an already normalized duration untouched', () => {
    // Arrange & Act
    const result = normalizeDurationParts('3', '45');

    // Assert
    expect(result).toEqual({ hours: '3', minutes: '45' });
  });

  it('should handle minutes below one hour without adding hours', () => {
    // Arrange & Act
    const result = normalizeDurationParts('0', '59');

    // Assert
    expect(result).toEqual({ hours: '0', minutes: '59' });
  });

  it('should treat empty inputs as zero', () => {
    // Arrange & Act
    const result = normalizeDurationParts('', '');

    // Assert
    expect(result).toEqual({ hours: '0', minutes: '0' });
  });

  it('should clamp negative totals to zero', () => {
    // Arrange & Act
    const result = normalizeDurationParts('-5', '-10');

    // Assert
    expect(result).toEqual({ hours: '0', minutes: '0' });
  });

  it('should normalize a large minute-only duration', () => {
    // Arrange & Act
    const result = normalizeDurationParts('0', '500');

    // Assert
    expect(result).toEqual({ hours: '8', minutes: '20' });
  });

  it('should preserve the total duration in minutes', () => {
    // Arrange
    const result = normalizeDurationParts('2', '130');

    // Act
    const totalAfter = parseInt(result.hours, 10) * 60 + parseInt(result.minutes, 10);

    // Assert
    expect(totalAfter).toBe(2 * 60 + 130);
  });
});
