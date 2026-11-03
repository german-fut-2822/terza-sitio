// Código compartido del administrador: los listados (notas.html, categorias.html y medios.html) e index.html.
// Lee las notas y las categorías con la misma sesión del panel (Decap CMS): del servidor local (npm run admin) o de GitHub.
// Necesita js-yaml (jsyaml) cargado antes.

const $ = (s) => document.querySelector(s);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const normalizar = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// Para ordenar títulos sin que cuenten los signos de apertura (¡, ¿, comillas)
const sinSignos = (t) => String(t ?? '').replace(/^[¡¿"“]+/, '');

// Rutas del editor de Decap
const EDITOR = {
  nota: (slug) => `/admin/index.html#/collections/blog/entries/${encodeURIComponent(slug)}`,
  notaNueva: '/admin/index.html#/collections/blog/new',
};

const RUTA_NOTAS = 'src/content/blog';
const RUTA_CATEGORIAS = 'src/data/blog-categorias.json';

// "Pisos vinílicos" → "pisos-vinilicos"
const slugificar = (t) => normalizar(t).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function avisar(html) {
  $('#aviso').innerHTML = html;
  $('#aviso').hidden = false;
}

// Repo y rama salen de config.yml para no repetirlos aquí
async function leerConfig() {
  const texto = await fetch('/admin/config.yml', { cache: 'no-cache' }).then((r) => r.text());
  return jsyaml.load(texto).backend;
}

// Llamada al servidor local de Decap (npx decap-server)
const apiLocal = (backend, action, params) =>
  fetch('http://localhost:8081/api/v1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, params: { branch: backend.branch, ...params } }),
  }).then((r) => {
    if (!r.ok) return r.json().catch(() => ({})).then((d) => { throw new Error(d.error ?? 'El servidor local no respondió'); });
    return r.json();
  });

// Llamada a la API REST de GitHub con el token de la sesión del panel
async function apiGitHub(token, ruta, opciones = {}) {
  const r = await fetch(`https://api.github.com${ruta}`, {
    ...opciones,
    headers: { Authorization: `bearer ${token}`, Accept: 'application/vnd.github+json', ...(opciones.body ? { 'Content-Type': 'application/json' } : {}) },
  });
  if (r.status === 401) throw new Error('sesion');
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message ?? `GitHub respondió ${r.status}`);
  return r.status === 204 ? null : r.json();
}

// Notas desde el servidor local de Decap
async function desdeLocal(backend) {
  const api = (action, params) => apiLocal(backend, action, params);
  const [archivos, cats] = await Promise.all([
    api('entriesByFolder', { folder: RUTA_NOTAS, extension: 'md', depth: 1 }),
    api('getEntry', { path: RUTA_CATEGORIAS }),
  ]);
  return { archivos: archivos.map((a) => ({ nombre: a.file.path.split('/').pop(), texto: a.data })), categorias: cats.data };
}

// Notas desde GitHub en una sola consulta (GraphQL) con el token de la sesión del panel
async function desdeGitHub(backend, token) {
  const [owner, name] = backend.repo.split('/');
  const query = `query($owner: String!, $name: String!, $notas: String!, $cats: String!) {
    repository(owner: $owner, name: $name) {
      notas: object(expression: $notas) { ... on Tree { entries { name object { ... on Blob { text } } } } }
      cats: object(expression: $cats) { ... on Blob { text } }
    }
  }`;
  const r = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { owner, name, notas: `${backend.branch}:${RUTA_NOTAS}`, cats: `${backend.branch}:${RUTA_CATEGORIAS}` } }),
  });
  if (r.status === 401) throw new Error('sesion');
  const { data, errors } = await r.json();
  if (errors?.length) throw new Error(errors[0].message);
  const entradas = data.repository.notas?.entries ?? [];
  return {
    archivos: entradas.filter((e) => e.name.endsWith('.md')).map((e) => ({ nombre: e.name, texto: e.object.text })),
    categorias: data.repository.cats?.text ?? '{"categorias":[]}',
  };
}

