'use client';

import useSWR from 'swr';
import api from '@/lib/api';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

interface RevenueChartProps {
  dateRange?: { from: string; to: string } | null;
}

interface DayRevenue {
  date: string;
  revenue: number;
}

const fetcher = (url: string) => api.get(url).then((r) => r.data);

function formatAxisDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatUSD(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(value);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-bg-card border border-border-light rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-text-muted mb-1">
        {new Date(label).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </p>
      <p className="text-sm font-semibold text-accent-light">
        {formatUSD(payload[0].value)}
      </p>
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export default function RevenueChart({ dateRange }: RevenueChartProps) {
  const params = dateRange
    ? `?from=${dateRange.from}&to=${dateRange.to}`
    : '';

  const { data, isLoading } = useSWR<DayRevenue[]>(
    `/analytics/revenue-by-day${params}`,
    fetcher,
    { refreshInterval: 60000, revalidateOnFocus: false },
  );

  return (
    <div className="bg-bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold">Revenue Over Time</h3>
          <p className="text-xs text-text-muted mt-0.5">Daily revenue breakdown</p>
        </div>
        {data && data.length > 0 && (
          <span className="text-sm text-text-secondary">
            {data.length} days
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="h-72 flex items-center justify-center">
          <div className="skeleton w-full h-full rounded-lg" />
        </div>
      ) : !data || data.length === 0 ? (
        <div className="h-72 flex items-center justify-center text-text-muted text-sm">
          No revenue data available
        </div>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatAxisDate}
                stroke="#6b7280"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                stroke="#6b7280"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={50}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#8b5cf6"
                strokeWidth={2}
                fill="url(#revenueGradient)"
                dot={false}
                activeDot={{ r: 4, fill: '#a78bfa', stroke: '#8b5cf6', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
