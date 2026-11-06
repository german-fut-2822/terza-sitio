// n8n (workflow que registra en Sheets). Solo se usa desde el form general y el de cotización,
// igual que en el Laravel original (sendToN8n, línea 38). El nombre del header de auth también
// es configurable vía env, tal como config/services.php lo tenía.
import { variable } from '../admin/entorno';

export async function enviarN8n(payload: Record<string, unknown>): Promise<boolean> {
  const host = variable('N8N_HOST');
  if (!host) return false; // igual que el original: si N8N_HOST está vacío, se omite en silencio

  const headerNombre = variable('N8N_AUTH_HEADER');
  const headerValor = variable('N8N_AUTH_TOKEN');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (headerNombre && headerValor) headers[headerNombre] = headerValor;

  const respuesta = await fetch(host, { method: 'POST', headers, body: JSON.stringify(payload) });
  if (!respuesta.ok) throw new Error(`n8n respondió ${respuesta.status}`);
  return true;
}
