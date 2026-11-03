// Crea o cambia un usuario del administrador del blog (/admin).
//
// Uso:
//   npm run usuario-admin -- correo@terza.com "Nombre Apellido"
//
// Pide la contraseña (dos veces) y guarda el usuario en ADMIN_USUARIOS del archivo .env de esta carpeta (si el correo ya
// existe, le cambia el nombre y la contraseña). Al final muestra el valor completo de ADMIN_USUARIOS para copiarlo en
// Vercel (Settings → Environment Variables). Nunca se guarda la contraseña, solo su hash (igual que src/lib/admin/sesion.ts).
// También crea ADMIN_SECRETO en .env si no existe.
import { randomBytes, scryptSync } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';

const [correo, ...resto] = process.argv.slice(2);
const nombre = resto.join(' ').trim();
if (!correo || !correo.includes('@')) {
  console.error('Uso: npm run usuario-admin -- correo@terza.com "Nombre Apellido"');
  process.exit(1);
}

// Pregunta sin mostrar lo que se escribe (si no es una terminal, lee el renglón tal cual)
function preguntar(texto) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
    if (process.stdin.isTTY) rl._writeToOutput = (s) => rl.output.write(s.includes(texto) ? s : '');
    rl.question(texto, (respuesta) => {
      rl.close();
      if (process.stdin.isTTY) process.stdout.write('\n');
      resolve(respuesta);
    });
  });
}

const clave = await preguntar('Contraseña (mínimo 10 caracteres): ');
if (clave.length < 10) {
  console.error('La contraseña debe tener al menos 10 caracteres.');
  process.exit(1);
}
if (process.stdin.isTTY && (await preguntar('Repite la contraseña: ')) !== clave) {
  console.error('Las contraseñas no coinciden.');
  process.exit(1);
}

const sal = randomBytes(16);
const usuario = { correo, nombre: nombre || correo, clave: `scrypt:${sal.toString('base64')}:${scryptSync(clave, sal, 64).toString('base64')}` };

// .env: se agrega o se reemplaza el usuario y se conserva lo demás
const env = await readFile('.env', 'utf8').catch(() => '');
const renglones = env.split('\n').filter((r) => r !== '');
const actual = renglones.find((r) => r.startsWith('ADMIN_USUARIOS='));
let usuarios = [];
try {
  usuarios = JSON.parse(actual?.slice('ADMIN_USUARIOS='.length).replace(/^'|'$/g, '') || '[]');
} catch {
  console.error('ADMIN_USUARIOS en .env no es un JSON válido; corrígelo o bórralo y vuelve a correr el comando.');
  process.exit(1);
}
usuarios = [...usuarios.filter((u) => u.correo.toLowerCase() !== correo.toLowerCase()), usuario];
const valor = JSON.stringify(usuarios);
const nuevos = renglones.filter((r) => !r.startsWith('ADMIN_USUARIOS='));
nuevos.push(`ADMIN_USUARIOS='${valor}'`);
if (!nuevos.some((r) => r.startsWith('ADMIN_SECRETO='))) nuevos.push(`ADMIN_SECRETO=${randomBytes(32).toString('base64url')}`);
await writeFile('.env', `${nuevos.join('\n')}\n`);

console.log(`\nListo: ${usuario.nombre} <${correo}> quedó en .env (${usuarios.length} ${usuarios.length === 1 ? 'usuario' : 'usuarios'}).`);
console.log('\nPara Vercel, copia este valor en la variable ADMIN_USUARIOS:\n');
console.log(valor);
console.log('\nReinicia `npm run dev` para que el sitio lea el .env nuevo.');
