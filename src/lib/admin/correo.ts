// Correos del administrador del blog (recuperar la contraseña y bienvenida a usuarios nuevos).
// Para activarlos, en Vercel (o en .env):
//   CORREO_SERVICIO  = resend | brevo
//   CORREO_LLAVE     = la llave de la API del servicio
//   CORREO_REMITENTE = quien envía, por ejemplo "Blog Terza <blog@terza.com>" (el dominio debe estar verificado en el servicio)
// Sin esas variables no se envía nada: en la computadora el correo se muestra en la terminal de `npm run dev` para poder
// probar los enlaces; en línea solo se avisa en el registro de Vercel.
// Otro servicio: se agrega una función más en SERVICIOS con la misma forma.
import { variable } from './entorno';

export type Correo = { para: string; nombre?: string; asunto: string; html: string; texto: string };
type Remitente = { nombre: string; correo: string };

// "Blog Terza <blog@terza.com>" → { nombre, correo }
function remitente(): Remitente {
  const valor = variable('CORREO_REMITENTE') ?? '';
  const partes = valor.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return partes ? { nombre: partes[1] || 'Terza', correo: partes[2] } : { nombre: 'Terza', correo: valor.trim() };
}

async function revisar(r: Response, servicio: string) {
  if (!r.ok) throw new Error(`${servicio} respondió ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

const SERVICIOS: Record<string, (c: Correo, llave: string, de: Remitente) => Promise<void>> = {
  // https://resend.com/docs/api-reference/emails/send-email
  async resend(c, llave, de) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${llave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `${de.nombre} <${de.correo}>`, to: [c.para], subject: c.asunto, html: c.html, text: c.texto }),
    });
    await revisar(r, 'Resend');
  },
  // https://developers.brevo.com/reference/sendtransacemail
  async brevo(c, llave, de) {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': llave, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: de.nombre, email: de.correo },
        to: [{ email: c.para, ...(c.nombre ? { name: c.nombre } : {}) }],
        subject: c.asunto,
        htmlContent: c.html,
        textContent: c.texto,
      }),
    });
    await revisar(r, 'Brevo');
  },
};

// ¿Hay un servicio de correo configurado?
export function correoActivo() {
  const servicio = variable('CORREO_SERVICIO')?.toLowerCase();
  return Boolean(servicio && SERVICIOS[servicio] && variable('CORREO_LLAVE') && remitente().correo);
}

// Envía el correo; regresa true si salió por el servicio. No lanza error: quien llama decide qué decirle a la persona.
export async function enviarCorreo(correo: Correo): Promise<boolean> {
  if (!correoActivo()) {
    if (import.meta.env.DEV) {
      console.info(`\n[correo sin servicio] Para: ${correo.para}\nAsunto: ${correo.asunto}\n\n${correo.texto}\n`);
    } else {
      console.warn(`[correo] No hay servicio de correo configurado (CORREO_SERVICIO); no se envió "${correo.asunto}".`);
    }
    return false;
  }
  try {
    await SERVICIOS[variable('CORREO_SERVICIO')!.toLowerCase()](correo, variable('CORREO_LLAVE')!, remitente());
    return true;
  } catch (error) {
    console.error('[correo] No se pudo enviar:', error);
    return false;
  }
}

// ---------- Plantillas ----------
const escapar = (t: string) => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

// Correo sencillo con la franja verde de Terza y un botón
function plantilla({ titulo, parrafos, boton, enlace, pie }: { titulo: string; parrafos: string[]; boton: string; enlace: string; pie: string }) {
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;color:#343a40">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:6px;overflow:hidden">
      <tr><td style="background:#00514a;padding:24px;text-align:center;color:#fff;font-size:24px;font-weight:bold;letter-spacing:1px">terza</td></tr>
      <tr><td style="padding:32px">
        <h1 style="margin:0 0 16px;font-size:20px">${escapar(titulo)}</h1>
        ${parrafos.map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.5">${p}</p>`).join('')}
        <p style="margin:24px 0"><a href="${escapar(enlace)}" style="display:inline-block;background:#00514a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:bold">${escapar(boton)}</a></p>
        <p style="margin:0 0 8px;font-size:13px;color:#6c757d">Si el botón no funciona, copia esta dirección en tu navegador:<br><a href="${escapar(enlace)}" style="color:#00514a;word-break:break-all">${escapar(enlace)}</a></p>
        <p style="margin:16px 0 0;font-size:13px;color:#6c757d">${pie}</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
  const texto = [titulo, '', ...parrafos.map((p) => p.replace(/<[^>]+>/g, '')), '', `${boton}: ${enlace}`, '', pie.replace(/<[^>]+>/g, '')].join('\n');
  return { html, texto };
}

export function correoRecuperar(para: string, nombre: string, enlace: string): Correo {
  return {
    para,
    nombre,
    asunto: 'Crea una contraseña nueva para el administrador del blog de Terza',
    ...plantilla({
      titulo: `Hola, ${nombre}`,
      parrafos: ['Recibimos una solicitud para cambiar tu contraseña del administrador del blog de Terza.', 'Usa este botón para crear una nueva. El enlace sirve durante 1 hora y solo una vez.'],
      boton: 'Crear contraseña nueva',
      enlace,
      pie: 'Si no lo pediste tú, ignora este correo: tu contraseña no cambia.',
    }),
  };
}

export function correoBienvenida(para: string, nombre: string, quienInvita: string, rol: string, enlaceClave: string, enlaceEntrar: string, conClave: boolean): Correo {
  return {
    para,
    nombre,
    asunto: 'Te dieron acceso al administrador del blog de Terza',
    ...plantilla({
      titulo: `Hola, ${nombre}`,
      parrafos: [
        `${escapar(quienInvita)} te dio acceso al administrador del blog de Terza como <b>${escapar(rol)}</b>.`,
        conClave
          ? `Ya puedes entrar en <a href="${escapar(enlaceEntrar)}" style="color:#00514a">${escapar(enlaceEntrar)}</a> con este correo y la contraseña que te compartieron. Si prefieres tu propia contraseña, créala con el botón (el enlace sirve durante 7 días).`
          : 'Para entrar, primero crea tu contraseña con el botón. El enlace sirve durante 7 días.',
      ],
      boton: conClave ? 'Crear mi propia contraseña' : 'Crear mi contraseña',
      enlace: enlaceClave,
      pie: `Para entrar después: <a href="${escapar(enlaceEntrar)}" style="color:#00514a">${escapar(enlaceEntrar)}</a>`,
    }),
  };
}
