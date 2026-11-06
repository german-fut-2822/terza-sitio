// Réplica de ContactController@sendDistribuidor (distribuidor.blade.php), verificada contra
// ~/Documents/terzaweb: es el más simple de los 5 — SOLO manda un correo a un destinatario fijo,
// sin Omnia, sin n8n, sin Ongoing, sin Marketing Cloud.
import type { APIRoute } from 'astro';
import type { DatosDistribuidor } from '../../../lib/leads/tipos';
import { esSpam, validarContacto } from '../../../lib/leads/validar';
import { destinatarioDistribuidor } from '../../../lib/leads/destinatarios';
import { enviarCorreo } from '../../../lib/leads/correo';
import { correoDistribuidor } from '../../../lib/leads/plantillasCorreo';

export const prerender = false;

const json = (datos: unknown, status = 200) =>
  new Response(JSON.stringify(datos), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  const esFormulario = !request.headers.get('content-type')?.includes('application/json');
  const datos = (esFormulario
    ? Object.fromEntries(await request.formData())
    : await request.json().catch(() => ({}))) as Partial<DatosDistribuidor>;

  if (esSpam(datos.dataspam)) return json({ ok: true });

  const error = validarContacto(datos.nombre, datos.email, datos.telefono);
  if (error) return json({ error }, 422);

  try {
    await enviarCorreo({ ...correoDistribuidor(datos), destinatarios: [destinatarioDistribuidor] });
    return json({ ok: true });
  } catch (error) {
    console.error('[leads/distribuidor]', error);
    return json({ error: 'Por el momento no podemos enviar este formulario. Intenta más tarde.' }, 503);
  }
};
