import { BaseRepository } from './BaseRepository.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Module {
  [key: string]: unknown;
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  template_type?: string | null;
  icon?: string | null;
  version?: string | null;
  settings?: Record<string, unknown>;
  is_enabled?: boolean;
  is_core?: boolean;
  sort_order?: string;
  created_at?: string;
  updated_at?: string;
}

export interface EmailTemplate {
  [key: string]: unknown;
  id: string;
  module_id?: string | null;
  name: string;
  slug: string;
  subject: string;
  subject_translations?: Record<string, unknown>;
  body: string;
  body_translations?: Record<string, unknown>;
  variables?: unknown;
  channel?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

// ---------------------------------------------------------------------------
// Repositories
// ---------------------------------------------------------------------------

export class ModuleItemRepository extends BaseRepository<Module> {
  constructor() {
    super('modules');
  }

  /** Find a module by its unique slug. */
  async findBySlug(slug: string): Promise<Module | null> {
    const { data, error } = await this.getClient()
      .from(this.tableName)
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error) throw new Error(`[modules] findBySlug failed: ${error.message}`);
    return (data as Module) ?? null;
  }

  /** Find all enabled modules. */
  async findEnabled(): Promise<Module[]> {
    return this.findMany(
      { is_enabled: true },
      { orderBy: 'sort_order', ascending: true },
    );
  }

  /** Find all core modules. */
  async findCore(): Promise<Module[]> {
    return this.findMany(
      { is_core: true },
      { orderBy: 'sort_order', ascending: true },
    );
  }

  /** Toggle the enabled state of a module. */
  async toggleEnabled(id: string, enabled: boolean): Promise<Module> {
    return this.update(id, { is_enabled: enabled } as Partial<Module>);
  }
}

export class EmailTemplateRepository extends BaseRepository<EmailTemplate> {
  constructor() {
    super('email_templates');
  }

  /** Find templates belonging to a module. */
  async findByModule(moduleId: string): Promise<EmailTemplate[]> {
    return this.findMany({ module_id: moduleId });
  }

  /** Find a template by its unique slug. */
  async findBySlug(slug: string): Promise<EmailTemplate | null> {
    const { data, error } = await this.getClient()
      .from(this.tableName)
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error) throw new Error(`[email_templates] findBySlug failed: ${error.message}`);
    return (data as EmailTemplate) ?? null;
  }

  /** Find all active templates. */
  async findActive(): Promise<EmailTemplate[]> {
    return this.findMany({ is_active: true });
  }
}

/** Facade combining module sub-repositories. */
export class ModuleRepository {
  readonly modules = new ModuleItemRepository();
  readonly emailTemplates = new EmailTemplateRepository();
}
