import type { APIRoute } from 'astro';
import { SITE_URL } from '../consts';

export const GET: APIRoute = () => {
  const body = `User-agent: *\nAllow: /\nSitemap: ${new URL('/sitemap-index.xml', SITE_URL).toString()}\n`;
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
