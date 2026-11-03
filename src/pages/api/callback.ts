// Regreso de GitHub al iniciar sesión en el administrador del blog: cambia el código por un token y se lo pasa a
// la ventana de /admin con el protocolo de Decap CMS ("authorization:github:success:{...}").
import type { APIRoute } from 'astro';

export const prerender = false;

// Página mínima que avisa a la ventana del administrador y se cierra
const respuesta = (estado: 'success' | 'error', datos: Record<string, string>) => {
  const mensaje = JSON.stringify(`authorization:github:${estado}:${JSON.stringify(datos)}`);
  const html = `<!doctype html><html lang="es"><meta charset="utf-8"><title>Terza</title><body>
<p>${estado === 'success' ? 'Sesión iniciada, regresando al administrador…' : 'No se pudo iniciar sesión. Cierra esta ventana e inténtalo de nuevo.'}</p>
<script>
  (function () {
    function recibir(e) {
      window.opener.postMessage(${mensaje}, e.origin);
      window.removeEventListener('message', recibir, false);
    }
    window.addEventListener('message', recibir, false);
    window.opener && window.opener.postMessage('authorizing:github', '*');
  })();
</script></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
};

export const GET: APIRoute = async ({ url, cookies }) => {
  const clientId = import.meta.env.GITHUB_CLIENT_ID ?? process.env.GITHUB_CLIENT_ID;
  const clientSecret = import.meta.env.GITHUB_CLIENT_SECRET ?? process.env.GITHUB_CLIENT_SECRET;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const esperado = cookies.get('decap_oauth_state')?.value;
  cookies.delete('decap_oauth_state', { path: '/api' });

  if (!clientId || !clientSecret) return respuesta('error', { message: 'Falta configurar GITHUB_CLIENT_ID y GITHUB_CLIENT_SECRET en Vercel.' });
  if (!code || !state || state !== esperado) return respuesta('error', { message: 'La solicitud de inicio de sesión no es válida o expiró.' });

  const r = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: new URL('/api/callback', url.origin).href }),
  });
  const datos = (await r.json().catch(() => ({}))) as { access_token?: string; error_description?: string };
  if (!datos.access_token) return respuesta('error', { message: datos.error_description ?? 'GitHub no regresó un token.' });

  return respuesta('success', { token: datos.access_token, provider: 'github' });
};
