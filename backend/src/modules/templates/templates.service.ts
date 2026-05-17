/**
 * Module Templates Service
 * CRUD for module templates + "apply template" logic that creates a new module
 * with pre-configured layout, settings, and optional seed data.
 */

import { getSupabase } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';

const supabase = getSupabase();

export interface ModuleTemplate {
  id: string;
  name: string;
  description: string;
  engine_type: string;
  category: string;
  thumbnail_url: string | null;
  layout: any[];
  default_settings: Record<string, any>;
  seed_data: Record<string, any> | null;
  is_official: boolean;
  is_active: boolean;
  usage_count: number;
  created_at: string;
}

/**
 * List all active templates, optionally filtered by engine type.
 */
export async function listTemplates(engineType?: string): Promise<ModuleTemplate[]> {
  let query = supabase
    .from('module_templates')
    .select('*')
    .eq('is_active', true)
    .order('is_official', { ascending: false })
    .order('usage_count', { ascending: false });

  if (engineType) {
    query = query.eq('engine_type', engineType);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list templates: ${error.message}`);
  return data || [];
}

/**
 * Get a single template by ID.
 */
export async function getTemplate(id: string): Promise<ModuleTemplate | null> {
  const { data, error } = await supabase
    .from('module_templates')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to get template: ${error.message}`);
  }
  return data;
}

/**
 * Create a new custom template (admin only).
 */
export async function createTemplate(input: {
  name: string;
  description?: string;
  engine_type: string;
  category?: string;
  layout: any[];
  default_settings?: Record<string, any>;
  seed_data?: Record<string, any>;
  created_by?: string;
}): Promise<ModuleTemplate> {
  const { data, error } = await supabase
    .from('module_templates')
    .insert({
      name: input.name,
      description: input.description || '',
      engine_type: input.engine_type,
      category: input.category || 'general',
      layout: input.layout,
      default_settings: input.default_settings || {},
      seed_data: input.seed_data || null,
      is_official: false,
      created_by: input.created_by || null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create template: ${error.message}`);
  return data;
}

/**
 * Apply a template to create a new module.
 * Creates the module with the template's layout and settings, then increments usage count.
 */
export async function applyTemplate(
  templateId: string,
  propertyId: string,
  moduleName: string,
  overrideSettings?: Record<string, any>
): Promise<{ moduleId: string }> {
  const template = await getTemplate(templateId);
  if (!template) throw new Error('Template not found');

  // Merge template settings with any overrides
  const finalSettings = {
    ...template.default_settings,
    ...overrideSettings,
    layout: template.layout,
  };

  // Create the module
  const { data: newModule, error: moduleError } = await supabase
    .from('modules')
    .insert({
      name: moduleName,
      engine_type: template.engine_type,
      property_id: propertyId,
      settings: finalSettings,
      is_active: true,
      template_id: templateId,
    })
    .select('id')
    .single();

  if (moduleError) {
    // If template_id column doesn't exist, try without it
    if (moduleError.message.includes('template_id')) {
      const { data: fallbackModule, error: fallbackError } = await supabase
        .from('modules')
        .insert({
          name: moduleName,
          engine_type: template.engine_type,
          property_id: propertyId,
          settings: finalSettings,
          is_active: true,
        })
        .select('id')
        .single();

      if (fallbackError) throw new Error(`Failed to create module from template: ${fallbackError.message}`);

      // Increment usage count
      await supabase
        .from('module_templates')
        .update({ usage_count: template.usage_count + 1 })
        .eq('id', templateId);

      return { moduleId: fallbackModule.id };
    }
    throw new Error(`Failed to create module from template: ${moduleError.message}`);
  }

  // Increment usage count
  await supabase
    .from('module_templates')
    .update({ usage_count: template.usage_count + 1 })
    .eq('id', templateId);

  logger.info(`Module created from template: ${template.name} → ${moduleName}`, {
    templateId,
    moduleId: newModule.id,
    engineType: template.engine_type,
  });

  return { moduleId: newModule.id };
}

/**
 * Delete a template (admin only, cannot delete official templates).
 */
export async function deleteTemplate(id: string): Promise<void> {
  const template = await getTemplate(id);
  if (!template) throw new Error('Template not found');
  if (template.is_official) throw new Error('Cannot delete official templates');

  const { error } = await supabase
    .from('module_templates')
    .update({ is_active: false })
    .eq('id', id);

  if (error) throw new Error(`Failed to delete template: ${error.message}`);
}
