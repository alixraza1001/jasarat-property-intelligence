/**
 * jasaratEditionDiscovery.live.test.ts
 *
 * Opt-in live smoke test for Jasarat edition page discovery.
 * Makes a single real HTTP request to jasarat.news.
 *
 * To run:
 *   $env:JASARAT_LIVE_TEST=1; pnpm test jasaratEditionDiscovery.live
 */

import { describe, it, expect } from "vitest";
import { discoverJasaratEditionPages } from "@/lib/jasarat/jasaratEditionDiscovery";

const LIVE_ENABLED = process.env["JASARAT_LIVE_TEST"] === "1";

/** Known stable historical edition with exactly 8 pages. */
const LIVE_REFERENCE = {
  date: "2026-08-15",
  edition: "karachi" as const,
};

describe.skipIf(!LIVE_ENABLED)(
  "LIVE: discoverJasaratEditionPages against real Jasarat endpoint",
  () => {
    it("discovers the 8 pages for the 15-Aug-2026 Karachi edition", async () => {
      const result = await discoverJasaratEditionPages(LIVE_REFERENCE);

      // Verify page 1 exists
      expect(result.pageNumbers).toContain(1);

      // Verify exactly 8 pages
      expect(result.pageCount).toBe(8);
      expect(result.pageNumbers.length).toBe(8);

      // Verify uniqueness (Set size equals array length)
      expect(new Set(result.pageNumbers).size).toBe(8);

      // Verify numerical sort
      const sorted = [...result.pageNumbers].sort((a, b) => a - b);
      expect(result.pageNumbers).toEqual(sorted);

      // Verify requested URL matches the canonical viewer URL
      expect(result.requestedUrl).toBe("https://jasarat.news/epaper/2026/08/15/karachi/1");

      // Verify final URL corresponds to requested date/edition (starts with canonical prefix)
      expect(result.finalUrl).toMatch(/^https?:\/\/(?:www\.)?jasarat\.news\/epaper\/2026\/08\/15\/karachi\//);

      // Verify no high-res JPG fetch occurs in the URL
      expect(result.requestedUrl).not.toContain("/mm/");
      expect(result.requestedUrl).not.toContain(".jpg");

      console.log("\n--- Live Jasarat Discovery Test Results ---");
      console.log(`  Date         : ${result.reference.date}`);
      console.log(`  Edition      : ${result.reference.edition}`);
      console.log(`  requestedUrl : ${result.requestedUrl}`);
      console.log(`  finalUrl     : ${result.finalUrl}`);
      console.log(`  pageNumbers  : ${JSON.stringify(result.pageNumbers)}`);
      console.log(`  pageCount    : ${result.pageCount}`);
      console.log("-------------------------------------------\n");
    }, 30_000);
  }
);
