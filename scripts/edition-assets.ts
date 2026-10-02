import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { EditionsManifest } from "../src/data/types";

/** Package the existing dataset without downloading or rebuilding raw data. */
export function packEditionAssets(root: string, compressed?: Buffer): EditionsManifest {
  const data = compressed ?? readFileSync(join(root, "src/data/editions/editions.json.gz"));
  const sha256 = createHash("sha256").update(data).digest("hex");
  const filename = `editions.${sha256}.json.gz`;
  const publicDir = join(root, "public/data");
  mkdirSync(publicDir, { recursive: true });
  // Write the immutable payload before the manifest that refers to it.
  writeFileSync(join(publicDir, filename), data);
  const manifest: EditionsManifest = { schemaVersion: 1, sha256, url: `/data/${filename}` };
  writeFileSync(join(publicDir, "editions-manifest.json"), JSON.stringify(manifest) + "\n");
  return manifest;
}
