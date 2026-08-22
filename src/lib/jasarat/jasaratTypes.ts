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
