/**
 * Guest Segmentation & Cohort Analysis Service
 * Phase 2 Upgrade: RFM segmentation and behavioral analytics
 */

import { getSupabase } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

export type RFMScore = 1 | 2 | 3 | 4 | 5;

export interface RFMMetrics {
  recencyDays: number; // Days since last booking
  frequency: number; // Total bookings
  monetary: number; // Total spend
}

export interface GuestSegment {
  code: string;
  name: string;
  description: string;
  rRanges: { min: number; max: number };
  fRanges: { min: number; max: number };
  mRanges: { min: number; max: number };
}

export interface GuestProfile {
  userId: string;
  email: string;
  name?: string;
  phone?: string;
  rfmMetrics: RFMMetrics;
  rScore: RFMScore;
  fScore: RFMScore;
  mScore: RFMScore;
  segment: string;
  segmentName: string;
  lifetimeValue: number;
  firstBookingDate?: Date;
  lastBookingDate?: Date;
  totalNights: number;
  averageAdr: number;
  preferredRoomType?: string;
  preferredChannel?: string;
  cancellationRate: number;
  avgLeadTime: number; // Days between booking and check-in
}

export interface CohortAnalysis {
  cohortMonth: string;
  cohortSize: number;
  retentionRates: number[]; // % retained at month 1, 2, 3, etc.
  revenueByMonth: number[];
  averageLtv: number;
}

// Standard RFM Segments based on research
export const GUEST_SEGMENTS: GuestSegment[] = [
  { code: 'CHAMPIONS', name: 'Champions', description: 'High value, frequent, recent', rRanges: { min: 4, max: 5 }, fRanges: { min: 4, max: 5 }, mRanges: { min: 4, max: 5 } },
  { code: 'LOYAL', name: 'Loyal Customers', description: 'High frequency, good value', rRanges: { min: 3, max: 5 }, fRanges: { min: 3, max: 5 }, mRanges: { min: 3, max: 5 } },
  { code: 'POTENTIAL', name: 'Potential Loyalists', description: 'Recent, moderate frequency', rRanges: { min: 4, max: 5 }, fRanges: { min: 2, max: 3 }, mRanges: { min: 2, max: 3 } },
  { code: 'NEW', name: 'New Customers', description: 'Recent, low frequency', rRanges: { min: 4, max: 5 }, fRanges: { min: 1, max: 1 }, mRanges: { min: 1, max: 3 } },
  { code: 'PROMISING', name: 'Promising', description: 'Recent, low spend but could grow', rRanges: { min: 3, max: 4 }, fRanges: { min: 1, max: 2 }, mRanges: { min: 2, max: 3 } },
  { code: 'NEED_ATTENTION', name: 'Need Attention', description: 'Above average but declining', rRanges: { min: 2, max: 3 }, fRanges: { min: 2, max: 3 }, mRanges: { min: 2, max: 3 } },
  { code: 'ABOUT_TO_SLEEP', name: 'About to Sleep', description: 'Below average, at risk', rRanges: { min: 2, max: 3 }, fRanges: { min: 1, max: 2 }, mRanges: { min: 1, max: 2 } },
  { code: 'AT_RISK', name: 'At Risk', description: 'Were valuable, now declining', rRanges: { min: 1, max: 2 }, fRanges: { min: 2, max: 5 }, mRanges: { min: 2, max: 5 } },
  { code: 'CANNOT_LOSE', name: 'Cannot Lose Them', description: 'High value, very inactive', rRanges: { min: 1, max: 1 }, fRanges: { min: 4, max: 5 }, mRanges: { min: 4, max: 5 } },
  { code: 'HIBERNATING', name: 'Hibernating', description: 'Low across the board', rRanges: { min: 1, max: 2 }, fRanges: { min: 1, max: 2 }, mRanges: { min: 1, max: 2 } },
  { code: 'LOST', name: 'Lost', description: 'Very inactive, low value', rRanges: { min: 1, max: 1 }, fRanges: { min: 1, max: 1 }, mRanges: { min: 1, max: 1 } }
];

export class GuestSegmentationService {
  private supabase = getSupabase();

  // =============================================
  // RFM CALCULATION
  // =============================================

