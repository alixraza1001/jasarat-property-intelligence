/**
 * Server-side public API for the Jasarat domain module.
 *
 * Import server/fetch functionality from this entry point:
 *
 *   import {
 *     fetchJasaratPageImage,
 *     JasaratPageFetchError,
 *     type JasaratFetchedPageImage,
 *     type JasaratPageFetchErrorCode,
 *   } from "@/lib/jasarat/server";
 *
 * URL-building utilities (safe to use anywhere) remain in "@/lib/jasarat".
 */

export { fetchJasaratPageImage } from "./jasaratPageFetcher";
export { discoverJasaratEditionPages } from "./jasaratEditionDiscovery";

export {
  JasaratPageFetchError,
  JasaratEditionDiscoveryError,
  type JasaratFetchedPageImage,
  type JasaratPageFetchErrorCode,
  type JasaratEditionDiscoveryResult,
  type JasaratEditionDiscoveryErrorCode,
} from "./jasaratTypes";
