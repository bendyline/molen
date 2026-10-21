// Weathering for generated buildings: the shared facade and roof textures repeat identically on
// every house that uses them, so walls get a broad per-facade tone drift and faint rain streaks,
// and roofs weathered patches with a touch of lichen. All from model-space position and normal
// in the shader: no textures or uploads, and the same pattern wherever the batch is rebased.

import type * as THREE from 'three';
import type { Node } from 'three/webgpu';
import type { MaterialSlot } from '../kernel/types';

/**
 * Adds detail to a building material a material set creates (`decorate` on
 * `createResolvedMaterialSet` and `createVertexColorMaterialSet`). Called once per material.
 */
export type BuildingMaterialDecorator = (
  material: THREE.MeshStandardMaterial,
  slot: MaterialSlot,
) => void;

/** Facade tone patches, rain-streak width and roof patch size, meters. */
const TONE = 9;
const STREAK = 0.45;
const PATCH = 2.5;
/** Streak height: long enough to read as run-off, not as noise. */
const STREAK_LENGTH = 6;

const GLSL = /* glsl */ `
  varying vec3 vWeatherLocal;
  varying vec3 vWeatherNormal;

  float weatherHash(vec2 c) {
    vec3 p3 = fract(vec3(c.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float weatherNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = p - i;
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(weatherHash(i), weatherHash(i + vec2(1.0, 0.0)), u.x),
      mix(weatherHash(i + vec2(0.0, 1.0)), weatherHash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  vec3 buildingWeather() {
    vec3 q = vWeatherLocal;
    vec3 n = normalize(vWeatherNormal);
    float footprint = max(length(fwidth(q)), 0.0001);
    // Each stretch of wall or roof a little lighter or darker, warmer or cooler.
    float tone = weatherNoise(q.xz / ${TONE.toFixed(1)} + q.y * 0.05) - 0.5;
    vec3 factor = vec3(1.0 + tone * 0.16) * mix(vec3(0.98, 1.0, 1.03), vec3(1.03, 1.0, 0.96),
      weatherNoise(q.xz / ${(TONE * 2).toFixed(1)} + 31.0));
    // Rain streaks run down each wall, whichever way it faces.
    float wall = 1.0 - smoothstep(0.3, 0.7, abs(n.y));
    vec2 along = normalize(vec2(-n.z, n.x) + vec2(0.0001, 0.0));
    float across = dot(q.xz, along);
    float streak = smoothstep(0.52, 0.9,
      weatherNoise(vec2(across / ${STREAK.toFixed(2)}, q.y / ${STREAK_LENGTH.toFixed(1)})));
    streak *= 1.0 - smoothstep(0.25, 0.6, footprint / ${STREAK.toFixed(2)});
    factor *= 1.0 - wall * streak * 0.22;
    // Weathered patches and a little lichen on whatever faces the sky.
    float roof = smoothstep(0.35, 0.7, n.y);
    float lichen = smoothstep(0.5, 0.82, weatherNoise(q.xz / ${PATCH.toFixed(1)} + 7.0));
    lichen *= 1.0 - smoothstep(0.25, 0.6, footprint / ${PATCH.toFixed(1)});
    factor *= mix(vec3(1.0), vec3(0.8, 0.83, 0.74), roof * lichen * 0.8);
    return factor;
  }
`;

// Not a userData flag: clones copy userData but not the shader hooks.
const weathered = new WeakSet<THREE.Material>();

function skip(material: THREE.MeshStandardMaterial, slot: MaterialSlot): boolean {
  // Glass keeps its own reflection; a material is decorated once.
  if (slot === 'window' || weathered.has(material)) return true;
  weathered.add(material);
  return false;
}

/** WebGL weathering: shader hooks on the standard material itself. */
export function createBuildingWeathering(): BuildingMaterialDecorator {
  return (material, slot) => {
    if (skip(material, slot)) return;
    const previous = material.onBeforeCompile.bind(material);
    const previousKey = material.customProgramCacheKey.bind(material);
    material.onBeforeCompile = (shader, renderer): void => {
      previous(shader, renderer);
      shader.vertexShader = `
        varying vec3 vWeatherLocal;
        varying vec3 vWeatherNormal;
      ${shader.vertexShader}`.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vWeatherLocal = transformed;
         vWeatherNormal = objectNormal;`,
      );
      shader.fragmentShader = `${GLSL}
      ${shader.fragmentShader}`.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         diffuseColor.rgb *= buildingWeather();`,
      );
    };
    material.customProgramCacheKey = (): string => `${previousKey()}|worldgen-weathering@3`;
    material.needsUpdate = true;
  };
}

