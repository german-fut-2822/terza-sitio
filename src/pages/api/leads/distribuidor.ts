// Réplica de ContactController@sendDistribuidor (distribuidor.blade.php). El original SOLO
// mandaba un correo a prospectos@terza.com, sin Omnia/n8n/Ongoing/Marketing Cloud.
// Eso ya no aplica: Germán confirmó que TODOS los formularios van a Ongoing ahora, y que el
// correo de aviso a staff ya no hace falta (Ongoing ya distribuye al distribuidor que
// corresponde). Por eso este formulario, que en el original no tenía ninguna integración más
// que el correo, ahora solo manda a Ongoing.
import type { APIRoute } from 'astro';
import type { DatosDistribuidor } from '../../../lib/leads/tipos';
import { esSpam, validarContacto } from '../../../lib/leads/validar';
import { enviarOngoing, detalleOngoing } from '../../../lib/leads/ongoing';

export const prerender = false;

const json = (datos: unknown, status = 200) =>
  new Response(JSON.stringify(datos), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  const esFormulario = !request.headers.get('content-type')?.includes('application/json');
  const datos = (esFormulario
    ? Object.fromEntries(await request.formData())
    : await request.json().catch(() => ({}))) as Partial<DatosDistribuidor>;

  if (esSpam(datos.dataspam as string | undefined)) return json({ ok: true });

  const error = validarContacto(datos.nombre as string | undefined, datos.email as string | undefined, datos.telefono as string | undefined);
  if (error) return json({ error }, 422);

  const entregado = await enviarOngoing({
    first_name: datos.nombre ?? '',
    last_name: datos.apellido,
    email: datos.email ?? '',
    phone: datos.telefono,
    opportunity_title: 'Quiero ser distribuidor - Terza Web',
    message: detalleOngoing({ Estado: datos.estado, Municipio: datos.municipio }, datos.mensaje),
  }).catch((e) => {
    console.error('[leads/distribuidor]', e);
    return false;
  });

  if (!entregado) return json({ error: 'Por el momento no podemos enviar tu información. Intenta más tarde.' }, 503);

  return json({ ok: true });
};
