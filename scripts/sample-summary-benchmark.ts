/**
 * Benchmark English summary + Chinese translation for 50 sampled journals.
 *
 * Usage:
 *   npx tsx scripts/sample-summary-benchmark.ts --sample
 *   npx tsx scripts/sample-summary-benchmark.ts --backend deepseek
 *   npx tsx scripts/sample-summary-benchmark.ts --backend qwen
 *   npx tsx scripts/sample-summary-benchmark.ts --evaluate
 *   npx tsx scripts/sample-summary-benchmark.ts --backend deepseek --limit 1
 */
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { config } from "dotenv";
import { z } from "zod";
import type { EditionsCollection, Journal } from "../src/data/types";
import { getPrimaryIssn } from "../src/lib/issn";

config({ path: path.resolve(__dirname, "../.env.local") });
config({ path: path.resolve(__dirname, "../.env") });

const ROOT = path.resolve(__dirname, "..");
const EDITIONS_GZ = path.join(ROOT, "src", "data", "editions", "editions.json.gz");
const OUT_DIR = path.join(ROOT, "data", "cache", "summary-benchmark");
const SAMPLE_PATH = path.join(OUT_DIR, "sample.json");
const EDITION_ID = "aji-2026";

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const OLLAMA_API_URL = process.env.OLLAMA_HOST
  ? `${process.env.OLLAMA_HOST.replace(/\/$/, "")}/api/chat`
  : "http://127.0.0.1:11434/api/chat";

const ContentBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("heading"),
    level: z.number().min(1).max(3),
    content: z.string().min(1),
  }),
  z.object({
    type: z.literal("paragraph"),
    content: z.string().min(1),
  }),
  z.object({
    type: z.literal("list"),
    items: z.array(z.string().min(1)).min(1),
  }),
]);

const SummarySchema = z.object({
  summary: z.array(ContentBlockSchema).min(6),
  relatedJournals: z
    .array(
      z.object({
        journalName: z.string().min(1),
        issn: z.string().optional().default(""),
      })
    )
    .min(1),
});

type SummaryPayload = z.infer<typeof SummarySchema>;

type SampleJournal = {
  journalName: string;
  issn: string;
  primaryIssn: string;
  majorCategory: string;
  majorCategoryPartition: string;
  impactFactor: number | string;
  openAccess: string;
  review: string;
  bucket: string;
};

type CallMetrics = {
  elapsedMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  evalCount: number | null;
  evalDurationNs: number | null;
  retries: number;
};

type JournalResult = {
  journalName: string;
  issn: string;
  primaryIssn: string;
  bucket: string;
  en: SummaryPayload | null;
  zh: SummaryPayload | null;
  enMetrics: CallMetrics | null;
  zhMetrics: CallMetrics | null;
  errors: string[];
};

type BackendResult = {
  backend: string;
  model: string;
  startedAt: string;
  updatedAt: string;
  results: JournalResult[];
};

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

const MUST_HAVE_NAMES = [
  "NATURE",
  "SCIENCE",
  "CELL",
  "LANCET",
  "NEW ENGLAND JOURNAL OF MEDICINE",
  "JAMA-JOURNAL OF THE AMERICAN MEDICAL ASSOCIATION",
  "BMJ-British Medical Journal",
  "PROCEEDINGS OF THE NATIONAL ACADEMY OF SCIENCES OF THE UNITED STATES OF AMERICA",
  "Nature Communications",
  "NATURE MEDICINE",
  "CELL RESEARCH",
  "National Science Review",
  "Science China-Life Sciences",
  "CHINESE MEDICAL JOURNAL",
  "Light-Science & Applications",
  "ANGEWANDTE CHEMIE-INTERNATIONAL EDITION",
  "Journal of the American Chemical Society",
  "PHYSICAL REVIEW LETTERS",
  "NUCLEIC ACIDS RESEARCH",
  "PLoS One",
  "Scientific Reports",
  "eLife",
  "IEEE TRANSACTIONS ON PATTERN ANALYSIS AND MACHINE INTELLIGENCE",
  "ADVANCED MATERIALS",
  "CHEMICAL REVIEWS",
  "Nano Research",
  "ACTA PHYSICA SINICA",
  "Chinese Physics Letters",
  "Nature Photonics",
  "Science China-Chemistry",
];

