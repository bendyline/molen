/**
 * Track detail for the pavement material: sleepers and a pair of rails drawn across the middle
 * of a `TERRAIN_SURFACE_KIND.track` band, box-filtered so they stay antialiased at every distance
 * and settle, as they shrink below a pixel, to the averaged dark stripe a track makes in an
 * aerial photograph. GLSL for WebGL and the same arithmetic as TSL nodes for WebGPU; both are
 * spliced into the pavement shader in ground-material.ts.
 */
import * as THREE from 'three';
import type { Node } from 'three/webgpu';

/** Linear RGB of an sRGB hex color, as the shader sees vertex colors. */
function linear(hex: string): [number, number, number] {
  const color = new THREE.Color(hex);
  return [color.r, color.g, color.b];
}

/** Weathered creosoted timber, cast concrete, rail rust, a polished rail head, and weeds. */
const TIMBER = linear('#584a3c');
const CONCRETE = linear('#aeaba3');
const RUST = linear('#5c4738');
const HEAD = linear('#c7c6c0');
const WEEDS = linear('#6c7650');

const vec3 = (c: readonly number[]): string => `vec3(${c.map((n) => n.toFixed(5)).join(', ')})`;

/**
 * GLSL helpers and `terrainTrackFactor`, a color factor over the ballast vertex color. Reads
 * `terrainGroundHash` and `terrainGroundNoise` from the ground shader. It takes its derivative
 * widths as arguments, so it can run inside a branch.
 */
export const TERRAIN_TRACK_GLSL: string = /* glsl */ `
  // Share of a pixel w wide about x that [lo, hi] covers.
  float terrainTrackBox(float x, float lo, float hi, float w) {
    return clamp((min(x + 0.5 * w, hi) - max(x - 0.5 * w, lo)) / w, 0.0, 1.0);
  }
  // Running integral of a pulse train: 1 over the first 'duty' meters of every 'period'.
  float terrainTrackPulseSum(float x, float period, float duty) {
    return floor(x / period) * duty + min(x - floor(x / period) * period, duty);
  }
  // A pulse train box-filtered over 'w': exact antialiasing, and its duty cycle once w spans it.
  float terrainTrackPulse(float x, float period, float duty, float w) {
    float c = x - floor(x / period) * period;
    return clamp((terrainTrackPulseSum(c + 0.5 * w, period, duty) -
      terrainTrackPulseSum(c - 0.5 * w, period, duty)) / w, 0.0, 1.0);
  }
  vec3 terrainTrackFactor(vec3 base, float along, float lateral, float variant, float pixelAcross,
      float pixelAlong, float grain, float stones, vec2 p) {
    // A box a little wider than the pixel: sleepers at about two pixels apart beat into moire
    // under a one-pixel box.
    float wa = pixelAcross * 1.5;
    float wl = pixelAlong * 1.8;
    float gaugeCode = mod(variant, 4.0);
    float concrete = mod(floor(variant / 4.0 + 0.01), 2.0);
    float yard = mod(floor(variant / 8.0 + 0.01), 2.0);
    float disused = mod(floor(variant / 16.0 + 0.01), 2.0);
    float gauge = 1.435 + (1.067 - 1.435) * (1.0 - step(0.5, abs(gaugeCode - 1.0))) +
      (1.676 - 1.435) * (1.0 - step(0.5, abs(gaugeCode - 2.0))) +
      (1.0 - 1.435) * (1.0 - step(0.5, abs(gaugeCode - 3.0)));
    float rail = gauge * 0.5 + 0.036;
    float tieHalf = gauge * 0.5 + 0.585;
    float spacing = mix(0.52, 0.6, concrete);
    float tieWidth = mix(0.22, 0.26, concrete);
    float tiePick = terrainGroundHash(vec2(floor(along / spacing), 13.0 + concrete), 65536.0);
    // A disused line has lost the odd sleeper.
    float present = 1.0 - disused * step(tiePick, 0.16);
    float ties = terrainTrackBox(lateral, -tieHalf, tieHalf, wa) *
      terrainTrackPulse(along, spacing, tieWidth, wl) * present;
    // Rails: a head 70 mm across, polished by wheels, over a rusty web and foot 150 mm across.
    float foot = terrainTrackBox(lateral, -rail - 0.075, -rail + 0.075, wa) +
      terrainTrackBox(lateral, rail - 0.075, rail + 0.075, wa);
    float head = terrainTrackBox(lateral, -rail - 0.035, -rail + 0.035, wa) +
      terrainTrackBox(lateral, rail - 0.035, rail + 0.035, wa);
    // Brake dust and oil darken the ballast between the rails, most in a yard.
    float crib = terrainTrackBox(lateral, -rail, rail, wa);
    vec3 ballast = vec3((1.0 + grain * 0.3 + stones * 0.8) * (1.0 - (0.08 + 0.16 * yard) * crib));
    if (disused > 0.5) {
      float weeds = smoothstep(0.42, 0.68, terrainGroundNoise(p + vec2(17.0, 3.0), 1.5)) * 0.85;
      ballast = mix(ballast, ${vec3(WEEDS)} / max(base, vec3(0.001)), weeds);
    }
    vec3 sleeper = mix(${vec3(TIMBER)} * (1.0 - 0.12 * yard), ${vec3(CONCRETE)}, concrete) *
      (0.88 + 0.24 * tiePick) / max(base, vec3(0.001));
    vec3 color = mix(ballast, sleeper, ties);
    color = mix(color, ${vec3(RUST)} / max(base, vec3(0.001)), clamp(foot, 0.0, 1.0));
    return mix(color, mix(${vec3(HEAD)}, ${vec3(RUST)} * 1.1, disused) / max(base, vec3(0.001)),
      clamp(head, 0.0, 1.0));
  }
`;

