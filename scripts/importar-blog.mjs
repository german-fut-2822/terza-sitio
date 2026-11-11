// Importa las notas del blog de terza.com como archivos Markdown (una nota por archivo, lista para editarse
// después desde un administrador).
//
// Uso:
//   node scripts/importar-blog.mjs           → descarga las notas que todavía no existen
//   node scripts/importar-blog.mjs --todas   → vuelve a generar todas (sobrescribe los .md existentes)
//
// Genera src/content/blog/<slug>.md (datos de la nota en el encabezado y el texto en Markdown) y las imágenes en
// src/assets/blog/. Las categorías están en src/data/blog-categorias.json. Las páginas descargadas se guardan en
// node_modules/.cache/blog-terza para no volver a pedirlas.
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { parse, ELEMENT_NODE, TEXT_NODE } from 'ultrahtml';
import sharp from 'sharp';

const ORIGEN = 'https://www.terza.com';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const DIR_NOTAS = 'src/content/blog';
const DIR_FOTOS = 'src/assets/blog';
const DIR_CACHE = 'node_modules/.cache/blog-terza';
const TODAS = process.argv.includes('--todas');

// Categorías de terza.com (data-cat-id) → slug de src/data/blog-categorias.json
const CATEGORIAS = {
  1: 'alfombras', 2: 'tapetes', 3: 'pasto-sintetico', 4: 'follaje-artificial', 5: 'persianas',
  6: 'pisos-de-madera', 7: 'deck', 8: 'pisos-vinilicos', 9: 'pisos-laminados', 10: 'lambrin-y-paneles',
};

// Páginas de terza.com que ya existen en este sitio (las demás ligas se quedan apuntando a terza.com)
const RUTAS = {
  '/': '/', '/alfombras': '/alfombras', '/pisos-deck': '/pisos-deck', '/lambrin-pvc': '/lambrin-y-paneles',
  '/muros-verdes': '/muros-verdes', '/pasto-sintetico': '/pasto-sintetico', '/persianas': '/persianas',
  '/pisos-laminados': '/pisos-laminados', '/pisos-de-madera': '/pisos-de-madera', '/piso-vinilico': '/pisos-vinilicos',
  '/contacto': '/contacto', '/distribuidor': '/quiero-ser-distribuidor', '/quienes-somos': '/quienes-somos',
  '/catalogos': '/catalogos-digitales', '/blog': '/blog', '/panel-pvc': '/lambrin-y-paneles',
};

// Catálogo ya importado (scripts/importar-catalogo.mjs) para llevar las ligas de producto a este sitio
const catalogo = JSON.parse(await readFile('src/data/catalogo.json', 'utf8'));

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const existe = (ruta) => access(ruta).then(() => true, () => false);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Descarga una página de terza.com (con caché local)
async function pagina(ruta) {
  const archivo = `${DIR_CACHE}/${ruta.replace(/[^a-z0-9]+/gi, '_')}.html`;
  if (await existe(archivo)) return readFile(archivo, 'utf8');
  for (let intento = 1; ; intento++) {
    const r = await fetch(ORIGEN + ruta, { headers: { 'User-Agent': UA } });
    if (r.ok) {
      const html = await r.text();
      await writeFile(archivo, html);
      return html;
    }
    if (intento === 3) throw new Error(`${ruta}: ${r.status}`);
    await esperar(1500 * intento);
  }
}

// Entidades HTML más comunes
const ENTIDADES = { nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', iexcl: '¡', iquest: '¿', laquo: '«', raquo: '»',
  ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', bull: '•', deg: '°', middot: '·', reg: '®', copy: '©', trade: '™' };
const decodificar = (t) =>
  t.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    if (ENTIDADES[e]) return ENTIDADES[e];
    const acento = e.match(/^([aeiounAEIOUN])(acute|tilde|uml)$/);
    if (acento) return (acento[1] + { acute: '\u0301', tilde: '\u0303', uml: '\u0308' }[acento[2]]).normalize('NFC');
    return m;
  });
