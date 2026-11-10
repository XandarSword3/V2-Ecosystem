/**
 * Fiscal Controller Unit Tests
 *
 * The fiscal REST surface (`/api/v1/fiscal`) was mounted in app.ts on
 * 2026-11-10 after sitting unmounted since it was written. The *services*
 * were already engine-integrated (issue via order-status.service and the
 * payment refund path, RLS-proven against real DB) — these tests cover the
 * HTTP layer: tenant/property resolution guards, service delegation, status
 * codes, and the error contract (FiscalDocumentError).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(),
}));
vi.mock('../../../../src/security/tenant-scope.js', () => ({
  getCallerTenantId: vi.fn(),
}));
vi.mock('../../../../src/modules/fiscal/fiscal-profile.service.js', () => ({
  fiscalProfileService: {
    listProfiles: vi.fn(),
    createProfile: vi.fn(),
    updateProfile: vi.fn(),
  },
}));
vi.mock('../../../../src/modules/fiscal/fiscal-document.service.js', () => ({
  fiscalDocumentService: {
    issueForTransaction: vi.fn(),
    listDocuments: vi.fn(),
    getDocument: vi.fn(),
    cancelDocument: vi.fn(),
    recordSubmission: vi.fn(),
  },
  FiscalDocumentError: class FiscalDocumentError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = 'FiscalDocumentError';
    }
  },
}));
vi.mock('../../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  listProfiles,
  createProfile,
  updateProfile,
  issueDocument,
  listDocuments,
  getDocument,
  cancelDocument,
  submitDocument,
  STAFF_ROLES,
} from '../../../../src/modules/fiscal/fiscal.controller.js';
import { getCallerTenantId } from '../../../../src/security/tenant-scope.js';
import {
  fiscalProfileService,
} from '../../../../src/modules/fiscal/fiscal-profile.service.js';
import {
  fiscalDocumentService,
  FiscalDocumentError,
} from '../../../../src/modules/fiscal/fiscal-document.service.js';

const mockProfile = fiscalProfileService as {
  listProfiles: ReturnType<typeof vi.fn>;
  createProfile: ReturnType<typeof vi.fn>;
  updateProfile: ReturnType<typeof vi.fn>;
};
const mockDoc = fiscalDocumentService as {
  issueForTransaction: ReturnType<typeof vi.fn>;
  listDocuments: ReturnType<typeof vi.fn>;
  getDocument: ReturnType<typeof vi.fn>;
  cancelDocument: ReturnType<typeof vi.fn>;
  recordSubmission: ReturnType<typeof vi.fn>;
};

function makeRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  };
  return res as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

function tenantReq(overrides: Record<string, unknown> = {}, tenantId = 'tenant-1'): Request {
  vi.mocked(getCallerTenantId).mockReturnValue(tenantId);
  return {
    params: {},
    query: {},
    body: {},
    ...(overrides as Partial<Request>),
  } as unknown as Request;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Fiscal Controller', () => {
  describe('tenant guard', () => {
    it('throws TENANT_REQUIRED when no tenant is on the request', async () => {
      vi.mocked(getCallerTenantId).mockReturnValue(null);
      const res = makeRes();
      await expect(listProfiles({} as Request, res)).rejects.toMatchObject({
        code: 'TENANT_REQUIRED',
      });
      expect(mockProfile.listProfiles).not.toHaveBeenCalled();
    });
  });

  describe('profiles', () => {
    it('listProfiles delegates to the service with the caller tenant', async () => {
      mockProfile.listProfiles.mockResolvedValue([{ id: 'p1' }]);
      const res = makeRes();
      await listProfiles(tenantReq(), res);
      expect(mockProfile.listProfiles).toHaveBeenCalledWith('tenant-1');
      expect(res.json).toHaveBeenCalledWith({ success: true, data: [{ id: 'p1' }] });
    });

    it('createProfile returns 201 with the created profile', async () => {
      mockProfile.createProfile.mockResolvedValue({ id: 'p2', name: 'PT' });
      const req = tenantReq({ body: { country: 'US', name: 'PT' } });
      const res = makeRes();
      await createProfile(req, res);
      expect(mockProfile.createProfile).toHaveBeenCalledWith('tenant-1', { country: 'US', name: 'PT' });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: 'p2', name: 'PT' } });
    });

    it('updateProfile passes the route param id plus tenant', async () => {
      mockProfile.updateProfile.mockResolvedValue({ id: 'p1', series: 'B' });
      const req = tenantReq({ params: { id: 'p1' }, body: { series: 'B' } });
      const res = makeRes();
      await updateProfile(req, res);
      expect(mockProfile.updateProfile).toHaveBeenCalledWith('p1', 'tenant-1', { series: 'B' });
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: 'p1', series: 'B' } });
    });
  });

  describe('documents', () => {
    it('issueDocument rejects a missing transactionId with 400', async () => {
      const res = makeRes();
      await issueDocument(tenantReq({ body: {} }), res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'transactionId is required' });
      expect(mockDoc.issueForTransaction).not.toHaveBeenCalled();
    });

    it('issueDocument requires a validated property (PROPERTY_REQUIRED)', async () => {
      const res = makeRes();
      await expect(issueDocument(tenantReq({ body: { transactionId: 'tx-1' } }), res)).rejects.toMatchObject({
        code: 'PROPERTY_REQUIRED',
      });
      expect(mockDoc.issueForTransaction).not.toHaveBeenCalled();
    });

    it('issueDocument delegates with actor + property from the validated request', async () => {
      mockDoc.issueForTransaction.mockResolvedValue({ id: 'd1' });
      const req = tenantReq({
        body: { transactionId: 'tx-1', documentType: 'credit_note' },
        propertyId: 'prop-1',
        user: { userId: 'u-1' },
      });
      const res = makeRes();
      await issueDocument(req, res);
      expect(mockDoc.issueForTransaction).toHaveBeenCalledWith('tx-1', {
        tenantId: 'tenant-1',
        propertyId: 'prop-1',
        actorId: 'u-1',
        documentType: 'credit_note',
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: 'd1' } });
    });

    it('listDocuments forwards query filters (property/transaction/type)', async () => {
      mockDoc.listDocuments.mockResolvedValue([{ id: 'd2' }]);
      const req = tenantReq({
        query: { propertyId: 'prop-9', transactionId: 'tx-9', documentType: 'invoice' },
      });
      const res = makeRes();
      await listDocuments(req, res);
      expect(mockDoc.listDocuments).toHaveBeenCalledWith('tenant-1', {
        propertyId: 'prop-9',
        transactionId: 'tx-9',
        documentType: 'invoice',
      });
      expect(res.json).toHaveBeenCalledWith({ success: true, data: [{ id: 'd2' }] });
    });

    it('getDocument returns 404 when the service finds nothing', async () => {
      mockDoc.getDocument.mockResolvedValue(null);
      const req = tenantReq({ params: { id: 'nope' } });
      const res = makeRes();
      await getDocument(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Document not found' });
    });

    it('getDocument returns the document on success', async () => {
      mockDoc.getDocument.mockResolvedValue({ id: 'd3' });
      const req = tenantReq({ params: { id: 'd3' } });
      const res = makeRes();
      await getDocument(req, res);
      expect(mockDoc.getDocument).toHaveBeenCalledWith('d3', 'tenant-1');
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: 'd3' } });
    });

    it('cancelDocument builds a credit note and returns 201', async () => {
      mockDoc.cancelDocument.mockResolvedValue({ id: 'cn-1', document_type: 'credit_note' });
      const req = tenantReq({
        params: { id: 'd4' },
        body: { reason: 'refunded' },
        propertyId: 'prop-2',
        user: { userId: 'u-2' },
      });
      const res = makeRes();
      await cancelDocument(req, res);
      expect(mockDoc.cancelDocument).toHaveBeenCalledWith('d4', {
        tenantId: 'tenant-1',
        propertyId: 'prop-2',
        actorId: 'u-2',
        reason: 'refunded',
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: 'cn-1', document_type: 'credit_note' } });
    });

    it('submitDocument records an e-invoice submission for an existing document', async () => {
      mockDoc.getDocument.mockResolvedValue({ id: 'd5', metadata: { eInvoicingProvider: 'foobar' } });
      mockDoc.recordSubmission.mockResolvedValue('sub-77');
      const req = tenantReq({ params: { id: 'd5' }, body: {} });
      const res = makeRes();
      await submitDocument(req, res);
      expect(mockDoc.recordSubmission).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          fiscalDocumentId: 'd5',
          provider: 'foobar',
          status: 'submitted',
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { submissionId: 'sub-77' } });
    });

    it('submitDocument defaults to the manual provider when none is set', async () => {
      mockDoc.getDocument.mockResolvedValue({ id: 'd6', metadata: null });
      mockDoc.recordSubmission.mockResolvedValue('sub-78');
      const req = tenantReq({ params: { id: 'd6' }, body: {} });
      const res = makeRes();
      await submitDocument(req, res);
      expect(mockDoc.recordSubmission).toHaveBeenCalledWith(
        expect.objectContaining({ fiscalDocumentId: 'd6', provider: 'manual' })
      );
    });

    it('submitDocument returns 404 for an unknown document', async () => {
      mockDoc.getDocument.mockResolvedValue(null);
      const req = tenantReq({ params: { id: 'missing' }, body: {} });
      const res = makeRes();
      await submitDocument(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(mockDoc.recordSubmission).not.toHaveBeenCalled();
    });
  });

  describe('STAFF_ROLES', () => {
    it('includes non-admin staff roles for issue/list operations', () => {
      expect(STAFF_ROLES).toEqual(
        expect.arrayContaining(['staff', 'manager', 'admin', 'super_admin'])
      );
    });
  });

  describe('materials', () => {
    it('FiscalDocumentError exposes its code for the handler contract', () => {
      const err = new FiscalDocumentError('SOMETHING', 'boom');
      expect(err.code).toBe('SOMETHING');
      expect(err.message).toBe('boom');
    });
  });
});
