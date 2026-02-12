/**
 * Group Bookings Service
 * Phase 3.3: Group Booking & Event Management
 * Refactored to use Supabase client
 */

import { getSupabase } from '../../database/connection.js';
import { randomBytes } from 'crypto';

// =============================================
// TYPES
// =============================================

interface GroupReservation {
  id: string;
  propertyId: string;
  groupName: string;
  groupCode: string;
  groupType: string;
  status: string;
  organizerName?: string;
  organizerEmail?: string;
  organizerPhone?: string;
  companyName?: string;
  arrivalDate: Date;
  departureDate: Date;
  totalRooms: number;
  confirmedRooms: number;
  cutoffDate?: Date;
  negotiatedRate?: number;
  contractTerms?: Record<string, any>;
  specialRequests?: string;
  notes?: string;
  assignedTo?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface RoomBlock {
  id: string;
  groupId: string;
  roomTypeId: string;
  roomTypeName?: string;
  date: Date;
  blockedCount: number;
  pickedUp: number;
  released: number;
  available: number;
  rate: number;
  status: string;
}

interface GroupBooking {
  id: string;
  groupId: string;
  reservationId?: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  roomTypeId?: string;
  checkIn: Date;
  checkOut: Date;
  specialRequests?: string;
  status: string;
}

interface GroupEvent {
  id: string;
  groupId: string;
  eventName: string;
  eventType: string;
  venueId?: string;
  venueName?: string;
  startTime: Date;
  endTime: Date;
  attendees?: number;
  setupRequirements?: string;
  equipmentNeeds?: string[];
  cateringRequired: boolean;
  estimatedCost?: number;
  status: string;
}

interface GroupContract {
  id: string;
  groupId: string;
  contractNumber: string;
  terms: Record<string, any>;
  status: string;
  signedAt?: Date;
  signedBy?: string;
  createdAt: Date;
}

interface GroupInvoice {
  id: string;
  groupId: string;
  invoiceNumber: string;
  invoiceType: string;
  status: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  dueDate: Date;
  lineItems: any[];
}

interface GroupPayment {
  id: string;
  groupId: string;
  invoiceId?: string;
  amount: number;
  paymentMethod: string;
  referenceNumber?: string;
  status: string;
  createdAt: Date;
}

interface GroupActivity {
  id: string;
  groupId: string;
  activityType: string;
  description: string;
  performedBy?: string;
  createdAt: Date;
}

// =============================================
// GROUP BOOKING SERVICE CLASS
// =============================================

export class GroupBookingService {
  private get supabase() {
    return getSupabase();
  }

  // =============================================
  // HELPER FUNCTIONS
  // =============================================

  private generateGroupCode(prefix: string = 'GRP'): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = randomBytes(2).toString('hex').toUpperCase();
    return `${prefix}${date}${random}`;
  }

  private generateInvoiceNumber(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = randomBytes(3).toString('hex').toUpperCase().substring(0, 5);
    return `INV-${date}-${random}`;
  }

  private generateContractNumber(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = randomBytes(2).toString('hex').toUpperCase();
    return `CTR-${date}-${random}`;
  }

  private async logActivity(groupId: string, activityType: string, description: string, userId?: string): Promise<void> {
    await this.supabase
      .from('group_activities')
      .insert({
        group_id: groupId,
        activity_type: activityType,
        description,
        performed_by: userId || null
      });
  }

  // =============================================
  // GROUP RESERVATIONS
  // =============================================

