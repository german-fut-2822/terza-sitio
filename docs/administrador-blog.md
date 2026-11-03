# Administrador del blog

El blog se administra en **/admin** (por ejemplo https://terza-sitio.vercel.app/admin) con [Decap CMS](https://decapcms.org).

- Cada nota es un archivo Markdown en `src/content/blog/<direccion-de-la-nota>.md` y sus imágenes están en `src/assets/blog/`.
- Las categorías están en `src/data/blog-categorias.json`.
- El esquema que deben cumplir las notas está en `src/content.config.ts`. Si una nota no lo cumple, el sitio no compila.
- La configuración del panel está en `public/admin/config.yml`.

Se entra con **correo y contraseña** en `/admin/login.html` (cualquier página del panel manda ahí si no hay sesión). Los editores no necesitan cuenta de GitHub: el panel lee y guarda con la API del sitio (`/api/cms`), que en línea hace un commit en GitHub (rama `main`) con una llave del sitio, firmado con el nombre de quien guardó. Vercel vuelve a publicar el sitio solo; tarda un par de minutos.

Piezas:
- `src/lib/admin/sesion.ts`: usuarios y sesión (cookie firmada que dura 12 horas).
- `src/lib/admin/almacen.ts`: dónde se lee y se guarda (GitHub en línea; la carpeta en la computadora). Solo puede tocar las notas, sus imágenes y las categorías.
- `src/pages/api/sesion.ts` (entrar y salir), `src/pages/api/cms.ts` (el protocolo de Decap) y `src/pages/api/archivo.ts` (imágenes para el panel).

## Activarlo en Vercel (una sola vez)

1. **Crear la llave de GitHub.** Desde la cuenta dueña del repo: GitHub → Settings → Developer settings → Personal access tokens → *Fine-grained tokens* → *Generate new token*:
   - Repository access: solo `german-fut-2822/terza-sitio`.
   - Permissions → Repository permissions → **Contents: Read and write**.
   - Ponle una fecha de vencimiento y anótala: cuando venza, el panel dejará de guardar hasta poner una nueva.
2. **Crear los usuarios** en la computadora, uno por persona (pide la contraseña, de mínimo 10 caracteres):

   ```bash
   npm run usuario-admin -- correo@terza.com "Nombre Apellido"
   ```

   Lo guarda en `.env` y al final muestra el valor de `ADMIN_USUARIOS` con todos los usuarios para copiarlo en Vercel. Para cambiar una contraseña se corre igual con el mismo correo. Para quitar a alguien, se borra su entrada del JSON.
3. **Agregar las variables en Vercel.** En Project → Settings → Environment Variables (Production):
   - `GITHUB_TOKEN`: la llave del paso 1.
   - `ADMIN_USUARIOS`: el valor que mostró el paso 2.
   - `ADMIN_SECRETO`: un texto largo al azar (por ejemplo, el que quedó en `.env`). Si se cambia, se cierran todas las sesiones.
   - Opcionales: `GITHUB_REPO` (por omisión `german-fut-2822/terza-sitio`) y `GITHUB_BRANCH` (por omisión `main`).

   Después vuelve a desplegar el sitio.
4. **Subir el blog a `main`.** El panel lee y guarda las notas en `main`. Por eso la rama con el blog tiene que estar unida a `main` antes de usarlo en línea.

## Probarlo en la computadora

```bash
npm run usuario-admin -- tu@correo.com "Tu nombre"   # una vez, para tener usuario en .env
npm run dev                                          # sitio en http://localhost:4321
```

Abre http://localhost:4321/admin y entra con ese correo. Sin `GITHUB_TOKEN` en `.env`, los cambios se guardan directo en los archivos de la carpeta, sin commit; se suben con git como cualquier otro cambio. (Si pones `GITHUB_TOKEN` en `.env`, la computadora también guarda en GitHub).

## Cómo se usa

- **Listado de notas:** `/admin/notas.html`, una tabla al estilo WordPress. Tiene:
  - pestañas Todas / Publicadas / Borradores / Destacadas;
  - filtros por mes y por categoría;
  - buscador y orden por título o fecha;
  - páginas de 20 notas.

  Al entrar a "Notas del blog" o al regresar del editor, el panel te lleva ahí con los mismos filtros. La tabla lee las notas con la API del panel.
- **Borrar nota:** el botón del bote de basura de cada fila borra el archivo de la nota (en línea, con un commit). Pide confirmación; su foto se queda en Medios como *Sin usar*.
- **Nueva nota:** botón *+ Nota*. La dirección de la nota sale del título (sin acentos); una vez publicada no conviene cambiarla.
- **Borrador:** como en WordPress, se elige en el menú del botón *Publicar*:
  - con cambios sin guardar: *Guardar como borrador* (no sale en el sitio) o *Publicar ahora*;
  - sin cambios: *Pasar a borrador* en una nota publicada, o *Publicar ahora* en un borrador. En un borrador el botón dice *Borrador* en vez de *Publicado*.

  El campo `borrador` sigue en el archivo de la nota pero no se ve en el editor (`public/admin/index.html`). *Pasar a borrador* y *Publicar ahora* sin cambios reescriben solo esa línea del archivo; después de cada guardado la nota se recarga para mostrar su estado real. Un borrador no sale en ningún lado del sitio, ni en local, y en el editor no tiene el enlace *Ver publicación* (para revisarlo se usa la vista previa). En las notas publicadas, *Ver publicación* abre la nota en el mismo dominio donde está abierto el panel.
- **Destacada:** la pone primero en el blog y en el home.
- **Texto:** usa *Encabezado 2* para las secciones y *Encabezado 3* para los subtemas. Las imágenes se suben desde el botón *+* del editor.
- **Imágenes:** deben pesar menos de 500 KB; el panel rechaza las más pesadas en cualquier lugar donde se suban.
- **Biblioteca de medios:** está en `/admin/medios.html` y es la que abre *Medios* en el menú. Muestra todas las imágenes de `src/assets/blog` en cuadrícula, y tiene:
  - filtros: *Todos los medios / Usadas en notas / Sin usar*, y por mes (el de la nota que usa la imagen);
  - buscador por nombre de archivo o por título de nota;
  - *Añadir nuevo archivo de medios*: subir varias a la vez, también arrastrándolas sobre la página;
  - el detalle de cada imagen: peso, medidas, notas que la usan y ruta;
  - *Selección en lotes* para borrar varias.

  Solo se pueden borrar las imágenes que ninguna nota usa. En línea, cada imagen subida o borrada es un commit en GitHub.
- **Categorías del blog:** se administran en `/admin/categorias.html`, como en WordPress.
  - **Añadir categoría:** el botón está en la barra del listado y abre una ventana donde solo se escribe el nombre. El slug se crea solo a partir del nombre, sin acentos; si ya existe, se le agrega un número.
  - **Editar:** el botón del lápiz abre una ventana para cambiar el nombre y el slug (ahí también está *Borrar categoría*). Si cambias el slug, también se cambia en las notas que usan la categoría, en el mismo guardado (en línea, un solo commit).
  - **Borrar:** está en las acciones de cada fila y en la ventana de editar. Si la categoría tiene notas, se quita de ellas en el mismo guardado; las notas no se borran.
  - La tabla muestra cuántas notas tiene cada categoría, con filtros (con notas, sin notas), buscador y orden.
  - La *Página de la línea* ("Conoce nuestra línea" en las notas) no se edita desde el panel; se cambia en `src/data/blog-categorias.json`.
- **Diseño:** los listados (Notas, Categorías y Medios) siguen la plantilla UBold con el verde de Terza: barra superior verde (logo, botón para ocultar el menú, buscador de notas y el usuario de la sesión con *Cerrar sesión*), menú lateral claro, título con ruta y cada listado en una tarjeta con barra de filtros, tabla con foto, insignias de estado, botones redondos de acción (ver, editar, borrar) y paginación numerada. En celular el menú se abre desde la barra de arriba. El editor de Decap toma los mismos colores con los estilos de `public/admin/index.html`.
- Los listados comparten estilos (`public/admin/listado.css`) y el menú lateral, la lectura y el guardado de datos (`public/admin/comun.js`).

## Traer notas de terza.com

```bash
npm run importar-blog            # solo las notas nuevas
npm run importar-blog -- --todas # rehace todas (sobrescribe las ediciones hechas en el panel)
```
