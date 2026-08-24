/**
 * Unit tests for jasaratEditionDiscovery.
 *
 * All tests mock globalThis.fetch — no real HTTP requests are made.
 * pnpm test must remain fully offline-safe.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { discoverJasaratEditionPages } from "@/lib/jasarat/jasaratEditionDiscovery";
import { JasaratEditionDiscoveryError } from "@/lib/jasarat/jasaratTypes";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

/**
 * Creates a mocked successful HTTP Response with the given HTML content.
 */
function mockHtmlResponse(html: string, url: string = "https://jasarat.news/epaper/2026/08/15/karachi/1") {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ "Content-Type": "text/html; charset=UTF-8" }),
    url,
    text: async () => html,
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("discoverJasaratEditionPages — success cases", () => {
  it("1. Eight-page edition: correctly extracts pages 1-8", async () => {
    const html = `
      <html><body>
        <a href="/epaper/2026/08/15/karachi/1">Page 1</a>
        <a href="/epaper/2026/08/15/karachi/2">Page 2</a>
        <a href="/epaper/2026/08/15/karachi/3">Page 3</a>
        <a href="/epaper/2026/08/15/karachi/4">Page 4</a>
        <a href="/epaper/2026/08/15/karachi/5">Page 5</a>
        <a href="/epaper/2026/08/15/karachi/6">Page 6</a>
        <a href="/epaper/2026/08/15/karachi/7">Page 7</a>
        <a href="/epaper/2026/08/15/karachi/8">Page 8</a>
      </body></html>
    `;
    mockFetch.mockResolvedValueOnce(mockHtmlResponse(html));

    const result = await discoverJasaratEditionPages({ date: "2026-08-15", edition: "karachi" });

    expect(result.pageNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(result.pageCount).toBe(8);
  });

  it("2. Fifteen-page edition: proves discovery doesn't assume 8 pages", async () => {
    const links = Array.from({ length: 15 }, (_, i) => `<a href="/epaper/2026/08/15/karachi/${i + 1}">Link</a>`).join("\\n");
    mockFetch.mockResolvedValueOnce(mockHtmlResponse(`<html><body>${links}</body></html>`));

    const result = await discoverJasaratEditionPages({ date: "2026-08-15", edition: "karachi" });

    expect(result.pageCount).toBe(15);
    expect(result.pageNumbers[14]).toBe(15);
  });

  it("3. Unordered links: sorts them numerically", async () => {
    const html = `
      <a href="/epaper/2026/08/15/karachi/5"></a>
      <a href="/epaper/2026/08/15/karachi/2"></a>
      <a href="/epaper/2026/08/15/karachi/1"></a>
      <a href="/epaper/2026/08/15/karachi/4"></a>
      <a href="/epaper/2026/08/15/karachi/3"></a>
    `;
    mockFetch.mockResolvedValueOnce(mockHtmlResponse(html));

    const result = await discoverJasaratEditionPages({ date: "2026-08-15", edition: "karachi" });
    expect(result.pageNumbers).toEqual([1, 2, 3, 4, 5]);
  });

  it("4. Duplicate page links: deduplicates", async () => {
    const html = `
      <a href="/epaper/2026/08/15/karachi/1"></a>
      <a href="/epaper/2026/08/15/karachi/2"></a>
      <a href="/epaper/2026/08/15/karachi/2"></a>
      <a href="/epaper/2026/08/15/karachi/3"></a>
      <a href="/epaper/2026/08/15/karachi/3"></a>
      <a href="/epaper/2026/08/15/karachi/3"></a>
    `;
    mockFetch.mockResolvedValueOnce(mockHtmlResponse(html));

    const result = await discoverJasaratEditionPages({ date: "2026-08-15", edition: "karachi" });
    expect(result.pageNumbers).toEqual([1, 2, 3]);
  });

  it("5. Relative links: properly resolved", async () => {
    const html = `<a href="/epaper/2026/08/15/karachi/1"></a><a href="/epaper/2026/08/15/karachi/4"></a>`;
    mockFetch.mockResolvedValueOnce(mockHtmlResponse(html));

    const result = await discoverJasaratEditionPages({ date: "2026-08-15", edition: "karachi" });
    expect(result.pageNumbers).toEqual([1, 4]);
  });

  it("6. Absolute links: properly supported", async () => {
    const html = `<a href="https://jasarat.news/epaper/2026/08/15/karachi/1"></a><a href="https://jasarat.news/epaper/2026/08/15/karachi/4"></a>`;
    mockFetch.mockResolvedValueOnce(mockHtmlResponse(html));

    const result = await discoverJasaratEditionPages({ date: "2026-08-15", edition: "karachi" });
    expect(result.pageNumbers).toEqual([1, 4]);
  });

  it("7. Single-quoted hrefs: supported", async () => {
    const html = `<a href='/epaper/2026/08/15/karachi/1'></a><a href='/epaper/2026/08/15/karachi/4'></a>`;
    mockFetch.mockResolvedValueOnce(mockHtmlResponse(html));

    const result = await discoverJasaratEditionPages({ date: "2026-08-15", edition: "karachi" });
    expect(result.pageNumbers).toEqual([1, 4]);
  });

  it("8. Ignore another edition: hyderabad links excluded", async () => {
    const html = `
      <a href="/epaper/2026/08/15/karachi/1"></a>
      <a href="/epaper/2026/08/15/karachi/2"></a>
      <a href="/epaper/2026/08/15/hyderabad/1"></a>
    `;
    mockFetch.mockResolvedValueOnce(mockHtmlResponse(html));

    const result = await discoverJasaratEditionPages({ date: "2026-08-15", edition: "karachi" });
    expect(result.pageNumbers).toEqual([1, 2]);
  });

  it("9. Ignore another date: previous day excluded", async () => {
    const html = `
      <a href="/epaper/2026/08/15/karachi/1"></a>
      <a href="/epaper/2026/08/14/karachi/1"></a>
    `;
    mockFetch.mockResolvedValueOnce(mockHtmlResponse(html));

    const result = await discoverJasaratEditionPages({ date: "2026-08-15", edition: "karachi" });
    expect(result.pageNumbers).toEqual([1]);
  });
});

describe("discoverJasaratEditionPages — error cases", () => {
  it("10. 404 response produces EDITION_NOT_FOUND", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      url: "https://jasarat.news/epaper/2026/08/15/karachi/1",
    } as unknown as Response);

    await expect(discoverJasaratEditionPages({ date: "2026-08-15", edition: "karachi" }))
      .rejects.toSatisfy((e: unknown) => e instanceof JasaratEditionDiscoveryError && e.code === "EDITION_NOT_FOUND" && e.status === 404);
  });

  it("11. 500 response produces HTTP_ERROR", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      url: "https://jasarat.news/epaper/2026/08/15/karachi/1",
    } as unknown as Response);

    await expect(discoverJasaratEditionPages({ date: "2026-08-15", edition: "karachi" }))
      .rejects.toSatisfy((e: unknown) => e instanceof JasaratEditionDiscoveryError && e.code === "HTTP_ERROR" && e.status === 500);
  });

  it("12. Wrong content type (image/jpeg) produces INVALID_CONTENT_TYPE", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "Content-Type": "image/jpeg" }),
      url: "https://jasarat.news/epaper/2026/08/15/karachi/1",
    } as unknown as Response);

    await expect(discoverJasaratEditionPages({ date: "2026-08-15", edition: "karachi" }))
      .rejects.toSatisfy((e: unknown) => e instanceof JasaratEditionDiscoveryError && e.code === "INVALID_CONTENT_TYPE");
  });

  it("13. HTML body read failure produces NETWORK_ERROR", async () => {
    const cause = new TypeError("Read failed");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "Content-Type": "text/html" }),
      url: "https://jasarat.news/epaper/2026/08/15/karachi/1",
      text: async () => { throw cause; }
    } as unknown as Response);

    await expect(discoverJasaratEditionPages({ date: "2026-08-15", edition: "karachi" }))
      .rejects.toSatisfy((e: unknown) => e instanceof JasaratEditionDiscoveryError && e.code === "NETWORK_ERROR" && e.cause === cause);
  });

  it("14. fetch network failure produces NETWORK_ERROR", async () => {
    const cause = new TypeError("DNS failed");
    mockFetch.mockRejectedValueOnce(cause);

    await expect(discoverJasaratEditionPages({ date: "2026-08-15", edition: "karachi" }))
      .rejects.toSatisfy((e: unknown) => e instanceof JasaratEditionDiscoveryError && e.code === "NETWORK_ERROR" && e.cause === cause);
  });

  it("15. No page links produces PAGE_LIST_NOT_FOUND", async () => {
    const html = `<html><body>No pages here</body></html>`;
    mockFetch.mockResolvedValueOnce(mockHtmlResponse(html));

    await expect(discoverJasaratEditionPages({ date: "2026-08-15", edition: "karachi" }))
      .rejects.toSatisfy((e: unknown) => e instanceof JasaratEditionDiscoveryError && e.code === "PAGE_LIST_NOT_FOUND");
  });

  it("16. Page 1 absent produces PAGE_LIST_NOT_FOUND", async () => {
    const html = `
      <a href="/epaper/2026/08/15/karachi/2"></a>
      <a href="/epaper/2026/08/15/karachi/3"></a>
    `;
    mockFetch.mockResolvedValueOnce(mockHtmlResponse(html));

    await expect(discoverJasaratEditionPages({ date: "2026-08-15", edition: "karachi" }))
      .rejects.toSatisfy((e: unknown) => e instanceof JasaratEditionDiscoveryError && e.code === "PAGE_LIST_NOT_FOUND");
  });

  it("17. Page limit exceeded produces PAGE_LIMIT_EXCEEDED", async () => {
    const links = Array.from({ length: 41 }, (_, i) => `<a href="/epaper/2026/08/15/karachi/${i + 1}">Link</a>`).join("\\n");
    mockFetch.mockResolvedValueOnce(mockHtmlResponse(links));

    await expect(discoverJasaratEditionPages({ date: "2026-08-15", edition: "karachi" }))
      .rejects.toSatisfy((e: unknown) => e instanceof JasaratEditionDiscoveryError && e.code === "PAGE_LIMIT_EXCEEDED");
  });

  it("18. Unexpected redirect to wrong date produces UNEXPECTED_REDIRECT", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "Content-Type": "text/html" }),
      url: "https://jasarat.news/epaper/2026-08-22/karachi/1", // Redirected to 22nd
      text: async () => `<a href="/epaper/2026/08/22/karachi/1"></a>` // It has page 1 of the new date
    } as unknown as Response);

    await expect(discoverJasaratEditionPages({ date: "2025-08-22", edition: "karachi" }))
      .rejects.toSatisfy((e: unknown) => e instanceof JasaratEditionDiscoveryError && e.code === "UNEXPECTED_REDIRECT");
  });

  it("19. Invalid reference does not fetch", async () => {
    await expect(discoverJasaratEditionPages({ date: "2026-02-30", edition: "karachi" }))
      .rejects.toThrow(/Invalid Jasarat/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("20. Timeout covers body reading", async () => {
    vi.useFakeTimers();

    const controller = { signal: null as unknown as AbortSignal };

    mockFetch.mockImplementationOnce(
      (_url: string | URL | Request, init?: RequestInit): Promise<Response> => {
        if (init?.signal) {
          controller.signal = init.signal as AbortSignal;
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "Content-Type": "text/html" }),
          url: "https://jasarat.news/epaper/2026/08/15/karachi/1",
          text: (): Promise<string> =>
            new Promise((_resolve, reject) => {
              const check = () => {
                if (controller.signal?.aborted) {
                  reject(new DOMException("The operation was aborted.", "AbortError"));
                } else {
                  setTimeout(check, 100);
                }
              };
              setTimeout(check, 100);
            }),
        } as unknown as Response);
      }
    );

    const fetchPromise = expect(discoverJasaratEditionPages({ date: "2026-08-15", edition: "karachi" }))
      .rejects.toSatisfy((e: unknown) => e instanceof JasaratEditionDiscoveryError && e.code === "NETWORK_ERROR");

    await vi.advanceTimersByTimeAsync(20_001);
    await fetchPromise;

    vi.useRealTimers();
  });
});
