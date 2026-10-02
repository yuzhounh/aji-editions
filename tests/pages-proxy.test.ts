import test from 'node:test';
import assert from 'node:assert/strict';
import { createProxy } from '../deploy/cloudflare-proxy.mjs';

test('Pages forwards Server Action requests and retains response/cache headers', async () => {
  const proxy = createProxy('https://academic-journal-index.vercel.app', async (request: Request) => {
    assert.equal(request.url, 'https://academic-journal-index.vercel.app/?locale=zh');
    assert.equal(request.method, 'POST');
    assert.equal(request.headers.get('origin'), 'https://academic-journal-index.pages.dev');
    assert.equal(request.headers.get('x-forwarded-host'), 'academic-journal-index.pages.dev');
    assert.equal(request.headers.get('next-action'), 'test-action');
    assert.equal(await request.text(), '["test"]');
    return new Response('rsc', { status: 200, headers: { 'content-type': 'text/x-component', 'cache-control': 'no-cache' } });
  });
  const response = await proxy.fetch(new Request('https://academic-journal-index.pages.dev/?locale=zh', {
    method: 'POST', headers: { origin: 'https://academic-journal-index.pages.dev', 'next-action': 'test-action' }, body: '["test"]',
  }));
  assert.equal(await response.text(), 'rsc');
  assert.equal(response.headers.get('content-type'), 'text/x-component');
  assert.equal(response.headers.get('cache-control'), 'no-cache');
});

test('Pages only fetches its fixed origin and rewrites same-origin redirects', async () => {
  const proxy = createProxy('https://academic-journal-index.vercel.app', async (request: Request) => {
    assert.equal(new URL(request.url).host, 'academic-journal-index.vercel.app');
    return new Response(null, { status: 307, headers: { location: 'https://academic-journal-index.vercel.app/share/test?locale=zh' } });
  });
  const response = await proxy.fetch(new Request('https://academic-journal-index.pages.dev//other.invalid/path'));
  assert.equal(response.status, 307);
  assert.equal(response.headers.get('location'), 'https://academic-journal-index.pages.dev/share/test?locale=zh');
});
