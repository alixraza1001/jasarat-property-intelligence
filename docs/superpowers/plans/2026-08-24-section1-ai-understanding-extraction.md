# Section 1 — AI Understanding & Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Spec Reference:** `docs/superpowers/specs/2026-08-24-section1-ai-understanding-extraction-design.md`

## Checkpoint 1 — Canonical domain + Zod contracts
**Files:** `src/lib/jasarat/ai/domain.ts`, `src/lib/jasarat/ai/schemas.ts`, `src/lib/jasarat/ai/schemas.test.ts`
**Interfaces Produced:** `PropertyTransactionType`, `PropertyCategory`, `JasaratIntelligenceResult` (complete result contract reusing M1 `JasaratEdition`, `JasaratPageReference`), and all sub-types. Zod schemas for all types.
**RED tests to write:** Test parsing invalid JSON, extracting null fields, rejecting hallucinated Enums, validating the `JasaratIntelligenceResult` structure.
**RED command:** `pnpm test jasarat/ai/schemas.test`
**Expected failure:** Zod schemas are missing or undefined.
**Implementation:** Define all types. Ensure `rawText: string | null` is nullable. Define Zod schemas enforcing the contract.
**GREEN command:** `pnpm test jasarat/ai/schemas.test`
**Commit:** `feat: define AI extraction domain and Zod contracts`

## Checkpoint 2 — Benchmark schema + fixture acquisition tooling
**Files:** `benchmarks/jasarat/types.ts`, `scripts/fetch-jasarat-fixtures.ts`, `benchmarks/jasarat/manifest.json`
**Interfaces Consumed:** M1 `fetchJasaratPageImage`
**Interfaces Produced:** `BenchmarkCase` type, `BenchmarkManifest`
**RED tests to write:** N/A (Script logic).
**Implementation:** Create `manifest.json` defining test cases (metadata). Create `scripts/fetch-jasarat-fixtures.ts` to download images to `.gitignored` `.fixtures/jasarat/*.jpg`. Use Zod to parse `manifest.json`.
**Commit:** `test: add Jasarat benchmark schema and acquisition tooling`

## Checkpoint 3 — Founder-reviewed benchmark ground-truth gate
**Files:** `benchmarks/jasarat/expected/*.json`
**Implementation:** Run fixture fetcher. Draft ground-truth JSON files for 20-40 cases defining expected VALUE, ABSENT, or UNSCORABLE fields.
**Gate:** STOP and request founder review of all ground-truth JSON annotations. Do not proceed until approved.
**Commit:** `test: add approved benchmark ground truth`

## Checkpoint 4 — Provider-neutral OmniRoute adapter + errors
**Files:** `src/lib/jasarat/ai/provider.ts`, `src/lib/jasarat/ai/provider.test.ts`
**Interfaces Produced:** `ProviderModelInterface`, normalized error classes (e.g., `ProviderRateLimitError`, `JasaratAIValidationError`).
**RED tests to write:** Test error throwing on failed fetch, timeout, and malformed JSON.
**RED command:** `pnpm test jasarat/ai/provider.test`
**Expected failure:** Adapter throws generic errors instead of typed taxonomy.
**Implementation:** Implement native `fetch` against OmniRoute. Map HTTP codes/failures to typed thrown errors.
**GREEN command:** `pnpm test jasarat/ai/provider.test`
**Commit:** `feat: add provider-neutral OmniRoute adapter`

## Checkpoint 5 — Model candidate discovery + frozen target config
**Files:** `scripts/discover-models.ts`, `benchmarks/jasarat/targets.json`
**Implementation:** Write script to query OmniRoute catalog, identify vision-capable free-tier models. Generate a frozen `targets.json` defining exact benchmark targets (e.g. `google/gemini-1.5-flash-8b`, removing opacity of `model:auto`).
**Commit:** `test: freeze explicit model benchmark targets`

