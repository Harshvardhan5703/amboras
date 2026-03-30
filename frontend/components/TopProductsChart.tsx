'use client';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';

interface TopProduct {
  product_id: string;
  total_revenue: number;
  total_purchases: number;
  average_order_value: number;
}

interface TopProductsChartProps {
  data: TopProduct[];
  loading: boolean;
}

const BAR_COLORS = [
  '#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6',
  '#4c1d95', '#6366f1', '#818cf8', '#a78bfa',
  '#c4b5fd', '#7dd3fc',
];

function formatUSD(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(value);
}

function truncateId(id: string): string {
  return id.length > 12 ? id.slice(0, 12) + '…' : id;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as TopProduct;
  return (
    <div className="bg-bg-card border border-border-light rounded-lg px-3 py-2 shadow-xl min-w-[180px]">
      <p className="text-xs font-medium text-text-primary mb-1">{d.product_id}</p>
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-text-muted">Revenue</span>
          <span className="text-accent-light font-medium">{formatUSD(d.total_revenue)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-text-muted">Purchases</span>
          <span className="text-text-secondary">{d.total_purchases}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-text-muted">Avg Order</span>
          <span className="text-text-secondary">{formatUSD(d.average_order_value)}</span>
        </div>
      </div>
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export default function TopProductsChart({ data, loading }: TopProductsChartProps) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold">Top Products</h3>
        <p className="text-xs text-text-muted mt-0.5">By revenue</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-8 rounded" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-text-muted text-sm">
          No product data
        </div>
      ) : (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                stroke="#6b7280"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="product_id"
                tickFormatter={truncateId}
                stroke="#6b7280"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={80}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(139, 92, 246, 0.08)' }} />
              <Bar dataKey="total_revenue" radius={[0, 4, 4, 0]} barSize={20}>
                {data.map((_, index) => (
                  <Cell key={index} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
