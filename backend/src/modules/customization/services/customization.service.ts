import { getSupabase } from '../../../database/connection.js';
import { logger } from '../../../utils/logger.js';
import { AppError } from '../../../utils/AppError.js';

// ==========================================
// TYPES (mirror shared types for backend use)
// ==========================================

export type CustomizationType = 'add' | 'remove' | 'swap' | 'upgrade' | 'replace';
export type CustomizableEntityType =
  | 'catalog_item'
  | 'kiosk_item'
  | 'accommodation_unit'
  | 'capacity_window'
  | 'spa_service'
  | 'activity'
  | 'rental_item'
  | 'event_ticket'
  | 'room'
  | 'package';
export type SelectionMode = 'single' | 'multiple' | 'quantity';
export type PriceType = 'fixed' | 'percentage' | 'per_unit' | 'per_night' | 'per_person';

export interface CustomizationGroup {
  id: string;
  name: string;
  nameAr?: string;
  nameFr?: string;
  description?: string;
  descriptionAr?: string;
  displayName?: string;
  displayNameAr?: string;
  icon?: string;
  selectionMode: SelectionMode;
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;
  applicableEntityTypes: CustomizableEntityType[];
  isGlobal: boolean;
  isAvailable: boolean;
  availableFrom?: string;
  availableUntil?: string;
  availableDays?: number[];
  displayConditions?: Record<string, unknown>;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  options?: CustomizationOption[];
}

export interface CustomizationOption {
  id: string;
  groupId: string;
  name: string;
  nameAr?: string;
  nameFr?: string;
  description?: string;
  descriptionAr?: string;
  customizationType: CustomizationType;
  priceAdjustment: number;
  priceType: PriceType;
  inventoryItemId?: string;
  quantityPerSelection: number;
  inventoryUnit: string;
  replacesInventoryItemId?: string;
  maxQuantity: number;
  quantityIncrement: number;
  isDefault: boolean;
  isPopular: boolean;
  badgeText?: string;
  badgeColor?: string;
  imageUrl?: string;
  isAvailable: boolean;
  availableStock?: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface EntityCustomization {
  id: string;
  entityType: CustomizableEntityType;
  entityId: string;
  customizationGroupId: string;
  isRequiredOverride?: boolean;
  minSelectionsOverride?: number;
  maxSelectionsOverride?: number;
  priceMultiplier: number;
  isEnabled: boolean;
  sortOrder: number;
  createdAt: Date;
  group?: CustomizationGroup;
}

export interface CustomizationGroupWithOptions {
  groupId: string;
  groupName: string;
  groupNameAr?: string;
  displayName?: string;
  displayNameAr?: string;
  selectionMode: SelectionMode;
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;
  sortOrder: number;
  options: CustomizationOptionDisplay[];
}

export interface CustomizationOptionDisplay {
  id: string;
  name: string;
  nameAr?: string;
  description?: string;
  customizationType: CustomizationType;
  priceAdjustment: number;
  priceType: PriceType;
  maxQuantity: number;
  isDefault: boolean;
  isPopular: boolean;
  badgeText?: string;
  imageUrl?: string;
  isAvailable: boolean;
  inventoryItemId?: string;
  quantityPerSelection: number;
  sortOrder: number;
}

export interface CustomizationSelection {
  groupId: string;
  optionId: string;
  quantity: number;
}

export interface ValidatedSelection extends CustomizationSelection {
  groupName: string;
  optionName: string;
  customizationType: CustomizationType;
  unitPrice: number;
  totalPrice: number;
  inventoryItemId?: string;
  quantityPerSelection: number;
  replacesInventoryItemId?: string;
}

export interface CustomizationValidationResult {
  isValid: boolean;
  totalPriceAdjustment: number;
  validatedSelections: ValidatedSelection[];
  validationErrors: string[];
}

export interface CustomizationInventoryResult {
  itemsAdded: number;
  itemsRemoved: number;
  itemsSwapped: number;
  deductionLog: Array<{
    action: string;
    inventoryItemId?: string;
    optionName?: string;
    quantity?: number;
  }>;
}

export interface CreateCustomizationGroupRequest {
  name: string;
  nameAr?: string;
  nameFr?: string;
  description?: string;
  displayName?: string;
  displayNameAr?: string;
  icon?: string;
  selectionMode: SelectionMode;
  minSelections?: number;
  maxSelections?: number;
  isRequired?: boolean;
  applicableEntityTypes: CustomizableEntityType[];
  isGlobal?: boolean;
  availableFrom?: string;
  availableUntil?: string;
  availableDays?: number[];
  displayConditions?: Record<string, unknown>;
  sortOrder?: number;
}

export interface UpdateCustomizationGroupRequest extends Partial<CreateCustomizationGroupRequest> {
  isAvailable?: boolean;
}

export interface CreateCustomizationOptionRequest {
  groupId: string;
  name: string;
  nameAr?: string;
  nameFr?: string;
  description?: string;
  customizationType: CustomizationType;
  priceAdjustment?: number;
  priceType?: PriceType;
  inventoryItemId?: string;
  quantityPerSelection?: number;
  inventoryUnit?: string;
  replacesInventoryItemId?: string;
  maxQuantity?: number;
  quantityIncrement?: number;
  isDefault?: boolean;
  isPopular?: boolean;
  badgeText?: string;
  badgeColor?: string;
  imageUrl?: string;
  availableStock?: number;
  sortOrder?: number;
}

export interface UpdateCustomizationOptionRequest extends Partial<Omit<CreateCustomizationOptionRequest, 'groupId'>> {
  isAvailable?: boolean;
}

export interface LinkCustomizationRequest {
  entityType: CustomizableEntityType;
  entityId: string;
  customizationGroupId: string;
  isRequiredOverride?: boolean;
  minSelectionsOverride?: number;
  maxSelectionsOverride?: number;
  priceMultiplier?: number;
  sortOrder?: number;
}

export interface UpdateEntityCustomizationRequest {
  isRequiredOverride?: boolean;
  minSelectionsOverride?: number;
  maxSelectionsOverride?: number;
  priceMultiplier?: number;
  isEnabled?: boolean;
  sortOrder?: number;
}

/**
 * Unified Customization Service
 * Handles customization management for ALL modules
 */
class CustomizationService {
  
