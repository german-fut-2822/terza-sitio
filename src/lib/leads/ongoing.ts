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
}

// Junta en un solo texto los datos que el formulario captura pero que no tienen campo propio en
// el schema de Ongoing (estado, ciudad, sku, etc.) — se van como parte de "message", que es el
// detalle libre visible para el vendedor.
export function detalleOngoing(partes: Record<string, string | undefined>, mensaje?: string): string {
  const etiquetas = Object.entries(partes)
    .filter(([, v]) => v)
    .map(([clave, valor]) => `${clave}: ${valor}`);
  if (mensaje) etiquetas.push(mensaje);
  return etiquetas.join(' | ');
}

export async function enviarOngoing(lead: LeadOngoing): Promise<boolean> {
  const host = variable('ONGOING_BASE_URL');
  const apiKey = variable('ONGOING_API_KEY');
  if (!host || !apiKey) {
    console.warn('[leads/ongoing] ONGOING_BASE_URL/ONGOING_API_KEY no configurados, se omite el envío');
    return false;
  }
  const datos = Object.fromEntries(Object.entries(lead).filter(([, v]) => v !== null && v !== undefined && v !== ''));
  const respuesta = await fetch(host, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  });
  if (!respuesta.ok) throw new Error(`Ongoing respondió ${respuesta.status}`);
  return true;
}
