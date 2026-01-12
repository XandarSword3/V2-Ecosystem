import { ApiClient } from '../utils/api-client';
import { Logger, globalMetrics } from '../utils/logger';
import { CONFIG, generateStaffData } from '../config';
import {
  weightedRandom,
  randomDelay,
  randomInt,
  randomElement,
  randomName,
} from '../utils/helpers';

export class AdminBot {
  private api: ApiClient;
  private logger: Logger;
  private botId: number;
  private isRunning = false;
  private hiredTrainees = 0;
  
  // Cached admin data
  private users: any[] = [];
  private modules: any[] = [];
  private reviews: any[] = [];
  private menuCategories: any[] = [];
  private menuItems: any[] = [];
  private chalets: any[] = [];
  private poolSessions: any[] = [];

  // Callback for trainee hiring
  private onTraineeHired?: (traineeData: any) => void;

  constructor(botId: number, onTraineeHired?: (traineeData: any) => void) {
    this.botId = botId;
    this.api = new ApiClient();
    this.logger = new Logger('Admin', botId);
    this.onTraineeHired = onTraineeHired;
  }

  async initialize(): Promise<boolean> {
    // Use the main admin account
    const success = await this.api.login(CONFIG.ADMIN_EMAIL, CONFIG.ADMIN_PASSWORD);
    
    if (!success) {
      this.logger.error('Failed to login as admin!');
      return false;
    }

    this.logger.success(`Logged in as Super Admin`);
    
    // Load initial admin data
    await this.refreshAdminData();
    
    return true;
  }

  private async refreshAdminData(): Promise<void> {
    const [usersRes, modulesRes, reviewsRes] = await Promise.all([
      this.api.getUsers({ limit: 100 }),
      this.api.getModules(),
      this.api.getAdminReviews(),
    ]);

    if (usersRes.success && usersRes.data) {
      this.users = Array.isArray(usersRes.data) ? usersRes.data : (usersRes.data.users || []);
    }

    if (modulesRes.success && modulesRes.data) {
      this.modules = Array.isArray(modulesRes.data) ? modulesRes.data : (modulesRes.data.modules || []);
    }

    if (reviewsRes.success && reviewsRes.data) {
      this.reviews = Array.isArray(reviewsRes.data) ? reviewsRes.data : (reviewsRes.data.reviews || []);
    }
  }

  // Pre-create staff accounts before starting staff bots
  async createStaffAccounts(count: number): Promise<{ email: string; password: string }[]> {
    const createdAccounts: { email: string; password: string }[] = [];
    
    for (let i = 1; i <= count; i++) {
      const staffData = generateStaffData(i, false);
      
      this.logger.action(`Creating staff account #${i}: ${staffData.full_name}...`);
      
      const result = await this.api.createUser({
        email: staffData.email,
        password: staffData.password,
        full_name: staffData.full_name,
        phone: staffData.phone,
        roles: staffData.roles,
      });

      if (result.success) {
        this.logger.success(`Staff account created: ${staffData.email}`);
        createdAccounts.push({ email: staffData.email, password: staffData.password });
      } else {
        // Account might already exist, try with the expected password
        this.logger.info(`Staff account may already exist: ${staffData.email}`);
        createdAccounts.push({ email: staffData.email, password: staffData.password });
      }
      
      await randomDelay(200, 500);
    }
    
    return createdAccounts;
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.logger.info('🔐 Starting admin monitoring simulation...');

    // Monitoring actions take priority
    const monitoringActions = [
      'VIEW_DASHBOARD',
      'VIEW_REVENUE_STATS', 
      'VIEW_REPORTS',
      'VIEW_REVIEWS',
      'VIEW_AUDIT_LOGS',
      'VIEW_USERS',
      'VIEW_MODULES',
    ];
    
    let monitoringCycle = 0;

    while (this.isRunning) {
      let action: string;
      
      // Every 3 cycles, do a full monitoring sweep
      if (monitoringCycle % 3 === 0) {
        action = monitoringActions[monitoringCycle % monitoringActions.length];
        this.logger.info(`📊 Monitoring: ${action.replace(/_/g, ' ').toLowerCase()}`);
      } else {
        // Otherwise pick from weighted actions (may include management tasks)
        action = weightedRandom(CONFIG.ADMIN_ACTIONS);
      }
      
      await this.performAction(action);
      
      monitoringCycle++;
      await randomDelay(CONFIG.ADMIN_ACTION_INTERVAL.min, CONFIG.ADMIN_ACTION_INTERVAL.max);
    }
  }

  stop(): void {
    this.isRunning = false;
    this.logger.info('Admin logging off...');
  }

