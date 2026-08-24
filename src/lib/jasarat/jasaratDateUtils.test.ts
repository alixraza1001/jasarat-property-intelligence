import { describe, it, expect } from "vitest";
import { decrementJasaratDate } from "@/lib/jasarat/jasaratDateUtils";

describe("decrementJasaratDate", () => {
  it("decrements a normal day", () => {
    expect(decrementJasaratDate("2026-08-20")).toBe("2026-08-19");
  });

  it("decrements across a month boundary", () => {
    expect(decrementJasaratDate("2026-03-01")).toBe("2026-02-28");
  });

  it("decrements across a normal-year February boundary", () => {
    expect(decrementJasaratDate("2024-03-01")).toBe("2024-02-29");
  });

  it("decrements across a year boundary", () => {
    expect(decrementJasaratDate("2026-01-01")).toBe("2025-12-31");
  });
});
