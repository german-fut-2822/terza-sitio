// Sitemap generado en build con las mismas fuentes que las rutas reales (lib/catalogo, lib/blog), para que nunca
// quede desincronizado de getStaticPaths. No incluye /admin ni /api (no son páginas de contenido).
import type { APIRoute } from 'astro';
import { categorias, secciones, productos, urlCategoria, urlProducto } from '../lib/catalogo';
import { notasPublicadas, urlNota } from '../lib/blog';

const paginasEstaticas = [
  '/',
  '/catalogo',
  '/blog',
  '/pisos-vinilicos',
  '/pisos-laminados',
  '/pisos-de-madera',
  '/alfombras',
  '/lambrin-y-paneles',
  '/muros-verdes',
  '/persianas',
  '/pisos-deck',
  '/pasto-sintetico',
  '/quiero-ser-distribuidor',
  '/quienes-somos',
  '/ubicaciones',
  '/contacto',
  '/catalogos-digitales',
  '/buzon-de-transparencia',
];

export const GET: APIRoute = async ({ site }) => {
  const base = site ?? new URL('https://terza.com');

  const urlsCatalogo = [
    ...categorias.map((c) => urlCategoria(c.slug)),
    ...secciones.filter((s) => s.categorias.length > 1).map((s) => urlCategoria(s.id)),
  ];
  const urlsProductos = productos.map((p) => urlProducto(p));
  const notas = await notasPublicadas();
  const urlsBlog = notas.map((n) => urlNota(n));

  const rutas = [...paginasEstaticas, ...urlsCatalogo, ...urlsProductos, ...urlsBlog];

  const cuerpo = rutas.map((ruta) => `<url><loc>${new URL(ruta, base).href}</loc></url>`).join('');

  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${cuerpo}</urlset>`, {
    headers: { 'Content-Type': 'application/xml' },
  });
};
