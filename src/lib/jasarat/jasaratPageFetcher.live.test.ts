/**
 * jasaratPageFetcher.live.test.ts
 *
 * Opt-in live smoke test for the Jasarat full-resolution page fetcher.
 *
 * This test makes a REAL HTTP request to jasarat.news.
 * It is intentionally excluded from normal CI runs.
 *
 * To run:
 *   $env:JASARAT_LIVE_TEST=1; pnpm test jasaratPageFetcher.live
 *
 * When JASARAT_LIVE_TEST is absent or not "1", every test in this file
 * is skipped automatically.
 *
 * Do not add more tests here — one real request is sufficient.
 * Do not hammer Jasarat.
 */

import { describe, it, expect } from "vitest";
import { fetchJasaratPageImage } from "@/lib/jasarat/jasaratPageFetcher";

const LIVE_ENABLED = process.env["JASARAT_LIVE_TEST"] === "1";

/** Known good page: Karachi edition, 22 Aug 2026, page 4. */
const LIVE_REFERENCE = {
  date: "2026-08-22",
  edition: "karachi" as const,
  page: 4,
} as const;

const EXPECTED_URL =
  "https://jasarat.news/epaper/images/dates/2026-08-22/karachi/mm/4.jpg";

const JPEG_MAGIC = [0xff, 0xd8, 0xff] as const;

describe.skipIf(!LIVE_ENABLED)(
  "LIVE: fetchJasaratPageImage against real Jasarat endpoint",
  () => {
    it(
      "fetches the real Karachi page 4 from 2026-08-22 and validates it",
      async () => {
        const result = await fetchJasaratPageImage(LIVE_REFERENCE);

        // Content type
        expect(result.contentType).toBe("image/jpeg");

        // Byte size (well above minimum safeguard)
        expect(result.byteLength).toBeGreaterThan(100_000);

        // Thumbnail safeguard
        expect(result.requestedUrl).not.toContain("sliderpics");
        expect(result.finalUrl).not.toContain("sliderpics");

        // Correct requested URL
        expect(result.requestedUrl).toBe(EXPECTED_URL);

        // JPEG magic bytes
        expect(result.bytes[0]).toBe(JPEG_MAGIC[0]);
        expect(result.bytes[1]).toBe(JPEG_MAGIC[1]);
        expect(result.bytes[2]).toBe(JPEG_MAGIC[2]);

        // Reference is preserved
        expect(result.reference).toEqual(LIVE_REFERENCE);

        // Report useful context to the console for the completion report
        console.log("\n--- Live Jasarat Smoke Test Results ---");
        console.log(`  requestedUrl : ${result.requestedUrl}`);
        console.log(`  finalUrl     : ${result.finalUrl}`);
        console.log(`  contentType  : ${result.contentType}`);
        console.log(`  byteLength   : ${result.byteLength.toLocaleString()} bytes`);
        console.log(
          `  JPEG magic   : ${result.bytes[0].toString(16).toUpperCase()} ` +
            `${result.bytes[1].toString(16).toUpperCase()} ` +
            `${result.bytes[2].toString(16).toUpperCase()}`
        );
        console.log(`  sliderpics   : not present in requestedUrl or finalUrl ✓`);
        console.log("---------------------------------------\n");
      },
      // 30-second timeout for the live network request
      30_000
    );
  }
);
