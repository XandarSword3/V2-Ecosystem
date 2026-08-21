import { Request, Response } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { getCallerTenantId } from '../../security/tenant-scope.js';
import { fiscalProfileService } from './fiscal-profile.service.js';
import { fiscalDocumentService, FiscalDocumentError } from './fiscal-document.service.js';
import { listJurisdictionAdapters } from './jurisdictions.js';
import { logger } from '../../utils/logger.js';

const STAFF_ROLES = ['staff', 'manager', 'admin', 'super_admin'];

function resolveTenant(req: Request): string {
  const tenantId = getCallerTenantId(req);
  if (!tenantId) {
    throw new FiscalDocumentError('TENANT_REQUIRED', 'Tenant could not be resolved from the request');
  }
  return tenantId;
}

function resolveProperty(req: Request, fallback?: string | null): string {
  const propertyId =
    (req as any).propertyId ||
    req.body?.propertyId ||
    req.headers?.['x-property-id'] ||
    fallback ||
    null;
  if (!propertyId) {
    throw new FiscalDocumentError('PROPERTY_REQUIRED', 'property_id is required');
  }
  return String(propertyId);
}

// ============================================================
// Profiles
// ============================================================

export const listProfiles = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = resolveTenant(req);
  const profiles = await fiscalProfileService.listProfiles(tenantId);
  res.json({ success: true, data: profiles });
});

export const createProfile = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = resolveTenant(req);
  const profile = await fiscalProfileService.createProfile(tenantId, req.body ?? {});
  res.status(201).json({ success: true, data: profile });
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = resolveTenant(req);
  const profile = await fiscalProfileService.updateProfile(req.params.id, tenantId, req.body ?? {});
  res.json({ success: true, data: profile });
});

// ============================================================
// Documents
// ============================================================

export const issueDocument = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = resolveTenant(req);
  const transactionId = req.body?.transactionId;
  if (!transactionId) {
    res.status(400).json({ success: false, error: 'transactionId is required' });
    return;
  }
  const propertyId = resolveProperty(req);
  const document = await fiscalDocumentService.issueForTransaction(String(transactionId), {
    tenantId,
    propertyId,
    actorId: (req.user as any)?.userId ?? null,
    documentType: req.body?.documentType ?? 'invoice',
  });
  res.status(201).json({ success: true, data: document });
});

export const listDocuments = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = resolveTenant(req);
  const documents = await fiscalDocumentService.listDocuments(tenantId, {
    propertyId: typeof req.query.propertyId === 'string' ? req.query.propertyId : undefined,
    transactionId: typeof req.query.transactionId === 'string' ? req.query.transactionId : undefined,
    documentType: typeof req.query.documentType === 'string' ? req.query.documentType : undefined,
  });
  res.json({ success: true, data: documents });
});

export const getDocument = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = resolveTenant(req);
  const document = await fiscalDocumentService.getDocument(req.params.id, tenantId);
  if (!document) {
    res.status(404).json({ success: false, error: 'Document not found' });
    return;
  }
  res.json({ success: true, data: document });
});

export const cancelDocument = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = resolveTenant(req);
  const propertyId = resolveProperty(req);
  const creditNote = await fiscalDocumentService.cancelDocument(req.params.id, {
    tenantId,
    propertyId,
    actorId: (req.user as any)?.userId ?? null,
    reason: req.body?.reason,
  });
  res.status(201).json({ success: true, data: creditNote });
});

export const submitDocument = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = resolveTenant(req);
  const document = await fiscalDocumentService.getDocument(req.params.id, tenantId);
  if (!document) {
    res.status(404).json({ success: false, error: 'Document not found' });
    return;
  }
  const provider = req.body?.provider ?? document.metadata?.eInvoicingProvider ?? 'manual';
  const submissionId = await fiscalDocumentService.recordSubmission({
    tenantId,
    fiscalDocumentId: document.id,
    provider: String(provider),
    status: 'submitted',
    authorityResponse: { requestedAt: new Date().toISOString() },
  });
  logger.info('[Fiscal] E-invoice submission recorded', { documentId: document.id, submissionId });
  res.status(201).json({ success: true, data: { submissionId } });
});

// ============================================================
// Jurisdiction catalog
// ============================================================

export const listJurisdictions = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: listJurisdictionAdapters() });
});

export { STAFF_ROLES };
