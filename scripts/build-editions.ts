/**
 * Build all AJI Editions datasets from ShowJCR raw CSV files.
 *
 * Usage:
 *   npm run build:editions
 *   npm run build:editions -- --download
 *   npm run build:editions -- --edition xr-2026
 */
import { buildEditions } from "./journal-builder";

function parseEditionIds(args: string[]): string[] | undefined {
  const ids: string[] = [];

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--edition" && args[i + 1]) {
      ids.push(args[i + 1]);
      i += 1;
    }
  }

  return ids.length > 0 ? ids : undefined;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const forceDownload = args.includes("--download");
  const editionIds = parseEditionIds(args);

  await buildEditions({ forceDownload, editionIds });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
