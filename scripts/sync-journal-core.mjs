import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const source = process.argv[2];
if (!source) throw new Error("Usage: npm run sync:core -- <reviewed vendor/aji-core directory>");
const sourceDir = resolve(source);
const targetDir = resolve("vendor/aji-core");
const metadata = JSON.parse(readFileSync(resolve(sourceDir, "package.json"), "utf8"));
if (metadata.name !== "@aji/core") throw new Error("Expected an @aji/core package");
for (const file of ["package.json", "index.js", "index.d.ts", "README.md"]) {
  writeFileSync(resolve(targetDir, file), readFileSync(resolve(sourceDir, file)));
}
console.log(`Synced @aji/core ${metadata.version}`);