// Encabezado de una nota (Markdown) → datos para el listado
function convertirNota({ nombre, texto }) {
  const encabezado = texto.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
  const d = jsyaml.load(encabezado) ?? {};
  const fecha = d.fecha instanceof Date ? d.fecha : new Date(`${d.fecha}T00:00:00Z`);
  const slug = nombre.replace(/\.md$/, '');
  return {
    slug,
    titulo: d.titulo ?? slug,
    descripcion: d.descripcion ?? '',
    autor: d.autor ?? 'Terza',
    categorias: Array.isArray(d.categorias) ? d.categorias : [],
    fecha,
    mes: isNaN(fecha) ? '' : `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`,
    borrador: d.borrador === true,
    destacada: d.destacada === true,
    // Imágenes de src/assets/blog que usa (la principal y las del texto)
    // Foto principal: nombre del archivo en src/assets/blog
    imagen: typeof d.imagen === 'string' ? decodeURIComponent(d.imagen.split('/').pop()) : '',
    imagenes: [...new Set([...texto.matchAll(/assets\/blog\/([^)\s"'?#]+)/g)].map((m) => decodeURIComponent(m[1])))],
    // Archivo completo, para poder reescribirlo (por ejemplo, al cambiar el slug de una categoría)
    ruta: `${RUTA_NOTAS}/${nombre}`,
    texto,
  };
}

// Revisa la sesión del panel y carga notas y categorías; si algo falla muestra el aviso y regresa null
async function cargarDatos() {
  let usuario = null;
  try { usuario = JSON.parse(localStorage.getItem('decap-cms-user')); } catch { /* sin sesión */ }
  if (!usuario) {
    avisar('Para ver este listado inicia sesión en el <a href="/admin/index.html">administrador</a>.');
    return null;
  }
  try {
    const backend = await leerConfig();
    const datos = usuario.backendName === 'proxy' ? await desdeLocal(backend) : await desdeGitHub(backend, usuario.token);
    return { notas: datos.archivos.map(convertirNota), categorias: JSON.parse(datos.categorias).categorias ?? [], usuario, backend };
  } catch (error) {
    avisar(
      error.message === 'sesion'
        ? 'La sesión expiró. <a href="/admin/index.html">Vuelve a iniciar sesión</a>.'
        : `No se pudieron cargar los datos (${esc(error.message)}). Si estás en tu computadora, revisa que esté corriendo <code>npm run admin</code>.`,
    );
    return null;
  }
}

// Pie de la tabla: "Mostrando 1 a 20 de 138 notas" y los números de página (los botones llevan data-ir)
function htmlPaginas(total, pagina, paginas, porPagina = 20, nombre = ['elemento', 'elementos']) {
  const desde = total ? (pagina - 1) * porPagina + 1 : 0;
  const hasta = Math.min(pagina * porPagina, total);
  // Primera, última y las dos vecinas de la actual; lo demás se resume con "…"
  const numeros = [...new Set([1, pagina - 1, pagina, pagina + 1, paginas])].filter((n) => n >= 1 && n <= paginas).sort((x, y) => x - y);
  const botones = numeros
    .map((n, i) => `${i && n - numeros[i - 1] > 1 ? '<span class="puntos">…</span>' : ''}<button type="button" data-ir="${n}"${n === pagina ? ' aria-current="page"' : ''}>${n}</button>`)
    .join('');
  return `<p class="mostrando">Mostrando <b>${desde}</b> a <b>${hasta}</b> de <b>${total}</b> ${total === 1 ? nombre[0] : nombre[1]}</p>
    <div class="numeros">
      <button type="button" data-ir="${pagina - 1}" aria-label="Página anterior" ${pagina === 1 ? 'disabled' : ''}>‹</button>
      ${botones}
      <button type="button" data-ir="${pagina + 1}" aria-label="Página siguiente" ${pagina === paginas ? 'disabled' : ''}>›</button>
    </div>`;
}

// Miniatura de una imagen de src/assets/blog: en local la sirve el servidor de desarrollo; en línea, GitHub (repo público)
const urlFotoBlog = ({ usuario, backend }, archivo) =>
  !archivo ? '' : usuario.backendName === 'proxy'
    ? `/src/assets/blog/${encodeURIComponent(archivo)}`
    : `https://raw.githubusercontent.com/${backend.repo}/${backend.branch}/src/assets/blog/${encodeURIComponent(archivo)}`;

// Guarda varios archivos de texto juntos ([{ ruta, texto }]): en la carpeta con el servidor local o en un solo commit de GitHub
async function guardarArchivos({ usuario, backend }, archivos, mensaje) {
  if (usuario.backendName === 'proxy') {
    await apiLocal(backend, 'persistEntry', {
      dataFiles: archivos.map((a) => ({ slug: a.ruta.split('/').pop(), path: a.ruta, raw: a.texto })),
      assets: [],
      options: { commitMessage: mensaje, useWorkflow: false, status: 'draft' }, // el servidor local exige status aunque no lo use
    });
    return;
  }
  const repo = `/repos/${backend.repo}`;
  const rama = await apiGitHub(usuario.token, `${repo}/git/ref/heads/${backend.branch}`);
  const padre = await apiGitHub(usuario.token, `${repo}/git/commits/${rama.object.sha}`);
  const arbol = await apiGitHub(usuario.token, `${repo}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: padre.tree.sha, tree: archivos.map((a) => ({ path: a.ruta, mode: '100644', type: 'blob', content: a.texto })) }),
  });
  const commit = await apiGitHub(usuario.token, `${repo}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message: mensaje, tree: arbol.sha, parents: [padre.sha] }),
  });
  await apiGitHub(usuario.token, `${repo}/git/refs/heads/${backend.branch}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) });
}

// Borra un archivo: en la carpeta con el servidor local o con un commit en GitHub (la API pide su sha)
async function borrarArchivo({ usuario, backend }, ruta, mensaje) {
  if (usuario.backendName === 'proxy') {
    await apiLocal(backend, 'deleteFile', { path: ruta, options: { commitMessage: mensaje } });
    return;
  }
  const url = `/repos/${backend.repo}/contents/${ruta.split('/').map(encodeURIComponent).join('/')}`;
  const { sha } = await apiGitHub(usuario.token, `${url}?ref=${backend.branch}`);
  await apiGitHub(usuario.token, url, { method: 'DELETE', body: JSON.stringify({ message: mensaje, sha, branch: backend.branch }) });
}

// Lista de categorías → blog-categorias.json con una categoría por renglón, como está escrito a mano
const textoCategorias = (categorias) =>
  `{\n  "categorias": [\n${categorias.map((c) => `    ${JSON.stringify(c).replace(/^\{|\}$/g, (l) => (l === '{' ? '{ ' : ' }')).replace(/","/g, '", "').replace(/":"/g, '": "')}`).join(',\n')}\n  ]\n}\n`;

// Cambia (o quita, con nuevo = null) un slug de categoría en el encabezado de una nota; regresa el texto nuevo o null si no la usa
function cambiarCategoriaEnNota(texto, viejo, nuevo) {
  const limpiar = (v) => v.trim().replace(/^['"]|['"]$/g, '');
  const cambiar = (lista) => [...new Set(lista.map(limpiar).filter(Boolean).flatMap((v) => (v === viejo ? (nuevo ? [nuevo] : []) : [v])))];
  const usa = (lista) => lista.map(limpiar).includes(viejo);
  // categorias: [a, b]
  let resultado = texto.replace(/^categorias:[ \t]*\[(.*)\][ \t]*$/m, (linea, valores) =>
    usa(valores.split(',')) ? `categorias: [${cambiar(valores.split(',')).join(', ')}]` : linea,
  );
  // categorias:\n  - a\n  - b   (como lo guarda el panel)
  resultado = resultado.replace(/^categorias:[ \t]*\r?\n((?:[ \t]*- .*\r?\n?)+)/m, (bloque, items) => {
    const valores = items.split(/\r?\n/).filter(Boolean).map((l) => l.replace(/^\s*-\s*/, ''));
    if (!usa(valores)) return bloque;
    const nuevos = cambiar(valores);
    return nuevos.length ? `categorias:\n${nuevos.map((v) => `  - ${v}`).join('\n')}\n` : 'categorias: []\n';
  });
  return resultado === texto ? null : resultado;
}

// Marco del panel, al estilo de UBold: barra superior oscura (logo, botón de menú, buscador de notas y usuario) y menú
// lateral claro con secciones. En celular el menú lateral se abre desde el botón de menú.
const ICONOS = {
  notas: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  categorias: '<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  medios: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  externo: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  salir: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  buscar: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  abajo: '<path d="m6 9 6 6 6-6"/>',
  ver: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  editar: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  borrar: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  estado: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  calendario: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  lista: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  usuario: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
};
const icono = (nombre, clase = '') => `<svg class="icono ${clase}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[nombre]}</svg>`;
const SECCIONES = [
  { id: 'notas', texto: 'Notas del blog', url: '/admin/notas.html' },
  { id: 'categorias', texto: 'Categorías', url: '/admin/categorias.html' },
  { id: 'medios', texto: 'Medios', url: '/admin/medios.html' },
];

async function pintarMenu() {
  // Íconos escritos en el HTML como <span data-icono="nombre">
  document.querySelectorAll('[data-icono]').forEach((e) => (e.outerHTML = icono(e.dataset.icono)));
  const lateral = document.getElementById('lateral');
  if (!lateral) return;
  const actual = lateral.dataset.actual;
  lateral.innerHTML = `
    <p class="lateral-seccion">Blog</p>
    <ul>
      ${SECCIONES.map((s) => `<li><a href="${s.url}"${s.id === actual ? ' aria-current="page"' : ''}>${icono(s.id)}${s.texto}</a></li>`).join('')}
    </ul>
    <p class="lateral-seccion">Sitio</p>
    <ul><li><a href="/blog" target="_blank" rel="noopener">${icono('externo')}Ver el blog</a></li></ul>`;

  const superior = document.createElement('header');
  superior.className = 'superior';
  superior.innerHTML = `
    <a class="superior-logo" href="/admin/notas.html" aria-label="Terza, ir a las notas del blog"><img src="/admin/terza-logo.webp" alt="" /></a>
    <button type="button" class="superior-boton" id="abrir-menu" aria-label="Mostrar u ocultar el menú" aria-expanded="true">${icono('menu')}</button>
    <form class="superior-buscar" action="/admin/notas.html" role="search">
      ${icono('buscar')}<input type="search" name="q" placeholder="Buscar notas…" aria-label="Buscar notas" />
    </form>
    <a class="superior-boton" href="/blog" target="_blank" rel="noopener" title="Ver el blog" aria-label="Ver el blog">${icono('externo')}</a>
    <div class="superior-usuario">
      <button type="button" class="usuario" aria-haspopup="true" aria-expanded="false">
        <span class="avatar">${icono('usuario')}</span><span class="nombre">&nbsp;</span>${icono('abajo', 'chico')}
      </button>
      <div class="menu-usuario" role="menu" hidden>
        <p class="detalle"></p>
        <a role="menuitem" href="/blog" target="_blank" rel="noopener">${icono('externo', 'chico')}Ver el blog</a>
        <button type="button" role="menuitem" data-salir>${icono('salir', 'chico')}Cerrar sesión</button>
      </div>
    </div>`;
  const fondo = document.createElement('div');
  fondo.className = 'lateral-fondo';
  document.body.prepend(superior);
  lateral.after(fondo);

  // Botón de menú: en escritorio oculta o muestra el menú lateral; en celular lo abre como hoja
  const movil = matchMedia('(max-width: 1023px)');
  const botonMenu = superior.querySelector('#abrir-menu');
  const marcar = () => botonMenu.setAttribute('aria-expanded', String(movil.matches ? document.body.classList.contains('menu-abierto') : !document.body.classList.contains('menu-cerrado')));
  botonMenu.addEventListener('click', () => {
    document.body.classList.toggle(movil.matches ? 'menu-abierto' : 'menu-cerrado');
    marcar();
  });
  fondo.addEventListener('click', () => { document.body.classList.remove('menu-abierto'); marcar(); });
  movil.addEventListener('change', marcar);
  marcar();

  // Menú del usuario
  const caja = superior.querySelector('.superior-usuario');
  const boton = caja.querySelector('.usuario');
  const menu = caja.querySelector('.menu-usuario');
  const abrir = (si) => { menu.hidden = !si; boton.setAttribute('aria-expanded', String(si)); };
  boton.addEventListener('click', (e) => { e.stopPropagation(); abrir(menu.hidden); });
  document.addEventListener('click', (e) => { if (!caja.contains(e.target)) abrir(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    abrir(false);
    document.body.classList.remove('menu-abierto');
    marcar();
  });
  // Igual que "Cerrar sesión" del panel: borra la sesión guardada y regresa a la pantalla de inicio de sesión
  caja.querySelector('[data-salir]').addEventListener('click', () => {
    localStorage.removeItem('decap-cms-user');
    location.href = '/admin/index.html';
  });

  // Usuario de la sesión: en GitHub, su foto, nombre y usuario; en local, "Modo local"
  let usuario = null;
  try { usuario = JSON.parse(localStorage.getItem('decap-cms-user')); } catch { /* sin sesión */ }
  let nombre = 'Sin sesión';
  let detalle = 'Inicia sesión en el administrador';
  if (usuario?.backendName === 'proxy') {
    nombre = 'Modo local';
    detalle = 'Guardando en esta computadora';
  } else if (usuario) {
    try {
      const perfil = await apiGitHub(usuario.token, '/user');
      nombre = perfil.name || perfil.login;
      detalle = `GitHub: @${perfil.login}`;
      if (perfil.avatar_url) caja.querySelector('.avatar').innerHTML = `<img src="${esc(perfil.avatar_url)}" alt="" />`;
    } catch {
      nombre = 'GitHub';
      detalle = 'Sesión de GitHub';
    }
  }
  caja.querySelector('.nombre').textContent = nombre;
  caja.querySelector('.detalle').textContent = detalle;
}
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', pintarMenu) : pintarMenu();