  private async performAction(action: string): Promise<void> {
    const startTime = Date.now();
    let success = false;

    try {
      switch (action) {
        case 'VIEW_DASHBOARD':
          success = await this.viewDashboard();
          break;
        case 'VIEW_REVENUE_STATS':
          success = await this.viewRevenueStats();
          break;
        case 'VIEW_REPORTS':
          success = await this.viewReports();
          break;
        case 'VIEW_USERS':
          success = await this.viewUsers();
          break;
        case 'CREATE_USER':
          success = await this.createUser();
          break;
        case 'UPDATE_USER':
          success = await this.updateUser();
          break;
        case 'VIEW_MODULES':
          success = await this.viewModules();
          break;
        case 'UPDATE_MODULE':
          success = await this.updateModule();
          break;
        case 'CREATE_MODULE':
          success = await this.createModule();
          break;
        case 'VIEW_SETTINGS':
          success = await this.viewSettings();
          break;
        case 'UPDATE_SETTINGS':
          success = await this.updateSettings();
          break;
        case 'VIEW_REVIEWS':
          success = await this.viewReviews();
          break;
        case 'APPROVE_REVIEW':
          success = await this.approveReview();
          break;
        case 'REJECT_REVIEW':
          success = await this.rejectReview();
          break;
        case 'VIEW_AUDIT_LOGS':
          success = await this.viewAuditLogs();
          break;
        case 'CREATE_BACKUP':
          success = await this.createBackup();
          break;
        case 'MANAGE_MENU_CATEGORY':
          success = await this.manageMenuCategory();
          break;
        case 'MANAGE_MENU_ITEM':
          success = await this.manageMenuItem();
          break;
        case 'MANAGE_CHALET':
          success = await this.manageChalet();
          break;
        case 'MANAGE_POOL_SESSION':
          success = await this.managePoolSession();
          break;
        default:
          this.logger.warn(`Unknown action: ${action}`);
          return;
      }

      const latency = Date.now() - startTime;
      globalMetrics.recordRequest(success, latency);
      globalMetrics.recordAction(`Admin.${action}`);

    } catch (error: any) {
      globalMetrics.recordRequest(false, Date.now() - startTime);
      globalMetrics.recordError(`Admin ${this.botId}: ${action} - ${error.message}`);
      this.logger.error(`${action} failed: ${error.message}`);
    }
  }

  // ============ ACTION IMPLEMENTATIONS ============

  private async viewDashboard(): Promise<boolean> {
    this.logger.action('Viewing dashboard...');
    
    const result = await this.api.getDashboard();
    
    if (result.success) {
      const stats = result.data;
      this.logger.success(`Dashboard: Revenue ${stats?.totalRevenue || 'N/A'}, Orders ${stats?.totalOrders || 'N/A'}`);
    }
    return result.success;
  }

  private async viewRevenueStats(): Promise<boolean> {
    this.logger.action('Checking revenue statistics...');
    
    const result = await this.api.getRevenueStats();
    
    if (result.success) {
      this.logger.success('Revenue stats loaded');
    }
    return result.success;
  }

  private async viewReports(): Promise<boolean> {
    const reportType = randomElement(['overview', 'occupancy', 'customers']);
    this.logger.action(`Viewing ${reportType} report...`);
    
    const result = await this.api.getReports(reportType);
    
    if (result.success) {
      this.logger.success(`${reportType} report loaded`);
    }
    return result.success;
  }

  private async viewUsers(): Promise<boolean> {
    const role = randomElement(['all', 'staff', 'customer', 'admin']);
    this.logger.action(`Viewing users (${role})...`);
    
    const params = role !== 'all' ? { role } : undefined;
    const result = await this.api.getUsers(params);
    
    if (result.success) {
      this.users = Array.isArray(result.data) ? result.data : (result.data?.users || []);
      this.logger.success(`Found ${this.users.length} users`);
    }
    return result.success;
  }

  private async createUser(): Promise<boolean> {
    // Check if we should hire trainees
    if (this.hiredTrainees < CONFIG.STAFF_BOTS_TRAINEES) {
      return await this.hireTrainee();
    }

    // Otherwise create a random test user
    this.logger.action('Creating new user...');
    
    const result = await this.api.createUser({
      email: `newuser${randomInt(1000, 9999)}@stresstest.local`,
      password: 'TestPass123!',
      full_name: randomName(),
      roles: [randomElement(['customer', 'restaurant_staff', 'pool_staff'])],
    });

    if (result.success) {
      this.logger.success(`User created: ${result.data?.email || 'unknown'}`);
    }
    return result.success;
  }