## Checkpoint 6 — Single-pass multimodal analysis + prompt/version contract
**Files:** `src/lib/jasarat/ai/prompts/v1.ts`, `src/lib/jasarat/ai/singlePass.ts`, `src/lib/jasarat/ai/singlePass.test.ts`
**Interfaces Consumed:** `ProviderModelInterface`
**Interfaces Produced:** `analyzePageSinglePass()` (Returns provider-facing JSON).
**RED tests to write:** Mocked AI call verifying prompt versioning, structured output requests, and correct parsing of a simulated response.
**RED command:** `pnpm test jasarat/ai/singlePass.test`
**Expected failure:** Function does not exist or fails to call provider.
**Implementation:** Define single-pass prompt requesting logical notice blocks, transaction/promotion classification, and extraction all at once.
**GREEN command:** `pnpm test jasarat/ai/singlePass.test`
**Commit:** `feat: implement single-pass multimodal analysis`

## Checkpoint 7 — Canonical mapping + normalization + confidence
**Files:** `src/lib/jasarat/ai/normalization.ts`, `src/lib/jasarat/ai/normalization.test.ts`, `src/lib/jasarat/ai/confidence.ts`, `src/lib/jasarat/ai/confidence.test.ts`
**Interfaces Consumed:** Provider-facing JSON response.
**Interfaces Produced:** `normalizeTransaction()`, `computeClassificationConfidence()`, `computeExtractionConfidence()`, `requiresReview`.
**RED tests to write:** Normalizing society variants, phone preservation. Confidence scoring on ambiguity vs correctly missing fields.
**RED command:** `pnpm test jasarat/ai/normalization.test`
**Expected failure:** Logic missing, scores incorrect.
**Implementation:** Implement deterministic normalization (without size inference). Implement heuristic confidence rules.
**GREEN command:** `pnpm test jasarat/ai/normalization.test && pnpm test jasarat/ai/confidence.test`
**Commit:** `feat: implement deterministic normalization and confidence logic`

## Checkpoint 8 — Benchmark evaluator + multi-transaction matching/scoring
**Files:** `scripts/evaluate-models.ts`, `src/lib/jasarat/ai/evaluation.ts`, `src/lib/jasarat/ai/evaluation.test.ts`
**Interfaces Consumed:** Ground-truth JSON, canonical extractions.
**RED tests to write:** Multi-transaction matching algorithm (by plot/society). Field-level scoring (correct value vs correct null vs missed vs hallucinated vs unscorable).
**RED command:** `pnpm test jasarat/ai/evaluation.test`
**Expected failure:** Algorithm fails to match or score accurately.
**Implementation:** Write deterministic scoring logic. Write script executing against `targets.json` producing machine-readable output.
**GREEN command:** `pnpm test jasarat/ai/evaluation.test`
**Commit:** `test: add benchmark evaluator and scoring logic`

## Checkpoint 9 — Real model benchmark + architecture/model decision
**Files:** `benchmarks/jasarat/reports/`
**Implementation:** Run `scripts/evaluate-models.ts` with explicit `JASARAT_AI_LIVE_TEST=1` gate. Generate markdown summary reports.
**Gate:** STOP and request founder review of benchmark results. Present single-pass viability, false-positives, missing transactions. Do not proceed to public API integration or hybrid experimentation without founder approval.
**Commit:** `docs: add benchmark results for founder review`

## Checkpoint 10 — Public orchestration integration + controlled live proof
**Files:** `src/lib/jasarat/ai/orchestration.ts`, `src/lib/jasarat/server.ts`, `src/lib/jasarat/ai/orchestration.live.test.ts`
**Interfaces Consumed:** Single-pass analysis, Normalization, Confidence.
**Interfaces Produced:** `extractJasaratPropertyIntelligence()`
**RED tests to write:** E2E mocked orchestration tying it all together.
**RED command:** `pnpm test jasarat/ai/orchestration.test`
**Expected failure:** Pipeline fails to connect components.
**Implementation:** Implement the final public API. Wire up all deterministic modules. Export through `server.ts`.
**GREEN command:** `pnpm test` (Full regression).
**Commit:** `feat: integrate public AI intelligence orchestration API`
