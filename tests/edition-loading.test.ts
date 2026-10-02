import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import { createEditionsLoader } from "../src/lib/load-editions-client";
import { packEditionAssets } from "../scripts/edition-assets";
import { compressedCollection } from "./fixtures";

function manifestFor(data: Uint8Array) {
  const sha256 = createHash("sha256").update(data).digest("hex");
  return { schemaVersion: 1, sha256, url: `/data/editions.${sha256}.json.gz` };
}

test("concurrent and repeated callers share one request and one decoded object", async () => {
  const data = compressedCollection();
  const manifest = manifestFor(data);
  const calls: [string, RequestCache | undefined][] = [];
  const loader = createEditionsLoader(async (input, init) => {
    calls.push([String(input), init?.cache]);
    return String(input).endsWith("manifest.json") ? Response.json(manifest) : new Response(data);
  });
  const first = loader();
  assert.strictEqual(first, loader());
  const collection = await first;
  assert.strictEqual(collection, await loader());
  assert.equal(collection.editions.length, 2);
  assert.equal(collection.editions[0].shortLabel.en, "JCR 2025 · XR 2026");
  assert.deepEqual(calls, [
    ["/data/editions-manifest.json", "no-cache"],
    [manifest.url, "force-cache"],
  ]);
});

test("failed requests are evicted and can be retried", async () => {
  const data = compressedCollection();
  let manifestCalls = 0;
  const loader = createEditionsLoader(async (input) => {
    if (String(input).endsWith("manifest.json")) {
      if (++manifestCalls === 1) return new Response(null, { status: 503 });
      return Response.json(manifestFor(data));
    }
    return new Response(data);
  });
  await assert.rejects(loader(), /manifest \(503\)/);
  assert.equal((await loader()).defaultEditionId, "aji-2026");
  assert.equal(manifestCalls, 2);
});

test("decompression failures do not poison the next load", async () => {
  const data = compressedCollection();
  let payloadCalls = 0;
  const loader = createEditionsLoader(async (input) => {
    if (String(input).endsWith("manifest.json")) return Response.json(manifestFor(data));
    return ++payloadCalls === 1 ? new Response("not gzip") : new Response(data);
  });
  await assert.rejects(loader());
  assert.equal((await loader()).version, "test");
  assert.equal(payloadCalls, 2);
});

test("a manifest must refer to its own versioned local asset", async () => {
  let calls = 0;
  const loader = createEditionsLoader(async () => {
    calls++;
    return Response.json({ ...manifestFor(compressedCollection()), url: "https://example.com/data" });
  });
  await assert.rejects(loader(), /Invalid edition manifest/);
  assert.equal(calls, 1);
});

test("packing preserves dataset bytes and changes the URL when the data changes", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "aji-assets-"));
  t.after(() => {
    const absoluteRoot = resolve(root);
    assert.ok(absoluteRoot.startsWith(resolve(tmpdir()) + sep) && basename(root).startsWith("aji-assets-"));
    rmSync(absoluteRoot, { recursive: true, force: true });
  });
  const firstData = compressedCollection("v1");
  const first = packEditionAssets(root, Buffer.from(firstData));
  assert.deepEqual(readFileSync(join(root, "public", first.url)), Buffer.from(firstData));
  assert.deepEqual(packEditionAssets(root, Buffer.from(firstData)), first);
  const secondData = compressedCollection("v2");
  const second = packEditionAssets(root, Buffer.from(secondData));
  assert.notEqual(first.url, second.url);
  const diskManifest = JSON.parse(readFileSync(join(root, "public/data/editions-manifest.json"), "utf8"));
  assert.deepEqual(diskManifest, second);
  const loader = createEditionsLoader(async (input) =>
    String(input).endsWith("manifest.json") ? Response.json(diskManifest) : new Response(secondData)
  );
  assert.equal((await loader()).version, "v2");
});
