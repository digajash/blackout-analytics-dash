/** Blackout Analytics — data + sheet config. Flip DATA_MODE to switch sources. */
export const SHEET_ID = '1D1znLm0U_Hr7VH5RYD-BCp6-fuyhM4W7oEfrWOePaj8';

export const TABS = {
  Songs: 'Songs',
  Hook_Registry: 'Hook_Registry',
  Wave_Ticks: 'Wave_Ticks',
  Daily_Account: 'Daily_Account',
} as const;

export type TabName = (typeof TABS)[keyof typeof TABS];

/**
 * 'gviz'  — fetch live CSV from Google Sheets gviz URLs (needs anyone-with-link viewer)
 * 'local' — serve snapshots from /public/data/*.csv (private, works offline)
 * 'appsscript' — reserved for a free Apps Script JSON endpoint
 *
 * Default 'gviz' with automatic fallback to local on 401/403/network failure.
 */
export type DataMode = 'gviz' | 'local' | 'appsscript';

export const DATA_MODE: DataMode = 'gviz';

export const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min auto-refresh
export const STALE_GREEN_H = 4;
export const STALE_AMBER_H = 8;

export function gvizUrl(tab: TabName): string {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
}

export function localUrl(tab: TabName): string {
  return `/data/${tab}.csv`;
}

export const SERIES_COLORS = [
  '#E10600', // blackout red — active / primary
  '#EDEAE4', // bone
  '#8A8A8A', // ash
  '#B3261E', // deep red
  '#5A5A5A', // smoke
] as const;

export const BUILD_VERSION = 'v1';
