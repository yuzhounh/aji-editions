// Keep the Pages domain while the complete Next.js runtime runs on Vercel.
/** @param {string} origin @param {(request: Request) => Promise<Response>} [fetcher] */
export function createProxy(origin, fetcher = fetch) {
  return {
    async fetch(request) {
      const incoming = new URL(request.url);
      const target = new URL(origin);
      target.pathname = incoming.pathname;
      target.search = incoming.search;
      const headers = new Headers(request.headers);
      headers.delete('host');
      headers.set('x-forwarded-host', incoming.host);
      headers.set('x-forwarded-proto', 'https');
      const upstream = await fetcher(new Request(target, {
        method: request.method,
        headers,
        body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
        redirect: 'manual',
        duplex: 'half',
      }));
      const response = new Response(upstream.body, upstream);
      const location = response.headers.get('location');
      if (location) {
        const redirect = new URL(location, target);
        if (redirect.origin === origin) {
          response.headers.set('location', incoming.origin + redirect.pathname + redirect.search + redirect.hash);
        }
      }
      response.headers.set('x-aji-runtime', 'vercel-via-cloudflare-pages');
      return response;
    },
  };
}
