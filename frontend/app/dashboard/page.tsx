'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import api from '@/lib/api';
import { getSocket, disconnectSocket } from '@/lib/socket';
import MetricCard from '@/components/MetricCard';
import RevenueChart from '@/components/RevenueChart';
import TopProductsChart from '@/components/TopProductsChart';
import RecentActivity from '@/components/RecentActivity';
import LiveVisitors from '@/components/LiveVisitors';
import DateRangePicker from '@/components/DateRangePicker';

/* ---------- Types ---------- */

interface Revenue {
  today: number;
  this_week: number;
  this_month: number;
  total: number;
}

interface EventsByType {
  page_view: number;
  add_to_cart: number;
  remove_from_cart: number;
  checkout_started: number;
  purchase: number;
}

interface OverviewData {
  revenue: Revenue;
  events_by_type: EventsByType;
  conversion_rate: number;
  total_events: number;
  live_visitors: number;
}

interface TopProduct {
  product_id: string;
  total_revenue: number;
  total_purchases: number;
  average_order_value: number;
}

interface RecentEvent {
  event_id: string;
  event_type: string;
  timestamp: string;
  product_id?: string;
  amount?: number;
  currency?: string;
}

/* ---------- SWR Fetcher ---------- */

const fetcher = (url: string) => api.get(url).then((r) => r.data);

/* ---------- Formatters ---------- */

function formatUSD(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

/* ---------- Dashboard ---------- */

export default function DashboardPage() {
  const router = useRouter();
  const [storeName, setStoreName] = useState('');
  const [dateRange, setDateRange] = useState<{ from: string; to: string } | null>(null);
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const socketInitialized = useRef(false);

  // Auth check
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    setStoreName(localStorage.getItem('store_name') || 'Store');
  }, [router]);

  // Build query string from date range
  const dateParams = dateRange
    ? `?from=${dateRange.from}&to=${dateRange.to}`
    : '';

  // SWR data fetching with 30s refresh
  const { data: overview, isLoading: overviewLoading } = useSWR<OverviewData>(
    `/analytics/overview${dateParams}`,
    fetcher,
    { refreshInterval: 30000, revalidateOnFocus: false },
  );

  const { data: topProducts, isLoading: topProductsLoading } = useSWR<TopProduct[]>(
  `/analytics/top-products${dateParams ? dateParams + '&limit=10' : '?limit=10'}`,
  fetcher,
  { refreshInterval: 30000, revalidateOnFocus: false },
);

  const { data: recentData, isLoading: recentLoading } = useSWR<RecentEvent[]>(
    '/analytics/recent-activity?limit=20',
    fetcher,
    { refreshInterval: 30000, revalidateOnFocus: false },
  );

  // Sync SWR recent data into state
  useEffect(() => {
    if (recentData) {
      setRecentEvents(recentData);
    }
  }, [recentData]);

  // Socket.IO for live updates
  useEffect(() => {
    if (socketInitialized.current) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    socketInitialized.current = true;
    const socket = getSocket();

    socket.on('new_event', (event: RecentEvent) => {
      setRecentEvents((prev) => [event, ...prev].slice(0, 20));
    });
    
    socket.onAny((eventName, ...args) => {
  console.log('[Socket] Event received:', eventName, args);
});

    return () => {
      disconnectSocket();
      socketInitialized.current = false;
    };
  }, []);

    const handleDateChange = useCallback((from: string, to: string) => {
    const fromDate = new Date(from);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    setDateRange({
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
    });
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('store_id');
    localStorage.removeItem('store_name');
    disconnectSocket();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-bg-primary/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              {/* <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-purple-400 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div> */}
              <span className="text-lg font-bold tracking-tight">Amboras</span>
              <span className="text-text-muted text-sm hidden sm:inline">Analytics</span>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-bg-card rounded-lg border border-border">
                <div className="w-2 h-2 rounded-full bg-success pulse-live" />
                <span className="text-sm text-text-secondary">{storeName}</span>
              </div>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-card-hover rounded-lg border border-border transition-all"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Top Bar: Date Picker + Live Visitors */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <DateRangePicker onChange={handleDateChange} />
          <LiveVisitors initialCount={overview?.live_visitors ?? 0} />
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Revenue Today"
            value={overview ? formatUSD(overview.revenue.today) : '$0'}
            subtitle="Last 24 hours"
            loading={overviewLoading}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <MetricCard
            title="Revenue This Week"
            value={overview ? formatUSD(overview.revenue.this_week) : '$0'}
            subtitle="Current week"
            loading={overviewLoading}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
              </svg>
            }
          />
          <MetricCard
            title="Revenue This Month"
            value={overview ? formatUSD(overview.revenue.this_month) : '$0'}
            subtitle="Current month"
            loading={overviewLoading}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            }
          />
          <MetricCard
            title="Conversion Rate"
            value={overview ? `${overview.conversion_rate}%` : '0%'}
            subtitle={overview ? `${formatNumber(overview.events_by_type.purchase)} purchases / ${formatNumber(overview.events_by_type.page_view)} views` : ''}
            loading={overviewLoading}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            }
          />
        </div>

        {/* Revenue Chart — Full Width */}
        <RevenueChart dateRange={dateRange} />

        {/* Bottom Row: Top Products + Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TopProductsChart data={topProducts ?? []} loading={topProductsLoading} />
          <RecentActivity events={recentEvents} loading={recentLoading && recentEvents.length === 0} />
        </div>

        {/* Event Summary Bar */}
        {overview && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Page Views', count: overview.events_by_type.page_view, color: 'bg-gray-500' },
              { label: 'Add to Cart', count: overview.events_by_type.add_to_cart, color: 'bg-blue-500' },
              { label: 'Remove Cart', count: overview.events_by_type.remove_from_cart, color: 'bg-red-500' },
              { label: 'Checkout', count: overview.events_by_type.checkout_started, color: 'bg-amber-500' },
              { label: 'Purchases', count: overview.events_by_type.purchase, color: 'bg-green-500' },
            ].map((item) => (
              <div key={item.label} className="bg-bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                <div>
                  <p className="text-xs text-text-muted">{item.label}</p>
                  <p className="text-sm font-semibold">{formatNumber(item.count)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
