/**
 * jasaratHistoricalManifest.ts
 *
 * Orchestrator for building a Jasarat historical acquisition manifest.
 */

import { buildJasaratViewerUrl } from "./jasaratUrlBuilder";
import { discoverJasaratEditionPages } from "./jasaratEditionDiscovery";
import { decrementJasaratDate } from "./jasaratDateUtils";
import {
  JasaratEditionDiscoveryError,
  type JasaratHistoricalManifestOptions,
  type JasaratHistoricalAcquisitionManifest,
  type JasaratAcquisitionManifestEntry,
} from "./jasaratTypes";

const MAX_BACKFILL_CALENDAR_DAYS = 30;

export async function buildJasaratHistoricalAcquisitionManifest(
  options: JasaratHistoricalManifestOptions
): Promise<JasaratHistoricalAcquisitionManifest> {
  const targetEditionCount = options.targetEditionCount ?? 7;

  if (targetEditionCount <= 0 || targetEditionCount > MAX_BACKFILL_CALENDAR_DAYS) {
    throw new Error(`Invalid targetEditionCount: must be between 1 and ${MAX_BACKFILL_CALENDAR_DAYS}.`);
  }

  // Validate the starting date via existing URL builder validation
  buildJasaratViewerUrl({ date: options.startDate, edition: options.edition, page: 1 });

  let currentDate = options.startDate;
  let successfulEditionCount = 0;
  let inspectedDateCount = 0;
  const entries: JasaratAcquisitionManifestEntry[] = [];

  while (
    successfulEditionCount < targetEditionCount &&
    inspectedDateCount < MAX_BACKFILL_CALENDAR_DAYS
  ) {
    inspectedDateCount++;

    try {
      const result = await discoverJasaratEditionPages({
        date: currentDate,
        edition: options.edition,
      });

      entries.push({
        date: currentDate,
        edition: options.edition,
        status: "COMPLETED",
        pageNumbers: result.pageNumbers,
        pageCount: result.pageCount,
        requestedUrl: result.requestedUrl,
        finalUrl: result.finalUrl,
      });

      successfulEditionCount++;
    } catch (err) {
      if (err instanceof JasaratEditionDiscoveryError) {
        if (err.code === "EDITION_NOT_FOUND") {
          entries.push({
            date: currentDate,
            edition: options.edition,
            status: "DATE_NOT_AVAILABLE",
            errorCode: "EDITION_NOT_FOUND",
          });
        } else {
          entries.push({
            date: currentDate,
            edition: options.edition,
            status: "RETRY_PENDING",
            errorCode: err.code,
            errorMessage: err.message,
          });
        }
      } else {
        // Fallback for non-discovery errors (unlikely, but safe)
        entries.push({
          date: currentDate,
          edition: options.edition,
          status: "RETRY_PENDING",
          errorCode: "NETWORK_ERROR",
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }
    }

    currentDate = decrementJasaratDate(currentDate);
  }

  return {
    startDate: options.startDate,
    edition: options.edition,
    targetEditionCount,
    successfulEditionCount,
    inspectedDateCount,
    targetReached: successfulEditionCount === targetEditionCount,
    entries,
  };
}
