/**
 * In-Memory Document Repository
 *
 * Test double for the Document repository.
 */

import type {
  Document,
  DocumentVersion,
  DocumentFilters,
  DocumentRepository,
} from '../container/types.js';
import { randomUUID } from 'crypto';

export class InMemoryDocumentRepository implements DocumentRepository {
  private documents: Map<string, Document> = new Map();
  private versions: Map<string, DocumentVersion> = new Map();

  // Document Operations
  async create(data: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>): Promise<Document> {
    const doc: Document = {
      ...data,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };
    this.documents.set(doc.id, doc);
    return doc;
  }

  async update(id: string, data: Partial<Document>): Promise<Document> {
    const doc = this.documents.get(id);
    if (!doc) {
      throw new Error(`Document not found: ${id}`);
    }
    const updated: Document = {
      ...doc,
      ...data,
      id: doc.id,
      createdAt: doc.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.documents.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.documents.delete(id);
    // Also delete versions
    for (const [vId, version] of this.versions.entries()) {
      if (version.documentId === id) {
        this.versions.delete(vId);
      }
    }
  }

  async getById(id: string): Promise<Document | null> {
    return this.documents.get(id) || null;
  }

  async getByPath(path: string): Promise<Document | null> {
    for (const doc of this.documents.values()) {
      if (doc.path === path) {
        return doc;
      }
    }
    return null;
  }

  async list(filters?: DocumentFilters): Promise<Document[]> {
    let results = Array.from(this.documents.values());

    if (filters) {
      if (filters.type) {
        results = results.filter(d => d.type === filters.type);
      }
      if (filters.status) {
        results = results.filter(d => d.status === filters.status);
      }
      if (filters.visibility) {
        results = results.filter(d => d.visibility === filters.visibility);
      }
      if (filters.uploadedBy) {
        results = results.filter(d => d.uploadedBy === filters.uploadedBy);
      }
      if (filters.relatedEntityType) {
        results = results.filter(d => d.relatedEntityType === filters.relatedEntityType);
      }
      if (filters.relatedEntityId) {
        results = results.filter(d => d.relatedEntityId === filters.relatedEntityId);
      }
      if (filters.tags && filters.tags.length > 0) {
        results = results.filter(d => 
          filters.tags!.some(tag => d.tags.includes(tag))
        );
      }
      if (filters.search) {
        const search = filters.search.toLowerCase();
        results = results.filter(d =>
          d.name.toLowerCase().includes(search) ||
          d.originalName.toLowerCase().includes(search) ||
          (d.description && d.description.toLowerCase().includes(search))
        );
      }
    }

    return results;
  }

  async getByRelatedEntity(entityType: string, entityId: string): Promise<Document[]> {
    return Array.from(this.documents.values()).filter(
      d => d.relatedEntityType === entityType && d.relatedEntityId === entityId
    );
  }

  // Version Operations
  async createVersion(data: Omit<DocumentVersion, 'id'>): Promise<DocumentVersion> {
    const version: DocumentVersion = {
      ...data,
      id: randomUUID(),
    };
    this.versions.set(version.id, version);
    return version;
  }

  async getVersions(documentId: string): Promise<DocumentVersion[]> {
    return Array.from(this.versions.values())
      .filter(v => v.documentId === documentId)
      .sort((a, b) => b.version - a.version);
  }

  async getLatestVersion(documentId: string): Promise<DocumentVersion | null> {
    const versions = await this.getVersions(documentId);
    return versions.length > 0 ? versions[0] : null;
  }

  // Test helper to clear all data
  clear(): void {
    this.documents.clear();
    this.versions.clear();
  }
}
