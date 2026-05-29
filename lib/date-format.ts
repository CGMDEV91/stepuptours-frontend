// lib/date-format.ts
// Small date helpers shared across the app.

/** Pad a number to 2 digits. */
function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Format an ISO date string as "dd/mm/yyyy HH:mm" using the device's local time.
 * Returns an empty string for missing/invalid input.
 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
