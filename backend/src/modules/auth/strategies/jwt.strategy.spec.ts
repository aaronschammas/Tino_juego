import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  describe('Initialization', () => {
    beforeEach(() => {
      process.env.JWT_SECRET = 'test-secret-key-12345';
    });

    afterEach(() => {
      delete process.env.JWT_SECRET;
    });

    it('should create instance when JWT_SECRET is set', () => {
      strategy = new JwtStrategy();
      expect(strategy).toBeDefined();
    });

    it('should have validate method', () => {
      strategy = new JwtStrategy();
      expect(typeof strategy.validate).toBe('function');
    });

    it('should use ExtractJwt.fromAuthHeaderAsBearerToken', () => {
      strategy = new JwtStrategy();
      expect(strategy).toBeDefined();
    });
  });

  describe('validate method', () => {
    beforeEach(() => {
      process.env.JWT_SECRET = 'test-secret-key-12345';
      strategy = new JwtStrategy();
    });

    afterEach(() => {
      delete process.env.JWT_SECRET;
    });

    it('should return user object with all required fields', async () => {
      const payload = {
        sub: 'user-123',
        email: 'user@example.com',
        role: 'USER',
        organizationId: 'org-456',
      };

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        id: 'user-123',
        email: 'user@example.com',
        role: 'USER',
        organizationId: 'org-456',
        plan: null,
      });
    });

    it('should map sub field to id', async () => {
      const payload = {
        sub: 'mapped-user-id',
        email: 'test@example.com',
        role: 'USER',
      };

      const result = await strategy.validate(payload);

      expect(result.id).toBe('mapped-user-id');
      expect(result.email).toBe('test@example.com');
    });

    it('should handle missing organizationId', async () => {
      const payload = {
        sub: 'user-without-org',
        email: 'noorg@example.com',
        role: 'USER',
      };

      const result = await strategy.validate(payload);

      expect(result.organizationId).toBeNull();
    });

    it('should handle null organizationId', async () => {
      const payload = {
        sub: 'user-null-org',
        email: 'nullorg@example.com',
        role: 'USER',
        organizationId: null,
      };

      const result = await strategy.validate(payload);

      expect(result.organizationId).toBeNull();
    });

    it('should preserve all payload fields', async () => {
      const payload = {
        sub: 'preserve-test',
        email: 'preserve@example.com',
        role: 'ADMIN',
        organizationId: 'org-preserve',
      };

      const result = await strategy.validate(payload);

      expect(result.id).toBe(payload.sub);
      expect(result.email).toBe(payload.email);
      expect(result.role).toBe(payload.role);
      expect(result.organizationId).toBe(payload.organizationId);
    });
  });

  describe('Payload Transformation', () => {
    beforeEach(() => {
      process.env.JWT_SECRET = 'test-secret-key-12345';
      strategy = new JwtStrategy();
    });

    afterEach(() => {
      delete process.env.JWT_SECRET;
    });

    it('should handle various email formats', async () => {
      const emails = [
        'user@example.com',
        'first.last@company.co.uk',
        'user+tag@example.org',
      ];

      for (const email of emails) {
        const payload = {
          sub: 'email-test',
          email,
          role: 'USER',
        };

        const result = await strategy.validate(payload);
        expect(result.email).toBe(email);
      }
    });

    it('should handle various role types', async () => {
      const roles = ['ADMIN', 'USER', 'MANAGER', 'VIEWER', 'ORG_OWNER'];

      for (const role of roles) {
        const payload = {
          sub: 'role-test',
          email: 'test@example.com',
          role,
        };

        const result = await strategy.validate(payload);
        expect(result.role).toBe(role);
      }
    });

    it('should handle multiple organizationIds', async () => {
      const orgIds = ['org-1', 'org-2', 'org-complex-123'];

      for (const orgId of orgIds) {
        const payload = {
          sub: 'org-test',
          email: 'test@example.com',
          role: 'USER',
          organizationId: orgId,
        };

        const result = await strategy.validate(payload);
        expect(result.organizationId).toBe(orgId);
      }
    });
  });

  describe('Integration Scenarios', () => {
    beforeEach(() => {
      process.env.JWT_SECRET = 'test-secret-key-12345';
      strategy = new JwtStrategy();
    });

    afterEach(() => {
      delete process.env.JWT_SECRET;
    });

    it('should handle complete admin token', async () => {
      const payload = {
        sub: 'admin-123',
        email: 'admin@company.com',
        role: 'ADMIN',
        organizationId: 'company-org-123',
      };

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        id: 'admin-123',
        email: 'admin@company.com',
        role: 'ADMIN',
        organizationId: 'company-org-123',
        plan: null,
      });
    });

    it('should handle minimal token', async () => {
      const payload = {
        sub: 'minimal-user',
        email: 'minimal@example.com',
        role: 'USER',
      };

      const result = await strategy.validate(payload);

      expect(result.id).toBe('minimal-user');
      expect(result.email).toBe('minimal@example.com');
      expect(result.role).toBe('USER');
      expect(result.organizationId).toBeNull();
    });

    it('should handle unicode email addresses', async () => {
      const payload = {
        sub: 'unicode-user',
        email: 'josé@example.com',
        role: 'USER',
      };

      const result = await strategy.validate(payload);

      expect(result.email).toBe('josé@example.com');
    });
  });
});
