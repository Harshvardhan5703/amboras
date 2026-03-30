import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
} from 'typeorm';

@Entity('events')
@Index('idx_events_store_time', ['storeId', 'timestamp'])
@Index('idx_events_store_type', ['storeId', 'eventType'])
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64, unique: true, name: 'event_id' })
  eventId!: string;

  @Column({ type: 'varchar', length: 64, name: 'store_id' })
  storeId!: string;

  @Column({ type: 'varchar', length: 32, name: 'event_type' })
  eventType!: string;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  timestamp!: Date;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'product_id' })
  productId!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  amount!: number | null;

  @Column({ type: 'varchar', length: 8, default: 'USD' })
  currency!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;
}