  // ==========================================
  // GROUP MANAGEMENT
  // ==========================================

  /**
   * Create a new customization group
   */
  async createGroup(
    data: CreateCustomizationGroupRequest,
    ownerContext?: { tenantId?: string | null; propertyId?: string | null }
  ): Promise<CustomizationGroup> {
    const supabase = getSupabase();
    
    const { data: group, error } = await supabase
      .from('customization_groups')
      .insert({
        name: data.name,
        name_ar: data.nameAr,
        name_fr: data.nameFr,
        description: data.description,
        display_name: data.displayName,
        display_name_ar: data.displayNameAr,
        icon: data.icon,
        selection_mode: data.selectionMode,
        min_selections: data.minSelections ?? 0,
        max_selections: data.maxSelections ?? 1,
        is_required: data.isRequired ?? false,
        applicable_entity_types: data.applicableEntityTypes,
        is_global: data.isGlobal ?? false,
        available_from: data.availableFrom,
        available_until: data.availableUntil,
        available_days: data.availableDays,
        display_conditions: data.displayConditions ?? {},
        sort_order: data.sortOrder ?? 0,
        tenant_id: ownerContext?.tenantId ?? null,
        property_id: ownerContext?.propertyId ?? null,
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create customization group', { error, data });
      throw new Error(`Failed to create customization group: ${error.message}`);
    }

    return this.mapGroupFromDb(group);
  }

  /**
   * Update an existing customization group
   */
  async updateGroup(
    id: string,
    data: UpdateCustomizationGroupRequest,
    tenantId?: string | null
  ): Promise<CustomizationGroup> {
    const supabase = getSupabase();
    
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.nameAr !== undefined) updateData.name_ar = data.nameAr;
    if (data.nameFr !== undefined) updateData.name_fr = data.nameFr;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.displayName !== undefined) updateData.display_name = data.displayName;
    if (data.displayNameAr !== undefined) updateData.display_name_ar = data.displayNameAr;
    if (data.icon !== undefined) updateData.icon = data.icon;
    if (data.selectionMode !== undefined) updateData.selection_mode = data.selectionMode;
    if (data.minSelections !== undefined) updateData.min_selections = data.minSelections;
    if (data.maxSelections !== undefined) updateData.max_selections = data.maxSelections;
    if (data.isRequired !== undefined) updateData.is_required = data.isRequired;
    if (data.applicableEntityTypes !== undefined) updateData.applicable_entity_types = data.applicableEntityTypes;
    if (data.isGlobal !== undefined) updateData.is_global = data.isGlobal;
    if (data.isAvailable !== undefined) updateData.is_available = data.isAvailable;
    if (data.availableFrom !== undefined) updateData.available_from = data.availableFrom;
    if (data.availableUntil !== undefined) updateData.available_until = data.availableUntil;
    if (data.availableDays !== undefined) updateData.available_days = data.availableDays;
    if (data.displayConditions !== undefined) updateData.display_conditions = data.displayConditions;
    if (data.sortOrder !== undefined) updateData.sort_order = data.sortOrder;

    let updateQuery = supabase
      .from('customization_groups')
      .update(updateData)
      .eq('id', id)
      .is('deleted_at', null);
    if (tenantId) updateQuery = updateQuery.eq('tenant_id', tenantId);

    const { data: group, error } = await updateQuery.select().maybeSingle();

    if (error) {
      logger.error('Failed to update customization group', { error, id, data });
      throw new Error(`Failed to update customization group: ${error.message}`);
    }
    if (!group) {
      throw new AppError('Customization group not found', 404);
    }

    return this.mapGroupFromDb(group);
  }

  /**
   * Soft delete a customization group
   */
  async deleteGroup(id: string, tenantId?: string | null): Promise<void> {
    const supabase = getSupabase();
    
    let deleteQuery = supabase
      .from('customization_groups')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (tenantId) deleteQuery = deleteQuery.eq('tenant_id', tenantId);

    const { data, error } = await deleteQuery.select('id').maybeSingle();

    if (error) {
      logger.error('Failed to delete customization group', { error, id });
      throw new Error(`Failed to delete customization group: ${error.message}`);
    }
    if (!data) {
      throw new AppError('Customization group not found', 404);
    }
  }

