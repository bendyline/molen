// The Earth view's "medium-fi" look: one sky palette, light rig, tone mapping and haze that every
// Earth host shares, so procedural buildings, authored landmarks, vehicles and terrain are lit and
// graded alike. The goals and authoring rules behind these values are in the medium-fi style
// guide (https://molen.dev/guide/medium-fi).

import type { SkyPalette } from '@bendyline/molen-schema';
import { Color, type ColorRepresentation } from 'three';

/**
 * Clear-day sky: a saturated zenith over a pale horizon, and a warm earth tone below the horizon
 * that reaches walls as ground bounce through the sky reflection map. Both sky colors sit a step
 * deeper than they look, since ACES (see EARTH_TONE_MAPPING) lifts and pales them on screen.
 */
export const EARTH_SKY_PALETTE: Required<SkyPalette> = {
  dayZenith: '#2a6cc4',
  dayHorizon: '#b2cde4',
  twilight: '#f78753',
  nightZenith: '#020510',
  nightHorizon: '#121c32',
  ground: '#9a8f70',
  sun: '#fff1d8',
  moon: '#dae5f5',
};

/**
 * A strong sun over a moderate sky fill: lit faces sit near their authored color and shade faces
 * well under half, so slopes, cast shadows and darks read with photographic contrast without
 * swallowing the shaded side of a street seen against the sun. The fill is cool but far less saturated than the zenith
 * it comes from, as real skylight is: lit by the dome colors themselves, a roof turned from the
 * sun rendered navy whatever its palette.
 */
export const EARTH_LIGHTING: {
  sunIntensity: number;
  dayAmbient: number;
  nightAmbient: number;
  skyLightSaturation: number;
} = { sunIntensity: 4.4, dayAmbient: 2, nightAmbient: 0.05, skyLightSaturation: 0.18 };

/** Open water: a clear teal-blue that stays blue under the sky's reflection. */
export const EARTH_WATER_COLOR = '#286d83';

/**
 * ACES filmic. Khronos PBR Neutral keeps base colors and saturation below the highlights, but its
 * toe subtracts nearly the whole darkest channel from dark colors: shade and asphalt in shadow
 * turned saturated navy, the opposite of a photograph. ACES keeps the palettes' hue and a little
 * extra mid-tone contrast, lets shade read as a cool grey, and pales the sky as a camera does.
 */
export const EARTH_TONE_MAPPING: 'aces' = 'aces';
export const EARTH_EXPOSURE = 1.05;

/**
 * Layer meshes taller than this many meters cast sun shadows: buildings, trees and landmarks.
 * Shrubs, brambles and saplings (up to 3.4 m) stay out of the shadow pass, where they drew
 * about a sixth of its triangles for shadows lost under the canopy's.
 */
export const EARTH_SHADOW_CASTER_HEIGHT = 3.5;

/** three's ACESFilmicToneMapping (sRGB to AP1, the RRT+ODT fit, back), for colors the shader never sees. */
function acesToneMap(color: Color, exposure: number): Color {
  const scale = exposure / 0.6;
  const r = color.r * scale,
    g = color.g * scale,
    b = color.b * scale;
  const fit = (v: number): number =>
    (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081);
  const ar = fit(0.59719 * r + 0.35458 * g + 0.04823 * b);
  const ag = fit(0.076 * r + 0.90834 * g + 0.01566 * b);
  const ab = fit(0.0284 * r + 0.13383 * g + 0.83777 * b);
  const clamp = (v: number): number => Math.min(1, Math.max(0, v));
  return color.setRGB(
    clamp(1.60475 * ar - 0.53108 * ag - 0.07367 * ab),
    clamp(-0.10208 * ar + 1.10813 * ag - 0.00605 * ab),
    clamp(-0.00327 * ar - 0.07276 * ag + 1.07602 * ab),
  );
}

/**
 * The fog color that makes fully hazed geometry match a sky color exactly. `color` is a sky
 * palette entry or scene-linear radiance, as the sky dome draws it. WebGPU fogs before tone
 * mapping, so the radiance is used as given; WebGL fogs after tone mapping (three uploads the
 * uniform in the output color space), so it receives the tone-mapped value. Distant terrain then
 * dissolves into the horizon instead of standing out as a pale band in front of it.
 */
export function earthHazeColor(
  backend: 'webgl' | 'webgpu',
  color: ColorRepresentation,
  out: Color = new Color(),
  exposure: number = EARTH_EXPOSURE,
): Color {
  out.set(color);
  if (backend === 'webgpu') return out;
  return acesToneMap(out, exposure);
}

/**
 * The square the sun's shadow map covers for a free camera: a little ahead of the walker, car or
 * aircraft, where most of the frame is, and wider the higher a flying camera is. Cast shadows are
 * part of the look (they seat buildings, trees and vehicles on the ground), so every host that
 * enables them should aim them with this.
 */
export function earthShadowFocus(
  mode: 'walk' | 'drive' | 'fly',
  position: readonly [number, number, number],
  direction: readonly [number, number, number],
  ground: number,
): { center: [number, number, number]; radius: number } {
  const [x, y, z] = position;
  const height = Math.max(0, y - ground);
  // A low flying camera sees mostly what is near it, so it gets a tighter, sharper square (about
  // 5 cm texels at eye level on a 4096 map), widening to 300 m by 25 m up.
  const radius =
    mode === 'walk'
      ? 160
      : mode === 'drive'
        ? 280
        : Math.min(2_500, Math.max(height * 2, Math.min(300, 100 + height * 8)));
  const forward = Math.hypot(direction[0], direction[2]) || 1;
  const reach = radius * 0.5;
  return {
    center: [x + (direction[0] / forward) * reach, ground, z + (direction[2] / forward) * reach],
    radius,
  };
}
