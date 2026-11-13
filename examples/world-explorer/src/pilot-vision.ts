/**
 * The pilot's vision under g, drawn over the view: sustained positive g drains blood from the
 * head, so the edges of the view dim first (tunnel vision) and then everything goes dark;
 * sustained negative g reddens it. The simulation supplies `greyout` and `redout`, 0..1.
 */
export function createPilotVision(enabled = true): {
  update(state: { greyout?: number; redout?: number } | undefined): void;
  dispose(): void;
} {
  const veil = document.createElement('div');
  veil.id = 'pilot-vision';
  veil.setAttribute('aria-hidden', 'true');
  Object.assign(veil.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '5',
    display: 'none',
  });
  document.body.append(veil);
  let shown = '';
  return {
    update(state) {
      // Vision starts to go at 0.3 of the strain and is gone at 1.
      const grey = Math.min(1, Math.max(0, ((state?.greyout ?? 0) - 0.3) / 0.7));
      const red = Math.min(1, Math.max(0, (state?.redout ?? 0) / 0.8));
      if (!enabled || (grey <= 0 && red <= 0)) {
        if (shown !== '') {
          veil.style.display = 'none';
          shown = '';
        }
        return;
      }
      // The clear center shrinks from the whole view to nothing; what is left of it dims too.
      const clear = Math.round(Math.max(0, 70 - 85 * grey));
      const edge = Math.min(1, 0.35 + grey).toFixed(2);
      const center = Math.max(0, grey * 1.6 - 0.6).toFixed(2);
      const layers = [
        ...(grey > 0
          ? [
              `radial-gradient(ellipse at center, rgba(0,0,0,${center}) 0%, rgba(0,0,0,${center}) ${clear}%, rgba(0,0,0,${edge}) ${clear + 30}%)`,
            ]
          : []),
        ...(red > 0
          ? [
              `linear-gradient(rgba(150,0,0,${(0.65 * red).toFixed(2)}),rgba(150,0,0,${(0.65 * red).toFixed(2)}))`,
            ]
          : []),
      ].join(',');
      if (layers === shown) return;
      shown = layers;
      veil.style.background = layers;
      veil.style.display = 'block';
    },
    dispose() {
      veil.remove();
    },
  };
}
