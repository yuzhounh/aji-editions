import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { EditionProvider, useEdition } from "../src/contexts/EditionContext";
import { LanguageProvider, useTranslation } from "../src/i18n/provider";
import { compressedCollection } from "./fixtures";
import { makeCollection } from "./fixtures";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { gzipSync } from "node:zlib";
import { packEditionAssets } from "../scripts/edition-assets";
import { createEditionsLoader, editionsClient } from "../src/lib/load-editions-client";

test("retry, language changes, and year changes preserve loaded data without refetching", async (t) => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const storage = new Map<string, string>([["aji-editions:selected-edition", "aji-2025"]]);
  Object.defineProperty(globalThis, "window", {
    configurable: true, value: { localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    } },
  });
  t.after(() => {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  });
  const data = compressedCollection();
  const sha256 = createHash("sha256").update(data).digest("hex");
  let requestCount = 0;
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    requestCount++;
    if (requestCount === 1) return new Response(null, { status: 503 });
    return String(input).endsWith("manifest.json")
      ? Response.json({ schemaVersion: 1, sha256, url: `/data/editions.${sha256}.json.gz` })
      : new Response(data);
  });
  let language: ReturnType<typeof useTranslation> | undefined;
  let edition: ReturnType<typeof useEdition> | undefined;
  function LanguageControl() {
    language = useTranslation();
    return null;
  }
  function EditionControl() {
    edition = useEdition();
    return React.createElement("span", null, edition.currentEditionId);
  }
  let renderer!: ReactTestRenderer;
  const settle = () => new Promise((done) => setTimeout(done, 30));
  await act(async () => {
    renderer = create(React.createElement(LanguageProvider, null,
      React.createElement(LanguageControl),
      React.createElement(EditionProvider, null, React.createElement(EditionControl))
    ));
    await settle();
  });
  t.after(() => act(() => renderer.unmount()));
  assert.equal(renderer.root.findByProps({ role: "alert" }).children.length, 1);
  await act(async () => {
    renderer.root.findByType("button").props.onClick();
    await settle();
  });
  assert.equal(requestCount, 3);
  assert.equal(edition?.currentEditionId, "aji-2025");
  const loadedEditions = edition!.editions;
  await act(async () => {
    language!.setLocale(language!.locale === "en" ? "zh" : "en");
    await settle();
  });
  assert.equal(requestCount, 3);
  assert.strictEqual(edition!.editions, loadedEditions);
  assert.equal(edition!.currentEditionId, "aji-2025");
  await act(async () => edition!.setEditionId("aji-2026"));
  assert.equal(edition!.currentEditionId, "aji-2026");
  assert.equal(storage.get("aji-editions:selected-edition"), "aji-2026");
  assert.equal(requestCount, 3);
});

test("annual selection keeps mounted state and the last successful year on failure; late requests cannot overwrite newer choices", async t => {
  const directory = resolve(__dirname, "../tmp/tests"); mkdirSync(directory, { recursive: true });
  const root = mkdtempSync(join(directory, "provider-"));
  const collection = makeCollection();
  collection.editions.push({ ...collection.editions[1], id: "aji-2024", partitionYear: 2024 });
  packEditionAssets(root, gzipSync(JSON.stringify(collection)));
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const storage = new Map([["aji-editions:selected-edition", "aji-2025"]]);
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: {
    getItem: (key: string) => storage.get(key) || null,
    setItem: (key: string, value: string) => storage.set(key, value),
  } } });
  let release!: () => void, slowStarted = false, fail = true;
  const slow = new Promise<void>(resolve => { release = resolve; });
  const requests: string[] = [];
  const client = createEditionsLoader(async input => {
    const url = String(input); requests.push(url);
    if (url.includes("edition.aji-2024") && fail) { fail = false; return new Response(null, { status: 503 }); }
    if (url.includes("edition.aji-2026")) { slowStarted = true; await slow; }
    return new Response(new Uint8Array(readFileSync(join(root, "public", url))));
  });
  t.mock.method(editionsClient, "catalog", client.catalog);
  t.mock.method(editionsClient, "edition", client.edition);
  t.mock.method(editionsClient, "loadHistory", client.loadHistory);
  let edition!: ReturnType<typeof useEdition>, mounts = 0;
  function Consumer() {
    edition = useEdition(); React.useEffect(() => { mounts++; }, []);
    return React.createElement("span", null, edition.currentEditionId);
  }
  let renderer!: ReactTestRenderer;
  t.after(async () => {
    release(); await act(() => renderer?.unmount());
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow); else Reflect.deleteProperty(globalThis, "window");
    assert.ok(resolve(root).startsWith(directory + sep)); rmSync(root, { recursive: true, force: true });
  });
  const settle = () => new Promise(resolve => setTimeout(resolve, 30));
  await act(async () => {
    renderer = create(React.createElement(LanguageProvider, null,
      React.createElement(EditionProvider, null, React.createElement(Consumer)))); await settle();
  });
  assert.equal(edition.currentEditionId, "aji-2025");
  assert.equal(requests.length, 2);
  assert.ok(!requests.some(url => url.includes("aji-2026") || url.includes("history.")));
  await act(async () => { edition.setEditionId("aji-2024"); await settle(); });
  assert.equal(edition.currentEditionId, "aji-2025");
  assert.equal(storage.get("aji-editions:selected-edition"), "aji-2025");
  assert.ok(renderer.root.findByProps({ role: "alert" }));
  await act(async () => { renderer.root.findByType("button").props.onClick(); await settle(); });
  assert.equal(edition.currentEditionId, "aji-2024");
  await act(async () => { edition.setEditionId("aji-2026"); await settle(); });
  assert.equal(slowStarted, true);
  assert.equal(edition.currentEditionId, "aji-2024");
  assert.equal(edition.isLoading, true);
  await act(async () => { edition.setEditionId("aji-2025"); await settle(); });
  await act(async () => { release(); await settle(); });
  assert.equal(edition.currentEditionId, "aji-2025");
  assert.equal(storage.get("aji-editions:selected-edition"), "aji-2025");
  assert.equal(mounts, 1);
});
