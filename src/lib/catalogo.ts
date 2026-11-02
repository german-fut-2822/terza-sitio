// Acceso al catálogo importado de terza.com (src/data/catalogo.json, ver scripts/importar-catalogo.mjs)
import data from '../data/catalogo.json';

export type Producto = (typeof data.productos)[number];
export type Categoria = (typeof data.categorias)[number];

// Portadas elegidas a mano (el importador toma la primera foto de cada categoría); sobreviven a una nueva importación
const PORTADAS: Record<string, string> = {
  paneles: 't15-pvcms-063y9-mineral-gray', // Sala con Panel Marble Mineral Gray y panel Classic Walnut
};

export const categorias: Categoria[] = data.categorias.map((c) => ({ ...c, portada: PORTADAS[c.slug] ?? c.portada }));
export const productos: Producto[] = data.productos;

// Secciones del catálogo en el mismo orden que el menú
export const secciones = [...new Set(categorias.map((c) => c.seccion))].map((nombre) => ({
  nombre,
  id: nombre.toLowerCase(),
  categorias: categorias.filter((c) => c.seccion === nombre),
}));

export const ETIQUETAS_FILTRO: Record<string, string> = {
  estilo: 'Estilo',
  tono: 'Tono',
  uso: 'Uso',
  especie: 'Especie',
  color: 'Color',
  linea: 'Línea',
  coleccion: 'Colección',
  tipo: 'Tipo',
  unidad: 'Presentación',
};

export const foto = (base: string | null | undefined, tamano: 'lg' | 'sm' = 'lg') =>
  base ? `${data.rutaFotos}${tamano === 'sm' ? '/sm' : ''}/${base}.webp` : null;

export const urlCategoria = (slug: string) => `/catalogo/${slug}`;

// Páginas con la información de cada línea de producto (como terza.com/alfombras); se agregan aquí conforme existan
export const paginasLinea: Record<string, { href: string; etiqueta: string }> = {
  'piso-vinilico': { href: '/pisos/pisos-vinilicos', etiqueta: 'Conoce más sobre pisos vinílicos' },
  'pisos-laminados': { href: '/pisos/pisos-laminados', etiqueta: 'Conoce más sobre pisos laminados' },
  'pisos-de-madera': { href: '/pisos/pisos-de-madera', etiqueta: 'Conoce más sobre pisos de madera' },
  alfombras: { href: '/pisos/alfombras', etiqueta: 'Conoce más sobre alfombras' },
  paneles: { href: '/muros/lambrin-y-paneles', etiqueta: 'Conoce más sobre lambrín y paneles' },
  'muros-verdes': { href: '/muros/follaje-artificial', etiqueta: 'Conoce más sobre follaje artificial' },
  'persianas-enrollables': { href: '/persianas', etiqueta: 'Conoce más sobre persianas' },
  'persianas-de-madera': { href: '/persianas', etiqueta: 'Conoce más sobre persianas' },
  'pisos-deck': { href: '/exterior/deck', etiqueta: 'Conoce más sobre pisos deck' },
  'pasto-sintetico': { href: '/exterior/pasto-sintetico', etiqueta: 'Conoce más sobre pasto sintético' },
};

export const urlProducto = (p: Pick<Producto, 'categoria' | 'slug'>) => `/catalogo/${p.categoria}/${p.slug}`;

export const categoriaDe = (slug: string) => categorias.find((c) => c.slug === slug)!;
export const productosDe = (slug: string) => productos.filter((p) => p.categoria === slug);

// Los demás colores de la misma familia (para las muestras de la ficha)
export const familiaDe = (p: Producto) =>
  productos.filter((x) => x.categoria === p.categoria && x.familia === p.familia);

// Opciones de cada filtro de una categoría, con cuántos productos tiene cada una
export const opcionesDe = (slug: string) => {
  const cat = categoriaDe(slug);
  const lista = productosDe(slug);
  return cat.filtros.map((campo) => {
    const conteo = new Map<string, number>();
    for (const p of lista) {
      const valor = (p.filtros as Record<string, string>)[campo];
      if (valor) conteo.set(valor, (conteo.get(valor) ?? 0) + 1);
    }
    return {
      campo,
      etiqueta: ETIQUETAS_FILTRO[campo] ?? campo,
      opciones: [...conteo].sort((a, b) => a[0].localeCompare(b[0], 'es')).map(([valor, total]) => ({ valor, total })),
    };
  }).filter((f) => f.opciones.length > 1);
};
