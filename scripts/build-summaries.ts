/**
 * Pre-generate journal summaries (English generate + Chinese translate) via DeepSeek.
 *
 * Usage:
 *   npx tsx scripts/build-summaries.ts
 *   npx tsx scripts/build-summaries.ts --concurrency 8
 *   npx tsx scripts/build-summaries.ts --limit 100
 *
 * Checkpoint: data/cache/summaries/progress.json
 * Lock:       data/cache/summaries/.build-summaries.lock
 */
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { config } from "dotenv";
import { z } from "zod";
import type { EditionsCollection } from "../src/data/types";
import { getPrimaryIssn } from "../src/lib/issn";

config({ path: path.resolve(__dirname, "../.env.local") });
config({ path: path.resolve(__dirname, "../.env") });

const ROOT = path.resolve(__dirname, "..");
const EDITIONS_GZ = path.join(ROOT, "src", "data", "editions", "editions.json.gz");
const OUT_DIR = path.join(ROOT, "data", "cache", "summaries");
const PROGRESS_FILE = path.join(OUT_DIR, "progress.json");
const LOCK_FILE = path.join(OUT_DIR, ".build-summaries.lock");
const BENCHMARK_DEEPSEEK = path.join(
  ROOT,
  "data",
  "cache",
  "summary-benchmark",
  "deepseek.json"
);

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const DEFAULT_CONCURRENCY = 8;

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

type JournalTask = {
  journalName: string;
  issn: string;
  primaryIssn: string;
};

type SummaryEntry = {
  journalName: string;
  issn: string;
  primaryIssn: string;
  en: SummaryPayload;
  zh: SummaryPayload;
  generatedAt: string;
  promptTokens: number;
  completionTokens: number;
};

type ProgressFile = {
  version: string;
  model: string;
  concurrency: number;
  startedAt: string;
  updatedAt: string;
  total: number;
  entries: Record<string, SummaryEntry>;
};

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

const SYSTEM_JSON =
  "You are a professional academic journal analyst. Output strictly valid JSON that matches the requested schema. Do not include any text outside the JSON object.";

function parseArgs(argv: string[]) {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    concurrency: get("--concurrency")
      ? Number(get("--concurrency"))
      : DEFAULT_CONCURRENCY,
    limit: get("--limit") ? Number(get("--limit")) : undefined,
  };
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireLock() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  if (fs.existsSync(LOCK_FILE)) {
    try {
      const lock = JSON.parse(fs.readFileSync(LOCK_FILE, "utf8")) as {
        pid: number;
        startedAt: string;
      };
      if (lock.pid !== process.pid && isPidAlive(lock.pid)) {
        throw new Error(
          `Another build-summaries run is active (PID ${lock.pid} since ${lock.startedAt}). Attach to that process; do not start a second copy.`
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("Another build-summaries")) {
        throw error;
      }
    }
    try {
      fs.unlinkSync(LOCK_FILE);
    } catch {
      /* ignore stale lock cleanup errors */
    }
  }

  fs.writeFileSync(
    LOCK_FILE,
    JSON.stringify({
      pid: process.pid,
      startedAt: new Date().toISOString(),
      command: process.argv.join(" "),
    })
  );

  const release = () => {
    try {
      if (fs.existsSync(LOCK_FILE)) {
        const lock = JSON.parse(fs.readFileSync(LOCK_FILE, "utf8")) as { pid: number };
        if (lock.pid === process.pid) fs.unlinkSync(LOCK_FILE);
      }
    } catch {
      /* ignore */
    }
  };
  process.on("exit", release);
  process.on("SIGINT", () => {
    release();
    process.exit(130);
  });
  process.on("SIGTERM", () => {
    release();
    process.exit(143);
  });
}

function loadUniqueJournals(): JournalTask[] {
  const buf = fs.readFileSync(EDITIONS_GZ);
  const collection = JSON.parse(
    zlib.gunzipSync(buf).toString("utf8")
  ) as EditionsCollection;
  const byIssn = new Map<string, JournalTask>();

  for (const edition of collection.editions) {
    for (const journal of edition.journals) {
      const primaryIssn = getPrimaryIssn(journal.issn);
      if (!primaryIssn) continue;
      if (!byIssn.has(primaryIssn)) {
        byIssn.set(primaryIssn, {
          journalName: journal.journalName,
          issn: journal.issn,
          primaryIssn,
        });
      }
    }
  }

  return [...byIssn.values()].sort((a, b) =>
    a.journalName.localeCompare(b.journalName)
  );
}

