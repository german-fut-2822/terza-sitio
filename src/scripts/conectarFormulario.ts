export function conectarFormulario(formulario: HTMLFormElement, endpoint: string) {
  if (formulario.dataset.conectado) return;
  formulario.dataset.conectado = 'true';

  const boton = formulario.querySelector<HTMLButtonElement>('button[type="submit"]');
  const estado = formulario.querySelector<HTMLElement>('[data-estado-formulario]');

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (!boton || !estado) return;

    boton.disabled = true;
    formulario.setAttribute('aria-busy', 'true');
    estado.hidden = false;
    estado.textContent = 'Enviando…';

    try {
      const respuesta = await fetch(endpoint, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(formulario),
      });
      const datos = await respuesta.json().catch(() => ({})) as { error?: string };
      if (!respuesta.ok) throw new Error(datos.error || 'No pudimos enviar tu información.');

      formulario.reset();
      estado.textContent = '¡Gracias! Recibimos tu información.';
    } catch (error) {
      estado.textContent = error instanceof Error ? error.message : 'No pudimos enviar tu información. Intenta de nuevo.';
    } finally {
      boton.disabled = false;
      formulario.removeAttribute('aria-busy');
    }
  });
}
