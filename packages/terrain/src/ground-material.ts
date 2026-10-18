// Ground variation for terrain and landcover: world-space mottling, hue drift, bare specks and
// fine grain, dry and lush patches on vegetated ground, a small procedural relief that catches the
// sun, and organic edges between neighboring land classes. It is all computed in the shader, so
// it costs no texture and no upload. Flat landcover polygons would otherwise read as one solid
// swatch from edge to edge, meeting their neighbors along straight polygon edges.

import * as THREE from 'three';
import type { MeshStandardNodeMaterial, Node } from 'three/webgpu';

export interface TerrainGroundMaterialOptions {
  roughness?: number;
  /** Variation amount: 0 is the flat vertex color, 1 the default, up to 2. */
  strength?: number;
  /**
   * Landcover geometries carry per-field row and soil attributes and the neighboring-class blend
   * (`landcoverBlend`) that softens class boundaries.
   */
  agriculture?: boolean;
}

/** Vertex-colored ground for either the legacy WebGL renderer or the WebGPU node renderer. */
export type TerrainGroundMaterial = THREE.MeshStandardMaterial | MeshStandardNodeMaterial;

/**
 * Meters after which the pattern repeats. The noise is periodic over it, so the host can pass
 * its floating origin reduced by this period: the shader then adds small numbers, keeping full
 * float precision, and a rebase never shifts the pattern. Every cell size below divides it.
 */
const PERIOD = 4096;
/** Noise cell sizes, meters: broad mottling, mid patches, clumps, grain, and dry/lush areas. */
const BROAD = 64;
const MID = 16;
const FINE = 4;
const CLUMP = 2;
const GRAIN = 1;
const PATCH = 128;
/** Hue drift between yellower and bluer greens, bare specks in turf, and close-up grain. */
const HUE = 32;
const SPECK = 2;
const MICRO = 0.5;
const NANO = 0.25;
/** Blade-scale grain: what keeps turf crisp a few meters from a street-level camera. */
const BLADE = 0.0625;
/** Meters of warp on the tuft and speckle coordinates: enough to hide the lattice, not to smear. */
const WARP = 0.8;
/** Land-class boundary noise: wandering edges with ragged fringes. */
const EDGE = 8;
const FRINGE = 2;
const TUFT = 0.5;
/** Mottling's share of brightness at full strength (value noise is mostly within ±0.3). */
const MOTTLE = 0.34;
/** Straw-colored dry areas and darker, bluer lush areas on green ground. */
const DRY: [number, number, number] = [1.28, 1.08, 0.6];
const LUSH: [number, number, number] = [0.78, 0.96, 0.84];
/** Yellow-green and blue-green ends of the hue drift. */
const WARM: [number, number, number] = [1.03, 1.02, 0.93];
const COOL: [number, number, number] = [0.94, 1.0, 1.06];
/** Share of green ground's saturation taken out, so sunlit turf is grass, not lime. */
const MUTE = 0.08;
/** Linear color of bare soil showing through turf. */
const SOIL: [number, number, number] = [0.2, 0.15, 0.09];
/** Relief amplitude in meters per noise layer (clumps, tufts, close grain). */
const RELIEF: [number, number, number] = [0.08, 0.04, 0.016];
const glslVec3 = (v: readonly number[]): string => `vec3(${v.map((x) => x.toFixed(3)).join(', ')})`;

interface TerrainGroundState {
  origin: { value: THREE.Vector2 };
  strength: { value: number };
}

const states = new WeakMap<THREE.Material, TerrainGroundState>();

