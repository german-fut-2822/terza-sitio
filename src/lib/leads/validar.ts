const emailValido = (valor: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(valor);
const telefonoValido = (valor: string) => /^[0-9]{6,11}$/.test(valor);

// El Laravel original no validaba nada server-side (importaba Validator pero no lo usaba) —
// aquí sí se valida lo mínimo de contacto, parametrizado porque cada formulario nombra estos
// campos distinto (email/correo, nombre/nombre_contacto).
export function validarContacto(nombre?: string, email?: string, telefono?: string): string | null {
  if (!nombre?.trim()) return 'Falta el nombre';
  if (!email || !emailValido(email)) return 'Email inválido';
  if (!telefono || !telefonoValido(telefono)) return 'Teléfono inválido';
  return null;
}

// Honeypot: en contacto.blade.php y contacto-empresa.blade.php el campo "dataspam" existe en el
// HTML pero el controlador original nunca lo lee. Aquí sí se aplica. greenwall/cotización/
// distribuidor no tienen este campo en su formulario actual.
export function esSpam(dataspam?: string): boolean {
  return Boolean(dataspam?.trim());
}
