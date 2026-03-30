export class RevenueDto {
  today!: number;
  this_week!: number;
  this_month!: number;
  total!: number;
}

export class EventsByTypeDto {
  page_view!: number;
  add_to_cart!: number;
  remove_from_cart!: number;
  checkout_started!: number;
  purchase!: number;
}

export class OverviewDto {
  revenue!: RevenueDto;
  events_by_type!: EventsByTypeDto;
  conversion_rate!: number;
  total_events!: number;
  live_visitors!: number;
}
