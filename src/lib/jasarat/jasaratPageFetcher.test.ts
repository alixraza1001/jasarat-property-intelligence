/**
 * Unit tests for jasaratPageFetcher.
 *
 * All tests mock globalThis.fetch — no real HTTP requests are made.
 * pnpm test must remain fully offline-safe.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchJasaratPageImage,
} from "@/lib/jasarat/jasaratPageFetcher";
import {
  JasaratPageFetchError,
} from "@/lib/jasarat/jasaratTypes";

// ---------------------------------------------------------------------------
// Test fixture helpers
// ---------------------------------------------------------------------------

/** Synthetic JPEG bytes with valid FF D8 FF magic, total size > 100 KB. */
function makeLargeJpegBytes(size = 110_000): Uint8Array {
  const buf = new Uint8Array(size);
  buf[0] = 0xff;
  buf[1] = 0xd8;
  buf[2] = 0xff;
  return buf;
}

/** Synthetic JPEG bytes that are smaller than the safeguard threshold. */
function makeSmallJpegBytes(size = 21_000): Uint8Array {
  const buf = new Uint8Array(size);
  buf[0] = 0xff;
  buf[1] = 0xd8;
  buf[2] = 0xff;
  return buf;
}

/** Synthetic bytes that do NOT start with FF D8 FF (e.g. HTML body). */
function makeNonJpegBytes(size = 110_000): Uint8Array {
  const buf = new Uint8Array(size);
  buf[0] = 0x3c; // '<'
  buf[1] = 0x21; // '!'
  return buf;
}

/** Creates a mock Response with the given properties. */
function mockResponse(opts: {
  status?: number;
  contentType?: string;
  body?: Uint8Array;
  url?: string;
}): Response {
  const {
    status = 200,
    contentType = "image/jpeg",
    body = makeLargeJpegBytes(),
    url = "https://jasarat.news/epaper/images/dates/2026-08-22/karachi/mm/4.jpg",
  } = opts;

  const headers = new Headers({ "Content-Type": contentType });

  return {
    ok: status >= 200 && status < 300,
    status,
    headers,
    url,
    arrayBuffer: async () => body.buffer as ArrayBuffer,
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const mockFetch = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
});

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe("fetchJasaratPageImage — success", () => {
  it("returns validated result for a canonical 2026 page reference", async () => {
    const bytes = makeLargeJpegBytes();
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: bytes })
    );

    const result = await fetchJasaratPageImage({
      date: "2026-08-22",
      edition: "karachi",
      page: 4,
    });

    expect(result.reference).toEqual({
      date: "2026-08-22",
      edition: "karachi",
      page: 4,
    });
    expect(result.requestedUrl).toBe(
      "https://jasarat.news/epaper/images/dates/2026-08-22/karachi/mm/4.jpg"
    );
    expect(result.contentType).toBe("image/jpeg");
    expect(result.byteLength).toBe(bytes.length);
    expect(result.bytes).toBeInstanceOf(Uint8Array);
    expect(result.bytes.length).toBe(bytes.length);
  });

  it("requested URL never contains 'sliderpics'", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({}));

    const result = await fetchJasaratPageImage({
      date: "2026-08-22",
      edition: "karachi",
      page: 4,
    });

    expect(result.requestedUrl).not.toContain("sliderpics");
    expect(result.finalUrl).not.toContain("sliderpics");
  });

  it("uses the canonical high-resolution URL, not the thumbnail path", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({}));

    await fetchJasaratPageImage({
      date: "2026-08-22",
      edition: "karachi",
      page: 4,
    });

    // The fetch call must target the high-resolution endpoint
    const calledUrl = (mockFetch.mock.calls[0] as unknown[])[0] as string;
    expect(calledUrl).toBe(
      "https://jasarat.news/epaper/images/dates/2026-08-22/karachi/mm/4.jpg"
    );
    expect(calledUrl).not.toContain("sliderpics");
  });

  it("works for a historical 2025 date without restriction", async () => {
    const bytes = makeLargeJpegBytes();
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: bytes,
        url: "https://jasarat.news/epaper/images/dates/2025-08-22/karachi/mm/7.jpg",
      })
    );

    const result = await fetchJasaratPageImage({
      date: "2025-08-22",
      edition: "karachi",
      page: 7,
    });

    expect(result.requestedUrl).toBe(
      "https://jasarat.news/epaper/images/dates/2025-08-22/karachi/mm/7.jpg"
    );
    expect(result.byteLength).toBe(bytes.length);
  });

  it("captures finalUrl from the response (after potential redirects)", async () => {
    const finalUrl =
      "https://jasarat.news/epaper/images/dates/2026-08-22/karachi/mm/4.jpg";
    mockFetch.mockResolvedValueOnce(
      mockResponse({ url: finalUrl })
    );

    const result = await fetchJasaratPageImage({
      date: "2026-08-22",
      edition: "karachi",
      page: 4,
    });

    expect(result.finalUrl).toBe(finalUrl);
  });

  it("accepts image/jpeg with an optional charset/parameter suffix", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ contentType: "image/jpeg; some=param" })
    );

    const result = await fetchJasaratPageImage({
      date: "2026-08-22",
      edition: "karachi",
      page: 4,
    });

    expect(result.contentType).toBe("image/jpeg");
  });
});

