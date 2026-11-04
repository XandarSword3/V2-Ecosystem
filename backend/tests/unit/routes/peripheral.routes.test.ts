import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import docsRoutes from '../../../src/routes/docs.routes.js';
import translationRoutes from '../../../src/routes/translation.routes.js';
import {
  generateUnsubscribeToken,
  generateUnsubscribeHeaders,
  verifyUnsubscribeToken,
  unsubscribeRouter,
} from '../../../src/routes/unsubscribe.routes.js';

vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
  })),
}));

vi.mock('../../../src/services/dynamic-translation.service.js', () => ({
  dynamicTranslationService: {
    getTranslations: vi.fn(),
    setTranslation: vi.fn(),
  },
}));

vi.mock('../../../src/services/notification-preferences.service.js', () => ({
  notificationPreferencesService: {
    handleUnsubscribe: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../src/utils/activityLogger.js', () => ({
  activityLogger: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

import { dynamicTranslationService } from '../../../src/services/dynamic-translation.service.js';
import { notificationPreferencesService } from '../../../src/services/notification-preferences.service.js';

describe('Peripheral Routes (Unit Tests)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('docs.routes', () => {
    it('GET /docs/spec.json should return the swagger json spec', async () => {
      const app = express();
      app.use('/docs', docsRoutes);

      const res = await request(app).get('/docs/spec.json');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/json');
    });
  });

  describe('translation.routes', () => {
    it('GET /translations should fetch translations for language and namespace', async () => {
      vi.mocked(dynamicTranslationService.getTranslations).mockResolvedValue({
        welcome: 'Bienvenue',
      } as any);

      const app = express();
      app.use('/translations', translationRoutes);

      const res = await request(app)
        .get('/translations')
        .query({ lang: 'fr', namespace: 'common' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({ welcome: 'Bienvenue' });
      expect(dynamicTranslationService.getTranslations).toHaveBeenCalledWith('fr', 'common');
    });

    it('GET /translations/:namespace should fetch translations using path param', async () => {
      vi.mocked(dynamicTranslationService.getTranslations).mockResolvedValue({
        login: 'Se connecter',
      } as any);

      const app = express();
      app.use('/translations', translationRoutes);

      const res = await request(app)
        .get('/translations/auth')
        .query({ lang: 'fr' });

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ login: 'Se connecter' });
      expect(dynamicTranslationService.getTranslations).toHaveBeenCalledWith('fr', 'auth');
    });

    it('POST /translations should update translation key', async () => {
      vi.mocked(dynamicTranslationService.setTranslation).mockResolvedValue(true);

      const app = express();
      app.use(express.json());
      app.use('/translations', translationRoutes);

      const res = await request(app).post('/translations').send({
        key: 'hero_title',
        language: 'es',
        value: 'Bienvenido',
        namespace: 'home',
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Translation updated');
      expect(dynamicTranslationService.setTranslation).toHaveBeenCalledWith(
        'hero_title',
        'es',
        'Bienvenido',
        'home'
      );
    });
  });

  describe('unsubscribe.routes & token helpers', () => {
    it('generateUnsubscribeToken and verifyUnsubscribeToken roundtrip', () => {
      const token = generateUnsubscribeToken('user-100', 'guest@example.com', 'promotional');
      expect(token).toBeDefined();

      const decoded = verifyUnsubscribeToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBe('user-100');
      expect(decoded?.email).toBe('guest@example.com');
      expect(decoded?.type).toBe('promotional');
    });

    it('generateUnsubscribeHeaders produces RFC one-click headers', () => {
      const headers = generateUnsubscribeHeaders('user-100', 'guest@example.com');
      expect(headers['List-Unsubscribe']).toContain('mailto:');
      expect(headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    });

    it('GET /unsubscribe renders HTML page for valid token and rejects invalid token', async () => {
      const app = express();
      app.use('/unsubscribe', unsubscribeRouter);

      const validToken = generateUnsubscribeToken('u-1', 'a@b.com', 'all');
      const validRes = await request(app).get('/unsubscribe').query({ token: validToken });
      expect(validRes.status).toBe(200);
      expect(validRes.text).toContain('Manage Your Emails');

      const invalidRes = await request(app).get('/unsubscribe').query({ token: 'bogus.jwt' });
      expect(invalidRes.status).toBe(400);
      expect(invalidRes.text).toContain('Invalid Unsubscribe Link');
    });

    it('POST /unsubscribe processes one-click and form unsubscribes', async () => {
      const app = express();
      app.use(express.json());
      app.use('/unsubscribe', unsubscribeRouter);

      const token = generateUnsubscribeToken('u-1', 'a@b.com', 'promotional');

      const res = await request(app).post('/unsubscribe').send({
        token,
        'List-Unsubscribe': 'One-Click',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(notificationPreferencesService.handleUnsubscribe).toHaveBeenCalledWith(
        'u-1',
        'promotional'
      );
    });

    it('GET /unsubscribe/preferences redirects to notification settings', async () => {
      const app = express();
      app.use('/unsubscribe', unsubscribeRouter);

      const token = generateUnsubscribeToken('u-1', 'a@b.com', 'all');
      const res = await request(app).get('/unsubscribe/preferences').query({ token });
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/settings/notifications');
    });
  });
});
