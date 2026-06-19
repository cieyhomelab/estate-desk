import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPLN(value: number): string {
  const [whole, decimal] = value.toFixed(2).split(".");
  const wholeFormatted = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${wholeFormatted},${decimal} zł`;
}

// Splits an address produced by the format-address API ("Street, City") at the
// last comma so that addresses containing commas in the street part still parse correctly.
export function parseAddressParts(address: string): { street: string; city: string | null } {
  const lastComma = address.lastIndexOf(",");
  if (lastComma === -1) return { street: address, city: null };
  return {
    street: address.slice(0, lastComma).trim(),
    city: address.slice(lastComma + 1).trim(),
  };
}
