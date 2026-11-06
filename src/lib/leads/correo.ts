// Envío de correo del lead. Pendiente de decisión: el original usaba Laravel Mail (SMTP/Mailgun/
// SES/Postmark configurables). En serverless de Vercel conviene una API transaccional (Resend,
// Postmark, SES vía API) en vez de SMTP por conexión persistente — falta elegir proveedor antes
// de implementar esto de verdad.
export interface CorreoLead {
  asunto: string;
  destinatarios: string[]; // to
  copia?: string[]; // cc
  replyTo: string; // email del lead
  cuerpoHtml: string;
}

export async function enviarCorreo(_correo: CorreoLead): Promise<boolean> {
  throw new Error('enviarCorreo: falta elegir proveedor de email transaccional y configurarlo');
}
