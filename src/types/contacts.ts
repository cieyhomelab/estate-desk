export type ContactRole = "kupujący" | "najemca";

export interface Contact {
  id: string;
  listing_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: string | null;
  created_at: string;
}
