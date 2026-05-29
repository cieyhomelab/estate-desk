export interface CommissionSettings {
  id: string;
  user_id: string;
  tax_rate: number;
  agency_percent: number;
  created_at: string;
  updated_at: string;
}

export interface PriceHistoryEntry {
  id: string;
  listing_id: string;
  price: number;
  set_at: string;
}