  async calculateRFMScores(propertyId: string): Promise<GuestProfile[]> {
    // Get all guests with their booking history
    const { data: guestBookings, error } = await this.supabase
      .from('bookings')
      .select(`
        user_id,
        users:user_id(email, first_name, last_name, phone),
        id,
        total_amount,
        room_rate,
        nights,
        check_in,
        check_out,
        created_at,
        status,
        source,
        room_type_id,
        room_types:room_type_id(name)
      `)
      .eq('property_id', propertyId)
      .not('user_id', 'is', null)
      .order('user_id')
      .order('check_in', { ascending: false });

    if (error) throw error;

    // Group by user
    const userBookings: Record<string, typeof guestBookings> = {};
    for (const booking of guestBookings || []) {
      if (!userBookings[booking.user_id]) {
        userBookings[booking.user_id] = [];
      }
      userBookings[booking.user_id].push(booking);
    }

    // Calculate RFM for each user
    const profiles: GuestProfile[] = [];
    const now = dayjs();

    for (const [userId, bookings] of Object.entries(userBookings)) {
      const validBookings = bookings.filter(b => 
        ['confirmed', 'checked_in', 'checked_out'].includes(b.status)
      );

      if (validBookings.length === 0) continue;

      // Recency: days since last check-out
      const lastBooking = validBookings[0];
      const lastCheckOut = dayjs(lastBooking.check_out);
      const recencyDays = now.diff(lastCheckOut, 'day');

      // Frequency: count of bookings
      const frequency = validBookings.length;

      // Monetary: total spend
      const monetary = validBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);

      // Calculate scores (1-5 quintiles)
      const rScore = this.calculateRScore(recencyDays);
      const fScore = this.calculateFScore(frequency);
      const mScore = this.calculateMScore(monetary);

      // Determine segment
      const segment = this.determineSegment(rScore, fScore, mScore);

      // Calculate additional metrics
      const firstBooking = validBookings[validBookings.length - 1];
      const totalNights = validBookings.reduce((sum, b) => sum + (b.nights || 1), 0);
      const avgAdr = totalNights > 0 
        ? validBookings.reduce((sum, b) => sum + (b.room_rate || 0), 0) / totalNights 
        : 0;

      // Preferred room type (most booked)
      const roomTypeCounts: Record<string, number> = {};
      for (const b of validBookings) {
        const rt = b.room_types as unknown as { name?: string } | null;
        const rtName = rt?.name || 'Unknown';
        roomTypeCounts[rtName] = (roomTypeCounts[rtName] || 0) + 1;
      }
      const preferredRoomType = Object.entries(roomTypeCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0];

      // Preferred channel
      const channelCounts: Record<string, number> = {};
      for (const b of validBookings) {
        const source = b.source || 'direct';
        channelCounts[source] = (channelCounts[source] || 0) + 1;
      }
      const preferredChannel = Object.entries(channelCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0];

      // Cancellation rate
      const allBookings = bookings;
      const cancelled = allBookings.filter(b => b.status === 'cancelled').length;
      const cancellationRate = allBookings.length > 0 
        ? (cancelled / allBookings.length) * 100 
        : 0;

      // Average lead time
      const leadTimes = validBookings.map(b => {
        const created = dayjs(b.created_at);
        const checkIn = dayjs(b.check_in);
        return checkIn.diff(created, 'day');
      });
      const avgLeadTime = leadTimes.length > 0 
        ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length 
        : 0;

      const user = lastBooking.users as unknown as { 
        email?: string; 
        first_name?: string; 
        last_name?: string; 
        phone?: string;
      } | null;

      profiles.push({
        userId,
        email: user?.email || '',
        name: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : undefined,
        phone: user?.phone,
        rfmMetrics: { recencyDays, frequency, monetary },
        rScore,
        fScore,
        mScore,
        segment: segment.code,
        segmentName: segment.name,
        lifetimeValue: monetary,
        firstBookingDate: new Date(firstBooking.check_in),
        lastBookingDate: new Date(lastBooking.check_out),
        totalNights,
        averageAdr: Math.round(avgAdr * 100) / 100,
        preferredRoomType,
        preferredChannel,
        cancellationRate: Math.round(cancellationRate * 100) / 100,
        avgLeadTime: Math.round(avgLeadTime * 100) / 100
      });
    }

    // Store calculated scores
    await this.storeRFMScores(propertyId, profiles);

