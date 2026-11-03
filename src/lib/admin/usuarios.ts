// Usuarios que se dan de alta desde la sección Usuarios del panel. Se guardan cifrados (AES-256-GCM con una llave que sale
// de ADMIN_SECRETO) en un archivo del repo, así que en GitHub solo se ve texto cifrado:
// - en línea: usuarios-admin.enc (con un commit, como las notas);
// - en la computadora: .usuarios-admin.local.enc (no se sube a git), para no mezclar usuarios de prueba con los reales.
// Si cambia ADMIN_SECRETO, el archivo ya no se puede leer y hay que volver a crear el primer administrador.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { almacen } from './almacen';
import { secreto } from './entorno';

export type Rol = 'admin' | 'editor';
export type UsuarioGuardado = { correo: string; nombre: string; rol: Rol; clave: string };

const archivo = () => (almacen().tipo === 'local' ? '.usuarios-admin.local.enc' : 'usuarios-admin.enc');
const llave = () => createHash('sha256').update(`usuarios-admin:${secreto()}`).digest();

function cifrar(texto: string) {
  const iv = randomBytes(12);
  const cifrador = createCipheriv('aes-256-gcm', llave(), iv);
  const datos = Buffer.concat([cifrador.update(texto, 'utf8'), cifrador.final()]);
  return Buffer.concat([iv, cifrador.getAuthTag(), datos]).toString('base64');
}
function descifrar(base64: string) {
  const todo = Buffer.from(base64.trim(), 'base64');
  const descifrador = createDecipheriv('aes-256-gcm', llave(), todo.subarray(0, 12));
  descifrador.setAuthTag(todo.subarray(12, 28));
  return Buffer.concat([descifrador.update(todo.subarray(28)), descifrador.final()]).toString('utf8');
}

// Se guarda en memoria un momento para no leer GitHub en cada petición del panel
let memoria: { lista: UsuarioGuardado[]; hasta: number } | null = null;

export async function leerUsuariosArchivo(): Promise<UsuarioGuardado[]> {
  if (memoria && memoria.hasta > Date.now()) return memoria.lista;
  const contenido = await almacen().leer(archivo());
  let lista: UsuarioGuardado[] = [];
  if (contenido) {
    try {
      lista = JSON.parse(descifrar(contenido.toString()));
    } catch {
      console.error(`[admin] No se pudo leer ${archivo()}: ¿cambió ADMIN_SECRETO?`);
    }
  }
  memoria = { lista, hasta: Date.now() + 30_000 };
  return lista;
}

export async function guardarUsuariosArchivo(lista: UsuarioGuardado[], mensaje: string, autor: { correo: string; nombre: string }) {
  await almacen().guardar([{ ruta: archivo(), contenido: Buffer.from(`${cifrar(JSON.stringify(lista))}\n`) }], mensaje, autor);
  memoria = { lista, hasta: Date.now() + 30_000 };
}
