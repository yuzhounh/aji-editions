/**
 * Sample 100 journals from CAS 2025 and compare OA status:
 * CAS Open Access vs DOAJ vs OpenAlex is_oa
 */
import fs from "fs";
import Papa from "papaparse";

type Row = Record<string, string>;

type SampleResult = {
  journal: string;
  issn: string;
  casOa: boolean;
  doajOa: boolean | null;
  openAlexOa: boolean | null;
  openAlexInDoaj: boolean | null;
  errors: string[];
};

function parseCsv(path: string): Row[] {
  return Papa.parse<Row>(fs.readFileSync(path, "utf8"), {
    header: true,
    skipEmptyLines: true,
  }).data;
}

function issnsFromRow(row: Row): string[] {
  const combined = row["ISSN/EISSN"]?.trim() ?? "";
  const parts = combined.split("/").map((s) => s.trim()).filter(Boolean);
  return [...new Set(parts)];
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const copy = [...arr];
  let s = seed;
  for (let i = copy.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function stratifiedSample(rows: Row[], total: number, seed = 20260815): Row[] {
  const yes = rows.filter((r) => r["Open Access"]?.trim() === "是");
  const no = rows.filter((r) => r["Open Access"]?.trim() === "否");
  const yesCount = Math.round(total * (yes.length / rows.length));
  const noCount = total - yesCount;
  const picked = [
    ...seededShuffle(yes, seed).slice(0, yesCount),
    ...seededShuffle(no, seed + 1).slice(0, noCount),
  ];
  return seededShuffle(picked, seed + 2);
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function checkDoaj(issn: string): Promise<boolean | null> {
  const url = `https://doaj.org/api/search/journals/issn:${encodeURIComponent(issn)}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { total?: number };
    return (data.total ?? 0) > 0;
  } catch {
    return null;
  }
}

async function checkOpenAlex(issn: string): Promise<{
  isOa: boolean | null;
  isInDoaj: boolean | null;
}> {
  const url = `https://api.openalex.org/sources/issn:${encodeURIComponent(issn)}?mailto=aji-editions@example.com`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 404) return { isOa: false, isInDoaj: false };
    if (!res.ok) return { isOa: null, isInDoaj: null };
    const data = (await res.json()) as {
      is_oa?: boolean;
      is_in_doaj?: boolean;
    };
    return {
      isOa: data.is_oa ?? null,
      isInDoaj: data.is_in_doaj ?? null,
    };
  } catch {
    return { isOa: null, isInDoaj: null };
  }
}

async function resolveOaForIssns(
  issns: string[],
  checker: (issn: string) => Promise<boolean | null>
): Promise<boolean | null> {
  for (const issn of issns) {
    const result = await checker(issn);
    if (result === true) return true;
    await sleep(120);
  }
  if (issns.length === 0) return null;
  // All ISSNs checked, none true — if any returned false explicitly, false; else null
  let sawFalse = false;
  for (const issn of issns) {
    const result = await checker(issn);
    if (result === false) sawFalse = true;
    if (result === true) return true;
    await sleep(120);
  }
  return sawFalse ? false : null;
}

async function resolveOpenAlex(issns: string[]) {
  for (const issn of issns) {
    const r = await checkOpenAlex(issn);
    await sleep(120);
    if (r.isOa === true) return r;
    if (r.isOa === false && r.isInDoaj === false) {
      // keep trying other issns; some journals match on eissn only
      continue;
    }
    if (r.isOa !== null) return r;
  }
  // retry last path: use first issn result or false
  if (issns.length === 0) return { isOa: null, isInDoaj: null };
  const last = await checkOpenAlex(issns[0]);
  return last;
}

async function main() {
  const rows = parseCsv("data/raw/FQBJCR2025-UTF8.csv").filter(
    (r) => r.Journal && r["ISSN/EISSN"]
  );
  const sample = stratifiedSample(rows, 100);
  const results: SampleResult[] = [];

  console.error(`Sampling ${sample.length} journals (${sample.filter((r) => r["Open Access"]?.trim() === "是").length} CAS OA yes)...`);

  for (let i = 0; i < sample.length; i++) {
    const row = sample[i];
    const issns = issnsFromRow(row);
    const casOa = row["Open Access"]?.trim() === "是";
    const errors: string[] = [];

    let doajOa = false;
    let doajKnown = false;
    for (const issn of issns) {
      const r = await checkDoaj(issn);
      await sleep(150);
      if (r === true) {
        doajOa = true;
        doajKnown = true;
        break;
      }
      if (r === null) errors.push(`DOAJ unknown for ${issn}`);
      else doajKnown = true;
    }
    const doajResult: boolean | null =
      issns.length === 0 ? null : doajKnown ? doajOa : null;

    let openAlexOa: boolean | null = null;
    let openAlexInDoaj: boolean | null = null;
    const oa = await resolveOpenAlex(issns);
    openAlexOa = oa.isOa;
    openAlexInDoaj = oa.isInDoaj;
    if (openAlexOa === null) errors.push("OpenAlex lookup failed");

    results.push({
      journal: row.Journal.trim(),
      issn: issns.join("/"),
      casOa,
      doajOa: doajResult,
      openAlexOa,
      openAlexInDoaj,
      errors,
    });

    console.error(`[${i + 1}/100] ${row.Journal.trim()} CAS=${casOa ? "是" : "否"} DOAJ=${doajResult} OA=${openAlexOa}`);
  }

  const valid = results.filter((r) => r.doajOa !== null && r.openAlexOa !== null);
  const n = valid.length;

  const agree = (a: boolean, b: boolean) => a === b;
  const casDoaj = valid.filter((r) => agree(r.casOa, r.doajOa!)).length;
  const casOa = valid.filter((r) => agree(r.casOa, r.openAlexOa!)).length;
  const doajOa = valid.filter((r) => agree(r.doajOa!, r.openAlexOa!)).length;
  const allThree = valid.filter(
    (r) => r.casOa === r.doajOa && r.casOa === r.openAlexOa
  ).length;

  const casYes = valid.filter((r) => r.casOa);
  const casNo = valid.filter((r) => !r.casOa);

  const casYesDoaj = casYes.filter((r) => r.doajOa).length;
  const casYesOa = casYes.filter((r) => r.openAlexOa).length;
  const casNoDoaj = casNo.filter((r) => r.doajOa).length;
  const casNoOa = casNo.filter((r) => r.openAlexOa).length;

  const disagreements = valid
    .filter((r) => r.casOa !== r.openAlexOa || r.casOa !== r.doajOa)
    .map((r) => ({
      journal: r.journal,
      issn: r.issn,
      cas: r.casOa ? "是" : "否",
      doaj: r.doajOa ? "是" : "否",
      openAlex: r.openAlexOa ? "是" : "否",
      pattern:
        r.casOa && !r.openAlexOa
          ? "CAS是 / 外源否"
          : !r.casOa && r.openAlexOa
            ? "CAS否 / 外源是"
            : "其他",
    }));

  const summary = {
    sampleSize: sample.length,
    validComparisons: n,
    stratified: {
      casOaYes: sample.filter((r) => r["Open Access"]?.trim() === "是").length,
      casOaNo: sample.filter((r) => r["Open Access"]?.trim() === "否").length,
    },
    agreementRates: {
      casVsDoaj: `${casDoaj}/${n} (${((casDoaj / n) * 100).toFixed(1)}%)`,
      casVsOpenAlex: `${casOa}/${n} (${((casOa / n) * 100).toFixed(1)}%)`,
      doajVsOpenAlex: `${doajOa}/${n} (${((doajOa / n) * 100).toFixed(1)}%)`,
      allThree: `${allThree}/${n} (${((allThree / n) * 100).toFixed(1)}%)`,
    },
    whenCasYes: {
      count: casYes.length,
      doajAlsoYes: `${casYesDoaj}/${casYes.length} (${casYes.length ? ((casYesDoaj / casYes.length) * 100).toFixed(1) : 0}%)`,
      openAlexAlsoYes: `${casYesOa}/${casYes.length} (${casYes.length ? ((casYesOa / casYes.length) * 100).toFixed(1) : 0}%)`,
    },
    whenCasNo: {
      count: casNo.length,
      doajYes: `${casNoDoaj}/${casNo.length} (false positive vs CAS)`,
      openAlexYes: `${casNoOa}/${casNo.length} (false positive vs CAS)`,
    },
    disagreementCount: disagreements.length,
    disagreements: disagreements.slice(0, 25),
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