  private async hireTrainee(): Promise<boolean> {
    const traineeIndex = this.hiredTrainees + 1;
    const traineeData = generateStaffData(traineeIndex, true);
    
    this.logger.action(`🎓 Hiring trainee #${traineeIndex}: ${traineeData.full_name}...`);
    
    const result = await this.api.createUser({
      email: traineeData.email,
      password: traineeData.password,
      full_name: traineeData.full_name,
      phone: traineeData.phone,
      roles: traineeData.roles,
    });

    if (result.success) {
      this.hiredTrainees++;
      this.logger.success(`🎓 Trainee hired! ${traineeData.full_name} (${traineeData.email})`);
      
      // Notify orchestrator to spawn a new trainee bot
      if (this.onTraineeHired) {
        this.onTraineeHired(traineeData);
      }
    }
    return result.success;
  }

  private async updateUser(): Promise<boolean> {
    if (this.users.length === 0) {
      await this.refreshAdminData();
      if (this.users.length === 0) return true;
    }

    // Pick a non-admin user to update
    const user = this.users.find(u => 
      !u.roles?.includes('super_admin') && 
      u.email?.includes('stresstest')
    );

    if (!user) {
      this.logger.info('No suitable users to update');
      return true;
    }

    this.logger.action(`Updating user ${user.email}...`);
    
    const result = await this.api.updateUser(user.id, {
      full_name: user.full_name + ' (Updated)',
    });

    if (result.success) {
      this.logger.success(`User ${user.email} updated`);
    }
    return result.success;
  }

  private async viewModules(): Promise<boolean> {
    this.logger.action('Viewing modules...');
    
    const result = await this.api.getModules();
    
    if (result.success) {
      this.modules = Array.isArray(result.data) ? result.data : (result.data?.modules || []);
      this.logger.success(`Found ${this.modules.length} modules`);
    }
    return result.success;
  }

  private async updateModule(): Promise<boolean> {
    if (this.modules.length === 0) {
      await this.refreshAdminData();
      if (this.modules.length === 0) return true;
    }

    const module = randomElement(this.modules);
    
    this.logger.action(`Toggling module: ${module.name || module.slug}...`);
    
    // Just toggle enabled status
    const result = await this.api.updateModule(module.id, {
      enabled: !module.enabled,
    });

    if (result.success) {
      module.enabled = !module.enabled;
      this.logger.success(`Module ${module.name || module.slug} is now ${module.enabled ? 'enabled' : 'disabled'}`);
      
      // Toggle it back to avoid breaking things
      await this.api.updateModule(module.id, { enabled: !module.enabled });
    }
    return result.success;
  }

  private async createModule(): Promise<boolean> {
    const moduleNum = randomInt(1, 9999);
    const moduleName = `Test Module ${moduleNum}`;
    const moduleSlug = `test-module-${moduleNum}`;
    
    this.logger.action(`Creating new dynamic module: ${moduleName}...`);
    
    const result = await this.api.createModule({
      name: moduleName,
      slug: moduleSlug,
      description: `Test module created by stress test at ${new Date().toISOString()}`,
      icon: randomElement(['🍔', '🍕', '🍜', '🍳', '🥗', '🍰', '☕', '🍹']),
      template_type: 'menu_service',
      is_active: true,
      display_order: randomInt(10, 100),
      settings: {
        createdBy: 'stress-test-admin-bot',
        createdAt: new Date().toISOString(),
      },
    });

    if (result.success) {
      const newModule = result.data;
      this.modules.push(newModule);
      this.logger.success(`✨ Created module: ${moduleName} (${moduleSlug})`);
      
      // Create some menu items for the new module
      await this.createModuleMenuItems(newModule.id || newModule.data?.id);
    }
    return result.success;
  }

  private async createModuleMenuItems(moduleId: string): Promise<void> {
    if (!moduleId) return;
    
    const items = [
      { name: 'Module Special', price: randomInt(10000, 50000), description: 'House specialty' },
      { name: 'Daily Deal', price: randomInt(5000, 25000), description: 'Today\'s special' },
      { name: 'Quick Bite', price: randomInt(3000, 15000), description: 'Fast and tasty' },
    ];

    for (const item of items) {
      try {
        await this.api.createModuleMenuItem(moduleId, {
          name: item.name,
          description: item.description,
          price: item.price,
          available: true,
          display_order: randomInt(1, 50),
        });
        this.logger.info(`  Added menu item: ${item.name}`);
      } catch (e) {
        // Non-critical, continue
      }
    }
  }

  private async viewSettings(): Promise<boolean> {
    this.logger.action('Viewing site settings...');
    
    const result = await this.api.getSettings();
    
    if (result.success) {
      this.logger.success('Settings loaded');
    }
    return result.success;
  }

