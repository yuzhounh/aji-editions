import { copyFile, mkdir, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const origin = new URL(process.argv[2]);
if (origin.protocol !== 'https:' || !origin.hostname.endsWith('.vercel.app')) {
  throw new Error('A verified Vercel production origin is required.');
}
await mkdir(new URL('.pages/', root), { recursive: true });
await copyFile(new URL('deploy/cloudflare-proxy.mjs', root), new URL('.pages/proxy.mjs', root));
await writeFile(new URL('.pages/_worker.js', root),
  `import { createProxy } from './proxy.mjs';\nexport default createProxy(${JSON.stringify(origin.origin)});\n`);
console.log(`Packaged Cloudflare Pages gateway for ${origin.host}`);