  /**
   * Get a single customization group by ID
   */
  async getGroup(id: string, includeOptions = false, tenantId?: string | null): Promise<CustomizationGroup | null> {
    const supabase = getSupabase();
    
    const selectQuery = includeOptions ? '*, customization_options(*)' : '*';
    let query = supabase
      .from('customization_groups')
      .select(selectQuery)
      .eq('id', id)
      .is('deleted_at', null);
    if (tenantId) query = query.eq('tenant_id', tenantId);

    const { data: group, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get customization group: ${error.message}`);
    }

    const mapped = this.mapGroupFromDb(group);
    const groupAny = group as any;
    if (includeOptions && groupAny.customization_options) {
      mapped.options = groupAny.customization_options
        .filter((o: any) => !o.deleted_at)
        .map((o: any) => this.mapOptionFromDb(o));
    }
    return mapped;
  }

  /**
   * List all customization groups with optional filters
   */
  async listGroups(filters?: {
    entityType?: CustomizableEntityType;
    isGlobal?: boolean;
    includeOptions?: boolean;
    tenantId?: string | null;
    propertyId?: string | null;
  }): Promise<CustomizationGroup[]> {
    const supabase = getSupabase();
    
    const selectQuery = filters?.includeOptions ? '*, customization_options(*)' : '*';
    let query = supabase
      .from('customization_groups')
      .select(selectQuery)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true });

    if (filters?.isGlobal !== undefined) {
      query = query.eq('is_global', filters.isGlobal);
    }

    if (filters?.entityType) {
      query = query.contains('applicable_entity_types', [filters.entityType]);
    }

    // Tenant isolation: scoped callers (anyone but super_admin) only ever see
    // their own tenant's groups. super_admin passes tenantId=null/undefined
    // and intentionally sees everything (platform-admin surface).
    if (filters?.tenantId) {
      query = query.eq('tenant_id', filters.tenantId);
    }

    // Property isolation: if propertyId is provided, filter to that property
    if (filters?.propertyId) {
      query = query.eq('property_id', filters.propertyId);
    }

    const { data: groups, error } = await query;

    if (error) {
      throw new Error(`Failed to list customization groups: ${error.message}`);
    }

    return (groups || []).map(g => {
      const mapped = this.mapGroupFromDb(g);
      const gAny = g as any;
      if (filters?.includeOptions && gAny.customization_options) {
        mapped.options = gAny.customization_options
          .filter((o: any) => !o.deleted_at)
          .map((o: any) => this.mapOptionFromDb(o));
      }
      return mapped;
    });
  }

  // ==========================================
  // OPTION MANAGEMENT
  // ==========================================

  /**
   * Create a new customization option
   */
  async createOption(
    data: CreateCustomizationOptionRequest,
    tenantId?: string | null
  ): Promise<CustomizationOption> {
    const supabase = getSupabase();

    // Options inherit tenancy from their parent group — never trust a
    // client-supplied tenant_id here. Also blocks attaching an option to a
    // group_id that belongs to a different tenant.
    let optionTenantId: string | null = null;
    let optionPropertyId: string | null = null;
    if (data.groupId) {
      const { data: parentGroup, error: parentError } = await supabase
        .from('customization_groups')
        .select('tenant_id, property_id')
        .eq('id', data.groupId)
        .maybeSingle();
      if (parentError) {
        throw new Error(`Failed to verify parent group: ${parentError.message}`);
      }
      if (!parentGroup) {
        throw new AppError('Customization group not found', 404);
      }
      if (tenantId && parentGroup.tenant_id && parentGroup.tenant_id !== tenantId) {
        throw new AppError('Customization group not found', 404);
      }
      optionTenantId = parentGroup.tenant_id ?? tenantId ?? null;
      optionPropertyId = parentGroup.property_id ?? null;
    }
    
    const { data: option, error } = await supabase
      .from('customization_options')
      .insert({
        group_id: data.groupId,
        name: data.name,
        name_ar: data.nameAr,
        name_fr: data.nameFr,
        description: data.description,
        customization_type: data.customizationType,
        price_adjustment: data.priceAdjustment ?? 0,
        price_type: data.priceType ?? 'fixed',
        inventory_item_id: data.inventoryItemId,
        quantity_per_selection: data.quantityPerSelection ?? 1,
        inventory_unit: data.inventoryUnit ?? 'pcs',
        replaces_inventory_item_id: data.replacesInventoryItemId,
        max_quantity: data.maxQuantity ?? 1,
        quantity_increment: data.quantityIncrement ?? 1,
        is_default: data.isDefault ?? false,
        is_popular: data.isPopular ?? false,
        badge_text: data.badgeText,
        badge_color: data.badgeColor,
        image_url: data.imageUrl,
        available_stock: data.availableStock,
        sort_order: data.sortOrder ?? 0,
        tenant_id: optionTenantId,
        property_id: optionPropertyId,
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create customization option', { error, data });
      throw new Error(`Failed to create customization option: ${error.message}`);
    }

    return this.mapOptionFromDb(option);
  }

  /**
   * Update an existing customization option
   */
  async updateOption(
    id: string,
    data: UpdateCustomizationOptionRequest,
    tenantId?: string | null
  ): Promise<CustomizationOption> {
    const supabase = getSupabase();
    
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.nameAr !== undefined) updateData.name_ar = data.nameAr;
    if (data.nameFr !== undefined) updateData.name_fr = data.nameFr;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.customizationType !== undefined) updateData.customization_type = data.customizationType;
    if (data.priceAdjustment !== undefined) updateData.price_adjustment = data.priceAdjustment;
    if (data.priceType !== undefined) updateData.price_type = data.priceType;
    if (data.inventoryItemId !== undefined) updateData.inventory_item_id = data.inventoryItemId;
    if (data.quantityPerSelection !== undefined) updateData.quantity_per_selection = data.quantityPerSelection;
    if (data.inventoryUnit !== undefined) updateData.inventory_unit = data.inventoryUnit;
    if (data.replacesInventoryItemId !== undefined) updateData.replaces_inventory_item_id = data.replacesInventoryItemId;
    if (data.maxQuantity !== undefined) updateData.max_quantity = data.maxQuantity;
    if (data.quantityIncrement !== undefined) updateData.quantity_increment = data.quantityIncrement;
    if (data.isDefault !== undefined) updateData.is_default = data.isDefault;
    if (data.isPopular !== undefined) updateData.is_popular = data.isPopular;
    if (data.badgeText !== undefined) updateData.badge_text = data.badgeText;
    if (data.badgeColor !== undefined) updateData.badge_color = data.badgeColor;
    if (data.imageUrl !== undefined) updateData.image_url = data.imageUrl;
    if (data.isAvailable !== undefined) updateData.is_available = data.isAvailable;
    if (data.availableStock !== undefined) updateData.available_stock = data.availableStock;
    if (data.sortOrder !== undefined) updateData.sort_order = data.sortOrder;

    let updateQuery = supabase
      .from('customization_options')
      .update(updateData)
      .eq('id', id)
      .is('deleted_at', null);
    if (tenantId) updateQuery = updateQuery.eq('tenant_id', tenantId);

    const { data: option, error } = await updateQuery.select().maybeSingle();

    if (error) {
      logger.error('Failed to update customization option', { error, id, data });
      throw new Error(`Failed to update customization option: ${error.message}`);
    }
    if (!option) {
      throw new AppError('Customization option not found', 404);
    }

    return this.mapOptionFromDb(option);
  }

  /**
   * Soft delete a customization option
   */
  async deleteOption(id: string, tenantId?: string | null): Promise<void> {
    const supabase = getSupabase();
    
    let deleteQuery = supabase
      .from('customization_options')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (tenantId) deleteQuery = deleteQuery.eq('tenant_id', tenantId);

    const { data, error } = await deleteQuery.select('id').maybeSingle();

    if (error) {
      logger.error('Failed to delete customization option', { error, id });
      throw new Error(`Failed to delete customization option: ${error.message}`);
    }
    if (!data) {
      throw new AppError('Customization option not found', 404);
    }
  }

  /**
   * Get options for a group
   */
  async getOptionsForGroup(groupId: string, tenantId?: string | null): Promise<CustomizationOption[]> {
    const supabase = getSupabase();
    
    let query = supabase
      .from('customization_options')
      .select('*')
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true });
    if (tenantId) query = query.eq('tenant_id', tenantId);

    const { data: options, error } = await query;

    if (error) {
      throw new Error(`Failed to get options: ${error.message}`);
    }

    return (options || []).map(o => this.mapOptionFromDb(o));
  }

  // ==========================================
  // ENTITY LINKING
  // ==========================================

  /**
   * Link a customization group to an entity
   */
  async linkToEntity(data: LinkCustomizationRequest, tenantId?: string | null): Promise<EntityCustomization> {
    const supabase = getSupabase();

    const { data: link, error } = await supabase
      .from('entity_customizations')
      .insert({
        entity_type: data.entityType,
        entity_id: data.entityId,
        customization_group_id: data.customizationGroupId,
        is_required_override: data.isRequiredOverride,
        min_selections_override: data.minSelectionsOverride,
        max_selections_override: data.maxSelectionsOverride,
        price_multiplier: data.priceMultiplier ?? 1.0,
        sort_order: data.sortOrder ?? 0,
        tenant_id: tenantId ?? null
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to link customization', { error, data });
      throw new Error(`Failed to link customization: ${error.message}`);
    }

    return this.mapEntityCustomizationFromDb(link);
  }

  /**
   * Update an entity customization link
   */
  async updateEntityLink(id: string, data: UpdateEntityCustomizationRequest, tenantId?: string | null): Promise<EntityCustomization> {
    const supabase = getSupabase();
    
    const updateData: Record<string, unknown> = {};

    if (data.isRequiredOverride !== undefined) updateData.is_required_override = data.isRequiredOverride;
    if (data.minSelectionsOverride !== undefined) updateData.min_selections_override = data.minSelectionsOverride;
    if (data.maxSelectionsOverride !== undefined) updateData.max_selections_override = data.maxSelectionsOverride;
    if (data.priceMultiplier !== undefined) updateData.price_multiplier = data.priceMultiplier;
    if (data.isEnabled !== undefined) updateData.is_enabled = data.isEnabled;
    if (data.sortOrder !== undefined) updateData.sort_order = data.sortOrder;

    let updateQuery = supabase
      .from('entity_customizations')
      .update(updateData)
      .eq('id', id);
    if (tenantId) updateQuery = updateQuery.eq('tenant_id', tenantId);

    const { data: link, error } = await updateQuery.select().maybeSingle();

    if (error) {
      logger.error('Failed to update entity link', { error, id, data });
      throw new Error(`Failed to update entity link: ${error.message}`);
    }
    if (!link) {
      throw new AppError('Entity customization link not found', 404);
    }

    return this.mapEntityCustomizationFromDb(link);
  }

  /**
   * Remove an entity customization link
   */
  async unlinkFromEntity(id: string, tenantId?: string | null): Promise<void> {
    const supabase = getSupabase();

    let deleteQuery = supabase
      .from('entity_customizations')
      .delete()
      .eq('id', id);
    if (tenantId) deleteQuery = deleteQuery.eq('tenant_id', tenantId);

    const { data, error } = await deleteQuery.select('id').maybeSingle();

    if (error) {
      logger.error('Failed to unlink customization', { error, id });
      throw new Error(`Failed to unlink customization: ${error.message}`);
    }
    if (!data) {
      throw new AppError('Entity customization link not found', 404);
    }
  }

  /**
   * Get all customization links for an entity
   */
  async getEntityLinks(entityType: CustomizableEntityType, entityId: string, tenantId?: string | null): Promise<EntityCustomization[]> {
    const supabase = getSupabase();

    let query = supabase
      .from('entity_customizations')
      .select('*, customization_groups(*)')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('is_enabled', true)
      .order('sort_order', { ascending: true });
    if (tenantId) query = query.eq('tenant_id', tenantId);

    const { data: links, error } = await query;

    if (error) {
      throw new Error(`Failed to get entity links: ${error.message}`);
    }

    return (links || []).map(l => {
      const mapped = this.mapEntityCustomizationFromDb(l);
      if (l.customization_groups) {
        mapped.group = this.mapGroupFromDb(l.customization_groups);
      }
      return mapped;
    });
  }

  // ==========================================
  // CUSTOMER-FACING OPERATIONS
  // ==========================================

  /**
   * Get all available customizations for an entity
   * Uses the database function for complex query logic
   */
  async getCustomizationsForEntity(
    entityType: CustomizableEntityType,
    entityId: string
  ): Promise<CustomizationGroupWithOptions[]> {
    const supabase = getSupabase();

    logger.info('[CustomizationService] getCustomizationsForEntity', { entityType, entityId });

    // First, check if there are any entity_customizations links directly
    const { data: links, error: linksError } = await supabase
      .from('entity_customizations')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId);

    logger.info('[CustomizationService] Direct entity_customizations query', {
      count: links?.length || 0,
      links: links,
      error: linksError
    });

    const { data, error } = await supabase
      .rpc('get_entity_customizations', {
        p_entity_type: entityType,
        p_entity_id: entityId
      });

    if (error) {
      logger.error('Failed to get entity customizations', { error, entityType, entityId });
      throw new Error(`Failed to get customizations: ${error.message}`);
    }

    logger.info('[CustomizationService] RPC result', {
      count: data?.length || 0,
      data
    });

    return (data || []).map((row: any) => ({
      groupId: row.group_id,
      groupName: row.group_name,
      groupNameAr: row.group_name_ar,
      displayName: row.display_name,
      displayNameAr: row.display_name_ar,
      selectionMode: row.selection_mode as SelectionMode,
      minSelections: row.min_selections,
      maxSelections: row.max_selections,
      isRequired: row.is_required,
      sortOrder: row.sort_order,
      options: row.options || []
    }));
  }

  /**
   * Validate customer selections
   * Uses the database function for complex validation logic
   */
  async validateSelections(
    entityType: CustomizableEntityType,
    entityId: string,
    selections: CustomizationSelection[]
  ): Promise<CustomizationValidationResult> {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .rpc('validate_customizations', {
        p_entity_type: entityType,
        p_entity_id: entityId,
        p_selections: selections
      });

    if (error) {
      logger.error('Failed to validate customizations', { error, entityType, entityId, selections });
      throw new Error(`Failed to validate customizations: ${error.message}`);
    }

    const result = data?.[0];
    if (!result) {
      throw new Error('No validation result returned');
    }

    return {
      isValid: result.is_valid,
      totalPriceAdjustment: parseFloat(result.total_price_adjustment) || 0,
      validatedSelections: result.validated_selections || [],
      validationErrors: result.validation_errors || []
    };
  }

  /**
   * Process inventory for customizations after order placement
   * Uses the database function for transaction safety
   */
  async processInventory(
    orderType: string,
    orderId: string,
    orderItemId: string | null,
    validatedSelections: ValidatedSelection[],
    baseQuantity: number = 1
  ): Promise<CustomizationInventoryResult> {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .rpc('process_customization_inventory', {
        p_order_type: orderType,
        p_order_id: orderId,
        p_order_item_id: orderItemId,
        p_selections: validatedSelections,
        p_base_quantity: baseQuantity
      });

    if (error) {
      logger.error('Failed to process customization inventory', { error, orderType, orderId });
      throw new Error(`Failed to process inventory: ${error.message}`);
    }

    const result = data?.[0];
    return {
      itemsAdded: result?.items_added || 0,
      itemsRemoved: result?.items_removed || 0,
      itemsSwapped: result?.items_swapped || 0,
      deductionLog: result?.deduction_log || []
    };
  }

  /**
   * Get customizations for an order (for display on receipts, staff view)
   */
  async getOrderCustomizations(
    orderType: string,
    orderId: string,
    orderItemId?: string
  ): Promise<Array<{ groupName: string; options: Array<{ name: string; type: string; quantity: number; priceAdjustment: number }> }>> {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .rpc('get_order_customizations', {
        p_order_type: orderType,
        p_order_id: orderId,
        p_order_item_id: orderItemId || null
      });

    if (error) {
      logger.error('Failed to get order customizations', { error, orderType, orderId });
      throw new Error(`Failed to get order customizations: ${error.message}`);
    }

    return data || [];
  }

  // ==========================================
  // TRANSACTIONAL ORDER SNAPSHOT WITH INVENTORY
  // ==========================================

  /**
   * Create transactional order snapshot with optional inventory execution
   * This is the primary method for order confirmation flow
   */
  async createOrderSnapshot(params: {
    orderType: string;
    orderId: string;
    orderItemId?: string;
    entityType: CustomizableEntityType;
    entityId: string;
    selections: Array<{ optionId: string; quantity: number }>;
    baseQuantity?: number;
    executeInventory?: boolean;
  }, tenantId?: string | null): Promise<{
    success: boolean;
    snapshotId?: string;
    totalPriceAdjustment: number;
    inventoryResult?: Record<string, unknown>;
    errors: string[];
    eventIds: string[];
  }> {
    const supabase = getSupabase();
    const startTime = Date.now();

    // Item 0.5 — the RPC below has no tenant scoping of its own, so verify
    // every selected option actually belongs to the caller's tenant before
    // invoking it. Otherwise a caller could reference another tenant's
    // customization_options and have inventory/pricing applied against them.
    if (tenantId && params.selections.length > 0) {
      const optionIds = params.selections.map(s => s.optionId);
      const { data: foreignOptions, error: scopeError } = await supabase
        .from('customization_options')
        .select('id')
        .in('id', optionIds)
        .neq('tenant_id', tenantId);
      if (scopeError) {
        throw new Error(`Failed to verify option ownership: ${scopeError.message}`);
      }
      if (foreignOptions && foreignOptions.length > 0) {
        throw new AppError('One or more customizations were not found', 404);
      }
    }

    const { data, error } = await supabase.rpc('create_order_customization_snapshot', {
      p_order_type: params.orderType,
      p_order_id: params.orderId,
      p_order_item_id: params.orderItemId || null,
      p_entity_type: params.entityType,
      p_entity_id: params.entityId,
      p_selections: params.selections,
      p_base_quantity: params.baseQuantity || 1,
      p_execute_inventory: params.executeInventory ?? true
    });

    const latency = Date.now() - startTime;
    logger.info('Order snapshot created', { 
      orderId: params.orderId, 
      success: !error,
      latencyMs: latency 
    });

    if (error) {
      logger.error('Failed to create order snapshot', { error, params });
      return {
        success: false,
        totalPriceAdjustment: 0,
        errors: [error.message],
        eventIds: []
      };
    }

    const result = data?.[0];
    return {
      success: result?.success ?? false,
      snapshotId: result?.snapshot_id,
      totalPriceAdjustment: parseFloat(result?.total_price_adjustment) || 0,
      inventoryResult: result?.inventory_result,
      errors: result?.validation_errors || [],
      eventIds: result?.event_ids || []
    };
  }

  // ==========================================
  // REFUND & REVERSAL FLOW
  // ==========================================

  /**
   * Reverse inventory for a refund/cancellation
   * CRITICAL: This restores inventory and marks snapshots as reversed
   */
  async reverseOrderItemInventory(
    snapshotId: string,
    reason: string = 'Refund',
    reversedBy?: string,
    tenantId?: string | null
  ): Promise<{
    success: boolean;
    itemsReversed: number;
    reversalLog: Array<Record<string, unknown>>;
    errorMessage?: string;
  }> {
    const supabase = getSupabase();

    // Item 0.5 — the RPC has no tenant scoping of its own; verify the
    // snapshot belongs to the caller's tenant first, or a caller could
    // reverse (restore inventory / mark reversed) another tenant's order.
    if (tenantId) {
      const { data: snapshot, error: scopeError } = await supabase
        .from('order_customizations')
        .select('id')
        .eq('id', snapshotId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (scopeError) {
        throw new Error(`Failed to verify snapshot ownership: ${scopeError.message}`);
      }
      if (!snapshot) {
        throw new AppError('Order snapshot not found', 404);
      }
    }

    logger.info('Reversing order item inventory', { snapshotId, reason, reversedBy });
    
    const { data, error } = await supabase.rpc('reverse_order_item_inventory', {
      p_snapshot_id: snapshotId,
      p_reason: reason,
      p_reversed_by: reversedBy || null
    });

    if (error) {
      logger.error('Failed to reverse inventory', { error, snapshotId });
      return {
        success: false,
        itemsReversed: 0,
        reversalLog: [],
        errorMessage: error.message
      };
    }

    const result = data?.[0];
    logger.info('Inventory reversal complete', { 
      snapshotId, 
      itemsReversed: result?.items_reversed 
    });
    
    return {
      success: result?.success ?? false,
      itemsReversed: result?.items_reversed ?? 0,
      reversalLog: result?.reversal_log ?? [],
      errorMessage: result?.error_message
    };
  }

  /**
   * Get reversible customizations for an order
   */
  async getReversibleOrderCustomizations(
    orderType: string,
    orderId: string,
    tenantId?: string | null
  ): Promise<Array<{
    snapshotId: string;
    orderItemId?: string;
    optionName: string;
    quantity: number;
    inventoryDeducted: boolean;
    inventoryQuantityUsed?: number;
    createdAt: Date;
    canReverse: boolean;
  }>> {
    const supabase = getSupabase();

    // Item 0.5 — verify at least one snapshot for this order belongs to the
    // caller's tenant before asking the RPC (which has no tenant scoping of
    // its own) for the full reversible list.
    if (tenantId) {
      const { data: owned, error: scopeError } = await supabase
        .from('order_customizations')
        .select('id')
        .eq('order_type', orderType)
        .eq('order_id', orderId)
        .eq('tenant_id', tenantId)
        .limit(1);
      if (scopeError) {
        throw new Error(`Failed to verify order ownership: ${scopeError.message}`);
      }
      if (!owned || owned.length === 0) {
        return [];
      }
    }

    const { data, error } = await supabase.rpc('get_reversible_order_customizations', {
      p_order_type: orderType,
      p_order_id: orderId
    });

    if (error) {
      logger.error('Failed to get reversible customizations', { error });
      throw new Error(`Failed to get reversible customizations: ${error.message}`);
    }

    return (data || []).map((row: any) => ({
      snapshotId: row.snapshot_id,
      orderItemId: row.order_item_id,
      optionName: row.option_name,
      quantity: row.quantity,
      inventoryDeducted: row.inventory_deducted,
      inventoryQuantityUsed: row.inventory_quantity_used ? parseFloat(row.inventory_quantity_used) : undefined,
      createdAt: new Date(row.created_at),
      canReverse: row.can_reverse
    }));
  }

  // ==========================================
  // OBSERVABILITY: EVENTS & METRICS
  // ==========================================

  /**
   * Get customization events for monitoring
   */
  async getEvents(params: {
    eventType?: string;
    orderType?: string;
    orderId?: string;
    limit?: number;
    since?: Date;
  }): Promise<Array<{
    id: string;
    eventType: string;
    entityType?: string;
    entityId?: string;
    orderType?: string;
    orderId?: string;
    payload: Record<string, unknown>;
    createdAt: Date;
  }>> {
    const supabase = getSupabase();
    
    let query = supabase
      .from('customization_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(params.limit || 100);

    if (params.eventType) {
      query = query.eq('event_type', params.eventType);
    }
    if (params.orderType) {
      query = query.eq('order_type', params.orderType);
    }
    if (params.orderId) {
      query = query.eq('order_id', params.orderId);
    }
    if (params.since) {
      query = query.gte('created_at', params.since.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Failed to get events', { error });
      throw new Error(`Failed to get events: ${error.message}`);
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      eventType: row.event_type,
      entityType: row.entity_type,
      entityId: row.entity_id,
      orderType: row.order_type,
      orderId: row.order_id,
      payload: row.payload,
      createdAt: new Date(row.created_at)
    }));
  }

  /**
   * Get metrics summary for monitoring dashboard
   */
  async getMetricsSummary(): Promise<Array<{
    metricName: string;
    sampleCount: number;
    avgValue: number;
    minValue: number;
    maxValue: number;
    p50: number;
    p95: number;
    p99: number;
    hour: Date;
  }>> {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('customization_metrics_summary')
      .select('*');

    if (error) {
      logger.error('Failed to get metrics summary', { error });
      throw new Error(`Failed to get metrics summary: ${error.message}`);
    }

    return (data || []).map((row: any) => ({
      metricName: row.metric_name,
      sampleCount: parseInt(row.sample_count),
      avgValue: parseFloat(row.avg_value),
      minValue: parseFloat(row.min_value),
      maxValue: parseFloat(row.max_value),
      p50: parseFloat(row.p50),
      p95: parseFloat(row.p95),
      p99: parseFloat(row.p99),
      hour: new Date(row.hour)
    }));
  }

  /**
   * Emit a custom event for observability
   */
  async emitEvent(
    eventType: string,
    payload: Record<string, unknown>,
    context?: {
      entityType?: string;
      entityId?: string;
      orderType?: string;
      orderId?: string;
    }
  ): Promise<string> {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('customization_events')
      .insert({
        event_type: eventType,
        entity_type: context?.entityType,
        entity_id: context?.entityId,
        order_type: context?.orderType,
        order_id: context?.orderId,
        payload
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Failed to emit event', { error });
      throw new Error(`Failed to emit event: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Record a metric for performance tracking
   */
  async recordMetric(
    metricName: string,
    value: number,
    dimensions?: Record<string, unknown>
  ): Promise<void> {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('customization_metrics')
      .insert({
        metric_name: metricName,
        metric_value: value,
        dimensions: dimensions || {}
      });

    if (error) {
      logger.warn('Failed to record metric', { error, metricName });
      // Don't throw - metrics are non-critical
    }
  }

  // ==========================================
  // DUAL-WRITE SUPPORT FOR SAFE MIGRATION
  // ==========================================

  /**
   * Log dual-write comparison for migration validation
   */
  async logDualWriteComparison(
    operation: string,
    oldSystemResult: Record<string, unknown>,
    newSystemResult: Record<string, unknown>
  ): Promise<string> {
    const supabase = getSupabase();
    
    const { data, error } = await supabase.rpc('log_dual_write_comparison', {
      p_operation: operation,
      p_old_result: oldSystemResult,
      p_new_result: newSystemResult
    });

    if (error) {
      logger.error('Failed to log dual-write comparison', { error });
      throw new Error(`Failed to log dual-write: ${error.message}`);
    }

    return data;
  }

  /**
   * Get dual-write discrepancies for monitoring
   */
  async getDualWriteDiscrepancies(limit: number = 100): Promise<Array<{
    id: string;
    operation: string;
    oldResult: Record<string, unknown>;
    newResult: Record<string, unknown>;
    resultsMatch: boolean;
    discrepancies: Record<string, unknown>;
    createdAt: Date;
  }>> {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('customization_dual_write_log')
      .select('*')
      .eq('results_match', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Failed to get dual-write discrepancies', { error });
      throw new Error(`Failed to get discrepancies: ${error.message}`);
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      operation: row.operation,
      oldResult: row.old_system_result,
      newResult: row.new_system_result,
      resultsMatch: row.results_match,
      discrepancies: row.discrepancies,
      createdAt: new Date(row.created_at)
    }));
  }

