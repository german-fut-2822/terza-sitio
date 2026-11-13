// Dinámico (no en public/) para que el Sitemap: apunte siempre al dominio real, incluso en previews de Vercel.
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL('https://terza.com');
  const cuerpo = ['User-agent: *', 'Disallow: /admin', 'Disallow: /api/', '', `Sitemap: ${new URL('/sitemap.xml', base).href}`].join('\n');

  return new Response(cuerpo, { headers: { 'Content-Type': 'text/plain' } });
};
