// File: backend/tests/ai-agent.integration.test.ts
import request from 'supertest';
import app from '../src/app';

describe('AI Agent Interaction Tests', () => {
    const API_V1 = '/api/v1';

    it('should allow an agent to discover the API terminology', async () => {
        const response = await request(app)
            .get(`${API_V1}/terminology?business_type=hotel`)
            .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.unit_singular).toBe('Room');
    });

    it('should allow an agent to fetch the OpenAPI specification', async () => {
        const response = await request(app)
            .get('/api/docs/spec.json')
            .expect(200);

        expect(response.body.openapi).toBe('3.0.3');
        expect(response.body.info.title).toMatch(/Management API/i);
    });

    it('should allow an agent to use generic unit endpoints', async () => {
        // This assumes the DB is migrated and seeded
        const response = await request(app)
            .get(`${API_V1}/units`)
            .expect(200);

        expect(response.body.success).toBe(true);
        // expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should require auth for module paths (not return legacy 410)', async () => {
        const response = await request(app)
            .get(`${API_V1}/chalets`)
            .expect(401);

        expect(response.body.success).toBe(false);
    });
});
