import type { JasaratPageReference } from "./jasaratTypes";

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/** Strict YYYY-MM-DD pattern — does not validate calendar correctness. */
const DATE_FORMAT_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** Number of days in each month for a given year (handles leap years). */
function daysInMonth(year: number, month: number): number {
  // Month is 1-indexed.
  if (month === 2) {
    const isLeap =
      (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return isLeap ? 29 : 28;
  }
  // Months with 30 days: 4 (Apr), 6 (Jun), 9 (Sep), 11 (Nov)
  const thirtyDayMonths = [4, 6, 9, 11];
  return thirtyDayMonths.includes(month) ? 30 : 31;
}

/**
 * Validates that `date` is in strict YYYY-MM-DD format AND represents a
 * real calendar date.
 *
 * Throws with a message matching /Invalid Jasarat date/ if invalid.
 */
function validateDate(date: string): void {
  if (!DATE_FORMAT_REGEX.test(date)) {
    throw new Error(
      `Invalid Jasarat date: expected YYYY-MM-DD, received "${date}"`
    );
  }

  const [yearStr, monthStr, dayStr] = date.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  const maxDay = daysInMonth(year, month);
  if (day > maxDay) {
    throw new Error(
      `Invalid Jasarat date: "${date}" is not a real calendar date ` +
        `(${monthStr} has at most ${maxDay} days in ${year})`
    );
  }
}

/**
 * Validates that `page` is a finite positive integer.
 *
 * Throws with a message matching /Invalid Jasarat page/ if invalid.
 */
function validatePage(page: number): void {
  if (!Number.isFinite(page) || !Number.isInteger(page) || page < 1) {
    throw new Error(
      `Invalid Jasarat page number: expected a positive integer, received ${page}`
    );
  }
}

/**
 * Validates a complete JasaratPageReference.
 * Throws a descriptive error if any field is invalid.
 */
function validateJasaratPageReference(reference: JasaratPageReference): void {
  validateDate(reference.date);
  validatePage(reference.page);
  // TypeScript's type system already constrains edition to "karachi",
  // but we guard defensively at the boundary.
  if (reference.edition !== "karachi") {
    throw new Error(
      `Invalid Jasarat edition: "${String(reference.edition)}" is not supported`
    );
  }
}

// ---------------------------------------------------------------------------
// Public URL builders
// ---------------------------------------------------------------------------

/**
 * Builds the canonical high-resolution Jasarat page image URL.
 *
 * Format:
 *   https://jasarat.news/epaper/images/dates/YYYY-MM-DD/karachi/mm/PAGE.jpg
 *
 * This URL will NEVER contain "sliderpics"; the low-resolution thumbnail
 * path at /mm/sliderpics/ is explicitly excluded.
 *
 * @throws If `reference` contains an invalid date, page number, or edition.
 */
export function buildJasaratPageImageUrl(
  reference: JasaratPageReference
): string {
  validateJasaratPageReference(reference);
  const { date, edition, page } = reference;
  return `https://jasarat.news/epaper/images/dates/${date}/${edition}/mm/${page}.jpg`;
}

/**
 * Builds the standard Jasarat ePaper viewer URL for human browsing.
 *
 * Format:
 *   https://jasarat.news/epaper/YYYY/MM/DD/karachi/PAGE
 *
 * Note: unlike the image URL, the date is expressed with slashes (YYYY/MM/DD)
 * instead of dashes.
 *
 * @throws If `reference` contains an invalid date, page number, or edition.
 */
export function buildJasaratViewerUrl(
  reference: JasaratPageReference
): string {
  validateJasaratPageReference(reference);
  const { date, edition, page } = reference;
  // Convert YYYY-MM-DD → YYYY/MM/DD for the viewer URL path segments.
  const datePath = date.replaceAll("-", "/");
  return `https://jasarat.news/epaper/${datePath}/${edition}/${page}`;
}
