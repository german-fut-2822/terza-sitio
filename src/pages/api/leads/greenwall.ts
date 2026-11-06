// Réplica de ContactController@sendGreenwall (greenwall.blade.php), verificada contra
// ~/Documents/terzaweb. Dispara Omnia(42) + Marketing Cloud + correo a un destinatario fijo
// (no rutea por categoría, a diferencia de general/empresa).
import type { APIRoute } from 'astro';
import type { DatosGreenwall } from '../../../lib/leads/tipos';
import { validarContacto } from '../../../lib/leads/validar';
import { enviarOmnia } from '../../../lib/leads/omnia';
import { dispararEventoMarketingCloud } from '../../../lib/leads/marketingCloud';
import { destinatariosGreenwall } from '../../../lib/leads/destinatarios';
import { enviarCorreo } from '../../../lib/leads/correo';
import { correoGreenwall } from '../../../lib/leads/plantillasCorreo';

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
    enviarCorreo({ ...correoGreenwall(datos), destinatarios: destinatariosGreenwall.to, copia: destinatariosGreenwall.cc }),
  ]);
  resultados.forEach((r) => r.status === 'rejected' && console.error('[leads/greenwall]', r.reason));

  const entregado = resultados.some((r) => r.status === 'fulfilled' && r.value);
  if (!entregado) return json({ error: 'Por el momento no podemos enviar tu información. Intenta más tarde.' }, 503);

  return json({ ok: true });
};
