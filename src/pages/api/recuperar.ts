// ¿Olvidaste tu contraseña? (formulario de /admin/login.html): si el correo es de un usuario de la sección Usuarios, le
// manda un enlace para crear una contraseña nueva (válido 1 hora). La respuesta es la misma exista o no el correo, para
// no revelar quién tiene cuenta.
import type { APIRoute } from 'astro';
import { correoRecuperar, enviarCorreo } from '../../lib/admin/correo';
import { crearEnlaceClave, todosLosUsuarios } from '../../lib/admin/sesion';

export const prerender = false;

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const POST: APIRoute = async ({ request, url, redirect }) => {
  const correo = String((await request.formData()).get('correo') ?? '').trim();
  const usuario = (await todosLosUsuarios()).find((u) => !u.fijo && u.correo.toLowerCase() === correo.toLowerCase());
  if (usuario) {
    const enlace = new URL(`/admin/restablecer.html?t=${crearEnlaceClave(usuario, 1)}`, url.origin).href;
    await enviarCorreo(correoRecuperar(usuario.correo, usuario.nombre, enlace));
  } else {
    await esperar(400); // que tarde parecido aunque el correo no exista
  }
  return redirect('/admin/login.html?enviado=1', 303);
};
