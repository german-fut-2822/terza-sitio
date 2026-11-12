// Primer administrador del panel, desde la pantalla de entrada (/admin/login.html). Solo funciona mientras no haya
// ningún usuario, y pide el código de instalación: el valor de ADMIN_SECRETO que se puso en Vercel.
// GET: { necesaria } dice si todavía hay que crearlo. POST (formulario): lo crea, abre su sesión y entra al panel.
import type { APIRoute } from 'astro';
import { abrirSesion, codigoCorrecto, hashClave, todosLosUsuarios } from '../../lib/admin/sesion';
import { guardarUsuariosArchivo } from '../../lib/admin/usuarios';

export const prerender = false;

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const necesaria = async () => (await todosLosUsuarios()).length === 0;

export const GET: APIRoute = async () =>
  new Response(JSON.stringify({ necesaria: await necesaria() }), { headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request, cookies, url, redirect }) => {
  const datos = Object.fromEntries(await request.formData());
  const codigo = String(datos.codigo ?? '');
  const nombre = String(datos.nombre ?? '').trim().replace(/\s+/g, ' ');
  const correo = String(datos.correo ?? '').trim();
  const clave = String(datos.clave ?? '');
  const error = (clave: string) => redirect(`/admin/login.html?instalar=${clave}`, 303);

  if (!(await necesaria())) return redirect('/admin/login.html', 303);
  if (!codigoCorrecto(codigo)) {
    await esperar(800); // frena los intentos repetidos
    return error('codigo');
  }
  if (!nombre || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return error('datos');
  if (clave.length < 10) return error('clave');

  const usuario = { correo, nombre, rol: 'admin' as const };
  await guardarUsuariosArchivo([{ ...usuario, clave: hashClave(clave) }], 'Admin: primer administrador', usuario);
  abrirSesion(cookies, usuario, url.protocol === 'https:');
  return redirect('/admin/usuarios.html', 303);
};
