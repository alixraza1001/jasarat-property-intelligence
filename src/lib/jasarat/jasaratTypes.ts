/**
 * Jasarat ePaper edition identifiers.
 * Only the Karachi edition is currently supported.
 */
export type JasaratEdition = "karachi";

/**
 * Identifies a specific page within a Jasarat ePaper edition.
 *
 * @property date    - Publication date in strict YYYY-MM-DD format.
 * @property edition - The Jasarat regional edition (currently only "karachi").
 * @property page    - Page number (1-indexed positive integer).
 */
export interface JasaratPageReference {
  date: string;
  edition: JasaratEdition;
  page: number;
}

// ---------------------------------------------------------------------------
// Fetcher result types
// ---------------------------------------------------------------------------

/**
 * A successfully fetched and validated Jasarat full-resolution page image.
 * The bytes are kept in memory; no file is written.
 */
export interface JasaratFetchedPageImage {
  /** The original requested page reference. */
  reference: JasaratPageReference;

  /** URL produced by buildJasaratPageImageUrl — what we requested. */
  requestedUrl: string;

  /** Final response URL after any HTTP redirects. */
  finalUrl: string;

  /** Validated MIME type. Always "image/jpeg" on success. */
  contentType: "image/jpeg";

  /** Actual downloaded byte count (not taken from Content-Length header). */
  byteLength: number;

  /** Raw image bytes in memory. */
  bytes: Uint8Array;
}

// ---------------------------------------------------------------------------
// Fetcher error types
// ---------------------------------------------------------------------------

/**
 * Discriminant for all JasaratPageFetchError instances.
 *
 * NOT_FOUND          - HTTP 404; the page does not exist in this edition.
 * HTTP_ERROR         - Any other non-2xx HTTP status.
 * NETWORK_ERROR      - Fetch threw (timeout, DNS, TCP reset, etc.).
 * INVALID_CONTENT_TYPE - Response MIME type is not image/jpeg.
 * THUMBNAIL_RESPONSE - Final URL contains /sliderpics/ (redirect to thumbnail).
 * IMAGE_TOO_SMALL    - Downloaded byte count is below the minimum safeguard.
 * INVALID_JPEG       - Bytes do not begin with the JPEG magic bytes FF D8 FF.
 */
export type JasaratPageFetchErrorCode =
  | "NOT_FOUND"
  | "HTTP_ERROR"
  | "NETWORK_ERROR"
  | "INVALID_CONTENT_TYPE"
  | "THUMBNAIL_RESPONSE"
  | "IMAGE_TOO_SMALL"
  | "INVALID_JPEG";

/**
 * Thrown by fetchJasaratPageImage on any failure.
 * Callers can switch on `error.code` to distinguish cases without
 * parsing the human-readable message.
 */
export class JasaratPageFetchError extends Error {
  readonly code: JasaratPageFetchErrorCode;
  /** The URL that was requested (or attempted). */
  readonly url: string;
  /** HTTP status code, when available. */
  readonly status?: number;

  constructor(
    code: JasaratPageFetchErrorCode,
    message: string,
    url: string,
    options?: { status?: number; cause?: unknown }
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "JasaratPageFetchError";
    this.code = code;
    this.url = url;
    this.status = options?.status;
  }
}

// ---------------------------------------------------------------------------
// Edition Discovery types
// ---------------------------------------------------------------------------

/**
 * Identifies a whole Jasarat ePaper edition (without a specific page number).
 */
export interface JasaratEditionReference {
  date: string;
  edition: JasaratEdition;
}

/**
 * The structured result of a successful edition page discovery.
 */
export interface JasaratEditionDiscoveryResult {
  reference: JasaratEditionReference;
  /** The requested canonical viewer URL for page 1. */
  requestedUrl: string;
  /** The final URL after any harmless redirects. */
  finalUrl: string;
  /** Unique, numerically sorted, positive integer page numbers discovered. */
  pageNumbers: number[];
  /** The total number of pages discovered (equivalent to pageNumbers.length). */
  pageCount: number;
}

/**
 * Discriminant for all JasaratEditionDiscoveryError instances.
 */
export type JasaratEditionDiscoveryErrorCode =
  | "EDITION_NOT_FOUND"
  | "HTTP_ERROR"
  | "NETWORK_ERROR"
  | "INVALID_CONTENT_TYPE"
  | "UNEXPECTED_REDIRECT"
  | "PAGE_LIST_NOT_FOUND"
  | "PAGE_LIMIT_EXCEEDED";

/**
 * Thrown by discoverJasaratEditionPages on any discovery failure.
 */
export class JasaratEditionDiscoveryError extends Error {
  readonly code: JasaratEditionDiscoveryErrorCode;
  readonly url: string;
  readonly status?: number;

  constructor(
    code: JasaratEditionDiscoveryErrorCode,
    message: string,
    url: string,
    options?: { status?: number; cause?: unknown }
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "JasaratEditionDiscoveryError";
    this.code = code;
    this.url = url;
    this.status = options?.status;
  }
}
