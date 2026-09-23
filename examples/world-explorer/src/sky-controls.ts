import { applyEnvironment, type EarthObserver, type Renderer } from '@bendyline/molen-client';
import { Color, Fog } from 'three';
import { createExplorerFog } from './atmosphere.js';
import { localSkyDate, localSkyTime } from './sky-time.js';

// A fixed anchor allows date changes without reallocating any sky geometry or materials.
const EPOCH = Date.UTC(2000, 0, 1);

export function createSkyControls(
  renderer: Renderer,
  params: URLSearchParams,
): {
  update(observer: EarthObserver): void;
} {
  const controls = document.getElementById('sky-controls') as HTMLFieldSetElement;
  const slider = document.getElementById('sky-time') as HTMLInputElement;
  const date = document.getElementById('sky-date') as HTMLInputElement;
  const output = document.getElementById('sky-time-label') as HTMLOutputElement;
  const zone = document.getElementById('sky-time-zone') as HTMLElement;
  const status = document.getElementById('sky-status') as HTMLElement;
  if (params.get('sky') === 'daylight') {
    controls.hidden = true;
    return { update() {} };
  }
  let selected = new Date();
  selected.setHours(12, 0, 0, 0);
  if (params.has('date')) selected = new Date(params.get('date') as string);
  if (!Number.isFinite(selected.getTime()) || localSkyTime(localSkyDate(selected), 0) === undefined)
    throw new Error('Sky date must be a valid ISO date from 1901 through 2099');
  let utcMs = selected.getTime();
  let observerKey = '';
  const timeFormat = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'short',
  });
  zone.textContent = `Your time zone · ${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
  const preview = (): void => {
    renderer.setEnvironmentTimeOverride((utcMs - EPOCH) / 1000);
    const label = `${timeFormat.format(utcMs)}${slider.value === '1440' ? ' · next day' : ''}`;
    output.value = label;
    slider.setAttribute('aria-valuetext', label);
  };
  const selectTime = (): void => {
    const next = localSkyTime(date.value, Number(slider.value));
    if (next === undefined) return;
    utcMs = next;
    preview();
  };
  const setControls = (instant: Date): void => {
    date.value = localSkyDate(instant);
    slider.value = String(instant.getHours() * 60 + instant.getMinutes());
    utcMs = instant.getTime();
    preview();
  };
  slider.addEventListener('input', selectTime);
  date.addEventListener('change', selectTime);
  document.getElementById('sky-now')?.addEventListener('click', () => setControls(new Date()));
  setControls(selected);
  controls.disabled = false;

  const nightFog = new Color('#080e1c');
  const dayFog = createExplorerFog(renderer.backend).color;
  const twilightFog = new Color('#755368');
  return {
    update(observer) {
      // Limit observer work to roughly 100 m of travel; slider seeks remain minute-accurate.
      const sampled: EarthObserver = {
        latitude: Math.round(Math.max(-90, Math.min(90, observer.latitude)) * 1000) / 1000,
        longitude:
          Math.round((((((observer.longitude + 180) % 360) + 360) % 360) - 180) * 1000) / 1000,
        elevation: Math.round(Math.max(-500, Math.min(100000, observer.elevation ?? 0)) / 10) * 10,
      };
      const key = `${sampled.latitude},${sampled.longitude},${sampled.elevation}`;
      if (!renderer.sky) {
        applyEnvironment(renderer, {
          sky: {
            mode: 'earth',
            observer: sampled,
            time: { epochMs: EPOCH },
            lighting: { sunIntensity: 2.05, dayAmbient: 0.48 },
          },
          toneMapping: 'agx',
          exposure: 0.9,
        });
        renderer.scene.fog = createExplorerFog(renderer.backend);
        observerKey = key;
      } else if (key !== observerKey) {
        renderer.sky.setObserver(sampled);
        observerKey = key;
      }
      const frame = renderer.sky?.update((utcMs - EPOCH) / 1000);
      if (!frame?.earth) return;
      const stamp = String(frame.earth.utcMs);
      if (status.dataset.utcMs !== stamp) status.dataset.utcMs = stamp;
      // Carry the explorer's existing distance fade through dusk and night; no weather simulation.
      const fog = renderer.scene.fog;
      if (fog instanceof Fog) {
        fog.color.copy(nightFog).lerp(dayFog, frame.daylight);
        fog.color.lerp(twilightFog, Math.sin(Math.PI * frame.daylight) * 0.6);
      }
      const { sun, moon } = frame.earth;
      const altitude = (value: number): string =>
        `${value.toFixed(0)}°${value < 0 ? ' (below horizon)' : ''}`;
      const text = `Sun ${altitude(sun.altitudeDeg)} · Moon ${altitude(moon.altitudeDeg)} · ${Math.round(moon.illuminatedFraction * 100)}% lit`;
      if (status.textContent !== text) status.textContent = text;
    },
  };
}
