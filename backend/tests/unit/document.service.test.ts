/**
 * Document Service Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createDocumentService, DocumentServiceError } from '../../src/lib/services/document.service.js';
import { InMemoryDocumentRepository } from '../../src/lib/repositories/document.repository.memory.js';
import type { Container, DocumentType, DocumentStatus, DocumentVisibility } from '../../src/lib/container/types.js';

// Test constants
const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const VALID_UUID_2 = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const INVALID_UUID = 'not-a-valid-uuid';

describe('DocumentService', () => {
  let service: ReturnType<typeof createDocumentService>;
  let repository: InMemoryDocumentRepository;

  beforeEach(() => {
    repository = new InMemoryDocumentRepository();
    const container = {
      documentRepository: repository,
      logger: {
        info: () => {},
        error: () => {},
        warn: () => {},
        debug: () => {},
      },
    } as unknown as Container;
    service = createDocumentService(container);
  });

  // ============================================
  // UPLOAD DOCUMENT TESTS
  // ============================================
  describe('uploadDocument', () => {
    const validInput = {
      name: 'Test Document',
      originalName: 'test-document.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      path: '/documents/test-document.pdf',
      uploadedBy: VALID_UUID,
    };

    it('should upload document with required fields', async () => {
      const doc = await service.uploadDocument(validInput);

      expect(doc.id).toMatch(/^[0-9a-f-]{36}$/i);
      expect(doc.name).toBe('Test Document');
      expect(doc.originalName).toBe('test-document.pdf');
      expect(doc.mimeType).toBe('application/pdf');
      expect(doc.size).toBe(1024);
      expect(doc.status).toBe('pending');
      expect(doc.visibility).toBe('private');
      expect(doc.type).toBe('other');
    });

    it('should infer image type from mime type', async () => {
      const doc = await service.uploadDocument({
        ...validInput,
        originalName: 'photo.jpg',
        mimeType: 'image/jpeg',
        path: '/images/photo.jpg',
      });

      expect(doc.type).toBe('image');
    });

    it('should use explicit type over inferred', async () => {
      const doc = await service.uploadDocument({
        ...validInput,
        type: 'contract',
      });

      expect(doc.type).toBe('contract');
    });

    it('should set visibility', async () => {
      const doc = await service.uploadDocument({
        ...validInput,
        visibility: 'public',
        path: '/public/doc.pdf',
      });

      expect(doc.visibility).toBe('public');
    });

    it('should set optional fields', async () => {
      const doc = await service.uploadDocument({
        ...validInput,
        path: '/custom/doc.pdf',
        description: 'A test document',
        tags: ['test', 'important'],
        relatedEntityType: 'booking',
        relatedEntityId: VALID_UUID_2,
        expiresAt: '2026-12-31',
        metadata: { key: 'value' },
      });

      expect(doc.description).toBe('A test document');
      expect(doc.tags).toEqual(['test', 'important']);
      expect(doc.relatedEntityType).toBe('booking');
      expect(doc.relatedEntityId).toBe(VALID_UUID_2);
      expect(doc.expiresAt).toBe('2026-12-31');
      expect(doc.metadata).toEqual({ key: 'value' });
    });

    it('should reject empty name', async () => {
      await expect(
        service.uploadDocument({ ...validInput, name: '' })
      ).rejects.toMatchObject({ code: 'INVALID_NAME' });
    });

    it('should reject empty original name', async () => {
      await expect(
        service.uploadDocument({ ...validInput, originalName: '' })
      ).rejects.toMatchObject({ code: 'INVALID_ORIGINAL_NAME' });
    });

    it('should reject empty mime type', async () => {
      await expect(
        service.uploadDocument({ ...validInput, mimeType: '' })
      ).rejects.toMatchObject({ code: 'INVALID_MIME_TYPE' });
    });

    it('should reject non-positive size', async () => {
      await expect(
        service.uploadDocument({ ...validInput, size: 0 })
      ).rejects.toMatchObject({ code: 'INVALID_SIZE' });
    });

    it('should reject empty path', async () => {
      await expect(
        service.uploadDocument({ ...validInput, path: '' })
      ).rejects.toMatchObject({ code: 'INVALID_PATH' });
    });

    it('should reject duplicate path', async () => {
      await service.uploadDocument(validInput);
      await expect(
        service.uploadDocument(validInput)
      ).rejects.toMatchObject({ code: 'DUPLICATE_PATH' });
    });

    it('should reject invalid uploader ID', async () => {
      await expect(
        service.uploadDocument({ ...validInput, uploadedBy: INVALID_UUID, path: '/new/path.pdf' })
      ).rejects.toMatchObject({ code: 'INVALID_ID' });
    });

    it('should reject invalid type', async () => {
      await expect(
        service.uploadDocument({ ...validInput, type: 'invalid' as DocumentType, path: '/t/p.pdf' })
      ).rejects.toMatchObject({ code: 'INVALID_TYPE' });
    });

    it('should reject invalid visibility', async () => {
      await expect(
        service.uploadDocument({ ...validInput, visibility: 'invalid' as DocumentVisibility, path: '/t/v.pdf' })
      ).rejects.toMatchObject({ code: 'INVALID_VISIBILITY' });
    });

    it('should reject invalid related entity ID', async () => {
      await expect(
        service.uploadDocument({
          ...validInput,
          relatedEntityId: INVALID_UUID,
          path: '/t/r.pdf',
        })
      ).rejects.toMatchObject({ code: 'INVALID_ID' });
    });

    it('should reject invalid expiry date', async () => {
      await expect(
        service.uploadDocument({
          ...validInput,
          expiresAt: 'not-a-date',
          path: '/t/e.pdf',
        })
      ).rejects.toMatchObject({ code: 'INVALID_EXPIRY_DATE' });
    });
  });

  // ============================================
  // GET DOCUMENT TESTS
  // ============================================
  describe('getDocument', () => {
    it('should retrieve document by ID', async () => {
      const created = await service.uploadDocument({
        name: 'Doc',
        originalName: 'doc.pdf',
        mimeType: 'application/pdf',
        size: 100,
        path: '/docs/doc.pdf',
        uploadedBy: VALID_UUID,
      });

      const doc = await service.getDocument(created.id);
      expect(doc).toBeDefined();
      expect(doc?.name).toBe('Doc');
    });

    it('should return null for non-existent document', async () => {
      const doc = await service.getDocument(VALID_UUID);
      expect(doc).toBeNull();
    });

    it('should reject invalid ID format', async () => {
      await expect(
        service.getDocument(INVALID_UUID)
      ).rejects.toMatchObject({ code: 'INVALID_ID' });
    });
  });

  describe('getDocumentByPath', () => {
    it('should retrieve document by path', async () => {
      await service.uploadDocument({
        name: 'PathDoc',
        originalName: 'path.pdf',
        mimeType: 'application/pdf',
        size: 100,
        path: '/path/to/doc.pdf',
        uploadedBy: VALID_UUID,
      });

      const doc = await service.getDocumentByPath('/path/to/doc.pdf');
      expect(doc).toBeDefined();
      expect(doc?.name).toBe('PathDoc');
    });

    it('should reject empty path', async () => {
      await expect(
        service.getDocumentByPath('')
      ).rejects.toMatchObject({ code: 'INVALID_PATH' });
    });
  });

  // ============================================
  // UPDATE DOCUMENT TESTS
  // ============================================
  describe('updateDocument', () => {
    let docId: string;

    beforeEach(async () => {
      const doc = await service.uploadDocument({
        name: 'Original Name',
        originalName: 'original.pdf',
        mimeType: 'application/pdf',
        size: 500,
        path: '/update/test.pdf',
        uploadedBy: VALID_UUID,
      });
      docId = doc.id;
    });

    it('should update document name', async () => {
      const updated = await service.updateDocument(docId, { name: 'New Name' });
      expect(updated.name).toBe('New Name');
    });

    it('should update description', async () => {
      const updated = await service.updateDocument(docId, { description: 'New desc' });
      expect(updated.description).toBe('New desc');
    });

    it('should update tags', async () => {
      const updated = await service.updateDocument(docId, { tags: ['new', 'tags'] });
      expect(updated.tags).toEqual(['new', 'tags']);
    });

    it('should update visibility', async () => {
      const updated = await service.updateDocument(docId, { visibility: 'public' });
      expect(updated.visibility).toBe('public');
    });

    it('should reject empty name', async () => {
      await expect(
        service.updateDocument(docId, { name: '' })
      ).rejects.toMatchObject({ code: 'INVALID_NAME' });
    });

    it('should reject invalid visibility', async () => {
      await expect(
        service.updateDocument(docId, { visibility: 'invalid' as DocumentVisibility })
      ).rejects.toMatchObject({ code: 'INVALID_VISIBILITY' });
    });

    it('should reject invalid expiry date', async () => {
      await expect(
        service.updateDocument(docId, { expiresAt: 'not-a-date' })
      ).rejects.toMatchObject({ code: 'INVALID_EXPIRY_DATE' });
    });

    it('should return unchanged if no updates', async () => {
      const original = await service.getDocument(docId);
      const updated = await service.updateDocument(docId, {});
      expect(updated.name).toBe(original?.name);
    });
  });

  // ============================================
  // DELETE DOCUMENT TESTS
  // ============================================
  describe('deleteDocument', () => {
    it('should delete pending document', async () => {
      const doc = await service.uploadDocument({
        name: 'ToDelete',
        originalName: 'delete.pdf',
        mimeType: 'application/pdf',
        size: 100,
        path: '/delete/doc.pdf',
        uploadedBy: VALID_UUID,
      });

      await service.deleteDocument(doc.id);
      const deleted = await service.getDocument(doc.id);
      expect(deleted).toBeNull();
    });

    it('should reject deleting approved document', async () => {
      const doc = await service.uploadDocument({
        name: 'Approved',
        originalName: 'approved.pdf',
        mimeType: 'application/pdf',
        size: 100,
        path: '/approved/doc.pdf',
        uploadedBy: VALID_UUID,
      });
      await service.approveDocument(doc.id, VALID_UUID_2);

      await expect(
        service.deleteDocument(doc.id)
      ).rejects.toMatchObject({ code: 'CANNOT_DELETE_APPROVED' });
    });
  });

  // ============================================
  // APPROVAL WORKFLOW TESTS
  // ============================================
  describe('approveDocument', () => {
    let docId: string;

    beforeEach(async () => {
      const doc = await service.uploadDocument({
        name: 'PendingDoc',
        originalName: 'pending.pdf',
        mimeType: 'application/pdf',
        size: 100,
        path: '/approve/pending.pdf',
        uploadedBy: VALID_UUID,
      });
      docId = doc.id;
    });

    it('should approve pending document', async () => {
      const approved = await service.approveDocument(docId, VALID_UUID_2);

      expect(approved.status).toBe('approved');
      expect(approved.approvedBy).toBe(VALID_UUID_2);
      expect(approved.approvedAt).toBeDefined();
    });

    it('should reject non-pending document', async () => {
      await service.approveDocument(docId, VALID_UUID_2);

      await expect(
        service.approveDocument(docId, VALID_UUID_2)
      ).rejects.toMatchObject({ code: 'INVALID_STATUS' });
    });

    it('should reject invalid approver ID', async () => {
      await expect(
        service.approveDocument(docId, INVALID_UUID)
      ).rejects.toMatchObject({ code: 'INVALID_ID' });
    });
  });

  describe('rejectDocument', () => {
    it('should reject pending document', async () => {
      const doc = await service.uploadDocument({
        name: 'ToReject',
        originalName: 'reject.pdf',
        mimeType: 'application/pdf',
        size: 100,
        path: '/reject/doc.pdf',
        uploadedBy: VALID_UUID,
      });

      const rejected = await service.rejectDocument(doc.id, 'Not acceptable');
      expect(rejected.status).toBe('rejected');
      expect(rejected.metadata.rejectionReason).toBe('Not acceptable');
    });

    it('should reject non-pending document', async () => {
      const doc = await service.uploadDocument({
        name: 'Approved',
        originalName: 'approved.pdf',
        mimeType: 'application/pdf',
        size: 100,
        path: '/reject/approved.pdf',
        uploadedBy: VALID_UUID,
      });
      await service.approveDocument(doc.id, VALID_UUID_2);

      await expect(
        service.rejectDocument(doc.id)
      ).rejects.toMatchObject({ code: 'INVALID_STATUS' });
    });
  });

  describe('archiveDocument', () => {
    it('should archive document', async () => {
      const doc = await service.uploadDocument({
        name: 'ToArchive',
        originalName: 'archive.pdf',
        mimeType: 'application/pdf',
        size: 100,
        path: '/archive/doc.pdf',
        uploadedBy: VALID_UUID,
      });

      const archived = await service.archiveDocument(doc.id);
      expect(archived.status).toBe('archived');
    });

    it('should reject already archived', async () => {
      const doc = await service.uploadDocument({
        name: 'Archived',
        originalName: 'archived.pdf',
        mimeType: 'application/pdf',
        size: 100,
        path: '/archive/already.pdf',
        uploadedBy: VALID_UUID,
      });
      await service.archiveDocument(doc.id);

      await expect(
        service.archiveDocument(doc.id)
      ).rejects.toMatchObject({ code: 'ALREADY_ARCHIVED' });
    });
  });

  describe('markAsExpired', () => {
    it('should mark document as expired', async () => {
      const doc = await service.uploadDocument({
        name: 'ToExpire',
        originalName: 'expire.pdf',
        mimeType: 'application/pdf',
        size: 100,
        path: '/expire/doc.pdf',
        uploadedBy: VALID_UUID,
      });

      const expired = await service.markAsExpired(doc.id);
      expect(expired.status).toBe('expired');
    });

    it('should reject already expired', async () => {
      const doc = await service.uploadDocument({
        name: 'Expired',
        originalName: 'expired.pdf',
        mimeType: 'application/pdf',
        size: 100,
        path: '/expire/already.pdf',
        uploadedBy: VALID_UUID,
      });
      await service.markAsExpired(doc.id);

      await expect(
        service.markAsExpired(doc.id)
      ).rejects.toMatchObject({ code: 'ALREADY_EXPIRED' });
    });
  });

  // ============================================
  // VERSIONING TESTS
  // ============================================
  describe('createVersion', () => {
    let docId: string;

    beforeEach(async () => {
      const doc = await service.uploadDocument({
        name: 'VersionedDoc',
        originalName: 'versioned.pdf',
        mimeType: 'application/pdf',
        size: 1000,
        path: '/versions/v1.pdf',
        uploadedBy: VALID_UUID,
      });
      docId = doc.id;
    });

    it('should create first version', async () => {
      const version = await service.createVersion({
        documentId: docId,
        path: '/versions/v2.pdf',
        size: 1500,
        changes: 'Updated content',
        createdBy: VALID_UUID,
      });

      expect(version.version).toBe(1);
      expect(version.path).toBe('/versions/v2.pdf');
      expect(version.changes).toBe('Updated content');
    });

    it('should increment version number', async () => {
      await service.createVersion({
        documentId: docId,
        path: '/versions/v2.pdf',
        size: 1500,
        createdBy: VALID_UUID,
      });

      const v2 = await service.createVersion({
        documentId: docId,
        path: '/versions/v3.pdf',
        size: 2000,
        createdBy: VALID_UUID,
      });

      expect(v2.version).toBe(2);
    });

    it('should update document path on version', async () => {
      await service.createVersion({
        documentId: docId,
        path: '/versions/updated.pdf',
        size: 2000,
        createdBy: VALID_UUID,
      });

      const doc = await service.getDocument(docId);
      expect(doc?.path).toBe('/versions/updated.pdf');
      expect(doc?.size).toBe(2000);
    });

    it('should reject empty path', async () => {
      await expect(
        service.createVersion({
          documentId: docId,
          path: '',
          size: 1000,
          createdBy: VALID_UUID,
        })
      ).rejects.toMatchObject({ code: 'INVALID_PATH' });
    });

    it('should reject non-positive size', async () => {
      await expect(
        service.createVersion({
          documentId: docId,
          path: '/versions/new.pdf',
          size: 0,
          createdBy: VALID_UUID,
        })
      ).rejects.toMatchObject({ code: 'INVALID_SIZE' });
    });
  });

  describe('getVersions', () => {
    it('should get all versions sorted', async () => {
      const doc = await service.uploadDocument({
        name: 'MultiVersion',
        originalName: 'multi.pdf',
        mimeType: 'application/pdf',
        size: 1000,
        path: '/multi/v1.pdf',
        uploadedBy: VALID_UUID,
      });

      await service.createVersion({
        documentId: doc.id,
        path: '/multi/v2.pdf',
        size: 1500,
        createdBy: VALID_UUID,
      });
      await service.createVersion({
        documentId: doc.id,
        path: '/multi/v3.pdf',
        size: 2000,
        createdBy: VALID_UUID,
      });

      const versions = await service.getVersions(doc.id);
      expect(versions).toHaveLength(2);
      expect(versions[0].version).toBe(2); // Most recent first
      expect(versions[1].version).toBe(1);
    });
  });

  describe('getLatestVersion', () => {
    it('should get latest version', async () => {
      const doc = await service.uploadDocument({
        name: 'LatestVersion',
        originalName: 'latest.pdf',
        mimeType: 'application/pdf',
        size: 1000,
        path: '/latest/v1.pdf',
        uploadedBy: VALID_UUID,
      });

      await service.createVersion({
        documentId: doc.id,
        path: '/latest/v2.pdf',
        size: 1500,
        createdBy: VALID_UUID,
      });

      const latest = await service.getLatestVersion(doc.id);
      expect(latest?.version).toBe(1);
    });

    it('should return null if no versions', async () => {
      const doc = await service.uploadDocument({
        name: 'NoVersions',
        originalName: 'none.pdf',
        mimeType: 'application/pdf',
        size: 1000,
        path: '/none/v1.pdf',
        uploadedBy: VALID_UUID,
      });

      const latest = await service.getLatestVersion(doc.id);
      expect(latest).toBeNull();
    });
  });

  // ============================================
  // ACCESS CONTROL TESTS
  // ============================================
  describe('setVisibility', () => {
    it('should change visibility', async () => {
      const doc = await service.uploadDocument({
        name: 'VisibilityDoc',
        originalName: 'vis.pdf',
        mimeType: 'application/pdf',
        size: 100,
        path: '/visibility/doc.pdf',
        uploadedBy: VALID_UUID,
      });

      const updated = await service.setVisibility(doc.id, 'public');
      expect(updated.visibility).toBe('public');
    });

    it('should reject invalid visibility', async () => {
      const doc = await service.uploadDocument({
        name: 'InvalidVis',
        originalName: 'inv.pdf',
        mimeType: 'application/pdf',
        size: 100,
        path: '/visibility/inv.pdf',
        uploadedBy: VALID_UUID,
      });

      await expect(
        service.setVisibility(doc.id, 'invalid' as DocumentVisibility)
      ).rejects.toMatchObject({ code: 'INVALID_VISIBILITY' });
    });
  });

  describe('setUrl', () => {
    it('should set document URL', async () => {
      const doc = await service.uploadDocument({
        name: 'UrlDoc',
        originalName: 'url.pdf',
        mimeType: 'application/pdf',
        size: 100,
        path: '/url/doc.pdf',
        uploadedBy: VALID_UUID,
      });

      const updated = await service.setUrl(doc.id, 'https://example.com/doc.pdf');
      expect(updated.url).toBe('https://example.com/doc.pdf');
    });

    it('should reject empty URL', async () => {
      const doc = await service.uploadDocument({
        name: 'EmptyUrl',
        originalName: 'empty.pdf',
        mimeType: 'application/pdf',
        size: 100,
        path: '/url/empty.pdf',
        uploadedBy: VALID_UUID,
      });

      await expect(
        service.setUrl(doc.id, '')
      ).rejects.toMatchObject({ code: 'INVALID_URL' });
    });

    it('should reject invalid URL format', async () => {
      const doc = await service.uploadDocument({
        name: 'BadUrl',
        originalName: 'bad.pdf',
        mimeType: 'application/pdf',
        size: 100,
        path: '/url/bad.pdf',
        uploadedBy: VALID_UUID,
      });

      await expect(
        service.setUrl(doc.id, 'not-a-url')
      ).rejects.toMatchObject({ code: 'INVALID_URL_FORMAT' });
    });
  });

  // ============================================
  // TAGGING TESTS
  // ============================================
  describe('addTags', () => {
    it('should add tags', async () => {
      const doc = await service.uploadDocument({
        name: 'TagDoc',
        originalName: 'tag.pdf',
        mimeType: 'application/pdf',
        size: 100,
        path: '/tags/doc.pdf',
        uploadedBy: VALID_UUID,
        tags: ['existing'],
      });

      const updated = await service.addTags(doc.id, ['new', 'tags']);
      expect(updated.tags).toContain('existing');
      expect(updated.tags).toContain('new');
      expect(updated.tags).toContain('tags');
    });

    it('should not duplicate tags', async () => {
      const doc = await service.uploadDocument({
        name: 'DupeTags',
        originalName: 'dupe.pdf',
        mimeType: 'application/pdf',
        size: 100,
        path: '/tags/dupe.pdf',
        uploadedBy: VALID_UUID,
        tags: ['existing'],
      });

      const updated = await service.addTags(doc.id, ['existing', 'new']);
      const existingCount = updated.tags.filter(t => t === 'existing').length;
      expect(existingCount).toBe(1);
    });
  });

  describe('removeTags', () => {
    it('should remove tags', async () => {
      const doc = await service.uploadDocument({
        name: 'RemoveTags',
        originalName: 'remove.pdf',
        mimeType: 'application/pdf',
        size: 100,
        path: '/tags/remove.pdf',
        uploadedBy: VALID_UUID,
        tags: ['keep', 'remove'],
      });

      const updated = await service.removeTags(doc.id, ['remove']);
      expect(updated.tags).toContain('keep');
      expect(updated.tags).not.toContain('remove');
    });
  });

  // ============================================
  // LINKING TESTS
  // ============================================
  describe('linkToEntity', () => {
    it('should link document to entity', async () => {
      const doc = await service.uploadDocument({
        name: 'LinkDoc',
        originalName: 'link.pdf',
        mimeType: 'application/pdf',
        size: 100,
        path: '/link/doc.pdf',
        uploadedBy: VALID_UUID,
      });

      const updated = await service.linkToEntity(doc.id, 'booking', VALID_UUID_2);
      expect(updated.relatedEntityType).toBe('booking');
      expect(updated.relatedEntityId).toBe(VALID_UUID_2);
    });

    it('should reject invalid entity ID', async () => {
      const doc = await service.uploadDocument({
        name: 'BadLink',
        originalName: 'badlink.pdf',
        mimeType: 'application/pdf',
        size: 100,
        path: '/link/bad.pdf',
        uploadedBy: VALID_UUID,
      });

      await expect(
        service.linkToEntity(doc.id, 'booking', INVALID_UUID)
      ).rejects.toMatchObject({ code: 'INVALID_ID' });
    });

    it('should reject empty entity type', async () => {
      const doc = await service.uploadDocument({
        name: 'NoType',
        originalName: 'notype.pdf',
        mimeType: 'application/pdf',
        size: 100,
        path: '/link/notype.pdf',
        uploadedBy: VALID_UUID,
      });

      await expect(
        service.linkToEntity(doc.id, '', VALID_UUID_2)
      ).rejects.toMatchObject({ code: 'INVALID_ENTITY_TYPE' });
    });
  });

  describe('unlinkFromEntity', () => {
    it('should unlink document from entity', async () => {
      const doc = await service.uploadDocument({
        name: 'UnlinkDoc',
        originalName: 'unlink.pdf',
        mimeType: 'application/pdf',
        size: 100,
        path: '/unlink/doc.pdf',
        uploadedBy: VALID_UUID,
        relatedEntityType: 'booking',
        relatedEntityId: VALID_UUID_2,
      });

      const updated = await service.unlinkFromEntity(doc.id);
      expect(updated.relatedEntityType).toBeNull();
      expect(updated.relatedEntityId).toBeNull();
    });
  });

  // ============================================
  // EXPIRY TESTS
  // ============================================
  describe('setExpiry', () => {
    it('should set expiry date', async () => {
      const doc = await service.uploadDocument({
        name: 'ExpiryDoc',
        originalName: 'expiry.pdf',
        mimeType: 'application/pdf',
        size: 100,
        path: '/expiry/doc.pdf',
        uploadedBy: VALID_UUID,
      });

      const updated = await service.setExpiry(doc.id, '2030-12-31');
      expect(updated.expiresAt).toBe('2030-12-31');
    });

    it('should reject invalid date', async () => {
      const doc = await service.uploadDocument({
        name: 'BadExpiry',
        originalName: 'badexp.pdf',
        mimeType: 'application/pdf',
        size: 100,
        path: '/expiry/bad.pdf',
        uploadedBy: VALID_UUID,
      });

      await expect(
        service.setExpiry(doc.id, 'not-a-date')
      ).rejects.toMatchObject({ code: 'INVALID_EXPIRY_DATE' });
    });

    it('should reject past date', async () => {
      const doc = await service.uploadDocument({
        name: 'PastExpiry',
        originalName: 'past.pdf',
        mimeType: 'application/pdf',
        size: 100,
        path: '/expiry/past.pdf',
        uploadedBy: VALID_UUID,
      });

      await expect(
        service.setExpiry(doc.id, '2020-01-01')
      ).rejects.toMatchObject({ code: 'EXPIRY_IN_PAST' });
    });
  });

  describe('clearExpiry', () => {
    it('should clear expiry date', async () => {
      const doc = await service.uploadDocument({
        name: 'ClearExpiry',
        originalName: 'clear.pdf',
        mimeType: 'application/pdf',
        size: 100,
        path: '/expiry/clear.pdf',
        uploadedBy: VALID_UUID,
        expiresAt: '2030-12-31',
      });

      const updated = await service.clearExpiry(doc.id);
      expect(updated.expiresAt).toBeNull();
    });
  });

  // ============================================
  // STATISTICS TESTS
  // ============================================
  describe('getStats', () => {
    it('should return empty stats', async () => {
      const stats = await service.getStats();
      expect(stats.total).toBe(0);
      expect(stats.totalSize).toBe(0);
    });

    it('should count documents', async () => {
      await service.uploadDocument({
        name: 'Doc1',
        originalName: 'd1.pdf',
        mimeType: 'application/pdf',
        size: 1000,
        path: '/stats/d1.pdf',
        uploadedBy: VALID_UUID,
      });
      await service.uploadDocument({
        name: 'Doc2',
        originalName: 'd2.jpg',
        mimeType: 'image/jpeg',
        size: 2000,
        path: '/stats/d2.jpg',
        uploadedBy: VALID_UUID,
      });

      const stats = await service.getStats();
      expect(stats.total).toBe(2);
      expect(stats.totalSize).toBe(3000);
      expect(stats.byType.other).toBe(1);
      expect(stats.byType.image).toBe(1);
      expect(stats.pendingApproval).toBe(2);
    });
  });

  // ============================================
  // SEARCH TESTS
  // ============================================
  describe('searchDocuments', () => {
    it('should search documents by name', async () => {
      await service.uploadDocument({
        name: 'Important Contract',
        originalName: 'contract.pdf',
        mimeType: 'application/pdf',
        size: 100,
        path: '/search/contract.pdf',
        uploadedBy: VALID_UUID,
      });
      await service.uploadDocument({
        name: 'Other File',
        originalName: 'other.pdf',
        mimeType: 'application/pdf',
        size: 100,
        path: '/search/other.pdf',
        uploadedBy: VALID_UUID,
      });

      const results = await service.searchDocuments('contract');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Important Contract');
    });

    it('should reject short query', async () => {
      await expect(
        service.searchDocuments('a')
      ).rejects.toMatchObject({ code: 'QUERY_TOO_SHORT' });
    });
  });

  describe('getDocumentsByTags', () => {
    it('should find documents by tags', async () => {
      await service.uploadDocument({
        name: 'Tagged1',
        originalName: 't1.pdf',
        mimeType: 'application/pdf',
        size: 100,
        path: '/tags/t1.pdf',
        uploadedBy: VALID_UUID,
        tags: ['important', 'legal'],
      });
      await service.uploadDocument({
        name: 'Tagged2',
        originalName: 't2.pdf',
        mimeType: 'application/pdf',
        size: 100,
        path: '/tags/t2.pdf',
        uploadedBy: VALID_UUID,
        tags: ['other'],
      });

      const results = await service.getDocumentsByTags(['important']);
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Tagged1');
    });

    it('should reject empty tags', async () => {
      await expect(
        service.getDocumentsByTags([])
      ).rejects.toMatchObject({ code: 'NO_TAGS' });
    });
  });

  // ============================================
  // UTILITY TESTS
  // ============================================
  describe('getDocumentTypes', () => {
    it('should return all document types', () => {
      const types = service.getDocumentTypes();
      expect(types).toContain('contract');
      expect(types).toContain('invoice');
      expect(types).toContain('image');
    });
  });

  describe('getDocumentStatuses', () => {
    it('should return all statuses', () => {
      const statuses = service.getDocumentStatuses();
      expect(statuses).toContain('pending');
      expect(statuses).toContain('approved');
      expect(statuses).toContain('rejected');
    });
  });

  describe('getVisibilityOptions', () => {
    it('should return all visibility options', () => {
      const options = service.getVisibilityOptions();
      expect(options).toContain('public');
      expect(options).toContain('private');
      expect(options).toContain('internal');
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      expect(service.formatFileSize(0)).toBe('0 Bytes');
      expect(service.formatFileSize(500)).toBe('500 Bytes');
    });

    it('should format kilobytes', () => {
      expect(service.formatFileSize(1024)).toBe('1 KB');
      expect(service.formatFileSize(2048)).toBe('2 KB');
    });

    it('should format megabytes', () => {
      expect(service.formatFileSize(1048576)).toBe('1 MB');
    });

    it('should format gigabytes', () => {
      expect(service.formatFileSize(1073741824)).toBe('1 GB');
    });
  });
});
