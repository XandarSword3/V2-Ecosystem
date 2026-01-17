/**
 * Document Service
 *
 * Handles document management including upload, versioning, and access control.
 */

import type {
  Container,
  Document,
  DocumentVersion,
  DocumentType,
  DocumentStatus,
  DocumentVisibility,
  DocumentFilters,
} from '../container/types.js';

// Document types and statuses
const DOCUMENT_TYPES: DocumentType[] = [
  'contract',
  'invoice',
  'receipt',
  'id_document',
  'reservation_confirmation',
  'report',
  'policy',
  'image',
  'other',
];

const DOCUMENT_STATUSES: DocumentStatus[] = [
  'pending',
  'approved',
  'rejected',
  'expired',
  'archived',
];

const DOCUMENT_VISIBILITIES: DocumentVisibility[] = [
  'public',
  'private',
  'internal',
  'guest_only',
];

// MIME type to document type mapping
const MIME_TYPE_MAP: Record<string, DocumentType> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'application/pdf': 'other',
  'application/msword': 'other',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'other',
  'application/vnd.ms-excel': 'other',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'other',
};

// Custom error class
export class DocumentServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'DocumentServiceError';
  }
}

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface UploadDocumentInput {
  name: string;
  originalName: string;
  type?: DocumentType;
  visibility?: DocumentVisibility;
  mimeType: string;
  size: number;
  path: string;
  description?: string;
  tags?: string[];
  relatedEntityType?: string;
  relatedEntityId?: string;
  uploadedBy: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateDocumentInput {
  name?: string;
  description?: string;
  tags?: string[];
  visibility?: DocumentVisibility;
  expiresAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CreateVersionInput {
  documentId: string;
  path: string;
  size: number;
  changes?: string;
  createdBy: string;
}

export interface DocumentStats {
  total: number;
  byType: Record<DocumentType, number>;
  byStatus: Record<DocumentStatus, number>;
  totalSize: number;
  pendingApproval: number;
  expiringThisMonth: number;
}

export function createDocumentService(container: Container) {
  const { documentRepository, logger } = container;

  // ============================================
  // VALIDATION HELPERS
  // ============================================
  function validateId(id: string, field: string = 'ID'): void {
    if (!UUID_REGEX.test(id)) {
      throw new DocumentServiceError(`Invalid ${field} format`, 'INVALID_ID');
    }
  }

  async function getDocumentOrThrow(id: string): Promise<Document> {
    validateId(id);
    const doc = await documentRepository.getById(id);
    if (!doc) {
      throw new DocumentServiceError('Document not found', 'NOT_FOUND', 404);
    }
    return doc;
  }

  function inferDocumentType(mimeType: string): DocumentType {
    return MIME_TYPE_MAP[mimeType] || 'other';
  }

  // ============================================
  // DOCUMENT MANAGEMENT
  // ============================================
  async function uploadDocument(input: UploadDocumentInput): Promise<Document> {
    // Validate name
    if (!input.name || input.name.trim().length === 0) {
      throw new DocumentServiceError('Document name is required', 'INVALID_NAME');
    }

    // Validate original name
    if (!input.originalName || input.originalName.trim().length === 0) {
      throw new DocumentServiceError('Original file name is required', 'INVALID_ORIGINAL_NAME');
    }

    // Validate mime type
    if (!input.mimeType || input.mimeType.trim().length === 0) {
      throw new DocumentServiceError('MIME type is required', 'INVALID_MIME_TYPE');
    }

    // Validate size
    if (input.size <= 0) {
      throw new DocumentServiceError('File size must be positive', 'INVALID_SIZE');
    }

    // Validate path
    if (!input.path || input.path.trim().length === 0) {
      throw new DocumentServiceError('File path is required', 'INVALID_PATH');
    }

    // Check for duplicate path
    const existing = await documentRepository.getByPath(input.path);
    if (existing) {
      throw new DocumentServiceError('File path already exists', 'DUPLICATE_PATH');
    }

    // Validate uploader ID
    validateId(input.uploadedBy, 'uploader ID');

    // Validate type if provided
    const type = input.type || inferDocumentType(input.mimeType);
    if (!DOCUMENT_TYPES.includes(type)) {
      throw new DocumentServiceError('Invalid document type', 'INVALID_TYPE');
    }

    // Validate visibility if provided
    const visibility = input.visibility || 'private';
    if (!DOCUMENT_VISIBILITIES.includes(visibility)) {
      throw new DocumentServiceError('Invalid visibility', 'INVALID_VISIBILITY');
    }

    // Validate related entity if provided
    if (input.relatedEntityId) {
      validateId(input.relatedEntityId, 'related entity ID');
    }

    // Validate expiry date if provided
    if (input.expiresAt) {
      const expiresDate = new Date(input.expiresAt);
      if (isNaN(expiresDate.getTime())) {
        throw new DocumentServiceError('Invalid expiry date', 'INVALID_EXPIRY_DATE');
      }
    }

    const doc = await documentRepository.create({
      name: input.name.trim(),
      originalName: input.originalName.trim(),
      type,
      status: 'pending',
      visibility,
      mimeType: input.mimeType,
      size: input.size,
      path: input.path,
      url: null,
      description: input.description?.trim() || null,
      tags: input.tags || [],
      relatedEntityType: input.relatedEntityType || null,
      relatedEntityId: input.relatedEntityId || null,
      uploadedBy: input.uploadedBy,
      approvedBy: null,
      approvedAt: null,
      expiresAt: input.expiresAt || null,
      metadata: input.metadata || {},
    });

    logger?.info?.(`Document uploaded: ${doc.name} (${doc.id})`);
    return doc;
  }

  async function getDocument(id: string): Promise<Document | null> {
    validateId(id);
    return documentRepository.getById(id);
  }

  async function getDocumentByPath(path: string): Promise<Document | null> {
    if (!path || path.trim().length === 0) {
      throw new DocumentServiceError('Path is required', 'INVALID_PATH');
    }
    return documentRepository.getByPath(path);
  }

  async function updateDocument(id: string, input: UpdateDocumentInput): Promise<Document> {
    const doc = await getDocumentOrThrow(id);

    const updates: Partial<Document> = {};

    if (input.name !== undefined) {
      if (input.name.trim().length === 0) {
        throw new DocumentServiceError('Document name cannot be empty', 'INVALID_NAME');
      }
      updates.name = input.name.trim();
    }

    if (input.description !== undefined) {
      updates.description = input.description?.trim() || null;
    }

    if (input.tags !== undefined) {
      updates.tags = input.tags;
    }

    if (input.visibility !== undefined) {
      if (!DOCUMENT_VISIBILITIES.includes(input.visibility)) {
        throw new DocumentServiceError('Invalid visibility', 'INVALID_VISIBILITY');
      }
      updates.visibility = input.visibility;
    }

    if (input.expiresAt !== undefined) {
      if (input.expiresAt !== null) {
        const expiresDate = new Date(input.expiresAt);
        if (isNaN(expiresDate.getTime())) {
          throw new DocumentServiceError('Invalid expiry date', 'INVALID_EXPIRY_DATE');
        }
      }
      updates.expiresAt = input.expiresAt;
    }

    if (input.metadata !== undefined) {
      updates.metadata = input.metadata;
    }

    if (Object.keys(updates).length === 0) {
      return doc;
    }

    const updated = await documentRepository.update(id, updates);
    logger?.info?.(`Document updated: ${updated.name} (${updated.id})`);
    return updated;
  }

  async function deleteDocument(id: string): Promise<void> {
    const doc = await getDocumentOrThrow(id);

    // Cannot delete approved documents
    if (doc.status === 'approved') {
      throw new DocumentServiceError(
        'Cannot delete approved documents',
        'CANNOT_DELETE_APPROVED'
      );
    }

    await documentRepository.delete(id);
    logger?.info?.(`Document deleted: ${doc.name} (${id})`);
  }

  async function listDocuments(filters?: DocumentFilters): Promise<Document[]> {
    return documentRepository.list(filters);
  }

  async function getDocumentsForEntity(
    entityType: string,
    entityId: string
  ): Promise<Document[]> {
    validateId(entityId, 'entity ID');
    return documentRepository.getByRelatedEntity(entityType, entityId);
  }

  // ============================================
  // APPROVAL WORKFLOW
  // ============================================
  async function approveDocument(id: string, approverId: string): Promise<Document> {
    const doc = await getDocumentOrThrow(id);
    validateId(approverId, 'approver ID');

    if (doc.status !== 'pending') {
      throw new DocumentServiceError(
        'Only pending documents can be approved',
        'INVALID_STATUS'
      );
    }

    const updated = await documentRepository.update(id, {
      status: 'approved',
      approvedBy: approverId,
      approvedAt: new Date().toISOString(),
    });

    logger?.info?.(`Document approved: ${updated.name} by ${approverId}`);
    return updated;
  }

  async function rejectDocument(id: string, reason?: string): Promise<Document> {
    const doc = await getDocumentOrThrow(id);

    if (doc.status !== 'pending') {
      throw new DocumentServiceError(
        'Only pending documents can be rejected',
        'INVALID_STATUS'
      );
    }

    const metadata = {
      ...doc.metadata,
      rejectionReason: reason || null,
      rejectedAt: new Date().toISOString(),
    };

    const updated = await documentRepository.update(id, {
      status: 'rejected',
      metadata,
    });

    logger?.info?.(`Document rejected: ${updated.name}`);
    return updated;
  }

  async function archiveDocument(id: string): Promise<Document> {
    const doc = await getDocumentOrThrow(id);

    if (doc.status === 'archived') {
      throw new DocumentServiceError('Document is already archived', 'ALREADY_ARCHIVED');
    }

    const updated = await documentRepository.update(id, { status: 'archived' });
    logger?.info?.(`Document archived: ${updated.name}`);
    return updated;
  }

  async function markAsExpired(id: string): Promise<Document> {
    const doc = await getDocumentOrThrow(id);

    if (doc.status === 'expired') {
      throw new DocumentServiceError('Document is already expired', 'ALREADY_EXPIRED');
    }

    const updated = await documentRepository.update(id, { status: 'expired' });
    logger?.info?.(`Document marked as expired: ${updated.name}`);
    return updated;
  }

  // ============================================
  // VERSIONING
  // ============================================
  async function createVersion(input: CreateVersionInput): Promise<DocumentVersion> {
    const doc = await getDocumentOrThrow(input.documentId);
    validateId(input.createdBy, 'creator ID');

    if (!input.path || input.path.trim().length === 0) {
      throw new DocumentServiceError('Version path is required', 'INVALID_PATH');
    }

    if (input.size <= 0) {
      throw new DocumentServiceError('Version size must be positive', 'INVALID_SIZE');
    }

    // Get latest version to determine next version number
    const latestVersion = await documentRepository.getLatestVersion(input.documentId);
    const nextVersionNumber = latestVersion ? latestVersion.version + 1 : 1;

    const version = await documentRepository.createVersion({
      documentId: input.documentId,
      version: nextVersionNumber,
      path: input.path,
      size: input.size,
      changes: input.changes || null,
      createdBy: input.createdBy,
      createdAt: new Date().toISOString(),
    });

    // Update document with new path and size
    await documentRepository.update(input.documentId, {
      path: input.path,
      size: input.size,
    });

    logger?.info?.(`Document version ${nextVersionNumber} created for ${doc.name}`);
    return version;
  }

  async function getVersions(documentId: string): Promise<DocumentVersion[]> {
    await getDocumentOrThrow(documentId);
    return documentRepository.getVersions(documentId);
  }

  async function getLatestVersion(documentId: string): Promise<DocumentVersion | null> {
    await getDocumentOrThrow(documentId);
    return documentRepository.getLatestVersion(documentId);
  }

  // ============================================
  // ACCESS CONTROL
  // ============================================
  async function setVisibility(
    id: string,
    visibility: DocumentVisibility
  ): Promise<Document> {
    const doc = await getDocumentOrThrow(id);

    if (!DOCUMENT_VISIBILITIES.includes(visibility)) {
      throw new DocumentServiceError('Invalid visibility', 'INVALID_VISIBILITY');
    }

    if (doc.visibility === visibility) {
      return doc;
    }

    const updated = await documentRepository.update(id, { visibility });
    logger?.info?.(`Document visibility changed: ${updated.name} -> ${visibility}`);
    return updated;
  }

  async function setUrl(id: string, url: string): Promise<Document> {
    const doc = await getDocumentOrThrow(id);

    if (!url || url.trim().length === 0) {
      throw new DocumentServiceError('URL is required', 'INVALID_URL');
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      throw new DocumentServiceError('Invalid URL format', 'INVALID_URL_FORMAT');
    }

    const updated = await documentRepository.update(id, { url });
    logger?.info?.(`Document URL set: ${updated.name}`);
    return updated;
  }

  // ============================================
  // TAGGING
  // ============================================
  async function addTags(id: string, tags: string[]): Promise<Document> {
    const doc = await getDocumentOrThrow(id);

    if (!tags || tags.length === 0) {
      return doc;
    }

    const normalizedTags = tags.map(t => t.trim().toLowerCase()).filter(t => t.length > 0);
    const currentTags = new Set(doc.tags);
    normalizedTags.forEach(t => currentTags.add(t));

    const updated = await documentRepository.update(id, { tags: Array.from(currentTags) });
    logger?.info?.(`Tags added to document: ${updated.name}`);
    return updated;
  }

  async function removeTags(id: string, tags: string[]): Promise<Document> {
    const doc = await getDocumentOrThrow(id);

    if (!tags || tags.length === 0) {
      return doc;
    }

    const normalizedTags = new Set(tags.map(t => t.trim().toLowerCase()));
    const remaining = doc.tags.filter(t => !normalizedTags.has(t));

    const updated = await documentRepository.update(id, { tags: remaining });
    logger?.info?.(`Tags removed from document: ${updated.name}`);
    return updated;
  }

  // ============================================
  // LINKING
  // ============================================
  async function linkToEntity(
    id: string,
    entityType: string,
    entityId: string
  ): Promise<Document> {
    const doc = await getDocumentOrThrow(id);
    validateId(entityId, 'entity ID');

    if (!entityType || entityType.trim().length === 0) {
      throw new DocumentServiceError('Entity type is required', 'INVALID_ENTITY_TYPE');
    }

    const updated = await documentRepository.update(id, {
      relatedEntityType: entityType.trim(),
      relatedEntityId: entityId,
    });

    logger?.info?.(`Document linked to ${entityType}: ${updated.name}`);
    return updated;
  }

  async function unlinkFromEntity(id: string): Promise<Document> {
    const doc = await getDocumentOrThrow(id);

    if (!doc.relatedEntityType && !doc.relatedEntityId) {
      return doc;
    }

    const updated = await documentRepository.update(id, {
      relatedEntityType: null,
      relatedEntityId: null,
    });

    logger?.info?.(`Document unlinked from entity: ${updated.name}`);
    return updated;
  }

  // ============================================
  // EXPIRY MANAGEMENT
  // ============================================
  async function setExpiry(id: string, expiresAt: string): Promise<Document> {
    const doc = await getDocumentOrThrow(id);

    const expiryDate = new Date(expiresAt);
    if (isNaN(expiryDate.getTime())) {
      throw new DocumentServiceError('Invalid expiry date', 'INVALID_EXPIRY_DATE');
    }

    if (expiryDate <= new Date()) {
      throw new DocumentServiceError('Expiry date must be in the future', 'EXPIRY_IN_PAST');
    }

    const updated = await documentRepository.update(id, { expiresAt });
    logger?.info?.(`Document expiry set: ${updated.name} -> ${expiresAt}`);
    return updated;
  }

  async function clearExpiry(id: string): Promise<Document> {
    const doc = await getDocumentOrThrow(id);

    if (!doc.expiresAt) {
      return doc;
    }

    const updated = await documentRepository.update(id, { expiresAt: null });
    logger?.info?.(`Document expiry cleared: ${updated.name}`);
    return updated;
  }

  async function getExpiringDocuments(withinDays: number = 30): Promise<Document[]> {
    const allDocs = await documentRepository.list({ status: 'approved' });
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + withinDays);
    const now = new Date();

    return allDocs.filter(doc => {
      if (!doc.expiresAt) return false;
      const expiryDate = new Date(doc.expiresAt);
      return expiryDate > now && expiryDate <= cutoff;
    });
  }

  // ============================================
  // STATISTICS
  // ============================================
  async function getStats(): Promise<DocumentStats> {
    const all = await documentRepository.list();

    const byType: Record<DocumentType, number> = {} as Record<DocumentType, number>;
    DOCUMENT_TYPES.forEach(t => byType[t] = 0);

    const byStatus: Record<DocumentStatus, number> = {} as Record<DocumentStatus, number>;
    DOCUMENT_STATUSES.forEach(s => byStatus[s] = 0);

    let totalSize = 0;
    let pendingApproval = 0;
    let expiringThisMonth = 0;

    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    for (const doc of all) {
      byType[doc.type]++;
      byStatus[doc.status]++;
      totalSize += doc.size;

      if (doc.status === 'pending') {
        pendingApproval++;
      }

      if (doc.expiresAt) {
        const expiryDate = new Date(doc.expiresAt);
        if (expiryDate > now && expiryDate <= endOfMonth) {
          expiringThisMonth++;
        }
      }
    }

    return {
      total: all.length,
      byType,
      byStatus,
      totalSize,
      pendingApproval,
      expiringThisMonth,
    };
  }

  // ============================================
  // SEARCH
  // ============================================
  async function searchDocuments(query: string): Promise<Document[]> {
    if (!query || query.trim().length < 2) {
      throw new DocumentServiceError(
        'Search query must be at least 2 characters',
        'QUERY_TOO_SHORT'
      );
    }

    return documentRepository.list({ search: query.trim() });
  }

  async function getDocumentsByTags(tags: string[]): Promise<Document[]> {
    if (!tags || tags.length === 0) {
      throw new DocumentServiceError('At least one tag is required', 'NO_TAGS');
    }

    return documentRepository.list({ tags });
  }

  // ============================================
  // UTILITY METHODS
  // ============================================
  function getDocumentTypes(): DocumentType[] {
    return [...DOCUMENT_TYPES];
  }

  function getDocumentStatuses(): DocumentStatus[] {
    return [...DOCUMENT_STATUSES];
  }

  function getVisibilityOptions(): DocumentVisibility[] {
    return [...DOCUMENT_VISIBILITIES];
  }

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  return {
    // Document management
    uploadDocument,
    getDocument,
    getDocumentByPath,
    updateDocument,
    deleteDocument,
    listDocuments,
    getDocumentsForEntity,

    // Approval workflow
    approveDocument,
    rejectDocument,
    archiveDocument,
    markAsExpired,

    // Versioning
    createVersion,
    getVersions,
    getLatestVersion,

    // Access control
    setVisibility,
    setUrl,

    // Tagging
    addTags,
    removeTags,

    // Linking
    linkToEntity,
    unlinkFromEntity,

    // Expiry management
    setExpiry,
    clearExpiry,
    getExpiringDocuments,

    // Statistics
    getStats,

    // Search
    searchDocuments,
    getDocumentsByTags,

    // Utility
    getDocumentTypes,
    getDocumentStatuses,
    getVisibilityOptions,
    formatFileSize,
  };
}

export type DocumentService = ReturnType<typeof createDocumentService>;
