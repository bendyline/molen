import { resolveWeather, type WeatherData } from '@bendyline/molen-schema';
import { type ComponentType, defineComponent } from './component';
import { dmath as m } from './dmath';
import type { World } from './world';

export const Weather: ComponentType<WeatherData> = defineComponent<WeatherData>('weather');

export interface AtmosphereSample {
  temperatureK: number;
  pressurePa: number;
  densityKgM3: number;
  relativeHumidity: number;
  windVelocity: [number, number, number];
}

/** First weather entity in world order; absence preserves a consumer's existing atmosphere. */
export function weatherOf(world: World): Readonly<WeatherData> | undefined {
  return world.query(Weather).first()?.[1];
}

/**
 * Ideal-gas density and a simple isothermal hydrostatic pressure profile. Temperature, wind
 * and humidity are uniform; no forecast, moist-air correction or automatic rain/snow switch.
 * Altitude is absolute world Y in meters. Gravity and gas constant allow authored worlds.
 */
export function sampleAtmosphere(
  data: WeatherData,
  altitude = 0,
  gravity = 9.80665,
): AtmosphereSample {
  if (!Number.isFinite(altitude) || !Number.isFinite(gravity) || gravity < 0)
    throw new Error('Atmosphere altitude must be finite and gravity nonnegative');
  const a = resolveWeather(data).atmosphere;
  const rt = a.gasConstant * a.temperatureK;
  const pressurePa =
    a.pressurePa * m.exp(m.max(-80, m.min(80, (-gravity * (altitude - a.referenceAltitude)) / rt)));
  return {
    temperatureK: a.temperatureK,
    pressurePa,
    densityKgM3: pressurePa / rt,
    relativeHumidity: a.relativeHumidity,
    windVelocity: [...a.windVelocity],
  };
}
