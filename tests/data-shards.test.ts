import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { gzipSync } from "node:zlib";
import { packEditionAssets } from "../scripts/edition-assets";
import { packSummaryAssets } from "../scripts/summary-assets";
import { createEditionsLoader } from "../src/lib/load-editions-client";
import { createEditionStore } from "../src/data/edition-store";
import { createSummaryStore } from "../src/data/summary-store";
import { dataBucket } from "../src/lib/data-buckets";
import { buildJournalHistory } from "../src/lib/journal-history";
import { makeCollection } from "./fixtures";

function fixture(t: TestContext) {
  const directory = resolve(__dirname, "../tmp/tests"); mkdirSync(directory, { recursive: true });
  const root = mkdtempSync(join(directory, "shards-"));
  t.after(() => {
    assert.ok(resolve(root).startsWith(directory + sep)); rmSync(root, { recursive: true, force: true });
  });
  const collection = makeCollection();
  collection.editions[0].partitionType = "xr";
  collection.editions[0].journals.push({ ...collection.editions[0].journals[0], issn: "1111-1111", journalName: "Only this year" });
  collection.editions[0].journalCount++;
  const manifest = packEditionAssets(root, gzipSync(JSON.stringify(collection)));
  const requests: string[] = [];
  const fetcher: typeof fetch = async input => {
    requests.push(String(input));
    return new Response(new Uint8Array(readFileSync(join(root, "public", String(input)))));
  };
  return { root, collection, manifest, requests, fetcher };
}

test("catalog and selected year avoid the complete dataset; history reads only one bucket with identical points", async t => {
  const f = fixture(t), client = createEditionsLoader(f.fetcher);
  const catalog = await client.catalog();
  assert.equal(catalog.editions.length, 2);
  assert.deepEqual(f.requests, ["/data/editions-manifest.json"]);
  assert.ok(catalog.editions.every(item => !("journals" in item)));
  const first = client.edition("aji-2026");
  assert.strictEqual(first, client.edition("aji-2026"));
  const selected = await first;
  assert.deepEqual(selected.edition.journals, f.collection.editions[0].journals);
  assert.ok(selected.historyIssns.includes("1234-5678"));
  assert.ok(!selected.historyIssns.includes("1111-1111"));
  assert.equal(f.requests.length, 2);
  assert.ok(!f.requests.includes(f.manifest.url));
  const history = await client.loadHistory("1234-5678");
  assert.deepEqual(buildJournalHistory(history, "1234-5678"), buildJournalHistory(f.collection.editions, "1234-5678"));
  assert.equal(f.requests.filter(url => url.includes("/history.")).length, 1);
  await client.loadHistory("1234-5678"); await client.edition("aji-2026");
  assert.equal(f.requests.length, 3);
  await client.edition("aji-2025");
  assert.equal(f.requests.filter(url => url.includes("/edition.")).length, 2);
});

test("a failed annual load remains retryable without fetching other years or the legacy bundle", async t => {
  const f = fixture(t); let fail = true;
  const client = createEditionsLoader(async (input, init) => {
    if (String(input).includes("edition.aji-2025") && fail) { fail = false; return new Response(null, { status: 503 }); }
    return f.fetcher(input, init);
  });
  await assert.rejects(client.edition("aji-2025"), /503/);
  assert.equal((await client.edition("aji-2025")).edition.id, "aji-2025");
  assert.ok(!f.requests.some(url => url.includes("edition.aji-2026") || url === f.manifest.url));
});

test("server annual cache reads only requested years and evicts decoded data", t => {
  const f = fixture(t), reads: string[] = [];
  const store = createEditionStore(join(f.root, "public/data"), 1, file => { reads.push(file); return readFileSync(file); });
  assert.equal(store.default().id, "aji-2026");
  assert.deepEqual(store.get("aji-2026")?.journals, f.collection.editions[0].journals);
  assert.equal(reads.length, 2);
  store.get("aji-2025"); store.get("aji-2026");
  assert.equal(reads.filter(file => file.endsWith(".gz")).length, 3);
  assert.ok(!reads.some(file => /editions\.[a-f0-9]|history\./.test(file)));
});

test("summary buckets preserve both locales and related records, share reads and bound decoded retention", t => {
  const f = fixture(t), keys = ["1234-5678", "1111-1111", "2222-2222"];
  assert.equal(new Set(keys.map(key => dataBucket(key))).size, 3);
  const entries = Object.fromEntries(keys.map(issn => [issn, {
    en: { summary: [{ type: "paragraph", content: `English ${issn}` }] },
    zh: { summary: [{ type: "paragraph", content: `中文 ${issn}` }] }, related: [{ journalName: "Related", issn: "3333-3333" }],
  }]));
  const compressed = gzipSync(JSON.stringify({ version: "fixture", model: "existing", updatedAt: "2026-01-01", total: 3, entries }));
  const manifest = packSummaryAssets(f.root, compressed);
  assert.equal(Object.values(manifest.assets).reduce((sum, item) => sum + item.entries, 0), 3);
  const reads: string[] = []; let fail = true;
  const store = createSummaryStore(join(f.root, "src/data/summaries"), 2, file => {
    reads.push(file);
    if (file.endsWith(".gz") && fail) { fail = false; throw new Error("temporary read failure"); }
    return readFileSync(file);
  });
  assert.throws(() => store(keys[0], "en"), /temporary/);
  assert.deepEqual(store(keys[0], "en"), { summary: entries[keys[0]].en.summary, relatedJournals: entries[keys[0]].related });
  const count = reads.length;
  assert.deepEqual(store(keys[0], "zh")?.summary, entries[keys[0]].zh.summary);
  assert.equal(reads.length, count);
  store(keys[1], "en"); store(keys[2], "en"); store(keys[0], "en");
  assert.equal(reads.filter(file => file.endsWith(".gz")).length, 5);
  assert.ok(!reads.some(file => file.endsWith("summaries.json.gz")));
  assert.equal(store("absent", "en"), undefined);
});
