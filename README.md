# [AJI Editions](https://github.com/yuzhounh/aji-editions)

Multi-year edition line of [Academic Journal Index (AJI)](https://github.com/yuzhounh/academic-journal-index). Switch between paired CAS/XR partition tables and JCR impact factor datasets from different release years.

## Editions

| Edition | Partition | JCR IF | Partition release | IF release |
|---------|-----------|--------|-------------------|------------|
| 2021 | FQBJCR2021 | JCR2021 | 2021-12-20 | 2021-06-30 |
| 2022 | FQBJCR2022 | JCR2022 | 2022-12-21 | 2022-06-28 |
| 2023 | FQBJCR2023 | JCR2023 | 2023-12-27 | 2023-06-28 |
| 2025 | FQBJCR2025 | JCR2024 | 2025-03-20 | 2024-06-20 |
| 2026 (XR) | XR2026 | JCR2025 | 2026-03-24 | 2025-06-18 |

Pairing rule: each partition table uses the latest JCR impact factor available at its release date.

## Data pipeline

```
ShowJCR raw CSVs (data/raw/)
        ↓
npm run build:editions
        ↓
src/data/editions/editions.json.gz
        ↓
Next.js server loads at build time → Edition switcher in UI
```

Raw data from [hitfyd/ShowJCR](https://github.com/hitfyd/ShowJCR). Authority journal levels computed using [Authoritative-Journal-Classification](https://github.com/yuzhounh/Authoritative-Journal-Classification) rules.

## Development

```bash
npm install
npm run build:editions    # download missing CSVs and build all editions
npm run dev               # http://localhost:9002
```

To force re-download raw CSVs:

```bash
npm run build:editions -- --download
```

## Tech stack

Next.js 15 · React 18 · TypeScript · Tailwind CSS · shadcn/ui · Firebase Auth

Based on [yuzhounh/academic-journal-index](https://github.com/yuzhounh/academic-journal-index).