  /**
   * Get dual-write match rate statistics
   */
  async getDualWriteStats(): Promise<{
    total: number;
    matches: number;
    mismatches: number;
    matchRate: number;
  }> {
    const supabase = getSupabase();
    
    const { data: total, error: totalErr } = await supabase
      .from('customization_dual_write_log')
      .select('id', { count: 'exact', head: true });

    const { data: matches, error: matchErr } = await supabase
      .from('customization_dual_write_log')
      .select('id', { count: 'exact', head: true })
      .eq('results_match', true);

    if (totalErr || matchErr) {
      logger.error('Failed to get dual-write stats', { totalErr, matchErr });
      throw new Error('Failed to get dual-write stats');
    }

    const totalCount = (total as any)?.count || 0;
    const matchCount = (matches as any)?.count || 0;
    const mismatchCount = totalCount - matchCount;

    return {
      total: totalCount,
      matches: matchCount,
      mismatches: mismatchCount,
      matchRate: totalCount > 0 ? (matchCount / totalCount) * 100 : 100
    };
  }

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  private mapGroupFromDb(row: any): CustomizationGroup {
    return {
      id: row.id,
      name: row.name,
      nameAr: row.name_ar,
      nameFr: row.name_fr,
      description: row.description,
      descriptionAr: row.description_ar,
      displayName: row.display_name,
      displayNameAr: row.display_name_ar,
      icon: row.icon,
      selectionMode: row.selection_mode as SelectionMode,
      minSelections: row.min_selections,
      maxSelections: row.max_selections,
      isRequired: row.is_required,
      applicableEntityTypes: row.applicable_entity_types || [],
      isGlobal: row.is_global,
      isAvailable: row.is_available,
      availableFrom: row.available_from,
      availableUntil: row.available_until,
      availableDays: row.available_days,
      displayConditions: row.display_conditions,
      sortOrder: row.sort_order,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : undefined
    };
  }

