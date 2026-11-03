// Usuarios del administrador del blog (sección Usuarios del panel). Solo para administradores.
// GET: { usuarios (sin contraseñas), correoActivo }. POST { accion: 'crear' | 'editar' | 'borrar' | 'enlace', ... }: cambia el
// archivo cifrado de usuarios (src/lib/admin/usuarios.ts) y regresa { usuarios, aviso }. Al crear, se manda un correo de
// bienvenida con un enlace para crear su contraseña (si hay servicio de correo, la contraseña es opcional); 'enlace' manda
// uno nuevo. Los usuarios de la variable ADMIN_USUARIOS se ven, pero no se pueden cambiar aquí.
import type { APIRoute } from 'astro';
import { correoActivo, correoBienvenida, correoRecuperar, enviarCorreo } from '../../lib/admin/correo';
import { crearEnlaceClave, hashClave, todosLosUsuarios, usuarioDeSesion } from '../../lib/admin/sesion';
import { guardarUsuariosArchivo, leerUsuariosArchivo, type Rol } from '../../lib/admin/usuarios';

export const prerender = false;

const json = (datos: unknown, status = 200) => new Response(JSON.stringify(datos), { status, headers: { 'Content-Type': 'application/json' } });
const mismoCorreo = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_CLAVE = 10;

class Problema extends Error {}

async function lista() {
  // pendiente: todavía no crea su contraseña (se dio de alta sin ella y no ha usado el enlace del correo)
  return (await todosLosUsuarios()).map(({ correo, nombre, rol, fijo, clave }) => ({ correo, nombre, rol, fijo, pendiente: !clave }));
}

export const GET: APIRoute = async ({ cookies }) => {
  const usuario = await usuarioDeSesion(cookies);
  if (!usuario) return json({ error: 'La sesión expiró; vuelve a entrar.' }, 401);
  if (usuario.rol !== 'admin') return json({ error: 'Solo los administradores pueden ver los usuarios.' }, 403);
  return json({ usuarios: await lista(), correoActivo: correoActivo() });
};

export const POST: APIRoute = async ({ request, cookies, url }) => {
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
        // Sin servicio de correo la contraseña es obligatoria; con servicio, la persona puede crear la suya con el enlace
        if (clave ? clave.length < MIN_CLAVE : !correoActivo()) throw new Problema(`La contraseña debe tener al menos ${MIN_CLAVE} caracteres.`);
        if (todos.some((u) => mismoCorreo(u.correo, correo))) throw new Problema('Ya hay un usuario con ese correo.');
        nueva = [...delPanel, { correo, nombre, rol, clave: clave ? hashClave(clave) : '' }];
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
      // Mandar otra vez el enlace para crear o cambiar la contraseña (no cambia nada en el archivo)
      case 'enlace': {
        const usuario = delPanel.find((u) => mismoCorreo(u.correo, correo));
        if (!usuario) throw new Problema('No existe ese usuario.');
        const enlace = new URL(`/admin/restablecer.html?t=${crearEnlaceClave(usuario, 24)}`, url.origin).href;
        const enviado = await enviarCorreo({ ...correoRecuperar(usuario.correo, usuario.nombre, enlace), asunto: 'Crea tu contraseña del administrador del blog de Terza' });
        return json({ usuarios: await lista(), aviso: enviado ? `Le enviamos a ${usuario.nombre} un enlace para crear su contraseña.` : 'No hay servicio de correo configurado: no se envió el enlace.' });
      }
      default:
        throw new Problema('Acción desconocida.');
    }
    // El mensaje del commit no lleva el correo: el repo es público
    await guardarUsuariosArchivo(nueva, mensaje, yo);

    // Bienvenida: enlace para entrar y para crear su contraseña (7 días)
    let aviso = '';
    if (datos.accion === 'crear') {
      const usuario = nueva[nueva.length - 1];
      const enlaceClave = new URL(`/admin/restablecer.html?t=${crearEnlaceClave(usuario, 24 * 7)}`, url.origin).href;
      const enlaceEntrar = new URL('/admin/login.html', url.origin).href;
      const enviado = await enviarCorreo(
        correoBienvenida(usuario.correo, usuario.nombre, yo.nombre, rol === 'admin' ? 'administrador' : 'editor', enlaceClave, enlaceEntrar, Boolean(clave)),
      );
      aviso = enviado
        ? `Le enviamos a ${nombre} un correo de bienvenida${clave ? '' : ' para que cree su contraseña'}.`
        : 'No hay servicio de correo configurado: compártele su correo y contraseña por un medio seguro.';
    }
    return json({ usuarios: await lista(), aviso });
  } catch (error) {
    if (error instanceof Problema) return json({ error: error.message }, 400);
    console.error('[api/usuarios]', error);
    return json({ error: error instanceof Error ? error.message : 'Error desconocido' }, 500);
  }
};