// ---------------------------------------------------------------------------
// HTTP error cases
// ---------------------------------------------------------------------------

describe("fetchJasaratPageImage — HTTP errors", () => {
  it("throws NOT_FOUND for HTTP 404", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ status: 404, body: new Uint8Array(0), contentType: "text/html" })
    );

    await expect(
      fetchJasaratPageImage({ date: "2026-08-22", edition: "karachi", page: 99 })
    ).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof JasaratPageFetchError && e.code === "NOT_FOUND"
    );
  });

  it("NOT_FOUND error carries the url", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ status: 404, body: new Uint8Array(0), contentType: "text/html" })
    );

    try {
      await fetchJasaratPageImage({ date: "2026-08-22", edition: "karachi", page: 99 });
    } catch (e) {
      expect(e).toBeInstanceOf(JasaratPageFetchError);
      const err = e as JasaratPageFetchError;
      expect(err.url).toContain("jasarat.news");
      expect(err.status).toBe(404);
    }
  });

  it("throws HTTP_ERROR for HTTP 500", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ status: 500, body: new Uint8Array(0), contentType: "text/html" })
    );

    await expect(
      fetchJasaratPageImage({ date: "2026-08-22", edition: "karachi", page: 4 })
    ).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof JasaratPageFetchError &&
        e.code === "HTTP_ERROR" &&
        e.status === 500
    );
  });

  it("throws HTTP_ERROR for HTTP 403", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ status: 403, body: new Uint8Array(0), contentType: "text/html" })
    );

    await expect(
      fetchJasaratPageImage({ date: "2026-08-22", edition: "karachi", page: 4 })
    ).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof JasaratPageFetchError && e.code === "HTTP_ERROR"
    );
  });

  it("throws HTTP_ERROR for HTTP 503", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ status: 503, body: new Uint8Array(0), contentType: "text/html" })
    );

    await expect(
      fetchJasaratPageImage({ date: "2026-08-22", edition: "karachi", page: 4 })
    ).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof JasaratPageFetchError && e.code === "HTTP_ERROR"
    );
  });
});

// ---------------------------------------------------------------------------
// Content-type errors
// ---------------------------------------------------------------------------

describe("fetchJasaratPageImage — content type errors", () => {
  it("throws INVALID_CONTENT_TYPE for text/html", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ contentType: "text/html" })
    );

    await expect(
      fetchJasaratPageImage({ date: "2026-08-22", edition: "karachi", page: 4 })
    ).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof JasaratPageFetchError && e.code === "INVALID_CONTENT_TYPE"
    );
  });

  it("throws INVALID_CONTENT_TYPE for application/json", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ contentType: "application/json" })
    );

    await expect(
      fetchJasaratPageImage({ date: "2026-08-22", edition: "karachi", page: 4 })
    ).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof JasaratPageFetchError && e.code === "INVALID_CONTENT_TYPE"
    );
  });

  it("throws INVALID_CONTENT_TYPE for image/png", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ contentType: "image/png" })
    );

    await expect(
      fetchJasaratPageImage({ date: "2026-08-22", edition: "karachi", page: 4 })
    ).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof JasaratPageFetchError && e.code === "INVALID_CONTENT_TYPE"
    );
  });

  it("throws INVALID_CONTENT_TYPE for application/octet-stream", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ contentType: "application/octet-stream" })
    );

    await expect(
      fetchJasaratPageImage({ date: "2026-08-22", edition: "karachi", page: 4 })
    ).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof JasaratPageFetchError && e.code === "INVALID_CONTENT_TYPE"
    );
  });
});

