/**
 * jasaratEditionDiscovery.ts
 *
 * Lightweight Jasarat ePaper edition discovery.
 * Fetches the viewer HTML for a given date/edition and extracts all available
 * page numbers. Does NOT download any high-resolution images.
 */

import { buildJasaratViewerUrl } from "./jasaratUrlBuilder";
import {
  JasaratEditionDiscoveryError,
  type JasaratEditionReference,
  type JasaratEditionDiscoveryResult,
} from "./jasaratTypes";

const FETCH_TIMEOUT_MS = 20_000;
const MAX_JASARAT_EDITION_PAGES = 40;

/**
 * Normalises a Content-Type header value.
 */
function normaliseMimeType(contentType: string): string {
  return contentType.split(";")[0].trim().toLowerCase();
}

/**
 * Extracts anchor hrefs from an HTML string using a lightweight RegExp.
 * Handles single and double quotes.
 */
function extractAnchorHrefs(html: string): string[] {
  const hrefs: string[] = [];
  // Matches <a ... href="URL" ...> or <a ... href='URL' ...>
  // using a non-greedy wildcard for attributes before and after href.
  const regex = /<a\s+[^>]*href=(["'])(.*?)\1[^>]*>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    if (match[2]) {
      hrefs.push(match[2]);
    }
  }
  return hrefs;
}

/**
 * Discovers available page numbers for a Jasarat edition by reading the viewer HTML.
 */
export async function discoverJasaratEditionPages(
  reference: JasaratEditionReference
): Promise<JasaratEditionDiscoveryResult> {
  // Construct a canonical reference to Page 1 of the edition.
  const page1Reference = {
    date: reference.date,
    edition: reference.edition,
    page: 1,
  };

  // buildJasaratViewerUrl implicitly validates the date calendar semantics.
  // Throws standard URL builder validation errors if invalid.
  const requestedUrl = buildJasaratViewerUrl(page1Reference);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await fetch(requestedUrl, {
        signal: controller.signal,
        redirect: "follow",
      });
    } catch (err) {
      throw new JasaratEditionDiscoveryError(
        "NETWORK_ERROR",
        `Edition discovery fetch failed: ${requestedUrl}`,
        requestedUrl,
        { cause: err }
      );
    }

    if (!response.ok) {
      if (response.status === 404) {
        throw new JasaratEditionDiscoveryError(
          "EDITION_NOT_FOUND",
          `Edition not found (404): ${requestedUrl}`,
          requestedUrl,
          { status: 404 }
        );
      }
      throw new JasaratEditionDiscoveryError(
        "HTTP_ERROR",
        `Edition discovery HTTP ${response.status}: ${requestedUrl}`,
        requestedUrl,
        { status: response.status }
      );
    }

    // Verify content type
    const rawContentType = response.headers.get("Content-Type") ?? "";
    const mimeType = normaliseMimeType(rawContentType);
    if (mimeType !== "text/html") {
      throw new JasaratEditionDiscoveryError(
        "INVALID_CONTENT_TYPE",
        `Discovery expects text/html, got ${rawContentType}: ${requestedUrl}`,
        requestedUrl
      );
    }

    const finalUrl = response.url || requestedUrl;
    
    // Validate that any redirect hasn't unexpectedly changed the date or edition.
    // The pathname must still start with /epaper/YYYY/MM/DD/edition/
    const datePath = reference.date.replace(/-/g, "/"); // YYYY-MM-DD -> YYYY/MM/DD
    const expectedPathPrefix = `/epaper/${datePath}/${reference.edition}/`;
    
    let finalUrlObj: URL;
    try {
      finalUrlObj = new URL(finalUrl);
    } catch {
      // Unlikely, but safety fallback.
      throw new JasaratEditionDiscoveryError("UNEXPECTED_REDIRECT", `Invalid final URL`, requestedUrl);
    }

    if (!finalUrlObj.pathname.startsWith(expectedPathPrefix)) {
      throw new JasaratEditionDiscoveryError(
        "UNEXPECTED_REDIRECT",
        `Unexpected redirect to different date/edition: ${finalUrl}`,
        requestedUrl
      );
    }

    let html: string;
    try {
      html = await response.text();
    } catch (err) {
      throw new JasaratEditionDiscoveryError(
        "NETWORK_ERROR",
        `Edition discovery body read failed: ${requestedUrl}`,
        requestedUrl,
        { cause: err }
      );
    }

    // Parse links
    const hrefs = extractAnchorHrefs(html);
    const discoveredPages = new Set<number>();

    // We use expectedPathPrefix + "{page}" to match exactly.
    // Ensure we don't accidentally match something with query params if we parse path incorrectly,
    // URL parsing handles it securely.
    for (const href of hrefs) {
      try {
        const urlObj = new URL(href, finalUrlObj); // Resolve relative to finalURL
        const pathname = urlObj.pathname;
        
        if (pathname.startsWith(expectedPathPrefix)) {
          // Extract the remainder after the prefix
          const remainder = pathname.slice(expectedPathPrefix.length);
          
          // Must be exactly one or more digits with no trailing slash/text.
          if (/^\d+$/.test(remainder)) {
            const pageNum = parseInt(remainder, 10);
            if (pageNum > 0) {
              discoveredPages.add(pageNum);
            }
          }
        }
      } catch {
        // Ignore malformed hrefs
      }
    }

    if (discoveredPages.size === 0) {
      throw new JasaratEditionDiscoveryError(
        "PAGE_LIST_NOT_FOUND",
        `No edition page links found in viewer HTML: ${requestedUrl}`,
        requestedUrl
      );
    }

    if (!discoveredPages.has(1)) {
      throw new JasaratEditionDiscoveryError(
        "PAGE_LIST_NOT_FOUND",
        `Page 1 is unexpectedly absent from the edition: ${requestedUrl}`,
        requestedUrl
      );
    }

    // The safety ceiling check
    const pageNumbers = Array.from(discoveredPages).sort((a, b) => a - b);
    const maxPageFound = pageNumbers[pageNumbers.length - 1];

    if (pageNumbers.length > MAX_JASARAT_EDITION_PAGES || maxPageFound > MAX_JASARAT_EDITION_PAGES) {
      throw new JasaratEditionDiscoveryError(
        "PAGE_LIMIT_EXCEEDED",
        `Edition exceeds safe page limit (${MAX_JASARAT_EDITION_PAGES}): ${requestedUrl}`,
        requestedUrl
      );
    }

    return {
      reference,
      requestedUrl,
      finalUrl,
      pageNumbers,
      pageCount: pageNumbers.length,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