const FACT_CHECKS: Record<
  string,
  { publisher?: RegExp; founded?: RegExp; note: string }
> = {
  NATURE: {
    publisher: /springer|nature portfolio|nature publishing|macmillan/i,
    founded: /1869/,
    note: "Springer Nature / Nature Publishing, founded 1869",
  },
  SCIENCE: {
    publisher: /aaas|american association for the advancement/i,
    founded: /1880/,
    note: "AAAS, founded 1880",
  },
  CELL: {
    publisher: /cell press|elsevier/i,
    founded: /1974/,
    note: "Cell Press / Elsevier, founded 1974",
  },
  LANCET: {
    publisher: /elsevier|lancet/i,
    founded: /1823/,
    note: "Elsevier / The Lancet, founded 1823",
  },
  "NEW ENGLAND JOURNAL OF MEDICINE": {
    publisher: /massachusetts medical/i,
    founded: /1812/,
    note: "Massachusetts Medical Society, founded 1812",
  },
  "PLoS One": {
    publisher: /public library of science|\bplos\b/i,
    note: "PLOS, open-access mega-journal",
  },
  "National Science Review": {
    publisher: /science china|oxford|cas|chinese academy/i,
    note: "Science China Press / Oxford, CAS flagship",
  },
  "CHINESE MEDICAL JOURNAL": {
    publisher: /chinese medical association|wolters|lww|lippincott|cma/i,
    note: "Chinese Medical Association / LWW",
  },
};

const EN_HEADINGS = [
  "Journal Introduction",
  "Main Publication Areas",
  "Status in the Field",
] as const;

const ZH_HEADINGS = ["期刊简介", "主要发文方向", "领域地位"] as const;

function parseArgs(argv: string[]) {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    sample: argv.includes("--sample"),
    evaluate: argv.includes("--evaluate"),
    backend: get("--backend") as "deepseek" | "qwen" | undefined,
    limit: get("--limit") ? Number(get("--limit")) : undefined,
    concurrency: get("--concurrency") ? Number(get("--concurrency")) : undefined,
  };
}

function loadCollection(): EditionsCollection {
  const buf = fs.readFileSync(EDITIONS_GZ);
  return JSON.parse(zlib.gunzipSync(buf).toString("utf8")) as EditionsCollection;
}

function numericIf(value: number | string): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function partitionTier(partition: string): 1 | 2 | 3 | 4 | 0 {
  const match = partition.trim().match(/^(\d)/);
  const n = match ? Number(match[1]) : 0;
  if (n === 1 || n === 2 || n === 3 || n === 4) return n;
  return 0;
}

function toSample(journal: Journal, bucket: string): SampleJournal {
  return {
    journalName: journal.journalName,
    issn: journal.issn,
    primaryIssn: getPrimaryIssn(journal.issn),
    majorCategory: journal.majorCategory,
    majorCategoryPartition: journal.majorCategoryPartition,
    impactFactor: journal.impactFactor,
    openAccess: journal.openAccess,
    review: journal.review,
    bucket,
  };
}

