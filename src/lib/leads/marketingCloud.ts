// Salesforce Marketing Cloud (Journey Builder). Verificado contra ContactController.php: solo lo
// usan Greenwall y Empresa. El subdominio, client_id/secret, account_id y la event definition key
// estaban hardcodeados en texto plano ahí (líneas 131-137 y 484-490) — esa es la fuga de
// credenciales de +4 años que detectamos; aquí van solo por variable de entorno.
import { variable } from '../admin/entorno';

let tokenCacheado: { valor: string; expira: number } | null = null;

async function obtenerToken(): Promise<string> {
  if (tokenCacheado && tokenCacheado.expira > Date.now()) return tokenCacheado.valor;

  const authHost = variable('MC_AUTH_HOST'); // https://{subdominio}.auth.marketingcloudapis.com
  const clientId = variable('MC_CLIENT_ID');
  const clientSecret = variable('MC_CLIENT_SECRET');
  const accountId = variable('MC_ACCOUNT_ID');
  if (!authHost || !clientId || !clientSecret) {
    throw new Error('Marketing Cloud no configurado (MC_AUTH_HOST/MC_CLIENT_ID/MC_CLIENT_SECRET)');
  }

  const respuesta = await fetch(`${authHost}/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      account_id: accountId,
    }),
  });
  if (!respuesta.ok) throw new Error(`Marketing Cloud (token) respondió ${respuesta.status}`);
  const { access_token, expires_in } = (await respuesta.json()) as { access_token: string; expires_in: number };
  tokenCacheado = { valor: access_token, expira: Date.now() + expires_in * 1000 - 5000 };
  return access_token;
}

export async function dispararEventoMarketingCloud(contactKey: string, datosEvento: Record<string, unknown>): Promise<boolean> {
  const restHost = variable('MC_REST_HOST'); // https://{subdominio}.rest.marketingcloudapis.com
  const definicionEvento = variable('MC_EVENT_DEFINITION_KEY');
  if (!restHost || !definicionEvento) {
    console.warn('[leads/marketingCloud] MC_REST_HOST/MC_EVENT_DEFINITION_KEY no configurados, se omite el envío');
    return false;
  }
  const token = await obtenerToken();
  const respuesta = await fetch(`${restHost}/interaction/v1/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ContactKey: contactKey, EventDefinitionKey: definicionEvento, Data: datosEvento }),
  });
  if (!respuesta.ok) throw new Error(`Marketing Cloud (evento) respondió ${respuesta.status}`);
  return true;
}
