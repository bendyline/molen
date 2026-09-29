/** Something that needs a user gesture before it can make sound. */
export interface Unlockable {
  unlock(): Promise<void>;
  readonly unlocked: boolean;
}

const GESTURES = ['pointerdown', 'keydown', 'touchend'] as const;

/**
 * Browsers start audio suspended until the page gets a gesture. Resume on the first pointer,
 * key or touch on `target` (default the window); returns a detach function.
 */
export function attachAutoplayUnlock(
  audio: Unlockable,
  target: EventTarget | undefined = typeof window === 'undefined' ? undefined : window,
): () => void {
  if (!target) return () => {};
  const onGesture = (): void => {
    audio
      .unlock()
      .then(() => {
        if (audio.unlocked) detach();
      })
      .catch(() => {});
  };
  const detach = (): void => {
    for (const type of GESTURES) target.removeEventListener(type, onGesture, true);
  };
  for (const type of GESTURES) target.addEventListener(type, onGesture, true);
  return detach;
}
