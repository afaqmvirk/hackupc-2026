import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

export function formatPct(value?: number | null, digits = 1) {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return "n/a";
  }

  return `${(value * 100).toFixed(digits)}%`;
}

export function formatNumber(value?: number | null, digits = 0) {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return "n/a";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}
