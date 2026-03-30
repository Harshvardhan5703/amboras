'use client';

import { ReactNode } from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: number;
  icon?: ReactNode;
  loading?: boolean;
}

export default function MetricCard({ title, value, subtitle, trend, icon, loading }: MetricCardProps) {
  if (loading) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <div className="skeleton h-4 w-24 mb-3" />
        <div className="skeleton h-8 w-32 mb-2" />
        <div className="skeleton h-3 w-20" />
      </div>
    );
  }

  return (
    <div className="bg-bg-card border border-border rounded-xl p-5 hover:border-border-light transition-all duration-200 group">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-text-secondary font-medium">{title}</p>
        {/* {icon && (
          <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center group-hover:bg-accent/20 transition-colors">
            {icon}
          </div>
        )} */}
      </div>

      <p className="text-2xl font-bold tracking-tight mb-1">{value}</p>

      <div className="flex items-center gap-2">
        {subtitle && (
          <p className="text-xs text-text-muted">{subtitle}</p>
        )}
        {trend !== undefined && (
          <span
            className={`inline-flex items-center text-xs font-medium ${
              trend >= 0 ? 'text-success' : 'text-danger'
            }`}
          >
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}
