import { resolve } from "node:path";
import { packSummaryAssets } from "./summary-assets";

const manifest = packSummaryAssets(resolve(__dirname, ".."));
console.log(`Packed ${manifest.total} existing bilingual summaries into ${Object.keys(manifest.assets).length} buckets`);
