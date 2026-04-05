import { Request, Response } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { getSupabase } from '../../database/connection.js';

export interface ModifierOption {
    name: string;
    nameAr?: string;
    price?: number;
    isAvailable?: boolean;
    modifierType?: 'add' | 'remove' | 'swap';
    inventoryItemId?: string;
    quantityRequired?: number;
    unit?: string;
    description?: string;
    descriptionAr?: string;
    maxQuantity?: number;
    isDefault?: boolean;
}

export const modifiersController = {
    createGroup: asyncHandler(async (req: Request, res: Response) => {
            const supabase = getSupabase();
            const { 
                name, 
                minSelections, 
                maxSelections, 
                isRequired,
                allowMultipleSame,
                options, 
                moduleId 
            } = req.body;

            // Create Group (only use columns that exist in base schema)
            const { data: group, error } = await supabase
                .from('menu_modifier_groups')
                .insert({
                    name,
                    min_selections: minSelections || 0,
                    max_selections: maxSelections || 1,
                    is_required: isRequired || false,
                    module_id: moduleId
                })
                .select()
                .single();

            if (error) throw error;

            // Create Options with full modifier support
            let createdOptions: any[] = [];
            if (options && options.length > 0) {
                const optionsData = (options as ModifierOption[]).map((opt, idx: number) => ({
                    modifier_group_id: group.id,
                    name: opt.name,
                    price_adjustment: opt.price || 0,
                    is_available: opt.isAvailable !== false,
                    modifier_type: opt.modifierType || 'add',
                    inventory_item_id: opt.inventoryItemId || null,
                    quantity_required: opt.quantityRequired || 1,
                    unit: opt.unit || 'pcs',
                    display_order: idx
                }));

                const { data: insertedOptions, error: optError } = await supabase
                    .from('menu_modifier_options')
                    .insert(optionsData)
                    .select();

                if (optError) throw optError;
                createdOptions = insertedOptions || [];
            }

            res.status(201).json({ success: true, data: { ...group, options: createdOptions } });
    }),

    updateGroup: asyncHandler(async (req: Request, res: Response) => {
            const supabase = getSupabase();
            const { id } = req.params;
            const { name, minSelections, maxSelections, isRequired } = req.body;

            const { data, error } = await supabase
                .from('menu_modifier_groups')
                .update({
                    name,
                    min_selections: minSelections,
                    max_selections: maxSelections,
                    is_required: isRequired,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            res.json({ success: true, data });
    }),

    deleteGroup: asyncHandler(async (req: Request, res: Response) => {
            const supabase = getSupabase();
            const { id } = req.params;
            // Soft delete
            const { error } = await supabase
            .from('menu_modifier_groups')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);

            if (error) throw error;
            res.json({ success: true });
    }),

    getGroups: asyncHandler(async (req: Request, res: Response) => {
            const supabase = getSupabase();
            const { moduleId } = req.query;

            let q = supabase
                .from('menu_modifier_groups')
                .select(`
                    *,
                    options:menu_modifier_options(
                        id, name, price_adjustment, is_available, display_order,
                        modifier_type, inventory_item_id, quantity_required, unit
                    )
                `)
                .is('deleted_at', null)
                .order('display_order', { ascending: true });

            if (moduleId) q = q.eq('module_id', moduleId);

            const { data, error } = await q;
            if (error) throw error;

            res.json({ success: true, data });
    }),

    // NEW: Get modifiers for a specific menu item
    getItemModifiers: asyncHandler(async (req: Request, res: Response) => {
            const supabase = getSupabase();
            const { menuItemId } = req.params;

            const { data, error } = await supabase
                .from('menu_item_modifiers')
                .select(`
                    id, sort_order,
                    modifier_group:menu_modifier_groups(
                        id, name, min_selections, max_selections, is_required, allow_multiple_same,
                        options:menu_modifier_options(
                            id, name, price_adjustment, is_available, display_order,
                            modifier_type, inventory_item_id, quantity_required, unit
                        )
                    )
                `)
                .eq('menu_item_id', menuItemId)
                .order('sort_order', { ascending: true });

            if (error) throw error;

            // Flatten the response
            const modifierGroups = data?.map(item => ({
                ...item.modifier_group,
                sortOrder: item.sort_order,
            })).filter((g: Record<string, unknown>) => g && !g.deleted_at) || [];

            res.json({ success: true, data: modifierGroups });
    }),

    // NEW: Link modifier groups to a menu item
    setItemModifiers: asyncHandler(async (req: Request, res: Response) => {
            const supabase = getSupabase();
            const { menuItemId } = req.params;
            const { modifierGroupIds } = req.body; // Array of { groupId, sortOrder }

            // Delete existing links
            await supabase
                .from('menu_item_modifiers')
                .delete()
                .eq('menu_item_id', menuItemId);

            // Insert new links
            if (modifierGroupIds && modifierGroupIds.length > 0) {
                const links = modifierGroupIds.map((item: { groupId: string; sortOrder?: number }, idx: number) => ({
                    menu_item_id: menuItemId,
                    modifier_group_id: item.groupId,
                    sort_order: item.sortOrder ?? idx,
                }));

                const { error } = await supabase
                    .from('menu_item_modifiers')
                    .insert(links);

                if (error) throw error;
            }

            res.json({ success: true });
    }),

    // NEW: Create/Update a single modifier option
    createOption: asyncHandler(async (req: Request, res: Response) => {
            const supabase = getSupabase();
            const { groupId } = req.params;
            const opt = req.body as ModifierOption;

            const { data, error } = await supabase
                .from('menu_modifier_options')
                .insert({
                    modifier_group_id: groupId,
                    name: opt.name,
                    price_adjustment: opt.price || 0,
                    is_available: opt.isAvailable !== false,
                    modifier_type: opt.modifierType || 'add',
                    inventory_item_id: opt.inventoryItemId || null,
                    quantity_required: opt.quantityRequired || 1,
                    unit: opt.unit || 'pcs',
                })
                .select()
                .single();

            if (error) throw error;
            res.status(201).json({ success: true, data });
    }),

    updateOption: asyncHandler(async (req: Request, res: Response) => {
            const supabase = getSupabase();
            const { optionId } = req.params;
            const opt = req.body as Partial<ModifierOption>;

            const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
            if (opt.name !== undefined) updateData.name = opt.name;
            if (opt.price !== undefined) updateData.price_adjustment = opt.price;
            if (opt.isAvailable !== undefined) updateData.is_available = opt.isAvailable;
            if (opt.modifierType !== undefined) updateData.modifier_type = opt.modifierType;
            if (opt.inventoryItemId !== undefined) updateData.inventory_item_id = opt.inventoryItemId;
            if (opt.quantityRequired !== undefined) updateData.quantity_required = opt.quantityRequired;
            if (opt.unit !== undefined) updateData.unit = opt.unit;

            const { data, error } = await supabase
                .from('menu_modifier_options')
                .update(updateData)
                .eq('id', optionId)
                .select()
                .single();

            if (error) throw error;
            res.json({ success: true, data });
    }),

    deleteOption: asyncHandler(async (req: Request, res: Response) => {
            const supabase = getSupabase();
            const { optionId } = req.params;
            
            await supabase
                .from('menu_modifier_options')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', optionId);

            res.json({ success: true });
    }),

    // NEW: Get all inventory items for linking (helper endpoint)
    getInventoryItems: asyncHandler(async (req: Request, res: Response) => {
            const supabase = getSupabase();
            const { search } = req.query;

            let q = supabase
                .from('inventory_items')
                .select('id, name, current_stock, unit, category_id')
                .order('name', { ascending: true })
                .limit(100);

            if (search) {
                q = q.ilike('name', `%${search}%`);
            }

            const { data, error } = await q;
            if (error) throw error;

            res.json({ success: true, data });
    })
};
