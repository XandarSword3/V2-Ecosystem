import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
  generateLayout,
  generateAltText,
} from '../../../../src/modules/admin/controllers/ai.controller.js';
import { AIFeatureNotConfiguredError } from '../../../../src/ai/providers/disabled-ai-provider.js';

vi.mock('../../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(),
}));

const mockGenerateLayoutDraft = vi.fn();
const mockGenerateAltText = vi.fn();

vi.mock('../../../../src/ai/ai-provider.factory.js', () => ({
  getAIProvider: vi.fn(() => ({
    generateLayoutDraft: mockGenerateLayoutDraft,
    generateAltText: mockGenerateAltText,
  })),
}));

import { getSupabase } from '../../../../src/database/connection.js';
import { createChainableMock } from '../../utils.js';

describe('AIController (Unit Tests)', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.post('/admin/ai/generate-layout', generateLayout);
    app.post('/admin/ai/generate-alt-text', generateAltText);
  });

  describe('generateLayout', () => {
    it('should reject requests missing prompt with 400', async () => {
      const res = await request(app).post('/admin/ai/generate-layout').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Prompt parameter is required');
    });

    it('should generate layout draft and write audit log hash', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'ai_generation_requests') {
            const chain = createChainableMock(null);
            chain.insert = mockInsert;
            return chain;
          }
          return createChainableMock(null);
        }),
      } as any);

      mockGenerateLayoutDraft.mockResolvedValue({
        components: [{ type: 'hero_banner', title: 'Welcome' }],
      });

      const res = await request(app)
        .post('/admin/ai/generate-layout')
        .send({
          prompt: 'Create a modern resort landing page',
          context: { tenantId: 'tenant-1', propertyId: 'prop-1' },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.components).toHaveLength(1);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: 'tenant-1',
          property_id: 'prop-1',
          request_type: 'layout_draft',
          prompt_hash: expect.any(String),
        })
      );
    });

    it('should return 503 AI_FEATURE_DISABLED when AI provider is not configured', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn(() => createChainableMock(null)),
      } as any);

      mockGenerateLayoutDraft.mockRejectedValue(
        new AIFeatureNotConfiguredError('AI key not set')
      );

      const res = await request(app)
        .post('/admin/ai/generate-layout')
        .send({ prompt: 'Generate layout' });

      expect(res.status).toBe(503);
      expect(res.body.code).toBe('AI_FEATURE_DISABLED');
    });
  });

  describe('generateAltText', () => {
    it('should reject missing imageUrl with 400', async () => {
      const res = await request(app).post('/admin/ai/generate-alt-text').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('imageUrl parameter is required');
    });

    it('should generate alt text and record audit log', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn(() => {
          const chain = createChainableMock(null);
          chain.insert = mockInsert;
          return chain;
        }),
      } as any);

      mockGenerateAltText.mockResolvedValue('A serene infinity pool overlooking mountains');

      const res = await request(app)
        .post('/admin/ai/generate-alt-text')
        .send({ imageUrl: 'https://example.com/pool.jpg' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.altText).toBe('A serene infinity pool overlooking mountains');
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should return 503 when AI feature is disabled', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn(() => createChainableMock(null)),
      } as any);

      mockGenerateAltText.mockRejectedValue(
        new AIFeatureNotConfiguredError('Provider disabled')
      );

      const res = await request(app)
        .post('/admin/ai/generate-alt-text')
        .send({ imageUrl: 'https://example.com/pool.jpg' });

      expect(res.status).toBe(503);
      expect(res.body.code).toBe('AI_FEATURE_DISABLED');
    });
  });
});
