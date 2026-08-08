import { Router, Request, Response } from 'express';
import { getSupabase } from '../../database/connection.js';
const supabase = getSupabase();
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../middleware/async-handler';
import { AppError } from '../../utils/AppError';
import { seasonalPricingService } from '../../services/seasonal-pricing.service';
import { logger } from '../../utils/logger';
import { getCallerTenantId } from '../../security/tenant-scope.js';
import { engineService } from '../../engines/engine-service.js';
import { resolveTaxCategory, getModuleTaxCategory } from '../../services/tax.service.js';
import { getEngineByTemplate } from '../../engines/registry.js';
import { resolveAndPriceCatalogItems, type CatalogItemRequest } from '../../services/catalog-pricing.service.js';
import type { PricingLineItem, PricingConfig, PricingContext } from '../../engines/types.js';

const router = Router();

// Get all seasonal pricing rules
router.get(
  '/seasonal-rules',
  authenticate,
  authorize('admin', 'staff'),
  asyncHandler(async (req: Request, res: Response) => {
    // Tenant isolation (0.6 read-leak fix): non-super_admin callers only see their own
    // tenant's rules plus unscoped/global ones — this endpoint was previously returning
    // every tenant's pricing rules to any admin/staff caller.
    const isSuperAdmin = (req.user as any)?.roles?.includes('super_admin') ?? false;
    const callerTenantId = getCallerTenantId(req);

    const rules = await seasonalPricingService.getSeasonalRules(callerTenantId, isSuperAdmin);

    res.json({
      success: true,
      data: rules,
    });
  })
);

// Create a seasonal pricing rule
router.post(
  '/seasonal-rules',
  authenticate,
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { name, startDate, endDate, priceMultiplier, applicableTo, priority, isActive } = req.body;

    // Validate required fields
    if (!name || !startDate || !endDate) {
      throw new AppError('Name, start date, and end date are required', 400);
    }

    // Validate date format (MM-DD)
    const dateRegex = /^\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      throw new AppError('Dates must be in MM-DD format', 400);
    }

    // Validate multiplier
    if (priceMultiplier < 0.1 || priceMultiplier > 3) {
      throw new AppError('Price multiplier must be between 0.1 and 3', 400);
    }

    // 0.6 fix: stamp the rule with the caller's tenant/property so it isn't created as an
    // unscoped/global rule by default — matches the tenant resolution used in modules.controller.ts.
    const callerTenantId = getCallerTenantId(req);
    const callerPropertyId = (req as any).property?.id ?? ((req as any).propertyId as string | undefined) ?? null;

    const rule = await seasonalPricingService.createSeasonalRule(
      {
        name,
        startDate,
        endDate,
        priceMultiplier,
        applicableTo: applicableTo || ['accommodation'],
        priority: priority || 0,
        isActive: isActive ?? true,
      },
      callerTenantId ?? undefined,
      callerPropertyId ?? undefined
    );

    logger.info(`Seasonal pricing rule created: ${name}`);

    res.status(201).json({
      success: true,
      data: rule,
    });
  })
);

// Update a seasonal pricing rule
router.put(
  '/seasonal-rules/:ruleId',
  authenticate,
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { ruleId } = req.params;
    const updates = req.body;

    // Validate date format if provided
    const dateRegex = /^\d{2}-\d{2}$/;
    if (updates.startDate && !dateRegex.test(updates.startDate)) {
      throw new AppError('Start date must be in MM-DD format', 400);
    }
    if (updates.endDate && !dateRegex.test(updates.endDate)) {
      throw new AppError('End date must be in MM-DD format', 400);
    }

    // Validate multiplier if provided
    if (updates.priceMultiplier !== undefined) {
      if (updates.priceMultiplier < 0.1 || updates.priceMultiplier > 3) {
        throw new AppError('Price multiplier must be between 0.1 and 3', 400);
      }
    }

    // 0.6 fix: resolve caller tenant context so the service can reject cross-tenant writes.
    const isSuperAdmin = (req.user as any)?.roles?.includes('super_admin') ?? false;
    const callerTenantId = getCallerTenantId(req);

    await seasonalPricingService.updateSeasonalRule(ruleId, updates, callerTenantId, isSuperAdmin);

    logger.info(`Seasonal pricing rule updated: ${ruleId}`);

    res.json({
      success: true,
      message: 'Rule updated successfully',
    });
  })
);

// Delete a seasonal pricing rule
router.delete(
  '/seasonal-rules/:ruleId',
  authenticate,
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { ruleId } = req.params;

    // 0.6 fix: resolve caller tenant context so the service can reject cross-tenant deletes.
    const isSuperAdmin = (req.user as any)?.roles?.includes('super_admin') ?? false;
    const callerTenantId = getCallerTenantId(req);

    await seasonalPricingService.deleteSeasonalRule(ruleId, callerTenantId, isSuperAdmin);

    logger.info(`Seasonal pricing rule deleted: ${ruleId}`);

    res.json({
      success: true,
      message: 'Rule deleted successfully',
    });
  })
);

