/**
 * Unit tests for jasaratHistoricalManifest orchestration.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildJasaratHistoricalAcquisitionManifest } from "@/lib/jasarat/jasaratHistoricalManifest";
import * as discoveryModule from "@/lib/jasarat/jasaratEditionDiscovery";
import { JasaratEditionDiscoveryError } from "@/lib/jasarat/jasaratTypes";
import * as fetcherModule from "@/lib/jasarat/jasaratPageFetcher";

vi.mock("@/lib/jasarat/jasaratEditionDiscovery");
vi.mock("@/lib/jasarat/jasaratPageFetcher");

describe("buildJasaratHistoricalAcquisitionManifest", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const successfulResult = (date: string) => ({
    reference: { date, edition: "karachi" as const },
    requestedUrl: `https://jasarat.news/epaper/${date.replace(/-/g, "/")}/karachi/1`,
    finalUrl: `https://jasarat.news/epaper/${date.replace(/-/g, "/")}/karachi/1`,
    pageNumbers: [1, 2, 3],
    pageCount: 3,
  });

  it("default target is 7", async () => {
    vi.mocked(discoveryModule.discoverJasaratEditionPages).mockImplementation(async (ref) => successfulResult(ref.date));

    const manifest = await buildJasaratHistoricalAcquisitionManifest({ startDate: "2026-08-20", edition: "karachi" });

    expect(manifest.targetEditionCount).toBe(7);
    expect(manifest.successfulEditionCount).toBe(7);
    expect(manifest.entries.length).toBe(7);
  });

  it("starting date is included", async () => {
    vi.mocked(discoveryModule.discoverJasaratEditionPages).mockImplementation(async (ref) => successfulResult(ref.date));

    const manifest = await buildJasaratHistoricalAcquisitionManifest({ startDate: "2026-08-20", edition: "karachi", targetEditionCount: 1 });

    expect(manifest.entries[0].date).toBe("2026-08-20");
  });

  it("dates move backward and outputs are newest-to-oldest", async () => {
    vi.mocked(discoveryModule.discoverJasaratEditionPages).mockImplementation(async (ref) => successfulResult(ref.date));

    const manifest = await buildJasaratHistoricalAcquisitionManifest({ startDate: "2026-08-20", edition: "karachi", targetEditionCount: 3 });

    expect(manifest.entries.map(e => e.date)).toEqual(["2026-08-20", "2026-08-19", "2026-08-18"]);
  });

  it("seven straight successes stop after seven inspections", async () => {
    vi.mocked(discoveryModule.discoverJasaratEditionPages).mockImplementation(async (ref) => successfulResult(ref.date));

    const manifest = await buildJasaratHistoricalAcquisitionManifest({ startDate: "2026-08-20", edition: "karachi" });

    expect(manifest.inspectedDateCount).toBe(7);
    expect(manifest.targetReached).toBe(true);
  });

  it("404 -> DATE_NOT_AVAILABLE and does not count toward quota", async () => {
    vi.mocked(discoveryModule.discoverJasaratEditionPages).mockImplementation(async (ref) => {
      if (ref.date === "2026-08-19") {
        throw new JasaratEditionDiscoveryError("EDITION_NOT_FOUND", "404", "url", { status: 404 });
      }
      return successfulResult(ref.date);
    });

    const manifest = await buildJasaratHistoricalAcquisitionManifest({ startDate: "2026-08-20", edition: "karachi", targetEditionCount: 2 });

    expect(manifest.inspectedDateCount).toBe(3); // 20, 19 (fail), 18
    expect(manifest.successfulEditionCount).toBe(2);
    expect(manifest.entries[1].status).toBe("DATE_NOT_AVAILABLE");
    if (manifest.entries[1].status === "DATE_NOT_AVAILABLE") {
      expect(manifest.entries[1].errorCode).toBe("EDITION_NOT_FOUND");
    }
  });

  it("network failure -> RETRY_PENDING and does not count toward quota", async () => {
    vi.mocked(discoveryModule.discoverJasaratEditionPages).mockImplementation(async (ref) => {
      if (ref.date === "2026-08-19") {
        throw new JasaratEditionDiscoveryError("NETWORK_ERROR", "timeout", "url");
      }
      return successfulResult(ref.date);
    });

    const manifest = await buildJasaratHistoricalAcquisitionManifest({ startDate: "2026-08-20", edition: "karachi", targetEditionCount: 2 });

    expect(manifest.inspectedDateCount).toBe(3);
    expect(manifest.entries[1].status).toBe("RETRY_PENDING");
    if (manifest.entries[1].status === "RETRY_PENDING") {
      expect(manifest.entries[1].errorCode).toBe("NETWORK_ERROR");
      expect(manifest.entries[1].errorMessage).toBe("timeout");
    }
  });

  it("HTTP 500 -> RETRY_PENDING", async () => {
    vi.mocked(discoveryModule.discoverJasaratEditionPages).mockRejectedValueOnce(
      new JasaratEditionDiscoveryError("HTTP_ERROR", "500 error", "url", { status: 500 })
    );
    vi.mocked(discoveryModule.discoverJasaratEditionPages).mockResolvedValue(successfulResult("2026-08-19"));

    const manifest = await buildJasaratHistoricalAcquisitionManifest({ startDate: "2026-08-20", edition: "karachi", targetEditionCount: 1 });
    expect(manifest.entries[0].status).toBe("RETRY_PENDING");
    if (manifest.entries[0].status === "RETRY_PENDING") {
      expect(manifest.entries[0].errorCode).toBe("HTTP_ERROR");
    }
  });

  it("malformed/content discovery errors -> RETRY_PENDING", async () => {
    vi.mocked(discoveryModule.discoverJasaratEditionPages).mockRejectedValueOnce(
      new JasaratEditionDiscoveryError("PAGE_LIST_NOT_FOUND", "bad HTML", "url")
    );
    vi.mocked(discoveryModule.discoverJasaratEditionPages).mockResolvedValue(successfulResult("2026-08-19"));

    const manifest = await buildJasaratHistoricalAcquisitionManifest({ startDate: "2026-08-20", edition: "karachi", targetEditionCount: 1 });
    expect(manifest.entries[0].status).toBe("RETRY_PENDING");
    if (manifest.entries[0].status === "RETRY_PENDING") {
      expect(manifest.entries[0].errorCode).toBe("PAGE_LIST_NOT_FOUND");
    }
  });

  it("mixed outcomes continue until seven successes", async () => {
    vi.mocked(discoveryModule.discoverJasaratEditionPages).mockImplementation(async (ref) => {
      if (ref.date === "2026-08-19" || ref.date === "2026-08-17") throw new JasaratEditionDiscoveryError("EDITION_NOT_FOUND", "404", "url");
      if (ref.date === "2026-08-16") throw new JasaratEditionDiscoveryError("NETWORK_ERROR", "timeout", "url");
      return successfulResult(ref.date);
    });

    const manifest = await buildJasaratHistoricalAcquisitionManifest({ startDate: "2026-08-20", edition: "karachi" }); // target is 7

    expect(manifest.successfulEditionCount).toBe(7);
    expect(manifest.inspectedDateCount).toBe(10); // 7 successes + 2 NOT_FOUND + 1 NETWORK_ERROR
    expect(manifest.targetReached).toBe(true);
  });

  it("normal February boundary", async () => {
    vi.mocked(discoveryModule.discoverJasaratEditionPages).mockImplementation(async (ref) => successfulResult(ref.date));
    const manifest = await buildJasaratHistoricalAcquisitionManifest({ startDate: "2024-03-01", edition: "karachi", targetEditionCount: 2 });
    expect(manifest.entries.map(e => e.date)).toEqual(["2024-03-01", "2024-02-29"]);
  });

  it("leap-year boundary", async () => {
    vi.mocked(discoveryModule.discoverJasaratEditionPages).mockImplementation(async (ref) => successfulResult(ref.date));
    const manifest = await buildJasaratHistoricalAcquisitionManifest({ startDate: "2023-03-01", edition: "karachi", targetEditionCount: 2 });
    expect(manifest.entries.map(e => e.date)).toEqual(["2023-03-01", "2023-02-28"]);
  });

  it("year boundary", async () => {
    vi.mocked(discoveryModule.discoverJasaratEditionPages).mockImplementation(async (ref) => successfulResult(ref.date));
    const manifest = await buildJasaratHistoricalAcquisitionManifest({ startDate: "2026-01-01", edition: "karachi", targetEditionCount: 2 });
    expect(manifest.entries.map(e => e.date)).toEqual(["2026-01-01", "2025-12-31"]);
  });

  it("30-day ceiling stops execution and sets targetReached: false", async () => {
    // Return all 404s
    vi.mocked(discoveryModule.discoverJasaratEditionPages).mockRejectedValue(
      new JasaratEditionDiscoveryError("EDITION_NOT_FOUND", "404", "url")
    );

    const manifest = await buildJasaratHistoricalAcquisitionManifest({ startDate: "2026-08-20", edition: "karachi" });

    expect(manifest.inspectedDateCount).toBe(30);
    expect(manifest.successfulEditionCount).toBe(0);
    expect(manifest.targetReached).toBe(false);
    expect(manifest.entries.length).toBe(30);
  });

  it("invalid date rejects before discovery", async () => {
    await expect(buildJasaratHistoricalAcquisitionManifest({ startDate: "2026-02-30", edition: "karachi" })).rejects.toThrow();
    expect(discoveryModule.discoverJasaratEditionPages).not.toHaveBeenCalled();
  });

  it("target 0 rejects", async () => {
    await expect(buildJasaratHistoricalAcquisitionManifest({ startDate: "2026-08-20", edition: "karachi", targetEditionCount: 0 })).rejects.toThrow();
  });

  it("target >30 rejects", async () => {
    await expect(buildJasaratHistoricalAcquisitionManifest({ startDate: "2026-08-20", edition: "karachi", targetEditionCount: 31 })).rejects.toThrow();
  });

  it("fractional target rejects", async () => {
    await expect(buildJasaratHistoricalAcquisitionManifest({ startDate: "2026-08-20", edition: "karachi", targetEditionCount: 1.5 })).rejects.toThrow();
  });

  it("NaN target rejects", async () => {
    await expect(buildJasaratHistoricalAcquisitionManifest({ startDate: "2026-08-20", edition: "karachi", targetEditionCount: NaN })).rejects.toThrow();
  });

  it("unexpected code errors are rethrown, not disguised as network failures", async () => {
    const unexpectedError = new TypeError("Cannot read properties of undefined");
    vi.mocked(discoveryModule.discoverJasaratEditionPages).mockRejectedValueOnce(unexpectedError);

    await expect(buildJasaratHistoricalAcquisitionManifest({ startDate: "2026-08-20", edition: "karachi" })).rejects.toThrow(unexpectedError);
  });

  it("successful result preserves Task 3 page metadata", async () => {
    vi.mocked(discoveryModule.discoverJasaratEditionPages).mockResolvedValue(successfulResult("2026-08-20"));
    const manifest = await buildJasaratHistoricalAcquisitionManifest({ startDate: "2026-08-20", edition: "karachi", targetEditionCount: 1 });

    const entry = manifest.entries[0];
    expect(entry.status).toBe("COMPLETED");
    if (entry.status === "COMPLETED") {
      expect(entry.pageNumbers).toEqual([1, 2, 3]);
      expect(entry.pageCount).toBe(3);
      expect(entry.requestedUrl).toBeDefined();
      expect(entry.finalUrl).toBeDefined();
    }
  });

  it("Task 4 never calls image fetcher", async () => {
    vi.mocked(discoveryModule.discoverJasaratEditionPages).mockResolvedValue(successfulResult("2026-08-20"));
    await buildJasaratHistoricalAcquisitionManifest({ startDate: "2026-08-20", edition: "karachi", targetEditionCount: 1 });

    expect(fetcherModule.fetchJasaratPageImage).not.toHaveBeenCalled();
  });
});
