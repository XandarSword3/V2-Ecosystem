import { describe, it, expect } from 'vitest';

// Import the actual config from source
import { config } from '../../src/config/index';

describe('Config Module (Source)', () => {
  describe('config object structure', () => {
    it('should have env property', () => {
      expect(config).toHaveProperty('env');
      expect(typeof config.env).toBe('string');
    });

    it('should have port property as number', () => {
      expect(config).toHaveProperty('port');
      expect(typeof config.port).toBe('number');
    });

    it('should have apiUrl property', () => {
      expect(config).toHaveProperty('apiUrl');
      expect(typeof config.apiUrl).toBe('string');
    });

    it('should have frontendUrl property', () => {
      expect(config).toHaveProperty('frontendUrl');
      expect(typeof config.frontendUrl).toBe('string');
    });
  });

  describe('database config', () => {
    it('should have database property', () => {
      expect(config).toHaveProperty('database');
    });

    it('should have database.url as string', () => {
      expect(config.database).toHaveProperty('url');
      expect(typeof config.database.url).toBe('string');
    });
  });

  describe('supabase config', () => {
    it('should have supabase property', () => {
      expect(config).toHaveProperty('supabase');
    });

    it('should have supabase.url as string', () => {
      expect(config.supabase).toHaveProperty('url');
      expect(typeof config.supabase.url).toBe('string');
    });

    it('should have supabase.anonKey', () => {
      expect(config.supabase).toHaveProperty('anonKey');
      expect(typeof config.supabase.anonKey).toBe('string');
    });

    it('should have supabase.serviceKey', () => {
      expect(config.supabase).toHaveProperty('serviceKey');
      expect(typeof config.supabase.serviceKey).toBe('string');
    });
  });

  describe('jwt config', () => {
    it('should have jwt property', () => {
      expect(config).toHaveProperty('jwt');
    });

    it('should have jwt.secret as string', () => {
      expect(config.jwt).toHaveProperty('secret');
      expect(typeof config.jwt.secret).toBe('string');
    });

    it('should have jwt.refreshSecret as string', () => {
      expect(config.jwt).toHaveProperty('refreshSecret');
      expect(typeof config.jwt.refreshSecret).toBe('string');
    });

    it('should have jwt.expiresIn as string', () => {
      expect(config.jwt).toHaveProperty('expiresIn');
      expect(typeof config.jwt.expiresIn).toBe('string');
    });

    it('should have jwt.refreshExpiresIn as string', () => {
      expect(config.jwt).toHaveProperty('refreshExpiresIn');
      expect(typeof config.jwt.refreshExpiresIn).toBe('string');
    });
  });

  describe('stripe config', () => {
    it('should have stripe property', () => {
      expect(config).toHaveProperty('stripe');
    });

    it('should have stripe.secretKey as string', () => {
      expect(config.stripe).toHaveProperty('secretKey');
      expect(typeof config.stripe.secretKey).toBe('string');
    });

    it('should have stripe.webhookSecret as string', () => {
      expect(config.stripe).toHaveProperty('webhookSecret');
      expect(typeof config.stripe.webhookSecret).toBe('string');
    });
  });

  describe('email config', () => {
    it('should have email property', () => {
      expect(config).toHaveProperty('email');
    });

    it('should have email.host as string', () => {
      expect(config.email).toHaveProperty('host');
      expect(typeof config.email.host).toBe('string');
    });

    it('should have email.port as number', () => {
      expect(config.email).toHaveProperty('port');
      expect(typeof config.email.port).toBe('number');
    });

    it('should have email.user as string', () => {
      expect(config.email).toHaveProperty('user');
      expect(typeof config.email.user).toBe('string');
    });

    it('should have email.pass as string', () => {
      expect(config.email).toHaveProperty('pass');
      expect(typeof config.email.pass).toBe('string');
    });

    it('should have email.from as string', () => {
      expect(config.email).toHaveProperty('from');
      expect(typeof config.email.from).toBe('string');
    });
  });

  describe('storage config', () => {
    it('should have storage property', () => {
      expect(config).toHaveProperty('storage');
    });

    it('should have storage.endpoint as string', () => {
      expect(config.storage).toHaveProperty('endpoint');
      expect(typeof config.storage.endpoint).toBe('string');
    });

    it('should have storage.bucket as string', () => {
      expect(config.storage).toHaveProperty('bucket');
      expect(typeof config.storage.bucket).toBe('string');
    });
  });

  describe('rateLimit config', () => {
    it('should have rateLimit property', () => {
      expect(config).toHaveProperty('rateLimit');
    });

    it('should have rateLimit.windowMs as number', () => {
      expect(config.rateLimit).toHaveProperty('windowMs');
      expect(typeof config.rateLimit.windowMs).toBe('number');
      expect(config.rateLimit.windowMs).toBeGreaterThan(0);
    });

    it('should have rateLimit.maxRequests as number', () => {
      expect(config.rateLimit).toHaveProperty('maxRequests');
      expect(typeof config.rateLimit.maxRequests).toBe('number');
      expect(config.rateLimit.maxRequests).toBeGreaterThan(0);
    });
  });

  describe('environment detection', () => {
    it('should have env set to test in test environment', () => {
      expect(config.env).toBe('test');
    });

    it('should have valid test JWT secret', () => {
      // In test env, should use the test secret
      expect(config.jwt.secret.length).toBeGreaterThanOrEqual(32);
    });
  });
});
