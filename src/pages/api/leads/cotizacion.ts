// Réplica de ContactController@sendContacto (quote-form.blade.php, cotización por SKU),
// verificada contra ~/Documents/terzaweb. Dispara Omnia(41) + n8n + Ongoing + correo.
// El destinatario real sale de la tabla contactos_cotizaciones (categoria -> to/cc) en la DB
// de Laravel — se usa el seeder como mejor fuente disponible, ver destinatarios.ts.
import type { APIRoute } from 'astro';
import type { DatosCotizacion } from '../../../lib/leads/tipos';
import { validarContacto, esSpam } from '../../../lib/leads/validar';
import { enviarOmnia } from '../../../lib/leads/omnia';
import { enviarN8n } from '../../../lib/leads/n8n';
import { enviarOngoing } from '../../../lib/leads/ongoing';
import { destinatariosCotizacion } from '../../../lib/leads/destinatarios';
import { enviarCorreo } from '../../../lib/leads/correo';
import { correoCotizacion } from '../../../lib/leads/plantillasCorreo';

export const prerender = false;

const json = (datos: unknown, status = 200) =>
  new Response(JSON.stringify(datos), { status, headers: { 'Content-Type': 'application/json' } });

// Igual que $mapCategorias en el controlador original: normaliza el slug de categoría a un
// nombre legible para Omnia/n8n. Las claves que faltan (p. ej. una categoría nueva) se mandan
// tal cual, como hacía el original con el `?? $request->categoria`.
const MAPA_CATEGORIAS: Record<string, string> = {
  accesorios: 'Accesorios',
  alfombras: 'Alfombras',
  flexiroc: 'Flexiroc',
  'muros-verdes': 'Follaje Artificial',
  paneles: 'Lambrín y paneles',
  'pasto-sintetico': 'Pastos Sintéticos',
  'persianas-de-madera': 'Persianas',
  'persianas-enrollables': 'Persianas',
  'piso-vinilico': 'Pisos Vinílicos',
  'pisos-de-madera': 'Pisos de Madera',
  'pisos-deck': 'Pisos de Madera',
  'pisos-hibridos': 'Pisos Híbridos',
  'pisos-laminados': 'Pisos Laminados',
};

const DESTINO_POR_CATEGORIA: Record<string, string> = {
  'pisos-de-madera': 'Pisos Madera y Deck',
  'pisos-deck': 'Pisos Madera y Deck',
  'pisos-laminados': 'Pisos Laminados',
  'piso-vinilico': 'Pisos Vinilicos',
  'persianas-de-madera': 'Persianas',
  'persianas-enrollables': 'Persianas',
  'pasto-sintetico': 'Terza Pastos',
};

export const POST: APIRoute = async ({ request }) => {
  const esFormulario = !request.headers.get('content-type')?.includes('application/json');
  const datos = (esFormulario
    ? Object.fromEntries(await request.formData())
    : await request.json().catch(() => ({}))) as Partial<DatosCotizacion>;

  const error = validarContacto(datos.nombre, datos.email, datos.telefono);
  if (error) return json({ error }, 422);
  if (!datos.categoria || !datos.sku) return json({ error: 'Falta categoría o SKU' }, 422);

  const categoriaProducto = MAPA_CATEGORIAS[datos.categoria] ?? datos.categoria;
  const destinatarios = destinatariosCotizacion[DESTINO_POR_CATEGORIA[datos.categoria] ?? 'General'];
  let producto = `Producto: ${datos.producto ?? ''} SKU: ${datos.sku ?? ''}`;
  if (datos.proyecto) producto += ` Tamaño: ${datos.proyecto}`;
  if (datos.tipo_pasto) producto += ` Tipo de pasto: ${datos.tipo_pasto}`;

  const resultados = await Promise.allSettled([
    enviarOmnia(41, {
      nombre: datos.nombre!,
      correo: datos.email!,
      telefono: datos.telefono!,
      estado: datos.estado,
      ciudad: datos.municipio,
      interes: `${categoriaProducto} - ${producto}`,
      ruta: datos.ruta,
      comentarios: datos.mensaje,
    }),
    enviarN8n({
      nombre: datos.nombre ?? '',
      apellido: datos.apellido ?? '',
      email: datos.email ?? '',
      telefono: datos.telefono ?? '',
      estado: datos.estado ?? '',
      municipio: datos.municipio ?? '',
      categoria: datos.categoria, // slug original, no el nombre mapeado
      producto: datos.producto ?? '',
      sku: datos.sku,
      proyecto: datos.proyecto ?? '',
      tipo_pasto: datos.tipo_pasto ?? '',
      mensaje: datos.mensaje ?? '',
      aviso_privacidad: datos.avisodeprivacidad ?? '',
      ruta: datos.ruta ?? '',
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
      product: datos.producto ?? '',
      message: datos.mensaje ?? '',
      categoria: datos.categoria,
      sku: datos.sku,
      ruta: datos.ruta ?? '',
      tipo_pasto: datos.tipo_pasto ?? '',
      proyecto: datos.proyecto ?? '',
    }),
    enviarCorreo({ ...correoCotizacion(datos), destinatarios: destinatarios.to, copia: destinatarios.cc }),
  ]);
  resultados.forEach((r) => r.status === 'rejected' && console.error('[leads/cotizacion]', r.reason));

  const entregado = resultados.some((r) => r.status === 'fulfilled' && r.value);
  if (!entregado) return json({ error: 'Por el momento no podemos enviar tu información. Intenta más tarde.' }, 503);

  return json({ ok: true });
};
