# Section 1 — AI Understanding & Extraction Design Spec

## 1. Canonical Extraction Domain Contract

The core contract defines structured candidates decoupled from any specific AI provider. A single Jasarat notice may yield multiple transaction candidates.

\`\`\`typescript
export type PropertyTransactionType = "SALE" | "PURCHASE" | "TRANSFER" | "LEASE" | "OTHER" | "UNKNOWN";
export type PropertyCategory = "RESIDENTIAL" | "COMMERCIAL" | "UNKNOWN";
export type PlotSizeUnit = "SQ_YD" | "SQ_FT" | "MARLA" | "KANAL" | "UNKNOWN";
export type PlotSizeSource = "DIRECT" | "INFERRED" | "UNKNOWN";

export interface PlotSize {
  value: number | null;
  unit: PlotSizeUnit;
  source: PlotSizeSource;
}

export interface JasaratSourceProvenance {
  newspaper: "JASARAT";
  edition: string;
  date: string; // YYYY-MM-DD
  pageNumber: number;
  blockId?: string;
  rawText: string;
  regionBounds?: { x: number; y: number; width: number; height: number }; // Optional for later CV integration
}

export interface EstateContactInfo {
  estateName: string | null;
  phoneNumbers: string[]; // Strict strings, no numeric transformation
  contactPerson: string | null;
}

export interface PropertyDetails {
  societyName: string | null;
  schemeName: string | null; // Distinct from society if explicitly mentioned
  sector: string | null;
  block: string | null;
  plotNumber: string | null; // Strict string (e.g., "R-147")
  propertyCategory: PropertyCategory;
  plotSize: PlotSize;
}

export interface TransactionDetails {
  transactionType: PropertyTransactionType;
  transactionDate: string | null;
  price: number | null;
  buyerName: string | null;
  sellerName: string | null;
  extraDetails: string | null;
}

export interface ExtractionConfidence {
  classificationConfidence: number; // 0-100
  extractionConfidence: number;     // 0-100
  warnings: string[];
  uncertainFields: string[];
  requiresReview: boolean;
}

export interface JasaratTransactionCandidate {
  source: JasaratSourceProvenance;
  estate: EstateContactInfo;
  property: PropertyDetails;
  transaction: TransactionDetails;
  confidence: ExtractionConfidence;
}
\`\`\`
*Note: CNIC values are explicitly excluded from this normal structured/searchable schema. The original newspaper image naturally remains source evidence. The architecture ensures any future textual provenance/storage can support masking/protected handling, but Section 1 does not solve the protected-storage problem.*

## 2. Benchmark Dataset & Ground Truth
**Decision B (Image Storage):** Images will NOT be committed to git. Instead, a `fixtures.json` file will store metadata (date, edition, page) alongside expected JSON outputs. A new offline script `scripts/fetch-benchmark-fixtures.ts` will use the existing M1 `fetchJasaratPageImage` to download required JPEGs into a `.gitignored` `.fixtures/` directory before running the benchmark suite.

**Ground-Truth Format:**
The format explicitly distinguishes:
- Expected concrete value.
- Expected absent/null (the field genuinely does not exist in the source notice).
- Unscorable source (source is illegible/ambiguous).

The dataset will contain 20-40 cases, categorizing:
- **Positives:** Single transaction, multi-transaction under one estate, mixed Urdu/English.
- **Hard Negatives:** Promotional ads ("buying and selling"), booking/investment ads, unrelated news.

## 3. Provider Abstraction
**Decision C (Schema Mapping):** The application will define a `ProviderModelInterface`. An OmniRoute-compatible provider adapter using native fetch will be created. External JSON schemas will be passed to the provider. The raw output is validated via Zod, then deterministically mapped to the Canonical Domain Contract. This isolates provider hallucination from business logic.

## 4. Model Candidate Discovery & Evaluation Harness
At benchmark execution time, the script will:
1. Inspect the current OmniRoute/free-provider catalog.
2. Identify current vision-capable candidates.
3. Verify each candidate actually accepts required image input.
4. Select a small explicit benchmark shortlist.
5. Record the exact provider + model ID + benchmark date.
A script `pnpm run eval:models` will process the `.fixtures/` dataset against selected models (explicit targets, not opaque `model:auto`). It will output machine-readable NDJSON and a human-readable markdown summary, capturing latencies, provider failures, and correctness scores.

## 5. Page Relevance Classification
Before expensive extraction, pages are classified: `RELEVANT_PROPERTY_CONTENT`, `NOT_RELEVANT`, or `UNCERTAIN`.
*Rule:* False negatives are catastrophic. `UNCERTAIN` always falls back to full processing.

## 6. Region / Notice Understanding
**Decision D (Region Detection):** Initially, rely on logical model-driven blocking (asking the multimodal LLM to output an array of distinct notices). Introducing OpenCV or deterministic cropping is deferred unless benchmark evidence proves logical blocking fails. Region coordinates are optional in the schema.

## 7. Semantic Classification (Transaction vs Promotion)
Classification categories: `GENUINE_TRANSACTION_NOTICE`, `PROMOTIONAL_ADVERTISEMENT`, `UNRELATED_CONTENT`, `UNCERTAIN`.
*Rule:* Verbs alone do not define a transaction. "We buy and sell" = `PROMOTIONAL_ADVERTISEMENT`. `UNCERTAIN` is preferred over hallucinating a transaction.

## 8. Structured Extraction
Extracts zero, one, or many transactions per classified region. Missing values remain `null`. 

## 9. Deterministic Normalization
Runs *after* AI extraction.
- **Society:** Maps known variants (e.g., "اسکیم 33" -> "Scheme 33").
- **Size:** Standardizes "sq yd" / "گز" -> `SQ_YD`.
- **Plot:** Preserved destructively (no stripping characters).

## 10. Validation & Error Handling
Raw JSON is untrusted. **Zod** is the only approved schema library and will be used for: provider-facing structured response parsing, canonical extraction validation where appropriate, and benchmark fixture validation. If validation fails, a structured `JasaratAIValidationError` is returned. Provider errors (timeout, rate limit) map to a normalized taxonomy (`RATE_LIMITED`, `PROVIDER_UNAVAILABLE`, etc.).

## 11. Confidence Strategy
**Decision E (Confidence Scoring):** We do not trust model self-reported confidence. Two completely separate scores (`classificationConfidence` and `extractionConfidence`) are computed deterministically.
- A genuinely absent optional field is not an extraction error and will NOT lower confidence.
- The result will explicitly distinguish "field is not present in source" from "field appears present but could not be read confidently" (via `uncertainFields[]` and `warnings[]`).
- Confidence is calibrated around: ambiguity, conflicting classification cues, readability of extracted values, validation warnings, contradictory values, and numeric ambiguity.
- Provisional thresholds (`< 75` = Review Required, `75 - 89` = Review Recommended, `>= 90` = High Confidence) will be recalibrated from benchmark evidence.

## 12. Benchmark Scoring
Measures:
- **Precision / Recall:** For genuine notices.
- **False-Positive Rate:** Promotional ads incorrectly flagged as transactions.
- **Field Accuracy:** Exact match for plot/phone; normalized match for society/size. Must distinguish: true extracted value, correct null, missed expected value, hallucinated value, incorrect value, unscorable field.

## 13. Model Candidate Discovery & Architecture Strategy
**Decision F (Model Candidates):**
We prioritize free/low-cost constraints. We will not freeze a shortlist of models. Instead, we use a Model Candidate Discovery step (see Section 4) at benchmark time to select models dynamically.

**Decision A (Architecture):** Evaluate a **Single-Pass Multimodal** approach first as an experimental hypothesis because it is cheaper and simpler. It is not a frozen production decision. If the benchmark evidence demonstrates problems with false positives, multi-transaction separation, or structured-output reliability, we will fallback to the next experiment: a **Hybrid** pipeline (Relevance -> Targeted Extraction).

## 14. Section 1 Orchestration API
\`\`\`typescript
export async function extractJasaratPropertyIntelligence(
  pageImageBytes: Uint8Array,
  provenance: { date: string, edition: string, pageNumber: number }
): Promise<JasaratIntelligenceResult>
\`\`\`

## 15. Prompt & Version Management
Prompts are isolated in `src/lib/jasarat/ai/prompts/` and versioned (e.g., `v1_relevance`, `v1_extraction`). 

## 16. Security
All provider credentials exist strictly in `process.env`. No exposure to client bundles. Provider exceptions are sanitized to avoid leaking API keys in error messages.

## 17. Testing
All deterministic logic (normalization, validation, confidence scoring) will be fully tested using offline mocks (`pnpm test`). Live AI calls will be gated behind `JASARAT_AI_LIVE_TEST=1`.
