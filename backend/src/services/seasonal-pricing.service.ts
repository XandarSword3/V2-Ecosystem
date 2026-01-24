import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

export interface SeasonalPricingRule {
  id: string;
  name: string;
  startDate: string; // MM-DD format
  endDate: string; // MM-DD format
  priceMultiplier: number; // e.g., 1.5 for 50% increase
  applicableTo: ('chalets' | 'pool' | 'restaurant')[];
  specificItems?: string[]; // Optional specific item IDs
  priority: number; // Higher priority rules override lower ones
  isActive: boolean;
}

export interface DynamicPricingConfig {
  enabled: boolean;
  minOccupancyThreshold: number; // e.g., 30%
  maxOccupancyThreshold: number; // e.g., 80%
  minPriceMultiplier: number; // e.g., 0.8 for 20% discount
  maxPriceMultiplier: number; // e.g., 1.3 for 30% premium
  advanceBookingDays: number; // Days before arrival for early bird pricing
  earlyBirdDiscount: number; // e.g., 0.1 for 10% discount
  lastMinuteDays: number; // Days before for last-minute pricing
  lastMinutePremium: number; // e.g., 0.15 for 15% premium (or discount)
}

interface PriceCalculationResult {
  basePrice: number;
  finalPrice: number;
  appliedRules: {
    name: string;
    multiplier: number;
    type: 'seasonal' | 'dynamic' | 'weekend' | 'early_bird' | 'last_minute';
  }[];
  breakdown: {
    basePrice: number;
    seasonalAdjustment: number;
    dynamicAdjustment: number;
    weekendAdjustment: number;
    totalAdjustments: number;
  };
}

class SeasonalPricingService {
  // Get all seasonal pricing rules
  async getSeasonalRules(): Promise<SeasonalPricingRule[]> {
    const { data, error } = await supabase
      .from('seasonal_pricing_rules')
      .select('*')
      .order('priority', { ascending: false });

    if (error) {
      logger.error('Failed to fetch seasonal pricing rules', error);
      throw new Error('Failed to fetch seasonal pricing rules');
    }

    return data.map(rule => ({
      id: rule.id,
      name: rule.name,
      startDate: rule.start_date,
      endDate: rule.end_date,
      priceMultiplier: rule.price_multiplier,
      applicableTo: rule.applicable_to,
      specificItems: rule.specific_items,
      priority: rule.priority,
      isActive: rule.is_active,
    }));
  }

  // Create a new seasonal pricing rule
  async createSeasonalRule(
    rule: Omit<SeasonalPricingRule, 'id'>
  ): Promise<SeasonalPricingRule> {
    const { data, error } = await supabase
      .from('seasonal_pricing_rules')
      .insert({
        name: rule.name,
        start_date: rule.startDate,
        end_date: rule.endDate,
        price_multiplier: rule.priceMultiplier,
        applicable_to: rule.applicableTo,
        specific_items: rule.specificItems,
        priority: rule.priority,
        is_active: rule.isActive,
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create seasonal pricing rule', error);
      throw new Error('Failed to create seasonal pricing rule');
    }

    return {
      id: data.id,
      name: data.name,
      startDate: data.start_date,
      endDate: data.end_date,
      priceMultiplier: data.price_multiplier,
      applicableTo: data.applicable_to,
      specificItems: data.specific_items,
      priority: data.priority,
      isActive: data.is_active,
    };
  }

  // Update a seasonal pricing rule
  async updateSeasonalRule(
    ruleId: string,
    updates: Partial<Omit<SeasonalPricingRule, 'id'>>
  ): Promise<void> {
    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.startDate !== undefined) updateData.start_date = updates.startDate;
    if (updates.endDate !== undefined) updateData.end_date = updates.endDate;
    if (updates.priceMultiplier !== undefined) updateData.price_multiplier = updates.priceMultiplier;
    if (updates.applicableTo !== undefined) updateData.applicable_to = updates.applicableTo;
    if (updates.specificItems !== undefined) updateData.specific_items = updates.specificItems;
    if (updates.priority !== undefined) updateData.priority = updates.priority;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

    const { error } = await supabase
      .from('seasonal_pricing_rules')
      .update(updateData)
      .eq('id', ruleId);

    if (error) {
      logger.error('Failed to update seasonal pricing rule', error);
      throw new Error('Failed to update seasonal pricing rule');
    }
  }

  // Delete a seasonal pricing rule
  async deleteSeasonalRule(ruleId: string): Promise<void> {
    const { error } = await supabase
      .from('seasonal_pricing_rules')
      .delete()
      .eq('id', ruleId);

    if (error) {
      logger.error('Failed to delete seasonal pricing rule', error);
      throw new Error('Failed to delete seasonal pricing rule');
    }
  }