// Get dynamic pricing configuration
router.get(
  '/dynamic-config',
  authenticate,
  authorize('admin', 'staff'),
  asyncHandler(async (req: Request, res: Response) => {
    const config = await seasonalPricingService.getDynamicPricingConfig();

    res.json({
      success: true,
      data: config,
    });
  })
);

// Update dynamic pricing configuration
router.put(
  '/dynamic-config',
  authenticate,
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const config = req.body;

    // Validate configuration
    if (config.minOccupancyThreshold !== undefined) {
      if (config.minOccupancyThreshold < 0 || config.minOccupancyThreshold > 100) {
        throw new AppError('Min occupancy threshold must be between 0 and 100', 400);
      }
    }

    if (config.maxOccupancyThreshold !== undefined) {
      if (config.maxOccupancyThreshold < 0 || config.maxOccupancyThreshold > 100) {
        throw new AppError('Max occupancy threshold must be between 0 and 100', 400);
      }
    }

    if (config.minPriceMultiplier !== undefined || config.maxPriceMultiplier !== undefined) {
      const min = config.minPriceMultiplier ?? 0.5;
      const max = config.maxPriceMultiplier ?? 2;
      if (min < 0.1 || max > 3 || min > max) {
        throw new AppError('Invalid price multiplier range', 400);
      }
    }

    await seasonalPricingService.updateDynamicPricingConfig(config);

    logger.info('Dynamic pricing configuration updated');

    res.json({
      success: true,
      message: 'Configuration updated successfully',
    });
  })
);

// Calculate price for a specific item and date
router.post(
  '/calculate',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { itemType, itemId, basePrice, checkInDate, checkOutDate } = req.body;

    if (!itemType || !itemId || basePrice === undefined || !checkInDate) {
      throw new AppError('itemType, itemId, basePrice, and checkInDate are required', 400);
    }

    type PricingItemType = 'time_exclusive_reservation' | 'shared_capacity_access' | 'instant_transaction' | 'accommodation_units';
    const result = await seasonalPricingService.calculatePrice(
      itemType as PricingItemType,
      itemId,
      basePrice,
      new Date(checkInDate),
      checkOutDate ? new Date(checkOutDate) : undefined
    );

    res.json({
      success: true,
      data: result,
    });
  })
);

// Get pricing calendar for a date range
router.get(
  '/calendar',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { itemType, itemId, basePrice, startDate, endDate } = req.query;

    if (!itemType || !itemId || !basePrice || !startDate || !endDate) {
      throw new AppError('All query parameters are required', 400);
    }

    type PricingItemType = 'time_exclusive_reservation' | 'shared_capacity_access' | 'instant_transaction' | 'accommodation_units';
    const calendar = await seasonalPricingService.getPricingCalendar(
      itemType as PricingItemType,
      itemId as string,
      parseFloat(basePrice as string),
      new Date(startDate as string),
      new Date(endDate as string)
    );

    // Convert Map to object for JSON serialization
    const calendarObj: Record<string, any> = {};
    calendar.forEach((value, key) => {
      calendarObj[key] = value;
    });

    res.json({
      success: true,
      data: calendarObj,
    });
  })
);

// Get pricing analytics
router.get(
  '/analytics',
  authenticate,
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { days = '30' } = req.query;

    const { data: analytics, error } = await supabase
      .from('price_history')
      .select('*')
      .gte('recorded_at', new Date(Date.now() - parseInt(days as string) * 24 * 60 * 60 * 1000).toISOString())
      .order('recorded_at', { ascending: false });

    if (error) {
      throw new AppError('Failed to fetch pricing analytics', 500);
    }

    // Calculate summary statistics
    const totalBookings = analytics?.length || 0;
    const totalBaseValue = analytics?.reduce((sum: number, a: Record<string, number>) => sum + a.base_price, 0) || 0;
    const totalFinalValue = analytics?.reduce((sum: number, a: Record<string, number>) => sum + a.final_price, 0) || 0;
    const totalAdjustment = totalFinalValue - totalBaseValue;
    const averageAdjustmentPercent = totalBaseValue > 0
      ? ((totalAdjustment / totalBaseValue) * 100)
      : 0;

    // Group by applied rules
    const ruleUsage: Record<string, number> = {};
    analytics?.forEach((a: Record<string, any>) => {
      const rules = a.applied_rules || [];
      rules.forEach((rule: any) => {
        ruleUsage[rule.name] = (ruleUsage[rule.name] || 0) + 1;
      });
    });

    res.json({
      success: true,
      data: {
        summary: {
          totalBookings,
          totalBaseValue,
          totalFinalValue,
          totalAdjustment,
          averageAdjustmentPercent: Math.round(averageAdjustmentPercent * 100) / 100,
        },
        ruleUsage,
        recentHistory: analytics?.slice(0, 50),
      },
    });
  })
);

