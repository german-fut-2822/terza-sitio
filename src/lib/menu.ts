// Enlaces y fotos del mega menú a partir del catálogo:
// - cada colección abre su categoría ya filtrada (p. ej. "Colección Bilbao" → /catalogo/piso-vinilico?estilo=Bilbao)
// - "Ver más" abre el listado de la subcategoría elegida
// - la foto de cada colección es la de su primer producto (o la portada de la categoría)
import { categoriaDe, productosDe, urlCategoria, urlProducto, foto, type Producto } from './catalogo';

// Subcategoría del menú (general.json) → categoría del catálogo y, si hace falta, filtro fijo
const destino: Record<string, { categoria: string; filtro?: string; fichas?: boolean }> = {
  'pisos-vinilicos': { categoria: 'piso-vinilico' },
  'pisos-laminados': { categoria: 'pisos-laminados' },
  // Una sola colección (Kiwi): el menú muestra sus colores y cada uno abre su ficha
  'pisos-hibridos': { categoria: 'pisos-hibridos', fichas: true },
  'pisos-de-madera': { categoria: 'pisos-de-madera' },
  alfombras: { categoria: 'alfombras' },
  'lambrin-y-paneles': { categoria: 'paneles' },
  flexiroc: { categoria: 'flexiroc' },
  'follaje-artificial': { categoria: 'muros-verdes' },
  'persianas-enrollables': { categoria: 'persianas-enrollables' },
  'persianas-de-madera': { categoria: 'persianas-de-madera' },
  deck: { categoria: 'pisos-deck' },
  'pasto-sintetico': { categoria: 'pasto-sintetico' },
  // Accesorios es una sola categoría; el tipo separa los de piso de los de exterior
  'para-piso': { categoria: 'accesorios', filtro: 'tipo=Adhesivo|Accesorios Piso Laminado|Accesorios Piso Vinilico' },
  'para-exterior': { categoria: 'accesorios', filtro: 'tipo=Accesorios Deck' },
};

const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const sinPrefijo = (item: string) => item.replace(/^Colección\s+/i, '');

// Tarjetas con producto y filtro elegidos a mano (cuando el nombre del menú no coincide con el catálogo)
const elegidos: Record<string, { sku: string; filtro?: string }> = {
  'lambrin-y-paneles|Panel Liso Tipo Madera': { sku: 'T15-TWPPL-00112', filtro: 'estilo=Panel' }, // Panel Dark Walnut
};

// Producto que representa a la colección: primero el elegido a mano, luego por filtro (estilo, línea…) y luego por nombre
const buscar = (grupo: string, item: string): { p: Producto; campo?: string; filtro?: string } | undefined => {
  const d = destino[grupo];
  if (!d) return;
  const elegido = elegidos[`${grupo}|${item}`];
  if (elegido) {
    const p = productosDe(d.categoria).find((x) => x.sku === elegido.sku);
    if (p) return { p, filtro: elegido.filtro };
  }
  const nombre = normalizar(sinPrefijo(item));
  const lista = productosDe(d.categoria);
  for (const p of lista) {
    for (const [campo, valor] of Object.entries(p.filtros as Record<string, string>)) {
      if (normalizar(valor).startsWith(nombre)) return { p, campo };
    }
  }
  // Sin filtro que coincida: buscar el nombre (o su singular) en la familia y variante
  const raiz = nombre.replace(/e?s$/, '');
  const p = lista.find((x) => normalizar(`${x.familia} ${x.variante}`).includes(raiz));
  return p ? { p } : undefined;
};

export const urlGrupo = (grupo: string) => {
  const d = destino[grupo];
  if (!d) return '/catalogo';
  return `${urlCategoria(d.categoria)}${d.filtro ? `?${d.filtro.replace(/ /g, '%20')}` : ''}`;
};

export const urlColeccion = (grupo: string, item: string) => {
  const hallado = buscar(grupo, item);
  if (hallado && destino[grupo].fichas) return urlProducto(hallado.p);
  if (hallado?.filtro) return `${urlCategoria(destino[grupo].categoria)}?${hallado.filtro}`;
  if (hallado?.campo) return `${urlCategoria(destino[grupo].categoria)}?${hallado.campo}=${encodeURIComponent(sinPrefijo(item))}`;
  return urlGrupo(grupo);
};

export const fotoColeccion = (grupo: string, item: string) => {
  const hallado = buscar(grupo, item);
  if (hallado?.p.fotos[0]) return foto(hallado.p.fotos[0], 'sm');
  const d = destino[grupo];
  return d ? foto(categoriaDe(d.categoria).portada, 'sm') : null;
};
