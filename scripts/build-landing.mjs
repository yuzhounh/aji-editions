import { lstat, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repository = 'aji-editions';
const origin = 'https://' + repository + '.vercel.app';
const output = join(root, 'dist_pages');
const staging = join(root, '.landing-build');
for (const path of [output, staging]) {
  const info = await lstat(path).catch(() => null);
  if (info?.isSymbolicLink()) throw new Error('Refusing linked output: ' + path);
}
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>正在打开站点</title><body><p>正在打开站点… <a href="${origin}/">前往完整站点</a></p><script>
const origin = ${JSON.stringify(origin)};
const prefix = ${JSON.stringify('/' + repository)};
let path = window.location.pathname;
if (window.location.hostname === 'yuzhounh.github.io' && (path === prefix || path.startsWith(prefix + '/'))) path = path.slice(prefix.length) || '/';
window.location.replace(origin + path + window.location.search + window.location.hash);
</script></body></html>`;
await rm(staging, { recursive: true, force: true });
await mkdir(staging);
await writeFile(join(staging, 'index.html'), html);
await writeFile(join(staging, '404.html'), html);
await writeFile(join(staging, '.nojekyll'), '');
await writeFile(join(staging, 'deployment-manifest.json'), JSON.stringify({
  source: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  mode: 'entry-redirect', runtimeOrigin: origin,
}, null, 2) + '\n');
await rm(output, { recursive: true, force: true });
await rename(staging, output);
console.log('Prepared dist_pages -> ' + origin);
