export interface TransactionSnapshot {
  id: string;
  listing_id: string;
  user_id: string;
  asking_price: number | null;
  commission_percent: number | null;
  tax_rate: number | null;
  agency_percent: number | null;
  brutto: number | null;
  agency_amount: number | null;
  gross_income: number | null;
  tax_amount: number | null;
  agent_net: number | null;
  notary_name: string | null;
  notary_city: string | null;
  transaction_date: string | null;
  snapshot_at: string;
  voided_at: string | null;
}