const GLSL = /* glsl */ `
  varying vec2 vTerrainGround;
  uniform float terrainGroundStrength;

  float terrainGroundHash(vec2 c, float period) {
    c -= period * floor(c / period);
    vec3 p3 = fract(vec3(c.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float terrainGroundNoise(vec2 p, float cell) {
    float period = ${PERIOD.toFixed(1)} / cell;
    vec2 q = p / cell;
    vec2 i = floor(q);
    vec2 f = q - i;
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = terrainGroundHash(i, period);
    float b = terrainGroundHash(i + vec2(1.0, 0.0), period);
    float c = terrainGroundHash(i + vec2(0.0, 1.0), period);
    float d = terrainGroundHash(i + vec2(1.0, 1.0), period);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  // The share of the neighboring class at this pixel: the interpolated weight thresholded
  // against wandering noise, so a class boundary becomes an organic, ragged edge. Far away the
  // noise would shimmer, so it settles to the smooth weight.
  float terrainGroundEdge(float weight, float distance) {
    vec2 p = vTerrainGround;
    // Up close, half-meter tufts and then blade-scale specks break the contour, so one class
    // thins into the other rather than ending on a smooth blob outline or in blob islands.
    float footprint = max(max(length(dFdx(p)), length(dFdy(p))), 0.0001);
    float tuft = 1.0 - smoothstep(0.25, 0.6, footprint / ${TUFT.toFixed(1)});
    float blade = 1.0 - smoothstep(0.25, 0.6, footprint / ${(BLADE * 2).toFixed(3)});
    float n = terrainGroundNoise(p + vec2(57.0, 211.0), ${EDGE.toFixed(1)}) * 0.66 +
      terrainGroundNoise(p + vec2(13.0, 97.0), ${FRINGE.toFixed(1)}) * 0.24 +
      mix(0.5, terrainGroundNoise(p + vec2(31.0, 5.0), ${TUFT.toFixed(1)}), tuft) * 0.04 +
      mix(0.5, terrainGroundNoise(p + vec2(19.0, 7.0), ${(BLADE * 2).toFixed(3)}), blade) * 0.06;
    n = clamp((n - 0.5) * 1.7 + 0.5, 0.0, 1.0);
    float edge = weight * 1.24 - 0.12;
    float organic = 1.0 - smoothstep(edge - 0.16, edge + 0.16, n);
    return mix(weight, organic, 1.0 - smoothstep(200.0, 700.0, distance));
  }

  vec3 terrainGroundFactor(vec3 base, float distance, out float relief) {
    vec2 p = vTerrainGround;
    // Each layer fades as its cells shrink toward two pixels (the ground's own footprint,
    // grazing angles included), so detail reaches as far as it can without ever shimmering.
    float footprint = max(max(length(dFdx(p)), length(dFdy(p))), 0.0001);
    float nano = 1.0 - smoothstep(0.25, 0.6, footprint / ${NANO.toFixed(2)});
    float micro = 1.0 - smoothstep(0.25, 0.6, footprint / ${MICRO.toFixed(1)});
    float grain = 1.0 - smoothstep(0.25, 0.6, footprint / ${GRAIN.toFixed(1)});
    float fine = 1.0 - smoothstep(0.25, 0.6, footprint / ${FINE.toFixed(1)});
    float clump = 1.0 - smoothstep(0.25, 0.6, footprint / ${CLUMP.toFixed(1)});
    float specks = 1.0 - smoothstep(0.25, 0.6, footprint / ${SPECK.toFixed(1)});
    float mid = 1.0 - smoothstep(500.0, 2000.0, distance);
    float broad = 1.0 - smoothstep(5000.0, 15000.0, distance);
    float nFine = terrainGroundNoise(p, ${FINE.toFixed(1)});
    // Tufts and speckle, on coordinates gently warped by a 2 m field so the noise lattice never
    // shows (the warp is periodic too, so rebases keep the pattern); strongest on vegetated
    // ground. The finest layers use a grid turned 45 degrees, (x + y, y - x), which stays
    // periodic and is sqrt(2) finer, so no two layers' lattices line up.
    // Each finer layer only where it still shows: past its fade every term it feeds is zero, so
    // most of a distant view skips these noise lookups (and the warp) entirely.
    // Clumps between the 4 m patches and the 1 m grain, so mid-distance turf keeps texture
    // after the finer layers have faded.
    float nClump = 0.5;
    if (clump > 0.0) nClump = terrainGroundNoise(p + vec2(0.37, 1.13), ${CLUMP.toFixed(1)});
    float nGrain = 0.5, nMicro = 0.5, nNano = 0.5;
    if (grain > 0.0) {
      vec2 w = p + (vec2(terrainGroundNoise(p + vec2(17.0, 3.0), 2.0),
        terrainGroundNoise(p + vec2(5.0, 41.0), 2.0)) - 0.5) * ${WARP.toFixed(2)};
      vec2 turned = vec2(w.x + w.y, w.y - w.x);
      nGrain = terrainGroundNoise(w, ${GRAIN.toFixed(1)});
      if (micro > 0.0) {
        nMicro = smoothstep(0.1, 0.9, terrainGroundNoise(turned, ${(MICRO * 2).toFixed(1)}));
        if (nano > 0.0) {
          nNano = smoothstep(0.15, 0.85,
            terrainGroundNoise(turned + vec2(0.37, 0.71), ${(NANO * 2).toFixed(2)}));
          float blade = 1.0 - smoothstep(0.25, 0.6, footprint / ${BLADE.toFixed(4)});
          if (blade > 0.0)
            nNano += (smoothstep(0.2, 0.8, terrainGroundNoise(turned + vec2(0.71, 0.13),
              ${(BLADE * 2).toFixed(3)})) - 0.5) * 0.8 * blade;
        }
      }
    }
    // Only green ground dries out, grows lush, drifts in hue or shows soil; paving, sand and
    // rock keep their hue.
    float green = clamp((base.g - max(base.r, base.b)) * 10.0, 0.0, 1.0);
    float turf = 0.45 + 0.55 * green;
    float mottle =
      (terrainGroundNoise(p, ${BROAD.toFixed(1)}) - 0.5) * 0.55 * broad +
      (terrainGroundNoise(p, ${MID.toFixed(1)}) - 0.5) * 0.35 * mid +
      (nFine - 0.5) * 0.35 * fine +
      (nClump - 0.5) * 0.55 * clump * turf +
      (nGrain - 0.5) * 0.9 * grain * turf +
      (nMicro - 0.5) * 0.8 * micro * turf +
      (nNano - 0.5) * 0.7 * nano * turf;
    float lum = 1.0 + mottle * ${MOTTLE.toFixed(3)} * terrainGroundStrength;
    float area = terrainGroundNoise(p + vec2(311.0, 173.0), ${PATCH.toFixed(1)});
    float dry = clamp(smoothstep(0.5, 0.78, area) * green * broad * 0.3 * terrainGroundStrength, 0.0, 1.0);
    float lush = clamp((1.0 - smoothstep(0.22, 0.45, area)) * green * broad * 0.35 * terrainGroundStrength, 0.0, 1.0);
    vec3 tint = mix(vec3(1.0), ${glslVec3(DRY)}, dry) * mix(vec3(1.0), ${glslVec3(LUSH)}, lush);
    float hue = terrainGroundNoise(p + vec2(71.0, 29.0), ${HUE.toFixed(1)});
    tint *= mix(vec3(1.0), mix(${glslVec3(WARM)}, ${glslVec3(COOL)}, hue),
      clamp(green * mid * 0.6 * terrainGroundStrength, 0.0, 1.0));
    float speck = smoothstep(0.68, 0.82, terrainGroundNoise(p + vec2(5.0, 143.0), ${SPECK.toFixed(1)}));
    speck = clamp(speck * green * specks * 0.22 * terrainGroundStrength, 0.0, 1.0);
    tint *= mix(vec3(1.0), ${glslVec3(SOIL)} / max(base, vec3(0.001)), speck);
    // Sunlit turf reads lime when a palette green is lit at full strength; mute it a little.
    vec3 muted = mix(vec3(dot(base, vec3(0.2126, 0.7152, 0.0722))), base, ${(1 - MUTE).toFixed(2)});
    tint *= mix(vec3(1.0), muted / max(base, vec3(0.001)), clamp(green * terrainGroundStrength, 0.0, 1.0));
    relief = ((nFine - 0.5) * ${RELIEF[0].toFixed(3)} * fine +
      (nClump - 0.5) * ${(RELIEF[1] * 0.75).toFixed(3)} * clump +
      (nGrain - 0.5) * ${RELIEF[1].toFixed(3)} * grain +
      (nMicro - 0.5) * ${RELIEF[2].toFixed(3)} * micro +
      (nNano - 0.5) * ${(RELIEF[2] * 0.5).toFixed(3)} * nano) * terrainGroundStrength * (0.4 + 0.6 * green);
    return lum * tint;
  }

  // Unparametrized bump mapping (Mikkelsen), with unnormalized screen derivatives so the relief
  // keeps its metric slope at every distance.
  vec3 terrainGroundBump(vec3 position, vec3 normal, float relief, float facing) {
    vec3 sx = dFdx(position);
    vec3 sy = dFdy(position);
    vec3 r1 = cross(sy, normal);
    vec3 r2 = cross(normal, sx);
    float det = dot(sx, r1) * facing;
    vec3 slope = sign(det) * (dFdx(relief) * r1 + dFdy(relief) * r2);
    return normalize(abs(det) * normal - slope);
  }
`;

type Tsl = typeof import('three/tsl');

/** The GLSL hash and value noise above, as TSL nodes. */
function tslNoise(tsl: Tsl): {
  hash: (cell: Node<'vec2'>, period: number) => Node<'float'>;
  noise: (p: Node<'vec2'>, size: number) => Node<'float'>;
} {
  const { dot, floor, fract, mix, vec2, vec3 } = tsl;
  type F = Node<'float'>;
  type V2 = Node<'vec2'>;
  const hash = (cell: V2, period: number): F => {
    const c = cell.sub(floor(cell.div(period)).mul(period));
    const p = fract(vec3(c.x, c.y, c.x).mul(0.1031));
    const q = p.add(dot(p, p.yzx.add(33.33)));
    return fract(q.x.add(q.y).mul(q.z)) as unknown as F;
  };
  const noise = (p: V2, size: number): F => {
    const period = PERIOD / size;
    const q = p.div(size);
    const i = floor(q);
    const f = q.sub(i);
    const u = f.mul(f).mul(f.mul(-2).add(3));
    const a = hash(i, period);
    const b = hash(i.add(vec2(1, 0)), period);
    const c = hash(i.add(vec2(0, 1)), period);
    const d = hash(i.add(vec2(1, 1)), period);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) as unknown as F;
  };
  return { hash, noise };
}

function parameters(options: TerrainGroundMaterialOptions): THREE.MeshStandardMaterialParameters {
  return { vertexColors: true, roughness: options.roughness ?? 0.97, metalness: 0 };
}

