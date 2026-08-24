# Section 1 — AI Understanding & Extraction Design Spec

## 1. Canonical Extraction Domain Contract

The core contract defines structured candidates decoupled from any specific AI provider. It reuses existing M1 types (`JasaratPageReference`) to avoid redefining the domain.

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
  classificationConfidence: number; // 0-100 (heuristic, not calibrated probability)
  extractionConfidence: number;     // 0-100 (heuristic, not calibrated probability)
  warnings: string[];
  uncertainFields: string[];
  requiresReview: boolean;
}

export interface JasaratTransactionCandidate {
  sourceBlockId?: string;
  rawText: string | null; // Nullable to prevent forced hallucination
  regionBounds?: { x: number; y: number; width: number; height: number };
  estate: EstateContactInfo;
  property: PropertyDetails;
  transaction: TransactionDetails;
  confidence: ExtractionConfidence;
}

export interface JasaratIntelligenceResult {
  source: JasaratPageReference;
  pageClassification: {
    label: "RELEVANT_PROPERTY_CONTENT" | "NOT_RELEVANT" | "UNCERTAIN";
  };
  candidates: JasaratTransactionCandidate[];
  executionMetadata: {
    provider: string;
    model: string;
    promptVersion: string;
    schemaVersion: string;
    durationMs: number;
  };
}
\`\`\`
*Note: CNIC values are explicitly excluded from this normal structured/searchable schema. The original newspaper image naturally remains source evidence. The architecture ensures any future textual provenance/storage can support masking/protected handling, but Section 1 does not solve the protected-storage problem.*

## 2. Benchmark Dataset & Ground Truth
**Decision B (Image Storage):** Images will NOT be committed to git. Benchmark metadata is stored in `benchmarks/jasarat/manifest.json`. A script `scripts/fetch-jasarat-fixtures.ts` downloads required JPEGs into `.fixtures/jasarat/*.jpg`. JSON ground truth is stored in `benchmarks/jasarat/expected/*.json` and validated by Zod.

**Founder-Reviewed Ground-Truth Gate:**
Benchmark execution MUST NOT proceed on unverified data. Antigravity drafts initial annotations, but model evaluation is blocked until explicit founder approval of all ground-truth JSON files.

**Ground-Truth Format & Field States:**
The format explicitly distinguishes three states for field scoring:
- `VALUE`: Expected concrete value.
- `ABSENT`: Expected absent/null (the field genuinely does not exist in the source notice).
- `UNSCORABLE`: Source is illegible/ambiguous.

The dataset will contain 20-40 cases, categorizing positive and hard negative (promotional) cases.

## 3. Provider Abstraction
**Decision C (Schema Mapping):** The application will define a `ProviderModelInterface`. An OmniRoute-compatible provider adapter using native fetch will be created. External JSON schemas will be passed to the provider. The raw output is validated via Zod, then deterministically mapped to the Canonical Domain Contract. This isolates provider hallucination from business logic.

## 4. Model Candidate Discovery & Evaluation Harness
Model discovery is separated from execution. `scripts/discover-models.ts` queries the catalog and writes a frozen `benchmarks/jasarat/targets.json`.
A script `scripts/evaluate-models.ts` processes the `.fixtures/` dataset against these explicit models (not opaque `model:auto`).
Every benchmark run will record: run ID, timestamp, gateway, requested provider/model, resolved provider/model, prompt version, schema version, and dataset version.

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
- **Size:** Canonicalizes explicitly observed sizes ("sq yd" / "گز" -> `SQ_YD`). Do not introduce plot-letter size inference or society-specific inference in Section 1.
- **Plot:** Preserved destructively (no stripping characters).
- **Phone:** Preserves meaningful formatting but must never invent or remove meaningful digits.
- **Transaction:** Normalizes to enum, but must never convert promotional wording into a transaction.

## 10. Validation & Error Handling
Raw JSON is untrusted. **Zod** is the only approved schema library and will be used for: provider-facing structured response parsing, canonical extraction validation where appropriate, and benchmark fixture validation.
- Operational, provider, or validation failures result in a **typed thrown error** (e.g., `ProviderRateLimitError`, `JasaratAIValidationError`), not a returned error object.
- Never convert malformed model output, provider failures, or unexpected programming errors into an apparently valid empty extraction.

## 11. Confidence Strategy
**Decision E (Confidence Scoring):** We do not trust model self-reported confidence. Two completely separate heuristic scores (`classificationConfidence` and `extractionConfidence`) are computed deterministically. They are not calibrated probabilities.
- A genuinely absent optional field is not an extraction error and will NOT lower confidence.
- The result will explicitly distinguish "field is not present in source" from "field appears present but could not be read confidently" (via `uncertainFields[]` and `warnings[]`).
- `requiresReview` is deterministic: `true` if classification is `UNCERTAIN`, either score is below the automatic threshold, or important warnings require verification.

## 12. Benchmark Scoring & Multi-Transaction Matching
Measures:
- **Precision / Recall:** For genuine notices.
- **False-Positive Rate:** Promotional ads incorrectly flagged as transactions.
- **Multi-Transaction Matching:** Before scoring, predicted candidates are matched to expected candidates using a deterministic strategy based on strong normalized identifiers (plot number, society, sector, transaction type).
- **Field Accuracy:** Must distinguish: true extracted value, correct null, missed expected value, hallucinated value, incorrect value, unscorable field.

## 13. Model Candidate Discovery & Architecture Strategy
**Decision F (Model Candidates):**
We prioritize free/low-cost constraints. We will not freeze a shortlist of models. Instead, we use a Model Candidate Discovery step (see Section 4) at benchmark time to select models dynamically.

**Decision A (Architecture):** The **first implementation experiment is a Single-Pass Multimodal** architecture. The first provider-facing analysis will conceptually accept the Jasarat page image and source provenance, and return one provider-facing structured analysis containing relevance, logical notices, semantic classifications, and zero/many extractions. Pure deterministic modules will independently perform validation, canonical mapping, normalization, and confidence computation. A **Hybrid** pipeline (Relevance -> Targeted Extraction) remains the explicitly documented second experiment, implemented only if benchmark evidence demonstrates single-pass is insufficient.

## 14. Section 1 Orchestration API
\`\`\`typescript
export async function extractJasaratPropertyIntelligence(
  pageImageBytes: Uint8Array,
  provenance: JasaratPageReference
): Promise<JasaratIntelligenceResult>
\`\`\`

## 15. Testing & Network Safety
- **Unit Tests:** All deterministic logic (`pnpm test`) runs fully offline.
- **Live Gates:** Fixture acquisition and AI benchmark scripts are networked, opt-in operations explicitly gated by `JASARAT_AI_LIVE_TEST=1` to prevent accidental quota consumption or Jasarat hits during normal regression testing.

## 16. Prompt & Version Management
Prompts are isolated in `src/lib/jasarat/ai/prompts/` and versioned (e.g., `v1_single_pass`).

## 17. Security
All provider credentials exist strictly in `process.env`. No exposure to client bundles. Provider exceptions are sanitized to avoid leaking API keys in error messages.
