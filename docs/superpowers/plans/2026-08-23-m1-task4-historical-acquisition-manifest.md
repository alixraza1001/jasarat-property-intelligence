# M1 Task 4 Historical Acquisition Manifest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec Reference:** `docs/superpowers/specs/2026-08-23-m1-task4-historical-acquisition-manifest-design.md`

## 1. Domain Types Definition
- [ ] **Create/Append domain and result types in `src/lib/jasarat/jasaratTypes.ts`**.
  - Add `JasaratHistoricalManifestOptions`, `JasaratHistoricalAcquisitionManifest`, `JasaratAcquisitionManifestEntry`, `JasaratAcquisitionManifestEntryCompleted`, `JasaratAcquisitionManifestEntryUnavailable`, `JasaratAcquisitionManifestEntryRetry`.
  - Use discriminated unions for the entry status exactly as specified in the spec.
  - Re-export the types in `src/lib/jasarat/index.ts` and `src/lib/jasarat/server.ts`.

## 2. Deterministic Date Helper
- [ ] **Create date decrement tests (`src/lib/jasarat/jasaratDateUtils.test.ts`)**.
  - Write test: normal day decrement (`2026-08-20` → `2026-08-19`).
  - Write test: month boundary decrement (`2026-03-01` → `2026-02-28`).
  - Write test: normal-year February boundary decrement (`2024-03-01` → `2024-02-29`).
  - Write test: year boundary decrement (`2026-01-01` → `2025-12-31`).
  - Expect failure (RED phase).
- [ ] **Implement date decrement helper (`src/lib/jasarat/jasaratDateUtils.ts`)**.
  - Create `decrementJasaratDate(dateStr: string): string`.
  - Implement using UTC-based `Date` arithmetic to avoid DST side effects.
  - Verify GREEN phase via `pnpm test`.

## 3. Orchestration Logic & Status Mapping
- [ ] **Create orchestration tests (`src/lib/jasarat/jasaratHistoricalManifest.test.ts`)**.
  - Mock `discoverJasaratEditionPages` using `vi.mock()`.
  - Write tests for:
    - Exactly 7 successful editions stops after 7 inspected dates.
    - Starting date is included in the manifest.
    - Iteration moves backward sequentially using the date helper.
    - 404 (`EDITION_NOT_FOUND`) maps to `DATE_NOT_AVAILABLE` and continues loop.
    - Network error maps to `RETRY_PENDING` and continues loop.
    - HTTP 500 maps to `RETRY_PENDING`.
    - Malformed/content discovery failure maps to `RETRY_PENDING`.
    - Failures/unavailable dates do not count toward seven-edition quota.
    - Mixed results continue until 7 successes are achieved.
    - Entries remain chronological in inspection order (newest-to-oldest).
    - Invalid start date fails before discovery (using existing validation/URL builder).
    - Default target is 7.
    - Invalid target such as 0 is rejected.
    - Excessive target (>30) is rejected.
    - Stops at 30 inspected calendar dates.
    - Returns `targetReached: false` when 30-day ceiling occurs before quota.
    - Returns `targetReached: true` when quota is reached.
    - Successful entry preserves Task 3 page numbers, page count, and URLs.
    - Retry entry preserves discovery error code.
    - Explicitly verify no call to `fetchJasaratPageImage` is ever made.
  - Run tests and confirm failure (RED phase).
- [ ] **Implement orchestration logic (`src/lib/jasarat/jasaratHistoricalManifest.ts`)**.
  - Create `buildJasaratHistoricalAcquisitionManifest(options)`.
  - Validate options (start date via existing builder, `targetEditionCount` between 1 and 30, defaulting to 7).
  - Implement the `while` loop that increments `inspectedDateCount`, calls `discoverJasaratEditionPages`, maps the success/error correctly, decrements the date, and breaks if `successfulEditionCount === targetEditionCount` or `inspectedDateCount === MAX_BACKFILL_CALENDAR_DAYS`.
  - Verify GREEN phase via `pnpm test`.

## 4. Live Smoke Test
- [ ] **Create live test (`src/lib/jasarat/jasaratHistoricalManifest.live.test.ts`)**.
  - Write test using `targetEditionCount: 2` against `startDate: "2026-08-15"`.
  - Gate behind `JASARAT_LIVE_TEST=1`.
  - Assert that two successful editions are collected, dates move backward, and no JPEG fetch (`fetchJasaratPageImage`) occurs.
- [ ] **Run Live Test**.
  - Run `$env:JASARAT_LIVE_TEST=1; pnpm test jasaratHistoricalManifest.live`.
  - Confirm success.

## 5. Exports and Verification
- [ ] **Update server barrel (`src/lib/jasarat/server.ts`)**.
  - Export `buildJasaratHistoricalAcquisitionManifest` alongside other API functions.
- [ ] **Final Code Verification**.
  - Run `pnpm test` (fully offline, no external requests).
  - Run `pnpm lint`.
  - Run `pnpm typecheck`.
  - Run `pnpm build`.
- [ ] **Update README.md**.
  - Document the Task 4 feature under the existing M1 bullet points (Historical Acquisition Manifest proof of orchestration).
  - List the new files in the project structure tree.
  - Show the new API imports for the manifest.
