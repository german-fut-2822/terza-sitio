// Destinatarios de email por línea de producto ("ruta"). Son los mismos switch($ruta) que ya
// vivían hardcodeados en ContactController.php (líneas 413-461 para general, 539-594 para
// empresa) — no son credenciales, son listas de distribución internas, así que se copian tal
// cual (lo que hay que mover a env/config son los secretos, no esto).
//
// La cotización por SKU (sendContacto) NO está aquí: en el original sale de la tabla
// contactos_cotizaciones (categoria -> to/cc), que vive en la base de datos Laravel y no se
// pudo leer desde el código. Falta exportar esos datos o decidir dónde van a vivir en Astro.

interface Destinatarios {
  to: string[];
  cc: string[];
}

// El original ruteaba esto por línea de producto ("ruta"), pero el form de /contacto que ya
// está construido en Astro no recolecta esa categoría — siempre cae en lo que el controlador
// original llamaba "default" (switch($ruta) sin match). Por eso aquí es un solo set fijo, no
// un Record por categoría: nada en el código nuevo puede rutear por categoría todavía.
export const destinatariosGeneral: Destinatarios = {
  to: ['coordinacion@terza.com'],
  cc: ['jggaribay@terza.com', 'vguerrero@terza.com', 'mimorato@terza.com', 'jagarza@terza.com', 'leads@futurite.net', 'mspuente@terza.com', 'mfrodriguez@terza.com', 'lrodriguezp@terza.com'],
};

// Empresa no tiene su propia entrada: confirmado que /contacto-empresa ya quedó fusionado en
// /contacto (producción redirige, y el mockup de Vercel solo tiene "contacto"), así que no se
// porteó su endpoint ni sus destinatarios.

// Cotización por SKU: en el original esto vivía en la tabla contactos_cotizaciones, no en
// código. No se pudo leer la tabla en vivo (requiere acceso a la DB), pero el repo sí tiene el
// seeder con los valores con los que se creó (database/seeders/ContactosCotizacionesSeeder.php,
// último commit 2024-10-05) — es la mejor fuente disponible sin acceso a la base de datos real,
// pero tiene más de un año: confirmar contra la DB de producción antes de usarlo en serio, por
// si alguien los cambió desde entonces vía la UI de ese repo.
export const destinatariosCotizacion: Record<string, Destinatarios> = {
  General: { to: ['coordinacion@terza.com', 'mspuente@terza.com'], cc: ['jggaribay@terza.com', 'vguerrero@terza.com', 'mimorato@terza.com', 'jagarza@terza.com', 'leads@futurite.net'] },
  'Pisos Madera y Deck': { to: ['coordinacion@terza.com', 'mspuente@terza.com'], cc: ['jggaribay@terza.com', 'vguerrero@terza.com', 'mimorato@terza.com', 'jagarza@terza.com', 'leads@futurite.net'] },
  'Pisos Laminados': { to: ['coordinacion@terza.com', 'mspuente@terza.com'], cc: ['jggaribay@terza.com', 'vguerrero@terza.com', 'mimorato@terza.com', 'jagarza@terza.com', 'leads@futurite.net'] },
  'Pisos Vinilicos': { to: ['coordinacion@terza.com', 'mspuente@terza.com'], cc: ['jggaribay@terza.com', 'vguerrero@terza.com', 'mimorato@terza.com', 'jagarza@terza.com', 'leads@futurite.net'] },
  Persianas: { to: ['coordinacion@terza.com', 'mspuente@terza.com'], cc: ['jggaribay@terza.com', 'vguerrero@terza.com', 'mimorato@terza.com', 'jagarza@terza.com', 'leads@futurite.net'] },
  'Terza Pastos': { to: ['coordinacion@terza.com', 'mspuente@terza.com'], cc: ['jggaribay@terza.com', 'vguerrero@terza.com', 'mimorato@terza.com', 'jagarza@terza.com', 'leads@futurite.net'] },
};

// Greenwall no rutea por categoría: en el original siempre va al mismo set fijo.
export const destinatariosGreenwall: Destinatarios = {
  to: ['coordinacion@terza.com', 'josue.osorio@futurite.com', 'irlanda.sanchez@futurite.com'],
  cc: ['jggaribay@terza.com', 'vguerrero@terza.com', 'mimorato@terza.com', 'jagarza@terza.com', 'mspuente@terza.com', 'mfrodriguez@terza.com', 'leads@futurite.net'],
};

// Distribuidor tampoco rutea: un solo destinatario fijo, sin cc.
export const destinatarioDistribuidor = 'prospectos@terza.com';