// ---------------------------------------------------------------------------
// Thumbnail redirect detection
// ---------------------------------------------------------------------------

describe("fetchJasaratPageImage — thumbnail redirect", () => {
  it("throws THUMBNAIL_RESPONSE when final URL contains /sliderpics/", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        url: "https://jasarat.news/epaper/images/dates/2026-08-22/karachi/mm/sliderpics/4.jpg",
      })
    );

    await expect(
      fetchJasaratPageImage({ date: "2026-08-22", edition: "karachi", page: 4 })
    ).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof JasaratPageFetchError && e.code === "THUMBNAIL_RESPONSE"
    );
  });
});

// ---------------------------------------------------------------------------
// Byte size safeguard
// ---------------------------------------------------------------------------

describe("fetchJasaratPageImage — minimum byte count", () => {
  it("throws IMAGE_TOO_SMALL for a small JPEG (< 100 KB)", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: makeSmallJpegBytes() })
    );

    await expect(
      fetchJasaratPageImage({ date: "2026-08-22", edition: "karachi", page: 4 })
    ).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof JasaratPageFetchError && e.code === "IMAGE_TOO_SMALL"
    );
  });
});

// ---------------------------------------------------------------------------
// JPEG signature validation
// ---------------------------------------------------------------------------

describe("fetchJasaratPageImage — JPEG signature", () => {
  it("throws INVALID_JPEG when bytes do not start with FF D8 FF", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: makeNonJpegBytes() })
    );

    await expect(
      fetchJasaratPageImage({ date: "2026-08-22", edition: "karachi", page: 4 })
    ).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof JasaratPageFetchError && e.code === "INVALID_JPEG"
    );
  });
});

// ---------------------------------------------------------------------------
// Network failure
// ---------------------------------------------------------------------------

describe("fetchJasaratPageImage — network failure", () => {
  it("throws NETWORK_ERROR when fetch rejects", async () => {
    const networkErr = new TypeError("fetch failed: connection refused");
    mockFetch.mockRejectedValueOnce(networkErr);

    await expect(
      fetchJasaratPageImage({ date: "2026-08-22", edition: "karachi", page: 4 })
    ).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof JasaratPageFetchError && e.code === "NETWORK_ERROR"
    );
  });

  it("NETWORK_ERROR preserves the original error as cause", async () => {
    const originalErr = new TypeError("fetch failed");
    mockFetch.mockRejectedValueOnce(originalErr);

    try {
      await fetchJasaratPageImage({ date: "2026-08-22", edition: "karachi", page: 4 });
    } catch (e) {
      expect(e).toBeInstanceOf(JasaratPageFetchError);
      const err = e as JasaratPageFetchError;
      expect(err.cause).toBe(originalErr);
    }
  });
});

// ---------------------------------------------------------------------------
// Invalid reference — must not call fetch
// ---------------------------------------------------------------------------

