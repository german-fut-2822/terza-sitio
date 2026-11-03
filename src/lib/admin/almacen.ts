// Dónde lee y guarda el administrador del blog:
// - En línea (o si hay GITHUB_TOKEN): en el repositorio de GitHub, con un commit por cada guardado. Variables GITHUB_TOKEN
//   (token con permiso de escritura en Contents), GITHUB_REPO y GITHUB_BRANCH (por omisión, el repo del sitio y main).
// - En la computadora (npm run dev, sin GITHUB_TOKEN): directo en los archivos de esta carpeta, sin commit.
// Solo se pueden tocar las notas, sus imágenes y el archivo de categorías.
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { variable } from './entorno';

type Autor = { nombre: string };

export type Archivo = { ruta: string; nombre: string; peso: number; id: string };
export type Cambio = { ruta: string; contenido: Buffer | null }; // null = borrar

export interface Almacen {
  tipo: 'local' | 'github';
  leer(ruta: string): Promise<Buffer | null>;
  listar(carpeta: string): Promise<Archivo[]>;
  textos(carpeta: string, extension: string): Promise<{ ruta: string; texto: string; id: string }[]>;
  guardar(cambios: Cambio[], mensaje: string, autor: Autor): Promise<void>;
}

const PERMITIDAS = [/^src\/content\/blog\/[^/]+\.md$/, /^src\/assets\/blog\/[^/]+\.(jpe?g|png|webp|gif)$/i, /^src\/data\/blog-categorias\.json$/];
const CARPETAS = ['src/content/blog', 'src/assets/blog'];

export function revisarRuta(ruta: unknown): string {
  const limpia = path.posix.normalize(String(ruta ?? '').replace(/^\/+/, ''));
  if (limpia.includes('..') || !PERMITIDAS.some((r) => r.test(limpia))) throw new Error(`Ruta no permitida: ${ruta}`);
  return limpia;
}
export function revisarCarpeta(carpeta: unknown): string {
  const limpia = String(carpeta ?? '').replace(/^\/+|\/+$/g, '');
  if (!CARPETAS.includes(limpia)) throw new Error(`Carpeta no permitida: ${carpeta}`);
  return limpia;
}

const huella = (contenido: Buffer) => createHash('sha256').update(contenido).digest('hex');

// ---------- En la computadora ----------
const local: Almacen = {
  tipo: 'local',
  async leer(ruta) {
    return readFile(path.join(process.cwd(), ruta)).catch(() => null);
  },
  async listar(carpeta) {
    const dir = path.join(process.cwd(), carpeta);
    const nombres = (await readdir(dir).catch(() => [])).filter((n) => !n.startsWith('.'));
    return Promise.all(
      nombres.map(async (nombre) => {
        const contenido = await readFile(path.join(dir, nombre));
        return { ruta: `${carpeta}/${nombre}`, nombre, peso: (await stat(path.join(dir, nombre))).size, id: huella(contenido) };
      }),
    );
  },
  async textos(carpeta, extension) {
    const archivos = (await this.listar(carpeta)).filter((a) => a.nombre.endsWith(`.${extension}`));
    return Promise.all(archivos.map(async (a) => ({ ruta: a.ruta, texto: (await this.leer(a.ruta))!.toString(), id: a.id })));
  },
  async guardar(cambios) {
    for (const { ruta, contenido } of cambios) {
      const destino = path.join(process.cwd(), ruta);
      if (contenido === null) await unlink(destino).catch(() => {});
      else {
        await mkdir(path.dirname(destino), { recursive: true });
        await writeFile(destino, contenido);
      }
    }
  },
};

