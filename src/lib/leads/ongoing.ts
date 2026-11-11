// Ongoing (CRM que distribuye leads al distribuidor correspondiente, terza.ongoing2.mx). Lo usan
// los 4 formularios. Endpoint documentado: POST /api/v1/leads, auth "Authorization: Bearer <token>".
// ONGOING_BASE_URL debe ser la URL completa del endpoint (https://terza.ongoing2.mx/api/v1/leads).
import { variable } from '../admin/entorno';

export interface LeadOngoing {
  first_name: string;
  last_name?: string;
  email: string;
  phone?: string;
  position?: string;
  company_name?: string;
  opportunity_title: string;
  amount?: number;
  campaign_id?: number;
  message?: string;
  metadata?: string[];
}

// Ongoing exige company_name (sin él su API truena con "Column 'company_id' cannot be null" en
// vez de crear la empresa genérica "(particular)" que sí usa el resto de su sistema). Mandamos el
// nombre del contacto como su empresa, que es como aparecen ahí las demás personas sin empresa real.
export function nombreCompleto(nombre: string, apellido?: string): string {
  return apellido ? `${nombre} ${apellido}` : nombre;
}

// Los datos que el formulario captura pero que no tienen campo propio en el schema de Ongoing
// (estado, ciudad, sku, etc.) van en "metadata" — separado de "message", que es la nota libre del
// lead. Ongoing muestra cada elemento como un campo de "Datos complementarios" con el índice del
// array (0, 1...) como título — no hay forma documentada de ponerle el título real (p. ej.
// "CIUDAD") sin confirmar con Ongoing el formato exacto que esperan; no adivinar más formatos aquí.
export function metadataOngoing(partes: Record<string, string | undefined>): string[] {
  return Object.entries(partes)
    .filter(([, v]) => v)
    .map(([clave, valor]) => `${clave}: ${valor}`);
}

export async function enviarOngoing(lead: LeadOngoing): Promise<boolean> {
  const host = variable('ONGOING_BASE_URL');
  const apiKey = variable('ONGOING_API_KEY');
  if (!host || !apiKey) {
    console.warn('[leads/ongoing] ONGOING_BASE_URL/ONGOING_API_KEY no configurados, se omite el envío');
    return false;
  }
  const datos = Object.fromEntries(
    Object.entries(lead).filter(([, v]) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)),
  );
  const respuesta = await fetch(host, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  });
  if (!respuesta.ok) throw new Error(`Ongoing respondió ${respuesta.status}: ${await respuesta.text()}`);
  return true;
}
