/**
 * In-Memory Document Repository
 * Test double for DocumentRepository using in-memory data structures.
 */

import type {
  DocumentRepository,
  Document,
  DocumentVersion,
  DocumentFilters,
} from '../container/types.js';

export class InMemoryDocumentRepository implements DocumentRepository {
  private documents = new Map<string, Document>();
  private versions: DocumentVersion[] = [];

  reset() {
    this.documents.clear();
    this.versions = [];
  }

  async create(data: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>): Promise<Document> {
    const id = crypto.randomUUID();
    const doc: Document = { ...data, id, createdAt: new Date().toISOString(), updatedAt: null };
    this.documents.set(id, doc);
    return doc;
  }

  async update(id: string, data: Partial<Document>): Promise<Document> {
    const existing = this.documents.get(id);
    if (!existing) throw new Error(`Document ${id} not found`);
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    this.documents.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.documents.delete(id);
  }

  async getById(id: string): Promise<Document | null> {
    return this.documents.get(id) ?? null;
  }

  async getByPath(path: string): Promise<Document | null> {
    for (const d of this.documents.values()) {
      if (d.path === path) return d;
    }
    return null;
  }

  async list(filters?: DocumentFilters): Promise<Document[]> {
    let result = [...this.documents.values()];
    if (filters?.type) result = result.filter(d => d.type === filters.type);
    if (filters?.status) result = result.filter(d => d.status === filters.status);
    if (filters?.visibility) result = result.filter(d => d.visibility === filters.visibility);
    if (filters?.uploadedBy) result = result.filter(d => d.uploadedBy === filters.uploadedBy);
    if (filters?.relatedEntityType) result = result.filter(d => d.relatedEntityType === filters.relatedEntityType);
    if (filters?.relatedEntityId) result = result.filter(d => d.relatedEntityId === filters.relatedEntityId);
    if (filters?.tags?.length) result = result.filter(d => filters.tags!.some(tag => d.tags.includes(tag)));
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(d => d.name.toLowerCase().includes(q) || d.originalName.toLowerCase().includes(q));
    }
    return result;
  }

  async getByRelatedEntity(entityType: string, entityId: string): Promise<Document[]> {
    return [...this.documents.values()].filter(
      d => d.relatedEntityType === entityType && d.relatedEntityId === entityId
    );
  }

  async createVersion(data: Omit<DocumentVersion, 'id'>): Promise<DocumentVersion> {
    const version: DocumentVersion = { ...data, id: crypto.randomUUID() };
    this.versions.push(version);
    return version;
  }

  async getVersions(documentId: string): Promise<DocumentVersion[]> {
    return this.versions
      .filter(v => v.documentId === documentId)
      .sort((a, b) => b.version - a.version);
  }

  async getLatestVersion(documentId: string): Promise<DocumentVersion | null> {
    const versions = this.versions
      .filter(v => v.documentId === documentId)
      .sort((a, b) => b.version - a.version);
    return versions[0] ?? null;
  }
}