type Tsl = typeof import('three/tsl');
type F = Node<'float'>;
type V2 = Node<'vec2'>;
type V3 = Node<'vec3'>;

/** `terrainTrackFactor` as TSL nodes; `hash` and `noise` are the ground shader's. */
export function terrainTrackNode(
  tsl: Tsl,
  helpers: {
    hash: (cell: V2, period: number) => F;
    noise: (p: V2, size: number) => F;
  },
  input: {
    base: V3;
    along: F;
    lateral: F;
    variant: F;
    wa: F;
    wl: F;
    grain: F;
    stones: F;
    p: V2;
  },
): V3 {
  const { abs, clamp, float, floor, If, max, min, mix, smoothstep, step, vec2, vec3 } = tsl;
  const { along, lateral, variant } = input;
  // A box a little wider than the pixel (see the GLSL).
  const wa = input.wa.mul(1.5) as unknown as F;
  const wl = input.wl.mul(1.8) as unknown as F;
  const box = (x: F, lo: F | number, hi: F | number, w: F): F =>
    clamp(
      min(x.add(w.mul(0.5)), hi)
        .sub(max(x.sub(w.mul(0.5)), lo))
        .div(w),
      0,
      1,
    ) as unknown as F;
  const pulseSum = (x: F, period: F, duty: F): F =>
    floor(x.div(period))
      .mul(duty)
      .add(min(x.sub(floor(x.div(period)).mul(period)), duty)) as unknown as F;
  const pulse = (x: F, period: F, duty: F, w: F): F => {
    const c = x.sub(floor(x.div(period)).mul(period)) as unknown as F;
    return clamp(
      pulseSum(c.add(w.mul(0.5)) as unknown as F, period, duty)
        .sub(pulseSum(c.sub(w.mul(0.5)) as unknown as F, period, duty))
        .div(w),
      0,
      1,
    ) as unknown as F;
  };
  const bit = (n: number): F => floor(variant.div(n).add(0.01)).mod(2).toVar() as unknown as F;
  const gaugeCode = variant.mod(4).toVar() as unknown as F;
  const is = (k: number): F => step(0.5, abs(gaugeCode.sub(k))).oneMinus() as unknown as F;
  const concrete = bit(4);
  const yard = bit(8);
  const disused = bit(16);
  const gauge = float(1.435)
    .add(is(1).mul(1.067 - 1.435))
    .add(is(2).mul(1.676 - 1.435))
    .add(is(3).mul(1.0 - 1.435))
    .toVar() as unknown as F;
  const rail = gauge.mul(0.5).add(0.036).toVar() as unknown as F;
  const tieHalf = gauge.mul(0.5).add(0.585).toVar() as unknown as F;
  const spacing = mix(0.52, 0.6, concrete).toVar() as unknown as F;
  const tieWidth = mix(0.22, 0.26, concrete) as unknown as F;
  const tiePick = helpers
    .hash(vec2(floor(along.div(spacing)), concrete.add(13)) as unknown as V2, 65536)
    .toVar() as unknown as F;
  const present = disused.mul(step(tiePick, 0.16)).oneMinus();
  const ties = box(lateral, tieHalf.negate() as unknown as F, tieHalf, wa)
    .mul(pulse(along, spacing, tieWidth, wl))
    .mul(present) as unknown as F;
  const foot = box(
    lateral,
    rail.negate().sub(0.075) as unknown as F,
    rail.negate().add(0.075) as unknown as F,
    wa,
  ).add(
    box(lateral, rail.sub(0.075) as unknown as F, rail.add(0.075) as unknown as F, wa),
  ) as unknown as F;
  const head = box(
    lateral,
    rail.negate().sub(0.035) as unknown as F,
    rail.negate().add(0.035) as unknown as F,
    wa,
  ).add(
    box(lateral, rail.sub(0.035) as unknown as F, rail.add(0.035) as unknown as F, wa),
  ) as unknown as F;
  const crib = box(lateral, rail.negate() as unknown as F, rail, wa);
  const inverse = vec3(1)
    .div(max(input.base, vec3(0.001)))
    .toVar() as unknown as V3;
  const ballast = vec3(
    input.grain
      .mul(0.3)
      .add(input.stones.mul(0.8))
      .add(1)
      .mul(yard.mul(0.16).add(0.08).mul(crib).oneMinus()),
  ).toVar() as unknown as V3;
  If(disused.greaterThan(0.5), () => {
    const weeds = smoothstep(
      0.42,
      0.68,
      helpers.noise(input.p.add(vec2(17, 3)) as unknown as V2, 1.5),
    ).mul(0.85);
    (ballast as unknown as { assign(v: Node): void }).assign(
      mix(ballast, vec3(...WEEDS).mul(inverse), weeds),
    );
  });
  const sleeper = mix(vec3(...TIMBER).mul(yard.mul(-0.12).add(1)), vec3(...CONCRETE), concrete)
    .mul(tiePick.mul(0.24).add(0.88))
    .mul(inverse);
  const color = mix(mix(ballast, sleeper, ties), vec3(...RUST).mul(inverse), clamp(foot, 0, 1));
  return mix(
    color,
    mix(vec3(...HEAD), vec3(...RUST).mul(1.1), disused).mul(inverse),
    clamp(head, 0, 1),
  ) as unknown as V3;
}