function strength(options: { strength?: number }): number {
  const value = options.strength ?? 1;
  if (!Number.isFinite(value) || value < 0 || value > 2)
    throw new RangeError('Ground variation strength must be between 0 and 2');
  return value;
}

/** WebGL ground: a standard vertex-color material with the variation in its shader hooks. */
export function createTerrainGroundMaterial(
  options: TerrainGroundMaterialOptions = {},
): THREE.MeshStandardMaterial {
  const state: TerrainGroundState = {
    origin: { value: new THREE.Vector2() },
    strength: { value: strength(options) },
  };
  const material = new THREE.MeshStandardMaterial(parameters(options));
  material.name = 'terrain-ground';
  material.onBeforeCompile = (shader): void => {
    Object.assign(shader.uniforms, {
      terrainGroundOrigin: state.origin,
      terrainGroundStrength: state.strength,
    });
    shader.vertexShader = `
      ${options.agriculture ? 'attribute vec4 agricultureRows; attribute vec3 agricultureSoil; attribute vec4 landcoverBlend; varying vec4 vAgricultureRows; varying vec3 vAgricultureSoil; varying vec4 vLandcoverBlend;' : ''}
      varying vec2 vTerrainGround;
      uniform vec2 terrainGroundOrigin;
    ${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vTerrainGround = (modelMatrix * vec4(transformed, 1.0)).xz + terrainGroundOrigin;
       ${options.agriculture ? 'vAgricultureRows = agricultureRows; vAgricultureSoil = agricultureSoil; vLandcoverBlend = landcoverBlend;' : ''}`,
    );
    shader.fragmentShader = `${GLSL}
      ${options.agriculture ? 'varying vec4 vAgricultureRows; varying vec3 vAgricultureSoil; varying vec4 vLandcoverBlend;' : ''}
    ${shader.fragmentShader}`
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
       float terrainGroundDistance = length(vViewPosition);
       ${
         options.agriculture
           ? `
       diffuseColor.rgb = mix(diffuseColor.rgb, vLandcoverBlend.yzw,
         terrainGroundEdge(vLandcoverBlend.x, terrainGroundDistance));
       float phase = vAgricultureRows.x;
       float rowFade = 1.0 - smoothstep(0.18, 0.65, fwidth(phase));
       float band = 1.0 - smoothstep(0.15, 0.36, abs(fract(phase) - 0.5));
       float coverage = mix(0.6, band, rowFade) * vAgricultureRows.w * clamp(vAgricultureRows.y / 3.0, 0.0, 1.0);
       vec3 fieldColor = mix(vAgricultureSoil, diffuseColor.rgb, coverage);
       float strip = (fract(phase / 8.0) < 0.5 ? 0.97 : 1.03);
       strip = mix(1.0, strip, 1.0 - smoothstep(0.18, 0.65, fwidth(phase / 8.0)));
       diffuseColor.rgb = mix(diffuseColor.rgb, fieldColor * strip, vAgricultureRows.z);`
           : ''
}
       float terrainGroundRelief = 0.0;
       diffuseColor.rgb *= terrainGroundFactor(diffuseColor.rgb, terrainGroundDistance, terrainGroundRelief);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
       normal = terrainGroundBump(-vViewPosition, normal, terrainGroundRelief, faceDirection);`,
      );
  };
  material.customProgramCacheKey = (): string =>
    `terrain-ground@13:${options.agriculture === true}`;
  states.set(material, state);
  return material;
}

/**
 * Ground for an initialized renderer's backend. WebGPU does not run onBeforeCompile hooks, so
 * that path builds the same variation as TSL nodes; node modules load only when selected.
 */
export async function createTerrainGroundMaterialAsync(
  options: TerrainGroundMaterialOptions = {},
  backend: 'webgl' | 'webgpu' = 'webgl',
): Promise<TerrainGroundMaterial> {
  if (backend === 'webgl') return createTerrainGroundMaterial(options);
  const [{ MeshStandardNodeMaterial }, tsl] = await Promise.all([
    import('three/webgpu'),
    import('three/tsl'),
  ]);
  const {
    clamp,
    dot,
    Fn,
    fract,
    If,
    materialColor,
    max,
    mix,
    positionView,
    positionWorld,
    normalView,
    faceDirection,
    smoothstep,
    uniform,
    vec2,
    vec3,
    vec4,
    vertexColor,
    attribute,
    varying,
    fwidth,
    abs,
    step,
    dFdx,
    dFdy,
    cross,
    sign,
    normalize,
  } = tsl;
  type F = Node<'float'>;
  type V2 = Node<'vec2'>;
  type V3 = Node<'vec3'>;
  const { noise } = tslNoise(tsl);
  const origin = uniform(new THREE.Vector2()).setName('terrainGroundOrigin');
  const amount = uniform(strength(options)).setName('terrainGroundStrength');
  const p = positionWorld.xz.add(origin).toVar() as unknown as V2;
  const distance = positionView.length().toVar();
  const footprint = max(max(dFdx(p).length(), dFdy(p).length()), 0.0001).toVar();
  const fade = (cell: number): F =>
    smoothstep(0.25, 0.6, footprint.div(cell)).oneMinus() as unknown as F;
  const nano = fade(NANO);
  const blade = fade(BLADE);
  const micro = fade(MICRO);
  const grain = fade(GRAIN);
  const fine = fade(FINE);
  const clump = fade(CLUMP);
  const specks = fade(SPECK);
  const mid = smoothstep(500, 2000, distance).oneMinus();
  const broad = smoothstep(5000, 15000, distance).oneMinus();
  const nFine = noise(p, FINE).toVar();
  // Tufts and speckle, on coordinates gently warped by a 2 m field so the noise lattice never
  // shows (the warp is periodic too, so rebases keep the pattern); strongest on vegetated
  // ground. The finest layers use a grid turned 45 degrees, (x + y, y - x), which stays
  // periodic and is sqrt(2) finer, so no two layers' lattices line up.
  // Each finer layer only where it still shows: past its fade every term it feeds is zero, so
  // most of a distant view skips these noise lookups (and the warp) entirely.
  const octaves = Fn(() => {
    const result = vec4(0.5).toVar();
    // Clumps between the 4 m patches and the 1 m grain, so mid-distance turf keeps texture
    // after the finer layers have faded.
    If(clump.greaterThan(0), () => {
      result.w.assign(noise(p.add(vec2(0.37, 1.13)) as unknown as V2, CLUMP));
    });
    If(grain.greaterThan(0), () => {
      const w = p
        .add(
          vec2(
            noise(p.add(vec2(17, 3)) as unknown as V2, 2),
            noise(p.add(vec2(5, 41)) as unknown as V2, 2),
          )
            .sub(0.5)
            .mul(WARP),
        )
        .toVar() as unknown as V2;
      const turned = vec2(w.x.add(w.y), w.y.sub(w.x)).toVar() as unknown as V2;
      result.x.assign(noise(w, GRAIN));
      If(micro.greaterThan(0), () => {
        result.y.assign(smoothstep(0.1, 0.9, noise(turned, MICRO * 2)));
        If(nano.greaterThan(0), () => {
          result.z.assign(
            smoothstep(0.15, 0.85, noise(turned.add(vec2(0.37, 0.71)) as unknown as V2, NANO * 2)),
          );
          If(blade.greaterThan(0), () => {
            result.z.addAssign(
              smoothstep(0.2, 0.8, noise(turned.add(vec2(0.71, 0.13)) as unknown as V2, BLADE * 2))
                .sub(0.5)
                .mul(0.8)
                .mul(blade),
            );
          });
        });
      });
    });
    return result;
  })().toVar() as unknown as Node<'vec4'>;
  const nGrain = octaves.x;
  const nMicro = octaves.y;
  const nNano = octaves.z;
  const nClump = octaves.w;
  const vertex = vertexColor().rgb;
  // The node renderer multiplies colorNode by the vertex color itself (vertexColors stays on),
  // so everything below is a factor over it; `base` is the color that factor is judged against.
  let base: V3 = vertex as unknown as V3;
  let factor: V3 = vec3(1) as unknown as V3;
  const tuft = fade(TUFT);
  const speckle = fade(BLADE * 2);
  if (options.agriculture) {
    const blend = varying(attribute('landcoverBlend', 'vec4')) as unknown as Node<'vec4'>;
    // Up close, half-meter tufts and then blade-scale specks break the contour, so one class
    // thins into the other rather than ending on a smooth blob outline or in blob islands.
    let n = noise(p.add(vec2(57, 211)), EDGE)
      .mul(0.66)
      .add(noise(p.add(vec2(13, 97)), FRINGE).mul(0.24))
      .add(mix(0.5, noise(p.add(vec2(31, 5)), TUFT), tuft).mul(0.04))
      .add(mix(0.5, noise(p.add(vec2(19, 7)), BLADE * 2), speckle).mul(0.06));
    n = clamp(n.sub(0.5).mul(1.7).add(0.5), 0, 1) as unknown as F;
    const edge = blend.x.mul(1.24).sub(0.12);
    const organic = smoothstep(edge.sub(0.16), edge.add(0.16), n).oneMinus();
    const cover = mix(blend.x, organic, smoothstep(200, 700, distance).oneMinus());
    const blended = mix(base, blend.yzw, cover).toVar() as unknown as V3;
    factor = factor.mul(blended.div(max(base, vec3(0.001)))) as unknown as V3;
    base = blended;
    const rows = varying(attribute('agricultureRows', 'vec4')) as unknown as Node<'vec4'>;
    const soil = varying(attribute('agricultureSoil', 'vec3')) as unknown as Node<'vec3'>;
    const phase = rows.x;
    const fade = smoothstep(0.18, 0.65, fwidth(phase)).oneMinus();
    const band = smoothstep(0.15, 0.36, abs(fract(phase).sub(0.5))).oneMinus();
    const coverage = mix(0.6, band, fade)
      .mul(rows.w)
      .mul(clamp(rows.y.div(3), 0, 1));
    const strip = mix(
      1,
      step(0.5, fract(phase.div(8)))
        .mul(0.06)
        .add(0.97),
      smoothstep(0.18, 0.65, fwidth(phase.div(8))).oneMinus(),
    );
    const field = mix(soil, base, coverage).mul(strip);
    const planted = mix(base, field, rows.z).toVar() as unknown as V3;
    factor = factor.mul(planted.div(max(base, vec3(0.001)))) as unknown as V3;
    base = planted;
  }
  const green = clamp(base.g.sub(max(base.r, base.b)).mul(10), 0, 1).toVar();
  const turf = green.mul(0.55).add(0.45);
  const mottle = noise(p, BROAD)
    .sub(0.5)
    .mul(0.55)
    .mul(broad)
    .add(noise(p, MID).sub(0.5).mul(0.35).mul(mid))
    .add(nFine.sub(0.5).mul(0.35).mul(fine))
    .add(nClump.sub(0.5).mul(0.55).mul(clump).mul(turf))
    .add(nGrain.sub(0.5).mul(0.9).mul(grain).mul(turf))
    .add(nMicro.sub(0.5).mul(0.8).mul(micro).mul(turf))
    .add(nNano.sub(0.5).mul(0.7).mul(nano).mul(turf));
  const lum = mottle.mul(MOTTLE).mul(amount).add(1);
  const area = noise(p.add(vec2(311, 173)), PATCH);
  const dry = clamp(smoothstep(0.5, 0.78, area).mul(green).mul(broad).mul(0.3).mul(amount), 0, 1);
  const lush = clamp(
    smoothstep(0.22, 0.45, area).oneMinus().mul(green).mul(broad).mul(0.35).mul(amount),
    0,
    1,
  );
  const hue = noise(p.add(vec2(71, 29)), HUE);
  const drift = mix(
    vec3(1),
    mix(vec3(...WARM), vec3(...COOL), hue),
    clamp(green.mul(mid).mul(0.6).mul(amount), 0, 1),
  );
  const speck = clamp(
    smoothstep(0.68, 0.82, noise(p.add(vec2(5, 143)), SPECK))
      .mul(green)
      .mul(specks)
      .mul(0.22)
      .mul(amount),
    0,
    1,
  );
  const bare = mix(vec3(1), vec3(...SOIL).div(max(base, vec3(0.001))), speck);
  // Sunlit turf reads lime when a palette green is lit at full strength; mute it a little.
  const muted = mix(vec3(dot(base, vec3(0.2126, 0.7152, 0.0722))), base, 1 - MUTE).div(
    max(base, vec3(0.001)),
  );
  const tint = mix(vec3(1), vec3(...DRY), dry)
    .mul(mix(vec3(1), vec3(...LUSH), lush))
    .mul(drift)
    .mul(bare)
    .mul(mix(vec3(1), muted, clamp(green.mul(amount), 0, 1)));
  factor = factor.mul(tint.mul(lum)) as unknown as V3;
  const relief = nFine
    .sub(0.5)
    .mul(RELIEF[0])
    .mul(fine)
    .add(
      nClump
        .sub(0.5)
        .mul(RELIEF[1] * 0.75)
        .mul(clump),
    )
    .add(nGrain.sub(0.5).mul(RELIEF[1]).mul(grain))
    .add(nMicro.sub(0.5).mul(RELIEF[2]).mul(micro))
    .add(
      nNano
        .sub(0.5)
        .mul(RELIEF[2] * 0.5)
        .mul(nano),
    )
    .mul(amount)
    .mul(green.mul(0.6).add(0.4))
    .toVar() as unknown as F;
  const material = new MeshStandardNodeMaterial(parameters(options));
  material.name = 'terrain-ground';
  const color = materialColor as unknown as Node<'vec4'>;
  material.colorNode = vec4(color.rgb.mul(factor), color.a);
  // Unparametrized bump mapping (Mikkelsen) with metric, unnormalized screen derivatives.
  const sx = dFdx(positionView) as unknown as V3;
  const sy = dFdy(positionView) as unknown as V3;
  const r1 = cross(sy, normalView) as unknown as V3;
  const r2 = cross(normalView, sx) as unknown as V3;
  const det = dot(sx, r1).mul(faceDirection as unknown as F) as unknown as F;
  // The typings list vector overloads only; the derivative of a float node is a float.
  const dx = dFdx(relief as unknown as V3) as unknown as F;
  const dy = dFdy(relief as unknown as V3) as unknown as F;
  const slope = r1.mul(dx).add(r2.mul(dy)).mul(sign(det)) as unknown as V3;
  material.normalNode = normalize(normalView.mul(abs(det)).sub(slope));
  states.set(material, { origin, strength: amount });
  return material;
}

/** Options for the draped road, sidewalk, marking and lot material. */
export interface TerrainPavementMaterialOptions {
  roughness?: number;
  /** Detail amount: 0 is the flat vertex color, 1 the default, up to 2. */
  strength?: number;
}

/** Widest ragged margin where a paved band, or a loose one (dirt, gravel), meets the ground. */
const FRAY = 0.03;
const LOOSE_FRAY = 0.06;

/**
 * `surfaceDetail` kinds written by draped road bands and areas (see `TERRAIN_SURFACE_KIND`). The
 * attribute's z packs `kind * 128 + band width`, x is the distance along the band and y the
 * offset across it from its edge. w is a road's lane width (0 when unknown); for other kinds it
 * marks the edges that fray into the ground (1: across 0, 2: across the full width, 3: both).
 */
const PAVEMENT_GLSL = /* glsl */ `
  varying vec4 vSurfaceDetail;

  // A periodic line across a band coordinate, antialiased and faded once it is sub-pixel.
  float terrainPavementLine(float coord, float spacing, float halfWidth) {
    float d = abs(fract(coord / spacing + 0.5) - 0.5) * spacing;
    float aa = max(fwidth(coord), 0.0001);
    return (1.0 - smoothstep(halfWidth, halfWidth + aa, d)) * (1.0 - smoothstep(0.03, 0.12, aa));
  }

  float terrainPavementBox(vec2 local, vec2 low, vec2 high, float aa) {
    vec2 inside = clamp((local - low) / aa + 0.5, 0.0, 1.0) * clamp((high - local) / aa + 0.5, 0.0, 1.0);
    return inside.x * inside.y;
  }

  // rgb: the detail factor; a: meters inside the band's frayed edge (negative is ground).
  vec4 terrainPavementFactor(vec3 base) {
    vec2 p = vTerrainGround;
    float code = vSurfaceDetail.z;
    float kind = floor(code / 128.0 + 0.001);
    float along = vSurfaceDetail.x;
    float across = vSurfaceDetail.y;
    float lane = vSurfaceDetail.w;
    float footprint = max(max(length(dFdx(p)), length(dFdy(p))), 0.0001);
    float close = 1.0 - smoothstep(0.25, 0.6, footprint / 0.25);
    float near = 1.0 - smoothstep(0.25, 0.6, footprint / 1.0);
    float mid = 1.0 - smoothstep(0.25, 0.6, footprint / 4.0);
    // Aggregate a few centimeters across at eye level, then quarter-meter and meter grain.
    float pebble = 1.0 - smoothstep(0.25, 0.6, footprint / 0.0625);
    float grain = (terrainGroundNoise(p, 0.0625) - 0.5) * 0.8 * pebble +
      (terrainGroundNoise(p, 0.25) - 0.5) * close +
      (terrainGroundNoise(p, 1.0) - 0.5) * 0.7 * near;
    float blotch = (terrainGroundNoise(p, 4.0) - 0.5) * mid +
      (terrainGroundNoise(p, 16.0) - 0.5) * 0.8;
    float isRoad = 1.0 - step(0.5, abs(kind - 1.0));
    float isSidewalk = 1.0 - step(0.5, abs(kind - 2.0));
    float isCurb = 1.0 - step(0.5, abs(kind - 3.0));
    float isPaint = 1.0 - step(0.5, abs(kind - 4.0));
    float isParking = 1.0 - step(0.5, abs(kind - 5.0));
    float isPlaza = 1.0 - step(0.5, abs(kind - 6.0));
    float isLoose = step(6.5, kind);
    float isAsphalt = isRoad + isParking;
    float isConcrete = isSidewalk + isCurb;
    float aa = max(fwidth(along), 0.0001);
    // Asphalt: aggregate and patchy wear, polished wheel tracks, an oil line down each lane and
    // the odd darker repaired section, all fading to the plain swatch with distance.
    float q = fract(across / max(lane, 0.5));
    float tracks = exp(-pow((q - 0.27) / 0.075, 2.0)) + exp(-pow((q - 0.73) / 0.075, 2.0));
    float drip = exp(-pow((q - 0.5) / 0.06, 2.0)) *
      smoothstep(0.35, 0.75, terrainGroundNoise(p + vec2(41.0, 9.0), 2.0));
    vec2 patchCell = vec2(floor(along / 9.0), floor(across / max(lane, 0.5)));
    float patchPick = terrainGroundHash(patchCell + vec2(17.0, 5.0), 65536.0);
    vec2 patchLocal = vec2(along - patchCell.x * 9.0, across - patchCell.y * max(lane, 0.5));
    float repair = step(0.8, patchPick) * terrainPavementBox(patchLocal,
      vec2(1.0 + patchPick * 2.0, 0.3), vec2(6.5 + patchPick * 2.0, max(lane, 0.5) - 0.3), aa);
    float wear = isRoad * step(0.5, lane) * mid * (0.16 * tracks + 0.12 * drip + 0.06 * repair);
    // Grit and oil collect along a road's edges, in the gutters.
    float width = code - kind * 128.0;
    float gutter = isRoad * mid * (1.0 - smoothstep(0.0, 0.6, min(across, width - across)));
    float stains = isParking * mid * 0.24 * smoothstep(0.62, 0.86,
      terrainGroundNoise(p + vec2(31.0, 7.0), 2.0) * 0.6 + terrainGroundNoise(p + vec2(9.0, 47.0), 1.0) * 0.4);
    float asphalt = (1.0 + grain * 0.24 + blotch * 0.26) * (1.0 - wear) * (1.0 - stains) *
      (1.0 - 0.22 * gutter);
    // Concrete: slabs with saw-cut joints (1.5 m sidewalk, 3 m curb), each slab its own tone.
    float slab = isSidewalk * 1.5 + isCurb * 3.0 + (1.0 - isConcrete) * 1.5;
    float joint = terrainPavementLine(along, slab, 0.009);
    float slabTone = terrainGroundHash(vec2(floor(along / slab), 3.0 + isCurb), 65536.0);
    float concrete = (0.95 + slabTone * 0.09) * (1.0 + grain * 0.12 + blotch * 0.1) *
      (1.0 - 0.34 * joint);
    // Pavers: a half-meter grid in world space.
    float pavers = max(terrainPavementLine(p.x, 0.5, 0.006), terrainPavementLine(p.y, 0.5, 0.006));
    float paverTone = terrainGroundHash(floor(p / 0.5), 8192.0);
    float plaza = (0.94 + paverTone * 0.1) * (1.0 - 0.3 * pavers) * (1.0 + grain * 0.1);
    // Paint wears through to the asphalt beneath in patches.
    float worn = smoothstep(0.52, 0.8, terrainGroundNoise(p, 0.5) * 0.6 +
      terrainGroundNoise(p + vec2(3.0, 61.0), 0.25) * 0.4) * 0.6 * near;
    vec3 paint = mix(vec3(1.0), vec3(0.032, 0.036, 0.04) / max(base, vec3(0.001)), worn) *
      (0.97 + grain * 0.08);
    float loose = 1.0 + grain * 0.35 + blotch * 0.2;
    float plain = 1.0 + blotch * 0.08;
    float isPlain = 1.0 - clamp(isAsphalt + isConcrete + isPaint + isPlaza + isLoose, 0.0, 1.0);
    // Lived-in detail: hairline cracks in asphalt and concrete, a manhole cover in a lane on most
    // 45 m stretches of road, and storm-drain grates along the gutters.
    float crackField = terrainGroundNoise(p + vec2(23.0, 11.0), 2.0);
    float crackWidth = max(fwidth(crackField) * 1.5, 0.002);
    float crack = (1.0 - smoothstep(0.0, crackWidth, abs(crackField - 0.5))) *
      smoothstep(0.62, 0.8, terrainGroundNoise(p + vec2(5.0, 71.0), 8.0)) * near *
      (isAsphalt + isConcrete);
    float laneMeters = max(lane, 0.5);
    float lanes = max(1.0, floor(width / laneMeters + 0.5));
    float coverCell = floor(along / 45.0);
    float coverPick = terrainGroundHash(vec2(coverCell, 41.0), 65536.0);
    vec2 coverCentre = vec2(coverCell * 45.0 + 8.0 + coverPick * 29.0,
      (floor(terrainGroundHash(vec2(coverCell, 43.0), 65536.0) * lanes) + 0.5) * laneMeters);
    float coverR = length(vec2(along, across) - coverCentre);
    float coverAa = max(fwidth(coverR), 0.004);
    float cover = isRoad * step(0.5, lane) * step(coverPick, 0.7) * near *
      (1.0 - smoothstep(0.34 - coverAa, 0.34 + coverAa, coverR));
    float coverRim = cover * smoothstep(0.27, 0.3, coverR);
    float drainCell = floor(along / 32.0);
    float drainPick = terrainGroundHash(vec2(drainCell, 57.0), 65536.0);
    float drainAlong = along - (drainCell * 32.0 + 6.0 + drainPick * 20.0);
    float drain = isRoad * step(0.5, lane) * step(drainPick, 0.8) * near *
      terrainPavementBox(vec2(drainAlong, min(across, width - across)), vec2(-0.45, 0.05),
        vec2(0.45, 0.42), aa);
    float slats = terrainPavementLine(along, 0.09, 0.022);
    float lived = (1.0 - 0.2 * crack) *
      mix(1.0, 0.58 + 0.12 * coverRim + 0.06 * grain, cover) * mix(1.0, 0.5 - 0.3 * slats, drain);
    float scalar = (isAsphalt * asphalt + isConcrete * concrete + isPlaza * plaza +
      isLoose * loose + isPlain * plain + isPaint) * lived;
    // Frayed edges: where a band meets the ground (a sidewalk's lawn side, a footpath, a shoulder
    // or a dirt track) the ground shows through a ragged margin and dirt collects inside it.
    // Loose surfaces break up in clumps; cast paving keeps its formed edge, and only grass
    // blades creep over it. The margin shrinks away as its noise falls below a pixel, leaving
    // the band's own antialiased edge.
    float soft = vSurfaceDetail.w * (1.0 - isRoad);
    float edge = min(mix(64.0, across, mod(soft, 2.0)), mix(64.0, width - across, step(1.5, soft)));
    float coarse = 1.0 - smoothstep(0.25, 0.6, footprint / 0.8);
    float fine = 1.0 - smoothstep(0.25, 0.6, footprint / 0.2);
    float blade = 1.0 - smoothstep(0.25, 0.6, footprint / 0.05);
    float clump = terrainGroundNoise(p + vec2(13.0, 2.0), 0.2) - 0.5;
    float blades = (terrainGroundNoise(p + vec2(3.0, 31.0), 0.05) - 0.5) * blade;
    float tatter = 0.5 + mix(clump * 0.3 + blades * 1.4,
      (terrainGroundNoise(p + vec2(7.0, 23.0), 0.8) - 0.5) * 0.35 + clump * 0.2 + blades * 1.3,
      isLoose);
    // Farther off, a loose edge wanders over a few meters, by about three pixels (at most half
    // the band), so a dirt track or gravel shoulder never ends on a ruled line at any distance.
    float wander = isLoose * min(clamp(footprint * 2.5, 0.0, 0.6), width * 0.5) *
      (1.0 - smoothstep(0.25, 0.6, footprint / 3.0)) * terrainGroundNoise(p + vec2(29.0, 11.0), 3.0);
    // Underfoot (the last few meters) the margin's cells grow to dozens of pixels and read as
    // torn paper, so it closes back to the band's formed edge there.
    float underfoot = smoothstep(0.002, 0.008, footprint);
    float fray = (clamp(tatter, 0.0, 1.0) * mix(${FRAY.toFixed(2)}, ${LOOSE_FRAY.toFixed(2)}, isLoose) *
      mix(fine, coarse, isLoose) * underfoot + wander) * min(terrainGroundStrength, 1.0);
    float grime = (1.0 - smoothstep(0.0, 0.6, edge - fray)) * step(edge, 63.0) * 0.45;
    vec3 factor = mix(vec3(1.0), (isPaint > 0.5 ? paint : vec3(1.0)) * scalar *
      mix(vec3(1.0), vec3(0.78, 0.82, 0.7), grime), terrainGroundStrength);
    return vec4(factor, edge - fray);
  }
`;

function pavementParameters(
  options: TerrainPavementMaterialOptions,
): THREE.MeshStandardMaterialParameters {
  return {
    vertexColors: true,
    roughness: options.roughness ?? 0.94,
    metalness: 0,
    side: THREE.DoubleSide,
    // The frayed edges' coverage (multisampled renders only; otherwise they are cut at half).
    alphaToCoverage: true,
  };
}

/** WebGL pavement: the standard draped-surface material with band-aware detail in its hooks. */
export function createTerrainPavementMaterial(
  options: TerrainPavementMaterialOptions = {},
): THREE.MeshStandardMaterial {
  const state: TerrainGroundState = {
    origin: { value: new THREE.Vector2() },
    strength: { value: strength(options) },
  };
  const material = new THREE.MeshStandardMaterial(pavementParameters(options));
  material.name = 'terrain-pavement';
  material.onBeforeCompile = (shader): void => {
    Object.assign(shader.uniforms, {
      terrainGroundOrigin: state.origin,
      terrainGroundStrength: state.strength,
    });
    shader.vertexShader = `
      attribute vec4 surfaceDetail;
      varying vec4 vSurfaceDetail;
      varying vec2 vTerrainGround;
      uniform vec2 terrainGroundOrigin;
    ${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vTerrainGround = (modelMatrix * vec4(transformed, 1.0)).xz + terrainGroundOrigin;
       vSurfaceDetail = surfaceDetail;`,
    );
    shader.fragmentShader = `${GLSL}
      ${PAVEMENT_GLSL}
    ${shader.fragmentShader}`.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
       vec4 terrainPavement = terrainPavementFactor(diffuseColor.rgb);
       // Coverage ramps across about a pixel at the frayed edge, so with multisampling alpha to
       // coverage antialiases the ragged margin instead of stair-stepping it.
       float terrainFray = terrainPavement.a / max(fwidth(terrainPavement.a), 0.0001);
       if (terrainFray < -0.5) discard;
       diffuseColor.a *= clamp(terrainFray + 0.5, 0.0, 1.0);
       diffuseColor.rgb *= terrainPavement.rgb;`,
    );
  };
  material.customProgramCacheKey = (): string => 'terrain-pavement@14';
  states.set(material, state);
  return material;
}

