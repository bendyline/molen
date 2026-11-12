// Lying snow: the weather's `snowCover` whitens what faces the sky above its snow line. Ground
// materials draw their own snow (patches, ploughed roads) from the line this module defines; every
// other lit material a host marks with `enableSnowCover` (roofs, crowns, props, parked cars) takes
// a dusting from a renderer-wide hook, as cloud shadows reach it.
//
// The line is one function of world position on every surface, so a roof and the ground under it
// agree on where the snow begins: the smooth cover `snowCoverAt` gives the simulation, moved up and
// down by broad noise so it does not follow a contour like a tide mark.
//
// Each renderer keeps one set of uniforms for its lifetime; no cover is an amount of 0, which skips
// the work, so snow arriving or leaving never rebuilds a shader. WebGL splices GLSL into three's
// lit shader chunks; WebGPU patches node materials' diffuse color (three/webgpu-snow-cover.ts).

import { resolveSnowCover, type SnowCoverData } from '@bendyline/molen-schema';
import * as THREE from 'three';
import type { Node } from 'three/webgpu';

/** Linear albedo of lying snow: bright, a little blue, short of white so sunlit slopes keep form. */
export const SNOW_COVER_COLOR: readonly [number, number, number] = [0.78, 0.82, 0.87];
/**
 * Meters after which the snow line's wander repeats. A host passes world coordinates reduced by
 * this period, which keeps float precision and survives floating-origin rebases; the terrain
 * ground's own noise shares the period.
 */
export const SNOW_COVER_PERIOD = 4096;
/** Noise cells in meters that move the line, and how far each moves it, as shares of the band. */
const WANDER: readonly (readonly [cell: number, share: number, x: number, z: number])[] = [
  [512, 0.5, 401, 59],
  [64, 0.2, 83, 131],
];
/** The most the wander can add to or take from a height, as a share of the transition band. */
const WANDER_REACH = WANDER.reduce((sum, [, share]) => sum + share / 2, 0);
/**
 * World-normal up component across which a marked surface goes from bare to dusted, unless the
 * material names its own range: walls stay clean and anything flatter than about 40 degrees is
 * covered.
 */
export const SNOW_COVER_FACING: readonly [number, number] = [0.3, 0.75];
/** Most of a dusted surface's own color that snow hides. */
const SURFACE_COVER = 0.94;

export interface SnowCoverUniforms {
  /** Snow line (rendered Y), transition band in meters, amount (0 is none), unused. */
  molenSnowCover: { value: THREE.Vector4 };
  /** The renderer's world origin X and Z, wrapped to `SNOW_COVER_PERIOD`. */
  molenSnowOrigin: { value: THREE.Vector2 };
}

export function createSnowCoverUniforms(): SnowCoverUniforms {
  return {
    molenSnowCover: { value: new THREE.Vector4(0, 150, 0, 0) },
    molenSnowOrigin: { value: new THREE.Vector2() },
  };
}

const wrap = (value: number): number =>
  ((value % SNOW_COVER_PERIOD) + SNOW_COVER_PERIOD) % SNOW_COVER_PERIOD;

/**
 * Write a snow cover (or none) into a `vec4` uniform value: the line in rendered Y, which is
 * world Y less the floating origin's, the transition band, and an amount of 1.
 */
export function writeSnowCoverValue(
  target: THREE.Vector4,
  cover: SnowCoverData | undefined,
  worldOriginY = 0,
): void {
  if (cover === undefined) {
    target.z = 0;
    return;
  }
  const { level, transition } = resolveSnowCover(cover);
  target.set(level - worldOriginY, transition, 1, 0);
}

/** Point a renderer's snow uniforms at a cover (or none) for a world origin. */
export function writeSnowCover(
  uniforms: SnowCoverUniforms,
  cover: SnowCoverData | undefined,
  worldOrigin: readonly [number, number, number],
): void {
  writeSnowCoverValue(uniforms.molenSnowCover.value, cover, worldOrigin[1]);
  uniforms.molenSnowOrigin.value.set(wrap(worldOrigin[0]), wrap(worldOrigin[2]));
}

/**
 * GLSL for the shared snow line. `molenSnowLine(p, height, snow)` is the share of ground covered
 * at world XZ `p` (reduced by the period) and rendered height, for a `snow` uniform as
 * `writeSnowCoverValue` fills it. Guarded, so a ground material that includes it and also takes
 * the renderer's hook defines it once.
 */