  async createGroupReservation(
    propertyId: string,
    data: {
      groupName: string;
      groupType: string;
      organizerName?: string;
      organizerEmail?: string;
      organizerPhone?: string;
      companyName?: string;
      arrivalDate: Date | string;
      departureDate: Date | string;
      totalRooms: number;
      cutoffDate?: Date | string;
      negotiatedRate?: number;
      contractTerms?: Record<string, any>;
      specialRequests?: string;
      notes?: string;
    },
    userId?: string
  ): Promise<GroupReservation> {
    const groupCode = this.generateGroupCode();

    const { data: group, error } = await this.supabase
      .from('group_reservations')
      .insert({
        property_id: propertyId,
        group_name: data.groupName,
        group_code: groupCode,
        group_type: data.groupType,
        status: 'inquiry',
        organizer_name: data.organizerName || null,
        organizer_email: data.organizerEmail || null,
        organizer_phone: data.organizerPhone || null,
        company_name: data.companyName || null,
        arrival_date: data.arrivalDate,
        departure_date: data.departureDate,
        total_rooms: data.totalRooms,
        confirmed_rooms: 0,
        cutoff_date: data.cutoffDate || null,
        negotiated_rate: data.negotiatedRate || null,
        contract_terms: data.contractTerms || {},
        special_requests: data.specialRequests || null,
        notes: data.notes || null,
        assigned_to: userId || null,
        created_by: userId || null
      })
      .select()
      .single();

    if (error) throw error;

    await this.logActivity(group.id, 'created', 'Group reservation created', userId);
    return this.mapGroupReservation(group);
  }

  async getGroupReservations(
    propertyId: string,
    filters?: {
      status?: string[];
      startDate?: Date;
      endDate?: Date;
      assignedTo?: string;
      search?: string;
    }
  ): Promise<GroupReservation[]> {
    let query = this.supabase
      .from('group_reservations')
      .select('*')
      .eq('property_id', propertyId)
      .order('arrival_date', { ascending: true });

    if (filters?.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }
    if (filters?.startDate) {
      query = query.gte('arrival_date', filters.startDate.toISOString());
    }
    if (filters?.endDate) {
      query = query.lte('arrival_date', filters.endDate.toISOString());
    }
    if (filters?.assignedTo) {
      query = query.eq('assigned_to', filters.assignedTo);
    }
    if (filters?.search) {
      query = query.or(`group_name.ilike.%${filters.search}%,group_code.ilike.%${filters.search}%,company_name.ilike.%${filters.search}%`);
    }

    const { data: groups, error } = await query;
    if (error) throw error;
    return (groups || []).map(g => this.mapGroupReservation(g));
  }

  async getGroupById(groupId: string): Promise<GroupReservation | null> {
    const { data: group, error } = await this.supabase
      .from('group_reservations')
      .select('*')
      .eq('id', groupId)
      .single();

    if (error || !group) return null;
    return this.mapGroupReservation(group);
  }

  async updateGroupReservation(
    groupId: string,
    updates: Partial<{
      groupName: string;
      status: string;
      organizerName: string;
      organizerEmail: string;
      organizerPhone: string;
      companyName: string;
      arrivalDate: Date | string;
      departureDate: Date | string;
      totalRooms: number;
      cutoffDate: Date | string;
      negotiatedRate: number;
      contractTerms: Record<string, any>;
      specialRequests: string;
      notes: string;
      assignedTo: string;
    }>,
    userId?: string
  ): Promise<void> {
    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };

