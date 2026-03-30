export class RecentEventDto {
  event_id!: string;
  event_type!: string;
  timestamp!: string;
  product_id?: string;
  amount?: number;
  currency?: string;
}