const textoPlano = (html) => decodificar(html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

const fecha = (t) => {
  const [d, m, a] = t.split('/').map((x) => x.trim().toLowerCase());
  return `${a}-${String(MESES.indexOf(m) + 1).padStart(2, '0')}-${d.padStart(2, '0')}`;
};

// Liga de terza.com → ruta de este sitio
function liga(href) {
  href = decodificar(href.trim());
  let url;
  try { url = new URL(href, ORIGEN); } catch { return href; }
  if (!/(^|\.)terza\.com$/.test(url.hostname)) return href;
  const ruta = url.pathname.replace(/\/$/, '') || '/';
  const nota = ruta.match(/^\/blog\/post\/([^/]+)/);
  if (nota) return `/blog/${nota[1]}`;
  const producto = ruta.match(/^\/[^/]+\/catalogo\/producto\/([^/]+)/);
  const p = producto && catalogo.productos.find((x) => x.sku.toLowerCase() === producto[1].toLowerCase());
  if (p) return `/catalogo/${p.categoria}/${p.slug}`;
  const categoria = ruta.match(/^\/([^/]+)\/catalogo$/);
  if (categoria && catalogo.categorias.some((c) => c.slug === categoria[1])) return `/catalogo/${categoria[1]}`;
  const local = RUTAS[ruta] ?? RUTAS[Object.keys(RUTAS).find((r) => r !== '/' && ruta.startsWith(r + '/')) ?? ''];
  return local ? local + url.hash : url.href;
}

// Baja una imagen de terza.com y la guarda en src/assets/blog (máx. 1600 px); devuelve el nombre del archivo
async function imagen(src, nombre) {
  const destino = `${DIR_FOTOS}/${nombre}.jpg`;
  if (!(await existe(destino))) {
    const r = await fetch(new URL(src.trim(), ORIGEN), { headers: { 'User-Agent': UA } });
    if (!r.ok) throw new Error(`${src}: ${r.status}`);
    await sharp(Buffer.from(await r.arrayBuffer()))
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 82, progressive: true, mozjpeg: true })
      .toFile(destino);
  }
  return `${nombre}.jpg`;
}

// ---------- HTML de la nota → Markdown ----------
const estilo = (n) => (n.attributes?.style ?? '').replace(/\s/g, '').toLowerCase();
const esNegrita = (n) => {
  const s = estilo(n);
  if (/font-weight:(normal|400)/.test(s)) return false;
  return ['b', 'strong'].includes(n.name) || /font-weight:(bold|[6-9]00)/.test(s);
};
const esCursiva = (n) => ['i', 'em'].includes(n.name) || /font-style:italic/.test(estilo(n));
const BLOQUES = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table', 'blockquote', 'iframe', 'img', 'figure', 'hr', 'section', 'article']);

