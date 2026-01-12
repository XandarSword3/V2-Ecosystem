// Colored console logging for stress test
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

export class Logger {
  private botType: 'Customer' | 'Staff' | 'Admin' | 'System';
  private botId: string;
  private color: string;

  constructor(botType: 'Customer' | 'Staff' | 'Admin' | 'System', botId: string | number) {
    this.botType = botType;
    this.botId = String(botId);
    
    switch (botType) {
      case 'Customer': this.color = colors.cyan; break;
      case 'Staff': this.color = colors.yellow; break;
      case 'Admin': this.color = colors.magenta; break;
      case 'System': this.color = colors.white; break;
    }
  }

  private timestamp(): string {
    return new Date().toISOString().split('T')[1].slice(0, 12);
  }

  private prefix(): string {
    return `${colors.dim}[${this.timestamp()}]${colors.reset} ${this.color}[${this.botType} ${this.botId}]${colors.reset}`;
  }

  info(message: string): void {
    console.log(`${this.prefix()} ${message}`);
  }

  success(message: string): void {
    console.log(`${this.prefix()} ${colors.green}✓${colors.reset} ${message}`);
  }

  warn(message: string): void {
    console.log(`${this.prefix()} ${colors.yellow}⚠${colors.reset} ${message}`);
  }

  error(message: string): void {
    console.log(`${this.prefix()} ${colors.red}✗${colors.reset} ${message}`);
  }

  action(action: string): void {
    console.log(`${this.prefix()} ${colors.bright}→${colors.reset} ${action}`);
  }
}

// Global metrics tracker
export class MetricsTracker {
  private startTime: number = Date.now();
  private requests: { success: number; failure: number } = { success: 0, failure: 0 };
  private latencies: number[] = [];
  private actionCounts: Record<string, number> = {};
  private errors: string[] = [];

  recordRequest(success: boolean, latencyMs: number): void {
    if (success) {
      this.requests.success++;
    } else {
      this.requests.failure++;
    }
    this.latencies.push(latencyMs);
    
    // Cap latencies array to avoid memory issues
    if (this.latencies.length > 10000) {
      this.latencies = this.latencies.slice(-5000);
    }
  }

  recordAction(action: string): void {
    this.actionCounts[action] = (this.actionCounts[action] || 0) + 1;
  }

  recordError(error: string): void {
    this.errors.push(`[${new Date().toISOString()}] ${error}`);
    if (this.errors.length > 100) this.errors.shift(); // Keep last 100
  }

  getStats(): {
    uptime: number;
    totalRequests: number;
    successRate: number;
    requestsPerSecond: number;
    avgLatency: number;
    p95Latency: number;
    errorCount: number;
  } {
    const uptime = Date.now() - this.startTime;
    const totalRequests = this.requests.success + this.requests.failure;
    const sortedLatencies = [...this.latencies].sort((a, b) => a - b);
    
    return {
      uptime,
      totalRequests,
      successRate: totalRequests > 0 ? this.requests.success / totalRequests : 1,
      requestsPerSecond: uptime > 0 ? totalRequests / (uptime / 1000) : 0,
      avgLatency: this.latencies.length > 0 
        ? this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length 
        : 0,
      p95Latency: sortedLatencies.length > 0 
        ? sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] 
        : 0,
      errorCount: this.errors.length,
    };
  }

  getActionStats(): Record<string, number> {
    return { ...this.actionCounts };
  }

  getErrors(): string[] {
    return [...this.errors];
  }

  printSummary(): void {
    const stats = this.getStats();
    console.log('\n' + '='.repeat(60));
    console.log(`${colors.bright}${colors.white}  STRESS TEST SUMMARY${colors.reset}`);
    console.log('='.repeat(60));
    console.log(`  Duration:          ${(stats.uptime / 1000).toFixed(1)}s`);
    console.log(`  Total Requests:    ${stats.totalRequests}`);
    console.log(`  Success Rate:      ${colors.green}${(stats.successRate * 100).toFixed(1)}%${colors.reset}`);
    console.log(`  Requests/sec:      ${stats.requestsPerSecond.toFixed(2)}`);
    console.log(`  Avg Latency:       ${stats.avgLatency.toFixed(0)}ms`);
    console.log(`  P95 Latency:       ${stats.p95Latency.toFixed(0)}ms`);
    console.log('\n  Top Actions:');
    const actionStats = this.getActionStats();
    Object.entries(actionStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([action, count]) => {
        console.log(`    ${action}: ${count}`);
      });
    const recentErrors = this.errors.slice(-10);
    if (recentErrors.length > 0) {
      console.log(`\n  ${colors.red}Recent Errors:${colors.reset}`);
      recentErrors.forEach(err => console.log(`    ${err}`));
    }
    console.log('='.repeat(60) + '\n');
  }
}

export const globalMetrics = new MetricsTracker();
