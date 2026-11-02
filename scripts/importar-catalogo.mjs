// Importa el catálogo de terza.com: normaliza los productos y descarga las fotos optimizadas.
//
// Uso:
//   node scripts/importar-catalogo.mjs                 → descarga el índice de terza.com
//   node scripts/importar-catalogo.mjs ruta/al.json    → usa un search-file.json local
//
// Genera src/data/catalogo.json y las fotos en public/assets/catalogo/ (1000 px para la ficha y 400 px en sm/ para tarjetas
// y muestras de color). Las que ya existen no se vuelven a bajar.
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import sharp from 'sharp';
import { generarOg } from './generar-og.mjs';

const ORIGEN = 'https://www.terza.com';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const DIR_FOTOS = 'public/assets/catalogo';
const RUTA_FOTOS = '/assets/catalogo';

// Categorías del catálogo público de terza.com (tapetes no están publicados ahí; los híbridos llegan como "pisos_rigidos")
const CATEGORIAS = [
  { slug: 'piso-vinilico', nombre: 'Pisos vinílicos', seccion: 'Pisos', tipo: 'viniles', filtros: ['estilo'], intro: 'Resistentes al agua y al tráfico diario, con la apariencia de la madera y la piedra.' },
  { slug: 'pisos-laminados', nombre: 'Pisos laminados', seccion: 'Pisos', tipo: 'laminados', filtros: ['estilo', 'tono'], intro: 'Vetas naturales y gran resistencia al desgaste para cada espacio de la casa.' },
  { slug: 'pisos-hibridos', nombre: 'Pisos híbridos', seccion: 'Pisos', tipo: 'pisos_rigidos', filtros: ['coleccion'], intro: 'Lo mejor de los pisos vinílicos y los laminados en uno: resistentes al agua y fáciles de instalar con sistema de clic.' },
  { slug: 'pisos-de-madera', nombre: 'Pisos de madera', seccion: 'Pisos', tipo: 'maderas', filtros: ['estilo', 'especie'], intro: 'Madera de ingeniería con chapas nobles y acabados que resaltan la veta.' },
  { slug: 'alfombras', nombre: 'Alfombras', seccion: 'Alfombras', tipo: 'alfombras', filtros: ['estilo', 'tono', 'uso'], intro: 'Calidez, confort y mejor acústica para residencias, oficinas y hoteles.' },
  { slug: 'paneles', nombre: 'Lambrín y paneles', seccion: 'Muros', tipo: 'paneles', filtros: ['estilo'], intro: 'Lambrín y paneles que transforman muros en minutos, sin obra ni polvo.' },
  { slug: 'flexiroc', nombre: 'Flexiroc', seccion: 'Muros', tipo: 'flexiroc', filtros: [], intro: 'Recubrimiento de piedra flexible que se adapta a muros curvos, columnas y fachadas.' },
  { slug: 'muros-verdes', nombre: 'Follaje artificial', seccion: 'Muros', tipo: 'greenwall', filtros: ['unidad'], intro: 'Muros verdes que no necesitan riego ni poda y se ven vivos todo el año.' },
  { slug: 'persianas-enrollables', nombre: 'Persianas enrollables', seccion: 'Persianas', tipo: 'persianas', sku: /^T24/, filtros: ['linea', 'coleccion', 'tipo'], intro: 'Control de luz y privacidad con telas screen, blackout y traslúcidas.' },
  { slug: 'persianas-de-madera', nombre: 'Persianas de madera', seccion: 'Persianas', tipo: 'persianas', sku: /^(T25|TT2)/, filtros: ['linea', 'coleccion'], intro: 'Persianas de madera y madera sintética con la calidez de un acabado natural.' },
  { slug: 'pisos-deck', nombre: 'Deck', seccion: 'Exterior', tipo: 'deck', filtros: ['estilo', 'color'], intro: 'Deck, lambrín de exterior y fachadas que resisten sol y lluvia.' },
  { slug: 'pasto-sintetico', nombre: 'Pasto sintético', seccion: 'Exterior', tipo: 'pastos', filtros: ['estilo'], intro: 'Césped sintético para jardines, terrazas y áreas de juego, verde todo el año.' },
  { slug: 'accesorios', nombre: 'Accesorios', seccion: 'Accesorios', tipo: 'accesorios', filtros: ['tipo'], intro: 'Molduras, zoclos, adhesivos y todo lo necesario para instalar y mantener tus superficies.' },
];

// Nombre de familia (lo que se repite entre colores) y variante de cada producto
const NOMBRES = {
  alfombras: (p) => [p.estilo, p.color],
  viniles: (p) => [p.estilo, p.color],
  laminados: (p) => [p.estilo, p.color],
  maderas: (p) => [p.estilo, p.color],
  pisos_rigidos: (p) => [p.coleccion, p.color],
  paneles: (p) => [p.estilo, p.color],
  deck: (p) => [p.estilo, p.color],
  persianas: (p) => [p.coleccion, p.color],
  pastos: (p) => [p.estilo, p.coleccion],
  greenwall: (p) => [p.coleccion, p.estilo],
  flexiroc: (p) => ['Flexiroc', p.nombre],
  accesorios: (p) => [p.linea || p.tipo || 'Accesorios', p.nombre],
};

