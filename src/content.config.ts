// Colecciones de contenido editable (blog). Cada nota es un archivo Markdown en src/content/blog con sus datos en el
// encabezado; el esquema de abajo es el contrato que debe respetar un futuro administrador de notas.
import { defineCollection, reference } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';

const blogCategorias = defineCollection({
  // El JSON es { categorias: [...] } para que el administrador (/admin) pueda editarlo como lista
  loader: file('src/data/blog-categorias.json', { parser: (texto) => JSON.parse(texto).categorias }),
  schema: z.object({
    nombre: z.string(),
    // Página de la línea de producto relacionada (se muestra como liga al final de la nota)
    pagina: z.string().optional(),
  }),
});

const blog = defineCollection({
  // El nombre del archivo es la dirección de la nota: src/content/blog/mi-nota.md → /blog/mi-nota
  loader: glob({ base: './src/content/blog', pattern: '**/*.md' }),
  schema: ({ image }) =>
    z.object({
      titulo: z.string(),
      descripcion: z.string().default(''), // resumen de la tarjeta y meta description; opcional en el panel
      fecha: z.coerce.date(),
      autor: z.string().default('Terza'),
      imagen: image(),
      imagenAlt: z.string(),
      categorias: z.array(reference('blogCategorias')).default([]),
      destacada: z.boolean().default(false), // aparece primero en el listado y en la home
      borrador: z.boolean().default(false), // no se publica
    }),
});

export const collections = { blog, blogCategorias };
