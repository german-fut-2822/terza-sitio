// Inicio de sesión del administrador del blog (/admin) con GitHub: manda a la pantalla de autorización de GitHub.
// Corre en Vercel (no se genera como página estática). Variables: GITHUB_CLIENT_ID y GITHUB_CLIENT_SECRET.
import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = ({ url, cookies, redirect }) => {
  const clientId = import.meta.env.GITHUB_CLIENT_ID ?? process.env.GITHUB_CLIENT_ID;
  if (!clientId) return new Response('Falta configurar GITHUB_CLIENT_ID en Vercel.', { status: 500 });

  // Valor al azar que GitHub regresa en /api/callback para confirmar que la respuesta es de este inicio de sesión
  const state = crypto.randomUUID();
  cookies.set('decap_oauth_state', state, { httpOnly: true, secure: url.protocol === 'https:', sameSite: 'lax', path: '/api', maxAge: 600 });

  const destino = new URL('https://github.com/login/oauth/authorize');
  destino.searchParams.set('client_id', clientId);
  destino.searchParams.set('redirect_uri', new URL('/api/callback', url.origin).href);
  destino.searchParams.set('scope', url.searchParams.get('scope') ?? 'repo,user');
  destino.searchParams.set('state', state);
  return redirect(destino.href);
};
