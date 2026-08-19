'use client';

import { useParams } from 'next/navigation';

/**
 * Command Center - War Room Interface
 * Real-time command surface for operational oversight.
 * Design: Air traffic control meets trading floor.
 * Rule: Every element must answer "does this help understand system state in under 2 seconds?"
 *
 * Theme note: all structural colours (bg, border, text) now use --cockpit-*
 * CSS variables defined in globals.css. The variables resolve to dark values
 * under `.dark` and light values in `:root`, so the page responds to the
 * site-wide theme toggle without any JS involvement.
 * Engine/status/alert accent colours (blue, amber, red, green…) are intentionally
 * kept as fixed hex values — they are semantic data colours, not theme colours.
 */

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import {
  LineChart,
  Line,
  Area,
  AreaChart,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import {
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  CheckCircle2,
  Filter,
  Info,
} from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/utils';

// ============================================
// ENGINE CONFIGURATION
// ============================================

const ENGINE_CONFIG = {
  instant_transaction: {
    name: 'Instant Transaction',
    color: '#3A8DFF',
    templateType: 'menu_service',
    entity: 'order',
  },
  time_exclusive_reservation: {
    name: 'Time-Exclusive',
    color: '#F5A623',
    templateType: 'multi_day_booking',
    entity: 'booking',
  },
  shared_capacity_access: {
    name: 'Shared Capacity',
    color: '#2EC4B6',
    templateType: 'session_access',
    entity: 'ticket',
  },
  ongoing_entitlement: {
    name: 'Ongoing Entitlement',
    color: '#9B5DE5',
    templateType: 'subscription',
    entity: 'subscription',
  },
  platform_entitlement: {
    name: 'Platform Subscription',
    color: '#FF6B6B',
    templateType: 'saas_subscription',
    entity: 'subscription',
  },
} as const;

// STATE_COLORS are data/status colours — intentionally NOT theme variables.
const STATE_COLORS = {
  pending: '#5B6B7F',
  confirmed: '#5B8DEF',
  preparing: '#3A8DFF',
  ready: '#2EC4B6',
  delivered: '#52C41A',
  completed: '#52C41A',
  checked_in: '#2EC4B6',
  checked_out: '#52C41A',
  active: '#2EC4B6',
  valid: '#5B8DEF',
  used: '#52C41A',
  cancelled: '#FF4D4F',
  expired: '#FF4D4F',
  no_show: '#FF6B35',
  failed: '#FF4D4F',
} as const;

// ALERT_COLORS are semantic — NOT theme variables.
const ALERT_COLORS = {
  info: { bg: 'rgba(58, 141, 255, 0.15)', border: '#3A8DFF', text: '#8FC3FF' },
  warning: { bg: 'rgba(245, 166, 35, 0.15)', border: '#F5A623', text: '#FFD580' },
  critical: { bg: 'rgba(255, 77, 79, 0.15)', border: '#FF4D4F', text: '#FF8A8A' },
} as const;

// ============================================
// TYPE DEFINITIONS
// ============================================

type EngineType = keyof typeof ENGINE_CONFIG;

function getEngineDisplay(type: string): { name: string; color: string } {
  const known = ENGINE_CONFIG[type as EngineType];
  if (known) return { name: known.name, color: known.color };
  return { name: type.replace(/_/g, ' '), color: '#8A95A5' };
}
type AlertSeverity = 'info' | 'warning' | 'critical';
type ServiceStatus = 'operational' | 'degraded' | 'down';

interface KPIData {
  value: number;
  previousValue: number;
  change: number;
  changePercent: number;
  sparkline: number[];
}

interface EngineHealth {
  type: EngineType;
  moduleCount: number;
  revenue: number;
  activeTransactions: number;
  sparkline: number[];
  states: Record<string, number>;
}

interface Exception {
  id: string;
  type: string;
  severity: AlertSeverity;
  moduleName: string;
  engineType: EngineType;
  count: number;
  trend: number;
  lastOccurred: string;
}

interface TimelineEvent {
  id: string;
  timestamp: string;
  type: 'state_change' | 'alert' | 'transaction' | 'system';
  moduleName: string;
  engineType: EngineType;
  severity: AlertSeverity;
  description: string;
}

interface SystemService {
  name: string;
  status: ServiceStatus;
  latency: number;
}

interface FinancialRow {
  metric: string;
  today: number;
  yesterday: number;
  lastWeek: number;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function getDominantEngine(revenueData: Array<{ name: string; value: number; color: string }>): EngineType {
  const max = revenueData.reduce((prev, current) => (prev.value > current.value ? prev : current));
  const engineEntry = Object.entries(ENGINE_CONFIG).find(([, config]) => config.color === max.color);
  return (engineEntry?.[0] as EngineType) || 'instant_transaction';
}

function formatDelta(value: number): string {
  const abs = Math.abs(value);
  const sign = value >= 0 ? '+' : '-';
  return `${sign}${abs}%`;
}

// ============================================
// COMPONENT: SPARKLINE
// ============================================

function MiniSparkline({ data, color, width = 60, height = 20 }: { data: number[]; color: string; width?: number; height?: number }) {
  const chartData = data.map((value, index) => ({ index, value }));

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#gradient-${color.replace('#', '')})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================
// COMPONENT: STATE FLOW VISUALIZATION
// ============================================

function StateFlow({ states, engineColor }: { states: Record<string, number>; engineColor: string }) {
  const entries = Object.entries(states);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);

  if (total === 0) {
    return (
      <div style={{ height: 4, background: 'var(--cockpit-border)', borderRadius: 2 }} />
    );
  }

  return (
    <div style={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', gap: 1 }}>
      {entries.map(([state, count]) => {
        const widthPercent = (count / total) * 100;
        const color = STATE_COLORS[state as keyof typeof STATE_COLORS] || engineColor;
        return (
          <div
            key={state}
            style={{
              width: `${widthPercent}%`,
              background: color,
              minWidth: widthPercent > 5 ? 4 : 0,
            }}
            title={`${state}: ${count}`}
          />
        );
      })}
    </div>
  );
}

// ============================================
// COMPONENT: KPI CARD
// ============================================

interface KPICardProps {
  title: string;
  value: number;
  change: number;
  changePercent: number;
  sparkline: number[];
  engineColor: string;
  format: 'currency' | 'number';
  isLoading?: boolean;
}

function KPICard({ title, value, change, changePercent, sparkline, engineColor, format, isLoading }: KPICardProps) {
  const isPositive = change >= 0;
  const deltaColor = isPositive ? '#52C41A' : '#FF4D4F';

  if (isLoading) {
    return (
      <div
        style={{
          background: 'var(--cockpit-bg-card)',
          border: '1px solid var(--cockpit-border)',
          borderLeft: `3px solid ${engineColor}`,
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div className="h-3 w-24" style={{ background: 'var(--cockpit-border)', borderRadius: 2 }} />
        <div className="h-8 w-32 mt-2" style={{ background: 'var(--cockpit-border)', borderRadius: 2 }} />
        <div className="flex items-center gap-2 mt-1">
          <div className="h-3 w-12" style={{ background: 'var(--cockpit-border)', borderRadius: 2 }} />
          <div className="h-3 w-16" style={{ background: 'var(--cockpit-border)', borderRadius: 2 }} />
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'var(--cockpit-bg-card)',
        border: '1px solid var(--cockpit-border)',
        borderLeft: `3px solid ${engineColor}`,
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: 'var(--cockpit-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 500 }}>
          {title}
        </span>
        <MiniSparkline data={sparkline} color={engineColor} />
      </div>

      <div
        style={{
          fontSize: 28,
          fontWeight: 600,
          color: 'var(--cockpit-text-primary)',
          fontFamily: 'Inter, system-ui, monospace',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.02em',
        }}
      >
        {format === 'currency' ? formatCurrency(value) : formatNumber(value)}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
        <span style={{ color: deltaColor, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
          {isPositive ? '↑' : '↓'} {formatDelta(changePercent)}
        </span>
        <span style={{ color: 'var(--cockpit-text-muted)' }}>vs yesterday</span>
      </div>
    </div>
  );
}

// ============================================
// COMPONENT: CRITICAL ALERT BANNER
// ============================================

function CriticalAlertBanner({ count, onView }: { count: number; onView: () => void }) {
  if (count === 0) return null;

  return (
    <div
      style={{
        background: 'rgba(255, 77, 79, 0.08)',
        border: '1px solid #FF4D4F',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        animation: 'pulse-border 2s infinite',
      }}
    >
      <style jsx>{`
        @keyframes pulse-border {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255, 77, 79, 0.4); }
          50% { box-shadow: 0 0 0 4px rgba(255, 77, 79, 0.1); }
        }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <AlertCircle className="w-5 h-5" style={{ color: '#FF4D4F' }} />
        <span style={{ color: '#FF8A8A', fontSize: 14, fontWeight: 500 }}>
          {count} Critical {count === 1 ? 'Exception' : 'Exceptions'} Require Immediate Attention
        </span>
      </div>
      <Button
        onClick={onView}
        style={{
          background: 'transparent',
          border: '1px solid #FF4D4F',
          color: '#FF8A8A',
          fontSize: 12,
          padding: '4px 12px',
          height: 28,
        }}
      >
        View Alerts ({count})
      </Button>
    </div>
  );
}

// ============================================
// COMPONENT: ENGINE HEALTH GRID
// ============================================

function EngineHealthGrid({
  engines,
  isLoading,
}: {
  engines: EngineHealth[];
  isLoading: boolean;
}) {
  const engineTypes: string[] = engines.length > 0
    ? engines.map((e) => e.type)
    : (Object.keys(ENGINE_CONFIG) as EngineType[]);

  const columnCount = Math.max(4, engineTypes.length);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columnCount}, 1fr)`, gap: 1, background: 'var(--cockpit-border)' }}>
      {engineTypes.map((engineType) => {
        const engine = engines.find((e) => e.type === engineType);
        const config = getEngineDisplay(engineType);

        if (isLoading) {
          return (
            <div key={engineType} style={{ background: 'var(--cockpit-bg-card)', padding: 16 }}>
              <div className="h-4 w-32 mb-4" style={{ background: 'var(--cockpit-border)', borderRadius: 2 }} />
              <div className="h-20 w-full mb-3" style={{ background: 'var(--cockpit-border)', borderRadius: 2 }} />
              <div className="h-12 w-full" style={{ background: 'var(--cockpit-border)', borderRadius: 2 }} />
            </div>
          );
        }

        return (
          <div
            key={engineType}
            style={{
              background: 'var(--cockpit-bg-card)',
              borderTop: `3px solid ${config.color}`,
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--cockpit-text-primary)' }}>{config.name}</span>
              <Badge
                style={{
                  background: `${config.color}20`,
                  color: config.color,
                  border: `1px solid ${config.color}40`,
                  fontSize: 10,
                  padding: '2px 8px',
                }}
              >
                {engine?.moduleCount ?? 0} modules
              </Badge>
            </div>

            {/* Module Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {engine && engine.moduleCount > 0 ? (
                <>
                  {/* Revenue */}
                  <div
                    style={{
                      background: 'var(--cockpit-bg-inner)',
                      border: '1px solid var(--cockpit-border)',
                      padding: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: 11, color: 'var(--cockpit-text-muted)' }}>Revenue Today</span>
                    <span style={{ fontSize: 16, fontWeight: 600, color: config.color, fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(engine?.revenue ?? 0)}
                    </span>
                  </div>

                  {/* Active Transactions */}
                  <div
                    style={{
                      background: 'var(--cockpit-bg-inner)',
                      border: '1px solid var(--cockpit-border)',
                      padding: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 11, color: 'var(--cockpit-text-muted)' }}>Active</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--cockpit-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                        {engine.activeTransactions}
                      </span>
                    </div>
                    <MiniSparkline data={engine.sparkline} color={config.color} width={50} height={18} />
                  </div>

                  {/* State Pipeline */}
                  <div style={{ marginTop: 4 }}>
                    <StateFlow states={engine.states} engineColor={config.color} />
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px 12px',
                        marginTop: 8,
                        fontSize: 10,
                      }}
                    >
                      {Object.entries(engine.states)
                        .filter(([, count]) => count > 0)
                        .slice(0, 4)
                        .map(([state, count]) => (
                          <span key={state} style={{ color: 'var(--cockpit-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                            <span style={{ color: STATE_COLORS[state as keyof typeof STATE_COLORS] || config.color }}>
                              {count}
                            </span>{' '}
                            {state}
                          </span>
                        ))}
                    </div>
                  </div>
                </>
              ) : (
                <div
                  style={{
                    background: 'var(--cockpit-bg-inner)',
                    border: '1px solid var(--cockpit-border)',
                    padding: '20px',
                    textAlign: 'center',
                    color: 'var(--cockpit-text-muted)',
                    fontSize: 12,
                  }}
                >
                  No active modules
                </div>
              )}
            </div>

            {/* View All Link */}
            {engine && engine.moduleCount > 1 && (
              <button
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  color: config.color,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  alignSelf: 'flex-start',
                }}
              >
                View all modules <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// COMPONENT: FINANCIAL SNAPSHOT TABLE
// ============================================

function FinancialSnapshot({ data, isLoading }: { data: FinancialRow[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div style={{ background: 'var(--cockpit-bg-card)', border: '1px solid var(--cockpit-border)', padding: 20 }}>
        <div className="h-5 w-48 mb-4" style={{ background: 'var(--cockpit-border)', borderRadius: 2 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 w-full" style={{ background: 'var(--cockpit-border)', borderRadius: 2 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--cockpit-bg-card)', border: '1px solid var(--cockpit-border)' }}>
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--cockpit-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--cockpit-text-primary)' }}>Financial Snapshot</span>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--cockpit-bg-inner)' }}>
            {['Metric', 'Today', 'Yesterday', 'Last Week', 'vs Yesterday'].map((heading, i) => (
              <th
                key={heading}
                style={{
                  padding: '12px 16px',
                  textAlign: i === 0 ? 'left' : 'right',
                  fontSize: 11,
                  fontWeight: 500,
                  color: 'var(--cockpit-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  borderBottom: '1px solid var(--cockpit-border)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => {
            const change = ((row.today - row.yesterday) / row.yesterday) * 100;
            const isPositive = change >= 0;
            const isRevenue = row.metric === 'Revenue' || row.metric === 'Avg Transaction Value';

            return (
              <tr key={row.metric} style={{ background: index % 2 === 0 ? 'var(--cockpit-bg-card)' : 'var(--cockpit-bg-inner)' }}>
                <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--cockpit-text-primary)', borderBottom: '1px solid var(--cockpit-border)', fontWeight: 500 }}>
                  {row.metric}
                </td>
                <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--cockpit-text-primary)', textAlign: 'right', borderBottom: '1px solid var(--cockpit-border)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  {isRevenue ? formatCurrency(row.today) : formatNumber(row.today)}
                </td>
                <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--cockpit-text-secondary)', textAlign: 'right', borderBottom: '1px solid var(--cockpit-border)', fontVariantNumeric: 'tabular-nums' }}>
                  {isRevenue ? formatCurrency(row.yesterday) : formatNumber(row.yesterday)}
                </td>
                <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--cockpit-text-secondary)', textAlign: 'right', borderBottom: '1px solid var(--cockpit-border)', fontVariantNumeric: 'tabular-nums' }}>
                  {isRevenue ? formatCurrency(row.lastWeek) : formatNumber(row.lastWeek)}
                </td>
                <td style={{ padding: '14px 16px', fontSize: 13, textAlign: 'right', borderBottom: '1px solid var(--cockpit-border)', fontVariantNumeric: 'tabular-nums', color: isPositive ? '#52C41A' : '#FF4D4F', fontWeight: 500 }}>
                  {isPositive ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================
// COMPONENT: TOP EXCEPTIONS
// ============================================

function TopExceptions({ exceptions, isLoading, onAcknowledge }: { exceptions: Exception[]; isLoading: boolean; onAcknowledge: (id: string) => void }) {
  if (isLoading) {
    return (
      <div style={{ background: 'var(--cockpit-bg-card)', border: '1px solid var(--cockpit-border)', padding: 20, height: '100%' }}>
        <div className="h-5 w-32 mb-4" style={{ background: 'var(--cockpit-border)', borderRadius: 2 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 w-full" style={{ background: 'var(--cockpit-border)', borderRadius: 2 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--cockpit-bg-card)', border: '1px solid var(--cockpit-border)', height: '100%' }}>
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--cockpit-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--cockpit-text-primary)' }}>Top Exceptions</span>
        <Filter className="w-3.5 h-3.5" style={{ color: 'var(--cockpit-text-muted)', cursor: 'pointer' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {exceptions.length === 0 ? (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: 'var(--cockpit-text-muted)',
              fontSize: 13,
            }}
          >
            <CheckCircle2 className="w-6 h-6 mx-auto mb-2" style={{ color: '#52C41A' }} />
            No active exceptions
          </div>
        ) : (
          exceptions.map((exception) => {
            const colors = ALERT_COLORS[exception.severity];
            const engineColor = getEngineDisplay(exception.engineType).color;

            return (
              <div
                key={exception.id}
                style={{
                  padding: '14px 16px',
                  borderBottom: '1px solid var(--cockpit-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  background: exception.severity === 'critical' ? 'rgba(255, 77, 79, 0.05)' : 'transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                    {exception.severity === 'critical' && <AlertCircle className="w-3.5 h-3.5" style={{ color: '#FF4D4F', flexShrink: 0 }} />}
                    {exception.severity === 'warning' && <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#F5A623', flexShrink: 0 }} />}
                    {exception.severity === 'info' && <Info className="w-3.5 h-3.5" style={{ color: '#3A8DFF', flexShrink: 0 }} />}
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--cockpit-text-primary)' }}>{exception.type}</span>
                  </div>
                  <Badge
                    style={{
                      background: colors.bg,
                      color: colors.text,
                      border: `1px solid ${colors.border}`,
                      fontSize: 10,
                      padding: '2px 8px',
                      flexShrink: 0,
                    }}
                  >
                    {exception.count}
                  </Badge>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--cockpit-text-secondary)' }}>{exception.moduleName}</span>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: engineColor }} />
                    <span
                      style={{
                        color: exception.trend > 0 ? '#FF4D4F' : exception.trend < 0 ? '#52C41A' : 'var(--cockpit-text-secondary)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {exception.trend > 0 ? '↑' : exception.trend < 0 ? '↓' : '→'} {Math.abs(exception.trend)}
                    </span>
                  </div>
                  <span style={{ color: 'var(--cockpit-text-muted)' }}>{exception.lastOccurred}</span>
                </div>

                <button
                  onClick={() => onAcknowledge(exception.id)}
                  style={{
                    alignSelf: 'flex-end',
                    fontSize: 11,
                    color: 'var(--cockpit-text-muted)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px 0',
                  }}
                >
                  Acknowledge
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ============================================
// COMPONENT: REVENUE DONUT CHART
// ============================================

function RevenueByEngine({ data, isLoading }: { data: Array<{ name: string; value: number; color: string }>; isLoading: boolean }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (isLoading) {
    return (
      <div style={{ background: 'var(--cockpit-bg-card)', border: '1px solid var(--cockpit-border)', padding: 20 }}>
        <div className="h-5 w-40 mb-4" style={{ background: 'var(--cockpit-border)', borderRadius: 2 }} />
        <div className="h-48 w-full" style={{ background: 'var(--cockpit-border)', borderRadius: 2 }} />
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--cockpit-bg-card)', border: '1px solid var(--cockpit-border)', padding: '20px' }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--cockpit-text-primary)', marginBottom: 16 }}>Revenue by Engine Type</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ width: 140, height: 140 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={65}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.map((item) => {
            const percent = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0';
            return (
              <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                  <span style={{ fontSize: 12, color: 'var(--cockpit-text-secondary)' }}>{item.name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--cockpit-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(item.value)}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--cockpit-text-muted)', fontVariantNumeric: 'tabular-nums', minWidth: 40, textAlign: 'right' }}>
                    {percent}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================
// COMPONENT: HOURLY REVENUE CHART
// ============================================

function HourlyRevenueChart({ data, isLoading, engineColor }: { data: Array<{ hour: string; today: number; yesterday: number }>; isLoading: boolean; engineColor: string }) {
  if (isLoading) {
    return (
      <div style={{ background: 'var(--cockpit-bg-card)', border: '1px solid var(--cockpit-border)', padding: 20 }}>
        <div className="h-5 w-48 mb-4" style={{ background: 'var(--cockpit-border)', borderRadius: 2 }} />
        <div className="h-48 w-full" style={{ background: 'var(--cockpit-border)', borderRadius: 2 }} />
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--cockpit-bg-card)', border: '1px solid var(--cockpit-border)', padding: '20px' }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--cockpit-text-primary)', marginBottom: 16 }}>Hourly Revenue Comparison</div>

      <div style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis
              dataKey="hour"
              axisLine={{ stroke: 'var(--cockpit-border)' }}
              tickLine={false}
              tick={{ fill: 'var(--cockpit-text-muted)', fontSize: 10 }}
              interval={2}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--cockpit-text-muted)', fontSize: 10 }}
              tickFormatter={(value: number) => `$${(value / 1000).toFixed(0)}k`}
              width={40}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--cockpit-bg-inner)',
                border: '1px solid var(--cockpit-border)',
                borderRadius: 0,
                fontSize: 12,
              }}
              itemStyle={{ color: 'var(--cockpit-text-primary)' }}
              formatter={(value) => typeof value === 'number' ? formatCurrency(value) : String(value)}
              labelStyle={{ color: 'var(--cockpit-text-muted)', marginBottom: 4 }}
            />
            <Line type="monotone" dataKey="today" stroke={engineColor} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="yesterday" stroke="var(--cockpit-text-muted)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'flex', gap: 20, marginTop: 12, fontSize: 11 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 2, background: engineColor }} />
          <span style={{ color: 'var(--cockpit-text-secondary)' }}>Today</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 2, background: 'var(--cockpit-text-muted)' }} />
          <span style={{ color: 'var(--cockpit-text-secondary)' }}>Yesterday</span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// COMPONENT: TIMELINE
// ============================================

function Timeline({ events, isLoading }: { events: TimelineEvent[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div style={{ background: 'var(--cockpit-bg-card)', border: '1px solid var(--cockpit-border)', padding: 16 }}>
        <div className="h-4 w-24 mb-4" style={{ background: 'var(--cockpit-border)', borderRadius: 2 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 w-full" style={{ background: 'var(--cockpit-border)', borderRadius: 2 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--cockpit-bg-card)', border: '1px solid var(--cockpit-border)' }}>
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--cockpit-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--cockpit-text-primary)' }}>{"Today's Timeline"}</span>
        <Filter className="w-3 h-3" style={{ color: 'var(--cockpit-text-muted)', cursor: 'pointer' }} />
      </div>

      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
        {events.map((event) => {
          const colors = ALERT_COLORS[event.severity];
          const engineColor = getEngineDisplay(event.engineType).color;

          return (
            <div
              key={event.id}
              style={{
                padding: '10px 16px',
                borderBottom: '1px solid var(--cockpit-border)',
                display: 'flex',
                gap: 12,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--cockpit-text-muted)',
                  fontVariantNumeric: 'tabular-nums',
                  fontFamily: 'monospace',
                  minWidth: 50,
                }}
              >
                {event.timestamp}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--cockpit-text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {event.description}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <span style={{ fontSize: 10, color: engineColor }}>{event.moduleName}</span>
                  <span
                    style={{
                      fontSize: 9,
                      padding: '1px 4px',
                      background: colors.bg,
                      color: colors.text,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 2,
                    }}
                  >
                    {event.severity}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// COMPONENT: SYSTEM STATUS
// ============================================

function SystemStatus({ services, isLoading }: { services: SystemService[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div style={{ background: 'var(--cockpit-bg-card)', border: '1px solid var(--cockpit-border)', padding: 16 }}>
        <div className="h-4 w-24 mb-4" style={{ background: 'var(--cockpit-border)', borderRadius: 2 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-8 w-full" style={{ background: 'var(--cockpit-border)', borderRadius: 2 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--cockpit-bg-card)', border: '1px solid var(--cockpit-border)' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--cockpit-border)' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--cockpit-text-primary)' }}>System Status</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {services.map((service) => {
          const statusColor =
            service.status === 'operational' ? '#52C41A' : service.status === 'degraded' ? '#F5A623' : '#FF4D4F';

          return (
            <div
              key={service.name}
              style={{
                padding: '10px 16px',
                borderBottom: '1px solid var(--cockpit-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: statusColor,
                    boxShadow: `0 0 6px ${statusColor}`,
                  }}
                />
                <span style={{ fontSize: 12, color: 'var(--cockpit-text-secondary)' }}>{service.name}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 11, color: statusColor, textTransform: 'capitalize' }}>{service.status}</span>
                <span style={{ fontSize: 11, color: 'var(--cockpit-text-muted)', fontVariantNumeric: 'tabular-nums', minWidth: 45, textAlign: 'right' }}>
                  {service.latency}ms
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function CommandCenter() {
  const params = useParams();
  const propertySlug = (params?.property as string) || 'default';

  const [kpiData, setKpiData] = useState<Record<string, KPIData>>({
    totalRevenue: { value: 0, previousValue: 0, change: 0, changePercent: 0, sparkline: [0,0,0,0,0,0,0] },
    activeTransactions: { value: 0, previousValue: 0, change: 0, changePercent: 0, sparkline: [0,0,0,0,0,0,0] },
    guestsOnProperty: { value: 0, previousValue: 0, change: 0, changePercent: 0, sparkline: [0,0,0,0,0,0,0] },
    pendingExceptions: { value: 0, previousValue: 0, change: 0, changePercent: 0, sparkline: [0,0,0,0,0,0,0] },
  });
  const [engineHealth, setEngineHealth] = useState<EngineHealth[]>([
    { type: 'instant_transaction', moduleCount: 0, revenue: 0, activeTransactions: 0, sparkline: [0,0,0,0,0,0,0], states: {} },
    { type: 'time_exclusive_reservation', moduleCount: 0, revenue: 0, activeTransactions: 0, sparkline: [0,0,0,0,0,0,0], states: {} },
    { type: 'shared_capacity_access', moduleCount: 0, revenue: 0, activeTransactions: 0, sparkline: [0,0,0,0,0,0,0], states: {} },
    { type: 'ongoing_entitlement', moduleCount: 0, revenue: 0, activeTransactions: 0, sparkline: [0,0,0,0,0,0,0], states: {} },
  ]);
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [systemServices, setSystemServices] = useState<SystemService[]>([]);
  const [financialRows, setFinancialRows] = useState<FinancialRow[]>([
    { metric: 'Revenue', today: 0, yesterday: 0, lastWeek: 0 },
    { metric: 'Transactions', today: 0, yesterday: 0, lastWeek: 0 },
    { metric: 'Avg Transaction Value', today: 0, yesterday: 0, lastWeek: 0 },
    { metric: 'Guests', today: 0, yesterday: 0, lastWeek: 0 },
    { metric: 'Active Staff', today: 0, yesterday: 0, lastWeek: 0 },
  ]);
  const [hourlyRevenue, setHourlyRevenue] = useState([
    { hour: '00', today: 0, yesterday: 0 },
    { hour: '02', today: 0, yesterday: 0 },
    { hour: '04', today: 0, yesterday: 0 },
    { hour: '06', today: 0, yesterday: 0 },
    { hour: '08', today: 0, yesterday: 0 },
    { hour: '10', today: 0, yesterday: 0 },
    { hour: '12', today: 0, yesterday: 0 },
    { hour: '14', today: 0, yesterday: 0 },
    { hour: '16', today: 0, yesterday: 0 },
    { hour: '18', today: 0, yesterday: 0 },
    { hour: '20', today: 0, yesterday: 0 },
    { hour: '22', today: 0, yesterday: 0 },
  ]);
  const [revenueByEngine, setRevenueByEngine] = useState([
    { name: 'Instant Transaction', value: 0, color: '#3A8DFF' },
    { name: 'Time-Exclusive', value: 0, color: '#F5A623' },
    { name: 'Shared Capacity', value: 0, color: '#2EC4B6' },
    { name: 'Ongoing Entitlement', value: 0, color: '#9B5DE5' },
  ]);

  const [kpiLoading, setKpiLoading] = useState(true);
  const [mainLoading, setMainLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isStale, setIsStale] = useState(false);

  const criticalCount = exceptions.filter((e) => e.severity === 'critical').length;
  const dominantEngine = useMemo(() => getDominantEngine(revenueByEngine), [revenueByEngine]);
  const dominantColor = ENGINE_CONFIG[dominantEngine].color;

  const fetchKPIData = useCallback(async () => {
    try {
      const response = await api.post('/analytics/metrics/batch', {
        codes: ['revenue', 'active_transactions', 'guests_on_property', 'exceptions_count'],
        period: 'today',
        compareTo: 'yesterday',
      });

      if (response.data?.data) {
        const data = response.data.data;
        setKpiData({
          totalRevenue: {
            value: data.revenue?.current || 0,
            previousValue: data.revenue?.prior || 0,
            change: data.revenue?.variance || 0,
            changePercent: data.revenue?.variancePercent || 0,
            sparkline: data.revenue?.sparkline || [],
          },
          activeTransactions: {
            value: data.active_transactions?.current || 0,
            previousValue: data.active_transactions?.prior || 0,
            change: data.active_transactions?.variance || 0,
            changePercent: data.active_transactions?.variancePercent || 0,
            sparkline: data.active_transactions?.sparkline || [],
          },
          guestsOnProperty: {
            value: data.guests_on_property?.current || 0,
            previousValue: data.guests_on_property?.prior || 0,
            change: data.guests_on_property?.variance || 0,
            changePercent: data.guests_on_property?.variancePercent || 0,
            sparkline: data.guests_on_property?.sparkline || [],
          },
          pendingExceptions: {
            value: data.exceptions_count?.current || 0,
            previousValue: data.exceptions_count?.prior || 0,
            change: data.exceptions_count?.variance || 0,
            changePercent: data.exceptions_count?.variancePercent || 0,
            sparkline: data.exceptions_count?.sparkline || [],
          },
        });
        setIsStale(false);
      }
    } catch (error) {
      console.error('Failed to fetch KPI data:', error);
      setIsStale(true);
    } finally {
      setKpiLoading(false);
    }
  }, []);

  const fetchMainData = useCallback(async () => {
    try {
      const [exceptionsRes, snapshotRes, enginesRes] = await Promise.all([
        api.get('/analytics/exceptions?limit=10'),
        api.get('/analytics/snapshot'),
        api.get('/analytics/engines'),
      ]);

      if (exceptionsRes.data?.data) {
        setExceptions(exceptionsRes.data.data);
      }

      if (snapshotRes.data?.data) {
        const data = snapshotRes.data.data;
        setFinancialRows(data.financial || []);
        setHourlyRevenue(data.hourlyRevenue || []);
        setRevenueByEngine(data.revenueByEngine || []);
        setTimeline(data.timeline || []);
        setSystemServices(data.systemServices || []);
      }

      if (enginesRes.data?.data?.engines) {
        setEngineHealth(enginesRes.data.data.engines);
      } else if (snapshotRes.data?.data?.engines) {
        setEngineHealth(snapshotRes.data.data.engines);
      }

      setLastUpdated(new Date());
      setIsStale(false);
    } catch (error) {
      console.error('Failed to fetch main data:', error);
      setIsStale(true);
    } finally {
      setMainLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKPIData();
    fetchMainData();
  }, [fetchKPIData, fetchMainData]);

  useEffect(() => {
    const kpiInterval = setInterval(fetchKPIData, 5000);
    const mainInterval = setInterval(fetchMainData, 30000);
    return () => {
      clearInterval(kpiInterval);
      clearInterval(mainInterval);
    };
  }, [fetchKPIData, fetchMainData]);

  const handleAcknowledge = useCallback((id: string) => {
    setExceptions((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const handleViewAlerts = useCallback(() => {
    window.location.href = `/${propertySlug}/admin/alerts`;
  }, []);

  return (
    <div
      style={{
        background: 'var(--cockpit-bg-page)',
        minHeight: '100vh',
        padding: '24px',
        fontFamily: 'Inter, system-ui, sans-serif',
        color: 'var(--cockpit-text-primary)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
          paddingBottom: 16,
          borderBottom: '1px solid var(--cockpit-border)',
        }}
      >
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--cockpit-text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
            Command Center
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 12, color: 'var(--cockpit-text-muted)' }}>
            <span>Real-time operational overview</span>
            <span style={{ color: 'var(--cockpit-border)' }}>|</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
            {isStale && (
              <span style={{ color: '#F5A623', marginLeft: 8 }}>• Stale data</span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <div
            style={{
              padding: '6px 12px',
              background: 'var(--cockpit-bg-inner)',
              border: '1px solid var(--cockpit-border)',
              fontSize: 11,
              color: 'var(--cockpit-text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#52C41A',
                animation: 'pulse 2s infinite',
              }}
            />
            <style jsx>{`
              @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
              }
            `}</style>
            Live
          </div>
        </div>
      </div>

      {/* Critical Alert Banner */}
      <CriticalAlertBanner count={criticalCount} onView={handleViewAlerts} />

      {/* KPI Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 1,
          background: 'var(--cockpit-border)',
          marginTop: criticalCount > 0 ? 24 : 0,
          marginBottom: 24,
        }}
      >
        <KPICard title="Total Revenue Today" value={kpiData.totalRevenue.value} change={kpiData.totalRevenue.change} changePercent={kpiData.totalRevenue.changePercent} sparkline={kpiData.totalRevenue.sparkline} engineColor={dominantColor} format="currency" isLoading={kpiLoading} />
        <KPICard title="Active Transactions" value={kpiData.activeTransactions.value} change={kpiData.activeTransactions.change} changePercent={kpiData.activeTransactions.changePercent} sparkline={kpiData.activeTransactions.sparkline} engineColor="#3A8DFF" format="number" isLoading={kpiLoading} />
        <KPICard title="Guests On Property" value={kpiData.guestsOnProperty.value} change={kpiData.guestsOnProperty.change} changePercent={kpiData.guestsOnProperty.changePercent} sparkline={kpiData.guestsOnProperty.sparkline} engineColor="#2EC4B6" format="number" isLoading={kpiLoading} />
        <KPICard title="Pending Exceptions" value={kpiData.pendingExceptions.value} change={kpiData.pendingExceptions.change} changePercent={kpiData.pendingExceptions.changePercent} sparkline={kpiData.pendingExceptions.sparkline} engineColor={kpiData.pendingExceptions.value > 0 ? '#FF4D4F' : '#52C41A'} format="number" isLoading={kpiLoading} />
      </div>

      {/* Engine Health Grid */}
      <div style={{ marginBottom: 24 }}>
        <EngineHealthGrid engines={engineHealth} isLoading={mainLoading} />
      </div>

      {/* Two Column: Financial + Exceptions */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '60% 40%',
          gap: 1,
          background: 'var(--cockpit-border)',
          marginBottom: 24,
        }}
      >
        <FinancialSnapshot data={financialRows} isLoading={mainLoading} />
        <TopExceptions exceptions={exceptions} isLoading={mainLoading} onAcknowledge={handleAcknowledge} />
      </div>

      {/* Two Column: Revenue Charts */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '40% 60%',
          gap: 1,
          background: 'var(--cockpit-border)',
          marginBottom: 24,
        }}
      >
        <RevenueByEngine data={revenueByEngine} isLoading={mainLoading} />
        <HourlyRevenueChart data={hourlyRevenue} isLoading={mainLoading} engineColor={dominantColor} />
      </div>

      {/* Right Sidebar Panel */}
      <div
        style={{
          position: 'fixed',
          right: 24,
          top: 100,
          width: 280,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        <Timeline events={timeline} isLoading={mainLoading} />
        <SystemStatus services={systemServices} isLoading={mainLoading} />
      </div>
    </div>
  );
}
