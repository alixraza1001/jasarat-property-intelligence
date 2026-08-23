# Jasarat Property Intelligence System

A property intelligence platform that processes Jasarat Karachi ePaper editions to extract real-estate transaction records.

**Current milestone: M1 — Project Foundation**

M1 includes:
- Canonical Jasarat full-resolution URL construction and viewer URL construction
- Server-side page fetching with a 20-second timeout
- JPEG validation (Content-Type, JPEG magic bytes `FF D8 FF`, minimum byte count)
- Thumbnail safeguard (rejects `/sliderpics/` URLs even after redirects)
- Edition page discovery through viewer HTML (does not download newspaper images; it reads the lightweight viewer page list)
- Structured `JasaratPageFetchError` and `JasaratEditionDiscoveryError` with discriminated error codes
- Mocked offline unit tests (all runnable with `pnpm test`)
- Opt-in live smoke tests against the real Jasarat endpoint

---

## About

The system sources high-resolution newspaper pages from the Jasarat ePaper and will eventually extract property transaction notices (e.g. `اطلاع عام`) from them using AI, then validate and store the results for search and export.

At M1, only the project foundation and URL-building logic for Jasarat Karachi are implemented. No downloading, AI, database, or dashboard exists yet.

---

## First supported source: Jasarat Karachi

Jasarat exposes two distinct image paths per page:

| Type | URL pattern | Used? |
|------|------------|-------|
| **High-resolution** (primary) | `.../epaper/images/dates/YYYY-MM-DD/karachi/mm/PAGE.jpg` | ✅ Yes |
| Low-resolution thumbnail | `.../epaper/images/dates/YYYY-MM-DD/karachi/mm/sliderpics/PAGE.jpg` | ❌ Never |

The `sliderpics` path is only used by the viewer's slider thumbnail strip and is never suitable as a primary image source. The system strictly uses the high-resolution `/mm/PAGE.jpg` path.

The viewer URL (for human browsing) follows a different format:

```
https://jasarat.news/epaper/YYYY/MM/DD/karachi/PAGE
```

Note that the viewer URL uses slashes (`YYYY/MM/DD`) while the image URL uses dashes (`YYYY-MM-DD`).

---

## Developer commands

### Install dependencies

```bash
pnpm install
```

### Run development server

```bash
pnpm dev
```

### Run tests

```bash
pnpm test          # single run
pnpm test:watch    # watch mode
```

### Run ESLint

```bash
pnpm lint
```

### Type-check

```bash
pnpm typecheck
```

### Build for production

```bash
pnpm build
```

### Run opt-in live Jasarat smoke test

This makes **one real HTTP request** to jasarat.news. Do not run repeatedly.

```powershell
# PowerShell (Windows)
$env:JASARAT_LIVE_TEST=1; pnpm test jasaratPageFetcher.live
```

```bash
# bash/zsh (Linux/macOS)
JASARAT_LIVE_TEST=1 pnpm test jasaratPageFetcher.live
```

---

## Project structure

```
src/
  app/              # Next.js App Router pages and layouts
  lib/
    jasarat/
      jasaratTypes.ts                      # All domain types + error classes
      jasaratUrlBuilder.ts                 # URL building + validation logic
      jasaratUrlBuilder.test.ts            # URL builder unit tests
      jasaratDateUtils.ts                  # UTC date arithmetic helper
      jasaratDateUtils.test.ts             # Date arithmetic unit tests
      jasaratPageFetcher.ts                # Server-side full-page fetcher
      jasaratPageFetcher.test.ts           # Mocked fetcher unit tests
      jasaratPageFetcher.live.test.ts      # Opt-in page fetcher live test
      jasaratEditionDiscovery.ts           # Edition page discovery logic
      jasaratEditionDiscovery.test.ts      # Mocked discovery unit tests
      jasaratEditionDiscovery.live.test.ts # Opt-in discovery live test
      jasaratHistoricalManifest.ts           # Orchestrator for historical manifests
      jasaratHistoricalManifest.test.ts      # Mocked manifest orchestration tests
      jasaratHistoricalManifest.live.test.ts # Opt-in manifest live test
      index.ts                             # Public universal API
      server.ts                            # Server-side fetch API
```

### Universal API (safe anywhere)

```ts
import {
  buildJasaratPageImageUrl,
  buildJasaratViewerUrl,
  type JasaratPageReference,
  type JasaratEditionReference,
} from "@/lib/jasarat";
```

### Server-side fetching API (Node.js / server only)

```ts
import {
  fetchJasaratPageImage,
  discoverJasaratEditionPages,
  JasaratPageFetchError,
  JasaratEditionDiscoveryError,
  type JasaratFetchedPageImage,
  type JasaratPageFetchErrorCode,
  type JasaratEditionDiscoveryResult,
  type JasaratEditionDiscoveryErrorCode,
} from "@/lib/jasarat/server";
```
