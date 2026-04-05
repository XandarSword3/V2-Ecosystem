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
});
