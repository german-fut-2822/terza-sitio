// Inicio de sesión del administrador del blog con correo y contraseña.
// - Usuarios: variable ADMIN_USUARIOS, un JSON con [{ "correo", "nombre", "clave" }]; "clave" es el hash que genera
//   `npm run usuario-admin` (nunca la contraseña).
// - Sesión: cookie firmada con ADMIN_SECRETO (HMAC), solo para el servidor (httpOnly), que dura 12 horas.
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { AstroCookies } from 'astro';

export type Usuario = { correo: string; nombre: string };

const COOKIE = 'terza_admin';
const DURACION = 12 * 60 * 60; // segundos

// Variables de entorno: en Vercel llegan en process.env; en local, del archivo .env
export const variable = (nombre: string): string | undefined => process.env[nombre] ?? import.meta.env[nombre];

function secreto() {
  const valor = variable('ADMIN_SECRETO');
  if (valor) return valor;
  if (import.meta.env.DEV) return 'solo-para-desarrollo';
  throw new Error('Falta configurar ADMIN_SECRETO');
}

function usuarios(): (Usuario & { clave: string })[] {
  try {
    const lista = JSON.parse(variable('ADMIN_USUARIOS') ?? '[]');
    return Array.isArray(lista) ? lista.filter((u) => u?.correo && u?.clave) : [];
  } catch {
    console.error('ADMIN_USUARIOS no es un JSON válido');
    return [];
  }
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

export function verificarUsuario(correo: string, clave: string): Usuario | null {
  const buscado = correo.trim().toLowerCase();
  const usuario = usuarios().find((u) => u.correo.trim().toLowerCase() === buscado);
  // Con un correo que no existe también se calcula un hash, para que la respuesta tarde lo mismo
  if (!usuario) {
    claveCorrecta(clave, hashClave('x'));
    return null;
  }
  return claveCorrecta(clave, usuario.clave) ? { correo: usuario.correo, nombre: usuario.nombre || usuario.correo } : null;
}

const firma = (datos: string) => createHmac('sha256', secreto()).update(datos).digest('base64url');

export function abrirSesion(cookies: AstroCookies, usuario: Usuario, seguro: boolean) {
  const datos = Buffer.from(JSON.stringify({ ...usuario, vence: Math.floor(Date.now() / 1000) + DURACION })).toString('base64url');
  cookies.set(COOKIE, `${datos}.${firma(datos)}`, { httpOnly: true, secure: seguro, sameSite: 'strict', path: '/', maxAge: DURACION });
}

export function cerrarSesion(cookies: AstroCookies) {
  cookies.delete(COOKIE, { path: '/' });
}

// Usuario de la sesión, o null si no hay sesión, la firma no coincide o ya venció
export function usuarioDeSesion(cookies: AstroCookies): Usuario | null {
  const valor = cookies.get(COOKIE)?.value;
  if (!valor) return null;
  const [datos, recibida] = valor.split('.');
  if (!datos || !recibida) return null;
  const esperada = firma(datos);
  if (recibida.length !== esperada.length || !timingSafeEqual(Buffer.from(recibida), Buffer.from(esperada))) return null;
  try {
    const { correo, nombre, vence } = JSON.parse(Buffer.from(datos, 'base64url').toString());
    if (typeof vence !== 'number' || vence < Date.now() / 1000) return null;
    // El usuario tiene que seguir en ADMIN_USUARIOS (si se quita, su sesión deja de servir)
    return usuarios().some((u) => u.correo.trim().toLowerCase() === String(correo).toLowerCase()) ? { correo, nombre } : null;
  } catch {
    return null;
  }
}
