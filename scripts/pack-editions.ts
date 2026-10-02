import { resolve } from "node:path";
import { packEditionAssets } from "./edition-assets";

const manifest = packEditionAssets(resolve(__dirname, ".."));
console.log(`Packed existing edition data: ${manifest.url}`);
