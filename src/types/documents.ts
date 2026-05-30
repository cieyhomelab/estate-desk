export interface ListingDocument {
  id: string;
  listing_id: string;
  user_id: string;
  label: string;
  is_checked: boolean;
  is_default: boolean;
  position: number;
  created_at: string;
}

export interface ListingFile {
  id: string;
  listing_id: string;
  user_id: string;
  file_name: string;
  storage_path: string;
  created_at: string;
}

export interface ListingPhoto {
  id: string;
  listing_id: string;
  user_id: string;
  file_name: string;
  storage_path: string;
  created_at: string;
}
