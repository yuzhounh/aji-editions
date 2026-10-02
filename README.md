<p align="center">
  <img src="public/favicon.svg" width="112" alt="AJI Editions logo">
</p>

<h1 align="center">AJI Editions</h1>

<p align="center"><strong>Explore academic journals across paired JCR and CAS/XR editions.</strong></p>

<p align="center">
  <a href="https://aji-editions.pages.dev/"><img src="https://img.shields.io/badge/Website-Cloudflare%20Pages-f38020?style=flat&amp;logo=cloudflare&amp;logoColor=white" alt="Website: Cloudflare Pages"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-f59e0b?style=flat" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/Next.js-React-222222?style=flat&amp;logo=nextdotjs&amp;logoColor=white" alt="Next.js: React">
</p>

<p align="center">
  <a href="https://aji-editions.pages.dev/">Live site</a> · <a href="https://github.com/yuzhounh/aji-editions/releases/latest">Latest release</a> · <a href="#development">Get started</a> · <a href="LICENSE">License</a>
</p>

Multi-year edition line of [Academic Journal Index (AJI)](https://github.com/yuzhounh/academic-journal-index). Switch between paired CAS/XR partition tables and JCR impact factor datasets from different release years.

## Editions

Six editions (2022–2027). Default UI edition: **2026 Edition** (`aji-2026`).

Pairing rule: each partition-backed edition pairs its partition table with the latest Clarivate JCR release available when that partition was released. JCR edition labels use the Clarivate release year; ShowJCR CSV files are named by IF data year (`JCR2024-UTF8.csv` = IF(2024) = Clarivate JCR 2025).

| UI Edition | Type | Partition | Journals | JCR edition | ShowJCR IF file | IF year | Partition release | JCR release |
|------------|------|-----------|----------|-------------|-----------------|---------|-------------------|-------------|
| 2027 | JCR only (XR pending) | — | 22,594 | JCR 2026 | JCR2025 | 2025 | — | 2026-06-17 |
| **2026 (default)** | XR | XR2026 | 22,299 | JCR 2025 | JCR2024 | 2024 | 2026-03-24 | 2025-06-18 |
| 2025 | CAS | FQBJCR2025 | 21,772 | JCR 2024 | JCR2023 | 2023 | 2025-03-20 | 2024-06-20 |
| 2024 | CAS | FQBJCR2023 | 13,812 | JCR 2023 | JCR2022 | 2022 | 2023-12-27 | 2023-06-28 |
| 2023 | CAS | FQBJCR2022 | 12,359 | JCR 2022 | JCR2021 | 2021 | 2022-12-21 | 2022-06-28 |
| 2022 | CAS | FQBJCR2021 | 12,422 | JCR 2021 | JCR2020 | 2020 | 2021-12-20 | 2021-06-30 |

2027 Edition is JCR-only until the XR 2027 partition table is released; IF and journal metadata come from JCR2025. XR 2026 Edition inherits open-access status from CAS 2025, then OpenAlex, with closed access as the default.

## Data pipeline

```
ShowJCR raw CSVs (data/raw/)
        ↓
npm run build:editions
        ↓
src/data/editions/editions.json.gz  (+ public/data/editions.json.gz)
        ↓
npm run pack:editions → public/data/editions.<sha256>.json.gz + editions-manifest.json
        ↓
Client revalidates the manifest → caches the versioned dataset → Edition switcher in UI
```

Raw data from [hitfyd/ShowJCR](https://github.com/hitfyd/ShowJCR). Authority journal levels computed using [Authoritative-Journal-Classification](https://github.com/yuzhounh/Authoritative-Journal-Classification) rules.

## Development

```bash
git clone https://github.com/yuzhounh/aji-editions.git
cd aji-editions
npm ci
npm run dev               # package existing data; http://localhost:9002
```

The committed dataset is sufficient for development and application builds. Regenerate it only when updating source data:

```bash
npm run build:editions
```

To force re-download raw CSVs:

```bash
npm run build:editions -- --download
```

### Build, caching, and validation

```bash
npm run check  # TypeScript, ESLint, and regression tests
npm run build # package existing data, then build with type/lint checks
npm start
```

GitHub Actions runs the checks and production build on Node.js 22. `predev` and `prebuild` generate the manifest and content-hashed asset from the existing compressed dataset; these generated files are gitignored. Dataset rebuilds also package the new version. Deploy the manifest and its referenced asset together from the same build output.

The manifest uses `Cache-Control: no-cache`; hashed datasets use `public, max-age=31536000, immutable`. Next.js config provides these headers for its server, and `public/_headers` describes the equivalent Cloudflare static-hosting policy. A platform adapter must preserve the generated assets and headers. Other hosting platforms need equivalent header rules; an application build alone does not validate a cloud deployment.

The client shares an in-flight request and the decoded collection within each page session. Language and edition switches reuse that collection. Failed loads are evicted and expose a Retry button. Reloading revalidates the manifest and uses a new URL when the dataset changes. This version still loads all editions together to support history views; splitting by year is a separate optimization if slow-network or mobile measurements justify it.

ISSN and JCR release-year rules come from the versioned local `@aji/core` package in `vendor/aji-core/`. The single-edition application vendors the same reviewed version. See [the core maintenance instructions](vendor/aji-core/README.md) for the sync command and favorites-ID compatibility policy.

### Production deployment

Vercel builds the complete Next.js application from `main`. Netlify uses `netlify.toml` and its automatically managed Next.js adapter; deploy with `netlify deploy --prod --context production --site aji-editions`.

Cloudflare Pages retains its existing domain as a gateway to the Vercel runtime, including Server Actions and shared-list routes. Run `npm run pack:pages`, then `wrangler pages deploy .pages --project-name aji-editions --branch main`. Manifest and dataset cache headers pass through from Vercel. The gateway does not contain secrets. Deploy Vercel first.

Firebase Hosting is an entry-point redirect to Vercel because its existing project has no billing enabled. Run `firebase deploy --only hosting --project aji-editions`; this command does not deploy Firestore rules or functions.

## Tech stack

Next.js 15 · React 18 · TypeScript · Tailwind CSS · shadcn/ui · Firebase Auth

## Related Projects

- [academic-journal-index](https://github.com/yuzhounh/academic-journal-index): the current single-edition AJI application this project extends.
- [Authoritative-Journal-Classification](https://github.com/yuzhounh/Authoritative-Journal-Classification): authority-level classification rules used by the edition pipeline.

## Hosting

Vercel and Netlify run the complete Next.js application, including summaries and `/share/[id]`. Vercel uses `npm run build`; Netlify uses the same command with its Next.js adapter and `.next/` output.

```bash
npm run build:landing
```

This prepares `dist_pages/` as the GitHub Pages entry, redirecting to `https://aji-editions.vercel.app` while preserving share paths, query parameters, and fragments. The Pages workflow publishes this generated package. Cloudflare uses the gateway described above; Firebase uses HTTP redirects. These entry points depend on Vercel's complete runtime.

## License

This project is released under the [MIT License](LICENSE).
