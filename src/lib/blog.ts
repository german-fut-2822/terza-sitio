// Acceso a las notas del blog (src/content/blog, ver src/content.config.ts y scripts/importar-blog.mjs)
import { getCollection, type CollectionEntry } from 'astro:content';

export type Nota = CollectionEntry<'blog'>;
export type CategoriaBlog = CollectionEntry<'blogCategorias'>;

// Notas publicadas: las destacadas primero y después de la más reciente a la más antigua.
// Los borradores no salen en ningún lado (tampoco en local) hasta que se publiquen desde el panel.
export async function notasPublicadas() {
  const notas = await getCollection('blog', (n) => !n.data.borrador);
  return notas.sort((a, b) => Number(b.data.destacada) - Number(a.data.destacada) || b.data.fecha.valueOf() - a.data.fecha.valueOf());
}

export const categoriasBlog = () => getCollection('blogCategorias');

export const urlNota = (n: Nota) => `/blog/${n.id}`;

export const fechaNota = (fecha: Date) =>
  fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

// Minutos de lectura a 200 palabras por minuto
export const minutosLectura = (n: Nota) => Math.max(1, Math.round((n.body ?? '').split(/\s+/).length / 200));
