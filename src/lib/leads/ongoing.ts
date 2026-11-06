// Ongoing (CRM de seguimiento comercial, flow.ongoing.mx). Verificado: solo lo usan general y
// cotización (sendToOngoing), el header de auth es fijo — "X-Api-Key", no Bearer.
import { variable } from '../admin/entorno';

export async function enviarOngoing(payload: Record<string, unknown>): Promise<boolean> {
  const host = variable('ONGOING_LEADS_HOST');
  const apiKey = variable('ONGOING_API_KEY');
  if (!host || !apiKey) {
    console.warn('[leads/ongoing] ONGOING_LEADS_HOST/ONGOING_API_KEY no configurados, se omite el envío');
    return false;
  }
  const datos = Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== null && v !== ''));
  const respuesta = await fetch(host, {
    method: 'POST',
    headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  });
  if (!respuesta.ok) throw new Error(`Ongoing respondió ${respuesta.status}`);
  return true;
}
