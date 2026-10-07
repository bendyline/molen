// The Earth view's "medium-fi" look: one sky palette, light rig, tone mapping and haze that every
// Earth host shares, so procedural buildings, authored landmarks, vehicles and terrain are lit and
// graded alike. The goals and authoring rules behind these values are in the medium-fi style
// guide (https://molen.dev/guide/medium-fi).

import type { SkyPalette } from '@bendyline/molen-schema';
import { Color, type ColorRepresentation } from 'three';

/**
 * Clear-day sky: a saturated zenith over a pale horizon, and a warm earth tone below the horizon
 * that reaches walls as ground bounce through the sky reflection map.
 */
export const EARTH_SKY_PALETTE: Required<SkyPalette> = {
  dayZenith: '#2f7fd3',
  dayHorizon: '#c4dcec',
  twilight: '#f78753',
  nightZenith: '#020510',
  nightHorizon: '#121c32',
  ground: '#7a7258',
  sun: '#fff1d8',
  moon: '#dae5f5',
};

/**
 * A strong sun over a moderate sky fill: lit faces sit near their authored color, shade faces at
 * roughly a third, so cast shadows read like a model layout under one bright lamp.
 */
export const EARTH_LIGHTING: {
  sunIntensity: number;
  dayAmbient: number;
  nightAmbient: number;
} = { sunIntensity: 3.5, dayAmbient: 2, nightAmbient: 0.05 };

/** Open water: a clear teal-blue that stays blue under the sky's reflection. */
export const EARTH_WATER_COLOR = '#286d83';

/**
 * Khronos PBR Neutral keeps authored base colors and their saturation below the highlights, which
 * a palette-driven world needs; AgX and ACES desaturate the mid-tones the palettes live in.
 */
export const EARTH_TONE_MAPPING: 'neutral' = 'neutral';
export const EARTH_EXPOSURE = 1;

/** Khronos PBR Neutral (three's NeutralToneMapping), for colors the shader never sees. */
function neutralToneMap(color: Color): Color {
  const start = 0.8 - 0.04;
  const desaturation = 0.15;
  const x = Math.min(color.r, color.g, color.b);
  const offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color.setRGB(color.r - offset, color.g - offset, color.b - offset);
  const peak = Math.max(color.r, color.g, color.b);
  if (peak < start) return color;
  const d = 1 - start;
  const newPeak = 1 - (d * d) / (peak + d - start);
  color.multiplyScalar(newPeak / peak);
  const g = 1 - 1 / (desaturation * (peak - newPeak) + 1);
  return color.lerp(new Color(newPeak, newPeak, newPeak), g);
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
  return neutralToneMap(out.multiplyScalar(exposure));
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
  const radius =
    mode === 'walk'
      ? 160
      : mode === 'drive'
        ? 280
        : Math.min(2_500, Math.max(300, (y - ground) * 2));
  const forward = Math.hypot(direction[0], direction[2]) || 1;
  const reach = radius * 0.5;
  return {
    center: [x + (direction[0] / forward) * reach, ground, z + (direction[2] / forward) * reach],
    radius,
  };
}