export const SNOW_COVER_GLSL: string = /* glsl */ `
#ifndef MOLEN_SNOW_LINE
#define MOLEN_SNOW_LINE
float molenSnowHash(vec2 c, float period) {
  c -= period * floor(c / period);
  vec3 p3 = fract(vec3(c.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float molenSnowNoise(vec2 p, float cell) {
  float period = ${SNOW_COVER_PERIOD.toFixed(1)} / cell;
  vec2 q = p / cell;
  vec2 i = floor(q);
  vec2 f = q - i;
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(molenSnowHash(i, period), molenSnowHash(i + vec2(1.0, 0.0), period), u.x),
    mix(molenSnowHash(i + vec2(0.0, 1.0), period), molenSnowHash(i + vec2(1.0, 1.0), period), u.x),
    u.y);
}
float molenSnowLine(vec2 p, float height, vec4 snow) {
  if (snow.z <= 0.0) return 0.0;
  float above = (height - snow.x) / max(snow.y, 1.0);
  // Out of the wander's reach the answer is known: most of a scene skips the noise.
  if (above <= -${WANDER_REACH.toFixed(2)}) return 0.0;
  if (above >= ${(1 + WANDER_REACH).toFixed(2)}) return snow.z;
  float wander = ${WANDER.map(
    ([cell, share, x, z]) =>
      `(molenSnowNoise(p + vec2(${x.toFixed(1)}, ${z.toFixed(1)}), ${cell.toFixed(1)}) - 0.5) * ${share.toFixed(2)}`,
  ).join(' +\n    ')};
  float t = clamp(above + wander, 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t) * snow.z;
}
#endif
`;

const SURFACE_GLSL = /* glsl */ `
uniform vec4 molenSnowCover;
uniform vec2 molenSnowOrigin;
// This material's amount (0: takes no snow) and the facing range it dusts over.
uniform vec3 molenSnowSurface;
${SNOW_COVER_GLSL}
`;

const SURFACE_INCLUDE = '#include <normal_fragment_maps>';
/** In every lit fragment shader, and only those: they declare the view position read below. */
const LIT_INCLUDE = '#include <lights_pars_begin>';

/**
 * Add the snow dusting to a WebGL shader built from three's lit chunks; false if it has none.
 * Every such shader carries the code, so materials keep sharing programs; `material` only sets
 * its own amount and facing range (an unmarked material's amount is 0).
 */
export function injectSnowCover(
  shader: THREE.WebGLProgramParametersWithUniforms,
  uniforms: SnowCoverUniforms,
  material: THREE.Material,
): boolean {
  if (
    !shader.fragmentShader.includes(SURFACE_INCLUDE) ||
    !shader.fragmentShader.includes(LIT_INCLUDE)
  )
    return false;
  // After the normal is final and before lighting reads the surface.
  shader.fragmentShader = `${SURFACE_GLSL}\n${shader.fragmentShader.replace(
    SURFACE_INCLUDE,
    `${SURFACE_INCLUDE}
	if ( molenSnowSurface.x > 0.0 && molenSnowCover.z > 0.0 ) {
		vec3 molenSnowWorld = cameraPosition + ( vec4( - vViewPosition, 0.0 ) * viewMatrix ).xyz;
		float molenSnowUp = ( vec4( normal, 0.0 ) * viewMatrix ).y;
		float molenSnow = molenSnowLine( molenSnowWorld.xz + molenSnowOrigin, molenSnowWorld.y, molenSnowCover ) *
			smoothstep( molenSnowSurface.y, molenSnowSurface.z, molenSnowUp ) * ${SURFACE_COVER.toFixed(2)} * molenSnowSurface.x;
		diffuseColor.rgb = mix( diffuseColor.rgb, vec3( ${SNOW_COVER_COLOR.map((c) => c.toFixed(3)).join(', ')} ), molenSnow );
		#ifdef STANDARD
			roughnessFactor = mix( roughnessFactor, 0.9, molenSnow );
			metalnessFactor *= 1.0 - molenSnow;
		#endif
	}`,
  )}`;
  const [from, to] = snowCoverFacing(material);
  Object.assign(shader.uniforms, uniforms, {
    molenSnowSurface: { value: new THREE.Vector3(snowCoverAmount(material), from, to) },
  });
  return true;
}

const keyed = new WeakSet<THREE.Material>();

/**
 * How much of the weather's lying snow settles on a material: 0 unless `enableSnowCover` marked
 * it (or the material it was cloned from).
 */
export function snowCoverAmount(material: THREE.Material): number {
  const amount = (material.userData as { molenSnowCover?: unknown }).molenSnowCover;
  return typeof amount === 'number' && amount > 0 ? Math.min(1, amount) : 0;
}

/** The up-component range over which a material's surfaces go from bare to dusted. */
export function snowCoverFacing(material: THREE.Material): readonly [number, number] {
  const facing = (material.userData as { molenSnowFacing?: unknown }).molenSnowFacing;
  return Array.isArray(facing) && facing.length === 2
    ? (facing as [number, number])
    : SNOW_COVER_FACING;
}