    if (updates.groupName !== undefined) updateData.group_name = updates.groupName;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.organizerName !== undefined) updateData.organizer_name = updates.organizerName;
    if (updates.organizerEmail !== undefined) updateData.organizer_email = updates.organizerEmail;
    if (updates.organizerPhone !== undefined) updateData.organizer_phone = updates.organizerPhone;
    if (updates.companyName !== undefined) updateData.company_name = updates.companyName;
    if (updates.arrivalDate !== undefined) updateData.arrival_date = updates.arrivalDate;
    if (updates.departureDate !== undefined) updateData.departure_date = updates.departureDate;
    if (updates.totalRooms !== undefined) updateData.total_rooms = updates.totalRooms;
    if (updates.cutoffDate !== undefined) updateData.cutoff_date = updates.cutoffDate;
    if (updates.negotiatedRate !== undefined) updateData.negotiated_rate = updates.negotiatedRate;
    if (updates.contractTerms !== undefined) updateData.contract_terms = updates.contractTerms;
    if (updates.specialRequests !== undefined) updateData.special_requests = updates.specialRequests;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.assignedTo !== undefined) updateData.assigned_to = updates.assignedTo;

    const { error } = await this.supabase
      .from('group_reservations')
      .update(updateData)
      .eq('id', groupId);

    if (error) throw error;

    await this.logActivity(groupId, 'updated', 'Group reservation updated', userId);
  }

  async cancelGroupReservation(
    groupId: string,
    reason: string,
    cancellationFee: number,
    userId?: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('group_reservations')
      .update({
        status: 'cancelled',
        cancellation_reason: reason,
        cancellation_fee: cancellationFee,
        cancelled_at: new Date().toISOString(),
        cancelled_by: userId || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', groupId);

    if (error) throw error;

    // Release all room blocks
    await this.supabase
      .from('group_room_blocks')
      .update({ status: 'released', updated_at: new Date().toISOString() })
      .eq('group_id', groupId);

    await this.logActivity(groupId, 'cancelled', `Group cancelled: ${reason}`, userId);
  }

  // =============================================
  // ROOM BLOCKS
  // =============================================

  async addRoomBlock(
    groupId: string,
    blocks: Array<{
      roomTypeId: string;
      date: Date | string;
      count: number;
      rate: number;
    }>,
    userId?: string
  ): Promise<void> {
    const inserts = blocks.map(b => ({
      group_id: groupId,
      room_type_id: b.roomTypeId,
      block_date: b.date,
      blocked_count: b.count,
      picked_up: 0,
      released: 0,
      rate: b.rate,
      status: 'active'
    }));

    const { error } = await this.supabase
      .from('group_room_blocks')
      .insert(inserts);

    if (error) throw error;

    await this.updateGroupRoomCount(groupId);
    await this.logActivity(groupId, 'blocks_added', `Added ${blocks.length} room blocks`, userId);
  }

  async addRoomBlocksForDateRange(
    groupId: string,
    roomTypeId: string,
    startDate: Date,
    endDate: Date,
    roomsPerDay: number,
    rate: number,
    userId?: string
  ): Promise<number> {
    const blocks: Array<{
      roomTypeId: string;
      date: Date;
      count: number;
      rate: number;
    }> = [];

    const current = new Date(startDate);
    while (current < endDate) {
      blocks.push({
        roomTypeId,
        date: new Date(current),
        count: roomsPerDay,
        rate
      });
      current.setDate(current.getDate() + 1);
    }

    await this.addRoomBlock(groupId, blocks, userId);
    return blocks.length;
  }

  async releaseRoomBlock(
    blockId: string,
    reason: string,
    userId?: string
  ): Promise<void> {
    const { data: block } = await this.supabase
      .from('group_room_blocks')
      .select('group_id, blocked_count, picked_up')
      .eq('id', blockId)
      .single();

    if (!block) throw new Error('Room block not found');

    const releasedCount = block.blocked_count - block.picked_up;

    const { error } = await this.supabase
      .from('group_room_blocks')
      .update({
        released: releasedCount,
        status: 'released',
        release_reason: reason,
        released_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', blockId);

    if (error) throw error;

    await this.updateGroupRoomCount(block.group_id);
    await this.logActivity(block.group_id, 'block_released', `Room block released: ${reason}`, userId);
  }

  private async updateGroupRoomCount(groupId: string): Promise<void> {
    const { data: blocks } = await this.supabase
      .from('group_room_blocks')
      .select('picked_up')
      .eq('group_id', groupId)
      .eq('status', 'active');

    const confirmedRooms = (blocks || []).reduce((sum, b) => sum + (b.picked_up || 0), 0);

    await this.supabase
      .from('group_reservations')
      .update({ confirmed_rooms: confirmedRooms, updated_at: new Date().toISOString() })
      .eq('id', groupId);
  }

  // =============================================
  // GROUP BOOKINGS (INDIVIDUAL GUESTS)
  // =============================================

  async addGroupBooking(
    groupId: string,
    data: {
      guestName: string;
      guestEmail?: string;
      guestPhone?: string;
      roomTypeId?: string;
      checkIn: Date | string;
      checkOut: Date | string;
      specialRequests?: string;
    },
    userId?: string
  ): Promise<GroupBooking> {
    const { data: booking, error } = await this.supabase
      .from('group_bookings')
      .insert({
        group_id: groupId,
        guest_name: data.guestName,
        guest_email: data.guestEmail || null,
        guest_phone: data.guestPhone || null,
        room_type_id: data.roomTypeId || null,
        check_in: data.checkIn,
        check_out: data.checkOut,
        special_requests: data.specialRequests || null,
        status: 'confirmed'
      })
      .select()
      .single();

    if (error) throw error;

    await this.updateGroupRoomCount(groupId);
    await this.logActivity(groupId, 'guest_added', `Guest added: ${data.guestName}`, userId);

    return this.mapGroupBooking(booking);
  }

  async importRoomingList(
    groupId: string,
    guests: Array<{
      guestName: string;
      guestEmail?: string;
      guestPhone?: string;
      roomTypeId?: string;
      checkIn: Date | string;
      checkOut: Date | string;
      specialRequests?: string;
    }>,
    userId?: string
  ): Promise<{ imported: number; errors: Array<{ guest: string; error: string }> }> {
    let imported = 0;
    const errors: Array<{ guest: string; error: string }> = [];

    for (const guest of guests) {
      try {
        await this.addGroupBooking(groupId, guest, userId);
        imported++;
      } catch (error: any) {
        errors.push({ guest: guest.guestName, error: error.message });
      }
    }

    await this.logActivity(groupId, 'rooming_list_imported', `Imported ${imported} guests`, userId);
    return { imported, errors };
  }

  async cancelGroupBooking(
    bookingId: string,
    reason: string,
    userId?: string
  ): Promise<void> {
    const { data: booking } = await this.supabase
      .from('group_bookings')
      .select('group_id, guest_name')
      .eq('id', bookingId)
      .single();

    if (!booking) throw new Error('Booking not found');

    const { error } = await this.supabase
      .from('group_bookings')
      .update({
        status: 'cancelled',
        cancellation_reason: reason,
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId);

    if (error) throw error;

    await this.updateGroupRoomCount(booking.group_id);
    await this.logActivity(booking.group_id, 'guest_cancelled', `Guest cancelled: ${booking.guest_name} - ${reason}`, userId);
  }

  // =============================================
  // GROUP EVENTS
  // =============================================

  async addGroupEvent(
    groupId: string,
    data: {
      eventName: string;
      eventType: string;
      venueId?: string;
      startTime: Date | string;
      endTime: Date | string;
      attendees?: number;
      setupRequirements?: string;
      equipmentNeeds?: string[];
      cateringRequired?: boolean;
      estimatedCost?: number;
    },
    userId?: string
  ): Promise<GroupEvent> {
    const { data: event, error } = await this.supabase
      .from('group_events')
      .insert({
        group_id: groupId,
        event_name: data.eventName,
        event_type: data.eventType,
        venue_id: data.venueId || null,
        start_time: data.startTime,
        end_time: data.endTime,
        attendees: data.attendees || null,
        setup_requirements: data.setupRequirements || null,
        equipment_needs: data.equipmentNeeds || [],
        catering_required: data.cateringRequired || false,
        estimated_cost: data.estimatedCost || null,
        status: 'scheduled'
      })
      .select()
      .single();

    if (error) throw error;

    await this.logActivity(groupId, 'event_added', `Event added: ${data.eventName}`, userId);
    return this.mapGroupEvent(event);
  }

  async updateGroupEvent(
    eventId: string,
    updates: Partial<{
      eventName: string;
      eventType: string;
      venueId: string;
      startTime: Date | string;
      endTime: Date | string;
      attendees: number;
      setupRequirements: string;
      equipmentNeeds: string[];
      cateringRequired: boolean;
      estimatedCost: number;
      status: string;
    }>
  ): Promise<void> {
    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };

    if (updates.eventName !== undefined) updateData.event_name = updates.eventName;
    if (updates.eventType !== undefined) updateData.event_type = updates.eventType;
    if (updates.venueId !== undefined) updateData.venue_id = updates.venueId;
    if (updates.startTime !== undefined) updateData.start_time = updates.startTime;
    if (updates.endTime !== undefined) updateData.end_time = updates.endTime;
    if (updates.attendees !== undefined) updateData.attendees = updates.attendees;
    if (updates.setupRequirements !== undefined) updateData.setup_requirements = updates.setupRequirements;
    if (updates.equipmentNeeds !== undefined) updateData.equipment_needs = updates.equipmentNeeds;
    if (updates.cateringRequired !== undefined) updateData.catering_required = updates.cateringRequired;
    if (updates.estimatedCost !== undefined) updateData.estimated_cost = updates.estimatedCost;
    if (updates.status !== undefined) updateData.status = updates.status;

    const { error } = await this.supabase
      .from('group_events')
      .update(updateData)
      .eq('id', eventId);

    if (error) throw error;
  }

  // =============================================
  // CONTRACTS
  // =============================================

  async generateContract(
    groupId: string,
    terms: Record<string, any>,
    userId?: string
  ): Promise<GroupContract> {
    const contractNumber = this.generateContractNumber();

    const { data: contract, error } = await this.supabase
      .from('group_contracts')
      .insert({
        group_id: groupId,
        contract_number: contractNumber,
        terms,
        status: 'draft',
        created_by: userId || null
      })
      .select()
      .single();

    if (error) throw error;

    await this.logActivity(groupId, 'contract_generated', `Contract generated: ${contractNumber}`, userId);
    return this.mapGroupContract(contract);
  }

  async markContractSigned(
    contractId: string,
    signatory: string,
    userId?: string
  ): Promise<void> {
    const { data: contract } = await this.supabase
      .from('group_contracts')
      .select('group_id')
      .eq('id', contractId)
      .single();

    if (!contract) throw new Error('Contract not found');

    const { error } = await this.supabase
      .from('group_contracts')
      .update({
        status: 'signed',
        signed_at: new Date().toISOString(),
        signed_by: signatory,
        updated_at: new Date().toISOString()
      })
      .eq('id', contractId);

    if (error) throw error;

    // Update group status to confirmed
    await this.supabase
      .from('group_reservations')
      .update({ status: 'confirmed', updated_at: new Date().toISOString() })
      .eq('id', contract.group_id);

    await this.logActivity(contract.group_id, 'contract_signed', `Contract signed by: ${signatory}`, userId);
  }

  // =============================================
  // INVOICES & PAYMENTS
  // =============================================

  async createInvoice(
    groupId: string,
    invoiceType: string,
    lineItems: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      taxRate?: number;
    }>,
    dueDate: Date,
    notes?: string,
    userId?: string
  ): Promise<GroupInvoice> {
    const invoiceNumber = this.generateInvoiceNumber();

    // Calculate totals
    let subtotal = 0;
    let taxAmount = 0;
    const processedItems = lineItems.map(item => {
      const lineTotal = item.quantity * item.unitPrice;
      const lineTax = lineTotal * (item.taxRate || 0) / 100;
      subtotal += lineTotal;
      taxAmount += lineTax;
      return {
        ...item,
        total: lineTotal,
        tax: lineTax
      };
    });

    const totalAmount = subtotal + taxAmount;

    const { data: invoice, error } = await this.supabase
      .from('group_invoices')
      .insert({
        group_id: groupId,
        invoice_number: invoiceNumber,
        invoice_type: invoiceType,
        status: 'draft',
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        paid_amount: 0,
        due_date: dueDate.toISOString(),
        line_items: processedItems,
        notes: notes || null,
        created_by: userId || null
      })
      .select()
      .single();

    if (error) throw error;

    await this.logActivity(groupId, 'invoice_created', `Invoice created: ${invoiceNumber}`, userId);
    return this.mapGroupInvoice(invoice);
  }

  async recordPayment(
    groupId: string,
    amount: number,
    paymentMethod: string,
    invoiceId?: string,
    referenceNumber?: string,
    userId?: string
  ): Promise<GroupPayment> {
    const { data: payment, error } = await this.supabase
      .from('group_payments')
      .insert({
        group_id: groupId,
        invoice_id: invoiceId || null,
        amount,
        payment_method: paymentMethod,
        reference_number: referenceNumber || null,
        status: 'completed',
        processed_by: userId || null
      })
      .select()
      .single();

    if (error) throw error;

    // Update invoice paid amount if invoice specified
    if (invoiceId) {
      const { data: invoice } = await this.supabase
        .from('group_invoices')
        .select('paid_amount, total_amount')
        .eq('id', invoiceId)
        .single();

      if (invoice) {
        const newPaidAmount = (invoice.paid_amount || 0) + amount;
        const newStatus = newPaidAmount >= invoice.total_amount ? 'paid' : 'partial';

        await this.supabase
          .from('group_invoices')
          .update({
            paid_amount: newPaidAmount,
            status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', invoiceId);
      }
    }

    await this.logActivity(groupId, 'payment_received', `Payment received: $${amount}`, userId);
    return this.mapGroupPayment(payment);
  }

  // =============================================
  // ACTIVITY LOG
  // =============================================

  async getActivityLog(groupId: string, limit: number = 50): Promise<GroupActivity[]> {
    const { data: activities, error } = await this.supabase
      .from('group_activities')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (activities || []).map(a => this.mapGroupActivity(a));
  }

  // =============================================
  // CUTOFF MANAGEMENT
  // =============================================

  async processAutomaticCutoffs(): Promise<number> {
    const today = new Date().toISOString().split('T')[0];

    // Find groups past cutoff with unreleased blocks
    const { data: expiredGroups } = await this.supabase
      .from('group_reservations')
      .select('id')
      .lt('cutoff_date', today)
      .eq('status', 'confirmed');

    if (!expiredGroups || expiredGroups.length === 0) return 0;

    const groupIds = expiredGroups.map(g => g.id);

    // Release unreleased blocks
    const { data: blocks } = await this.supabase
      .from('group_room_blocks')
      .select('id, group_id, blocked_count, picked_up')
      .in('group_id', groupIds)
      .eq('status', 'active');

    let releasedCount = 0;
    for (const block of blocks || []) {
      const toRelease = block.blocked_count - block.picked_up;
      if (toRelease > 0) {
        await this.supabase
          .from('group_room_blocks')
          .update({
            released: toRelease,
            status: 'released',
            release_reason: 'Automatic cutoff',
            released_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', block.id);

        await this.logActivity(block.group_id, 'auto_release', `${toRelease} rooms auto-released at cutoff`);
        releasedCount++;
      }
    }

    return releasedCount;
  }

  async getUpcomingCutoffs(propertyId: string, daysAhead: number = 14): Promise<any[]> {
    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const { data: groups, error } = await this.supabase
      .from('group_reservations')
      .select('id, group_name, group_code, cutoff_date, total_rooms, confirmed_rooms')
      .eq('property_id', propertyId)
      .eq('status', 'confirmed')
      .gte('cutoff_date', today.toISOString())
      .lte('cutoff_date', futureDate.toISOString())
      .order('cutoff_date');

    if (error) throw error;

    return (groups || []).map(g => ({
      groupId: g.id,
      groupName: g.group_name,
      groupCode: g.group_code,
      cutoffDate: g.cutoff_date,
      totalRooms: g.total_rooms,
      confirmedRooms: g.confirmed_rooms,
      roomsAtRisk: g.total_rooms - g.confirmed_rooms
    }));
  }

  // =============================================
  // MAPPERS
  // =============================================

  private mapGroupReservation(row: any): GroupReservation {
    return {
      id: row.id,
      propertyId: row.property_id,
      groupName: row.group_name,
      groupCode: row.group_code,
      groupType: row.group_type,
      status: row.status,
      organizerName: row.organizer_name,
      organizerEmail: row.organizer_email,
      organizerPhone: row.organizer_phone,
      companyName: row.company_name,
      arrivalDate: new Date(row.arrival_date),
      departureDate: new Date(row.departure_date),
      totalRooms: row.total_rooms,
      confirmedRooms: row.confirmed_rooms || 0,
      cutoffDate: row.cutoff_date ? new Date(row.cutoff_date) : undefined,
      negotiatedRate: row.negotiated_rate,
      contractTerms: row.contract_terms,
      specialRequests: row.special_requests,
      notes: row.notes,
      assignedTo: row.assigned_to,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private mapRoomBlock(row: any): RoomBlock {
    return {
      id: row.id,
      groupId: row.group_id,
      roomTypeId: row.room_type_id,
      roomTypeName: row.room_types?.name,
      date: new Date(row.block_date),
      blockedCount: row.blocked_count,
      pickedUp: row.picked_up || 0,
      released: row.released || 0,
      available: row.blocked_count - (row.picked_up || 0) - (row.released || 0),
      rate: row.rate,
      status: row.status
    };
  }

  private mapGroupBooking(row: any): GroupBooking {
    return {
      id: row.id,
      groupId: row.group_id,
      reservationId: row.reservation_id,
      guestName: row.guest_name,
      guestEmail: row.guest_email,
      guestPhone: row.guest_phone,
      roomTypeId: row.room_type_id,
      checkIn: new Date(row.check_in),
      checkOut: new Date(row.check_out),
      specialRequests: row.special_requests,
      status: row.status
    };
  }

  private mapGroupEvent(row: any): GroupEvent {
    return {
      id: row.id,
      groupId: row.group_id,
      eventName: row.event_name,
      eventType: row.event_type,
      venueId: row.venue_id,
      venueName: row.venues?.name,
      startTime: new Date(row.start_time),
      endTime: new Date(row.end_time),
      attendees: row.attendees,
      setupRequirements: row.setup_requirements,
      equipmentNeeds: row.equipment_needs,
      cateringRequired: row.catering_required,
      estimatedCost: row.estimated_cost,
      status: row.status
    };
  }

  private mapGroupContract(row: any): GroupContract {
    return {
      id: row.id,
      groupId: row.group_id,
      contractNumber: row.contract_number,
      terms: row.terms,
      status: row.status,
      signedAt: row.signed_at ? new Date(row.signed_at) : undefined,
      signedBy: row.signed_by,
      createdAt: new Date(row.created_at)
    };
  }

  private mapGroupInvoice(row: any): GroupInvoice {
    return {
      id: row.id,
      groupId: row.group_id,
      invoiceNumber: row.invoice_number,
      invoiceType: row.invoice_type,
      status: row.status,
      subtotal: row.subtotal,
      taxAmount: row.tax_amount,
      totalAmount: row.total_amount,
      paidAmount: row.paid_amount || 0,
      dueDate: new Date(row.due_date),
      lineItems: row.line_items || []
    };
  }

  private mapGroupPayment(row: any): GroupPayment {
    return {
      id: row.id,
      groupId: row.group_id,
      invoiceId: row.invoice_id,
      amount: row.amount,
      paymentMethod: row.payment_method,
      referenceNumber: row.reference_number,
      status: row.status,
      createdAt: new Date(row.created_at)
    };
  }

  private mapGroupActivity(row: any): GroupActivity {
    return {
      id: row.id,
      groupId: row.group_id,
      activityType: row.activity_type,
      description: row.description,
      performedBy: row.performed_by,
      createdAt: new Date(row.created_at)
    };
  }
}

export const groupBookingService = new GroupBookingService();
