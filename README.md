# Jasarat Property Intelligence

A real-estate intelligence system for turning Urdu newspaper property transaction notices into structured, searchable data.

The project begins with the **Jasarat Karachi ePaper** and focuses on building a reliable acquisition and extraction pipeline for notices that are useful to Pakistani real-estate professionals.

## The problem

Property transfer, sale and purchase notices are often published inside newspaper pages as unstructured Urdu text. Valuable information — estate/agency names, phone numbers, societies, sectors, plot numbers, plot sizes and transaction context — is difficult to search, filter or reuse when it remains locked inside daily newspaper images.

Jasarat Property Intelligence is being built to convert that source material into a reviewable dataset while preserving traceability back to the original newspaper page.

## What is implemented today

The current repository includes the **Jasarat source-acquisition foundation**, including:

- canonical full-resolution Jasarat image URL construction
- human-viewer URL construction
- server-side page fetching with timeout handling
- JPEG validation using content type, magic bytes and minimum-size checks
- rejection of low-resolution `/sliderpics/` thumbnails
- edition page discovery from Jasarat viewer HTML
- historical acquisition-manifest generation
- structured domain errors and error codes
- mocked offline unit tests
- opt-in live smoke tests against Jasarat

The project is intentionally staged: reliable source acquisition comes before automated AI extraction.

## Source acquisition pipeline

```text
Jasarat edition/date
        ↓
Discover available pages
        ↓
Build canonical full-resolution URLs
        ↓
Fetch + validate newspaper image
        ↓
Create historical acquisition manifest
        ↓
Benchmark / extraction / human review layers
```

### High-resolution source handling

Jasarat exposes both full newspaper pages and low-resolution slider thumbnails. This project treats them differently:

```text
Full page:  .../epaper/images/dates/YYYY-MM-DD/karachi/mm/PAGE.jpg
Thumbnail:  .../epaper/images/dates/YYYY-MM-DD/karachi/mm/sliderpics/PAGE.jpg
```

Only the full-resolution `/mm/PAGE.jpg` source is acceptable for primary acquisition. The fetcher rejects thumbnail paths even after redirects.

The human viewer uses a separate URL pattern:

```text
https://jasarat.news/epaper/YYYY/MM/DD/karachi/PAGE
```

## Data extraction direction

The next layers of the system are designed around identifying relevant property notices, extracting structured fields, and sending uncertain cases through human review.

Target fields include information such as:

- estate / agency name
- phone numbers
- society
- sector
- plot type
- plot size
- plot number
- transaction context
- source date / page reference

**Important:** acquisition and source validation are implemented foundations; AI extraction, reviewer workflows, searchable persistence and broader automation should be treated as work in progress unless the corresponding code is present in the repository.

## Reliability & validation

A key design goal is to make errors visible rather than silently accepting weak source material.

The acquisition layer includes:

- discriminated error types
- content validation before accepting an image
- explicit timeout behavior
- rejection of thumbnail-quality sources
- offline mocked tests for deterministic development
- opt-in live tests so routine test runs do not repeatedly hit the newspaper site

This makes the source layer testable independently from future AI/model choices.

## Architecture & project structure

```text
src/
├── app/                         # Next.js App Router
└── lib/
    └── jasarat/
        ├── jasaratTypes.ts
        ├── jasaratUrlBuilder.ts
        ├── jasaratDateUtils.ts
        ├── jasaratPageFetcher.ts
        ├── jasaratEditionDiscovery.ts
        ├── jasaratHistoricalManifest.ts
        ├── index.ts
        └── server.ts
```

The universal API contains URL/domain helpers that can be used broadly, while server-only acquisition functions are kept behind the server entry point.

## Tech stack

- TypeScript
- Next.js / React
- Node.js server-side fetch pipeline
- Vitest
- ESLint
- pnpm

Later product layers are being designed to remain separable from the source-acquisition module so model providers, persistence and reviewer UI can evolve without rewriting the newspaper-fetching foundation.

## Development commands

Install dependencies:

```bash
pnpm install
```

Run the development server:

```bash
pnpm dev
```

Run tests:

```bash
pnpm test
pnpm test:watch
```

Lint and type-check:

```bash
pnpm lint
pnpm typecheck
```

Build:

```bash
pnpm build
```

### Opt-in live smoke test

Live tests make real requests to Jasarat and should be used sparingly.

PowerShell:

```powershell
$env:JASARAT_LIVE_TEST=1; pnpm test jasaratPageFetcher.live
```

Bash / zsh:

```bash
JASARAT_LIVE_TEST=1 pnpm test jasaratPageFetcher.live
```

## Project status

The project is under active development. The acquisition layer provides a tested foundation for a larger property-intelligence workflow; extraction quality, benchmark curation, review tooling and searchable data workflows are being developed in controlled stages rather than treated as finished features.

---

Built by [Ali Raza Memon](https://github.com/alixraza1001) as part of a broader effort to apply software and AI to real-world Pakistani property workflows.