    return profiles;
  }

  private calculateRScore(recencyDays: number): RFMScore {
    // Lower recency = higher score
    if (recencyDays <= 30) return 5;
    if (recencyDays <= 90) return 4;
    if (recencyDays <= 180) return 3;
    if (recencyDays <= 365) return 2;
    return 1;
  }

  private calculateFScore(frequency: number): RFMScore {
    if (frequency >= 10) return 5;
    if (frequency >= 6) return 4;
    if (frequency >= 3) return 3;
    if (frequency >= 2) return 2;
    return 1;
  }

  private calculateMScore(monetary: number): RFMScore {
    if (monetary >= 5000) return 5;
    if (monetary >= 3000) return 4;
    if (monetary >= 1500) return 3;
    if (monetary >= 500) return 2;
    return 1;
  }

  private determineSegment(r: RFMScore, f: RFMScore, m: RFMScore): GuestSegment {
    for (const segment of GUEST_SEGMENTS) {
      if (r >= segment.rRanges.min && r <= segment.rRanges.max &&
          f >= segment.fRanges.min && f <= segment.fRanges.max &&
          m >= segment.mRanges.min && m <= segment.mRanges.max) {
        return segment;
      }
    }
    return GUEST_SEGMENTS.find(s => s.code === 'HIBERNATING')!;
  }

  private async storeRFMScores(propertyId: string, profiles: GuestProfile[]): Promise<void> {
    const records = profiles.map(p => ({
      id: uuidv4(),
      property_id: propertyId,
      user_id: p.userId,
      r_score: p.rScore,
      f_score: p.fScore,
      m_score: p.mScore,
      segment: p.segment,
      lifetime_value: p.lifetimeValue,
      last_calculated_at: new Date().toISOString()
    }));

    // Upsert in batches
    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const { error } = await this.supabase
        .from('guest_rfm_scores')
        .upsert(batch, { onConflict: 'property_id,user_id' });

      if (error) {
        logger.error('Error storing RFM scores batch:', error);
      }
    }
  }

  // =============================================
  // SEGMENT ANALYSIS
  // =============================================

  async getSegmentDistribution(propertyId: string): Promise<{
    segment: string;
    count: number;
    percentage: number;
    avgLtv: number;
    totalRevenue: number;
  }[]> {
    const profiles = await this.calculateRFMScores(propertyId);

    const distribution: Record<string, {
      count: number;
      totalLtv: number;
    }> = {};

    for (const profile of profiles) {
      if (!distribution[profile.segment]) {
        distribution[profile.segment] = { count: 0, totalLtv: 0 };
      }
      distribution[profile.segment].count++;
      distribution[profile.segment].totalLtv += profile.lifetimeValue;
    }

    const totalGuests = profiles.length;
    const segmentInfo = Object.entries(distribution).map(([segment, data]) => {
      const info = GUEST_SEGMENTS.find(s => s.code === segment);
      return {
        segment: info?.name || segment,
        count: data.count,
        percentage: totalGuests > 0 ? Math.round((data.count / totalGuests) * 10000) / 100 : 0,
        avgLtv: data.count > 0 ? Math.round((data.totalLtv / data.count) * 100) / 100 : 0,
        totalRevenue: Math.round(data.totalLtv * 100) / 100
      };
    });

    return segmentInfo.sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  async getGuestsBySegment(
    propertyId: string,
    segmentCode: string
  ): Promise<GuestProfile[]> {
    const profiles = await this.calculateRFMScores(propertyId);
    return profiles.filter(p => p.segment === segmentCode);
  }

  // =============================================
  // COHORT ANALYSIS
  // =============================================

  async calculateCohortAnalysis(propertyId: string): Promise<CohortAnalysis[]> {
    // Get all bookings grouped by user and month
    const { data: bookings, error } = await this.supabase
      .from('bookings')
      .select('user_id, check_in, total_amount, created_at, status')
      .eq('property_id', propertyId)
      .not('user_id', 'is', null)
      .order('user_id')
      .order('check_in');

    if (error) throw error;

    // Group by user
    const userBookings: Record<string, typeof bookings> = {};
    for (const booking of bookings || []) {
      if (!userBookings[booking.user_id]) {
        userBookings[booking.user_id] = [];
      }
      userBookings[booking.user_id].push(booking);
    }

    // Determine cohort (first booking month) for each user
    const userCohorts: Record<string, string> = {};
    for (const [userId, userBks] of Object.entries(userBookings)) {
      const firstBooking = userBks[0];
      userCohorts[userId] = dayjs(firstBooking.check_in).format('YYYY-MM');
    }

    // Group users by cohort
    const cohorts: Record<string, string[]> = {};
    for (const [userId, cohort] of Object.entries(userCohorts)) {
      if (!cohorts[cohort]) {
        cohorts[cohort] = [];
      }
      cohorts[cohort].push(userId);
    }

    // Calculate retention and revenue for each cohort
    const analysis: CohortAnalysis[] = [];

    for (const [cohortMonth, userIds] of Object.entries(cohorts)) {
      const cohortSize = userIds.length;
      const retentionRates: number[] = [];
      const revenueByMonth: number[] = [];

      // Calculate for months 0-11
      const cohortStart = dayjs(cohortMonth + '-01');
      
      for (let month = 0; month < 12; month++) {
        const monthStart = cohortStart.add(month, 'month');
        const monthEnd = monthStart.endOf('month');

        // Count users who made a booking in this month
        let activeUsers = 0;
        let monthRevenue = 0;

        for (const userId of userIds) {
          const hasBooking = userBookings[userId].some(b => {
            if (!['confirmed', 'checked_in', 'checked_out'].includes(b.status)) return false;
            const checkIn = dayjs(b.check_in);
            return checkIn.isAfter(monthStart.subtract(1, 'day')) && 
                   checkIn.isBefore(monthEnd.add(1, 'day'));
          });

          if (hasBooking) {
            activeUsers++;
            monthRevenue += userBookings[userId]
              .filter(b => {
                if (!['confirmed', 'checked_in', 'checked_out'].includes(b.status)) return false;
                const checkIn = dayjs(b.check_in);
                return checkIn.isAfter(monthStart.subtract(1, 'day')) && 
                       checkIn.isBefore(monthEnd.add(1, 'day'));
              })
              .reduce((sum, b) => sum + (b.total_amount || 0), 0);
          }
        }

        const retentionRate = cohortSize > 0 ? (activeUsers / cohortSize) * 100 : 0;
        retentionRates.push(Math.round(retentionRate * 100) / 100);
        revenueByMonth.push(Math.round(monthRevenue * 100) / 100);
      }

      // Calculate average LTV
      let totalLtv = 0;
      for (const userId of userIds) {
        totalLtv += userBookings[userId]
          .filter(b => ['confirmed', 'checked_in', 'checked_out'].includes(b.status))
          .reduce((sum, b) => sum + (b.total_amount || 0), 0);
      }

      analysis.push({
        cohortMonth,
        cohortSize,
        retentionRates,
        revenueByMonth,
        averageLtv: cohortSize > 0 ? Math.round((totalLtv / cohortSize) * 100) / 100 : 0
      });
    }

    return analysis.sort((a, b) => b.cohortMonth.localeCompare(a.cohortMonth));
  }

  // =============================================
  // SEGMENT RECOMMENDATIONS
  // =============================================

  async getSegmentRecommendations(propertyId: string): Promise<{
    segment: string;
    actions: string[];
    priority: 'high' | 'medium' | 'low';
  }[]> {
    const distribution = await this.getSegmentDistribution(propertyId);
    const recommendations: {
      segment: string;
      actions: string[];
      priority: 'high' | 'medium' | 'low';
    }[] = [];

    for (const segment of distribution) {
      const actions: string[] = [];
      let priority: 'high' | 'medium' | 'low' = 'low';

      switch (segment.segment) {
        case 'Champions':
          actions.push('Reward with exclusive offers and VIP treatment');
          actions.push('Ask for referrals and testimonials');
          actions.push('Early access to new amenities');
          priority = 'high';
          break;

        case 'At Risk':
        case 'Cannot Lose Them':
          actions.push('Send personalized win-back campaign');
          actions.push('Offer special discount on next booking');
          actions.push('Reach out via phone call from management');
          priority = 'high';
          break;

        case 'Potential Loyalists':
          actions.push('Enroll in loyalty program');
          actions.push('Send targeted offers to increase frequency');
          actions.push('Request feedback on recent stay');
          priority = 'medium';
          break;

        case 'New Customers':
          actions.push('Send welcome email with property guide');
          actions.push('Offer discount on second booking within 30 days');
          actions.push('Follow up for review after stay');
          priority = 'medium';
          break;

        case 'Hibernating':
        case 'Lost':
          actions.push('Send re-engagement email with special offer');
          actions.push('Consider removing from regular marketing');
          priority = 'low';
          break;
      }

      recommendations.push({
        segment: segment.segment,
        actions,
        priority
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }
}

export const guestSegmentationService = new GuestSegmentationService();
