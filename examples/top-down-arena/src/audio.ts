import type { MolenClient } from '@bendyline/molen-client';
import {
  attachAutoplayUnlock,
  createAudioLayer,
  loadPackSoundbanks,
} from '@bendyline/molen-client/audio';
import { createPackSet, openPack, type PackIndex } from '@bendyline/molen-pack';

// Sound for this sample. The rules live in scene.json (the `audioEnvironment` entity and the
// `audioSource` components) and in the scripts (`molen.audio.play`); this file only loads the
// `molen.sounds` content pack and plays what the rules ask for. Without the pack the game is
// silent: fetch it with `npx molen pack fetch https://molen.dev/packs/index.json molen.sounds
// --out-dir public/packs`.

const SOUND_PACK = 'molen.sounds';
const MUTED_KEY = 'molen.samples.muted';

/** This app's packs/index.json first, then the site-wide one (molen.dev hosts it at /packs/). */
async function openSoundPack() {
  const candidates = [new URL(`${import.meta.env.BASE_URL}packs/index.json`, location.href)];
  const site = new URL('/packs/index.json', location.href);
  if (site.href !== candidates[0]?.href) candidates.push(site);
  for (const indexUrl of candidates) {
    const response = await fetch(indexUrl).catch(() => undefined);
    if (!response?.ok) continue;
    const index = (await response.json().catch(() => undefined)) as PackIndex | undefined;
    const entry = index?.packs?.[SOUND_PACK];
    if (!entry) continue;
    return openPack(new URL(entry.file, indexUrl).href, {
      sizeHint: entry.size,
      expect: { contentHash: entry.contentHash },
    });
  }
  return undefined;
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === '1';
  } catch {
    return false;
  }
}

/** Start the sample's audio; resolves to a stop function (a no-op when there is no sound pack). */
export async function startAudio(client: MolenClient, tickRate: number): Promise<() => void> {
  const pack = await openSoundPack().catch((error: unknown) => {
    console.warn('audio unavailable', error);
    return undefined;
  });
  if (!pack) return () => {};
  const packs = createPackSet([pack]);
  const layer = createAudioLayer({
    banks: await loadPackSoundbanks(packs),
    provider: packs.assetProvider(),
    renderer: client.renderer,
    muted: readMuted(),
    onWarning: (message) => console.warn(`audio: ${message}`),
  });
  const detachClient = layer.attachClient(client, { tickRate });
  const detachUnlock = attachAutoplayUnlock(layer);

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'sound-toggle';
  toggle.textContent = 'Sound';
  toggle.setAttribute('aria-pressed', String(!layer.muted));
  toggle.addEventListener('click', () => {
    layer.setMuted(!layer.muted);
    toggle.setAttribute('aria-pressed', String(!layer.muted));
    try {
      localStorage.setItem(MUTED_KEY, layer.muted ? '1' : '0');
    } catch {
      // Storage can be unavailable (private windows); the choice just is not remembered.
    }
  });
  const shell = document.getElementById('interface');
  if (shell) shell.append(toggle);
  else {
    // Pages without the shared game shell get a plain corner button.
    toggle.style.cssText = 'position:fixed;right:12px;bottom:10px;font:13px system-ui';
    document.body.append(toggle);
  }

  let frame = requestAnimationFrame(function loop(now) {
    layer.update(now);
    frame = requestAnimationFrame(loop);
  });
  return () => {
    cancelAnimationFrame(frame);
    toggle.remove();
    detachUnlock();
    detachClient();
    layer.dispose();
  };
}
