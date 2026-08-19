<p align="center">
  <img src="public/favicon.svg" width="112" alt="AJI Editions icon" />
</p>

<h1 align="center">AJI Editions</h1>

<p align="center"><strong>Compare academic journal rankings and impact factors across editions.</strong></p>

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

2027 Edition is JCR-only until the XR 2026 partition table is released; IF and journal metadata come from JCR2025. XR 2026 Edition inherits open-access status from CAS 2025, then OpenAlex, with closed access as the default.

## Data pipeline

```
ShowJCR raw CSVs (data/raw/)
        ↓
npm run build:editions
        ↓
src/data/editions/editions.json.gz  (+ public/data/editions.json.gz)
        ↓
Client loads /data/editions.json.gz → Edition switcher in UI
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

## License

This project is released under the [MIT License](LICENSE).
