export type ListingType = "sale" | "occasional-rental";
export type ListingStatus = "active" | "done";

export interface Listing {
  id: string;
  user_id: string;
  type: ListingType;
  status: ListingStatus;
  address: string;
  owner_name: string | null;
  owner_phone: string | null;
  owner_email: string | null;
  created_at: string;
  updated_at: string;
  asking_price: number | null;
  commission_percent: number | null;
  notary_name: string | null;
  notary_city: string | null;
  transaction_date: string | null;
  transaction_notes: string | null;
  closed_at: string | null;
}
