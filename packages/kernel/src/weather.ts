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
  speedOfSound: number;
}

// US Standard Atmosphere 1976 lower-atmosphere layers, geopotential meters and K/m.
const layers = [
  [0, -0.0065],
  [11000, 0],
  [20000, 0.001],
  [32000, 0.0028],
  [47000, 0],
  [51000, -0.0028],
  [71000, -0.002],
  [84852, 0],
] as const;
function standardColumn(altitude: number, seaTemperature: number, gravity: number, gas: number) {
  const geometric = m.clamp(altitude, -2000, 100000);
  const height = (6356766 * geometric) / (6356766 + geometric);
  let temperature = seaTemperature;
  let pressure = 1;
  for (let i = 0; i < layers.length; i++) {
    const [base, lapse] = layers[i] ?? [0, 0];
    const end = m.min(height, layers[i + 1]?.[0] ?? height);
    const distance = end - base;
    const next = m.max(80, temperature + lapse * distance);
    pressure *=
      lapse === 0
        ? m.exp((-gravity * distance) / (gas * temperature))
        : m.pow(next / temperature, -gravity / (gas * lapse));
    temperature = next;
    if (end >= height) break;
  }
  return { temperature, pressure };
}

/** First weather entity in world order; absence preserves a consumer's existing atmosphere. */
export function weatherOf(world: World): Readonly<WeatherData> | undefined {
  return world.query(Weather).first()?.[1];
}

/**
 * Layered standard Earth atmosphere (geometric altitude -2..100 km), anchored to the authored
 * reference temperature and pressure. Optional isothermal profile supports other worlds.
 * Optional moist-air density uses saturation vapor pressure; precipitation remains independent.
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
  let temperatureK = a.temperatureK;
  let pressurePa: number;
  if (a.model === 'isothermal') {
    pressurePa =
      a.pressurePa *
      m.exp(
        m.clamp(
          (-gravity * (altitude - a.referenceAltitude)) / (a.gasConstant * temperatureK),
          -80,
          80,
        ),
      );
  } else {
    const reference = standardColumn(a.referenceAltitude, 288.15, gravity, a.gasConstant);
    const seaTemperature = 288.15 + a.temperatureK - reference.temperature;
    const base = standardColumn(a.referenceAltitude, seaTemperature, gravity, a.gasConstant);
    const at = standardColumn(altitude, seaTemperature, gravity, a.gasConstant);
    temperatureK = at.temperature;
    pressurePa = (a.pressurePa * at.pressure) / base.pressure;
  }
  const celsius = temperatureK - 273.15;
  const vapor = a.moistAir
    ? m.min(
        pressurePa,
        a.relativeHumidity *
          610.94 *
          m.exp((17.625 * m.clamp(celsius, -80, 60)) / (243.04 + m.clamp(celsius, -80, 60))),
      )
    : 0;
  return {
    temperatureK,
    pressurePa,
    densityKgM3:
      (pressurePa - vapor) / (a.gasConstant * temperatureK) + vapor / (461.5 * temperatureK),
    relativeHumidity: a.relativeHumidity,
    windVelocity: [...a.windVelocity],
    speedOfSound: m.sqrt(1.4 * a.gasConstant * temperatureK),
  };
}
