// Omnia (CRM propio de Futurite). Verificado contra ContactController.php: la URL, el token y
// el "client" por formulario estaban hardcodeados ahí (general=41, cotización=41, empresa=41,
// greenwall=42; distribuidor NO llama a Omnia). El token real sigue expuesto en texto plano en
// ese repo — no se copia aquí; debe rotarse en Omnia y vivir solo en OMNIA_API_TOKEN.
import { variable } from '../admin/entorno';

export interface LeadOmnia {
  nombre: string;
  correo: string;
  telefono: string;
  estado?: string;
  ciudad?: string;
  interes?: string;
  ruta?: string;
  comentarios?: string;
}

export async function enviarOmnia(client: 41 | 42, lead: LeadOmnia): Promise<boolean> {
  const token = variable('OMNIA_API_TOKEN');
  if (!token) {
    console.warn('[leads/omnia] OMNIA_API_TOKEN no configurado, se omite el envío');
    return false;
  }
  const respuesta = await fetch('https://omnia.futurite.com/api/save-lead-form', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre: lead.nombre,
      correo: lead.correo,
      telefono: lead.telefono,
      estado: lead.estado,
      ciudad: lead.ciudad,
      interes: lead.interes,
      ruta: lead.ruta,
      comentarios: lead.comentarios,
      token,
      client,
    }),
  });
  if (!respuesta.ok) throw new Error(`Omnia respondió ${respuesta.status}`);
  return true;
}