// Preview pricing for cart items - returns full breakdown with tax and fees
// No auth required - guests need to see pricing before checkout
router.post(
  '/preview',
  asyncHandler(async (req: Request, res: Response) => {
    const controllerStart = Date.now();
    const requestId = (req as any).requestId || Math.random().toString(36).substring(7);
    const requestReceived = new Date().toISOString();
    console.log(`[PricingController] RequestID: ${requestId} - Request received at: ${requestReceived}`);

    const {
      items,
      moduleId,
      orderType,
      conditions,
      couponCode,
      giftCardCodes,
      loyaltyPointsToRedeem,
      customerId,
      propertyId
    } = req.body;

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new AppError('items array is required', 400);
    }

    if (!moduleId) {
      throw new AppError('moduleId is required to resolve tax categories', 400);
    }

    console.log(`[PricingController] RequestID: ${requestId} - Validation done: ${Date.now() - controllerStart}ms`);

    // Fetch module's tax category for server-side resolution (cached), plus its
    // template_type so this preview runs through the exact same engine pipeline
    // (same discount resolvers, same engine.pricing config) that confirmation uses.
    const moduleFetchStart = Date.now();
    const moduleTaxCategory = await getModuleTaxCategory(moduleId);
    const { data: moduleRow } = await supabase
      .from('modules')
      .select('template_type')
      .eq('id', moduleId)
      .maybeSingle();
    const templateType = moduleRow?.template_type;
    if (!templateType) {
      throw new AppError('Unable to resolve engine type for moduleId', 400);
    }
    console.log(`[PricingController] RequestID: ${requestId} - Module fetch: ${Date.now() - moduleFetchStart}ms`);

    // Note: applyTax/applyFees/supportsCoupons etc. are no longer taken from the
    // request body — they come from the engine's own `pricing` config (see
    // engines/registry.ts), same as at confirmation. A client can no longer
    // influence whether tax/fees apply just by omitting a flag.

    // FIX 1: Use shared resolve-and-price function to get server-side prices
    const itemProcessingStart = Date.now();
    const catalogResult = await resolveAndPriceCatalogItems(
      items as CatalogItemRequest[],
      moduleId,
      moduleTaxCategory
    );
    
    if (catalogResult.validationErrors.length > 0) {
      throw new AppError(`Invalid catalog items or modifiers: ${catalogResult.validationErrors.join(', ')}`, 400);
    }
    
    const lineItems: PricingLineItem[] = catalogResult.resolvedItems.map((item) => ({
      itemId: item.itemId,
      name: item.name,
      unitPrice: item.basePrice + item.modifierAdjustment,
      quantity: item.quantity,
      metadata: item.metadata,
      taxCategory: item.taxCategory,
    }));
    
    // Debug logging to track pricing consistency
    console.log(`[PricingController] RequestID: ${requestId} - Preview line items from shared function`, {
      moduleId,
      itemCount: lineItems.length,
      lineItems: lineItems.map(li => ({
        itemId: li.itemId,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        lineTotal: li.unitPrice * li.quantity,
      })),
      subtotal: lineItems.reduce((sum, li) => sum + (li.unitPrice * li.quantity), 0),
    });
    
    console.log(`[PricingController] RequestID: ${requestId} - Item processing: ${Date.now() - itemProcessingStart}ms`);

    // Build pricing context
    const pricingContext: PricingContext = {
      moduleId,
      conditions: conditions || { orderType: orderType, paymentMethod: req.body.paymentMethod },
      customerId,
      couponCode,
      giftCardCodes,
      loyaltyPointsToRedeem,
      // FIX 3: Use consistent propertyId resolution order with order endpoint
      // Order endpoint uses: mounted.property_id || req.propertyId || req.headers['x-property-id']
      // Preview uses: req.property?.id (same middleware source as mounted.property_id) || body.propertyId || fallbacks
      propertyId: (req as any).property?.id || propertyId || ((req as any).propertyId as string | undefined) || (req.headers?.['x-property-id'] as string | undefined),
      staffId: (req.user as any)?.userId
    };

    // Route through the same engine pipeline confirmation uses (engineService.calculatePricing),
    // so preview and confirmation can never drift — same engine.pricing config, same
    // coupon/gift-card/loyalty resolvers, same math.
    const pipelineStart = Date.now();
    const result = await engineService.calculatePricing(templateType, lineItems, pricingContext);
    console.log(`[PricingController] RequestID: ${requestId} - Pipeline calculation: ${Date.now() - pipelineStart}ms`);

    const responseStart = Date.now();
    const responseSent = new Date().toISOString();
    res.json({
      success: true,
      data: result
    });
    const responseTime = Date.now() - responseStart;
    const totalTime = Date.now() - controllerStart;
    console.log(`[PricingController] RequestID: ${requestId} - Response preparation: ${responseTime}ms, Response sent at: ${responseSent}`);
    console.log(`[PricingController] RequestID: ${requestId} - Total controller time: ${totalTime}ms`);
    console.log(`[PricingController] RequestID: ${requestId} - End-to-end from request receipt: ${totalTime}ms`);
  })
);

export default router;
