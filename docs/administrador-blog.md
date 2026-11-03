# Administrador del blog

El blog se administra en **/admin** (por ejemplo https://terza-sitio.vercel.app/admin) con [Decap CMS](https://decapcms.org).

- Cada nota es un archivo Markdown en `src/content/blog/<direccion-de-la-nota>.md` y sus imágenes están en `src/assets/blog/`.
- Las categorías están en `src/data/blog-categorias.json`.
- El esquema que deben cumplir las notas está en `src/content.config.ts`. Si una nota no lo cumple, el sitio no compila.
- La configuración del panel está en `public/admin/config.yml`.

Al guardar, el panel hace un commit en GitHub (rama `main`) y Vercel vuelve a publicar el sitio solo; tarda un par de minutos.

## Activarlo en Vercel (una sola vez)

1. **Crear la app de inicio de sesión en GitHub.** Hazlo desde la cuenta dueña del repo, en GitHub → Settings → Developer settings → OAuth Apps → *New OAuth App*:
   - Application name: `Terza – Administrador del blog`
   - Homepage URL: `https://terza-sitio.vercel.app`
   - Authorization callback URL: `https://terza-sitio.vercel.app/api/callback`

   Copia el **Client ID** y genera un **Client secret**.
2. **Agregar las variables en Vercel.** En Project → Settings → Environment Variables, en Production, agrega `GITHUB_CLIENT_ID` y `GITHUB_CLIENT_SECRET`. Después vuelve a desplegar el sitio.
3. **Dar acceso a los editores.** Quien vaya a editar necesita una cuenta de GitHub con permiso de escritura en `german-fut-2822/terza-sitio`, desde Settings → Collaborators.
4. **Subir el blog a `main`.** El panel lee y guarda las notas en `main`. Por eso la rama con el blog tiene que estar unida a `main` antes de usarlo en línea.

### Al cambiar de dominio (por ejemplo, a terza.com)

- En `public/admin/config.yml`, cambia `base_url` y `site_url`.
- En la app de GitHub, actualiza Homepage URL y Authorization callback URL.

## Probarlo en la computadora (sin GitHub)

```bash
npm run dev      # sitio en http://localhost:4321
npm run admin    # servidor local de Decap en el puerto 8081
```

Abre http://localhost:4321/admin y pulsa **Iniciar sesión**. Los cambios se guardan directamente en los archivos de la carpeta, sin commit; se suben con git como cualquier otro cambio.

## Cómo se usa

- **Listado de notas:** `/admin/notas.html`, una tabla al estilo WordPress. Tiene:
  - pestañas Todas / Publicadas / Borradores / Destacadas;
  - filtros por mes y por categoría;
  - buscador y orden por título o fecha;
  - páginas de 20 notas.

  Al entrar a "Notas del blog" o al regresar del editor, el panel te lleva ahí con los mismos filtros. La tabla lee las notas con la sesión del panel: de GitHub, o del servidor local si corre `npm run admin`.
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
- **Diseño:** los listados (Notas, Categorías y Medios) siguen la plantilla UBold con el verde de Terza: barra superior oscura (logo, botón para ocultar el menú, buscador de notas y el usuario con *Cerrar sesión*), menú lateral claro, título con ruta y cada listado en una tarjeta con barra de filtros, tabla con foto, insignias de estado, botones redondos de acción (ver, editar, borrar) y paginación numerada. En celular el menú se abre desde la barra de arriba. El editor de Decap toma los mismos colores con los estilos de `public/admin/index.html`.
- Los listados comparten estilos (`public/admin/listado.css`) y el menú lateral, la lectura y el guardado de datos (`public/admin/comun.js`).

## Traer notas de terza.com

```bash
npm run importar-blog            # solo las notas nuevas
npm run importar-blog -- --todas # rehace todas (sobrescribe las ediciones hechas en el panel)
```
