// Variables de entorno del administrador: en Vercel llegan en process.env; en local, del archivo .env
export const variable = (nombre: string): string | undefined => process.env[nombre] ?? import.meta.env[nombre];

// ADMIN_SECRETO firma las sesiones y cifra el archivo de usuarios
export function secreto() {
  const valor = variable('ADMIN_SECRETO');
  if (valor) return valor;
  if (import.meta.env.DEV) return 'solo-para-desarrollo';
  throw new Error('Falta configurar ADMIN_SECRETO');
}