// Etiquetas de la ficha técnica, en el orden en que se muestran
const ETIQUETAS = {
  nombre: 'Nombre', estilo: 'Estilo', coleccion: 'Colección', linea: 'Línea', color: 'Color', clave_color: 'Clave de color',
  codigo_color: 'Código de color', tono: 'Tono', tipo: 'Tipo', especie: 'Especie', fibra: 'Fibra', composicion: 'Composición',
  acabado: 'Acabado', chapa: 'Chapa', brillo: 'Brillo', medidas: 'Medidas', ancho: 'Ancho', largo: 'Largo', longitud: 'Longitud',
  alto: 'Alto', altura: 'Altura', espesor: 'Espesor', desgaste: 'Capa de desgaste', peso: 'Peso', biselado: 'Biselado',
  instalacion: 'Instalación', resistencia: 'Resistencia', apertura: 'Apertura', bloqueo: 'Bloqueo de luz', unidad: 'Presentación',
  piezas: 'Piezas por caja', m2_cj: 'm² por caja', metros: 'Metros por caja', uso: 'Uso', sku: 'SKU',
};

const limpiar = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
// Siglas que se dejan en mayúsculas al pasar los nombres a tipo título
const SIGLAS = new Set(['ESD', 'LVT', 'PVC', 'MDF', 'SPC', 'WPC', 'UV', 'BCF', 'HB', 'BO', 'LF', 'RD', 'II', 'III', 'IX', 'AC3', 'AC4', 'AC5', 'MM', 'CM', 'GR']);
const titulo = (t) =>
  limpiar(t)
    .toLowerCase()
    .replace(/(^|[\s(/-])([a-záéíóúñ])/g, (m, a, b) => a + b.toUpperCase())
    .replace(/[A-Za-zÁÉÍÓÚÑáéíóúñ0-9]+/g, (w) => (SIGLAS.has(w.toUpperCase()) ? w.toUpperCase() : w));
const slug = (t) => limpiar(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function leerIndice() {
  const ruta = process.argv[2];
  if (ruta) return JSON.parse(await readFile(ruta, 'utf8'));
  const r = await fetch(`${ORIGEN}/storage/search-file.json`, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`No se pudo descargar el índice (${r.status})`);
  return r.json();
}

const existe = (ruta) => access(ruta).then(() => true, () => false);

async function bajarFoto(archivo, base) {
  const grande = `${DIR_FOTOS}/${base}.webp`;
  const chica = `${DIR_FOTOS}/sm/${base}.webp`;
  if ((await existe(grande)) && (await existe(chica))) return true;
  const r = await fetch(`${ORIGEN}/catalogo/${encodeURIComponent(archivo)}`, { headers: { 'User-Agent': UA } });
  if (!r.ok) return false;
  const buffer = Buffer.from(await r.arrayBuffer());
  await sharp(buffer).resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true }).webp({ quality: 68, effort: 6 }).toFile(grande);
  await sharp(buffer).resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 62, effort: 6 }).toFile(chica);
  return true;
}

async function enParalelo(tareas, limite = 8) {
  const resultados = [];
  let i = 0;
  const trabajador = async () => {
    while (i < tareas.length) {
      const j = i++;
      resultados[j] = await tareas[j]();
    }
  };
  await Promise.all(Array.from({ length: limite }, trabajador));
  return resultados;
}

const { productos: crudos } = await leerIndice();
await mkdir(`${DIR_FOTOS}/sm`, { recursive: true });

const productos = [];
const descargas = new Map();
for (const cat of CATEGORIAS) {
  const lista = crudos.filter((p) => p.tipo_producto === cat.tipo && (!cat.sku || cat.sku.test(p.sku)));
  for (const p of lista) {
    const [familia, variante] = NOMBRES[cat.tipo](p).map(limpiar);
    const archivos = [...String(p.imagen || '').matchAll(/\{([^}]+)\}/g)].map((m) => limpiar(m[1]));
    const fotos = archivos.map((archivo) => {
      const base = slug(archivo.replace(/\.[a-z]+$/i, ''));
      descargas.set(base, archivo);
      return base;
    });
    const specs = Object.entries(ETIQUETAS)
      .map(([campo, etiqueta]) => [etiqueta, limpiar(p[campo])])
      .filter(([, valor]) => valor);
    productos.push({
      sku: limpiar(p.sku),
      slug: slug(p.sku),
      categoria: cat.slug,
      familia: titulo(familia),
      variante: titulo(variante),
      nuevo: Boolean(p.es_nuevo),
      descripcion: limpiar(p.descripcion),
      fotos,
      specs,
      filtros: Object.fromEntries(cat.filtros.map((f) => [f, titulo(p[f])]).filter(([, v]) => v)),
    });
  }
}

console.log(`Descargando ${descargas.size} fotos…`);
const fallidas = [];
let hechas = 0;
await enParalelo(
  [...descargas].map(([base, archivo]) => async () => {
    const ok = await bajarFoto(archivo, base).catch(() => false);
    if (!ok) fallidas.push(archivo);
    if (++hechas % 100 === 0) console.log(`  ${hechas}/${descargas.size}`);
  }),
);

// Quitar de cada producto las fotos que no se pudieron bajar
const sinFoto = new Set(fallidas.map((a) => slug(a.replace(/\.[a-z]+$/i, ''))));
for (const p of productos) p.fotos = p.fotos.filter((f) => !sinFoto.has(f));

const categorias = CATEGORIAS.map(({ sku, tipo, ...cat }) => ({
  ...cat,
  total: productos.filter((p) => p.categoria === cat.slug).length,
  portada: productos.find((p) => p.categoria === cat.slug && p.fotos.length)?.fotos[0] ?? null,
}));

await writeFile('src/data/catalogo.json', JSON.stringify({ rutaFotos: RUTA_FOTOS, categorias, productos }, null, 1));
console.log(`Listo: ${productos.length} productos en ${categorias.length} categorías.`);
if (fallidas.length) console.log(`Fotos que no se pudieron bajar (${fallidas.length}):`, fallidas.join(', '));

// Versiones JPG para la vista previa al compartir (WhatsApp no muestra WebP)
await generarOg();