// ---------- GitHub ----------
function github(token: string): Almacen {
  const repo = variable('GITHUB_REPO') ?? 'german-fut-2822/terza-sitio';
  const rama = variable('GITHUB_BRANCH') ?? 'main';
  const pedir = async (ruta: string, opciones: RequestInit = {}) => {
    const r = await fetch(`https://api.github.com${ruta}`, {
      ...opciones,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'terza-admin', ...opciones.headers },
    });
    if (!r.ok && r.status !== 404) throw new Error(`GitHub respondió ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return r;
  };
  const contenidos = (ruta: string) => `/repos/${repo}/contents/${ruta.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(rama)}`;

  return {
    tipo: 'github',
    async leer(ruta) {
      const r = await pedir(contenidos(ruta), { headers: { Accept: 'application/vnd.github.raw+json' } });
      return r.status === 404 ? null : Buffer.from(await r.arrayBuffer());
    },
    async listar(carpeta) {
      const r = await pedir(contenidos(carpeta));
      if (r.status === 404) return [];
      const lista: { type: string; name: string; path: string; size: number; sha: string }[] = await r.json();
      return lista.filter((a) => a.type === 'file').map((a) => ({ ruta: a.path, nombre: a.name, peso: a.size, id: a.sha }));
    },
    // Todos los archivos de texto de una carpeta en una sola consulta (GraphQL)
    async textos(carpeta, extension) {
      const [owner, name] = repo.split('/');
      const query = `query($owner: String!, $name: String!, $expr: String!) {
        repository(owner: $owner, name: $name) { object(expression: $expr) { ... on Tree { entries { name object { ... on Blob { text oid } } } } } }
      }`;
      const r = await pedir('/graphql', { method: 'POST', body: JSON.stringify({ query, variables: { owner, name, expr: `${rama}:${carpeta}` } }) });
      const { data, errors } = await r.json();
      if (errors?.length) throw new Error(errors[0].message);
      const entradas: { name: string; object: { text: string; oid: string } | null }[] = data?.repository?.object?.entries ?? [];
      return entradas
        .filter((e) => e.name.endsWith(`.${extension}`) && e.object)
        .map((e) => ({ ruta: `${carpeta}/${e.name}`, texto: e.object!.text, id: e.object!.oid }));
    },
    // Todos los cambios en un solo commit, firmado con el nombre de quien está en el panel (el correo no se publica: el repo es público)
    async guardar(cambios, mensaje, autor) {
      const base = `/repos/${repo}/git`;
      const arbol = await Promise.all(
        cambios.map(async ({ ruta, contenido }) => {
          if (contenido === null) return { path: ruta, mode: '100644', type: 'blob', sha: null };
          const blob = await (await pedir(`${base}/blobs`, { method: 'POST', body: JSON.stringify({ content: contenido.toString('base64'), encoding: 'base64' }) })).json();
          return { path: ruta, mode: '100644', type: 'blob', sha: blob.sha };
        }),
      );
      // Si alguien más guardó al mismo tiempo, la rama avanzó: se vuelve a intentar sobre el commit nuevo
      for (let intento = 0; intento < 3; intento++) {
        const ref = await (await pedir(`${base}/ref/heads/${encodeURIComponent(rama)}`)).json();
        const padre = await (await pedir(`${base}/commits/${ref.object.sha}`)).json();
        const tree = await (await pedir(`${base}/trees`, { method: 'POST', body: JSON.stringify({ base_tree: padre.tree.sha, tree: arbol }) })).json();
        const commit = await (
          await pedir(`${base}/commits`, {
            method: 'POST',
            body: JSON.stringify({ message: mensaje, tree: tree.sha, parents: [padre.sha], author: { name: autor.nombre, email: 'administrador-blog@noreply.terza.com' } }),
          })
        ).json();
        const r = await fetch(`https://api.github.com${base}/refs/heads/${encodeURIComponent(rama)}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'terza-admin' },
          body: JSON.stringify({ sha: commit.sha }),
        });
        if (r.ok) return;
        if (r.status !== 422) throw new Error(`GitHub respondió ${r.status} al guardar`);
      }
      throw new Error('No se pudo guardar porque el repositorio cambió al mismo tiempo; vuelve a intentarlo.');
    },
  };
}

export function almacen(): Almacen {
  const token = variable('GITHUB_TOKEN');
  if (token) return github(token);
  if (import.meta.env.DEV) return local;
  throw new Error('Falta configurar GITHUB_TOKEN');
}
