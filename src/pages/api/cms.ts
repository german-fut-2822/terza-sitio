// API del administrador del blog. Habla el mismo protocolo que el servidor local de Decap ("proxy": POST con
// { action, params }), así que la usan tanto Decap (config.yml) como los listados propios (comun.js).
// Solo con sesión iniciada (src/lib/admin/sesion.ts); lee y guarda con src/lib/admin/almacen.ts (GitHub o la carpeta).
import type { APIRoute } from 'astro';
import { almacen, revisarCarpeta, revisarRuta, type Cambio } from '../../lib/admin/almacen';
import { usuarioDeSesion } from '../../lib/admin/sesion';

export const prerender = false;

const MAX_IMAGEN = 500 * 1024;
const json = (datos: unknown, status = 200) => new Response(JSON.stringify(datos), { status, headers: { 'Content-Type': 'application/json' } });

const deBase64 = (contenido: unknown) => Buffer.from(String(contenido ?? ''), 'base64');
function imagen(ruta: string, contenido: Buffer) {
  if (contenido.length > MAX_IMAGEN) throw new Error(`${ruta.split('/').pop()} pesa más de 500 KB`);
  return { ruta, contenido };
}
const archivoDeMedios = (ruta: string, id: string, contenido: Buffer) => ({
  id,
  content: contenido.toString('base64'),
  encoding: 'base64',
  path: ruta,
  name: ruta.split('/').pop(),
});

// Miniaturas para la biblioteca de Decap (que pide todas las imágenes completas a la vez y no cabrían en una respuesta):
// 320 px en JPG; se guardan en memoria mientras la función siga activa
const miniaturas = new Map<string, Buffer>();
async function miniatura(ruta: string, id: string, leer: () => Promise<Buffer | null>) {
  const clave = `${ruta}:${id}`;
  if (!miniaturas.has(clave)) {
    const original = await leer();
    if (!original) return null;
    const { default: sharp } = await import('sharp');
    miniaturas.set(clave, await sharp(original).resize({ width: 320, height: 320, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 70 }).toBuffer());
  }
  return miniaturas.get(clave)!;
}

async function enTandas<T, R>(lista: T[], tarea: (x: T) => Promise<R>, limite = 8) {
  const resultados: R[] = [];
  for (let i = 0; i < lista.length; i += limite) resultados.push(...(await Promise.all(lista.slice(i, i + limite).map(tarea))));
  return resultados;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const usuario = usuarioDeSesion(cookies);
  if (!usuario) return json({ error: 'La sesión expiró; vuelve a entrar.' }, 401);

  const { action, params = {} } = await request.json().catch(() => ({}));
  try {
    const a = almacen();
    switch (action) {
      case 'info':
        return json({ repo: 'terza-sitio', publish_modes: ['simple'], type: a.tipo });

      case 'entriesByFolder': {
        const textos = await a.textos(revisarCarpeta(params.folder), String(params.extension ?? 'md'));
        return json(textos.map((t) => ({ data: t.texto, file: { path: t.ruta, id: t.id } })));
      }
      case 'entriesByFiles':
        return json(
          await Promise.all(
            (params.files ?? []).map(async (f: { path: string; label?: string }) => {
              const ruta = revisarRuta(f.path);
              const contenido = await a.leer(ruta);
              return { data: contenido?.toString() ?? null, file: { path: ruta, label: f.label, id: ruta } };
            }),
          ),
        );
      case 'getEntry': {
        const ruta = revisarRuta(params.path);
        const contenido = await a.leer(ruta);
        return json({ data: contenido?.toString() ?? null, file: { path: ruta, id: ruta } });
      }

      // Guarda una nota (o varios archivos, como las categorías y sus notas) y sus imágenes nuevas en un solo commit
      case 'persistEntry': {
        const archivos: { path: string; raw: string; newPath?: string }[] = params.dataFiles ?? [params.entry];
        const cambios: Cambio[] = [];
        for (const f of archivos) {
          const ruta = revisarRuta(f.path);
          if (f.newPath && revisarRuta(f.newPath) !== ruta) {
            cambios.push({ ruta, contenido: null }, { ruta: revisarRuta(f.newPath), contenido: Buffer.from(f.raw) });
          } else cambios.push({ ruta, contenido: Buffer.from(f.raw) });
        }
        for (const asset of params.assets ?? []) {
          const ruta = revisarRuta(asset.path);
          cambios.push(imagen(ruta, deBase64(asset.content)));
        }
        await a.guardar(cambios, String(params.options?.commitMessage ?? 'Blog: editar'), usuario);
        return json({ message: 'entry persisted' });
      }

      case 'getMedia': {
        const archivos = (await a.listar(revisarCarpeta(params.mediaFolder))).filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f.nombre));
        const lista = await enTandas(archivos, async (f) => {
          const chica = await miniatura(f.ruta, f.id, () => a.leer(f.ruta));
          return chica && archivoDeMedios(f.ruta, f.id, chica);
        });
        return json(lista.filter(Boolean));
      }
      case 'getMediaFile': {
        const ruta = revisarRuta(params.path);
        const contenido = await a.leer(ruta);
        if (!contenido) return json({ error: 'No existe el archivo' }, 404);
        return json(archivoDeMedios(ruta, ruta, contenido));
      }
      case 'persistMedia': {
        const ruta = revisarRuta(params.asset?.path);
        const { contenido } = imagen(ruta, deBase64(params.asset?.content));
        await a.guardar([{ ruta, contenido }], String(params.options?.commitMessage ?? `Blog: subir imagen "${ruta}"`), usuario);
        return json(archivoDeMedios(ruta, ruta, contenido));
      }
      case 'deleteFile': {
        const ruta = revisarRuta(params.path);
        await a.guardar([{ ruta, contenido: null }], String(params.options?.commitMessage ?? `Blog: borrar "${ruta}"`), usuario);
        return json({ message: `deleted file ${ruta}` });
      }
      case 'deleteFiles': {
        const rutas: string[] = (params.paths ?? []).map(revisarRuta);
        await a.guardar(rutas.map((ruta) => ({ ruta, contenido: null })), String(params.options?.commitMessage ?? 'Blog: borrar archivos'), usuario);
        return json({ message: `deleted files ${rutas.join(', ')}` });
      }

      // Para la biblioteca de medios propia (medios.html): nombre, peso e id, sin el contenido
      case 'listMedia':
        return json((await a.listar(revisarCarpeta(params.mediaFolder))).filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f.nombre)));

      case 'getDeployPreview':
        return json(null);
      default:
        return json({ error: `Acción desconocida: ${action}` }, 422);
    }
  } catch (error) {
    console.error(`[api/cms] ${action}:`, error);
    return json({ error: error instanceof Error ? error.message : 'Error desconocido' }, 500);
  }
};
