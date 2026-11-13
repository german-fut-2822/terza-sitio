import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

// Dominio con el que se arman las URLs completas (canonical y vista previa al compartir):
// SITE_URL si se define; si no, el dominio de producción que Vercel asigna al proyecto; si no, terza.com
const dominioVercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const site = process.env.SITE_URL ?? (dominioVercel ? `https://${dominioVercel}` : 'https://terza.com');

// Redirecciones que solo difieren en mayúsculas del destino (p. ej. /AVISO-DE-PRIVACIDAD.pdf → /aviso-de-privacidad.pdf).
// Vercel compara las rutas sin distinguir mayúsculas, así que una redirección normal también atraparía el destino
// y haría un bucle; por eso se agregan aquí, al final del build, marcadas como sensibles a mayúsculas.
const redireccionesExactas = { '/AVISO-DE-PRIVACIDAD.pdf': '/aviso-de-privacidad.pdf' };
const escaparRegex = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Fichas de producto del sitio anterior (terza.com/<categoría-vieja>/catalogo/producto/<SKU>), indexadas en Google
// con tráfico real. La categoría de la URL vieja no siempre coincide con la actual (un producto puede haberse
// recategorizado), así que no se puede resolver con la config normal de `redirects` de Astro (exige que el destino
// use el mismo parámetro dinámico que el origen). Se agrega aquí, al final del build, con una categoría comodín
// en el origen y el destino fijo que corresponde al SKU hoy en src/data/catalogo.json.
const catalogo = JSON.parse(readFileSync(new URL('./src/data/catalogo.json', import.meta.url), 'utf-8'));
const redireccionesProducto = catalogo.productos.map((p) => ({
  src: `^/[^/]+/catalogo/producto/${escaparRegex(p.sku)}$`,
  headers: { Location: `/catalogo/${p.categoria}/${p.slug}` },
  status: 301,
}));

const redireccionesPostBuild = {
  name: 'redirecciones-post-build',
  hooks: {
    'astro:build:done': () => {
      const archivo = new URL('./.vercel/output/config.json', import.meta.url);
      if (!existsSync(archivo)) return;
      const config = JSON.parse(readFileSync(archivo, 'utf-8'));
      const conMayusculas = Object.entries(redireccionesExactas).map(([origen, destino]) => ({
        src: `^${escaparRegex(origen)}$`,
        headers: { Location: destino },
        status: 301,
        caseSensitive: true,
      }));
      const nuevas = [...conMayusculas, ...redireccionesProducto];
      config.routes = [...nuevas, ...config.routes.filter((r) => !nuevas.some((n) => n.src === r.src))];
      writeFileSync(archivo, JSON.stringify(config, null, 2));
    },
  },
};

// https://astro.build/config
export default defineConfig({
  site,
  output: 'static',
  // Administrador del blog (Decap CMS en public/admin)
  redirects: {
    '/admin': '/admin/index.html',
    // Rutas anteriores de las páginas de línea (antes llevaban la sección del menú)
    '/pisos/alfombras': '/alfombras',
    '/pisos/pisos-laminados': '/pisos-laminados',
    '/pisos/pisos-de-madera': '/pisos-de-madera',
    '/pisos/pisos-vinilicos': '/pisos-vinilicos',
    '/exterior/deck': '/pisos-deck',
    '/exterior/pasto-sintetico': '/pasto-sintetico',
    '/muros/lambrin-y-paneles': '/lambrin-y-paneles',
    '/muros/follaje-artificial': '/muros-verdes',
    // URLs del sitio anterior de terza.com
    '/piso-vinilico': '/pisos-vinilicos',
    '/lambrin-pvc': '/lambrin-y-paneles',
    '/distribuidor': '/quiero-ser-distribuidor',
    // Indexadas en el sitemap.xml del sitio Laravel (terza.com) sin página equivalente directa aquí
    '/tapetes': '/alfombras', // "alfombras y tapetes" es la misma línea de producto (ver quienes-somos.json)
    '/shaw-contract': '/', // la sección ShawContract ahora vive en el home, no en una página aparte

    // Resto de URLs indexadas según Search Console (16 meses de clics/impresiones), cruzadas contra
    // src/data/catalogo.json. El slug de cada producto es su SKU en minúsculas (ver scripts/importar-catalogo.mjs),
    // así que las notas del blog y el listado de cada categoría migran 1:1 con una sola regla cada uno.
    '/blog/post/[nota]': '/blog/[nota]',
    '/alfombras/catalogo': '/catalogo/alfombras',
    '/tapetes/catalogo': '/catalogo/alfombras',
    '/pasto-sintetico/catalogo': '/catalogo/pasto-sintetico',
    '/piso-vinilico/catalogo': '/catalogo/piso-vinilico',
    '/pisos-laminados/catalogo': '/catalogo/pisos-laminados',
    '/pisos-de-madera/catalogo': '/catalogo/pisos-de-madera',
    '/paneles/catalogo': '/catalogo/paneles',
    '/flexiroc/catalogo': '/catalogo/flexiroc',
    '/muros-verdes/catalogo': '/catalogo/muros-verdes',
    '/persianas/catalogo': '/catalogo/persianas', // sección con 2 categorías (enrollables y de madera)
    '/persianas-de-madera/catalogo': '/catalogo/persianas-de-madera',
    '/pisos-deck/catalogo': '/catalogo/pisos-deck',
    '/accesorios/catalogo': '/catalogo/accesorios',
    '/catalogos': '/catalogos-digitales',
    // Subpáginas de pasto-sintetico del sitio viejo (canchas, instalaciones, jardines...): hoy toda esa
    // información vive consolidada en una sola página.
    '/pasto-sintetico/canchas': '/pasto-sintetico',
    '/pasto-sintetico/instalaciones': '/pasto-sintetico',
    '/pasto-sintetico/jardines': '/pasto-sintetico',
    '/pasto-sintetico/mantenimiento': '/pasto-sintetico',
    '/pasto-sintetico/areas-verdes': '/pasto-sintetico',
    '/pasto-sintetico/tipos-de-hilos': '/pasto-sintetico',
    '/pasto-sintetico/proyectos': '/pasto-sintetico',
    '/decorador-virtual/roomvo': '/', // hoy es una sección del home, no una página aparte
    '/login': '/admin', // login viejo del administrador

    // Pisos híbridos (línea KIWI ... OAK): descontinuada por el proveedor, confirmado por Alex/Selene
    // (commit 067427c). Sin sustituto directo, así que van al catálogo general.
    '/pisos-hibridos': '/catalogo',
    '/pisos-hibridos/catalogo': '/catalogo',
    '/pisos-hibridos/catalogo/producto/T04-91800-00010': '/catalogo',
    '/pisos-hibridos/catalogo/producto/T04-91800-00063': '/catalogo',
    '/pisos-hibridos/catalogo/producto/T04-91800-00522': '/catalogo',
    '/pisos-hibridos/catalogo/producto/T04-91800-00542': '/catalogo',
    '/pisos-hibridos/catalogo/producto/T04-91800-00782': '/catalogo',
    '/pisos-hibridos/catalogo/producto/T04-91800-00792': '/catalogo',
  },
  adapter: vercel(),
  integrations: [redireccionesPostBuild],
  vite: {
    plugins: [tailwindcss()],
  },
});
