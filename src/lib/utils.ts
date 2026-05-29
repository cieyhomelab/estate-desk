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
