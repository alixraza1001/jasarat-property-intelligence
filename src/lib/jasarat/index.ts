/**
 * Public API for the Jasarat ePaper domain module.
 *
 * Import from this module (never from internal files directly):
 *
 *   import {
 *     buildJasaratPageImageUrl,
 *     buildJasaratViewerUrl,
 *     type JasaratPageReference,
 *   } from "@/lib/jasarat";
 */

export {
  buildJasaratPageImageUrl,
  buildJasaratViewerUrl,
} from "./jasaratUrlBuilder";

export type { JasaratEdition, JasaratPageReference } from "./jasaratTypes";
