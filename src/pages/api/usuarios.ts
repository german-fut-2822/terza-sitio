// Usuarios del administrador del blog (sección Usuarios del panel). Solo para administradores.
// GET: la lista (sin contraseñas). POST { accion: 'crear' | 'editar' | 'borrar', ... }: cambia el archivo cifrado de
// usuarios (src/lib/admin/usuarios.ts). Los usuarios de la variable ADMIN_USUARIOS se ven, pero no se pueden cambiar aquí.
import type { APIRoute } from 'astro';
import { hashClave, todosLosUsuarios, usuarioDeSesion } from '../../lib/admin/sesion';
import { guardarUsuariosArchivo, leerUsuariosArchivo, type Rol } from '../../lib/admin/usuarios';

export const prerender = false;

const json = (datos: unknown, status = 200) => new Response(JSON.stringify(datos), { status, headers: { 'Content-Type': 'application/json' } });
const mismoCorreo = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_CLAVE = 10;

class Problema extends Error {}

async function lista() {
  return (await todosLosUsuarios()).map(({ correo, nombre, rol, fijo }) => ({ correo, nombre, rol, fijo }));
}

export const GET: APIRoute = async ({ cookies }) => {
  const usuario = await usuarioDeSesion(cookies);
  if (!usuario) return json({ error: 'La sesión expiró; vuelve a entrar.' }, 401);
  if (usuario.rol !== 'admin') return json({ error: 'Solo los administradores pueden ver los usuarios.' }, 403);
  return json(await lista());
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const yo = await usuarioDeSesion(cookies);
  if (!yo) return json({ error: 'La sesión expiró; vuelve a entrar.' }, 401);
  if (yo.rol !== 'admin') return json({ error: 'Solo los administradores pueden cambiar los usuarios.' }, 403);

  const datos = await request.json().catch(() => ({}));
  try {
    const todos = await todosLosUsuarios();
    const delPanel = await leerUsuariosArchivo();
    const correo = String(datos.correo ?? '').trim();
    const nombre = String(datos.nombre ?? '').trim().replace(/\s+/g, ' ');
    const rol: Rol = datos.rol === 'admin' ? 'admin' : 'editor';
    const clave = String(datos.clave ?? '');
    const fijo = todos.find((u) => u.fijo && mismoCorreo(u.correo, correo));
    if (fijo) throw new Problema('Este usuario está en la variable ADMIN_USUARIOS de Vercel y solo se cambia ahí.');
    // Siempre tiene que quedar al menos un administrador
    const quedanAdmins = (sin: string, rolNuevo?: Rol) =>
      todos.some((u) => (mismoCorreo(u.correo, sin) ? rolNuevo === 'admin' : u.rol === 'admin'));

    let nueva = delPanel;
    let mensaje: string;
    switch (datos.accion) {
      case 'crear': {
        if (!CORREO.test(correo)) throw new Problema('Escribe un correo válido.');
        if (!nombre) throw new Problema('Escribe el nombre.');
        if (clave.length < MIN_CLAVE) throw new Problema(`La contraseña debe tener al menos ${MIN_CLAVE} caracteres.`);
        if (todos.some((u) => mismoCorreo(u.correo, correo))) throw new Problema('Ya hay un usuario con ese correo.');
        nueva = [...delPanel, { correo, nombre, rol, clave: hashClave(clave) }];
        mensaje = 'Admin: añadir usuario';
        break;
      }
      case 'editar': {
        const actual = delPanel.find((u) => mismoCorreo(u.correo, correo));
        if (!actual) throw new Problema('No existe ese usuario.');
        if (!nombre) throw new Problema('Escribe el nombre.');
        if (clave && clave.length < MIN_CLAVE) throw new Problema(`La contraseña debe tener al menos ${MIN_CLAVE} caracteres.`);
        if (mismoCorreo(correo, yo.correo) && rol !== 'admin') throw new Problema('No puedes quitarte a ti el rol de administrador.');
        if (!quedanAdmins(correo, rol)) throw new Problema('Tiene que quedar al menos un administrador.');
        nueva = delPanel.map((u) => (u === actual ? { ...u, nombre, rol, clave: clave ? hashClave(clave) : u.clave } : u));
        mensaje = 'Admin: editar usuario';
        break;
      }
      case 'borrar': {
        if (!delPanel.some((u) => mismoCorreo(u.correo, correo))) throw new Problema('No existe ese usuario.');
        if (mismoCorreo(correo, yo.correo)) throw new Problema('No puedes borrar tu propio usuario.');
        if (!quedanAdmins(correo)) throw new Problema('Tiene que quedar al menos un administrador.');
        nueva = delPanel.filter((u) => !mismoCorreo(u.correo, correo));
        mensaje = 'Admin: borrar usuario';
        break;
      }
      default:
        throw new Problema('Acción desconocida.');
    }
    // El mensaje del commit no lleva el correo: el repo es público
    await guardarUsuariosArchivo(nueva, mensaje, yo);
    return json(await lista());
  } catch (error) {
    if (error instanceof Problema) return json({ error: error.message }, 400);
    console.error('[api/usuarios]', error);
    return json({ error: error instanceof Error ? error.message : 'Error desconocido' }, 500);
  }
};
