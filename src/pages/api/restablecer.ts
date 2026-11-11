// Crear una contraseña nueva desde el enlace del correo (/admin/restablecer.html?t=…).
// GET ?t=…: dice si el enlace sirve y de quién es. POST (formulario): guarda la contraseña y manda a la pantalla de entrada.
import type { APIRoute } from 'astro';
import { hashClave, usuarioDeEnlace } from '../../lib/admin/sesion';
import { cambiarClaveArchivo } from '../../lib/admin/usuarios';

export const prerender = false;

const MIN_CLAVE = 10;

export const GET: APIRoute = async ({ url }) => {
  const usuario = await usuarioDeEnlace(url.searchParams.get('t') ?? '');
  return new Response(JSON.stringify(usuario ? { valido: true, nombre: usuario.nombre, correo: usuario.correo } : { valido: false }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request, redirect }) => {
  const datos = await request.formData();
  const token = String(datos.get('t') ?? '');
  const clave = String(datos.get('clave') ?? '');
  const otra = String(datos.get('clave2') ?? '');
  const volver = (error: string) => redirect(`/admin/restablecer.html?t=${encodeURIComponent(token)}&error=${error}`, 303);

  const usuario = await usuarioDeEnlace(token);
  if (!usuario) return volver('enlace');
  if (clave.length < MIN_CLAVE) return volver('clave');
  if (clave !== otra) return volver('distintas');
  await cambiarClaveArchivo(usuario.correo, hashClave(clave), usuario);
  return redirect('/admin/login.html?restablecida=1', 303);
};
