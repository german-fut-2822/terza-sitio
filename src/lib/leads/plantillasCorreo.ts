import type { DatosContactoGeneral, DatosCotizacion, DatosDistribuidor, DatosGreenwall } from './tipos';

export interface ContenidoCorreo {
  asunto: string;
  replyTo: string;
  cuerpoHtml: string;
}

const escapar = (valor: unknown) => String(valor ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

function cuerpo(titulo: string, campos: Array<[string, unknown]>) {
  const filas = campos
    .filter(([, valor]) => valor !== undefined && valor !== null && valor !== '')
    .map(([etiqueta, valor]) => `<li><strong>${escapar(etiqueta)}:</strong> ${escapar(valor)}</li>`)
    .join('');

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapar(titulo)}</title></head><body><p>${escapar(titulo)}</p><ul>${filas}</ul></body></html>`;
}

export function correoContacto(datos: Partial<DatosContactoGeneral>): ContenidoCorreo {
  return {
    asunto: 'Contacto Terza Web',
    replyTo: datos.email ?? '',
    cuerpoHtml: cuerpo('Estos son los datos del mensaje:', [
      ['Nombre', datos.nombre],
      ['Apellido', datos.apellido],
      ['Email', datos.email],
      ['Teléfono', datos.telefono],
      ['Estado', datos.estado],
      ['Ciudad', datos.municipio],
      ['Mensaje', datos.mensaje],
      ['Aviso de privacidad', datos.avisodeprivacidad],
    ]),
  };
}

export function correoDistribuidor(datos: Partial<DatosDistribuidor>): ContenidoCorreo {
  return {
    asunto: 'Prospecto Distribuidor Terza Web',
    replyTo: datos.email ?? '',
    cuerpoHtml: cuerpo('Estos son los datos del prospecto distribuidor:', [
      ['Nombre', datos.nombre],
      ['Apellido', datos.apellido],
      ['Email', datos.email],
      ['Teléfono', datos.telefono],
      ['Estado', datos.estado],
      ['Ciudad', datos.municipio],
      ['Mensaje', datos.mensaje],
      ['Aviso de privacidad', datos.avisodeprivacidad],
    ]),
  };
}

export function correoCotizacion(datos: Partial<DatosCotizacion>): ContenidoCorreo {
  return {
    asunto: 'Contacto Terza Web',
    replyTo: datos.email ?? '',
    cuerpoHtml: cuerpo('Estos son los datos de la solicitud de cotización:', [
      ['Nombre', datos.nombre],
      ['Apellido', datos.apellido],
      ['Email', datos.email],
      ['Teléfono', datos.telefono],
      ['Estado', datos.estado],
      ['Ciudad', datos.municipio],
      ['Categoría', datos.categoria],
      ['Producto', datos.producto],
      ['SKU', datos.sku],
      ['Tipo de pasto', datos.tipo_pasto],
      ['Tamaño del proyecto', datos.proyecto],
      ['Comentarios', datos.mensaje],
      ['Aviso de privacidad', datos.avisodeprivacidad],
      ['Ruta', datos.ruta],
    ]),
  };
}

export function correoGreenwall(datos: Partial<DatosGreenwall>): ContenidoCorreo {
  return {
    asunto: 'Mensaje desde la forma de contacto Greenwall',
    replyTo: datos.correo ?? '',
    cuerpoHtml: cuerpo('Estos son los datos del mensaje Greenwall:', [
      ['Nombre', datos.nombre],
      ['Email', datos.correo],
      ['Teléfono', datos.telefono],
      ['Estado', datos.estado],
      ['Ciudad', datos.ciudad],
      ['Mensaje', datos.mensaje],
    ]),
  };
}
