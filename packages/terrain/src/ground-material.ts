// Ground variation for terrain and landcover: world-space mottling, plus dry and lush patches
// on vegetated ground, computed in the shader so it costs no geometry, no texture and no upload.
// Flat landcover polygons would otherwise read as one solid swatch from edge to edge.

import * as THREE from 'three';
import type { MeshStandardNodeMaterial, Node } from 'three/webgpu';

export interface TerrainGroundMaterialOptions {
  roughness?: number;
  /** Variation amount: 0 is the flat vertex color, 1 the default, up to 2. */
  strength?: number;
  /** Landcover geometries carry per-field row and soil attributes. */
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
const GRAIN = 1;
const PATCH = 128;
/** Mottling's share of brightness at full strength (value noise is mostly within ±0.3). */
const MOTTLE = 0.45;
/** Straw-colored dry areas and darker, bluer lush areas on green ground. */
const DRY: [number, number, number] = [1.28, 1.08, 0.6];
const LUSH: [number, number, number] = [0.78, 0.96, 0.84];
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

  vec3 terrainGroundFactor(vec3 base, float distance) {
    vec2 p = vTerrainGround;
    // Detail fades before it falls below a pixel, so distant ground never shimmers.
    float grain = 1.0 - smoothstep(15.0, 60.0, distance);
    float fine = 1.0 - smoothstep(60.0, 220.0, distance);
    float mid = 1.0 - smoothstep(500.0, 2000.0, distance);
    float broad = 1.0 - smoothstep(5000.0, 15000.0, distance);
    float mottle =
      (terrainGroundNoise(p, ${BROAD.toFixed(1)}) - 0.5) * broad +
      (terrainGroundNoise(p, ${MID.toFixed(1)}) - 0.5) * 0.8 * mid +
      (terrainGroundNoise(p, ${FINE.toFixed(1)}) - 0.5) * 0.6 * fine +
      (terrainGroundNoise(p, ${GRAIN.toFixed(1)}) - 0.5) * 0.45 * grain;
    float lum = 1.0 + mottle * ${MOTTLE.toFixed(3)} * terrainGroundStrength;
    // Only green ground dries out or grows lush; paving, sand and rock keep their hue.
    float green = clamp((base.g - max(base.r, base.b)) * 10.0, 0.0, 1.0);
    float area = terrainGroundNoise(p + vec2(311.0, 173.0), ${PATCH.toFixed(1)});
    float dry = clamp(smoothstep(0.5, 0.78, area) * green * broad * 0.7 * terrainGroundStrength, 0.0, 1.0);
    float lush = clamp((1.0 - smoothstep(0.22, 0.45, area)) * green * broad * 0.5 * terrainGroundStrength, 0.0, 1.0);
    vec3 tint = mix(vec3(1.0), ${glslVec3(DRY)}, dry) * mix(vec3(1.0), ${glslVec3(LUSH)}, lush);
    return lum * tint;
  }
`;

function parameters(options: TerrainGroundMaterialOptions): THREE.MeshStandardMaterialParameters {
  return { vertexColors: true, roughness: options.roughness ?? 0.97, metalness: 0 };
}

function strength(options: TerrainGroundMaterialOptions): number {
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
      ${options.agriculture ? 'attribute vec4 agricultureRows; attribute vec3 agricultureSoil; varying vec4 vAgricultureRows; varying vec3 vAgricultureSoil;' : ''}
      varying vec2 vTerrainGround;
      uniform vec2 terrainGroundOrigin;
    ${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vTerrainGround = (modelMatrix * vec4(transformed, 1.0)).xz + terrainGroundOrigin;
       ${options.agriculture ? 'vAgricultureRows = agricultureRows; vAgricultureSoil = agricultureSoil;' : ''}`,
    );
    shader.fragmentShader = `${GLSL}
      ${options.agriculture ? 'varying vec4 vAgricultureRows; varying vec3 vAgricultureSoil;' : ''}
    ${shader.fragmentShader}`.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
       ${
         options.agriculture
           ? `
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
       diffuseColor.rgb *= terrainGroundFactor(diffuseColor.rgb, length(vViewPosition));`,
    );
  };
  material.customProgramCacheKey = (): string => `terrain-ground@2:${options.agriculture === true}`;
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
  const [
    { MeshStandardNodeMaterial },
    {
      clamp,
      dot,
      floor,
      fract,
      materialColor,
      max,
      mix,
      positionView,
      positionWorld,
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
    },
  ] = await Promise.all([import('three/webgpu'), import('three/tsl')]);
  type F = Node<'float'>;
  type V2 = Node<'vec2'>;
  const origin = uniform(new THREE.Vector2()).setName('terrainGroundOrigin');
  const amount = uniform(strength(options)).setName('terrainGroundStrength');
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
  const p = positionWorld.xz.add(origin).toVar() as unknown as V2;
  const distance = positionView.length();
  const grain = smoothstep(15, 60, distance).oneMinus();
  const fine = smoothstep(60, 220, distance).oneMinus();
  const mid = smoothstep(500, 2000, distance).oneMinus();
  const broad = smoothstep(5000, 15000, distance).oneMinus();
  const mottle = noise(p, BROAD)
    .sub(0.5)
    .mul(broad)
    .add(noise(p, MID).sub(0.5).mul(0.8).mul(mid))
    .add(noise(p, FINE).sub(0.5).mul(0.6).mul(fine))
    .add(noise(p, GRAIN).sub(0.5).mul(0.45).mul(grain));
  const lum = mottle.mul(MOTTLE).mul(amount).add(1);
  const base = vertexColor().rgb;
  const green = clamp(base.g.sub(max(base.r, base.b)).mul(10), 0, 1);
  const area = noise(p.add(vec2(311, 173)), PATCH);
  const dry = clamp(smoothstep(0.5, 0.78, area).mul(green).mul(broad).mul(0.7).mul(amount), 0, 1);
  const lush = clamp(
    smoothstep(0.22, 0.45, area).oneMinus().mul(green).mul(broad).mul(0.5).mul(amount),
    0,
    1,
  );
  const tint = mix(vec3(1), vec3(...DRY), dry).mul(mix(vec3(1), vec3(...LUSH), lush));
  const material = new MeshStandardNodeMaterial(parameters(options));
  material.name = 'terrain-ground';
  // The node renderer multiplies colorNode by the vertex color itself (vertexColors stays on);
  // the factor reads the vertex color only to find green ground.
  const color = materialColor as unknown as Node<'vec4'>;
  let factor = tint.mul(lum);
  if (options.agriculture) {
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
    factor = factor.mul(mix(base, field, rows.z).div(max(base, vec3(0.001))));
  }
  material.colorNode = vec4(color.rgb.mul(factor), color.a);
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
