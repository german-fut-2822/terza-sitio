// Productos del catálogo para el buscador (src/components/SearchOverlay.astro). Va aparte del índice de cada página para
// no cargar los ~850 productos en todas: el buscador lo baja la primera vez que se abre. Se genera al hacer el build.
import type { APIRoute } from 'astro';
import { categorias, productos, urlProducto } from '../lib/catalogo';

const nombreCategoria = new Map(categorias.map((c) => [c.slug, c.nombre]));

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      productos.map((p) => ({
        title: `${p.familia} ${p.variante}`,
        cat: `${nombreCategoria.get(p.categoria)} · ${p.sku}`,
        href: urlProducto(p),
      })),
    ),
    { headers: { 'Content-Type': 'application/json' } },
  );
