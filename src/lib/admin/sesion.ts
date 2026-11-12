// Inicio de sesión del administrador del blog con correo y contraseña.
// - Usuarios: los de la sección Usuarios del panel (archivo cifrado, src/lib/admin/usuarios.ts) y, opcionalmente, los de la
//   variable ADMIN_USUARIOS (JSON con [{ "correo", "nombre", "clave" }], que genera `npm run usuario-admin`). Los de la
//   variable siempre son administradores y no se pueden cambiar desde el panel; sirven para recuperar el acceso.
// - Roles: "admin" puede todo, incluida la sección Usuarios; "editor", notas, categorías y medios.
// - Sesión: cookie firmada con ADMIN_SECRETO (HMAC), solo para el servidor (httpOnly), que dura 12 horas. En cada petición
//   se vuelve a buscar al usuario, así que si se borra o cambia de rol, se aplica de inmediato.
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { AstroCookies } from 'astro';
import { secreto, variable } from './entorno';
import { leerUsuariosArchivo, type Rol, type UsuarioGuardado } from './usuarios';

export type Usuario = { correo: string; nombre: string; rol: Rol };
export type UsuarioCompleto = UsuarioGuardado & { fijo: boolean };

const COOKIE = 'terza_admin';
const DURACION = 12 * 60 * 60; // segundos

const mismoCorreo = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function usuariosDeVariable(): UsuarioCompleto[] {
  try {
    const lista = JSON.parse(variable('ADMIN_USUARIOS') ?? '[]');
    return Array.isArray(lista)
      ? lista.filter((u) => u?.correo && u?.clave).map((u) => ({ correo: u.correo, nombre: u.nombre || u.correo, clave: u.clave, rol: 'admin' as Rol, fijo: true }))
      : [];
  } catch {
    console.error('ADMIN_USUARIOS no es un JSON válido');
    return [];
  }
}

// Todos los usuarios; si un correo está en los dos lados, gana el de la variable
export async function todosLosUsuarios(): Promise<UsuarioCompleto[]> {
  const fijos = usuariosDeVariable();
  const delPanel = (await leerUsuariosArchivo()).filter((u) => !fijos.some((f) => mismoCorreo(f.correo, u.correo)));
  return [...fijos, ...delPanel.map((u) => ({ ...u, fijo: false }))];
}

// Hash de contraseña: "scrypt:<sal>:<hash>" en base64 (sin "$", que el .env tomaría como variable)
export function hashClave(clave: string) {
  const sal = randomBytes(16);
  return `scrypt:${sal.toString('base64')}:${scryptSync(clave, sal, 64).toString('base64')}`;
}

function claveCorrecta(clave: string, guardada: string) {
  const [tipo, sal, hash] = guardada.split(':');
  if (tipo !== 'scrypt' || !sal || !hash) return false;
  const esperado = Buffer.from(hash, 'base64');
  const calculado = scryptSync(clave, Buffer.from(sal, 'base64'), esperado.length);
  return timingSafeEqual(calculado, esperado);
}

const publico = (u: UsuarioCompleto): Usuario => ({ correo: u.correo, nombre: u.nombre || u.correo, rol: u.rol === 'admin' ? 'admin' : 'editor' });

export async function verificarUsuario(correo: string, clave: string): Promise<Usuario | null> {
  const usuario = (await todosLosUsuarios()).find((u) => mismoCorreo(u.correo, correo));
  // Con un correo que no existe también se calcula un hash, para que la respuesta tarde lo mismo
  if (!usuario) {
    claveCorrecta(clave, hashClave('x'));
    return null;
  }
  return claveCorrecta(clave, usuario.clave) ? publico(usuario) : null;
}

const firma = (datos: string) => createHmac('sha256', secreto()).update(datos).digest('base64url');

export function abrirSesion(cookies: AstroCookies, usuario: Usuario, seguro: boolean) {
  const datos = Buffer.from(JSON.stringify({ correo: usuario.correo, vence: Math.floor(Date.now() / 1000) + DURACION })).toString('base64url');
  cookies.set(COOKIE, `${datos}.${firma(datos)}`, { httpOnly: true, secure: seguro, sameSite: 'strict', path: '/', maxAge: DURACION });
}

export function cerrarSesion(cookies: AstroCookies) {
  cookies.delete(COOKIE, { path: '/' });
}

// Usuario de la sesión (con su nombre y rol actuales), o null si no hay sesión, la firma no coincide, ya venció o el usuario
// ya no existe
export async function usuarioDeSesion(cookies: AstroCookies): Promise<Usuario | null> {
  const valor = cookies.get(COOKIE)?.value;
  if (!valor) return null;
  const [datos, recibida] = valor.split('.');
  if (!datos || !recibida) return null;
  const esperada = firma(datos);
  if (recibida.length !== esperada.length || !timingSafeEqual(Buffer.from(recibida), Buffer.from(esperada))) return null;
  try {
    const { correo, vence } = JSON.parse(Buffer.from(datos, 'base64url').toString());
    if (typeof vence !== 'number' || vence < Date.now() / 1000) return null;
    const usuario = (await todosLosUsuarios()).find((u) => mismoCorreo(u.correo, String(correo)));
    return usuario ? publico(usuario) : null;
  } catch {
    return null;
  }
}

// Código de instalación: el valor de ADMIN_SECRETO, para crear el primer administrador cuando todavía no hay usuarios
export function codigoCorrecto(codigo: string) {
  const a = createHmac('sha256', 'instalacion').update(codigo).digest();
  const b = createHmac('sha256', 'instalacion').update(secreto()).digest();
  return timingSafeEqual(a, b);
}

// ---------- Enlaces para crear o cambiar la contraseña (¿Olvidaste tu contraseña? y bienvenida) ----------
// El enlace lleva el correo, cuándo vence y una huella de la contraseña actual, firmados con ADMIN_SECRETO. En cuanto la
// contraseña cambia, la huella ya no coincide: cada enlace sirve una sola vez. Solo para usuarios de la sección Usuarios.
const huellaClave = (clave: string) => createHash('sha256').update(`clave:${clave}`).digest('base64url').slice(0, 16);
const firmaEnlace = (datos: string) => createHmac('sha256', `enlace:${secreto()}`).update(datos).digest('base64url');

export function crearEnlaceClave(usuario: UsuarioGuardado, horas: number) {
  const datos = Buffer.from(JSON.stringify({ correo: usuario.correo, vence: Math.floor(Date.now() / 1000) + horas * 3600, huella: huellaClave(usuario.clave) })).toString('base64url');
  return `${datos}.${firmaEnlace(datos)}`;
}

// El usuario del enlace, o null si la firma no coincide, ya venció, ya se usó o no es un usuario de la sección Usuarios
export async function usuarioDeEnlace(token: string): Promise<UsuarioCompleto | null> {
  const [datos, recibida] = String(token ?? '').split('.');
  if (!datos || !recibida) return null;
  const esperada = firmaEnlace(datos);
  if (recibida.length !== esperada.length || !timingSafeEqual(Buffer.from(recibida), Buffer.from(esperada))) return null;
  try {
    const { correo, vence, huella } = JSON.parse(Buffer.from(datos, 'base64url').toString());
    if (typeof vence !== 'number' || vence < Date.now() / 1000) return null;
    const usuario = (await todosLosUsuarios()).find((u) => !u.fijo && mismoCorreo(u.correo, String(correo)));
    return usuario && huellaClave(usuario.clave) === huella ? usuario : null;
  } catch {
    return null;
  }
}
