// Centralized order config service (all fees configured via tax_configuration)
import { getSupabase } from "../database/connection.js";
import { logger } from "../utils/logger.js";

// Default fallbacks are 0 — all fees are dynamically configured via Tax & Fee Settings
const DEFAULT_SERVICE_CHARGE_RATE = 0;
const DEFAULT_DELIVERY_FEE = 0;

export interface OrderConfig {
  serviceChargeRate: number;
  deliveryFee: number;
}

export class OrderConfigService {
  /**
   * Get the effective service charge rate and delivery fee.
   * Reads from 'order_configuration' key in site_settings.
   * Returns { serviceChargeRate: decimal, deliveryFee: number }
   */
  async getOrderConfig(): Promise<OrderConfig> {
    const supabase = getSupabase();

    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'order_configuration')
        .single();

      if (error || !data) {
        return {
          serviceChargeRate: DEFAULT_SERVICE_CHARGE_RATE,
          deliveryFee: DEFAULT_DELIVERY_FEE,
        };
      }

      const config = data.value;
      return {
        serviceChargeRate: config.serviceChargeRate !== undefined
          ? Number(config.serviceChargeRate)
          : DEFAULT_SERVICE_CHARGE_RATE,
        deliveryFee: config.deliveryFee !== undefined
          ? Number(config.deliveryFee)
          : DEFAULT_DELIVERY_FEE,
      };
    } catch (err) {
      return {
        serviceChargeRate: DEFAULT_SERVICE_CHARGE_RATE,
        deliveryFee: DEFAULT_DELIVERY_FEE,
      };
    }
  }

  /**
   * Update the order configuration (service charge rate & delivery fee).
   */
  async updateOrderConfig(config: Partial<OrderConfig>): Promise<void> {
    const supabase = getSupabase();

    const { data: existing } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'order_configuration')
      .single();

    const currentVal = existing?.value || {};
    const newVal = {
      ...currentVal,
      ...config,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('site_settings')
      .upsert(
        { key: 'order_configuration', value: newVal },
        { onConflict: 'key' }
      );

    if (error) {
      logger.error("Failed to update order configuration", error);
      throw error;
    }
  }
}

export const orderConfigService = new OrderConfigService();
