/**
 * jasaratPageFetcher.ts
 *
 * Server-side fetcher for Jasarat full-resolution newspaper page images.
 * Uses the canonical URL builder from jasaratUrlBuilder and validates the
 * response thoroughly before returning bytes.
 *
 * This module is pure Node.js/server infrastructure.
 * It has no React or browser-UI concerns.
 */

import { buildJasaratPageImageUrl } from "./jasaratUrlBuilder";
import {
  JasaratPageFetchError,
  type JasaratFetchedPageImage,
  type JasaratPageReference,
} from "./jasaratTypes";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Conservative minimum byte count for a full-resolution Jasarat page image.
 *
 * Evidence:
 *   Full page  ≈ 1,963,520 bytes
 *   Thumbnail  ≈    21,118 bytes
 *
 * 100 KB gives a safe barrier against accidentally accepting thumbnails or
 * truncated error responses.
 */
const MIN_JASARAT_PAGE_BYTES = 100_000;

/** Request timeout in milliseconds. */
const FETCH_TIMEOUT_MS = 20_000;

/** JPEG magic bytes: FF D8 FF */
const JPEG_MAGIC = [0xff, 0xd8, 0xff] as const;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Normalises a Content-Type header value to its bare MIME type by stripping
 * any optional parameter suffix (e.g. "; charset=utf-8").
 */
function normaliseMimeType(contentType: string): string {
  return contentType.split(";")[0].trim().toLowerCase();
}

/**
 * Returns true if the first three bytes of `bytes` are the JPEG magic header
 * FF D8 FF.
 */
function hasJpegSignature(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 3 &&
    bytes[0] === JPEG_MAGIC[0] &&
    bytes[1] === JPEG_MAGIC[1] &&
    bytes[2] === JPEG_MAGIC[2]
  );
}

// ---------------------------------------------------------------------------
// Public function
// ---------------------------------------------------------------------------

/**
 * Fetches and validates one full-resolution Jasarat newspaper page image.
 *
 * The reference is first validated by the canonical URL builder (existing
 * M1 Task 1 logic); if the reference is invalid, an error is thrown before
 * any HTTP request is made.
 *
 * On success, returns a {@link JasaratFetchedPageImage} with the raw bytes
 * held in memory. No file is written.
 *
 * @throws {@link JasaratPageFetchError} on any fetch or validation failure.
 * @throws The original URL-builder validation error for invalid references.
 */
export async function fetchJasaratPageImage(
  reference: JasaratPageReference
): Promise<JasaratFetchedPageImage> {
  // 1. Build (and implicitly validate) the canonical URL.
  //    If the reference is invalid, this throws before any network activity.
  const requestedUrl = buildJasaratPageImageUrl(reference);

  // 2. Set up a timeout via AbortController.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await fetch(requestedUrl, {
        signal: controller.signal,
        // Follow redirects automatically (default); we capture the final URL.
        redirect: "follow",
      });
    } catch (err) {
      throw new JasaratPageFetchError(
        "NETWORK_ERROR",
        `Jasarat page fetch failed (network/timeout): ${requestedUrl}`,
        requestedUrl,
        { cause: err }
      );
    }

    // 3. HTTP status check — before reading the body.
    if (!response.ok) {
      if (response.status === 404) {
        throw new JasaratPageFetchError(
          "NOT_FOUND",
          `Jasarat page not found (404): ${requestedUrl}`,
          requestedUrl,
          { status: 404 }
        );
      }
      throw new JasaratPageFetchError(
        "HTTP_ERROR",
        `Jasarat page request failed with HTTP ${response.status}: ${requestedUrl}`,
        requestedUrl,
        { status: response.status }
      );
    }

    // 4. Thumbnail redirect check — examine the final URL before reading body.
    const finalUrl = response.url || requestedUrl;
    if (finalUrl.includes("/sliderpics/")) {
      throw new JasaratPageFetchError(
        "THUMBNAIL_RESPONSE",
        `Jasarat response redirected to a thumbnail URL: ${finalUrl}`,
        requestedUrl
      );
    }

    // 5. Content-type validation.
    const rawContentType = response.headers.get("Content-Type") ?? "";
    const mimeType = normaliseMimeType(rawContentType);
    if (mimeType !== "image/jpeg") {
      throw new JasaratPageFetchError(
        "INVALID_CONTENT_TYPE",
        `Jasarat response has unexpected Content-Type "${rawContentType}" (expected image/jpeg): ${requestedUrl}`,
        requestedUrl
      );
    }

    // 6. Read the body.
    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await response.arrayBuffer();
    } catch (err) {
      throw new JasaratPageFetchError(
        "NETWORK_ERROR",
        `Jasarat page body download failed (network/timeout): ${requestedUrl}`,
        requestedUrl,
        { cause: err }
      );
    }
    const bytes = new Uint8Array(arrayBuffer);

    // 7. Minimum byte count safeguard.
    if (bytes.length < MIN_JASARAT_PAGE_BYTES) {
      throw new JasaratPageFetchError(
        "IMAGE_TOO_SMALL",
        `Jasarat page image is too small: got ${bytes.length} bytes, ` +
          `minimum is ${MIN_JASARAT_PAGE_BYTES}. This may be a thumbnail or error page: ${requestedUrl}`,
        requestedUrl
      );
    }

    // 8. JPEG magic byte check.
    if (!hasJpegSignature(bytes)) {
      throw new JasaratPageFetchError(
        "INVALID_JPEG",
        `Jasarat response does not begin with JPEG magic bytes (FF D8 FF): ${requestedUrl}`,
        requestedUrl
      );
    }

    // 9. All validations passed — return structured result.
    return {
      reference,
      requestedUrl,
      finalUrl,
      contentType: "image/jpeg",
      byteLength: bytes.length,
      bytes,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
