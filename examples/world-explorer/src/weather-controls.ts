import {
  type Renderer,
  resolveWeather,
  type WeatherData,
  type WeatherProfile,
  weatherProfile,
} from '@bendyline/molen-client';
import { Weather, type World } from '@bendyline/molen-kernel/world';

const profiles = ['sunny', 'partly-cloudy', 'overcast', 'rain', 'snow', 'fog'] as const;

/** The UI authors the same weather component consumed by flight physics and rendering. */
export function createWeatherControls(
  renderer: Renderer,
  params: URLSearchParams,
  world: World,
): {
  update(seconds: number): void;
} {
  const root = document.getElementById('weather-controls') as HTMLFieldSetElement;
  const profile = document.getElementById('weather-profile') as HTMLSelectElement;
  const status = document.getElementById('weather-status') as HTMLElement;
  const input = (id: string): HTMLInputElement =>
    document.getElementById(`weather-${id}`) as HTMLInputElement;
  const kind = document.getElementById('weather-precipitation') as HTMLSelectElement;
  if (params.get('sky') === 'daylight' && !params.has('weather')) {
    root.hidden = true;
    return { update() {} };
  }
  let data: WeatherData;
  let first = true;
  const apply = (next: WeatherData): void => {
    data = next;
    renderer.setWeather(data);
    if (first) {
      world.spawnRaw({ weather: data }, 'world-weather');
      first = false;
    } else world.set('world-weather', Weather, data);
    const w = resolveWeather(data);
    input('coverage').value = String(Math.round(w.clouds.coverage * 100));
    input('density').value = String(Math.round(w.clouds.density * 100));
    input('base').value = String(w.clouds.baseAltitude);
    input('intensity').value = String(Math.round(w.precipitation.intensity * 100));
    input('visibility').value = String(w.visibility / 1000);
    input('temperature').value = (w.atmosphere.temperatureK - 273.15).toFixed(1);
    input('pressure').value = String(w.atmosphere.pressurePa / 100);
    input('east').value = String(w.atmosphere.windVelocity[0]);
    input('north').value = String(-w.atmosphere.windVelocity[2]);
    kind.value = w.precipitation.kind;
    status.textContent = `${Math.round(w.clouds.coverage * 100)}% cloud · ${w.precipitation.kind === 'none' ? 'dry' : w.precipitation.kind} · ${(w.atmosphere.temperatureK - 273.15).toFixed(0)} °C · ${(w.atmosphere.pressurePa / 100).toFixed(0)} hPa · ${w.visibility / 1000} km visibility`;
    status.dataset.weather = JSON.stringify(w);
  };
  const initial = params.get('weather') ?? 'sunny';
  profile.value = profiles.includes(initial as WeatherProfile) ? initial : 'sunny';
  apply(weatherProfile(profile.value as WeatherProfile));
  root.disabled = false;
  profile.addEventListener('change', () => {
    if (profile.value === 'custom') return;
    apply(weatherProfile(profile.value as WeatherProfile));
    const url = new URL(location.href);
    url.searchParams.set('weather', profile.value);
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
  };
}
