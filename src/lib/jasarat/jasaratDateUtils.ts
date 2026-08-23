/**
 * Helper utilities for Jasarat dates.
 */

/**
 * Deterministically subtracts one calendar day from a strict YYYY-MM-DD string.
 * Uses UTC arithmetic to avoid timezone or DST mutation bugs.
 */
export function decrementJasaratDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  // Using Date.UTC creates a timestamp in UTC time.
  // We subtract 1 from the day parameter. The Date object correctly handles month/year/leap-year boundaries.
  const utcDate = new Date(Date.UTC(y, m - 1, d - 1));

  const year = utcDate.getUTCFullYear();
  const month = (utcDate.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = utcDate.getUTCDate().toString().padStart(2, "0");

  return `${year}-${month}-${day}`;
}
