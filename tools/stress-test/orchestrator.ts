import { CustomerBot } from './bots/customer-bot';
import { StaffBot } from './bots/staff-bot';
import { AdminBot } from './bots/admin-bot';
import { CONFIG } from './config';
import { Logger, globalMetrics } from './utils/logger';
import { randomDelay } from './utils/helpers';

interface BotInstance {
  type: 'customer' | 'staff' | 'admin';
  id: number;
  bot: CustomerBot | StaffBot | AdminBot;
  promise?: Promise<void>;
}

export class Orchestrator {
  private logger: Logger;
  private bots: BotInstance[] = [];
  private isRunning = false;
  private metricsInterval?: NodeJS.Timeout;
  private traineesHired = 0;

  constructor() {
    this.logger = new Logger('System', 0);
  }

  async start(): Promise<void> {
    this.isRunning = true;
    
    this.printBanner();
    
    // Start metrics reporter
    this.startMetricsReporter();

    // Phase 1: Initialize and start Admin bots first
    this.logger.info(`\n🔧 Phase 1: Starting ${CONFIG.ADMIN_BOTS} Admin bots...\n`);
    await this.startAdminBots();
    await randomDelay(2000, 3000);

    // Phase 1.5: Have admin create staff accounts
    this.logger.info(`\n👤 Phase 1.5: Admin creating ${CONFIG.STAFF_BOTS_INITIAL} staff accounts...\n`);
    await this.createStaffAccountsViaAdmin();
    await randomDelay(1000, 2000);

    // Phase 2: Start initial Staff bots
    this.logger.info(`\n👷 Phase 2: Starting ${CONFIG.STAFF_BOTS_INITIAL} Staff bots...\n`);
    await this.startStaffBots(CONFIG.STAFF_BOTS_INITIAL, false);
    await randomDelay(2000, 3000);

    // Phase 3: Start Customer bots in waves
    this.logger.info(`\n🧑‍💻 Phase 3: Starting ${CONFIG.CUSTOMER_BOTS} Customer bots in waves...\n`);
    await this.startCustomerBotsInWaves();

    this.logger.success(`\n✅ All bots initialized! Total: ${this.bots.length} bots running\n`);

    // Keep the orchestrator alive and log stats
    while (this.isRunning) {
      await randomDelay(30000, 60000);
    }
  }

  stop(): void {
    this.logger.warn('\n⚠️ Shutting down all bots...\n');
    this.isRunning = false;

    // Stop metrics reporter
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // Stop all bots
    for (const instance of this.bots) {
      instance.bot.stop();
    }

    // Print final metrics
    this.printFinalReport();
  }

  private printBanner(): void {
    console.log(`
╔═══════════════════════════════════════════════════════════════════════════════╗
║                         V2 RESORT STRESS TEST                                 ║
║                                                                               ║
║   🧑‍💻 Customer Bots: ${String(CONFIG.CUSTOMER_BOTS).padEnd(4)}     👷 Staff Bots: ${String(CONFIG.STAFF_BOTS_INITIAL + CONFIG.STAFF_BOTS_TRAINEES).padEnd(4)}      🔧 Admin Bots: ${String(CONFIG.ADMIN_BOTS).padEnd(4)}   ║
║                                                                               ║
║   Target: ${CONFIG.BASE_URL.padEnd(65)}║
╚═══════════════════════════════════════════════════════════════════════════════╝
`);
  }

  private startMetricsReporter(): void {
    this.metricsInterval = setInterval(() => {
      const stats = globalMetrics.getStats();
      
      console.log('\n' + '─'.repeat(80));
      console.log(`📊 METRICS | Uptime: ${Math.floor(stats.uptime / 1000)}s | Bots: ${this.bots.length}`);
      console.log(`   Total Requests: ${stats.totalRequests} | Success Rate: ${(stats.successRate * 100).toFixed(1)}%`);
      console.log(`   Avg Latency: ${stats.avgLatency.toFixed(0)}ms | Req/s: ${stats.requestsPerSecond.toFixed(2)}`);
      console.log(`   Errors: ${stats.errorCount} | Trainees Hired: ${this.traineesHired}/${CONFIG.STAFF_BOTS_TRAINEES}`);
      console.log('─'.repeat(80) + '\n');
      
    }, CONFIG.METRICS_INTERVAL);
  }

  private async startAdminBots(): Promise<void> {
    for (let i = 1; i <= CONFIG.ADMIN_BOTS; i++) {
      const adminBot = new AdminBot(i, (traineeData) => this.onTraineeHired(traineeData));
      
      const initialized = await adminBot.initialize();
      if (initialized) {
        const instance: BotInstance = {
          type: 'admin',
          id: i,
          bot: adminBot,
        };
        
        // Start the bot in the background
        instance.promise = adminBot.start();
        this.bots.push(instance);
        this.logger.success(`Admin Bot #${i} started`);
      } else {
        this.logger.error(`Admin Bot #${i} failed to initialize`);
      }

      await randomDelay(500, 1000);
    }
  }

  private async createStaffAccountsViaAdmin(): Promise<void> {
    // Find an admin bot to create accounts
    const adminInstance = this.bots.find(b => b.type === 'admin');
    if (!adminInstance) {
      this.logger.warn('No admin bot available to create staff accounts');
      return;
    }

    const adminBot = adminInstance.bot as AdminBot;
    this.staffAccounts = await adminBot.createStaffAccounts(CONFIG.STAFF_BOTS_INITIAL);
    
    this.logger.success(`Created ${this.staffAccounts.length} staff accounts`);
  }

  private staffAccounts: { email: string; password: string }[] = [];

