/**
 * Revenue Management Service
 * Phase 3.2: Demand Forecasting, Dynamic Pricing, Yield Management
 * Refactored to use Supabase instead of Prisma
 */

import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';
import { getSupabase } from '../../database/connection.js';

// Types
interface DemandForecast {
  date: Date;
  roomTypeId?: string;
  forecastedDemand: number;
  forecastedOccupancy: number;
  forecastedAdr?: number;
  forecastedRevenue?: number;
  confidenceInterval: { low: number; high: number };
  factors: Record<string, any>;
}

interface PricingRule {
  id?: string;
  name: string;
  description?: string;
  ruleType: string;
  roomTypeIds?: string[];
  ratePlanIds?: string[];
  conditions: Record<string, any>;
  adjustmentType: 'percentage' | 'fixed' | 'multiplier' | 'absolute';
  adjustmentValue: number;
  minRate?: number;
  maxRate?: number;
  priority?: number;
  startDate?: Date;
  endDate?: Date;
  isActive?: boolean;
}

interface RateRecommendation {
  date: Date;
  roomTypeId?: string;
  currentRate: number;
  recommendedRate: number;
  reasonCode: string;
  reasoning: string;
  supportingData: Record<string, any>;
  estimatedRevenueImpact: number;
}

interface MarketEvent {
  id?: string;
  name: string;
  description?: string;
  eventType: string;
  startDate: Date;
  endDate: Date;
  expectedDemandImpact?: number;
  expectedRateImpact?: number;
  location?: string;
  distanceKm?: number;
  expectedAttendance?: number;
}

export class RevenueManagementService {
  private get supabase() {
    return getSupabase();
  }

  // =============================================
  // DEMAND FORECASTING
  // =============================================

  async generateForecasts(
    propertyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    // Generate forecasts for each day in range
    let count = 0;
    let currentDate = new Date(startDate);

    // Get room types
    const { data: roomTypes } = await this.supabase
      .from('room_types')
      .select('id, base_rate')
      .eq('property_id', propertyId);

    while (currentDate <= endDate) {
      for (const rt of (roomTypes || [])) {
        // Simple forecast based on historical data
        const { data: historicalData } = await this.supabase
          .from('transactions')
          .select('*')
          .eq('engine_type', 'time_exclusive_reservation')
          .eq('property_id', propertyId)
          .filter('metadata->>check_in_date', 'gte',, dayjs(currentDate).subtract(365, 'day').format('YYYY-MM-DD'))
          .lte('check_in', dayjs(currentDate).subtract(335, 'day').format('YYYY-MM-DD'));

        const avgDemand = historicalData?.length || 5;

        await this.supabase
          .from('demand_forecasts')
          .upsert({
            id: uuidv4(),
            property_id: propertyId,
            room_type_id: rt.id,
            forecast_date: dayjs(currentDate).format('YYYY-MM-DD'),
            forecasted_demand: avgDemand,
            forecasted_occupancy: Math.min(avgDemand * 10, 100),
            forecasted_adr: rt.base_rate,
            demand_low: avgDemand * 0.8,
            demand_high: avgDemand * 1.2,
            factors: {},
            model_version: '1.0'
          }, {
            onConflict: 'property_id,room_type_id,forecast_date'
          });
        count++;
      }
      currentDate = dayjs(currentDate).add(1, 'day').toDate();
    }

    return count;
  }

  async getForecasts(
    propertyId: string,
    startDate: Date,
    endDate: Date,
    roomTypeId?: string
  ): Promise<DemandForecast[]> {
    let query = this.supabase
      .from('demand_forecasts')
      .select('*, room_types(name)')
      .eq('property_id', propertyId)
      .gte('forecast_date', dayjs(startDate).format('YYYY-MM-DD'))
      .lte('forecast_date', dayjs(endDate).format('YYYY-MM-DD'));

    if (roomTypeId) {
      query = query.eq('room_type_id', roomTypeId);
    }

    const { data: forecasts, error } = await query.order('forecast_date');

    if (error) throw error;

    return (forecasts || []).map((f: any) => ({
      date: f.forecast_date,
      roomTypeId: f.room_type_id,
      roomTypeName: (f.room_types as any)?.name,
      forecastedDemand: parseFloat(f.forecasted_demand),
      forecastedOccupancy: parseFloat(f.forecasted_occupancy || 0),
      forecastedAdr: f.forecasted_adr ? parseFloat(f.forecasted_adr) : undefined,
      forecastedRevenue: f.forecasted_revenue ? parseFloat(f.forecasted_revenue) : undefined,
      confidenceInterval: {
        low: parseFloat(f.demand_low || f.forecasted_demand * 0.8),
        high: parseFloat(f.demand_high || f.forecasted_demand * 1.2)
      },
      factors: f.factors || {},
      actualDemand: f.actual_demand,
      actualOccupancy: f.actual_occupancy ? parseFloat(f.actual_occupancy) : undefined,
      forecastAccuracy: f.forecast_accuracy ? parseFloat(f.forecast_accuracy) : undefined
    }));
  }

