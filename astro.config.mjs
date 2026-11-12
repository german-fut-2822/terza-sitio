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
const redireccionesConMayusculas = {
  name: 'redirecciones-con-mayusculas',
  hooks: {
    'astro:build:done': () => {
      const archivo = new URL('./.vercel/output/config.json', import.meta.url);
      if (!existsSync(archivo)) return;
      const config = JSON.parse(readFileSync(archivo, 'utf-8'));
      const nuevas = Object.entries(redireccionesExactas).map(([origen, destino]) => ({
        src: `^${escaparRegex(origen)}$`,
        headers: { Location: destino },
        status: 301,
        caseSensitive: true,
      }));
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
  },
  adapter: vercel(),
  integrations: [redireccionesConMayusculas],
  vite: {
    plugins: [tailwindcss()],
  },
});
