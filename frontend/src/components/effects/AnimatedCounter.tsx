/**
 * AnimatedCounter — effects removed, neutral passthroughs retained.
 * Index signature accepts any prop the original components accepted.
 */
import React from 'react';

interface StatItem {
  value: number | string;
  label: string;
  suffix?: string;
  icon?: React.ReactNode;
}

export function AnimatedCounter({ value, suffix = '', className = '' }: {
  value: number;
  suffix?: string;
  className?: string;
  [key: string]: unknown;
}) {
  return <span className={className}>{value}{suffix}</span>;
}

export function AnimatedStat({ stat, className = '' }: {
  stat: StatItem;
  className?: string;
  [key: string]: unknown;
}) {
  return (
    <div className={className}>
      {stat.icon && <div>{stat.icon}</div>}
      <div>{stat.value}{stat.suffix ?? ''}</div>
      <div>{stat.label}</div>
    </div>
  );
}

export function AnimatedStatsRow({ stats, className = '' }: {
  stats: StatItem[];
  className?: string;
  [key: string]: unknown;
}) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-8 ${className}`}>
      {stats.map((stat, i) => (
        <AnimatedStat key={i} stat={stat} />
      ))}
    </div>
  );
}
