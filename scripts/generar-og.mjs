// Genera las imágenes JPG para compartir (WhatsApp no muestra WebP en la vista previa de un enlace).
//
// Uso:
//   node scripts/generar-og.mjs
//
// Crea public/assets/catalogo/og/<foto>.jpg (400×400, ~30 KB) a partir de la foto principal de cada producto y de la
// portada de cada categoría (incluidas las elegidas a mano en src/lib/catalogo.ts). Las que ya existen no se rehacen.
// El importador (importar-catalogo.mjs) lo llama al terminar.
import { mkdir, readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const DIR_FOTOS = 'public/assets/catalogo';
const DIR_OG = `${DIR_FOTOS}/og`;
const existe = (ruta) => access(ruta).then(() => true, () => false);

export async function generarOg() {
  const { categorias, productos } = JSON.parse(await readFile('src/data/catalogo.json', 'utf8'));
  // Portadas elegidas a mano en src/lib/catalogo.ts (const PORTADAS = { slug: 'foto', ... })
  const lib = await readFile('src/lib/catalogo.ts', 'utf8');
  const bloque = lib.match(/const PORTADAS[^{]*\{([\s\S]*?)\};/)?.[1] ?? '';
  const portadasAMano = [...bloque.matchAll(/:\s*'([^']+)'/g)].map((m) => m[1]);

  const bases = new Set([...productos.map((p) => p.fotos[0]), ...categorias.map((c) => c.portada), ...portadasAMano].filter(Boolean));
  await mkdir(DIR_OG, { recursive: true });

  let hechas = 0;
  for (const base of bases) {
    const destino = `${DIR_OG}/${base}.jpg`;
    const origen = `${DIR_FOTOS}/${base}.webp`;
    if ((await existe(destino)) || !(await existe(origen))) continue;
    await sharp(origen).resize(400, 400, { fit: 'cover' }).jpeg({ quality: 70, progressive: true, mozjpeg: true }).toFile(destino);
    hechas++;
  }
  console.log(`Imágenes para compartir: ${hechas} nuevas (${bases.size} en total).`);
}

// Ejecutado directo con node
if (process.argv[1] === fileURLToPath(import.meta.url)) await generarOg();