/** Pavement for an initialized renderer's backend; WebGPU builds the same detail as TSL nodes. */
export async function createTerrainPavementMaterialAsync(
  options: TerrainPavementMaterialOptions = {},
  backend: 'webgl' | 'webgpu' = 'webgl',
): Promise<TerrainGroundMaterial> {
  if (backend === 'webgl') return createTerrainPavementMaterial(options);
  const [{ MeshStandardNodeMaterial }, tsl] = await Promise.all([
    import('three/webgpu'),
    import('three/tsl'),
  ]);
  const {
    abs,
    attribute,
    clamp,
    exp,
    floor,
    fract,
    dFdx,
    dFdy,
    fwidth,
    materialColor,
    max,
    min,
    mix,
    positionWorld,
    pow,
    smoothstep,
    step,
    uniform,
    varying,
    vec2,
    vec3,
    vec4,
    vertexColor,
  } = tsl;
  type F = Node<'float'>;
  type V2 = Node<'vec2'>;
  const { hash, noise } = tslNoise(tsl);
  const origin = uniform(new THREE.Vector2()).setName('terrainGroundOrigin');
  const amount = uniform(strength(options)).setName('terrainGroundStrength');
  const detail = varying(attribute('surfaceDetail', 'vec4')).toVar() as unknown as Node<'vec4'>;
  const p = positionWorld.xz.add(origin).toVar() as unknown as V2;
  const base = vertexColor().rgb;
  const kind = floor(detail.z.div(128).add(0.001)).toVar() as unknown as F;
  const along = detail.x.toVar() as unknown as F;
  const across = detail.y;
  const lane = detail.w;
  const footprint = max(max(dFdx(p).length(), dFdy(p).length()), 0.0001).toVar();
  const close = smoothstep(0.25, 0.6, footprint.div(0.25)).oneMinus();
  const near = smoothstep(0.25, 0.6, footprint.div(1)).oneMinus();
  const mid = smoothstep(0.25, 0.6, footprint.div(4)).oneMinus();
  // Aggregate a few centimeters across at eye level, then quarter-meter and meter grain.
  const pebble = smoothstep(0.25, 0.6, footprint.div(0.0625)).oneMinus();
  const grain = noise(p, 0.0625)
    .sub(0.5)
    .mul(0.8)
    .mul(pebble)
    .add(noise(p, 0.25).sub(0.5).mul(close))
    .add(noise(p, 1).sub(0.5).mul(0.7).mul(near))
    .toVar() as unknown as F;
  const blotch = noise(p, 4)
    .sub(0.5)
    .mul(mid)
    .add(noise(p, 16).sub(0.5).mul(0.8))
    .toVar() as unknown as F;
  const is = (k: number): F => step(0.5, abs(kind.sub(k))).oneMinus() as unknown as F;
  const isRoad = is(1);
  const isSidewalk = is(2);
  const isCurb = is(3);
  const isPaint = is(4);
  const isParking = is(5);
  const isPlaza = is(6);
  const isLoose = step(6.5, kind);
  const isAsphalt = isRoad.add(isParking);
  const isConcrete = isSidewalk.add(isCurb);
  const aa = max(fwidth(along), 0.0001);
  const line = (coord: F, spacing: number | F, half: number): F => {
    const d = abs(fract(coord.div(spacing).add(0.5)).sub(0.5)).mul(spacing);
    const w = max(fwidth(coord), 0.0001);
    return smoothstep(half, w.add(half), d)
      .oneMinus()
      .mul(smoothstep(0.03, 0.12, w).oneMinus()) as unknown as F;
  };
  const laneWidth = max(lane, 0.5);
  const q = fract(across.div(laneWidth));
  const bump = (x: F, at: number, width: number): F =>
    exp(pow(x.sub(at).div(width), 2).negate()) as unknown as F;
  const tracks = bump(q as unknown as F, 0.27, 0.075).add(bump(q as unknown as F, 0.73, 0.075));
  const drip = bump(q as unknown as F, 0.5, 0.06).mul(
    smoothstep(0.35, 0.75, noise(p.add(vec2(41, 9)) as unknown as V2, 2)),
  );
  const patchCell = vec2(floor(along.div(9)), floor(across.div(laneWidth)));
  const patchPick = hash(patchCell.add(vec2(17, 5)) as unknown as V2, 65536);
  const patchLocal = vec2(along.sub(patchCell.x.mul(9)), across.sub(patchCell.y.mul(laneWidth)));
  const low = vec2(patchPick.mul(2).add(1), 0.3);
  const high = vec2(patchPick.mul(2).add(6.5), laneWidth.sub(0.3));
  const inside = clamp(patchLocal.sub(low).div(aa).add(0.5), 0, 1).mul(
    clamp(high.sub(patchLocal).div(aa).add(0.5), 0, 1),
  );
  const repair = step(0.8, patchPick).mul(inside.x).mul(inside.y);
  const wear = isRoad
    .mul(step(0.5, lane))
    .mul(mid)
    .mul(tracks.mul(0.16).add(drip.mul(0.12)).add(repair.mul(0.06)));
  // Grit and oil collect along a road's edges, in the gutters.
  const width = detail.z.sub(kind.mul(128)).toVar() as unknown as F;
  const gutter = isRoad.mul(mid).mul(smoothstep(0, 0.6, min(across, width.sub(across))).oneMinus());
  const stains = isParking
    .mul(mid)
    .mul(0.24)
    .mul(
      smoothstep(
        0.62,
        0.86,
        noise(p.add(vec2(31, 7)) as unknown as V2, 2)
          .mul(0.6)
          .add(noise(p.add(vec2(9, 47)) as unknown as V2, 1).mul(0.4)),
      ),
    );
  const asphalt = grain
    .mul(0.24)
    .add(blotch.mul(0.26))
    .add(1)
    .mul(wear.oneMinus())
    .mul(stains.oneMinus())
    .mul(gutter.mul(0.22).oneMinus());
  const slab = isSidewalk.mul(1.5).add(isCurb.mul(3)).add(isConcrete.oneMinus().mul(1.5));
  const joint = line(along, slab as unknown as F, 0.009);
  const slabTone = hash(vec2(floor(along.div(slab)), isCurb.add(3)) as unknown as V2, 65536);
  const concrete = slabTone
    .mul(0.09)
    .add(0.95)
    .mul(grain.mul(0.12).add(blotch.mul(0.1)).add(1))
    .mul(joint.mul(0.34).oneMinus());
  const pavers = max(line(p.x as unknown as F, 0.5, 0.006), line(p.y as unknown as F, 0.5, 0.006));
  const paverTone = hash(floor(p.div(0.5)) as unknown as V2, 8192);
  const plaza = paverTone
    .mul(0.1)
    .add(0.94)
    .mul(pavers.mul(0.3).oneMinus())
    .mul(grain.mul(0.1).add(1));
  const worn = smoothstep(
    0.52,
    0.8,
    noise(p, 0.5)
      .mul(0.6)
      .add(noise(p.add(vec2(3, 61)) as unknown as V2, 0.25).mul(0.4)),
  )
    .mul(0.6)
    .mul(near);
  const paint = mix(vec3(1), vec3(0.032, 0.036, 0.04).div(max(base, vec3(0.001))), worn).mul(
    grain.mul(0.08).add(0.97),
  );
  const loose = grain.mul(0.35).add(blotch.mul(0.2)).add(1);
  const plain = blotch.mul(0.08).add(1);
  const isPlain = clamp(
    isAsphalt.add(isConcrete).add(isPaint).add(isPlaza).add(isLoose),
    0,
    1,
  ).oneMinus();
  // Lived-in detail: hairline cracks in asphalt and concrete, a manhole cover in a lane on most
  // 45 m stretches of road, and storm-drain grates along the gutters.
  const crackField = noise(p.add(vec2(23, 11)) as unknown as V2, 2).toVar() as unknown as F;
  const crackWidth = max(fwidth(crackField).mul(1.5), 0.002);
  const crack = smoothstep(0, crackWidth, abs(crackField.sub(0.5)))
    .oneMinus()
    .mul(smoothstep(0.62, 0.8, noise(p.add(vec2(5, 71)) as unknown as V2, 8)))
    .mul(near)
    .mul(isAsphalt.add(isConcrete));
  const lanes = max(1, floor(width.div(laneWidth).add(0.5)));
  const coverCell = floor(along.div(45));
  const coverPick = hash(vec2(coverCell, 41) as unknown as V2, 65536);
  const coverCentre = vec2(
    coverCell.mul(45).add(8).add(coverPick.mul(29)),
    floor(hash(vec2(coverCell, 43) as unknown as V2, 65536).mul(lanes))
      .add(0.5)
      .mul(laneWidth),
  );
  const coverR = vec2(along, across).sub(coverCentre).length().toVar() as unknown as F;
  const coverAa = max(fwidth(coverR), 0.004);
  const cover = isRoad
    .mul(step(0.5, lane))
    .mul(step(coverPick, 0.7))
    .mul(near)
    .mul(smoothstep(coverAa.negate().add(0.34), coverAa.add(0.34), coverR).oneMinus());
  const coverRim = cover.mul(smoothstep(0.27, 0.3, coverR));
  const drainCell = floor(along.div(32));
  const drainPick = hash(vec2(drainCell, 57) as unknown as V2, 65536);
  const drainLocal = vec2(
    along.sub(drainCell.mul(32).add(6).add(drainPick.mul(20))),
    min(across, width.sub(across)),
  );
  const drainInside = clamp(drainLocal.sub(vec2(-0.45, 0.05)).div(aa).add(0.5), 0, 1).mul(
    clamp(vec2(0.45, 0.42).sub(drainLocal).div(aa).add(0.5), 0, 1),
  );
  const drain = isRoad
    .mul(step(0.5, lane))
    .mul(step(drainPick, 0.8))
    .mul(near)
    .mul(drainInside.x)
    .mul(drainInside.y);
  const slats = line(along, 0.09, 0.022);
  const lived = crack
    .mul(0.2)
    .oneMinus()
    .mul(mix(1, coverRim.mul(0.12).add(grain.mul(0.06)).add(0.58), cover))
    .mul(mix(1, slats.mul(-0.3).add(0.5), drain));
  const scalar = isAsphalt
    .mul(asphalt)
    .add(isConcrete.mul(concrete))
    .add(isPlaza.mul(plaza))
    .add(isLoose.mul(loose))
    .add(isPlain.mul(plain))
    .add(isPaint)
    .mul(lived);
  // Frayed edges: where a band meets the ground (a sidewalk's lawn side, a footpath, a shoulder
  // or a dirt track) the ground shows through a ragged margin and dirt collects inside it.
  // Loose surfaces break up in clumps; cast paving keeps its formed edge, and only grass
  // blades creep over it. The margin shrinks away as its noise falls below a pixel, leaving
  // the band's own antialiased edge.
  const soft = lane.mul(isRoad.oneMinus());
  const edge = min(
    mix(64, across, soft.mod(2)),
    mix(64, width.sub(across), step(1.5, soft)),
  ).toVar() as unknown as F;
  const coarse = smoothstep(0.25, 0.6, footprint.div(0.8)).oneMinus();
  const fine = smoothstep(0.25, 0.6, footprint.div(0.2)).oneMinus();
  const blade = smoothstep(0.25, 0.6, footprint.div(0.05)).oneMinus();
  const clump = noise(p.add(vec2(13, 2)) as unknown as V2, 0.2).sub(0.5);
  const blades = noise(p.add(vec2(3, 31)) as unknown as V2, 0.05)
    .sub(0.5)
    .mul(blade);
  const tatter = mix(
    clump.mul(0.3).add(blades.mul(1.4)),
    noise(p.add(vec2(7, 23)) as unknown as V2, 0.8)
      .sub(0.5)
      .mul(0.35)
      .add(clump.mul(0.2))
      .add(blades.mul(1.3)),
    isLoose,
  ).add(0.5);
  // Farther off, a loose edge wanders over a few meters, by about three pixels (at most half
  // the band), so a dirt track or gravel shoulder never ends on a ruled line at any distance.
  const wander = isLoose
    .mul(min(clamp(footprint.mul(2.5), 0, 0.6), width.mul(0.5)))
    .mul(smoothstep(0.25, 0.6, footprint.div(3)).oneMinus())
    .mul(noise(p.add(vec2(29, 11)) as unknown as V2, 3));
  // Underfoot (the last few meters) the margin's cells grow to dozens of pixels and read as
  // torn paper, so it closes back to the band's formed edge there.
  const fray = clamp(tatter, 0, 1)
    .mul(mix(FRAY, LOOSE_FRAY, isLoose))
    .mul(mix(fine, coarse, isLoose))
    .mul(smoothstep(0.002, 0.008, footprint))
    .add(wander)
    .mul(min(amount, 1))
    .toVar() as unknown as F;
  const grime = smoothstep(0, 0.6, edge.sub(fray)).oneMinus().mul(step(edge, 63)).mul(0.45);
  const factor = mix(
    vec3(1),
    mix(vec3(1), paint, isPaint)
      .mul(scalar)
      .mul(mix(vec3(1), vec3(0.78, 0.82, 0.7), grime)),
    amount,
  );
  const material = new MeshStandardNodeMaterial(pavementParameters(options));
  material.name = 'terrain-pavement';
  const color = materialColor as unknown as Node<'vec4'>;
  material.colorNode = vec4(color.rgb.mul(factor), color.a);
  // Coverage ramps across about a pixel at the frayed edge, so with multisampling alpha to
  // coverage antialiases the ragged margin instead of stair-stepping it.
  const margin = edge.sub(fray).toVar() as unknown as F;
  const coverage = margin.div(max(fwidth(margin), 0.0001)).toVar() as unknown as F;
  material.maskNode = coverage.greaterThan(-0.5);
  material.opacityNode = clamp(coverage.add(0.5), 0, 1);
  states.set(material, { origin, strength: amount });
  return material;
}

/**
 * Keep the pattern fixed to the ground across floating-origin rebases. Pass the renderer's world
 * origin [x, z] whenever it changes (every frame is fine).
 */
export function setTerrainGroundOrigin(
  material: THREE.Material,
  worldOrigin: readonly [number, number],
): void {
  const state = states.get(material);
  if (state === undefined)
    throw new Error('material was not created by a terrain ground material factory');
  const wrap = (value: number): number => ((value % PERIOD) + PERIOD) % PERIOD;
  state.origin.value.set(wrap(worldOrigin[0]), wrap(worldOrigin[1]));
}

/** Whether a material carries the ground variation (and accepts setTerrainGroundOrigin). */
export function isTerrainGroundMaterial(material: THREE.Material): boolean {
  return states.has(material);
}
