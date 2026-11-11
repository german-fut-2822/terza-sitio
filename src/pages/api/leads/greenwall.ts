// Réplica de ContactController@sendGreenwall (greenwall.blade.php): Omnia(42) + Marketing Cloud.
// El Laravel original nunca mandaba este form a Ongoing (solo general/cotización lo hacían) y
// solo avisaba por correo — pero Germán confirmó que ahora TODOS los formularios van a Ongoing,
// y el correo de aviso a staff ya no hace falta (Ongoing ya distribuye al distribuidor que
// corresponde). Por eso aquí se agregó enviarOngoing, que no es una réplica del original.
import type { APIRoute } from 'astro';
import type { DatosGreenwall } from '../../../lib/leads/tipos';
import { validarContacto } from '../../../lib/leads/validar';
import { enviarOmnia } from '../../../lib/leads/omnia';
import { enviarOngoing, nombreCompleto } from '../../../lib/leads/ongoing';
import { dispararEventoMarketingCloud } from '../../../lib/leads/marketingCloud';

export const prerender = false;

const json = (datos: unknown, status = 200) =>
  new Response(JSON.stringify(datos), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  const esFormulario = !request.headers.get('content-type')?.includes('application/json');
  const datos = (esFormulario
    ? Object.fromEntries(await request.formData())
    : await request.json().catch(() => ({}))) as Partial<DatosGreenwall>;

  const error = validarContacto(datos.nombre, datos.correo, datos.telefono);
  if (error) return json({ error }, 422);

  const resultados = await Promise.allSettled([
    enviarOmnia(42, {
      nombre: datos.nombre!,
      correo: datos.correo!,
      telefono: datos.telefono!,
      estado: datos.estado,
      ciudad: datos.ciudad,
      comentarios: datos.mensaje,
    }),
    dispararEventoMarketingCloud(datos.correo!, {
      Email: datos.correo,
      Nombre: datos.nombre,
      Apellidos: '-',
      Teléfono: datos.telefono,
      Código_regional: 'es-MX',
      Estado: datos.estado,
      Ciudad: datos.ciudad,
      Producto_de_interés: 'Follaje Artificial', // hardcodeado así en el original
      Tipo_de_cliente: '-',
      Compañía: '-',
      Tamaño_del_proyecto: '-',
      Tipo_Pasto: '-',
      Tipo_Deporte: '-',
      Origen_del_lead: 'Contacto Terza Web',
    }),
    enviarOngoing({
      first_name: datos.nombre ?? '',
      email: datos.correo ?? '',
      phone: datos.telefono,
      company_name: nombreCompleto(datos.nombre ?? ''),
      opportunity_title: 'Greenwall - Terza Web',
      state: datos.estado,
      city: datos.ciudad,
      message: datos.mensaje,
    }),
  ]);
  resultados.forEach((r) => r.status === 'rejected' && console.error('[leads/greenwall]', r.reason));

  const entregado = resultados.some((r) => r.status === 'fulfilled' && r.value);
  if (!entregado) return json({ error: 'Por el momento no podemos enviar tu información. Intenta más tarde.' }, 503);

  return json({ ok: true });
};
