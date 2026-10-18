// Shared material for instanced scatter (trees, shrubs, ground cover) and props: vertex and
// instance colors, plus leaf-scale speckle so a crown is no longer one flat tone per facet, and
// a little occlusion low in each plant so trunks and lower crowns sit in their own shade. All in
// the shader, from model-space positions and a per-vertex canopy height: no textures, uploads or
// floating-origin state, and the same program for every level of detail.

import * as THREE from 'three';
import type { MeshStandardNodeMaterial, Node } from 'three/webgpu';

/** Scatter material for either the legacy WebGL renderer or the WebGPU node renderer. */
export type ScatterMaterial = THREE.MeshStandardMaterial | MeshStandardNodeMaterial;

/**
 * Per-vertex `canopy` attribute: 0 for props, 1 + relative height (1 at the base to 2 at the
 * top) for plants. `ModelLibrary` writes it on every geometry it prepares.
 */
export const SCATTER_CANOPY_ATTRIBUTE: 'canopy' = 'canopy';

/** Leaf speckle and clump cell sizes, and the spacing of branch tiers, model meters. */
const LEAF = 0.35;
const CLUMP = 2.2;
const TIER = 1.5;

const parameters = (): THREE.MeshStandardMaterialParameters => ({
  vertexColors: true,
  roughness: 0.92,
});

const GLSL = /* glsl */ `
  varying vec3 vScatterLocal;
  varying float vScatterCanopy;

  float scatterHash(vec2 c) {
    vec3 p3 = fract(vec3(c.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float scatterNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = p - i;
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(scatterHash(i), scatterHash(i + vec2(1.0, 0.0)), u.x),
      mix(scatterHash(i + vec2(0.0, 1.0)), scatterHash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  float scatterFactor() {
    vec3 q = vScatterLocal;
    // A slanted plane through the model, so the pattern varies with height as well.
    vec2 p = q.xz + q.y * vec2(0.71, -0.53);
    float footprint = max(length(fwidth(q)), 0.0001);
    float plant = step(0.5, vScatterCanopy);
    float leaf = (scatterNoise(p / ${LEAF.toFixed(2)}) - 0.5) *
        (1.0 - smoothstep(0.25, 0.6, footprint / ${LEAF.toFixed(2)})) +
      (scatterNoise(p / ${CLUMP.toFixed(2)} + 17.0) - 0.5) * 0.7 *
        (1.0 - smoothstep(0.25, 0.6, footprint / ${CLUMP.toFixed(2)}));
    float height = clamp(vScatterCanopy - 1.0, 0.0, 1.0);
    // Boughs: a darker band between tiers, so a crown reads as layered rather than smooth.
    float tierFade = 1.0 - smoothstep(0.25, 0.6, footprint / ${TIER.toFixed(1)});
    // The clump noise wobbles each tier so no crown carries regular stripes.
    float wobble = scatterNoise(p / ${CLUMP.toFixed(2)} + 41.0) - 0.5;
    float tier = pow(0.5 + 0.5 * cos(6.2831853 * (q.y / ${TIER.toFixed(1)} + wobble * 0.8)), 3.0) *
      tierFade;
    float occlusion = mix(1.0, mix(0.5, 1.08, smoothstep(0.0, 0.95, height)) * (1.0 - 0.16 * tier),
      plant);
    return (1.0 + leaf * mix(0.12, 0.4, plant)) * occlusion;
  }
`;

