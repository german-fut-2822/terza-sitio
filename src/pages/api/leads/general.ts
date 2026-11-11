// Réplica de ContactController@sendContactoGeneral (contacto.blade.php), verificada línea por
// línea contra ~/Documents/terzaweb. Dispara Omnia(41) + Ongoing.
// n8n se quitó a propósito: según confirmó el jefe de Germán, n8n solo se usaba para respaldar
// leads hacia Ongoing — en esta versión se va directo a la API de Ongoing (enviarOngoing).
// El correo de aviso a staff también se quitó: el jefe confirmó que con que el lead llegue a
// Ongoing basta — ahí ya tienen su propio sistema que lo distribuye al distribuidor que
// corresponde, así que la lógica de destinatarios por categoría ya no hace falta aquí.
import type { APIRoute } from 'astro';
import type { DatosContactoGeneral } from '../../../lib/leads/tipos';
import { validarContacto, esSpam } from '../../../lib/leads/validar';
import { enviarOmnia } from '../../../lib/leads/omnia';
import { enviarOngoing, metadataOngoing, nombreCompleto } from '../../../lib/leads/ongoing';

export const prerender = false;

const json = (datos: unknown, status = 200) =>
  new Response(JSON.stringify(datos), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  const esFormulario = !request.headers.get('content-type')?.includes('application/json');
  const datos = (esFormulario
    ? Object.fromEntries(await request.formData())
    : await request.json().catch(() => ({}))) as Partial<DatosContactoGeneral>;

  if (esSpam(datos.dataspam)) return json({ ok: true });

  const error = validarContacto(datos.nombre, datos.email, datos.telefono);
  if (error) return json({ error }, 422);

  const resultados = await Promise.allSettled([
    enviarOmnia(41, {
      nombre: datos.nombre!,
      correo: datos.email!,
      telefono: datos.telefono!,
      estado: datos.estado,
      ciudad: datos.municipio,
      comentarios: datos.mensaje,
    }),
    enviarOngoing({
      first_name: datos.nombre ?? '',
      last_name: datos.apellido,
      email: datos.email ?? '',
      phone: datos.telefono,
      company_name: nombreCompleto(datos.nombre ?? '', datos.apellido),
      opportunity_title: 'Contacto general - Terza Web',
      metadata: metadataOngoing({ Estado: datos.estado, Municipio: datos.municipio }),
      message: datos.mensaje,
    }),
  ]);
  resultados.forEach((r) => r.status === 'rejected' && console.error('[leads/general]', r.reason));

  const entregado = resultados.some((r) => r.status === 'fulfilled' && r.value);
  if (!entregado) return json({ error: 'Por el momento no podemos enviar tu información. Intenta más tarde.' }, 503);

  return json({ ok: true });
};
