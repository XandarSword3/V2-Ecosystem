import { describe, expect, it } from 'vitest';
import { resolveCorsOrigins } from '../../src/config/index';

describe('resolveCorsOrigins', () => {
  it('uses CORS_ORIGINS when provided', () => {
    const origins = resolveCorsOrigins({
      CORS_ORIGINS: 'https://v2-ecosystem.vercel.app, https://admin.v2-ecosystem.vercel.app'
    } as NodeJS.ProcessEnv);

    expect(origins).toEqual([
      'https://v2-ecosystem.vercel.app',
      'https://admin.v2-ecosystem.vercel.app',
    ]);
  });

  it('falls back to legacy CORS_ORIGIN', () => {
    const origins = resolveCorsOrigins({
      CORS_ORIGIN: 'https://v2-ecosystem.vercel.app'
    } as NodeJS.ProcessEnv);

    expect(origins).toEqual(['https://v2-ecosystem.vercel.app']);
  });

  it('falls back to FRONTEND_URL when no CORS variable is set', () => {
    const origins = resolveCorsOrigins({
      FRONTEND_URL: 'https://v2-ecosystem.vercel.app'
    } as NodeJS.ProcessEnv);

    expect(origins).toEqual(['https://v2-ecosystem.vercel.app']);
  });

  it('returns local defaults when no origin is configured', () => {
    const origins = resolveCorsOrigins({} as NodeJS.ProcessEnv);

    expect(origins).toEqual([
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3005',
    ]);
  });

  it('always includes production Vercel origin and preview pattern in production', () => {
    const origins = resolveCorsOrigins({ NODE_ENV: 'production' } as NodeJS.ProcessEnv);

    const strings = origins.filter((o): o is string => typeof o === 'string');
    const regexes = origins.filter((o): o is RegExp => o instanceof RegExp);

    expect(strings).toContain('https://v2-ecosystem.vercel.app');
    expect(regexes.length).toBeGreaterThan(0);
    expect(regexes.some(r => r.test('https://v2-ecosystem.vercel.app'))).toBe(true);
    expect(regexes.some(r => r.test('https://v2-ecosystem-abc123.vercel.app'))).toBe(true);
    // Must NOT match unrelated Vercel deployments
    expect(regexes.some(r => r.test('https://evil-site.vercel.app'))).toBe(false);
  });

  it('merges CORS_ORIGINS env var with production Vercel origins when NODE_ENV=production', () => {
    const origins = resolveCorsOrigins({
      NODE_ENV: 'production',
      CORS_ORIGINS: 'https://custom-domain.com',
    } as NodeJS.ProcessEnv);

    const strings = origins.filter((o): o is string => typeof o === 'string');
    expect(strings).toContain('https://custom-domain.com');
    expect(strings).toContain('https://v2-ecosystem.vercel.app');
  });
});
