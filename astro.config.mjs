import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';

// Dominio con el que se arman las URLs completas (canonical y vista previa al compartir):
// SITE_URL si se define; si no, el dominio de producción que Vercel asigna al proyecto; si no, terza.com
const dominioVercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const site = process.env.SITE_URL ?? (dominioVercel ? `https://${dominioVercel}` : 'https://terza.com');

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
  },
  adapter: vercel(),
  vite: {
    plugins: [tailwindcss()],
  },
});