  async updateForecastActuals(propertyId: string, date: Date): Promise<void> {
    // Get actual booking data for the date
    const { data: bookings } = await this.supabase
      .from('transactions')
      .select('room_id, room_rate, amount')
      .eq('engine_type', 'time_exclusive_reservation')
      .eq('property_id', propertyId)
      .lte('check_in', dayjs(date).format('YYYY-MM-DD'))
      .gt('check_out', dayjs(date).format('YYYY-MM-DD'))
      .not('status', 'in', '("cancelled","no_show")');

    const roomsSold = bookings?.length || 0;

    const { data: totalRooms } = await this.supabase
      .from('rooms')
      .select('id', { count: 'exact' })
      .eq('property_id', propertyId);

    const totalRoomCount = totalRooms?.length || 1;
    const occupancy = (roomsSold / totalRoomCount) * 100;
    const adr = roomsSold > 0
      ? bookings!.reduce((sum, b) => sum + (b.room_rate || 0), 0) / roomsSold
      : 0;
    const revenue = bookings?.reduce((sum, b) => sum + (b.amount || 0), 0) || 0;

    // Update all forecasts for this date
    await this.supabase
      .from('demand_forecasts')
      .update({
        actual_demand: roomsSold,
        actual_occupancy: occupancy,
        actual_adr: adr,
        actual_revenue: revenue,
        updated_at: new Date().toISOString()
      })
      .eq('property_id', propertyId)
      .eq('forecast_date', dayjs(date).format('YYYY-MM-DD'));
  }

  // =============================================
  // PRICING RULES
  // =============================================

  async getPricingRules(propertyId: string, activeOnly: boolean = true): Promise<PricingRule[]> {
    let query = this.supabase
      .from('pricing_rules')
      .select('*')
      .eq('property_id', propertyId);

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data: rules, error } = await query.order('priority').order('created_at');

    if (error) throw error;

