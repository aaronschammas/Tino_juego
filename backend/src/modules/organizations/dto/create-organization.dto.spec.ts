import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { CreateOrganizationDto } from './create-organization.dto';

describe('CreateOrganizationDto', () => {
  describe('Validation', () => {
    it('should validate a valid organization name', async () => {
      // Arrange
      const dto = plainToClass(CreateOrganizationDto, {
        name: 'Acme Corporation',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should reject name shorter than 2 characters', async () => {
      // Arrange
      const dto = plainToClass(CreateOrganizationDto, {
        name: 'A',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject name longer than 255 characters', async () => {
      // Arrange
      const longName = 'A'.repeat(256);
      const dto = plainToClass(CreateOrganizationDto, {
        name: longName,
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should accept 2-character name (minimum)', async () => {
      // Arrange
      const dto = plainToClass(CreateOrganizationDto, {
        name: 'AB',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should accept 255-character name (maximum)', async () => {
      // Arrange
      const maxName = 'A'.repeat(255);
      const dto = plainToClass(CreateOrganizationDto, {
        name: maxName,
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should reject non-string name', async () => {
      // Arrange
      const dto = plainToClass(CreateOrganizationDto, {
        name: 12345,
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject missing name', async () => {
      // Arrange
      const dto = plainToClass(CreateOrganizationDto, {});

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should accept names with special characters', async () => {
      // Arrange
      const dto = plainToClass(CreateOrganizationDto, {
        name: "O'Reilly & Associates, Inc.",
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should accept names with numbers', async () => {
      // Arrange
      const dto = plainToClass(CreateOrganizationDto, {
        name: 'Company 2024 Ltd',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should accept unicode names', async () => {
      // Arrange
      const dto = plainToClass(CreateOrganizationDto, {
        name: '株式会社テスト',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });
  });

  describe('DTO Structure', () => {
    it('should have name property', () => {
      // Arrange
      const dto = new CreateOrganizationDto();

      // Act & Assert
      expect(dto).toHaveProperty('name');
    });

    it('should allow setting and getting name', () => {
      // Arrange
      const dto = new CreateOrganizationDto();
      dto.name = 'Test Organization';

      // Act & Assert
      expect(dto.name).toBe('Test Organization');
    });
  });

  describe('Organization Creation', () => {
    it('should support minimal organization setup', async () => {
      // Arrange
      const dto = plainToClass(CreateOrganizationDto, {
        name: 'Startup',
      });

      // Act
      const isValid = (await validate(dto)).length === 0;

      // Assert
      expect(isValid).toBe(true);
      expect(dto.name).toBe('Startup');
    });

    it('should support company-like names', async () => {
      // Arrange
      const dto = plainToClass(CreateOrganizationDto, {
        name: 'Microsoft Corporation',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });
  });
});
