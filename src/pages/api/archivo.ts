// Imagen del blog para el administrador (miniaturas de las notas y de Medios): /api/archivo?ruta=src/assets/blog/x.jpg
// Solo con sesión iniciada; se lee del mismo lugar donde guarda el panel (GitHub o la carpeta local).
import type { APIRoute } from 'astro';
import { almacen, revisarRuta } from '../../lib/admin/almacen';
import { usuarioDeSesion } from '../../lib/admin/sesion';

export const prerender = false;

const TIPOS: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

export const GET: APIRoute = async ({ url, cookies }) => {
  if (!usuarioDeSesion(cookies)) return new Response('Sin sesión', { status: 401 });
  let ruta: string;
  try {
    ruta = revisarRuta(url.searchParams.get('ruta'));
  } catch {
    return new Response('Ruta no permitida', { status: 400 });
  }
  if (!ruta.startsWith('src/assets/blog/')) return new Response('Ruta no permitida', { status: 400 });
  const contenido = await almacen().leer(ruta);
  if (!contenido) return new Response('No existe', { status: 404 });
  return new Response(new Uint8Array(contenido), {
    headers: { 'Content-Type': TIPOS[ruta.split('.').pop()!.toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': 'private, max-age=300' },
  });
};
