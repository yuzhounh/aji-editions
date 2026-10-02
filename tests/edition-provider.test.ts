import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { EditionProvider, useEdition } from "../src/contexts/EditionContext";
import { LanguageProvider, useTranslation } from "../src/i18n/provider";
import { compressedCollection } from "./fixtures";

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