function findByName(journals: Journal[], name: string): Journal | undefined {
  const exact = journals.find((j) => j.journalName === name);
  if (exact) return exact;
  return journals.find(
    (j) => j.journalName.toLowerCase() === name.toLowerCase()
  );
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const copy = [...arr];
  let s = seed >>> 0;
  for (let i = copy.length - 1; i > 0; i -= 1) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildSample(journals: Journal[], size = 50): SampleJournal[] {
  const picked: SampleJournal[] = [];
  const used = new Set<string>();

  const add = (journal: Journal | undefined, bucket: string) => {
    if (!journal) return;
    const key = getPrimaryIssn(journal.issn) || journal.journalName.toLowerCase();
    if (used.has(key)) return;
    used.add(key);
    picked.push(toSample(journal, bucket));
  };

  for (const name of MUST_HAVE_NAMES) {
    add(findByName(journals, name), "must-have");
  }

  const remaining = journals.filter((j) => {
    const key = getPrimaryIssn(j.issn) || j.journalName.toLowerCase();
    return !used.has(key);
  });

  const fill = (
    predicate: (j: Journal) => boolean,
    count: number,
    bucket: string,
    seed: number
  ) => {
    const pool = seededShuffle(remaining.filter(predicate), seed);
    for (const journal of pool) {
      if (picked.length >= size) return;
      const before = picked.length;
      add(journal, bucket);
      if (picked.length > before) {
        count -= 1;
        if (count <= 0) return;
      }
    }
  };

  fill(
    (j) =>
      /china|chinese|sinica|hua|peking|tsinghua|shanghai/i.test(j.journalName) ||
      /中国|中华/.test(j.journalName),
    4,
    "chinese-other",
    11
  );
  fill((j) => ["文学", "哲学", "历史学", "教育学"].includes(j.majorCategory), 4, "humanities", 22);
  fill((j) => j.majorCategory === "计算机科学", 2, "cs", 33);
  fill((j) => ["经济学", "管理学"].includes(j.majorCategory), 2, "econ-mgmt", 44);
  fill((j) => j.majorCategory === "农林科学", 2, "agri", 55);
  fill((j) => partitionTier(j.majorCategoryPartition) >= 3, 6, "q3-q4", 66);
  fill((j) => j.openAccess === "是" && numericIf(j.impactFactor) < 8, 2, "oa-mid", 77);

  const leftover = size - picked.length;
  if (leftover > 0) {
    fill(() => true, leftover, "random-mid", 88);
  }

  return picked.slice(0, size);
}

function ensureOutDir() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

function backendPath(backend: string): string {
  return path.join(OUT_DIR, `${backend}.json`);
}

function loadBackend(backend: string, model: string): BackendResult {
  const file = backendPath(backend);
  if (fs.existsSync(file)) {
    return JSON.parse(fs.readFileSync(file, "utf8")) as BackendResult;
  }
  return {
    backend,
    model,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    results: [],
  };
}

function saveBackend(result: BackendResult) {
  result.updatedAt = new Date().toISOString();
  fs.writeFileSync(backendPath(result.backend), JSON.stringify(result, null, 2));
}

function stripThink(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

function parseJsonPayload(text: string): unknown {
  let cleaned = stripThink(text).trim();
  const fence = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) cleaned = fence[1].trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  return JSON.parse(cleaned);
}

function parseSummary(text: string): SummaryPayload {
  const raw = parseJsonPayload(text) as {
    summary?: unknown;
    relatedJournals?: Array<{ journalName?: string; issn?: string }>;
  };
  if (Array.isArray(raw?.relatedJournals)) {
    raw.relatedJournals = raw.relatedJournals.filter(
      (item) => (item.journalName ?? "").trim() && (item.issn ?? "").trim()
    );
  }
  return SummarySchema.parse(raw);
}

function emptyMetrics(): CallMetrics {
  return {
    elapsedMs: 0,
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
    evalCount: null,
    evalDurationNs: null,
    retries: 0,
  };
}

function generatePrompt(journalName: string): string {
  return `Your task is to generate a detailed analysis report for the following academic journal.
Write the entire report in English.
IMPORTANT: Do NOT translate the original journal name. Keep it exactly as provided.

Journal Name: ${journalName}

You MUST output a single JSON object with exactly this shape:
{
  "summary": [
    { "type": "heading", "level": 2, "content": "Journal Introduction" },
    { "type": "paragraph", "content": "..." },
    { "type": "heading", "level": 2, "content": "Main Publication Areas" },
    { "type": "list", "items": ["...", "..."] },
    { "type": "heading", "level": 2, "content": "Status in the Field" },
    { "type": "paragraph", "content": "..." }
  ],
  "relatedJournals": [
    { "journalName": "...", "issn": "..." }
  ]
}

The "summary" array MUST include these sections in this exact order:
1. Heading "Journal Introduction", then one paragraph with background, history, and publisher.
2. Heading "Main Publication Areas", then a list of 4-8 research directions / subject areas.
3. Heading "Status in the Field", then one paragraph on academic reputation and influence.

Recommend 6-9 related journals in "relatedJournals", including names and ISSNs.
Use print ISSN when possible (XXXX-XXXX). Do not invent obviously fake ISSNs.
Output JSON only.`;
}

function translatePrompt(journalName: string, english: SummaryPayload): string {
  return `Translate the following academic-journal analysis JSON from English into Simplified Chinese.

Rules:
- Keep the JSON structure identical (same number of blocks, same types, same relatedJournals length).
- Replace the three English headings with exactly:
  "期刊简介", "主要发文方向", "领域地位"
- Translate paragraph and list-item text into natural Simplified Chinese.
- Do NOT translate journal names, publisher brand names that are commonly kept in English, or ISSNs.
- Keep the original journal name "${journalName}" unchanged wherever it appears.
- Keep relatedJournals names and ISSNs unchanged.
- Output JSON only.

Source JSON:
${JSON.stringify(english)}`;
}

const SYSTEM_JSON =
  "You are a professional academic journal analyst. Output strictly valid JSON that matches the requested schema. Do not include any text outside the JSON object.";

async function chatDeepSeek(
  messages: ChatMessage[],
  temperature: number
): Promise<{ text: string; metrics: CallMetrics }> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not configured.");
  const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
  const started = Date.now();
  const response = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      response_format: { type: "json_object" },
      stream: false,
      thinking: { type: "disabled" },
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek HTTP ${response.status}: ${errorText.slice(0, 400)}`);
  }
  const data: any = await response.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("DeepSeek returned empty content.");
  const usage = data?.usage ?? {};
  return {
    text,
    metrics: {
      elapsedMs: Date.now() - started,
      promptTokens: usage.prompt_tokens ?? null,
      completionTokens: usage.completion_tokens ?? null,
      totalTokens: usage.total_tokens ?? null,
      evalCount: null,
      evalDurationNs: null,
      retries: 0,
    },
  };
}

async function chatOllama(
  messages: ChatMessage[],
  temperature: number
): Promise<{ text: string; metrics: CallMetrics }> {
  const model = process.env.OLLAMA_MODEL || "qwen3.8:27b";
  const started = Date.now();
  const response = await fetch(OLLAMA_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      think: false,
      format: "json",
      keep_alive: "2h",
      options: {
        temperature,
        num_ctx: 8192,
        num_predict: 2500,
      },
    }),
    signal: AbortSignal.timeout(300000),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama HTTP ${response.status}: ${errorText.slice(0, 400)}`);
  }
  const data: any = await response.json();
  const text: string = data?.message?.content ?? "";
  if (!text) throw new Error("Ollama returned empty content.");
  return {
    text,
    metrics: {
      elapsedMs: Date.now() - started,
      promptTokens: data.prompt_eval_count ?? null,
      completionTokens: data.eval_count ?? null,
      totalTokens:
        data.prompt_eval_count != null && data.eval_count != null
          ? data.prompt_eval_count + data.eval_count
          : null,
      evalCount: data.eval_count ?? null,
      evalDurationNs: data.eval_duration ?? null,
      retries: 0,
    },
  };
}

