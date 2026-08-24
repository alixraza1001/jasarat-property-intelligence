# Section 1 — AI Understanding & Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Spec Reference:** `docs/superpowers/specs/2026-08-24-section1-ai-understanding-extraction-design.md`

## Checkpoint 1 — Extraction Domain & Validation Contract
- [ ] Define canonical domain types (Property, Transaction, Source, Confidence) in `src/lib/jasarat/ai/domain.ts`.
- [ ] Ensure CNIC properties are explicitly omitted.
- [ ] Define Zod schemas in `src/lib/jasarat/ai/schemas.ts` for strict runtime validation.
- [ ] Write unit tests verifying validation failures, missing fields, and successful parsing.

## Checkpoint 2 — Benchmark Fixtures & Ground-Truth Format
- [ ] Create `scripts/fetch-benchmark-fixtures.ts` to selectively download high-res Jasarat images using the M1 `fetchJasaratPageImage` tool into a `.gitignored` `.fixtures/` directory.
- [ ] Define the `BenchmarkCase` type (expected classification, transaction count, fields).
- [ ] Create `src/lib/jasarat/ai/fixtures.ts` containing the metadata for 20-40 annotated cases. Include positive cases and hard negatives (promotional ads).

## Checkpoint 3 — Provider-Neutral AI Gateway
- [ ] Define `ProviderModelInterface` in `src/lib/jasarat/ai/provider.ts`.
- [ ] Implement normalized provider error taxonomy (e.g., `AUTH_ERROR`, `RATE_LIMITED`).
- [ ] Create an OmniRoute-compatible provider adapter using native fetch. Ensure API keys are loaded securely from `process.env`.
- [ ] Write tests using mocks to verify error taxonomy mapping.

## Checkpoint 4 — Model Candidate Discovery & Evaluation Harness
- [ ] Implement model candidate discovery: inspect current free-tier catalog, verify vision capability, and select explicit benchmarking targets.
- [ ] Create `scripts/evaluate-models.ts`.
- [ ] Implement logic to run all benchmark cases against the explicitly selected model targets (do not score `model:auto` as a stable target).
- [ ] Capture raw responses, validation results, and latency into machine-readable output.

## Checkpoint 5 — Page/Region Semantic Understanding
- [ ] Define prompts for relevance and region blocking (`v1_relevance`).
- [ ] Implement `classifyPageRelevance()` function (Single-pass or hybrid depending on Decision A).
- [ ] Write unit tests with mocked AI responses to test `RELEVANT`, `NOT_RELEVANT`, and `UNCERTAIN` routing.

## Checkpoint 6 — Transaction vs Promotion Classification
- [ ] Define prompts for semantic classification (`v1_classification`).
- [ ] Implement `classifyNotice()` handling `GENUINE_TRANSACTION_NOTICE` vs `PROMOTIONAL_ADVERTISEMENT`.
- [ ] Write unit tests verifying uncertain behavior and rejection of purely promotional verbs.

## Checkpoint 7 — Structured Transaction Extraction
- [ ] Define prompts for transaction extraction (`v1_extraction`).
- [ ] Implement `extractTransactions()` handling multi-transaction splitting.
- [ ] Write tests ensuring missing fields are `null` and not hallucinated.

## Checkpoint 8 — Normalization & Confidence
- [ ] Implement `normalizeTransaction()` in `src/lib/jasarat/ai/normalization.ts`.
- [ ] Write unit tests for society equivalents, plot preservation, and size canonicalization.
- [ ] Implement separate deterministic `computeClassificationConfidence()` and `computeExtractionConfidence()` scoring logic based on evidence strength, ambiguity, and validation warnings.
- [ ] Write unit tests for confidence scoring, ensuring correctly absent optional fields do not lower confidence.

## Checkpoint 9 — Benchmark Scoring & Model Comparison
- [ ] Implement scoring logic in the evaluation harness.
- [ ] Compute precision, recall, false-positive rate, field-level accuracy, and schema-valid response rate.
- [ ] Generate markdown summary report.

## Checkpoint 10 — Final Orchestration Integration
- [ ] Implement `extractJasaratPropertyIntelligence()` tying together all previous checkpoints into a single pipeline.
- [ ] Export public interface via `src/lib/jasarat/server.ts`.
- [ ] Write integration unit tests (mocked AI).
- [ ] Create opt-in live test `extractJasaratPropertyIntelligence.live.test.ts` gated by `JASARAT_AI_LIVE_TEST=1`.
- [ ] Run full `pnpm test`, `lint`, `typecheck`, and `build` pipeline.
