// File: backend/src/services/business-config.service.ts
import { BUSINESS_TYPES } from "../config/business-types.js";
import { terminologyService } from "./terminology.service.js";
import { getSupabase } from "../database/connection.js";
import { logger } from "../utils/logger.js";

export class BusinessConfigService {
    /**
     * Switches the system to a new business type
     * This updates terminology and potentially site settings/active modules
     */
    async switchBusinessType(typeId: string): Promise<boolean> {
        const config = BUSINESS_TYPES[typeId];
        if (!config) throw new Error(`Invalid business type: ${typeId}`);

        const supabase = getSupabase();

        try {
            logger.info(`Switching business type to: ${typeId}`);

            // 1. Update Terminology Overrides
            await terminologyService.bulkUpdateTerminology(
                typeId,
                'en',
                config.terminologyOverrides
            );

            // 2. Update Site Settings / Business Type in DB
            const { error: settingsError } = await supabase
                .from('site_settings')
                .upsert({
                    key: 'business_type',
                    value: { id: typeId, last_switched: new Date().toISOString() }
                }, { onConflict: 'key' });

            if (settingsError) throw settingsError;

            // 3. Potentially enable/disable modules
            // This part depends on how modules are stored. 
            // If in `modules` table, we would loop and set is_active.

            logger.info(`Successfully switched to ${typeId}`);
            return true;
        } catch (error) {
            logger.error(`Failed to switch business type to ${typeId}:`, error);
            return false;
        }
    }
}

export const businessConfigService = new BusinessConfigService();
