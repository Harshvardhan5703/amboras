import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsString, IsOptional, IsNumber, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';
import { AnalyticsGateway } from './analytics.gateway';
import { DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { JwtPayload } from '../auth/auth.service';

/* ---------- DTOs ---------- */

class DateRangeQuery {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}

class TopProductsQuery extends DateRangeQuery {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}

class RecentActivityQuery {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}

const VALID_EVENT_TYPES = [
  'page_view',
  'add_to_cart',
  'remove_from_cart',
  'checkout_started',
  'purchase',
] as const;

class IngestEventDto {
  @IsString()
  store_id!: string;

  @IsString()
  @IsIn(VALID_EVENT_TYPES)
  event_type!: string;

  @IsOptional()
  @IsString()
  product_id?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}

/* ---------- Helper ---------- */

function parseDateRange(from?: string, to?: string): { from?: Date; to?: Date } {
  return {
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  };
}

/* ---------- Controller ---------- */

@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly gateway: AnalyticsGateway,
    private readonly dataSource: DataSource,
  ) {}

  @Get('overview')
  @UseGuards(JwtAuthGuard)
  async getOverview(
    @Req() req: Request & { user: JwtPayload },
    @Query() query: DateRangeQuery,
  ) {
    const { from, to } = parseDateRange(query.from, query.to);
    return this.analyticsService.getOverview(req.user.store_id, from, to);
  }

  @Get('top-products')
  @UseGuards(JwtAuthGuard)
  async getTopProducts(
    @Req() req: Request & { user: JwtPayload },
    @Query() query: TopProductsQuery,
  ) {
    const { from, to } = parseDateRange(query.from, query.to);
    return this.analyticsService.getTopProducts(req.user.store_id, from, to, query.limit);
  }

  @Get('revenue-by-day')
  @UseGuards(JwtAuthGuard)
  async getRevenueByDay(
    @Req() req: Request & { user: JwtPayload },
    @Query() query: DateRangeQuery,
  ) {
    const { from, to } = parseDateRange(query.from, query.to);
    return this.analyticsService.getRevenueByDay(req.user.store_id, from, to);
  }

  @Get('recent-activity')
  @UseGuards(JwtAuthGuard)
  async getRecentActivity(
    @Req() req: Request & { user: JwtPayload },
    @Query() query: RecentActivityQuery,
  ) {
    return this.analyticsService.getRecentActivity(req.user.store_id, query.limit);
  }

  /**
   * Public event ingestion endpoint — no auth required.
   * In production this would be an internal service-to-service call.
   */
  @Post('events')
  async ingestEvent(@Body() dto: IngestEventDto) {
    const eventId = uuidv4();

    await this.dataSource.query(
      `INSERT INTO events (event_id, store_id, event_type, product_id, amount, currency, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        eventId,
        dto.store_id,
        dto.event_type,
        dto.product_id || null,
        dto.amount || null,
        dto.currency || 'USD',
        dto.metadata ? JSON.stringify(dto.metadata) : null,
      ],
    );

    // Invalidate cache for this store
    await this.analyticsService.invalidateCache(dto.store_id);

    // Emit real-time event
    this.gateway.emitNewEvent(dto.store_id, {
      event_id: eventId,
      event_type: dto.event_type,
      timestamp: new Date().toISOString(),
      product_id: dto.product_id,
      amount: dto.amount,
      currency: dto.currency || 'USD',
    });

    return { event_id: eventId, status: 'ingested' };
  }
}
