/**
 * The explorer's sound: the shared Earth soundscape from `@bendyline/molen-earth` (weather and
 * nature ambience, footsteps, traffic near streets, engines on whatever you board) plus a Sound
 * section in the HUD. Sounds come from the `molen.sounds` content pack; without it, or with
 * `?audio=0`, the explorer is silent.
 */

import {
  type AudioLayer,
  type AudioRendererLike,
  loudnessToGain,
} from '@bendyline/molen-client/audio';
import {
  createEarthAudio,
  EARTH_PACK_IDS,
  type EarthAudio,
  openPacksFromIndex,
} from '@bendyline/molen-earth/client';
import type { World } from '@bendyline/molen-kernel/world';
import { createPackSet } from '@bendyline/molen-pack';
import { packIndex } from './content';

const STORAGE_KEY = 'molen.world-explorer.audio';

interface StoredSettings {
  volume: number;
  muted: boolean;
  music: boolean;
  /** Ambience: weather, nature, streets. */
  world: number;
  /** Engines, footsteps, horns, impacts. */
  vehicles: number;
}

function readSettings(): StoredSettings {
  const fallback = { volume: 0.8, muted: false, music: true, world: 1, vehicles: 1 };
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') };
  } catch {
    return fallback;
  }
}

function writeSettings(settings: StoredSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Private windows may refuse storage; the setting just does not persist.
  }
}

/** Load the sound pack and start the Earth soundscape, or undefined when sound is unavailable. */
export async function startExplorerAudio(
  base: URL,
  world: World,
  renderer: AudioRendererLike,
  params: URLSearchParams,
): Promise<EarthAudio | undefined> {
  if (params.get('audio') === '0') return undefined;
  const packs = await openPacksFromIndex(packIndex(base), [EARTH_PACK_IDS.sounds]);
  if (packs.length === 0) return undefined;
  const settings = readSettings();
  const audio = await createEarthAudio(createPackSet(packs), renderer, settings);
  if (!audio) return undefined;
  audio.attachWorld(world);
  const removeControls = mountSoundControls(audio.layer, settings);
  return {
    ...audio,
    dispose() {
      removeControls();
      audio.dispose();
    },
  };
}

/** A Sound section in the HUD: volume, mute and music, remembered per browser. */
function mountSoundControls(layer: AudioLayer, settings: StoredSettings): () => void {
  const hud = document.getElementById('hud-body') ?? document.getElementById('hud');
  if (!hud) return () => {};
  const root = document.createElement('fieldset');
  root.id = 'sound-controls';
  root.setAttribute('aria-label', 'Sound');
  root.innerHTML = `
    <div class="sky-heading"><label for="sound-volume">Sound</label>
      <label><input id="sound-mute" type="checkbox" /> Mute</label>
      <label><input id="sound-music" type="checkbox" /> Music</label></div>
    <input id="sound-volume" type="range" min="0" max="100" step="1" aria-label="Volume" />
    <label class="sound-mix">World <input id="sound-world" type="range" min="0" max="100" step="1" aria-label="World volume" /></label>
    <label class="sound-mix">Vehicles <input id="sound-vehicles" type="range" min="0" max="100" step="1" aria-label="Vehicles and effects volume" /></label>
    <p id="sound-status"></p>`;
  const weather = document.getElementById('weather-controls');
  if (weather?.parentElement === hud) weather.after(root);
  else hud.append(root);
  const volume = root.querySelector('#sound-volume') as HTMLInputElement;
  const mute = root.querySelector('#sound-mute') as HTMLInputElement;
  const music = root.querySelector('#sound-music') as HTMLInputElement;
  const world = root.querySelector('#sound-world') as HTMLInputElement;
  const vehicles = root.querySelector('#sound-vehicles') as HTMLInputElement;
  const status = root.querySelector('#sound-status') as HTMLElement;
  volume.value = String(Math.round(settings.volume * 100));
  world.value = String(Math.round(settings.world * 100));
  vehicles.value = String(Math.round(settings.vehicles * 100));
  mute.checked = settings.muted;
  music.checked = settings.music;
  const apply = (): void => {
    layer.setVolume(settings.volume);
    layer.setMuted(settings.muted);
    layer.setBusGain('music', settings.music ? 1 : 0);
    // Like the master volume, the mix sliders follow loudness.
    layer.setBusGain('ambience', loudnessToGain(settings.world));
    layer.setBusGain('sfx', loudnessToGain(settings.vehicles));
  };
  const save = (): void => {
    settings.volume = Number(volume.value) / 100;
    settings.world = Number(world.value) / 100;
    settings.vehicles = Number(vehicles.value) / 100;
    settings.muted = mute.checked;
    settings.music = music.checked;
    apply();
    writeSettings(settings);
  };
  apply();
  volume.addEventListener('input', save);
  world.addEventListener('input', save);
  vehicles.addEventListener('input', save);
  mute.addEventListener('change', save);
  music.addEventListener('change', save);
  const timer = setInterval(() => {
    // Level per voice (before master volume), so you can hear and see ground ambience fade
    // as you climb away from it.
    const voices = layer.director.voices().map((v) => `${v.sound} ${Math.round(v.gain * 100)}%`);
    const text = !layer.unlocked
      ? 'Click or press a key to turn sound on'
      : voices.length > 0
        ? `Playing ${voices.join(', ')}`
        : 'Quiet';
    if (status.textContent !== text) status.textContent = text;
    status.dataset.voices = String(voices.length);
    status.dataset.unlocked = String(layer.unlocked);
  }, 500);
  return () => {
    world.removeEventListener('input', save);
    vehicles.removeEventListener('input', save);
    clearInterval(timer);
    root.remove();
  };
}