describe("fetchJasaratPageImage — invalid reference", () => {
  it("throws from URL validation without calling fetch for invalid date", async () => {
    await expect(
      fetchJasaratPageImage({ date: "2026-02-30", edition: "karachi", page: 4 })
    ).rejects.toThrow(/Invalid Jasarat date/i);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("throws from URL validation without calling fetch for page 0", async () => {
    await expect(
      fetchJasaratPageImage({ date: "2026-08-22", edition: "karachi", page: 0 })
    ).rejects.toThrow(/Invalid Jasarat page/i);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("throws from URL validation without calling fetch for negative page", async () => {
    await expect(
      fetchJasaratPageImage({ date: "2026-08-22", edition: "karachi", page: -1 })
    ).rejects.toThrow(/Invalid Jasarat page/i);

    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Regression: body-download error handling
// ---------------------------------------------------------------------------

describe("fetchJasaratPageImage — regression: arrayBuffer() failure", () => {
  it("throws NETWORK_ERROR when response.arrayBuffer() rejects", async () => {
    const bodyError = new TypeError("body read failed mid-stream");

    // Headers succeed (200 + image/jpeg), but body read throws.
    const failingResponse = {
      ok: true,
      status: 200,
      headers: new Headers({ "Content-Type": "image/jpeg" }),
      url: "https://jasarat.news/epaper/images/dates/2026-08-22/karachi/mm/4.jpg",
      arrayBuffer: async () => {
        throw bodyError;
      },
    } as unknown as Response;

    mockFetch.mockResolvedValueOnce(failingResponse);

    await expect(
      fetchJasaratPageImage({ date: "2026-08-22", edition: "karachi", page: 4 })
    ).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof JasaratPageFetchError && e.code === "NETWORK_ERROR"
    );
  });

  it("NETWORK_ERROR from arrayBuffer() preserves the original error as cause", async () => {
    const bodyError = new TypeError("body read failed mid-stream");

    const failingResponse = {
      ok: true,
      status: 200,
      headers: new Headers({ "Content-Type": "image/jpeg" }),
      url: "https://jasarat.news/epaper/images/dates/2026-08-22/karachi/mm/4.jpg",
      arrayBuffer: async () => {
        throw bodyError;
      },
    } as unknown as Response;

    mockFetch.mockResolvedValueOnce(failingResponse);

    try {
      await fetchJasaratPageImage({ date: "2026-08-22", edition: "karachi", page: 4 });
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(JasaratPageFetchError);
      const err = e as JasaratPageFetchError;
      expect(err.code).toBe("NETWORK_ERROR");
      expect(err.cause).toBe(bodyError);
    }
  });

  it("does not convert structured JasaratPageFetchErrors into NETWORK_ERROR", async () => {
    // Validation errors (INVALID_CONTENT_TYPE, IMAGE_TOO_SMALL, etc.) must
    // NOT be swallowed by a catch-all NETWORK_ERROR wrapper.
    mockFetch.mockResolvedValueOnce(
      mockResponse({ contentType: "text/html" })
    );

    await expect(
      fetchJasaratPageImage({ date: "2026-08-22", edition: "karachi", page: 4 })
    ).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof JasaratPageFetchError && e.code === "INVALID_CONTENT_TYPE"
    );
  });
});

// ---------------------------------------------------------------------------
// Regression: timeout covers the full operation (headers + body download)
// ---------------------------------------------------------------------------

describe("fetchJasaratPageImage — regression: timeout covers body download", () => {
  it("aborts and throws NETWORK_ERROR if the body download stalls past the timeout", async () => {
    vi.useFakeTimers();

    // fetch() resolves successfully (headers arrive), but arrayBuffer() stalls
    // indefinitely until the AbortController fires.
    const controller = { signal: null as unknown as AbortSignal };

    mockFetch.mockImplementationOnce(
      (_url: string | URL | Request, init?: RequestInit): Promise<Response> => {
        // Capture the signal so we can observe abort events
        if (init?.signal) {
          controller.signal = init.signal as AbortSignal;
        }
        // Headers arrive immediately
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "Content-Type": "image/jpeg" }),
          url: "https://jasarat.news/epaper/images/dates/2026-08-22/karachi/mm/4.jpg",
          arrayBuffer: (): Promise<ArrayBuffer> =>
            // This promise never resolves on its own — it only rejects when
            // the AbortController fires (simulating a stalled download).
            new Promise((_resolve, reject) => {
              // Poll for abort so the fake timer can drive the rejection.
              const check = () => {
                if (controller.signal?.aborted) {
                  reject(
                    new DOMException("The operation was aborted.", "AbortError")
                  );
                } else {
                  // Use setTimeout (macrotask) so vi.advanceTimersByTimeAsync
                  // can actually advance time. An infinite microtask loop
                  // starves the event loop.
                  setTimeout(check, 100);
                }
              };
              setTimeout(check, 100);
            }),
        } as unknown as Response);
      }
    );

    const fetchPromise = expect(
      fetchJasaratPageImage({
        date: "2026-08-22",
        edition: "karachi",
        page: 4,
      })
    ).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof JasaratPageFetchError && e.code === "NETWORK_ERROR"
    );

    // Advance fake time past the 20-second timeout
    await vi.advanceTimersByTimeAsync(20_001);

    await fetchPromise;

    vi.useRealTimers();
  });
});