/**
 * Weathering for an initialized renderer's backend. WebGPU converts standard materials to node
 * materials property by property, so the decorator sets a `colorNode` on the standard material.
 */
export async function createBuildingWeatheringAsync(
  backend: 'webgl' | 'webgpu' = 'webgl',
): Promise<BuildingMaterialDecorator> {
  if (backend === 'webgl') return createBuildingWeathering();
  const {
    abs,
    dot,
    floor,
    fract,
    fwidth,
    materialColor,
    max,
    mix,
    normalGeometry,
    normalize,
    positionGeometry,
    smoothstep,
    varying,
    vec2,
    vec3,
    vec4,
  } = await import('three/tsl');
  type F = Node<'float'>;
  type V2 = Node<'vec2'>;
  type V3 = Node<'vec3'>;
  const hash = (cell: V2): F => {
    const p = fract(vec3(cell.x, cell.y, cell.x).mul(0.1031));
    const q = p.add(dot(p, p.yzx.add(33.33)));
    return fract(q.x.add(q.y).mul(q.z)) as unknown as F;
  };
  const noise = (p: V2): F => {
    const i = floor(p);
    const f = p.sub(i);
    const u = f.mul(f).mul(f.mul(-2).add(3));
    return mix(
      mix(hash(i as unknown as V2), hash(i.add(vec2(1, 0)) as unknown as V2), u.x),
      mix(hash(i.add(vec2(0, 1)) as unknown as V2), hash(i.add(vec2(1, 1)) as unknown as V2), u.x),
      u.y,
    ) as unknown as F;
  };
  const q = varying(positionGeometry).toVar() as unknown as V3;
  const n = normalize(varying(normalGeometry)).toVar() as unknown as V3;
  const footprint = max(fwidth(q).length(), 0.0001);
  const fade = (cell: number): F =>
    smoothstep(0.25, 0.6, footprint.div(cell)).oneMinus() as unknown as F;
  const tone = noise(q.xz.div(TONE).add(q.y.mul(0.05)) as unknown as V2).sub(0.5);
  const drift = mix(
    vec3(0.98, 1, 1.03),
    vec3(1.03, 1, 0.96),
    noise(q.xz.div(TONE * 2).add(31) as unknown as V2),
  );
  const wall = smoothstep(0.3, 0.7, abs(n.y)).oneMinus();
  const along = normalize(vec2(n.z.negate(), n.x).add(vec2(0.0001, 0)));
  const across = dot(q.xz, along);
  const streak = smoothstep(
    0.52,
    0.9,
    noise(vec2(across.div(STREAK), q.y.div(STREAK_LENGTH)) as unknown as V2),
  ).mul(fade(STREAK));
  const roof = smoothstep(0.35, 0.7, n.y);
  const lichen = smoothstep(0.5, 0.82, noise(q.xz.div(PATCH).add(7) as unknown as V2)).mul(
    fade(PATCH),
  );
  const factor = drift
    .mul(tone.mul(0.16).add(1))
    .mul(wall.mul(streak).mul(0.22).oneMinus())
    .mul(mix(vec3(1), vec3(0.8, 0.83, 0.74), roof.mul(lichen).mul(0.8)));
  const color = materialColor as unknown as Node<'vec4'>;
  const colorNode = vec4(color.rgb.mul(factor), color.a);
  return (material, slot) => {
    if (skip(material, slot)) return;
    // Carried onto the node material WebGPU builds from this one.
    (material as THREE.MeshStandardMaterial & { colorNode?: unknown }).colorNode = colorNode;
    // No uniforms of its own: replayed render bundles need not refresh every wall each frame.
    material.userData.bundleStatic = true;
    material.needsUpdate = true;
  };
}
