# Jasarat Property Intelligence System

A property intelligence platform that processes Jasarat Karachi ePaper editions to extract real-estate transaction records.

**Current milestone: M1 — Project Foundation**

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

---

## Project structure

```
src/
  app/              # Next.js App Router pages and layouts
  lib/
    jasarat/
      jasaratTypes.ts          # Domain types (JasaratEdition, JasaratPageReference)
      jasaratUrlBuilder.ts     # URL building + validation logic
      jasaratUrlBuilder.test.ts # Vitest tests
      index.ts                 # Public module API
```

### Importing the Jasarat module

```ts
import {
  buildJasaratPageImageUrl,
  buildJasaratViewerUrl,
  type JasaratPageReference,
} from "@/lib/jasarat";
```