    return (rules || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      ruleType: r.rule_type,
      roomTypeIds: r.room_type_ids,
      ratePlanIds: r.rate_plan_ids,
      channelIds: r.channel_ids,
      conditions: r.conditions,
      adjustmentType: r.adjustment_type,
      adjustmentValue: parseFloat(r.adjustment_value),
      minRate: r.min_rate ? parseFloat(r.min_rate) : undefined,
      maxRate: r.max_rate ? parseFloat(r.max_rate) : undefined,
      maxAdjustmentPercent: r.max_adjustment_percent ? parseFloat(r.max_adjustment_percent) : undefined,
      priority: r.priority,
      startDate: r.start_date,
      endDate: r.end_date,
      isActive: r.is_active,
      createdAt: r.created_at
    }));
  }

  async createPricingRule(propertyId: string, rule: PricingRule, userId: string): Promise<PricingRule> {
    const id = uuidv4();
    const { data, error } = await this.supabase
      .from('pricing_rules')
      .insert({
        id,
        property_id: propertyId,
        name: rule.name,
        description: rule.description,
        rule_type: rule.ruleType,
        room_type_ids: rule.roomTypeIds || [],
        rate_plan_ids: rule.ratePlanIds || [],
        conditions: rule.conditions,
        adjustment_type: rule.adjustmentType,
        adjustment_value: rule.adjustmentValue,
        min_rate: rule.minRate,
        max_rate: rule.maxRate,
        priority: rule.priority || 100,
        start_date: rule.startDate ? dayjs(rule.startDate).format('YYYY-MM-DD') : null,
        end_date: rule.endDate ? dayjs(rule.endDate).format('YYYY-MM-DD') : null,
        is_active: rule.isActive !== false,
        created_by: userId
      })
      .select()
      .single();

    if (error) throw error;

    // Log the change
    await this.logYieldChange(propertyId, null, null, 'rate_change', null, {
      rule_id: id,
      rule_name: rule.name,
      adjustment: rule.adjustmentValue
    }, 'rule_created', 'user', userId);

    return { ...rule, id };
  }

  async updatePricingRule(ruleId: string, updates: Partial<PricingRule>): Promise<void> {
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.conditions !== undefined) updateData.conditions = updates.conditions;
    if (updates.adjustmentValue !== undefined) updateData.adjustment_value = updates.adjustmentValue;
    if (updates.minRate !== undefined) updateData.min_rate = updates.minRate;
    if (updates.maxRate !== undefined) updateData.max_rate = updates.maxRate;
    if (updates.priority !== undefined) updateData.priority = updates.priority;
    if (updates.startDate !== undefined) updateData.start_date = dayjs(updates.startDate).format('YYYY-MM-DD');
    if (updates.endDate !== undefined) updateData.end_date = dayjs(updates.endDate).format('YYYY-MM-DD');
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

    const { error } = await this.supabase
      .from('pricing_rules')
      .update(updateData)
      .eq('id', ruleId);

    if (error) throw error;
  }

  async deletePricingRule(ruleId: string): Promise<void> {
    const { error } = await this.supabase
      .from('pricing_rules')
      .delete()
      .eq('id', ruleId);

    if (error) throw error;
  }

  // =============================================
  // DYNAMIC RATE CALCULATION
  // =============================================

  async calculateDynamicRate(
    propertyId: string,
    roomTypeId: string,
    date: Date
  ): Promise<{ baseRate: number; finalRate: number; breakdown: Record<string, number> }> {
    // Get room type base rate
    const { data: roomType } = await this.supabase
      .from('room_types')
      .select('base_rate')
      .eq('id', roomTypeId)
      .single();

    const baseRate = roomType?.base_rate || 100;
    const breakdown: Record<string, number> = { base: baseRate };
    let finalRate = baseRate;

    // Apply pricing rules
    const rules = await this.getPricingRules(propertyId, true);
    const dateStr = dayjs(date).format('YYYY-MM-DD');

    for (const rule of rules) {
      // Check if rule applies to this room type
      if (rule.roomTypeIds && rule.roomTypeIds.length > 0 && !rule.roomTypeIds.includes(roomTypeId)) {
        continue;
      }

      // Check date range
      if (rule.startDate && dateStr < dayjs(rule.startDate).format('YYYY-MM-DD')) continue;
      if (rule.endDate && dateStr > dayjs(rule.endDate).format('YYYY-MM-DD')) continue;

      // Apply adjustment
      let adjustment = 0;
      switch (rule.adjustmentType) {
        case 'percentage':
          adjustment = finalRate * (rule.adjustmentValue / 100);
          break;
        case 'fixed':
          adjustment = rule.adjustmentValue;
          break;
        case 'multiplier':
          adjustment = finalRate * (rule.adjustmentValue - 1);
          break;
        case 'absolute':
          finalRate = rule.adjustmentValue;
          adjustment = 0;
          break;
      }

      finalRate += adjustment;
      breakdown[rule.name] = adjustment;

      // Apply min/max constraints
      if (rule.minRate && finalRate < rule.minRate) finalRate = rule.minRate;
      if (rule.maxRate && finalRate > rule.maxRate) finalRate = rule.maxRate;
    }

    return { baseRate, finalRate, breakdown };
  }

  async calculateRatesForRange(
    propertyId: string,
    roomTypeId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ date: Date; baseRate: number; finalRate: number; breakdown: Record<string, number> }>> {
    const results: any[] = [];
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const rate = await this.calculateDynamicRate(propertyId, roomTypeId, currentDate);
      results.push({
        date: new Date(currentDate),
        ...rate
      });
      currentDate = dayjs(currentDate).add(1, 'day').toDate();
    }

    return results;
  }

  // =============================================
  // PRICING CALENDAR
  // =============================================

  async getPricingCalendar(
    propertyId: string,
    startDate: Date,
    endDate: Date,
    roomTypeId?: string
  ): Promise<any[]> {
    let query = this.supabase
      .from('pricing_calendar')
      .select('*, room_types(name, base_rate)')
      .eq('property_id', propertyId)
      .gte('date', dayjs(startDate).format('YYYY-MM-DD'))
      .lte('date', dayjs(endDate).format('YYYY-MM-DD'));

    if (roomTypeId) {
      query = query.eq('room_type_id', roomTypeId);
    }

    const { data, error } = await query.order('date');

    if (error) throw error;
    return data || [];
  }

  async updatePricingCalendar(
    propertyId: string,
    roomTypeId: string,
    date: Date,
    updates: {
      overrideRate?: number;
      overrideReason?: string;
      minStay?: number;
      maxStay?: number;
      closedToArrival?: boolean;
      closedToDeparture?: boolean;
      isLocked?: boolean;
    },
    userId: string
  ): Promise<void> {
    // Get calculated rate if needed
    let baseRate = 0;
    let recommendedRate = 0;

    if (updates.overrideRate !== undefined) {
      const calculated = await this.calculateDynamicRate(propertyId, roomTypeId, date);
      baseRate = calculated.baseRate;
      recommendedRate = calculated.finalRate;
    }

    const { error } = await this.supabase
      .from('pricing_calendar')
      .upsert({
        id: uuidv4(),
        property_id: propertyId,
        room_type_id: roomTypeId,
        date: dayjs(date).format('YYYY-MM-DD'),
        base_rate: baseRate || undefined,
        recommended_rate: recommendedRate || undefined,
        final_rate: updates.overrideRate,
        is_override: updates.overrideRate !== undefined,
        override_rate: updates.overrideRate,
        override_reason: updates.overrideReason,
        override_by: updates.overrideRate !== undefined ? userId : undefined,
        override_at: updates.overrideRate !== undefined ? new Date().toISOString() : undefined,
        is_locked: updates.isLocked,
        locked_by: updates.isLocked ? userId : undefined,
        locked_at: updates.isLocked ? new Date().toISOString() : undefined,
        min_stay: updates.minStay || 1,
        max_stay: updates.maxStay,
        closed_to_arrival: updates.closedToArrival || false,
        closed_to_departure: updates.closedToDeparture || false
      }, {
        onConflict: 'property_id,date,room_type_id'
      });

    if (error) throw error;

    // Log the change
    if (updates.overrideRate !== undefined) {
      await this.logYieldChange(propertyId, date, roomTypeId, 'manual_override',
        { rate: recommendedRate },
        { rate: updates.overrideRate, reason: updates.overrideReason },
        'rate_override', 'user', userId);
    }
  }

  async bulkUpdatePricingCalendar(
    propertyId: string,
    roomTypeId: string,
    startDate: Date,
    endDate: Date,
    updates: {
      overrideRate?: number;
      overrideReason?: string;
      minStay?: number;
      maxStay?: number;
      closedToArrival?: boolean;
      closedToDeparture?: boolean;
    },
    userId: string
  ): Promise<number> {
    let count = 0;
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      await this.updatePricingCalendar(propertyId, roomTypeId, currentDate, updates, userId);
      currentDate = dayjs(currentDate).add(1, 'day').toDate();
      count++;
    }

    return count;
  }

  // =============================================
  // RATE RECOMMENDATIONS
  // =============================================

  async generateRecommendations(propertyId: string, date: Date): Promise<RateRecommendation[]> {
    const recommendations: RateRecommendation[] = [];

    // Get room types
    const { data: roomTypes } = await this.supabase
      .from('room_types')
      .select('id, name, base_rate')
      .eq('property_id', propertyId);

    for (const roomType of (roomTypes || [])) {
      // Get current rate
      const { data: currentCalendar } = await this.supabase
        .from('pricing_calendar')
        .select('override_rate, final_rate')
        .eq('property_id', propertyId)
        .eq('room_type_id', roomType.id)
        .eq('date', dayjs(date).format('YYYY-MM-DD'))
        .maybeSingle();

      const currentRate = currentCalendar?.override_rate || currentCalendar?.final_rate || roomType.base_rate;

      // Calculate dynamic rate
      const { finalRate, breakdown } = await this.calculateDynamicRate(propertyId, roomType.id, date);

      // Get forecast
      const { data: forecast } = await this.supabase
        .from('demand_forecasts')
        .select('*')
        .eq('property_id', propertyId)
        .eq('room_type_id', roomType.id)
        .eq('forecast_date', dayjs(date).format('YYYY-MM-DD'))
        .maybeSingle();

      // Get competitor rates
      const { data: competitors } = await this.supabase
        .from('competitor_rates')
        .select('rate')
        .eq('property_id', propertyId)
        .eq('date', dayjs(date).format('YYYY-MM-DD'));

      const avgCompRate = competitors && competitors.length > 0
        ? competitors.reduce((sum, c) => sum + c.rate, 0) / competitors.length
        : null;

      // Determine recommendation reason
      let reasonCode = 'demand_forecast';
      let reasoning = '';

      const rateDiff = finalRate - currentRate;
      const rateDiffPercent = (rateDiff / currentRate) * 100;

      if (Math.abs(rateDiffPercent) < 5) {
        continue; // No significant change needed
      }

      if (forecast?.forecasted_occupancy && forecast.forecasted_occupancy > 85) {
        reasonCode = 'high_occupancy';
        reasoning = `Forecasted occupancy is ${parseFloat(forecast.forecasted_occupancy).toFixed(1)}%. Consider increasing rates.`;
      } else if (forecast?.forecasted_occupancy && forecast.forecasted_occupancy < 40) {
        reasonCode = 'low_occupancy';
        reasoning = `Forecasted occupancy is only ${parseFloat(forecast.forecasted_occupancy).toFixed(1)}%. Consider lowering rates to drive demand.`;
      } else if (avgCompRate && currentRate > avgCompRate * 1.15) {
        reasonCode = 'competitor_rates';
        reasoning = `Your rate is ${((currentRate / avgCompRate - 1) * 100).toFixed(1)}% above competitor average.`;
      }

      // Estimate revenue impact
      const daysUntil = dayjs(date).diff(dayjs(), 'day');
      const estimatedBookingProbability = daysUntil > 30 ? 0.3 : daysUntil > 7 ? 0.6 : 0.9;
      const estimatedRevenueImpact = rateDiff * estimatedBookingProbability * (forecast?.forecasted_demand || 1);

      const recommendation: RateRecommendation = {
        date,
        roomTypeId: roomType.id,
        currentRate: parseFloat(String(currentRate)),
        recommendedRate: finalRate,
        reasonCode,
        reasoning,
        supportingData: {
          forecast: forecast ? {
            demand: parseFloat(forecast.forecasted_demand),
            occupancy: parseFloat(forecast.forecasted_occupancy)
          } : null,
          competitors: avgCompRate ? { avg_rate: avgCompRate } : null,
          breakdown
        },
        estimatedRevenueImpact
      };

      recommendations.push(recommendation);

      // Save recommendation
      await this.supabase
        .from('rate_recommendations')
        .upsert({
          id: uuidv4(),
          property_id: propertyId,
          date: dayjs(date).format('YYYY-MM-DD'),
          room_type_id: roomType.id,
          current_rate: currentRate,
          recommended_rate: finalRate,
          rate_change: rateDiff,
          rate_change_percent: rateDiffPercent,
          reason_code: reasonCode,
          reasoning,
          supporting_data: recommendation.supportingData,
          estimated_revenue_impact: estimatedRevenueImpact,
          valid_until: dayjs().add(7, 'day').format('YYYY-MM-DD'),
          status: 'pending'
        }, {
          onConflict: 'property_id,date,room_type_id'
        });
    }

    return recommendations;
  }

  async getRecommendations(
    propertyId: string,
    status: string = 'pending'
  ): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('rate_recommendations')
      .select('*, room_types(name)')
      .eq('property_id', propertyId)
      .eq('status', status)
      .gt('valid_until', new Date().toISOString())
      .order('estimated_revenue_impact', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async respondToRecommendation(
    recommendationId: string,
    status: 'accepted' | 'rejected',
    userId: string,
    notes?: string
  ): Promise<void> {
    const { data: rec } = await this.supabase
      .from('rate_recommendations')
      .select('*')
      .eq('id', recommendationId)
      .single();

    if (!rec) {
      throw new Error('Recommendation not found');
    }

    // Update recommendation status
    await this.supabase
      .from('rate_recommendations')
      .update({
        status,
        responded_by: userId,
        responded_at: new Date().toISOString(),
        response_notes: notes
      })
      .eq('id', recommendationId);

    // If accepted, apply the rate
    if (status === 'accepted') {
      await this.updatePricingCalendar(
        rec.property_id,
        rec.room_type_id,
        new Date(rec.date),
        {
          overrideRate: parseFloat(rec.recommended_rate),
          overrideReason: `Accepted recommendation: ${rec.reasoning}`
        },
        userId
      );
    }

    // Log the action
    await this.logYieldChange(
      rec.property_id,
      new Date(rec.date),
      rec.room_type_id,
      status === 'accepted' ? 'recommendation_accepted' : 'recommendation_rejected',
      { rate: parseFloat(rec.current_rate) },
      { rate: status === 'accepted' ? parseFloat(rec.recommended_rate) : parseFloat(rec.current_rate) },
      rec.reason_code,
      'user',
      userId
    );
  }

  // =============================================
  // MARKET EVENTS
  // =============================================

  async getMarketEvents(
    propertyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<MarketEvent[]> {
    const { data: events, error } = await this.supabase
      .from('market_events')
      .select('*')
      .or(`property_id.is.null,property_id.eq.${propertyId}`)
      .lte('start_date', dayjs(endDate).format('YYYY-MM-DD'))
      .gte('end_date', dayjs(startDate).format('YYYY-MM-DD'))
      .order('start_date');

    if (error) throw error;

    return (events || []).map((e: any) => ({
      id: e.id,
      name: e.name,
      description: e.description,
      eventType: e.event_type,
      startDate: e.start_date,
      endDate: e.end_date,
      expectedDemandImpact: e.expected_demand_impact ? parseFloat(e.expected_demand_impact) : undefined,
      expectedRateImpact: e.expected_rate_impact ? parseFloat(e.expected_rate_impact) : undefined,
      location: e.location,
      distanceKm: e.distance_km ? parseFloat(e.distance_km) : undefined,
      expectedAttendance: e.expected_attendance
    }));
  }

  async createMarketEvent(
    propertyId: string | null,
    event: MarketEvent,
    userId: string
  ): Promise<MarketEvent> {
    const id = uuidv4();
    const { error } = await this.supabase
      .from('market_events')
      .insert({
        id,
        property_id: propertyId,
        name: event.name,
        description: event.description,
        event_type: event.eventType,
        start_date: dayjs(event.startDate).format('YYYY-MM-DD'),
        end_date: dayjs(event.endDate).format('YYYY-MM-DD'),
        expected_demand_impact: event.expectedDemandImpact,
        expected_rate_impact: event.expectedRateImpact,
        location: event.location,
        distance_km: event.distanceKm,
        expected_attendance: event.expectedAttendance,
        created_by: userId
      });

    if (error) throw error;
    return { ...event, id };
  }

  async updateMarketEvent(eventId: string, updates: Partial<MarketEvent>): Promise<void> {
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.eventType !== undefined) updateData.event_type = updates.eventType;
    if (updates.startDate !== undefined) updateData.start_date = dayjs(updates.startDate).format('YYYY-MM-DD');
    if (updates.endDate !== undefined) updateData.end_date = dayjs(updates.endDate).format('YYYY-MM-DD');
    if (updates.expectedDemandImpact !== undefined) updateData.expected_demand_impact = updates.expectedDemandImpact;
    if (updates.expectedRateImpact !== undefined) updateData.expected_rate_impact = updates.expectedRateImpact;

    const { error } = await this.supabase
      .from('market_events')
      .update(updateData)
      .eq('id', eventId);

    if (error) throw error;
  }

  async deleteMarketEvent(eventId: string): Promise<void> {
    const { error } = await this.supabase
      .from('market_events')
      .delete()
      .eq('id', eventId);

    if (error) throw error;
  }

  // =============================================
  // COMPETITOR RATES
  // =============================================

  async recordCompetitorRate(
    propertyId: string,
    competitorName: string,
    date: Date,
    rate: number,
    options?: {
      competitorSource?: string;
      roomTypeName?: string;
      rateType?: string;
      isAvailable?: boolean;
      isPromotion?: boolean;
      promotionDetails?: string;
    }
  ): Promise<void> {
    const { error } = await this.supabase
      .from('competitor_rates')
      .upsert({
        id: uuidv4(),
        property_id: propertyId,
        competitor_name: competitorName,
        competitor_source: options?.competitorSource,
        date: dayjs(date).format('YYYY-MM-DD'),
        room_type_name: options?.roomTypeName,
        rate,
        rate_type: options?.rateType || 'room_only',
        is_available: options?.isAvailable !== false,
        is_promotion: options?.isPromotion || false,
        promotion_details: options?.promotionDetails,
        collected_at: new Date().toISOString()
      }, {
        onConflict: 'property_id,competitor_name,date,room_type_name,rate_type'
      });

    if (error) throw error;
  }

  async getCompetitorRates(
    propertyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('competitor_rates')
      .select('date, competitor_name, rate')
      .eq('property_id', propertyId)
      .gte('date', dayjs(startDate).format('YYYY-MM-DD'))
      .lte('date', dayjs(endDate).format('YYYY-MM-DD'))
      .order('date')
      .order('competitor_name');

    if (error) throw error;

    // Group by date and competitor
    const grouped: Record<string, Record<string, { rates: number[]; count: number }>> = {};
    for (const row of (data || [])) {
      if (!grouped[row.date]) grouped[row.date] = {};
      if (!grouped[row.date][row.competitor_name]) {
        grouped[row.date][row.competitor_name] = { rates: [], count: 0 };
      }
      grouped[row.date][row.competitor_name].rates.push(row.rate);
      grouped[row.date][row.competitor_name].count++;
    }

    const result: any[] = [];
    for (const [date, competitors] of Object.entries(grouped)) {
      for (const [competitor_name, stats] of Object.entries(competitors)) {
        const rates = stats.rates;
        result.push({
          date,
          competitor_name,
          avg_rate: rates.reduce((a, b) => a + b, 0) / rates.length,
          min_rate: Math.min(...rates),
          max_rate: Math.max(...rates),
          data_points: stats.count
        });
      }
    }

    return result;
  }

  // =============================================
  // SEASONALITY PATTERNS
  // =============================================

  async getSeasonalityPatterns(propertyId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('seasonality_patterns')
      .select('*')
      .eq('property_id', propertyId)
      .order('pattern_type')
      .order('name');

    if (error) throw error;
    return data || [];
  }

  async createSeasonalityPattern(
    propertyId: string,
    pattern: {
      name: string;
      patternType: 'day_of_week' | 'month' | 'season' | 'custom_period';
      multipliers: Record<string, number>;
      periods?: Array<{ name: string; start: string; end: string; multiplier: number }>;
    }
  ): Promise<any> {
    const { data, error } = await this.supabase
      .from('seasonality_patterns')
      .insert({
        id: uuidv4(),
        property_id: propertyId,
        name: pattern.name,
        pattern_type: pattern.patternType,
        multipliers: pattern.multipliers,
        periods: pattern.periods
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateSeasonalityPattern(
    patternId: string,
    updates: Partial<{
      name: string;
      multipliers: Record<string, number>;
      periods: any[];
      isActive: boolean;
    }>
  ): Promise<void> {
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.multipliers !== undefined) updateData.multipliers = updates.multipliers;
    if (updates.periods !== undefined) updateData.periods = updates.periods;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

    const { error } = await this.supabase
      .from('seasonality_patterns')
      .update(updateData)
      .eq('id', patternId);

    if (error) throw error;
  }

  // =============================================
  // YIELD MANAGEMENT LOG
  // =============================================

  private async logYieldChange(
    propertyId: string,
    date: Date | null,
    roomTypeId: string | null,
    actionType: string,
    previousValue: any,
    newValue: any,
    reasonCode: string,
    triggeredBy: 'system' | 'user' | 'rule' | 'api',
    userId?: string,
    ruleId?: string
  ): Promise<void> {
    await this.supabase
      .from('yield_management_log')
      .insert({
        id: uuidv4(),
        property_id: propertyId,
        date: date ? dayjs(date).format('YYYY-MM-DD') : null,
        room_type_id: roomTypeId,
        action_type: actionType,
        previous_value: previousValue,
        new_value: newValue,
        reason_code: reasonCode,
        triggered_by: triggeredBy,
        user_id: userId,
        rule_id: ruleId
      });
  }

  async getYieldManagementLog(
    propertyId: string,
    startDate: Date,
    endDate: Date,
    actionType?: string
  ): Promise<any[]> {
    let query = this.supabase
      .from('yield_management_log')
      .select('*, users(full_name), room_types(name), pricing_rules(name)')
      .eq('property_id', propertyId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (actionType) {
      query = query.eq('action_type', actionType);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // =============================================
  // REVENUE ANALYTICS
  // =============================================

  async getRevenueSummary(
    propertyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    const { data: bookings } = await this.supabase
      .from('transactions')
      .select('amount, room_rate, nights')
      .eq('engine_type', 'time_exclusive_reservation')
      .eq('property_id', propertyId)
      .filter('metadata->>check_in_date', 'gte',, dayjs(startDate).format('YYYY-MM-DD'))
      .lte('check_in', dayjs(endDate).format('YYYY-MM-DD'))
      .not('status', 'in', '("cancelled","no_show")');

    const totalRevenue = bookings?.reduce((sum, b) => sum + (b.amount || 0), 0) || 0;
    const totalBookings = bookings?.length || 0;
    const roomNightsSold = bookings?.reduce((sum, b) => sum + (b.nights || 0), 0) || 0;
    const adr = roomNightsSold > 0
      ? bookings!.reduce((sum, b) => sum + (b.room_rate || 0), 0) / totalBookings
      : 0;

    // Get available inventory
    const { data: rooms, count: roomCount } = await this.supabase
      .from('rooms')
      .select('id', { count: 'exact' })
      .eq('property_id', propertyId)
      .eq('status', 'active');

    const daysInRange = dayjs(endDate).diff(dayjs(startDate), 'day') + 1;
    const availableRoomNights = (roomCount || 0) * daysInRange;
    const occupancy = availableRoomNights > 0 ? (roomNightsSold / availableRoomNights) * 100 : 0;
    const revpar = availableRoomNights > 0 ? totalRevenue / availableRoomNights : 0;

    return {
      totalRevenue,
      totalBookings,
      adr,
      roomNightsSold,
      availableRoomNights,
      occupancy,
      revpar
    };
  }

  async getRevenueByRoomType(
    propertyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    const { data: roomTypes } = await this.supabase
      .from('room_types')
      .select('id, name')
      .eq('property_id', propertyId);

    const results: any[] = [];

    for (const rt of (roomTypes || [])) {
      const { data: roomIds } = await this.supabase
        .from('rooms')
        .select('id')
        .eq('room_type_id', rt.id);

      const roomIdList = roomIds?.map(r => r.id) || [];

      if (roomIdList.length === 0) {
        results.push({
          id: rt.id,
          name: rt.name,
          bookings: 0,
          revenue: 0,
          avg_rate: 0,
          room_nights: 0
        });
        continue;
      }

      const { data: bookings } = await this.supabase
        .from('transactions')
        .select('amount, room_rate, nights')
        .eq('engine_type', 'time_exclusive_reservation')
        .in('room_id', roomIdList)
        .filter('metadata->>check_in_date', 'gte',, dayjs(startDate).format('YYYY-MM-DD'))
        .lte('check_in', dayjs(endDate).format('YYYY-MM-DD'))
        .not('status', 'in', '("cancelled","no_show")');

      const revenue = bookings?.reduce((sum, b) => sum + (b.amount || 0), 0) || 0;
      const bookingCount = bookings?.length || 0;
      const roomNights = bookings?.reduce((sum, b) => sum + (b.nights || 0), 0) || 0;
      const avgRate = bookingCount > 0
        ? bookings!.reduce((sum, b) => sum + (b.room_rate || 0), 0) / bookingCount
        : 0;

      results.push({
        id: rt.id,
        name: rt.name,
        bookings: bookingCount,
        revenue,
        avg_rate: avgRate,
        room_nights: roomNights
      });
    }

    return results.sort((a, b) => b.revenue - a.revenue);
  }
}

export const revenueManagementService = new RevenueManagementService();