const escapar = (t) => t.replace(/([\\*_`[\]])/g, '\\$1').replace(/</g, '&lt;');

// Texto en línea: devuelve una lista de tramos { t, b, i, href } para unir los que tienen el mismo formato
function tramos(nodo, fmt = {}, salida = []) {
  for (const n of nodo.children ?? []) {
    if (n.type === TEXT_NODE) salida.push({ ...fmt, t: decodificar(n.value).replace(/[\s\u00a0]+/g, ' ') });
    else if (n.type === ELEMENT_NODE) {
      if (n.name === 'br') salida.push({ ...fmt, br: true, t: '' });
      else if (n.name === 'img') salida.push({ img: n.attributes, t: '' });
      else if (n.name === 'a' && n.attributes.href && !n.attributes.href.startsWith('#'))
        tramos(n, { ...fmt, href: liga(n.attributes.href) }, salida);
      else tramos(n, { ...fmt, b: fmt.b || esNegrita(n), i: fmt.i || esCursiva(n) }, salida);
    }
  }
  return salida;
}

// Une tramos en Markdown, sacando los espacios de los marcadores (** palabra ** no es negrita en Markdown)
function enLinea(lista) {
  const grupos = [];
  for (const x of lista) {
    const ult = grupos.at(-1);
    if (ult && !x.br && !ult.br && !x.img && !ult.img && ult.b === x.b && ult.i === x.i && ult.href === x.href) ult.t += x.t;
    else grupos.push({ ...x });
  }
  let md = '';
  for (const g of grupos) {
    if (g.br) { md += '\n'; continue; }
    if (g.img) continue;
    const [, ini, cuerpo, fin] = g.t.match(/^(\s*)([\s\S]*?)(\s*)$/);
    if (!cuerpo) { md += g.t; continue; }
    let t = escapar(cuerpo);
    if (g.i) t = `*${t}*`;
    if (g.b) t = `**${t}**`;
    if (g.href) t = `[${t}](${g.href})`;
    md += ini + t + fin;
  }
  return md
    .replace(/\*\*\*\*/g, '') // negritas contiguas
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .replace(/\n/g, '  \n');
}

// Un párrafo que es todo negrita y corto se trata como subtítulo
function comoSubtitulo(lista) {
  const conTexto = lista.filter((x) => x.t.trim());
  const texto = conTexto.map((x) => x.t).join('').trim();
  return conTexto.length && conTexto.every((x) => x.b && !x.href) && texto.length <= 140 && !lista.some((x) => x.img) ? texto : null;
}

async function aMarkdown(nodo, ctx, prof = 0) {
  const bloques = [];
  let suelto = []; // texto en línea fuera de un bloque (p. ej. directamente dentro de un div)

  const cerrarSuelto = async () => {
    if (!suelto.length) return;
    const falso = { children: suelto };
    suelto = [];
    bloques.push(...(await parrafo(falso, ctx)));
  };

  for (const n of nodo.children ?? []) {
    if (n.type === TEXT_NODE || (n.type === ELEMENT_NODE && !BLOQUES.has(n.name))) {
      // Un <b> de Google Docs puede envolver párrafos completos
      if (n.type === ELEMENT_NODE && (n.children ?? []).some((h) => h.type === ELEMENT_NODE && BLOQUES.has(h.name))) {
        await cerrarSuelto();
        bloques.push(...(await aMarkdown(n, ctx, prof)));
      } else suelto.push(n);
      continue;
    }
    if (n.type !== ELEMENT_NODE) continue;
    await cerrarSuelto();
    const nombre = n.name;
    if (['p', 'div', 'section', 'article', 'figure'].includes(nombre)) {
      if ((n.children ?? []).some((h) => h.type === ELEMENT_NODE && BLOQUES.has(h.name) && h.name !== 'img')) bloques.push(...(await aMarkdown(n, ctx, prof)));
      else bloques.push(...(await parrafo(n, ctx)));
    } else if (/^h[1-6]$/.test(nombre)) {
      const t = enLinea(tramos(n).map((x) => ({ ...x, b: false }))).replace(/\s*\n\s*/g, ' ');
      if (t) bloques.push(`${Number(nombre[1]) <= 2 ? '##' : '###'} ${t}`);
    } else if (nombre === 'ul' || nombre === 'ol') {
      bloques.push(await lista(n, ctx, prof));
    } else if (nombre === 'li') {
      bloques.push(...(await parrafo(n, ctx)));
    } else if (nombre === 'blockquote') {
      const dentro = await aMarkdown(n, ctx, prof);
      if (dentro.length) bloques.push(dentro.join('\n\n').replace(/^/gm, '> '));
    } else if (nombre === 'img') {
      bloques.push(...(await parrafo({ children: [n] }, ctx)));
    } else if (nombre === 'iframe' && n.attributes.src) {
      const src = n.attributes.src.replace(/^\/\//, 'https://');
      bloques.push(`<iframe src="${src}" title="${n.attributes.title ?? 'Video'}" loading="lazy" allowfullscreen></iframe>`);
    } else if (nombre === 'table') {
      bloques.push(tabla(n));
    } else if (nombre === 'hr') {
      bloques.push('---');
    }
  }
  await cerrarSuelto();
  return bloques.filter(Boolean);
}

async function parrafo(n, ctx) {
  const lista = tramos(n);
  const salida = [];
  const sub = comoSubtitulo(lista);
  // Los numerados ("1. Composición") quedan un nivel abajo
  if (sub) return [`${/^\d+[.)-]/.test(sub) ? '###' : '##'} ${escapar(sub)}`];
  const texto = enLinea(lista);
  if (texto) salida.push(texto);
  for (const x of lista.filter((y) => y.img?.src)) {
    if (/icono-|\.svg$/i.test(x.img.src)) continue;
    const archivo = await imagen(x.img.src, `${ctx.slug}-${++ctx.fotos}`);
    salida.push(`![${(decodificar(x.img.alt ?? '') || ctx.titulo).replace(/[[\]]/g, '')}](../../assets/blog/${archivo})`);
  }
  return salida;
}

async function lista(n, ctx, prof) {
  const ordenada = n.name === 'ol';
  const items = [];
  let num = Number(n.attributes?.start) || 1; // Google Docs parte las listas y sigue la numeración con start="2"
  for (const li of n.children ?? []) {
    if (li.type !== ELEMENT_NODE) continue;
    if (li.name === 'ul' || li.name === 'ol') { // lista anidada sin <li> de por medio
      if (items.length) items[items.length - 1] += '\n' + (await lista(li, ctx, prof + 1)).replace(/^/gm, '   ');
      continue;
    }
    const sublistas = (li.children ?? []).filter((h) => h.type === ELEMENT_NODE && (h.name === 'ul' || h.name === 'ol'));
    const resto = { children: (li.children ?? []).filter((h) => !sublistas.includes(h)) };
    const dentro = (await aMarkdown({ children: [{ type: ELEMENT_NODE, name: 'div', attributes: {}, children: resto.children }] }, ctx, prof))
      .map((b) => b.replace(/^#+ (.*)$/, '**$1**'))
      .join(' ')
      .trim();
    if (!dentro && !sublistas.length) continue;
    let item = `${ordenada ? `${num++}.` : '-'} ${dentro}`;
    for (const s of sublistas) item += '\n' + (await lista(s, ctx, prof + 1)).replace(/^/gm, '   ');
    items.push(item);
  }
  // Un solo punto numerado y corto ("2. Follaje para la entrada") seguido de su párrafo funciona como subtítulo
  const unico = items.length === 1 && ordenada && prof === 0 && items[0].match(/^(\d+)\. ([^\n]{1,140})$/);
  if (unico) return `### ${unico[1]}. ${unico[2].replace(/\*\*/g, '').replace(/\.$/, '')}`;
  return items.join('\n');
}

function tabla(n) {
  const filas = [];
  const buscar = (x) => (x.children ?? []).forEach((h) => (h.type === ELEMENT_NODE && h.name === 'tr' ? filas.push(h) : buscar(h)));
  buscar(n);
  const celdas = filas.map((f) => (f.children ?? []).filter((c) => c.type === ELEMENT_NODE && /^t[hd]$/.test(c.name))
    .map((c) => enLinea(tramos(c)).replace(/\s*\n\s*/g, ' ').replace(/\|/g, '\\|') || ' '));
  if (!celdas.length) return '';
  const ancho = Math.max(...celdas.map((c) => c.length));
  const fila = (c) => `| ${[...c, ...Array(ancho - c.length).fill(' ')].join(' | ')} |`;
  return [fila(celdas[0]), `|${' --- |'.repeat(ancho)}`, ...celdas.slice(1).map(fila)].join('\n');
}

// ---------- Recorrido de terza.com ----------
function tarjetas(html) {
  return [...html.matchAll(/<div class="item">([\s\S]*?)class="btn-cta">/g)].map(([, b]) => ({
    slug: b.match(/blog\/post\/([^"]+)"/)[1],
    portada: b.match(/<img src="([^"]+)"/)?.[1],
    portadaAlt: textoPlano(b.match(/<img [^>]*alt="([^"]*)"/)?.[1] ?? ''),
    fecha: fecha(textoPlano(b.match(/created-text[^>]*>([\s\S]*?)<\/p>/)[1])),
    descripcion: textoPlano(b.match(/class="metaDesc">([\s\S]*?)<\/p>/)?.[1] ?? ''),
  }));
}

async function listado(query) {
  const notas = [];
  for (let n = 1; ; n++) {
    const lote = tarjetas(await pagina(`/blog?${query}page=${n}`));
    notas.push(...lote);
    if (!lote.length || lote.length < 4) break;
  }
  return notas;
}

function yamlTexto(t) {
  return JSON.stringify(t); // las cadenas JSON son YAML válido
}

async function main() {
  await mkdir(DIR_NOTAS, { recursive: true });
  await mkdir(DIR_FOTOS, { recursive: true });
  await mkdir(DIR_CACHE, { recursive: true });

  // El listado de terza.com repite algunas notas entre páginas
  const notas = [...new Map((await listado('')).map((n) => [n.slug, n])).values()];
  console.log(`Notas en terza.com: ${notas.length}`);

  const categorias = new Map();
  for (const [id, slug] of Object.entries(CATEGORIAS)) {
    for (const nota of await listado(`category=${id}&`)) {
      categorias.set(nota.slug, [...new Set([...(categorias.get(nota.slug) ?? []), slug])]); // una nota sale repetida en el listado de su categoría
    }
  }

  let hechas = 0;
  for (const nota of notas) {
    const archivo = `${DIR_NOTAS}/${nota.slug}.md`;
    if (!TODAS && (await existe(archivo))) continue;
    const html = await pagina(`/blog/post/${nota.slug}`);
    const titulo = textoPlano(html.match(/<h1 class="fs-35">([\s\S]*?)<\/h1>/)?.[1] ?? nota.slug);
    const banner = html.match(/<div class="banner">\s*<img src="([^"]+)"[^>]*?alt="([^"]*)"/);
    const descripcion = textoPlano(html.match(/<meta name="description"\s+content="([^"]*)"/)?.[1] ?? '') || nota.descripcion;
    const inicio = html.indexOf('<div class="contenido">');
    const fin = html.indexOf('<div class="anterior">', inicio);
    const contenido = html.slice(inicio + '<div class="contenido">'.length, fin).replace(/<\/div>\s*$/, '');

    const ctx = { slug: nota.slug, titulo, fotos: 0 };
    const portadaSrc = banner?.[1] ?? nota.portada;
    const portada = portadaSrc ? await imagen(portadaSrc, nota.slug) : null;
    const cuerpo = (await aMarkdown(parse(contenido), ctx))
      .join('\n\n')
      .replace(/^((?:-|\d+\.) .*)\n\n(?=(?:-|\d+\.) )/gm, '$1\n') // Google Docs pone cada viñeta en su propia lista
      .replace(/\*\* \*\*/g, ' ') // negritas separadas solo por un espacio
      .replace(/^## (Preguntas frecuentes[\s\S]*)$/im, (faq) => faq.replace(/^## (¿)/gm, '### $1')) // preguntas bajo su título
      .replace(/\n{3,}/g, '\n\n');

    const encabezado = [
      '---',
      `titulo: ${yamlTexto(titulo)}`,
      `descripcion: ${yamlTexto(descripcion)}`,
      `fecha: ${nota.fecha}`,
      `autor: Terza`,
      portada ? `imagen: ../../assets/blog/${portada}` : null,
      `imagenAlt: ${yamlTexto(textoPlano(banner?.[2] ?? '') || nota.portadaAlt || titulo)}`,
      `categorias: [${(categorias.get(nota.slug) ?? []).join(', ')}]`,
      `destacada: false`,
      `borrador: false`,
      '---',
    ].filter((l) => l !== null);
    await writeFile(archivo, `${encabezado.join('\n')}\n\n${cuerpo}\n`);
    hechas++;
    process.stdout.write(`\r${hechas} notas generadas`);
  }
  console.log(`\nListo: ${hechas} notas nuevas o actualizadas en ${DIR_NOTAS}.`);
}

await main();
