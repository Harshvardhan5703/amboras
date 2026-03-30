import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from '../events/event.entity';
import { AuthModule } from '../auth/auth.module';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsGateway } from './analytics.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([Event]), AuthModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsGateway],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