  private mapOptionFromDb(row: any): CustomizationOption {
    return {
      id: row.id,
      groupId: row.group_id,
      name: row.name,
      nameAr: row.name_ar,
      nameFr: row.name_fr,
      description: row.description,
      descriptionAr: row.description_ar,
      customizationType: row.customization_type as CustomizationType,
      priceAdjustment: parseFloat(row.price_adjustment) || 0,
      priceType: row.price_type as PriceType,
      inventoryItemId: row.inventory_item_id,
      quantityPerSelection: parseFloat(row.quantity_per_selection) || 1,
      inventoryUnit: row.inventory_unit,
      replacesInventoryItemId: row.replaces_inventory_item_id,
      maxQuantity: row.max_quantity,
      quantityIncrement: parseFloat(row.quantity_increment) || 1,
      isDefault: row.is_default,
      isPopular: row.is_popular,
      badgeText: row.badge_text,
      badgeColor: row.badge_color,
      imageUrl: row.image_url,
      isAvailable: row.is_available,
      availableStock: row.available_stock,
      sortOrder: row.sort_order,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : undefined
    };
  }

  private mapEntityCustomizationFromDb(row: any): EntityCustomization {
    return {
      id: row.id,
      entityType: row.entity_type as CustomizableEntityType,
      entityId: row.entity_id,
      customizationGroupId: row.customization_group_id,
      isRequiredOverride: row.is_required_override,
      minSelectionsOverride: row.min_selections_override,
      maxSelectionsOverride: row.max_selections_override,
      priceMultiplier: parseFloat(row.price_multiplier) || 1,
      isEnabled: row.is_enabled,
      sortOrder: row.sort_order,
      createdAt: new Date(row.created_at)
    };
  }
}

// Export singleton instance
export const customizationService = new CustomizationService();
export default customizationService;
