import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('🚀 API Smoke Tests', () => {
  it('GET /health returns 200 and healthy status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('GET /api/health returns 200 and healthy status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
  });

  it('GET /health/ready responds with a health status', async () => {
    const res = await request(app).get('/health/ready');
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('status');
  });

  it('blocks unauthenticated requests to protected endpoints without tenant', async () => {
    const res = await request(app).get('/api/v1/admin/modules');
    expect([401, 403, 404]).toContain(res.status);
  });
});