function loadProgress(model: string, concurrency: number, total: number): ProgressFile {
  if (fs.existsSync(PROGRESS_FILE)) {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf8")) as ProgressFile;
  }

  const progress: ProgressFile = {
    version: "1",
    model,
    concurrency,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    total,
    entries: {},
  };

  if (fs.existsSync(BENCHMARK_DEEPSEEK)) {
    const benchmark = JSON.parse(fs.readFileSync(BENCHMARK_DEEPSEEK, "utf8")) as {
      results: Array<{
        primaryIssn: string;
        journalName: string;
        issn: string;
        en: SummaryPayload | null;
        zh: SummaryPayload | null;
        enMetrics: { promptTokens: number | null; completionTokens: number | null } | null;
        zhMetrics: { promptTokens: number | null; completionTokens: number | null } | null;
        errors: string[];
      }>;
    };
    for (const row of benchmark.results) {
      if (!row.en || !row.zh || row.errors.length > 0) continue;
      progress.entries[row.primaryIssn] = {
        journalName: row.journalName,
        issn: row.issn,
        primaryIssn: row.primaryIssn,
        en: row.en,
        zh: row.zh,
        generatedAt: new Date().toISOString(),
        promptTokens:
          (row.enMetrics?.promptTokens ?? 0) + (row.zhMetrics?.promptTokens ?? 0),
        completionTokens:
          (row.enMetrics?.completionTokens ?? 0) +
          (row.zhMetrics?.completionTokens ?? 0),
      };
    }
    console.log(
      `Seeded ${Object.keys(progress.entries).length} entries from summary-benchmark/deepseek.json`
    );
  }

  return progress;
}

function saveProgress(progress: ProgressFile) {
  progress.updatedAt = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
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

async function chatDeepSeek(
  messages: ChatMessage[],
  temperature: number
): Promise<{ text: string; promptTokens: number; completionTokens: number; elapsedMs: number }> {
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
    if (response.status === 429) {
      throw new Error(`DeepSeek rate limited (429): ${errorText.slice(0, 200)}`);
    }
    throw new Error(`DeepSeek HTTP ${response.status}: ${errorText.slice(0, 400)}`);
  }

  const data: any = await response.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("DeepSeek returned empty content.");
  const usage = data?.usage ?? {};
  return {
    text,
    promptTokens: usage.prompt_tokens ?? 0,
    completionTokens: usage.completion_tokens ?? 0,
    elapsedMs: Date.now() - started,
  };
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = (error as Error).message ?? "";
      const delay = message.includes("429") ? 5000 * (i + 1) : 1500 * (i + 1);
      console.warn(`  retry ${i + 1}/${attempts - 1} in ${delay}ms: ${message}`);
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

async function generateEntry(task: JournalTask): Promise<SummaryEntry> {
  const enCall = await withRetry(() =>
    chatDeepSeek(
      [
        { role: "system", content: SYSTEM_JSON },
        { role: "user", content: generatePrompt(task.journalName) },
      ],
      0.4
    )
  );
  const en = parseSummary(enCall.text);

  const zhCall = await withRetry(() =>
    chatDeepSeek(
      [
        { role: "system", content: SYSTEM_JSON },
        { role: "user", content: translatePrompt(task.journalName, en) },
      ],
      0.2
    )
  );
  const zh = parseSummary(zhCall.text);

  return {
    journalName: task.journalName,
    issn: task.issn,
    primaryIssn: task.primaryIssn,
    en,
    zh,
    generatedAt: new Date().toISOString(),
    promptTokens: enCall.promptTokens + zhCall.promptTokens,
    completionTokens: enCall.completionTokens + zhCall.completionTokens,
  };
}

async function mapPool<T>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>
) {
  let next = 0;
  async function worker() {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
}

async function main() {
  acquireLock();
  const args = parseArgs(process.argv.slice(2));
  const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
  const journals = loadUniqueJournals();
  const total = args.limit ? Math.min(args.limit, journals.length) : journals.length;
  const tasks = journals.slice(0, total);
  const progress = loadProgress(model, args.concurrency, tasks.length);
  progress.model = model;
  progress.concurrency = args.concurrency;
  progress.total = tasks.length;

  const pending = tasks.filter((task) => !progress.entries[task.primaryIssn]);
  const done = tasks.length - pending.length;

  console.log(
    `[build-summaries] model=${model} concurrency=${args.concurrency} total=${tasks.length} done=${done} pending=${pending.length}`
  );
  console.log(`[build-summaries] checkpoint ${PROGRESS_FILE}`);
  console.log(`[build-summaries] lock PID ${process.pid}`);

  if (pending.length === 0) {
    console.log("Nothing pending.");
    return;
  }

  const started = Date.now();
  let completed = done;

  await mapPool(pending, args.concurrency, async (task, index) => {
    const label = `${completed + 1}/${tasks.length} ${task.journalName}`;
    const t0 = Date.now();
    try {
      const entry = await generateEntry(task);
      progress.entries[task.primaryIssn] = entry;
      completed += 1;
      saveProgress(progress);
      const sec = ((Date.now() - t0) / 1000).toFixed(1);
      const elapsedMin = ((Date.now() - started) / 60000).toFixed(1);
      console.log(
        `[build-summaries] done  ${label}  ${sec}s  (${completed}/${tasks.length}, ${elapsedMin} min elapsed)`
      );
    } catch (error) {
      console.error(
        `[build-summaries] fail  ${index + 1}/${pending.length} ${task.journalName}: ${(error as Error).message}`
      );
    }
  });

  completed = Object.keys(progress.entries).length;
  console.log(
    `[build-summaries] finished ${completed}/${tasks.length} entries in ${((Date.now() - started) / 60000).toFixed(1)} min`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
