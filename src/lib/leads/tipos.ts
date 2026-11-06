// Contrato de los 5 formularios de leads, verificado directamente contra
// ~/Documents/terzaweb (ContactController.php y los Blade de resources/views/front).
// Cada formulario original usa su propio vocabulario de campos (email vs correo,
// municipio vs ciudad, nombre vs nombre_contacto) — no se unifica a la fuerza.

export interface DatosContactoGeneral {
  nombre: string;
  apellido?: string;
  email: string;
  telefono: string;
  estado?: string;
  municipio?: string;
  avisodeprivacidad?: string;
  dataspam?: string;
  mensaje?: string;
}

export interface DatosCotizacion {
  nombre: string;
  apellido?: string;
  email: string;
  telefono: string;
  estado?: string;
  municipio?: string;
  mensaje?: string;
  categoria: string; // slug: pisos-de-madera, pisos-laminados, piso-vinilico, persianas, pasto-sintetico, etc.
  producto: string;
  sku: string;
  proyecto?: string;
  tipo_pasto?: string;
  ruta: string;
  avisodeprivacidad?: string;
  dataspam?: string;
}

export interface DatosGreenwall {
  nombre: string;
  correo: string;
  telefono: string;
  estado?: string;
  ciudad?: string;
  mensaje?: string;
}

export interface DatosDistribuidor {
  nombre: string;
  apellido?: string;
  email: string;
  telefono: string;
  estado?: string;
  municipio?: string;
  mensaje?: string;
  avisodeprivacidad?: string;
  dataspam?: string;
}
