export async function copyText(text, container = document.body) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Em HTTP ou quando a permissão é negada, tentar a cópia pelo documento.
  }

  const doc = container.ownerDocument;
  const previousFocus = doc.activeElement;
  const input = doc.createElement('textarea');
  input.value = text;
  input.readOnly = true;
  input.setAttribute('aria-label', 'Código para copiar');
  input.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
  // Dentro do modal para respeitar seu controle de foco.
  container.appendChild(input);
  try {
    input.focus({ preventScroll: true });
    input.select();
    input.setSelectionRange(0, text.length);
    return doc.execCommand?.('copy') === true;
  } catch {
    return false;
  } finally {
    input.remove();
    previousFocus?.focus({ preventScroll: true });
  }
}
