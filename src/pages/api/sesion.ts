// Sesión del administrador del blog: POST entra (desde el formulario de /admin/login.html o con JSON), GET dice quién
// está dentro y DELETE sale. La lógica de usuarios y la cookie están en src/lib/admin/sesion.ts.
import type { APIRoute } from 'astro';
import { abrirSesion, cerrarSesion, usuarioDeSesion, verificarUsuario } from '../../lib/admin/sesion';

export const prerender = false;

const json = (datos: unknown, status = 200) => new Response(JSON.stringify(datos), { status, headers: { 'Content-Type': 'application/json' } });
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const GET: APIRoute = ({ cookies }) => {
  const usuario = usuarioDeSesion(cookies);
  return usuario ? json(usuario) : json({ error: 'Sin sesión' }, 401);
};

export const POST: APIRoute = async ({ request, cookies, url, redirect }) => {
  const esFormulario = !request.headers.get('content-type')?.includes('application/json');
  const datos = esFormulario ? Object.fromEntries(await request.formData()) : await request.json().catch(() => ({}));
  const correo = String(datos.correo ?? '');
  const clave = String(datos.clave ?? '');
  // Solo se regresa a páginas del administrador
  const volver = /^\/admin\/[^/]/.test(String(datos.volver ?? '')) ? String(datos.volver) : '/admin/notas.html';

  const usuario = correo && clave ? verificarUsuario(correo, clave) : null;
  if (!usuario) {
    await esperar(600); // frena los intentos repetidos
    return esFormulario
      ? redirect(`/admin/login.html?error=1&volver=${encodeURIComponent(volver)}`, 303)
      : json({ error: 'Correo o contraseña incorrectos' }, 401);
  }
  abrirSesion(cookies, usuario, url.protocol === 'https:');
  return esFormulario ? redirect(volver, 303) : json(usuario);
};

export const DELETE: APIRoute = ({ cookies }) => {
  cerrarSesion(cookies);
  return json({ ok: true });
};
