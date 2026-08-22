/**
 * Public API for the Jasarat ePaper domain module.
 *
 * URL building (safe to use anywhere — no server-side imports):
 *
 *   import {
 *     buildJasaratPageImageUrl,
 *     buildJasaratViewerUrl,
 *     type JasaratPageReference,
 *   } from "@/lib/jasarat";
 *
 * Server-side fetching (Node.js / server only):
 *
 *   import {
 *     fetchJasaratPageImage,
 *     JasaratPageFetchError,
 *     type JasaratFetchedPageImage,
 *     type JasaratPageFetchErrorCode,
 *   } from "@/lib/jasarat/server";
 */

export {
  buildJasaratPageImageUrl,
  buildJasaratViewerUrl,
} from "./jasaratUrlBuilder";

export type {
  JasaratEdition,
  JasaratPageReference,
  // Fetcher result/error types — exported here for convenience so callers
  // that only need the types (not the runtime fetch function) don't need to
  // import from the server entry point.
  JasaratFetchedPageImage,
  JasaratPageFetchErrorCode,
} from "./jasaratTypes";

// JasaratPageFetchError is a class (runtime value), so it is not re-exported
// here. Import it from "@/lib/jasarat/server" alongside fetchJasaratPageImage.
