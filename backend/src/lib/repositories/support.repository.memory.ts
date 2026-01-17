/**
 * In-Memory Support Repository
 *
 * Test double for support operations (inquiries and FAQs).
 */

import type { 
  SupportRepository,
  SupportInquiry,
  SupportInquiryStatus,
  FAQ,
} from '../container/types.js';

function generateId(): string {
  return `support-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createInMemorySupportRepository(): SupportRepository & {
  // Test helpers
  addInquiry: (inquiry: SupportInquiry) => void;
  addFAQ: (faq: FAQ) => void;
  clear: () => void;
  getAllInquiries: () => SupportInquiry[];
  getAllFAQs: () => FAQ[];
} {
  const inquiries = new Map<string, SupportInquiry>();
  const faqs = new Map<string, FAQ>();

  return {
    // ----------------------------------------
    // INQUIRY OPERATIONS
    // ----------------------------------------

    async createInquiry(data): Promise<SupportInquiry> {
      const now = new Date().toISOString();
      const inquiry: SupportInquiry = {
        id: generateId(),
        ...data,
        created_at: now,
        updated_at: now,
      };
      inquiries.set(inquiry.id, inquiry);
      return { ...inquiry };
    },

    async getInquiryById(id): Promise<SupportInquiry | null> {
      const inquiry = inquiries.get(id);
      return inquiry ? { ...inquiry } : null;
    },

    async getInquiries(filters = {}): Promise<SupportInquiry[]> {
      let results = Array.from(inquiries.values());
      
      if (filters.status) {
        results = results.filter(i => i.status === filters.status);
      }
      
      // Sort by created_at descending (newest first)
      results.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      return results.map(i => ({ ...i }));
    },

    async updateInquiryStatus(id, status): Promise<SupportInquiry> {
      const inquiry = inquiries.get(id);
      if (!inquiry) {
        throw new Error(`Inquiry not found: ${id}`);
      }
      
      const updated: SupportInquiry = {
        ...inquiry,
        status,
        updated_at: new Date().toISOString(),
        resolved_at: status === 'resolved' ? new Date().toISOString() : inquiry.resolved_at,
      };
      inquiries.set(id, updated);
      return { ...updated };
    },

    // ----------------------------------------
    // FAQ OPERATIONS
    // ----------------------------------------

    async getPublishedFAQs(): Promise<FAQ[]> {
      return Array.from(faqs.values())
        .filter(f => f.is_published)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(f => ({ ...f }));
    },

    async getFAQById(id): Promise<FAQ | null> {
      const faq = faqs.get(id);
      return faq ? { ...faq } : null;
    },

    async createFAQ(data): Promise<FAQ> {
      const now = new Date().toISOString();
      const faq: FAQ = {
        id: generateId(),
        ...data,
        created_at: now,
        updated_at: now,
      };
      faqs.set(faq.id, faq);
      return { ...faq };
    },

    async updateFAQ(id, data): Promise<FAQ> {
      const faq = faqs.get(id);
      if (!faq) {
        throw new Error(`FAQ not found: ${id}`);
      }
      
      const updated: FAQ = {
        ...faq,
        ...data,
        id, // Ensure ID doesn't change
        updated_at: new Date().toISOString(),
      };
      faqs.set(id, updated);
      return { ...updated };
    },

    async deleteFAQ(id): Promise<void> {
      if (!faqs.has(id)) {
        throw new Error(`FAQ not found: ${id}`);
      }
      faqs.delete(id);
    },

    // ----------------------------------------
    // TEST HELPERS
    // ----------------------------------------

    addInquiry(inquiry: SupportInquiry): void {
      inquiries.set(inquiry.id, { ...inquiry });
    },

    addFAQ(faq: FAQ): void {
      faqs.set(faq.id, { ...faq });
    },

    clear(): void {
      inquiries.clear();
      faqs.clear();
    },

    getAllInquiries(): SupportInquiry[] {
      return Array.from(inquiries.values()).map(i => ({ ...i }));
    },

    getAllFAQs(): FAQ[] {
      return Array.from(faqs.values()).map(f => ({ ...f }));
    },
  };
}