  private async startStaffBots(count: number, isTrainee: boolean, traineeData?: any): Promise<void> {
    for (let i = 1; i <= count; i++) {
      const staffId = isTrainee ? 1000 + this.traineesHired : i;
      const staffBot = new StaffBot(staffId);
      
      let initialized = false;
      
      if (isTrainee && traineeData) {
        // For trainees, use the credentials created by admin
        initialized = await staffBot.initializeWithCredentials(
          traineeData.email,
          traineeData.password
        );
      } else if (this.staffAccounts.length >= i) {
        // Use the accounts created by admin
        const account = this.staffAccounts[i - 1];
        initialized = await staffBot.initializeWithCredentials(
          account.email,
          account.password
        );
      } else {
        // Fallback to generated credentials
        initialized = await staffBot.initialize();
      }
      
      if (initialized) {
        const instance: BotInstance = {
          type: 'staff',
          id: staffId,
          bot: staffBot,
        };
        
        instance.promise = staffBot.start();
        this.bots.push(instance);
        this.logger.success(`Staff Bot #${staffId} ${isTrainee ? '(Trainee)' : ''} started`);
      } else {
        this.logger.error(`Staff Bot #${staffId} failed to initialize`);
      }

      await randomDelay(300, 600);
    }
  }

  private async startCustomerBotsInWaves(): Promise<void> {
    const waveSize = 10;
    const waves = Math.ceil(CONFIG.CUSTOMER_BOTS / waveSize);

    for (let wave = 1; wave <= waves; wave++) {
      const start = (wave - 1) * waveSize + 1;
      const end = Math.min(wave * waveSize, CONFIG.CUSTOMER_BOTS);
      const count = end - start + 1;

      this.logger.info(`Wave ${wave}/${waves}: Starting customers ${start}-${end}...`);

      for (let i = start; i <= end; i++) {
        const customerBot = new CustomerBot(i);
        
        const initialized = await customerBot.initialize();
        if (initialized) {
          const instance: BotInstance = {
            type: 'customer',
            id: i,
            bot: customerBot,
          };
          
          instance.promise = customerBot.start();
          this.bots.push(instance);
        } else {
          this.logger.error(`Customer Bot #${i} failed to initialize`);
        }

        // Stagger bot startups
        await randomDelay(100, 300);
      }

      // Wait between waves to avoid overwhelming the server
      if (wave < waves) {
        this.logger.info(`Wave ${wave} complete. Waiting before next wave...`);
        await randomDelay(2000, 4000);
      }
    }
  }

  private async onTraineeHired(traineeData: any): Promise<void> {
    this.traineesHired++;
    this.logger.info(`🎓 Trainee hired: ${traineeData.full_name}. Spawning bot...`);

    // Create a new staff bot for the trainee
    const traineeBot = new StaffBot(1000 + this.traineesHired);
    
    const initialized = await traineeBot.initializeWithCredentials(
      traineeData.email,
      traineeData.password
    );
    
    if (initialized) {
      const instance: BotInstance = {
        type: 'staff',
        id: 1000 + this.traineesHired,
        bot: traineeBot,
      };
      
      instance.promise = traineeBot.start();
      this.bots.push(instance);
      this.logger.success(`🎓 Trainee Bot #${1000 + this.traineesHired} is now working!`);
    } else {
      this.logger.error(`Failed to start trainee bot for ${traineeData.email}`);
    }
  }

  private printFinalReport(): void {
    const stats = globalMetrics.getStats();
    const actionStats = globalMetrics.getActionStats();

    console.log(`
╔═══════════════════════════════════════════════════════════════════════════════╗
║                          FINAL STRESS TEST REPORT                             ║
╚═══════════════════════════════════════════════════════════════════════════════╝

📊 OVERALL METRICS
   ├─ Duration: ${Math.floor(stats.uptime / 1000)} seconds
   ├─ Total Requests: ${stats.totalRequests}
   ├─ Success Rate: ${(stats.successRate * 100).toFixed(2)}%
   ├─ Average Latency: ${stats.avgLatency.toFixed(0)}ms
   ├─ Requests/second: ${stats.requestsPerSecond.toFixed(2)}
   └─ Total Errors: ${stats.errorCount}

🤖 BOT SUMMARY
   ├─ Customer Bots: ${this.bots.filter(b => b.type === 'customer').length}
   ├─ Staff Bots: ${this.bots.filter(b => b.type === 'staff').length}
   ├─ Admin Bots: ${this.bots.filter(b => b.type === 'admin').length}
   └─ Trainees Hired: ${this.traineesHired}

📈 ACTION DISTRIBUTION
`);

    // Group actions by bot type
    const customerActions = Object.entries(actionStats).filter(([k]) => k.startsWith('Customer.'));
    const staffActions = Object.entries(actionStats).filter(([k]) => k.startsWith('Staff.'));
    const adminActions = Object.entries(actionStats).filter(([k]) => k.startsWith('Admin.'));

    console.log('   CUSTOMER ACTIONS:');
    customerActions.forEach(([action, count]) => {
      console.log(`     ${action.replace('Customer.', '')}: ${count}`);
    });

    console.log('\n   STAFF ACTIONS:');
    staffActions.forEach(([action, count]) => {
      console.log(`     ${action.replace('Staff.', '')}: ${count}`);
    });

    console.log('\n   ADMIN ACTIONS:');
    adminActions.forEach(([action, count]) => {
      console.log(`     ${action.replace('Admin.', '')}: ${count}`);
    });

    if (stats.errorCount > 0) {
      console.log('\n❌ ERRORS (last 10):');
      globalMetrics.getErrors().slice(-10).forEach(err => {
        console.log(`   - ${err}`);
      });
    }

    console.log('\n' + '═'.repeat(80) + '\n');
  }
}
