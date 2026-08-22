import { describe, it, expect } from "vitest";
import {
  buildJasaratPageImageUrl,
  buildJasaratViewerUrl,
} from "@/lib/jasarat/jasaratUrlBuilder";

// ---------------------------------------------------------------------------
// High-resolution image URL
// ---------------------------------------------------------------------------

describe("buildJasaratPageImageUrl", () => {
  describe("correct URLs", () => {
    it("returns the canonical high-resolution URL for 2026", () => {
      const url = buildJasaratPageImageUrl({
        date: "2026-08-22",
        edition: "karachi",
        page: 4,
      });
      expect(url).toBe(
        "https://jasarat.news/epaper/images/dates/2026-08-22/karachi/mm/4.jpg"
      );
    });

    it("returns the canonical high-resolution URL for a historical 2025 date", () => {
      const url = buildJasaratPageImageUrl({
        date: "2025-08-22",
        edition: "karachi",
        page: 7,
      });
      expect(url).toBe(
        "https://jasarat.news/epaper/images/dates/2025-08-22/karachi/mm/7.jpg"
      );
    });

    it("never contains 'sliderpics' in the URL", () => {
      const url = buildJasaratPageImageUrl({
        date: "2026-08-22",
        edition: "karachi",
        page: 4,
      });
      expect(url).not.toContain("sliderpics");
    });
  });

  // -------------------------------------------------------------------------
  // Date validation
  // -------------------------------------------------------------------------

  describe("date format validation", () => {
    it("throws on DD-MM-YYYY format", () => {
      expect(() =>
        buildJasaratPageImageUrl({
          date: "22-08-2026",
          edition: "karachi",
          page: 1,
        })
      ).toThrow(/Invalid Jasarat date/i);
    });

    it("throws on YYYY/MM/DD format", () => {
      expect(() =>
        buildJasaratPageImageUrl({
          date: "2026/08/22",
          edition: "karachi",
          page: 1,
        })
      ).toThrow(/Invalid Jasarat date/i);
    });

    it("throws on YYYYMMDD compact format", () => {
      expect(() =>
        buildJasaratPageImageUrl({
          date: "20260822",
          edition: "karachi",
          page: 1,
        })
      ).toThrow(/Invalid Jasarat date/i);
    });
  });

  describe("calendar date validation", () => {
    it("throws on February 30 (impossible date)", () => {
      expect(() =>
        buildJasaratPageImageUrl({
          date: "2026-02-30",
          edition: "karachi",
          page: 1,
        })
      ).toThrow(/Invalid Jasarat date/i);
    });

    it("throws on month 13 (impossible month)", () => {
      expect(() =>
        buildJasaratPageImageUrl({
          date: "2025-13-01",
          edition: "karachi",
          page: 1,
        })
      ).toThrow(/Invalid Jasarat date/i);
    });

    it("throws on month 0 (impossible month)", () => {
      expect(() =>
        buildJasaratPageImageUrl({
          date: "2025-00-10",
          edition: "karachi",
          page: 1,
        })
      ).toThrow(/Invalid Jasarat date/i);
    });

    it("throws on April 31 (April has only 30 days)", () => {
      expect(() =>
        buildJasaratPageImageUrl({
          date: "2026-04-31",
          edition: "karachi",
          page: 1,
        })
      ).toThrow(/Invalid Jasarat date/i);
    });

    it("rejects February 29 on a non-leap year", () => {
      expect(() =>
        buildJasaratPageImageUrl({
          date: "2026-02-29",
          edition: "karachi",
          page: 1,
        })
      ).toThrow(/Invalid Jasarat date/i);
    });

    it("accepts February 29 on a leap year", () => {
      expect(() =>
        buildJasaratPageImageUrl({
          date: "2024-02-29",
          edition: "karachi",
          page: 1,
        })
      ).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Page number validation
  // -------------------------------------------------------------------------

  describe("page number validation", () => {
    it("throws on page 0", () => {
      expect(() =>
        buildJasaratPageImageUrl({
          date: "2026-08-22",
          edition: "karachi",
          page: 0,
        })
      ).toThrow(/Invalid Jasarat page/i);
    });

    it("throws on a negative page (-1)", () => {
      expect(() =>
        buildJasaratPageImageUrl({
          date: "2026-08-22",
          edition: "karachi",
          page: -1,
        })
      ).toThrow(/Invalid Jasarat page/i);
    });

    it("throws on a decimal page (1.5)", () => {
      expect(() =>
        buildJasaratPageImageUrl({
          date: "2026-08-22",
          edition: "karachi",
          page: 1.5,
        })
      ).toThrow(/Invalid Jasarat page/i);
    });

    it("throws on NaN", () => {
      expect(() =>
        buildJasaratPageImageUrl({
          date: "2026-08-22",
          edition: "karachi",
          page: NaN,
        })
      ).toThrow(/Invalid Jasarat page/i);
    });

    it("throws on Infinity", () => {
      expect(() =>
        buildJasaratPageImageUrl({
          date: "2026-08-22",
          edition: "karachi",
          page: Infinity,
        })
      ).toThrow(/Invalid Jasarat page/i);
    });
  });
});

// ---------------------------------------------------------------------------
// Viewer URL
// ---------------------------------------------------------------------------

describe("buildJasaratViewerUrl", () => {
  it("returns the correct viewer URL with date path segments", () => {
    const url = buildJasaratViewerUrl({
      date: "2025-08-22",
      edition: "karachi",
      page: 4,
    });
    expect(url).toBe("https://jasarat.news/epaper/2025/08/22/karachi/4");
  });

  it("converts date dashes to slashes in the viewer URL", () => {
    const url = buildJasaratViewerUrl({
      date: "2026-01-05",
      edition: "karachi",
      page: 1,
    });
    // Date portion must use slashes, not dashes
    expect(url).toContain("2026/01/05");
    expect(url).not.toContain("2026-01-05");
  });

  it("applies the same date and page validation", () => {
    expect(() =>
      buildJasaratViewerUrl({
        date: "22-08-2026",
        edition: "karachi",
        page: 1,
      })
    ).toThrow(/Invalid Jasarat date/i);

    expect(() =>
      buildJasaratViewerUrl({
        date: "2026-08-22",
        edition: "karachi",
        page: 0,
      })
    ).toThrow(/Invalid Jasarat page/i);
  });
});
