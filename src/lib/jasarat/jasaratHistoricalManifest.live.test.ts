/**
 * jasaratHistoricalManifest.live.test.ts
 *
 * Opt-in live smoke test for Jasarat historical acquisition manifest.
 * Makes a few lightweight HTML requests to verify real behavior.
 *
 * To run:
 *   $env:JASARAT_LIVE_TEST=1; pnpm test jasaratHistoricalManifest.live
 */

import { describe, it, expect } from "vitest";
import { buildJasaratHistoricalAcquisitionManifest } from "@/lib/jasarat/jasaratHistoricalManifest";

const LIVE_ENABLED = process.env["JASARAT_LIVE_TEST"] === "1";

describe.skipIf(!LIVE_ENABLED)(
  "LIVE: buildJasaratHistoricalAcquisitionManifest against real Jasarat endpoint",
  () => {
    it("collects 2 successful editions and moves backward chronologically", async () => {
      // We start at 2026-08-15 and ask for 2 successful editions.
      const manifest = await buildJasaratHistoricalAcquisitionManifest({
        startDate: "2026-08-15",
        edition: "karachi",
        targetEditionCount: 2,
      });

      expect(manifest.targetReached).toBe(true);
      expect(manifest.successfulEditionCount).toBe(2);
      expect(manifest.inspectedDateCount).toBeGreaterThanOrEqual(2);
      expect(manifest.entries.length).toBeGreaterThanOrEqual(2);

      // Verify no high-res JPG fetches occurred anywhere
      for (const entry of manifest.entries) {
        if (entry.status === "COMPLETED") {
          expect(entry.requestedUrl).not.toContain("/mm/");
          expect(entry.requestedUrl).not.toContain(".jpg");

          expect(entry.finalUrl).not.toContain("/mm/");
          expect(entry.finalUrl).not.toContain(".jpg");
        }
      }

      const completed = manifest.entries.filter((e) => e.status === "COMPLETED");
      expect(completed.length).toBe(2);

      // Verify backward date movement (the first completed entry should be 2026-08-15 if available,
      // but definitively newer than the second).
      const d1 = new Date(completed[0].date).getTime();
      const d2 = new Date(completed[1].date).getTime();
      expect(d1).toBeGreaterThan(d2);

      // Verify sorted page metadata is present on the first completed entry
      const firstCompleted = completed[0];
      if (firstCompleted.status === "COMPLETED") {
        expect(firstCompleted.pageCount).toBeGreaterThan(0);
        expect(firstCompleted.pageNumbers.length).toBe(firstCompleted.pageCount);

        // Ensure sorted
        const sorted = [...firstCompleted.pageNumbers].sort((a, b) => a - b);
        expect(firstCompleted.pageNumbers).toEqual(sorted);
      }

      console.log("\n--- Live Jasarat Manifest Test Results ---");
      console.log(`  StartDate       : ${manifest.startDate}`);
      console.log(`  Target          : ${manifest.targetEditionCount}`);
      console.log(`  Inspected       : ${manifest.inspectedDateCount}`);
      console.log(`  Successful      : ${manifest.successfulEditionCount}`);
      console.log(`  Entries:`);
      for (const entry of manifest.entries) {
        if (entry.status === "COMPLETED") {
          console.log(`    [${entry.date}] COMPLETED (${entry.pageCount} pages)`);
        } else if (entry.status === "DATE_NOT_AVAILABLE") {
          console.log(`    [${entry.date}] DATE_NOT_AVAILABLE (${entry.errorCode})`);
        } else {
          console.log(`    [${entry.date}] RETRY_PENDING (${entry.errorCode})`);
        }
      }
      console.log("------------------------------------------\n");
    }, 60_000);
  }
);
