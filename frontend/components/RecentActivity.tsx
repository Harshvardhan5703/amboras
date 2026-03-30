'use client';

interface RecentEvent {
  event_id: string;
  event_type: string;
  timestamp: string;
  product_id?: string;
  amount?: number;
  currency?: string;
}

interface RecentActivityProps {
  events: RecentEvent[];
  loading: boolean;
}

const EVENT_BADGE_CLASSES: Record<string, string> = {
  page_view: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
  add_to_cart: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  remove_from_cart: 'bg-red-500/15 text-red-400 border-red-500/20',
  checkout_started: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  purchase: 'bg-green-500/15 text-green-400 border-green-500/20',
};

const EVENT_LABELS: Record<string, string> = {
  page_view: 'Page View',
  add_to_cart: 'Add to Cart',
  remove_from_cart: 'Removed',
  checkout_started: 'Checkout',
  purchase: 'Purchase',
};

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatUSD(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

export default function RecentActivity({ events, loading }: RecentActivityProps) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold">Recent Activity</h3>
          <p className="text-xs text-text-muted mt-0.5">Live event feed</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-success pulse-live" />
          <span className="text-xs text-text-muted">Live</span>
        </div>
      </div>

      <div className="overflow-y-auto max-h-[400px] pr-1 -mr-1 space-y-1">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-12 rounded-lg mb-1" />
          ))
        ) : events.length === 0 ? (
          <div className="text-center py-8 text-text-muted text-sm">
            No events yet
          </div>
        ) : (
          events.map((event, idx) => (
            <div
              key={event.event_id}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-bg-card-hover transition-colors group ${
                idx === 0 ? 'slide-in' : ''
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`shrink-0 px-2 py-0.5 text-[10px] font-semibold uppercase rounded-md border ${
                    EVENT_BADGE_CLASSES[event.event_type] || 'bg-gray-500/15 text-gray-400 border-gray-500/20'
                  }`}
                >
                  {EVENT_LABELS[event.event_type] || event.event_type}
                </span>

                <span className="text-xs text-text-secondary truncate">
                  {event.product_id || '—'}
                </span>
              </div>

              <div className="flex items-center gap-3 shrink-0 ml-2">
                {event.amount !== undefined && event.event_type === 'purchase' && (
                  <span className="text-xs font-medium text-success">
                    {formatUSD(event.amount)}
                  </span>
                )}
                <span className="text-[10px] text-text-muted whitespace-nowrap">
                  {relativeTime(event.timestamp)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
