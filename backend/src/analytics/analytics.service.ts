import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { OverviewDto } from './dto/overview.dto';
import { TopProductDto } from './dto/top-product.dto';
import { RecentEventDto } from './dto/recent-event.dto';

@Injectable()
export class AnalyticsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnalyticsService.name);
  private redis!: Redis;

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const redisUrl = this.config.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.redis = new Redis(redisUrl);
    this.redis.on('error', (err) => this.logger.error('Redis error', err));
    this.redis.on('connect', () => this.logger.log('Redis connected'));
  }

  onModuleDestroy() {
    this.redis?.disconnect();
  }

  /* ------------------------------------------------------------------ */
  /*  OVERVIEW                                                          */
  /* ------------------------------------------------------------------ */
  async getOverview(storeId: string, from?: Date, to?: Date): Promise<OverviewDto> {
    const cacheKey = `analytics:overview:${storeId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as OverviewDto;
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);

    // Revenue aggregations
    const revenueRows = await this.dataSource.query(
      `SELECT
         COALESCE(SUM(CASE WHEN timestamp >= $2 THEN amount ELSE 0 END), 0) AS today,
         COALESCE(SUM(CASE WHEN timestamp >= $3 THEN amount ELSE 0 END), 0) AS this_week,
         COALESCE(SUM(CASE WHEN timestamp >= $4 THEN amount ELSE 0 END), 0) AS this_month,
         COALESCE(SUM(amount), 0) AS total
       FROM events
       WHERE store_id = $1 AND event_type = 'purchase'`,
      [storeId, startOfToday.toISOString(), startOfWeek.toISOString(), startOfMonth.toISOString()],
    );

    const rev = revenueRows[0];

    // Events by type
    const typeRows: Array<{ event_type: string; count: string }> = await this.dataSource.query(
      `SELECT event_type, COUNT(*)::int AS count
       FROM events
       WHERE store_id = $1
       GROUP BY event_type`,
      [storeId],
    );

    const eventsByType: Record<string, number> = {
      page_view: 0,
      add_to_cart: 0,
      remove_from_cart: 0,
      checkout_started: 0,
      purchase: 0,
    };
    for (const row of typeRows) {
      eventsByType[row.event_type] = Number(row.count);
    }

    // Total events
    const totalRows = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM events WHERE store_id = $1`,
      [storeId],
    );

    // Live visitors (page_view events in last 5 minutes)
    const visitorRows = await this.dataSource.query(
      `SELECT COUNT(*)::int AS live
       FROM events
       WHERE store_id = $1 AND event_type = 'page_view' AND timestamp >= $2`,
      [storeId, fiveMinAgo.toISOString()],
    );

    const pageViews = eventsByType['page_view'] || 0;
    const purchases = eventsByType['purchase'] || 0;
    const conversionRate = pageViews > 0
      ? Math.round((purchases / pageViews) * 10000) / 100
      : 0;

    const result: OverviewDto = {
      revenue: {
        today: parseFloat(Number(rev.today).toFixed(2)),
        this_week: parseFloat(Number(rev.this_week).toFixed(2)),
        this_month: parseFloat(Number(rev.this_month).toFixed(2)),
        total: parseFloat(Number(rev.total).toFixed(2)),
      },
      events_by_type: {
        page_view: eventsByType['page_view'],
        add_to_cart: eventsByType['add_to_cart'],
        remove_from_cart: eventsByType['remove_from_cart'],
        checkout_started: eventsByType['checkout_started'],
        purchase: eventsByType['purchase'],
      },
      conversion_rate: conversionRate,
      total_events: Number(totalRows[0].total),
      live_visitors: Number(visitorRows[0].live),
    };

    await this.redis.setex(cacheKey, 30, JSON.stringify(result));
    return result;
  }

  /* ------------------------------------------------------------------ */
  /*  TOP PRODUCTS                                                      */
  /* ------------------------------------------------------------------ */
  async getTopProducts(
    storeId: string,
    from?: Date,
    to?: Date,
    limit = 10,
  ): Promise<TopProductDto[]> {
    const fromStr = from ? from.toISOString() : '1970-01-01T00:00:00Z';
    const toStr = to ? to.toISOString() : new Date().toISOString();
    const cacheKey = `analytics:top-products:${storeId}:${fromStr}:${toStr}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as TopProductDto[];
    }

    const rows: Array<{
      product_id: string;
      total_revenue: string;
      total_purchases: string;
      average_order_value: string;
    }> = await this.dataSource.query(
      `SELECT
         product_id,
         COALESCE(SUM(amount), 0) AS total_revenue,
         COUNT(*)::int AS total_purchases,
         COALESCE(AVG(amount), 0) AS average_order_value
       FROM events
       WHERE store_id = $1
         AND event_type = 'purchase'
         AND product_id IS NOT NULL
         AND timestamp BETWEEN $2 AND $3
       GROUP BY product_id
       ORDER BY total_revenue DESC
       LIMIT $4`,
      [storeId, fromStr, toStr, limit],
    );

    const result: TopProductDto[] = rows.map((r) => ({
      product_id: r.product_id,
      total_revenue: parseFloat(Number(r.total_revenue).toFixed(2)),
      total_purchases: Number(r.total_purchases),
      average_order_value: parseFloat(Number(r.average_order_value).toFixed(2)),
    }));

    await this.redis.setex(cacheKey, 60, JSON.stringify(result));
    return result;
  }

  /* ------------------------------------------------------------------ */
  /*  REVENUE BY DAY                                                    */
  /* ------------------------------------------------------------------ */
  async getRevenueByDay(
    storeId: string,
    from?: Date,
    to?: Date,
  ): Promise<Array<{ date: string; revenue: number }>> {
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fromStr = (from || defaultFrom).toISOString();
    const toStr = (to || now).toISOString();
    const cacheKey = `analytics:revenue-by-day:${storeId}:${fromStr}:${toStr}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as Array<{ date: string; revenue: number }>;
    }

    const rows: Array<{ date: string; revenue: string }> = await this.dataSource.query(
      `SELECT DATE(timestamp) AS date, COALESCE(SUM(amount), 0) AS revenue
       FROM events
       WHERE store_id = $1 AND event_type = 'purchase'
         AND timestamp BETWEEN $2 AND $3
       GROUP BY DATE(timestamp)
       ORDER BY date ASC`,
      [storeId, fromStr, toStr],
    );

    const result = rows.map((r) => ({
      date: r.date,
      revenue: parseFloat(Number(r.revenue).toFixed(2)),
    }));

    await this.redis.setex(cacheKey, 60, JSON.stringify(result));
    return result;
  }

  /* ------------------------------------------------------------------ */
  /*  RECENT ACTIVITY (no caching — real-time)                          */
  /* ------------------------------------------------------------------ */
  async getRecentActivity(storeId: string, limit = 20): Promise<RecentEventDto[]> {
    const rows: Array<{
      event_id: string;
      event_type: string;
      timestamp: Date;
      product_id: string | null;
      amount: string | null;
      currency: string;
    }> = await this.dataSource.query(
      `SELECT event_id, event_type, timestamp, product_id, amount, currency
       FROM events
       WHERE store_id = $1
       ORDER BY timestamp DESC
       LIMIT $2`,
      [storeId, limit],
    );

    return rows.map((r) => ({
      event_id: r.event_id,
      event_type: r.event_type,
      timestamp: new Date(r.timestamp).toISOString(),
      ...(r.product_id ? { product_id: r.product_id } : {}),
      ...(r.amount !== null ? { amount: parseFloat(Number(r.amount).toFixed(2)) } : {}),
      ...(r.currency ? { currency: r.currency } : {}),
    }));
  }

  /* ------------------------------------------------------------------ */
  /*  CACHE INVALIDATION                                                */
  /* ------------------------------------------------------------------ */
  async invalidateCache(storeId: string): Promise<void> {
    const keys = await this.redis.keys(`analytics:*:${storeId}*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
