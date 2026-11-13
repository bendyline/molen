import {
  type CloudType,
  type Renderer,
  resolveWeather,
  type WeatherData,
  weatherProfile,
} from '@bendyline/molen-client';
import { Weather, type World } from '@bendyline/molen-kernel/world';
import type { SnowCoverData } from '@bendyline/molen-schema';
import { snowCoverChoice } from './snow-level.js';

const profiles = [
  'fair',
  'sunny',
  'partly-cloudy',
  'overcast',
  'rain',
  'storm',
  'snow',
  'fog',
] as const;
type ExplorerProfile = (typeof profiles)[number];

/**
 * The explorer opens on a fair day: sunny conditions with scattered fair-weather cumulus, so a
 * street-level sky is not a bare gradient. Scattered cloud dims the sun only a little.
 */
function explorerProfile(profile: ExplorerProfile): WeatherData {
  if (profile !== 'fair') return weatherProfile(profile);
  const sunny = weatherProfile('sunny');
  // Larger cells than the default deck: separate cumulus rather than streaks at the horizon.
  return { ...sunny, clouds: { ...sunny.clouds, coverage: 0.3, density: 0.45, scale: 24000 } };
}

/** The UI authors the same weather component consumed by flight physics and rendering. */
export function createWeatherControls(
  renderer: Renderer,
  params: URLSearchParams,
  world: World,
  options: {
    /** The region's own snow line in meters, used until `?snow=` or the control says otherwise. */
    snowLevel?: number;
  } = {},
): {
  update(seconds: number): void;
  /** Snow lying on the ground now, for the ground materials. */
  snowCover(): SnowCoverData | undefined;
} {
  const root = document.getElementById('weather-controls') as HTMLFieldSetElement;
  const profile = document.getElementById('weather-profile') as HTMLSelectElement;
  const status = document.getElementById('weather-status') as HTMLElement;
  const snow = document.getElementById('weather-snow') as HTMLSelectElement;
  const input = (id: string): HTMLInputElement =>
    document.getElementById(`weather-${id}`) as HTMLInputElement;
  const kind = document.getElementById('weather-precipitation') as HTMLSelectElement;
  const type = document.getElementById('weather-type') as HTMLSelectElement;
  let data: WeatherData = {};
  let first = true;
  const publish = (next: WeatherData): void => {
    data = next;
    renderer.setWeather(data);
    if (first) {
      world.spawnRaw({ weather: data }, 'world-weather');
      first = false;
    } else world.set('world-weather', Weather, data);
  };
  if (params.get('sky') === 'daylight' && !params.has('weather')) {
    root.hidden = true;
    // The weather-free daylight path keeps its bare ground unless snow is asked for by name.
    const cover = snowCoverChoice(params.get('snow') ?? '');
    if (cover !== undefined) publish({ snowCover: cover });
    return { update() {}, snowCover: () => cover };
  }
  // `?snow=1200` may name a line the list does not offer.
  const requested = params.get('snow') ?? String(options.snowLevel ?? 'off');
  const choice = requested === 'off' || snowCoverChoice(requested) ? requested : 'off';
  if (![...snow.options].some((option) => option.value === choice))
    snow.add(new Option(`${Number(choice).toLocaleString('en-US')} m`, choice));
  snow.value = choice;
  /** The weather with the snow control's lying snow, replacing any it carried. */
  const withSnow = (weather: WeatherData): WeatherData => {
    const { snowCover: _previous, ...rest } = weather;
    const cover = snowCoverChoice(snow.value);
    return cover ? { ...rest, snowCover: cover } : rest;
  };
  const apply = (next: WeatherData): void => {
    publish(next);
    const w = resolveWeather(data);
    input('coverage').value = String(Math.round(w.clouds.coverage * 100));
    input('density').value = String(Math.round(w.clouds.density * 100));
    input('base').value = String(w.clouds.baseAltitude);
    input('thickness').value = String(w.clouds.thickness);
    input('cirrus').value = String(Math.round(w.clouds.cirrus * 100));
    type.value = w.clouds.type;
    input('intensity').value = String(Math.round(w.precipitation.intensity * 100));
    input('visibility').value = String(w.visibility / 1000);
    input('temperature').value = (w.atmosphere.temperatureK - 273.15).toFixed(1);
    input('pressure').value = String(w.atmosphere.pressurePa / 100);
    input('east').value = String(w.atmosphere.windVelocity[0]);
    input('north').value = String(-w.atmosphere.windVelocity[2]);
    kind.value = w.precipitation.kind;
    const lying =
      w.snowCover === undefined
        ? ''
        : snow.value === 'all'
          ? ' · snow on the ground'
          : ` · snow above ${w.snowCover.level.toLocaleString('en-US')} m`;
    status.textContent = `${Math.round(w.clouds.coverage * 100)}% cloud · ${w.precipitation.kind === 'none' ? 'dry' : w.precipitation.kind} · ${(w.atmosphere.temperatureK - 273.15).toFixed(0)} °C · ${(w.atmosphere.pressurePa / 100).toFixed(0)} hPa · ${w.visibility / 1000} km visibility${lying}`;
    status.dataset.weather = JSON.stringify(w);
  };
  const initial = params.get('weather') ?? 'fair';
  profile.value = profiles.includes(initial as ExplorerProfile) ? initial : 'fair';
  apply(withSnow(explorerProfile(profile.value as ExplorerProfile)));
  root.disabled = false;
  profile.addEventListener('change', () => {
    if (profile.value === 'custom') return;
    apply(withSnow(explorerProfile(profile.value as ExplorerProfile)));
    const url = new URL(location.href);
    url.searchParams.set('weather', profile.value);
    history.replaceState(null, '', url);
  });
  snow.addEventListener('change', () => {
    apply(withSnow(data));
    const url = new URL(location.href);
    url.searchParams.set('snow', snow.value);
    history.replaceState(null, '', url);
  });
  const customize = (): void => {
    const fields = [...root.querySelectorAll<HTMLInputElement>('input')];
    if (fields.some((field) => !field.checkValidity() || field.value === '')) return;
    const w = resolveWeather(data);
    profile.value = 'custom';
    apply({
      ...w,
      clouds: {
        ...w.clouds,
        coverage: Number(input('coverage').value) / 100,
        density: Number(input('density').value) / 100,
        baseAltitude: Number(input('base').value),
        thickness: Number(input('thickness').value),
        cirrus: Number(input('cirrus').value) / 100,
        type: type.value as CloudType,
      },
      precipitation: {
        kind: kind.value as 'none' | 'rain' | 'snow',
        intensity: Number(input('intensity').value) / 100,
      },
      visibility: Number(input('visibility').value) * 1000,
      atmosphere: {
        ...w.atmosphere,
        temperatureK: Number(input('temperature').value) + 273.15,
        pressurePa: Number(input('pressure').value) * 100,
        windVelocity: [Number(input('east').value), 0, -Number(input('north').value)],
      },
    });
    const url = new URL(location.href);
    url.searchParams.delete('weather');
    history.replaceState(null, '', url);
  };
  root.querySelector('details')?.addEventListener('change', customize);
  return {
    update(seconds) {
      renderer.setWeatherTimeOverride(params.has('freeze') ? 0 : seconds);
      status.dataset.effects = JSON.stringify(renderer.weather?.stats);
    },
    snowCover: () => data.snowCover,
  };
}
