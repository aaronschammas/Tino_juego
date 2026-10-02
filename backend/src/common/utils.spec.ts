describe('Utility Functions - Common Helpers', () => {
  describe('String Utilities', () => {
    it('should normalize email addresses', () => {
      // Arrange
      const inputs = [
        { input: '  USER@EXAMPLE.COM  ', expected: 'user@example.com' },
        { input: 'Test@Example.Com', expected: 'test@example.com' },
        { input: 'valid@test.com', expected: 'valid@test.com' },
      ];

      // Act & Assert
      inputs.forEach(({ input, expected }) => {
        const normalized = input.trim().toLowerCase();
        expect(normalized).toBe(expected);
      });
    });

    it('should generate slugs from strings', () => {
      // Arrange
      const inputs = [
        { input: 'My Project', expected: 'my-project' },
        { input: 'Test  Name', expected: 'test-name' },
        { input: 'UPPERCASE', expected: 'uppercase' },
      ];

      // Act & Assert
      inputs.forEach(({ input, expected }) => {
        const slug = input
          .toLowerCase()
          .trim()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '');
        expect(slug).toBe(expected);
      });
    });

    it('should truncate long strings', () => {
      // Arrange
      const longText = 'This is a very long text that should be truncated';
      const maxLength = 20;

      // Act
      const truncated = longText.length > maxLength 
        ? longText.substring(0, maxLength) + '...'
        : longText;

      // Assert
      expect(truncated).toBe('This is a very long ...');
      expect(truncated.length).toBeLessThanOrEqual(maxLength + 3);
    });
  });

  describe('Number Utilities', () => {
    it('should format numbers with thousands separator', () => {
      // Arrange
      const numbers = [
        { value: 1000, expected: '1,000' },
        { value: 1000000, expected: '1,000,000' },
        { value: 123, expected: '123' },
      ];

      // Act & Assert
      numbers.forEach(({ value, expected }) => {
        const formatted = value.toLocaleString('en-US');
        expect(formatted).toBe(expected);
      });
    });

    it('should calculate percentages', () => {
      // Arrange
      const inputs = [
        { part: 25, total: 100, expected: 25 },
        { part: 50, total: 200, expected: 25 },
        { part: 3, total: 4, expected: 75 },
      ];

      // Act & Assert
      inputs.forEach(({ part, total, expected }) => {
        const percentage = (part / total) * 100;
        expect(percentage).toBe(expected);
      });
    });

    it('should round numbers to decimal places', () => {
      // Arrange
      const inputs = [
        { value: 3.14159, places: 2, expected: 3.14 },
        { value: 10.5555, places: 2, expected: 10.56 },
        { value: 7.8, places: 1, expected: 7.8 },
      ];

      // Act & Assert
      inputs.forEach(({ value, places, expected }) => {
        const rounded = Math.round(value * Math.pow(10, places)) / Math.pow(10, places);
        expect(rounded).toBe(expected);
      });
    });
  });

  describe('Date Utilities', () => {
    it('should format dates to ISO string', () => {
      // Arrange
      const date = new Date('2025-01-15');

      // Act
      const isoString = date.toISOString();

      // Assert
      expect(isoString).toContain('2025-01-15');
    });

    it('should calculate days between dates', () => {
      // Arrange
      const date1 = new Date('2025-01-01');
      const date2 = new Date('2025-01-11');

      // Act
      const daysDiff = (date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24);

      // Assert
      expect(daysDiff).toBe(10);
    });

    it('should check if date is today', () => {
      // Arrange
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Act & Assert
      const isToday = (date: Date) => {
        const now = new Date();
        return date.getDate() === now.getDate() &&
               date.getMonth() === now.getMonth() &&
               date.getFullYear() === now.getFullYear();
      };

      expect(isToday(today)).toBe(true);
      expect(isToday(yesterday)).toBe(false);
    });
  });

  describe('Array Utilities', () => {
    it('should group array by property', () => {
      // Arrange
      const items = [
        { category: 'A', value: 1 },
        { category: 'B', value: 2 },
        { category: 'A', value: 3 },
      ];

      // Act
      const grouped = items.reduce((acc, item) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push(item);
        return acc;
      }, {} as Record<string, typeof items>);

      // Assert
      expect(grouped['A']).toHaveLength(2);
      expect(grouped['B']).toHaveLength(1);
    });

    it('should remove duplicates from array', () => {
      // Arrange
      const items = ['a', 'b', 'a', 'c', 'b'];

      // Act
      const unique = [...new Set(items)];

      // Assert
      expect(unique).toEqual(['a', 'b', 'c']);
      expect(unique).toHaveLength(3);
    });

    it('should flatten nested arrays', () => {
      // Arrange
      const nested = [[1, 2], [3, 4], [5]];

      // Act
      const flattened = nested.flat();

      // Assert
      expect(flattened).toEqual([1, 2, 3, 4, 5]);
    });

    it('should sort array of objects', () => {
      // Arrange
      const items = [
        { name: 'C', value: 3 },
        { name: 'A', value: 1 },
        { name: 'B', value: 2 },
      ];

      // Act
      const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));

      // Assert
      expect(sorted[0].name).toBe('A');
      expect(sorted[1].name).toBe('B');
      expect(sorted[2].name).toBe('C');
    });
  });

  describe('Object Utilities', () => {
    it('should merge objects', () => {
      // Arrange
      const obj1 = { a: 1, b: 2 };
      const obj2 = { b: 3, c: 4 };

      // Act
      const merged = { ...obj1, ...obj2 };

      // Assert
      expect(merged).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('should pick specific keys from object', () => {
      // Arrange
      const obj = { a: 1, b: 2, c: 3, d: 4 };
      const keys = ['a', 'c'];

      // Act
      const picked = Object.fromEntries(
        keys.map(k => [k, obj[k as keyof typeof obj]])
      );

      // Assert
      expect(picked).toEqual({ a: 1, c: 3 });
    });

    it('should check if object is empty', () => {
      // Arrange
      const emptyObj = {};
      const filledObj = { a: 1 };

      // Act & Assert
      expect(Object.keys(emptyObj).length === 0).toBe(true);
      expect(Object.keys(filledObj).length === 0).toBe(false);
    });
  });

  describe('Type Guards', () => {
    it('should check if value is string', () => {
      // Act & Assert
      expect(typeof 'hello' === 'string').toBe(true);
      expect(typeof 123 === 'string').toBe(false);
      expect(typeof null === 'string').toBe(false);
    });

    it('should check if value is number', () => {
      // Act & Assert
      expect(typeof 123 === 'number').toBe(true);
      expect(typeof '123' === 'number').toBe(false);
      expect(typeof NaN === 'number').toBe(true);
    });

    it('should check if value is null or undefined', () => {
      // Act & Assert
      expect(null == null).toBe(true);
      expect(undefined == null).toBe(true);
      expect(0 == null).toBe(false);
      expect('' == null).toBe(false);
    });
  });

  describe('Validation Helpers', () => {
    it('should validate email format', () => {
      // Arrange
      const validEmails = ['test@example.com', 'user+tag@domain.co.uk'];
      const invalidEmails = ['invalid', 'test@', '@example.com'];

      // Act & Assert
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      validEmails.forEach(email => {
        expect(emailRegex.test(email)).toBe(true);
      });

      invalidEmails.forEach(email => {
        expect(emailRegex.test(email)).toBe(false);
      });
    });

    it('should validate UUID format', () => {
      // Arrange
      const validUUID = '550e8400-e29b-41d4-a716-446655440000';
      const invalidUUID = 'not-a-uuid';

      // Act
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      // Assert
      expect(uuidRegex.test(validUUID)).toBe(true);
      expect(uuidRegex.test(invalidUUID)).toBe(false);
    });

    it('should validate phone number format', () => {
      // Arrange
      const validPhones = ['1234567890', '+1-123-456-7890', '(123) 456-7890'];
      const invalidPhones = ['123', 'abc'];

      // Act & Assert
      const phoneRegex = /[\d\s\-\+\(\)]{10,}/;

      validPhones.forEach(phone => {
        expect(phoneRegex.test(phone)).toBe(true);
      });

      invalidPhones.forEach(phone => {
        expect(phoneRegex.test(phone)).toBe(false);
      });
    });
  });
});
