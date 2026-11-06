// Réplica de ContactController@sendContactoGeneral (contacto.blade.php), verificada línea por
// línea contra ~/Documents/terzaweb. Dispara Omnia(41) + n8n + Ongoing + correo.
import type { APIRoute } from 'astro';
import type { DatosContactoGeneral } from '../../../lib/leads/tipos';
import { validarContacto, esSpam } from '../../../lib/leads/validar';
import { enviarOmnia } from '../../../lib/leads/omnia';
import { enviarN8n } from '../../../lib/leads/n8n';
import { enviarOngoing } from '../../../lib/leads/ongoing';
import { destinatariosGeneral } from '../../../lib/leads/destinatarios';
import { enviarCorreo } from '../../../lib/leads/correo';
import { correoContacto } from '../../../lib/leads/plantillasCorreo';

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
    enviarN8n({
      nombre: datos.nombre ?? '',
      apellido: datos.apellido ?? '',
      email: datos.email ?? '',
      telefono: datos.telefono ?? '',
      estado: datos.estado ?? '',
      municipio: datos.municipio ?? '',
      categoria: '',
      proyecto: '',
      tipo_pasto: '',
      tipo_deporte: '',
      mensaje: datos.mensaje ?? '',
      aviso_privacidad: datos.avisodeprivacidad ?? '',
      tipo_cliente: '',
      origen: 'Terza Web',
      fecha: new Date().toISOString(),
    }),
    enviarOngoing({
      first_name: datos.nombre ?? '',
      last_name: datos.apellido ?? '',
      email: datos.email ?? '',
      phone: datos.telefono ?? '',
      state: datos.estado ?? '',
      city: datos.municipio ?? '',
      message: datos.mensaje ?? '',
    }),
    enviarCorreo({ ...correoContacto(datos), destinatarios: destinatariosGeneral.default.to, copia: destinatariosGeneral.default.cc }),
  ]);
  resultados.forEach((r) => r.status === 'rejected' && console.error('[leads/general]', r.reason));

  const entregado = resultados.some((r) => r.status === 'fulfilled' && r.value);
  if (!entregado) return json({ error: 'Por el momento no podemos enviar tu información. Intenta más tarde.' }, 503);

  return json({ ok: true });
};
