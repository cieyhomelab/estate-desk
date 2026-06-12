import type { Database } from "./database.types";

export type ListingType = "sale" | "occasional-rental";
export type ListingStatus = "active" | "done";

export type Listing = Database["public"]["Tables"]["listings"]["Row"];