  private async updateSettings(): Promise<boolean> {
    this.logger.action('Updating settings...');
    
    // Get current settings first
    const current = await this.api.getSettings();
    if (!current.success || !current.data) return false;

    // Make a minor update
    const result = await this.api.updateSettings({
      ...current.data,
      lastStressTest: new Date().toISOString(),
    });

    if (result.success) {
      this.logger.success('Settings updated');
    }
    return result.success;
  }

  private async viewReviews(): Promise<boolean> {
    this.logger.action('Viewing reviews...');
    
    const result = await this.api.getAdminReviews();
    
    if (result.success) {
      this.reviews = Array.isArray(result.data) ? result.data : (result.data?.reviews || []);
      const pending = this.reviews.filter(r => r.status === 'pending').length;
      this.logger.success(`Found ${this.reviews.length} reviews (${pending} pending)`);
    }
    return result.success;
  }

  private async approveReview(): Promise<boolean> {
    const pendingReview = this.reviews.find(r => r.status === 'pending');

    if (!pendingReview) {
      this.logger.info('No pending reviews to approve');
      return true;
    }

    this.logger.action(`Approving review ${pendingReview.id}...`);
    
    const result = await this.api.approveReview(pendingReview.id);

    if (result.success) {
      pendingReview.status = 'approved';
      this.logger.success('Review approved');
    }
    return result.success;
  }

  private async rejectReview(): Promise<boolean> {
    const pendingReview = this.reviews.find(r => r.status === 'pending');

    if (!pendingReview) {
      this.logger.info('No pending reviews to reject');
      return true;
    }

    this.logger.action(`Rejecting review ${pendingReview.id}...`);
    
    const result = await this.api.rejectReview(pendingReview.id);

    if (result.success) {
      pendingReview.status = 'rejected';
      this.logger.success('Review rejected');
    }
    return result.success;
  }

  private async viewAuditLogs(): Promise<boolean> {
    this.logger.action('Viewing audit logs...');
    
    const result = await this.api.getAuditLogs();
    
    if (result.success) {
      const count = Array.isArray(result.data) ? result.data.length : (result.data?.logs?.length || 0);
      this.logger.success(`Found ${count} audit log entries`);
    }
    return result.success;
  }

  private async createBackup(): Promise<boolean> {
    this.logger.action('Creating system backup...');
    
    const result = await this.api.createBackup();
    
    if (result.success) {
      this.logger.success(`Backup created: ${result.data?.filename || 'unknown'}`);
    }
    return result.success;
  }

  private async manageMenuCategory(): Promise<boolean> {
    const module = randomElement(['restaurant', 'snack']) as 'restaurant' | 'snack';
    
    this.logger.action(`Managing ${module} menu categories...`);
    
    // Create a test category
    const result = await this.api.createMenuCategory(module, {
      name: `Test Category ${randomInt(1, 100)}`,
      description: 'Created by stress test',
      displayOrder: randomInt(1, 50),
      enabled: true,
    });

    if (result.success) {
      this.logger.success(`Category created in ${module}`);
    }
    return result.success;
  }

  private async manageMenuItem(): Promise<boolean> {
    const module = randomElement(['restaurant', 'snack']) as 'restaurant' | 'snack';
    
    // For now just toggle availability of an existing item
    this.logger.action(`Managing ${module} menu items...`);
    
    // Get categories first
    const catResult = await this.api.getRestaurantCategories();
    if (!catResult.success || !catResult.data) return false;

    const categories: any[] = Array.isArray(catResult.data) ? catResult.data : (catResult.data.categories || []);
    if (categories.length === 0) return true;

    const category = randomElement(categories);

    const result = await this.api.createMenuItem(module, {
      name: `Test Item ${randomInt(1, 1000)}`,
      description: 'Created by stress test bot',
      price: randomInt(10000, 100000),
      categoryId: category?.id,
      available: true,
    });

    if (result.success) {
      this.logger.success(`Menu item created in ${module}`);
    }
    return result.success;
  }

  private async manageChalet(): Promise<boolean> {
    this.logger.action('Managing chalets...');
    
    // View chalets (don't create new ones during stress test)
    const result = await this.api.getChalets();
    
    if (result.success) {
      this.chalets = Array.isArray(result.data) ? result.data : (result.data?.chalets || []);
      this.logger.success(`Found ${this.chalets.length} chalets`);
    }
    return result.success;
  }

  private async managePoolSession(): Promise<boolean> {
    this.logger.action('Managing pool sessions...');
    
    const result = await this.api.getPoolSessions();
    
    if (result.success) {
      this.poolSessions = Array.isArray(result.data) ? result.data : (result.data?.sessions || []);
      this.logger.success(`Found ${this.poolSessions.length} pool sessions`);
    }
    return result.success;
  }
}
