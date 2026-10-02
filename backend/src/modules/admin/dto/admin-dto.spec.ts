import { validate } from 'class-validator';
import { AddMemberDto } from './add-member.dto';
import { CreateOrganizationDto } from './create-organization.dto';
import { CreateUserMemberDto } from './create-user-member.dto';
import { UpdateOrganizationDto } from './update-organization.dto';
import { UpdateUserDto } from './update-user.dto';
import { OrganizationRole } from '@prisma/client';

describe('Admin DTOs validation', () => {
  describe('AddMemberDto', () => {
    it('should validate successfully with correct fields', async () => {
      const dto = new AddMemberDto();
      dto.userId = 'user-123';
      dto.role = OrganizationRole.ORG_MEMBER;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation when userId is missing', async () => {
      const dto = new AddMemberDto();

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('CreateOrganizationDto', () => {
    it('should validate successfully with correct fields', async () => {
      const dto = new CreateOrganizationDto();
      dto.name = 'My Org';
      dto.planId = 'plan-1';
      dto.isActive = true;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation with invalid name length', async () => {
      const dto = new CreateOrganizationDto();
      dto.name = 'a';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('CreateUserMemberDto', () => {
    it('should validate successfully with correct fields', async () => {
      const dto = new CreateUserMemberDto();
      dto.email = 'member@test.com';
      dto.password = 'password123';
      dto.name = 'John';
      dto.lastname = 'Doe';
      dto.role = OrganizationRole.ORG_OWNER;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation with invalid email format', async () => {
      const dto = new CreateUserMemberDto();
      dto.email = 'not-an-email';
      dto.password = '123'; // too short
      dto.name = 'J'; // too short
      dto.lastname = 'D'; // too short

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject decorative unicode lookalike characters in name', async () => {
      const dto = new CreateUserMemberDto();
      dto.email = 'member@test.com';
      dto.password = 'password123';
      dto.name = '𝔇𝔯𝔢𝔯𝔦𝔫𝔞';
      dto.lastname = 'Doe';
      dto.role = OrganizationRole.ORG_OWNER;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('UpdateOrganizationDto', () => {
    it('should validate successfully with correct fields', async () => {
      const dto = new UpdateOrganizationDto();
      dto.name = 'New Name';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('UpdateUserDto', () => {
    it('should validate successfully with correct fields', async () => {
      const dto = new UpdateUserDto();
      dto.email = 'updated@test.com';
      dto.name = 'Jane';
      dto.lastname = 'Smith';
      dto.password = 'newsecurepassword';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject decorative unicode lookalike characters in name', async () => {
      const dto = new UpdateUserDto();
      dto.name = '𝔇𝔯𝔢𝔯𝔦𝔫𝔞';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