  // Get dynamic pricing configuration
  async getDynamicPricingConfig(): Promise<DynamicPricingConfig> {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'dynamic_pricing')
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.error('Failed to fetch dynamic pricing config', error);
      throw new Error('Failed to fetch dynamic pricing config');
    }

    // Return defaults if not set
    return data?.value || {
      enabled: false,
      minOccupancyThreshold: 30,
      maxOccupancyThreshold: 80,
      minPriceMultiplier: 0.85,
      maxPriceMultiplier: 1.25,
      advanceBookingDays: 30,
      earlyBirdDiscount: 0.1,
      lastMinuteDays: 3,
      lastMinutePremium: 0.0,
    };
  }

  // Update dynamic pricing configuration
  async updateDynamicPricingConfig(config: DynamicPricingConfig): Promise<void> {
    const { error } = await supabase
      .from('system_settings')
      .upsert({
        key: 'dynamic_pricing',
        value: config,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'key',
      });

    if (error) {
      logger.error('Failed to update dynamic pricing config', error);
      throw new Error('Failed to update dynamic pricing config');
    }
  }

  // Calculate price for a given item and date range
  async calculatePrice(
    itemType: 'chalets' | 'pool' | 'restaurant',
    itemId: string,
    basePrice: number,
    checkInDate: Date,
    checkOutDate?: Date
  ): Promise<PriceCalculationResult> {
    const appliedRules: PriceCalculationResult['appliedRules'] = [];
    let finalPrice = basePrice;
    let seasonalAdjustment = 0;
    let dynamicAdjustment = 0;
    let weekendAdjustment = 0;

    // Get all active seasonal rules
    const rules = await this.getSeasonalRules();
    const activeRules = rules.filter(r => r.isActive);

    // Check for applicable seasonal rules
    const checkDate = checkInDate;
    const month = checkDate.getMonth() + 1;
    const day = checkDate.getDate();
    const dateString = `${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

    for (const rule of activeRules) {
      if (!rule.applicableTo.includes(itemType)) continue;
      if (rule.specificItems && !rule.specificItems.includes(itemId)) continue;

      // Check if date falls within rule period (handling year wrap)
      if (this.isDateInRange(dateString, rule.startDate, rule.endDate)) {
        const adjustment = basePrice * (rule.priceMultiplier - 1);
        seasonalAdjustment += adjustment;
        appliedRules.push({
          name: rule.name,
          multiplier: rule.priceMultiplier,
          type: 'seasonal',
        });
      }
    }

    // Apply weekend pricing (if applicable)
    const dayOfWeek = checkInDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6) {
      // Get weekend pricing from settings
      const { data: weekendSettings } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'weekend_pricing')
        .single();

      if (weekendSettings?.value?.enabled) {
        const weekendMultiplier = weekendSettings.value.multiplier || 1.2;
        weekendAdjustment = basePrice * (weekendMultiplier - 1);
        appliedRules.push({
          name: 'Weekend Pricing',
          multiplier: weekendMultiplier,
          type: 'weekend',
        });
      }
    }

    // Apply dynamic pricing
    const dynamicConfig = await this.getDynamicPricingConfig();
    if (dynamicConfig.enabled && itemType === 'chalets') {
      const daysUntilBooking = Math.ceil(
        (checkInDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      // Early bird discount
      if (daysUntilBooking >= dynamicConfig.advanceBookingDays) {
        const earlyBirdAdjustment = basePrice * -dynamicConfig.earlyBirdDiscount;
        dynamicAdjustment += earlyBirdAdjustment;
        appliedRules.push({
          name: 'Early Bird Discount',
          multiplier: 1 - dynamicConfig.earlyBirdDiscount,
          type: 'early_bird',
        });
      }
      // Last minute pricing
      else if (daysUntilBooking <= dynamicConfig.lastMinuteDays) {
        const lastMinuteAdjustment = basePrice * dynamicConfig.lastMinutePremium;
        dynamicAdjustment += lastMinuteAdjustment;
        if (dynamicConfig.lastMinutePremium !== 0) {
          appliedRules.push({
            name: 'Last Minute Rate',
            multiplier: 1 + dynamicConfig.lastMinutePremium,
            type: 'last_minute',
          });
        }
      }

      // Occupancy-based pricing
      const occupancy = await this.getCurrentOccupancy(itemType, checkInDate);
      if (occupancy !== null) {
        let occupancyMultiplier = 1;
        
        if (occupancy >= dynamicConfig.maxOccupancyThreshold) {
          // High demand - increase prices
          occupancyMultiplier = dynamicConfig.maxPriceMultiplier;
        } else if (occupancy <= dynamicConfig.minOccupancyThreshold) {
          // Low demand - decrease prices
          occupancyMultiplier = dynamicConfig.minPriceMultiplier;
        } else {
          // Linear interpolation between thresholds
          const range = dynamicConfig.maxOccupancyThreshold - dynamicConfig.minOccupancyThreshold;
          const position = (occupancy - dynamicConfig.minOccupancyThreshold) / range;
          occupancyMultiplier = dynamicConfig.minPriceMultiplier + 
            position * (dynamicConfig.maxPriceMultiplier - dynamicConfig.minPriceMultiplier);
        }

        const occupancyAdjustment = basePrice * (occupancyMultiplier - 1);
        dynamicAdjustment += occupancyAdjustment;
        appliedRules.push({
          name: `Demand-based (${Math.round(occupancy)}% occupancy)`,
          multiplier: occupancyMultiplier,
          type: 'dynamic',
        });
      }
    }

    // Calculate final price
    const totalAdjustments = seasonalAdjustment + dynamicAdjustment + weekendAdjustment;
    finalPrice = Math.max(0, basePrice + totalAdjustments);

    // Round to 2 decimal places
    finalPrice = Math.round(finalPrice * 100) / 100;

    return {
      basePrice,
      finalPrice,
      appliedRules,
      breakdown: {
        basePrice,
        seasonalAdjustment: Math.round(seasonalAdjustment * 100) / 100,
        dynamicAdjustment: Math.round(dynamicAdjustment * 100) / 100,
        weekendAdjustment: Math.round(weekendAdjustment * 100) / 100,
        totalAdjustments: Math.round(totalAdjustments * 100) / 100,
      },
    };
  }

  // Helper to check if a date string is in a range (handles year wrap)
  private isDateInRange(date: string, start: string, end: string): boolean {
    const [dateMonth, dateDay] = date.split('-').map(Number);
    const [startMonth, startDay] = start.split('-').map(Number);
    const [endMonth, endDay] = end.split('-').map(Number);

    const dateValue = dateMonth * 100 + dateDay;
    const startValue = startMonth * 100 + startDay;
    const endValue = endMonth * 100 + endDay;

    if (startValue <= endValue) {
      // Normal range (e.g., June 1 - August 31)
      return dateValue >= startValue && dateValue <= endValue;
    } else {
      // Wrapped range (e.g., December 15 - January 5)
      return dateValue >= startValue || dateValue <= endValue;
    }
  }

  // Get current occupancy for a given date
  private async getCurrentOccupancy(
    itemType: 'chalets' | 'pool' | 'restaurant',
    date: Date
  ): Promise<number | null> {
    const dateString = date.toISOString().split('T')[0];

    if (itemType === 'chalets') {
      // Count booked chalets vs total
      const { count: totalChalets } = await supabase
        .from('chalets')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      const { count: bookedChalets } = await supabase
        .from('chalet_bookings')
        .select('*', { count: 'exact', head: true })
        .lte('check_in_date', dateString)
        .gt('check_out_date', dateString)
        .in('status', ['confirmed', 'checked_in']);

      if (totalChalets && totalChalets > 0) {
        return ((bookedChalets || 0) / totalChalets) * 100;
      }
    } else if (itemType === 'pool') {
      // Check pool capacity
      const { data: capacity } = await supabase
        .from('pool_daily_capacity')
        .select('current_count, max_capacity')
        .eq('date', dateString)
        .single();

      if (capacity && capacity.max_capacity > 0) {
        return (capacity.current_count / capacity.max_capacity) * 100;
      }
    }

    return null;
  }

  // Sync prices with Stripe products
  async syncPricesToStripe(
    productId: string,
    basePrice: number,
    currency: string = 'eur'
  ): Promise<void> {
    try {
      // Create or update the price in Stripe
      const price = await stripe.prices.create({
        product: productId,
        unit_amount: Math.round(basePrice * 100), // Stripe uses cents
        currency,
      });

      logger.info(`Synced price to Stripe: ${price.id}`);
    } catch (error) {
      logger.error('Failed to sync price to Stripe', error);
      throw new Error('Failed to sync price to Stripe');
    }
  }

  // Get price preview for a date range (useful for calendar display)
  async getPricingCalendar(
    itemType: 'chalets' | 'pool' | 'restaurant',
    itemId: string,
    basePrice: number,
    startDate: Date,
    endDate: Date
  ): Promise<Map<string, PriceCalculationResult>> {
    const calendar = new Map<string, PriceCalculationResult>();
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      const priceResult = await this.calculatePrice(
        itemType,
        itemId,
        basePrice,
        new Date(currentDate)
      );
      calendar.set(dateKey, priceResult);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return calendar;
  }
}

export const seasonalPricingService = new SeasonalPricingService();
export default seasonalPricingService;