/** WebGL scatter material: a standard vertex-color material with the detail in its hooks. */
export function createScatterMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial(parameters());
  material.name = 'worldgen:models';
  material.onBeforeCompile = (shader): void => {
    shader.vertexShader = `
      attribute float ${SCATTER_CANOPY_ATTRIBUTE};
      varying vec3 vScatterLocal;
      varying float vScatterCanopy;
    ${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vScatterLocal = transformed;
       vScatterCanopy = ${SCATTER_CANOPY_ATTRIBUTE};`,
    );
    shader.fragmentShader = `${GLSL}
    ${shader.fragmentShader}`.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
       diffuseColor.rgb *= scatterFactor();`,
    );
  };
  material.customProgramCacheKey = (): string => 'worldgen-scatter@1';
  return material;
}

/** Scatter material for an initialized renderer's backend; WebGPU builds the same as nodes. */
export async function createScatterMaterialAsync(
  backend: 'webgl' | 'webgpu' = 'webgl',
): Promise<ScatterMaterial> {
  if (backend === 'webgl') return createScatterMaterial();
  const [
    { MeshStandardNodeMaterial },
    {
      attribute,
      dot,
      floor,
      fract,
      fwidth,
      materialColor,
      max,
      mix,
      positionGeometry,
      pow,
      cos,
      smoothstep,
      step,
      clamp,
      varying,
      vec2,
      vec3,
      vec4,
    },
  ] = await Promise.all([import('three/webgpu'), import('three/tsl')]);
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
  const canopy = varying(attribute(SCATTER_CANOPY_ATTRIBUTE, 'float')) as unknown as F;
  const p = q.xz.add(vec2(0.71, -0.53).mul(q.y)).toVar() as unknown as V2;
  const footprint = max(fwidth(q).length(), 0.0001);
  const plant = step(0.5, canopy);
  const leaf = noise(p.div(LEAF) as unknown as V2)
    .sub(0.5)
    .mul(smoothstep(0.25, 0.6, footprint.div(LEAF)).oneMinus())
    .add(
      noise(p.div(CLUMP).add(17) as unknown as V2)
        .sub(0.5)
        .mul(0.7)
        .mul(smoothstep(0.25, 0.6, footprint.div(CLUMP)).oneMinus()),
    );
  const height = clamp(canopy.sub(1), 0, 1);
  // Boughs: a darker band between tiers, so a crown reads as layered rather than smooth.
  const tierFade = smoothstep(0.25, 0.6, footprint.div(TIER)).oneMinus();
  // The clump noise wobbles each tier so no crown carries regular stripes.
  const wobble = noise(p.div(CLUMP).add(41) as unknown as V2).sub(0.5);
  const tier = pow(
    cos(
      q.y
        .div(TIER)
        .add(wobble.mul(0.8))
        .mul(2 * Math.PI),
    )
      .mul(0.5)
      .add(0.5),
    3,
  ).mul(tierFade);
  const occlusion = mix(
    1,
    mix(0.5, 1.08, smoothstep(0, 0.95, height)).mul(tier.mul(0.16).oneMinus()),
    plant,
  );
  const factor = leaf
    .mul(mix(0.12, 0.4, plant))
    .add(1)
    .mul(occlusion);
  const material = new MeshStandardNodeMaterial(parameters());
  material.name = 'worldgen:models';
  const color = materialColor as unknown as Node<'vec4'>;
  material.colorNode = vec4(color.rgb.mul(factor), color.a);
  return material;
}

/**
 * Write the `canopy` attribute: relative height for plants (1 at the base to 2 at the top), 0 for
 * everything else. Every geometry the scatter material draws carries it, so all share a program.
 */
export function setScatterCanopy(geometry: THREE.BufferGeometry, plant: boolean): void {
  if (geometry.getAttribute(SCATTER_CANOPY_ATTRIBUTE) !== undefined) return;
  const position = geometry.getAttribute('position');
  const values = new Float32Array(position?.count ?? 0);
  if (plant && position !== undefined && position.count > 0) {
    if (geometry.boundingBox === null) geometry.computeBoundingBox();
    const box = geometry.boundingBox as THREE.Box3;
    const span = Math.max(0.01, box.max.y - box.min.y);
    for (let i = 0; i < position.count; i++)
      values[i] = 1 + Math.min(1, Math.max(0, (position.getY(i) - box.min.y) / span));
  }
  geometry.setAttribute(SCATTER_CANOPY_ATTRIBUTE, new THREE.BufferAttribute(values, 1));
}
