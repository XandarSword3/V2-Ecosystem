import type { GuestProfile, GuestRepository, GuestStatus } from '../../src/services/guest.service';

export class InMemoryGuestRepository implements GuestRepository {
  private guests = new Map<string, GuestProfile>();

  async findById(id: string): Promise<GuestProfile | null> {
    return this.guests.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<GuestProfile | null> {
    for (const g of this.guests.values()) {
      if (g.email === email.toLowerCase()) return g;
    }
    return null;
  }

  async findByPhone(phone: string): Promise<GuestProfile | null> {
    for (const g of this.guests.values()) {
      if (g.phone === phone) return g;
    }
    return null;
  }

  async findByUserId(userId: string): Promise<GuestProfile | null> {
    for (const g of this.guests.values()) {
      if (g.userId === userId) return g;
    }
    return null;
  }

  async findAll(filters?: { status?: GuestStatus; tags?: string[] }): Promise<GuestProfile[]> {
    let result = [...this.guests.values()];
    if (filters?.status) result = result.filter(g => g.status === filters.status);
    if (filters?.tags?.length) {
      result = result.filter(g => filters.tags!.every(t => g.tags.includes(t)));
    }
    return result;
  }

  async search(query: string): Promise<GuestProfile[]> {
    const q = query.toLowerCase();
    return [...this.guests.values()].filter(g =>
      g.firstName.toLowerCase().includes(q) ||
      g.lastName.toLowerCase().includes(q) ||
      g.email.toLowerCase().includes(q) ||
      g.phone.includes(q)
    );
  }

  async save(guest: GuestProfile): Promise<GuestProfile> {
    this.guests.set(guest.id, { ...guest });
    return guest;
  }

  async delete(id: string): Promise<void> {
    this.guests.delete(id);
  }
}