async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3
): Promise<{ value: T; retries: number }> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const value = await fn();
      return { value, retries: i };
    } catch (error) {
      lastError = error;
      const delay = 1500 * (i + 1);
      console.warn(`  retry ${i + 1}/${attempts - 1} in ${delay}ms: ${(error as Error).message}`);
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

async function generatePair(
  chat: typeof chatDeepSeek,
  journalName: string
): Promise<{
  en: SummaryPayload;
  zh: SummaryPayload;
  enMetrics: CallMetrics;
  zhMetrics: CallMetrics;
}> {
  const enCall = await withRetry(() =>
    chat(
      [
        { role: "system", content: SYSTEM_JSON },
        { role: "user", content: generatePrompt(journalName) },
      ],
      0.4
    )
  );
  const enParsed = parseSummary(enCall.value.text);
  enCall.value.metrics.retries = enCall.retries;

  const zhCall = await withRetry(() =>
    chat(
      [
        { role: "system", content: SYSTEM_JSON },
        { role: "user", content: translatePrompt(journalName, enParsed) },
      ],
      0.2
    )
  );
  const zhParsed = parseSummary(zhCall.value.text);
  zhCall.value.metrics.retries = zhCall.retries;

  return {
    en: enParsed,
    zh: zhParsed,
    enMetrics: enCall.value.metrics,
    zhMetrics: zhCall.value.metrics,
  };
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

function alreadyDone(result: BackendResult, primaryIssn: string): boolean {
  return result.results.some(
    (row) => row.primaryIssn === primaryIssn && row.en && row.zh && row.errors.length === 0
  );
}

async function runBackend(
  backend: "deepseek" | "qwen",
  sample: SampleJournal[],
  limit?: number,
  concurrencyOverride?: number
) {
  const model =
    backend === "deepseek"
      ? process.env.DEEPSEEK_MODEL || "deepseek-v4-flash"
      : process.env.OLLAMA_MODEL || "qwen3.8:27b";
  const chat = backend === "deepseek" ? chatDeepSeek : chatOllama;
  const concurrency =
    concurrencyOverride ?? (backend === "deepseek" ? 3 : 1);
  const slice = typeof limit === "number" ? sample.slice(0, limit) : sample;
  const state = loadBackend(backend, model);
  state.model = model;

  const pending = slice.filter((j) => !alreadyDone(state, j.primaryIssn));
  console.log(
    `[${backend}] model=${model} total=${slice.length} pending=${pending.length} concurrency=${concurrency}`
  );

  if (backend === "qwen" && pending.length > 0) {
    console.log("[qwen] warming up model...");
    await chatOllama(
      [
        { role: "system", content: SYSTEM_JSON },
        { role: "user", content: 'Return {"ok":true}' },
      ],
      0
    );
    console.log("[qwen] warmup done");
  }

  await mapPool(pending, concurrency, async (journal, index) => {
    const label = `${index + 1}/${pending.length} ${journal.journalName}`;
    console.log(`[${backend}] start ${label}`);
    const row: JournalResult = {
      journalName: journal.journalName,
      issn: journal.issn,
      primaryIssn: journal.primaryIssn,
      bucket: journal.bucket,
      en: null,
      zh: null,
      enMetrics: null,
      zhMetrics: null,
      errors: [],
    };
    try {
      const pair = await generatePair(chat, journal.journalName);
      row.en = pair.en;
      row.zh = pair.zh;
      row.enMetrics = pair.enMetrics;
      row.zhMetrics = pair.zhMetrics;
      const enSec = (pair.enMetrics.elapsedMs / 1000).toFixed(1);
      const zhSec = (pair.zhMetrics.elapsedMs / 1000).toFixed(1);
      console.log(`[${backend}] done  ${label}  en=${enSec}s zh=${zhSec}s`);
    } catch (error) {
      row.errors.push((error as Error).message);
      console.error(`[${backend}] fail  ${label}: ${(error as Error).message}`);
    }
    const existing = state.results.findIndex((r) => r.primaryIssn === journal.primaryIssn);
    if (existing >= 0) state.results[existing] = row;
    else state.results.push(row);
    saveBackend(state);
    return row;
  });

  const ok = state.results.filter((r) => r.en && r.zh && r.errors.length === 0).length;
  console.log(`[${backend}] finished ok=${ok}/${state.results.length} -> ${backendPath(backend)}`);
}

function headingContents(summary: SummaryPayload | null, type: "heading") {
  return (summary?.summary ?? [])
    .filter((b): b is Extract<typeof b, { type: "heading" }> => b.type === type)
    .map((b) => b.content);
}

function introText(summary: SummaryPayload | null): string {
  const blocks = summary?.summary ?? [];
  const intro = blocks.find((b) => b.type === "paragraph");
  return intro && intro.type === "paragraph" ? intro.content : "";
}

function flattenText(summary: SummaryPayload | null): string {
  if (!summary) return "";
  return summary.summary
    .map((block) => {
      if (block.type === "list") return block.items.join(" ");
      return block.content;
    })
    .join(" ");
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return sorted[idx];
}

function evaluateBackend(
  result: BackendResult,
  issnSet: Set<string>,
  nameSet: Set<string>
) {
  const okRows = result.results.filter((r) => r.en && r.zh && r.errors.length === 0);
  const times = okRows.map(
    (r) => (r.enMetrics?.elapsedMs ?? 0) + (r.zhMetrics?.elapsedMs ?? 0)
  );
  const enTimes = okRows.map((r) => r.enMetrics?.elapsedMs ?? 0);
  const zhTimes = okRows.map((r) => r.zhMetrics?.elapsedMs ?? 0);
  const promptTokens = okRows.flatMap((r) => [
    r.enMetrics?.promptTokens ?? 0,
    r.zhMetrics?.promptTokens ?? 0,
  ]);
  const completionTokens = okRows.flatMap((r) => [
    r.enMetrics?.completionTokens ?? 0,
    r.zhMetrics?.completionTokens ?? 0,
  ]);

  const tokPerSec = okRows
    .map((r) => {
      const count = r.enMetrics?.evalCount;
      const dur = r.enMetrics?.evalDurationNs;
      if (!count || !dur) return null;
      return count / (dur / 1e9);
    })
    .filter((n): n is number => n != null);

  const schemaIssues = {
    enHeadingExact: 0,
    zhHeadingExact: 0,
    relatedCountOk: 0,
    relatedIssnInEdition: 0,
    relatedIssnTotal: 0,
    journalNamePreservedEn: 0,
    journalNamePreservedZh: 0,
    structureMatch: 0,
  };

  for (const row of okRows) {
    const enHeads = headingContents(row.en, "heading");
    const zhHeads = headingContents(row.zh, "heading");
    if (EN_HEADINGS.every((h, i) => enHeads[i] === h)) schemaIssues.enHeadingExact += 1;
    if (ZH_HEADINGS.every((h, i) => zhHeads[i] === h)) schemaIssues.zhHeadingExact += 1;
    const related = row.en?.relatedJournals ?? [];
    if (related.length >= 6 && related.length <= 9) schemaIssues.relatedCountOk += 1;
    for (const rel of related) {
      schemaIssues.relatedIssnTotal += 1;
      const primary = getPrimaryIssn(rel.issn);
      if (issnSet.has(primary) || nameSet.has(rel.journalName.toLowerCase())) {
        schemaIssues.relatedIssnInEdition += 1;
      }
    }
    const nameRe = new RegExp(row.journalName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    if (nameRe.test(flattenText(row.en))) schemaIssues.journalNamePreservedEn += 1;
    if (nameRe.test(flattenText(row.zh))) schemaIssues.journalNamePreservedZh += 1;
    if (
      row.en &&
      row.zh &&
      row.en.summary.length === row.zh.summary.length &&
      row.en.summary.every((b, i) => b.type === row.zh!.summary[i].type)
    ) {
      schemaIssues.structureMatch += 1;
    }
  }

  const facts: Array<{ journal: string; hits: string[]; misses: string[]; excerpt: string }> = [];
  for (const row of okRows) {
    const check = FACT_CHECKS[row.journalName];
    if (!check) continue;
    const text = introText(row.en);
    const hits: string[] = [];
    const misses: string[] = [];
    if (check.publisher) {
      (check.publisher.test(text) ? hits : misses).push("publisher");
    }
    if (check.founded) {
      (check.founded.test(text) ? hits : misses).push("founded");
    }
    facts.push({
      journal: row.journalName,
      hits,
      misses,
      excerpt: text.slice(0, 280),
    });
  }

  const totalPrompt = promptTokens.reduce((a, b) => a + b, 0);
  const totalCompletion = completionTokens.reduce((a, b) => a + b, 0);
  const avgMs = mean(times);

  return {
    backend: result.backend,
    model: result.model,
    completed: okRows.length,
    failed: result.results.length - okRows.length,
    avgPairSec: +(avgMs / 1000).toFixed(2),
    p50PairSec: +(percentile(times, 0.5) / 1000).toFixed(2),
    p90PairSec: +(percentile(times, 0.9) / 1000).toFixed(2),
    avgEnSec: +(mean(enTimes) / 1000).toFixed(2),
    avgZhSec: +(mean(zhTimes) / 1000).toFixed(2),
    totalPromptTokens: totalPrompt,
    totalCompletionTokens: totalCompletion,
    avgPromptTokens: Math.round(mean(promptTokens)),
    avgCompletionTokens: Math.round(mean(completionTokens)),
    qwenTokPerSec: tokPerSec.length ? +mean(tokPerSec).toFixed(2) : null,
    projectedFullCorpusHours: +((avgMs / 1000) * 22936 / 3600).toFixed(1),
    schema: {
      enHeadingExact: `${schemaIssues.enHeadingExact}/${okRows.length}`,
      zhHeadingExact: `${schemaIssues.zhHeadingExact}/${okRows.length}`,
      relatedCount6to9: `${schemaIssues.relatedCountOk}/${okRows.length}`,
      relatedInEdition: `${schemaIssues.relatedIssnInEdition}/${schemaIssues.relatedIssnTotal}`,
      namePreservedEn: `${schemaIssues.journalNamePreservedEn}/${okRows.length}`,
      namePreservedZh: `${schemaIssues.journalNamePreservedZh}/${okRows.length}`,
      structureMatch: `${schemaIssues.structureMatch}/${okRows.length}`,
    },
    facts,
  };
}

function printEval(report: ReturnType<typeof evaluateBackend>) {
  console.log(`\n=== ${report.backend} (${report.model}) ===`);
  console.log(`completed ${report.completed}  failed ${report.failed}`);
  console.log(
    `time/journal  avg ${report.avgPairSec}s  p50 ${report.p50PairSec}s  p90 ${report.p90PairSec}s  (en ${report.avgEnSec}s + zh ${report.avgZhSec}s)`
  );
  console.log(
    `tokens  prompt ${report.totalPromptTokens}  completion ${report.totalCompletionTokens}  avg prompt ${report.avgPromptTokens}  avg completion ${report.avgCompletionTokens}`
  );
  if (report.qwenTokPerSec != null) console.log(`qwen decode ${report.qwenTokPerSec} tok/s`);
  console.log(`full-corpus estimate @ this speed: ${report.projectedFullCorpusHours} hours for 22,936 journals`);
  console.log("schema", report.schema);
  if (report.facts.length) {
    console.log("fact checks:");
    for (const fact of report.facts) {
      console.log(
        `  ${fact.journal}: hits=${fact.hits.join(",") || "-"} misses=${fact.misses.join(",") || "-"}`
      );
      console.log(`    ${fact.excerpt}`);
    }
  }
}

async function evaluate() {
  const collection = loadCollection();
  const edition = collection.editions.find((e) => e.id === EDITION_ID);
  if (!edition) throw new Error(`Missing edition ${EDITION_ID}`);
  const issnSet = new Set(edition.journals.map((j) => getPrimaryIssn(j.issn)).filter(Boolean));
  const nameSet = new Set(edition.journals.map((j) => j.journalName.toLowerCase()));

  const reports = [];
  for (const backend of ["deepseek", "qwen"] as const) {
    const file = backendPath(backend);
    if (!fs.existsSync(file)) {
      console.log(`skip ${backend}: ${file} not found`);
      continue;
    }
    const result = JSON.parse(fs.readFileSync(file, "utf8")) as BackendResult;
    const report = evaluateBackend(result, issnSet, nameSet);
    printEval(report);
    reports.push(report);
  }
  fs.writeFileSync(path.join(OUT_DIR, "eval.json"), JSON.stringify(reports, null, 2));
  console.log(`\nWrote ${path.join(OUT_DIR, "eval.json")}`);
}

async function main() {
  ensureOutDir();
  const args = parseArgs(process.argv.slice(2));
  const collection = loadCollection();
  const edition = collection.editions.find((e) => e.id === EDITION_ID);
  if (!edition) throw new Error(`Missing edition ${EDITION_ID}`);

  if (args.sample || !fs.existsSync(SAMPLE_PATH)) {
    const sample = buildSample(edition.journals, 50);
    fs.writeFileSync(
      SAMPLE_PATH,
      JSON.stringify(
        {
          editionId: EDITION_ID,
          generatedAt: new Date().toISOString(),
          count: sample.length,
          journals: sample,
        },
        null,
        2
      )
    );
    const buckets = new Map<string, number>();
    for (const j of sample) buckets.set(j.bucket, (buckets.get(j.bucket) ?? 0) + 1);
    console.log(`Wrote ${SAMPLE_PATH} (${sample.length})`);
    console.log("buckets", Object.fromEntries(buckets));
    for (const j of sample) {
      console.log(
        `- ${j.journalName} | ${j.majorCategory} | IF ${j.impactFactor} | ${j.majorCategoryPartition} | ${j.bucket}`
      );
    }
    if (args.sample && !args.backend && !args.evaluate) return;
  }

  const sampleFile = JSON.parse(fs.readFileSync(SAMPLE_PATH, "utf8")) as {
    journals: SampleJournal[];
  };

  if (args.backend === "deepseek" || args.backend === "qwen") {
    await runBackend(args.backend, sampleFile.journals, args.limit, args.concurrency);
  }

  if (args.evaluate || args.backend) {
    await evaluate();
  }

  if (!args.sample && !args.backend && !args.evaluate) {
    console.log("Specify --sample, --backend deepseek|qwen, and/or --evaluate");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
