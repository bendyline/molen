/** Browser presentation helpers shared by the examples and copied into standalone templates. */
export interface PlaybackClient {
  readonly tick: number | undefined;
  control(
    action: { action: 'pause' | 'resume' | 'request-keyframe' } | { action: 'step'; ticks: number },
  ): void;
  renderFrame(now?: number): void;
}
export interface PlaybackInput {
  setEnabled(enabled: boolean): void;
  reset(): void;
  setVirtual(source: string, action: string, value: number): void;
  clearVirtual(source?: string): void;
}
export interface Playback {
  readonly paused: boolean;
  readonly button: HTMLButtonElement;
  setPaused(paused: boolean): void;
  setVisible(visible: boolean): void;
  draw(): void;
  onChange(listener: () => void): () => void;
  dispose(): void;
}

/** The worker must boot paused and the client must use frameLoop: 'manual'. */
export function createPlayback(options: {
  client: PlaybackClient;
  input?: PlaybackInput | undefined;
  canvas: HTMLCanvasElement;
  container: HTMLElement;
  render?: (elapsedMs: number, now: number) => void;
}): Playback {
  const { client, input, canvas } = options;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'pause-playback';
  button.className = 'playback-button';
  options.container.append(button);
  const listeners = new Set<() => void>();
  let manuallyPaused = motion.matches || new URLSearchParams(location.search).get('text') === '1';
  let active = !document.hidden && document.hasFocus();
  let paused = manuallyPaused;
  let visible = true;
  let disposed = false;
  let handle = 0;
  let elapsed = 0;
  let previous = performance.now();
  let frames = 0;
  let resizeFrame = 0;
  function render(now: number): void {
    if (!visible || disposed || !active) return;
    if (options.render) options.render(elapsed, now);
    else client.renderFrame(now);
    canvas.dataset.renderFrames = String(++frames);
  }
  function draw(): void {
    // Let the interpolation buffer reach its last simulation sample while frozen.
    render(performance.now() + 100);
  }
  function loop(now: number): void {
    handle = 0;
    if (paused || disposed || !visible) return;
    elapsed += Math.min(100, Math.max(0, now - previous));
    previous = now;
    render(now);
    handle = requestAnimationFrame(loop);
  }
  function sync(): void {
    paused = manuallyPaused || !active;
    cancelAnimationFrame(handle);
    handle = 0;
    input?.setEnabled(!paused);
    client.control({ action: paused ? 'pause' : 'resume' });
    button.textContent = paused ? 'Resume animation' : 'Pause animation';
    canvas.dataset.paused = String(paused);
    canvas.dispatchEvent(new Event('playbackchange'));
    if (paused && document.pointerLockElement === canvas) document.exitPointerLock();
    previous = performance.now();
    draw();
    if (!paused && visible) handle = requestAnimationFrame(loop);
    for (const listener of listeners) listener();
  }
  function setPaused(value: boolean): void {
    if (disposed || value === manuallyPaused) return;
    manuallyPaused = value;
    sync();
  }
  const toggle = (): void => setPaused(!paused);
  const reduce = (): void => {
    if (motion.matches) setPaused(true);
  };
  button.addEventListener('click', toggle);
  motion.addEventListener('change', reduce);
  // A mount's ResizeObserver resets the drawing buffer after window.resize. Draw on the
  // following frame so a paused canvas is not cleared after its one still image was drawn.
  const resizeObserver = new ResizeObserver(() => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(draw);
  });
  resizeObserver.observe(canvas);
  const setActive = (value: boolean): void => {
    if (value === active) return;
    active = value;
    sync();
  };
  const focus = (): void => setActive(!document.hidden);
  const blur = (): void => setActive(false);
  const visibility = (): void => setActive(!document.hidden && document.hasFocus());
  window.addEventListener('focus', focus);
  window.addEventListener('blur', blur);
  document.addEventListener('visibilitychange', visibility);
  sync();
  return {
    get paused() {
      return paused;
    },
    button,
    setPaused,
    setVisible(value): void {
      visible = value;
      sync();
    },
    draw,
    onChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose(): void {
      disposed = true;
      cancelAnimationFrame(handle);
      input?.reset();
      motion.removeEventListener('change', reduce);
      window.removeEventListener('focus', focus);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility);
      resizeObserver.disconnect();
      cancelAnimationFrame(resizeFrame);
      button.remove();
      listeners.clear();
    },
  };
}

/** Asset readiness alone can resolve before the first Worker keyframe has arrived. */
export async function readyToPlay(
  client: PlaybackClient & { ready(): Promise<void> },
): Promise<void> {
  const deadline = performance.now() + 60000;
  while (client.tick === undefined) {
    if (performance.now() > deadline) throw new Error('The world did not load. Reload to retry.');
    await new Promise((resolve) => setTimeout(resolve, 16));
  }
  await client.ready();
}
