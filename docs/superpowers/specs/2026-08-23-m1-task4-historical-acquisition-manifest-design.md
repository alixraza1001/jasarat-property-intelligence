# M1 Task 4 Historical Acquisition Manifest Design

## Overview
Task 4 builds an in-memory historical acquisition manifest orchestrator. It orchestrates the existing \`discoverJasaratEditionPages()\` logic to chronologically walk backward day-by-day from a starting date, collecting discovered Jasarat editions until a quota of successful editions is reached or a safety ceiling of inspected dates is hit. 

It **does not** download newspaper JPEGs, and it **does not** use a database or external persistence mechanism.

## Orchestration Logic
1. Start with the given \`startDate\`.
2. Inspect the current date by calling \`discoverJasaratEditionPages\`.
3. Map the result (success or error) to a \`JasaratAcquisitionManifestEntry\`.
4. Decrement the date by one calendar day (crossing month/year/leap-year boundaries accurately in UTC).
5. Repeat steps 2-4 until:
   - \`successfulEditionCount === targetEditionCount\` (default: 7) OR
   - \`inspectedDateCount === MAX_BACKFILL_CALENDAR_DAYS\` (fixed: 30)
6. Stop and return the partial or complete \`JasaratHistoricalAcquisitionManifest\`.

## Quotas and Ceilings
- **Successful-edition quota**: `targetEditionCount` (default: 7). This limits how many *successful* editions are gathered. Unavailable or failed dates do not consume this quota.
- **Safety ceiling**: `MAX_BACKFILL_CALENDAR_DAYS = 30`. This is the hard limit on the total number of inspected dates to prevent infinite loops. Reaching this limit is not an exception; it merely stops the iteration and returns \`targetReached: false\`.

## Status Mapping
Each inspected date maps to exactly one manifest entry with one of three statuses:

1. \`COMPLETED\`: \`discoverJasaratEditionPages()\` succeeded.
   - Retains discovered \`pageNumbers\`, \`pageCount\`, \`requestedUrl\`, \`finalUrl\`.
   - Counts toward the 7-edition quota.
2. \`DATE_NOT_AVAILABLE\`: \`discoverJasaratEditionPages()\` threw \`EDITION_NOT_FOUND\` (HTTP 404).
   - Does not count toward quota. Iteration continues backward.
3. \`RETRY_PENDING\`: \`discoverJasaratEditionPages()\` threw any other error (HTTP_ERROR, NETWORK_ERROR, INVALID_CONTENT_TYPE, UNEXPECTED_REDIRECT, PAGE_LIST_NOT_FOUND, PAGE_LIMIT_EXCEEDED).
   - Preserves the error code and useful error context.
   - Does not count toward quota. Iteration continues backward.

## Proposed Types and Public API

### Options
\`\`\`ts
export interface JasaratHistoricalManifestOptions {
  startDate: string; // Strict YYYY-MM-DD
  edition: JasaratEdition; // e.g. "karachi"
  targetEditionCount?: number; // Defaults to 7, maximum 30.
}
\`\`\`

### Manifest and Entries
\`\`\`ts
export interface JasaratHistoricalAcquisitionManifest {
  startDate: string;
  edition: JasaratEdition;

  targetEditionCount: number;
  successfulEditionCount: number;
  inspectedDateCount: number;

  targetReached: boolean;

  entries: JasaratAcquisitionManifestEntry[];
}

export type JasaratAcquisitionManifestEntry =
  | JasaratAcquisitionManifestEntryCompleted
  | JasaratAcquisitionManifestEntryUnavailable
  | JasaratAcquisitionManifestEntryRetry;

export interface JasaratAcquisitionManifestEntryCompleted {
  date: string;
  edition: JasaratEdition;
  status: "COMPLETED";
  pageNumbers: number[];
  pageCount: number;
  requestedUrl: string;
  finalUrl: string;
}

export interface JasaratAcquisitionManifestEntryUnavailable {
  date: string;
  edition: JasaratEdition;
  status: "DATE_NOT_AVAILABLE";
  errorCode: "EDITION_NOT_FOUND";
}

export interface JasaratAcquisitionManifestEntryRetry {
  date: string;
  edition: JasaratEdition;
  status: "RETRY_PENDING";
  errorCode: JasaratEditionDiscoveryErrorCode; // Everything except EDITION_NOT_FOUND
  errorMessage?: string;
}
\`\`\`

### Main Function
\`\`\`ts
export async function buildJasaratHistoricalAcquisitionManifest(
  options: JasaratHistoricalManifestOptions
): Promise<JasaratHistoricalAcquisitionManifest>
\`\`\`

## Date Handling
- Must implement a deterministic date subtraction helper to subtract exactly one calendar day.
- UTC-based arithmetic is required to avoid daylight saving time or local time zone mutations.
- Iteration must perfectly cross month, year, and leap-year boundaries (e.g., \`2026-03-01\` → \`2026-02-28\`, \`2024-03-01\` → \`2024-02-29\`, \`2026-01-01\` → \`2025-12-31\`).
- Must rely on the existing Task 1 URL builder standard for \`YYYY-MM-DD\` calendar validation instead of duplicating it.
- **No external date dependencies** (no Moment, Day.js, Luxon, etc.).

## Out of Scope
- No JPEG downloading (`fetchJasaratPageImage` is strictly forbidden).
- No duplicating Task 3 HTML parsing or Task 1 URL logic.
- No persisting to database (Supabase, Firebase, Excel, etc.).
- No automatic/manual retries execution, cron jobs, concurrent queueing, or AI classification.
- Manual retry compatibility is supported by recording all required contextual fields in the \`RETRY_PENDING\` entry.
