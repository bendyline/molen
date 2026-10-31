/** Observe whether the page is both visible and focused; reports the initial state immediately. */
export function observePageActivity(onChange: (active: boolean) => void): () => void {
  if (typeof document === 'undefined') return () => {};
  const doc = document;
  const win = doc.defaultView ?? (typeof window !== 'undefined' ? window : undefined);
  let focused = doc.hasFocus?.() ?? true;
  let previous: boolean | undefined;
  const update = (): void => {
    const active = !doc.hidden && focused;
    if (active === previous) return;
    previous = active;
    onChange(active);
  };
  const focus = (): void => {
    focused = true;
    update();
  };
  const blur = (): void => {
    focused = false;
    update();
  };
  const visibility = (): void => {
    focused = doc.hasFocus?.() ?? focused;
    update();
  };
  // No capture: focus moving between elements must not pause the whole page.
  win?.addEventListener?.('focus', focus);
  win?.addEventListener?.('blur', blur);
  doc.addEventListener('visibilitychange', visibility);
  const dispose = (): void => {
    win?.removeEventListener?.('focus', focus);
    win?.removeEventListener?.('blur', blur);
    doc.removeEventListener('visibilitychange', visibility);
  };
  try {
    update();
  } catch (error) {
    dispose();
    throw error;
  }
  return dispose;
}