/**
 * Let lying snow settle on a lit material: above the weather's snow line its up-facing surfaces
 * whiten, on either backend, with no further calls. For roofs, ledges, crowns, props and parked
 * cars; not for the ground (its materials draw their own snow), water, or anything that moves
 * through the weather, such as an aircraft or a person. `amount` (0–1, default 1) thins the
 * dusting: foliage holds less than a roof. `facing` is the range of the surface normal's up
 * component over which it goes from bare to dusted (default `SNOW_COVER_FACING`: flat roofs
 * white, walls clean); a lower range lets snow cling to steep sides, as on a conifer. A `clone()`
 * stays marked, as does a `copy()` target marked again afterwards. Call it before the material
 * first draws.
 */
export function enableSnowCover<T extends THREE.Material>(
  material: T,
  amount = 1,
  facing?: readonly [number, number],
): T {
  if (!(amount > 0 && amount <= 1)) throw new RangeError('Snow cover amount must be in (0, 1]');
  if (facing !== undefined && !(facing[0] < facing[1]))
    throw new RangeError('Snow cover facing must be an ascending range');
  const data = material.userData as { molenSnowCover?: number; molenSnowFacing?: number[] };
  data.molenSnowCover = amount;
  if (facing === undefined) delete data.molenSnowFacing;
  else data.molenSnowFacing = [...facing];
  if (!keyed.has(material)) {
    keyed.add(material);
    // WebGPU caches a material's node build by this key and never reads `userData`.
    const previous = material.customProgramCacheKey.bind(material);
    material.customProgramCacheKey = (): string =>
      `${previous()}|molen-snow-cover:${snowCoverAmount(material)}:${snowCoverFacing(material).join(',')}`;
  }
  material.needsUpdate = true;
  return material;
}

type Tsl = typeof import('three/tsl');
type F = Node<'float'>;
type V2 = Node<'vec2'>;

/** `molenSnowLine` as TSL nodes; `tsl` is the caller's lazily loaded `three/tsl`. */
export function snowLineNode(tsl: Tsl, p: V2, height: F, snow: Node<'vec4'>): F {
  const { clamp, dot, float, floor, Fn, fract, If, max, mix, vec2, vec3 } = tsl;
  const hash = (cell: V2, period: number): F => {
    const c = cell.sub(floor(cell.div(period)).mul(period));
    const a = fract(vec3(c.x, c.y, c.x).mul(0.1031));
    const b = a.add(dot(a, a.yzx.add(33.33)));
    return fract(b.x.add(b.y).mul(b.z)) as unknown as F;
  };
  const noise = (at: V2, size: number): F => {
    const period = SNOW_COVER_PERIOD / size;
    const q = at.div(size);
    const i = floor(q).toVar() as unknown as V2;
    const f = q.sub(i);
    const u = f.mul(f).mul(f.mul(-2).add(3)).toVar();
    return mix(
      mix(hash(i, period), hash(i.add(vec2(1, 0)) as unknown as V2, period), u.x),
      mix(
        hash(i.add(vec2(0, 1)) as unknown as V2, period),
        hash(i.add(vec2(1, 1)) as unknown as V2, period),
        u.x,
      ),
      u.y,
    ) as unknown as F;
  };
  // The uniform arrives as an argument: three does not collect one first met inside a function.
  return Fn(([at, rendered, lying]: [V2, F, Node<'vec4'>]) => {
    const result = float(0).toVar();
    If(lying.z.greaterThan(0), () => {
      const above = rendered.sub(lying.x).div(max(lying.y, 1)).toVar();
      // Out of the wander's reach the answer is known: most of a scene skips the noise.
      If(above.greaterThanEqual(1 + WANDER_REACH), () => {
        result.assign(lying.z);
      }).ElseIf(above.greaterThan(-WANDER_REACH), () => {
        let wander: F | undefined;
        for (const [cell, share, x, z] of WANDER) {
          const term = noise(at.add(vec2(x, z)) as unknown as V2, cell)
            .sub(0.5)
            .mul(share) as unknown as F;
          wander = wander === undefined ? term : (wander.add(term) as unknown as F);
        }
        const t = clamp(above.add(wander as F), 0, 1).toVar();
        result.assign(t.mul(t).mul(t.mul(-2).add(3)).mul(lying.z));
      });
    });
    return result;
  })(p, height, snow) as unknown as F;
}

/** The dusting on a marked surface, from its world position and normal, as TSL nodes. */
export function snowSurfaceNode(
  tsl: Tsl,
  p: V2,
  height: F,
  up: F,
  snow: Node<'vec4'>,
  amount: number,
  facing: readonly [number, number] = SNOW_COVER_FACING,
): { cover: F; color: Node<'vec3'> } {
  const { smoothstep, vec3 } = tsl;
  return {
    cover: snowLineNode(tsl, p, height, snow)
      .mul(smoothstep(facing[0], facing[1], up))
      .mul(SURFACE_COVER * amount) as unknown as F,
    color: vec3(...SNOW_COVER_COLOR) as unknown as Node<'vec3'>,
  };
}
