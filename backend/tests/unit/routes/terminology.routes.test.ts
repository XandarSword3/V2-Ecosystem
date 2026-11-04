import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import terminologyRoutes from '../../../src/routes/terminology.routes.js';

vi.mock('../../../src/services/terminology.service.js', () => ({
  terminologyService: {
    getTerminology: vi.fn(),
    getAllOverrides: vi.fn(),
    updateTerminology: vi.fn(),
    bulkUpdateTerminology: vi.fn(),
  },
}));

import { terminologyService } from '../../../src/services/terminology.service.js';

describe('terminology.routes (Unit Tests)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET / should return terminology for business type and language', async () => {
    vi.mocked(terminologyService.getTerminology).mockResolvedValue({
      room: 'Chambre',
      booking: 'Réservation',
    } as any);

    const app = express();
    app.use('/terminology', terminologyRoutes);

    const res = await request(app)
      .get('/terminology')
      .query({ business_type: 'resort', language: 'fr' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({ room: 'Chambre', booking: 'Réservation' });
    expect(terminologyService.getTerminology).toHaveBeenCalledWith('resort', 'fr');
  });

  it('GET /admin should return overrides', async () => {
    vi.mocked(terminologyService.getAllOverrides).mockResolvedValue([
      { term_key: 'room', term_value: 'Villa', business_type: 'resort' },
    ] as any);

    const app = express();
    app.use('/terminology', terminologyRoutes);

    const res = await request(app)
      .get('/terminology/admin')
      .query({ business_type: 'resort' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(terminologyService.getAllOverrides).toHaveBeenCalledWith('resort');
  });

  it('POST / should update single terminology term and reject missing fields', async () => {
    vi.mocked(terminologyService.updateTerminology).mockResolvedValue({ success: true } as any);

    const app = express();
    app.use(express.json());
    app.use('/terminology', terminologyRoutes);

    const badRes = await request(app)
      .post('/terminology')
      .send({ business_type: 'hotel' });
    expect(badRes.status).toBe(400);

    const okRes = await request(app)
      .post('/terminology')
      .send({
        business_type: 'hotel',
        term_key: 'unit',
        term_value: 'Suite',
        language: 'en',
      });
    expect(okRes.status).toBe(200);
    expect(terminologyService.updateTerminology).toHaveBeenCalledWith('hotel', 'unit', 'Suite', 'en');
  });

  it('POST /bulk should perform bulk update', async () => {
    vi.mocked(terminologyService.bulkUpdateTerminology).mockResolvedValue(undefined as any);

    const app = express();
    app.use(express.json());
    app.use('/terminology', terminologyRoutes);

    const res = await request(app)
      .post('/terminology/bulk')
      .send({
        business_type: 'hotel',
        language: 'en',
        updates: [{ term_key: 'room', term_value: 'Room' }],
      });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Terminology updated successfully');
  });
});
