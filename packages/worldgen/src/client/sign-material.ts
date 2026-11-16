// Named storefront signs (`SignMeshBuffers`): every vertex carries a plate and a letter color, and
// letters are cut from one shared glyph atlas, a distance field, so a sign is a few quads with no
// texture or material of its own. Plates are opaque and need no texture. Letters are a second,
// blended pass over them: kerning tucks one letter's quad under its neighbour's (the o under a
// T), and opaque quads would paint each other's empty corners over the ink. Neither casts a
// shadow; both receive them.

import * as THREE from 'three';
import type { MeshStandardNodeMaterial, Node } from 'three/webgpu';

/** Per-vertex plate and letter colors: normalized linear RGB plus padding, four bytes each. */
export const SIGN_PLATE_ATTRIBUTE: 'signPlate' = 'signPlate';
export const SIGN_INK_ATTRIBUTE: 'signInk' = 'signInk';

/** A glyph atlas set's combined page image, as `assembleGlyphAtlasPixels` returns it. */
export interface SignAtlasPixels {
  width: number;
  height: number;
  data: Uint8Array;
}

/** Sign material for either renderer backend. */
export type SignMaterial = THREE.MeshStandardMaterial | MeshStandardNodeMaterial;

/** The letters' blended twin of each plate material; disposed with it. */
const letterTwins = new WeakMap<THREE.Material, THREE.Material>();

/** The material a sign material draws its letters with (see the module comment). */
export function signLettersMaterial(material: THREE.Material): THREE.Material | undefined {
  return letterTwins.get(material);
}

function pair<T extends THREE.Material>(plates: T, letters: T): T {
  letters.name = `${plates.name}:letters`;
  letters.transparent = true;
  letters.depthWrite = false;
  letterTwins.set(plates, letters);
  plates.addEventListener('dispose', () => letters.dispose());
  return plates;
}

/** Upload a glyph atlas image once: single-channel distances, mipmapped. Caller-owned. */
export function createSignAtlasTexture(pixels: SignAtlasPixels): THREE.DataTexture {
  if (pixels.data.byteLength !== pixels.width * pixels.height)
    throw new Error('sign atlas pixels must hold width * height bytes');
  const texture = new THREE.DataTexture(
    pixels.data,
    pixels.width,
    pixels.height,
    THREE.RedFormat,
    THREE.UnsignedByteType,
  );
  texture.name = 'worldgen:sign-atlas';
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  // Mip levels average distances, so small letters soften into their plate rather than sparkle.
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}

/** Signs read as painted panels: matte, not metal. */
const parameters = (): THREE.MeshStandardMaterialParameters => ({
  color: 0xffffff,
  roughness: 0.65,
  metalness: 0,
});

const GLSL = /* glsl */ `
  uniform sampler2D signAtlas;
  uniform vec2 signAtlasSize;
  uniform float signRange;
  varying vec3 vSignPlate;
  varying vec3 vSignInk;
  varying vec2 vSignUv;

  // Coverage of a letter at this pixel: the atlas distance (texels, positive inside) scaled to
  // screen pixels. Where a pixel spans more than the field's range, coverage falls back to the
  // distance itself, so far letters soften instead of filling their quads.
  float signCoverage() {
    float distance = (texture2D(signAtlas, vSignUv).r - 0.5) * 2.0 * signRange;
    vec2 texels = fwidth(vSignUv) * signAtlasSize;
    float perPixel = max(max(texels.x, texels.y), 1e-4);
    float scale = max(1.0 / perPixel, 0.5 / signRange);
    return clamp(distance * scale + 0.5, 0.0, 1.0);
  }
`;

function glslSign(
  material: THREE.MeshStandardMaterial,
  uniforms: Record<string, { value: unknown }>,
  letters: boolean,
): void {
  material.onBeforeCompile = (shader, renderer): void => {
    // Renderer-wide hooks (a Molen renderer's cloud shadows) live on the prototype.
    THREE.Material.prototype.onBeforeCompile.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `
      attribute vec4 ${SIGN_PLATE_ATTRIBUTE};
      attribute vec4 ${SIGN_INK_ATTRIBUTE};
      varying vec3 vSignPlate;
      varying vec3 vSignInk;
      varying vec2 vSignUv;
    ${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vSignPlate = ${SIGN_PLATE_ATTRIBUTE}.rgb;
       vSignInk = ${SIGN_INK_ATTRIBUTE}.rgb;
       vSignUv = uv;`,
    );
    shader.fragmentShader = `${GLSL}
    ${shader.fragmentShader}`.replace(
      '#include <color_fragment>',
      letters
        ? `#include <color_fragment>
           diffuseColor = vec4(diffuseColor.rgb * vSignInk, diffuseColor.a * signCoverage());`
        : `#include <color_fragment>
           diffuseColor.rgb *= vSignPlate;`,
    );
  };
  const key = letters ? 'worldgen-sign-letters@1' : 'worldgen-sign-plates@1';
  material.customProgramCacheKey = (): string => key;
}

/**
 * WebGL sign material: plates in their vertex colors, letters (its twin, see
 * `signLettersMaterial`) from `atlas`, a `createSignAtlasTexture` of a glyph atlas set with that
 * `distanceRange`. Disposing it disposes the twin; the texture stays the caller's.
 */
export function createSignMaterial(
  atlas: THREE.Texture,
  distanceRange: number,
): THREE.MeshStandardMaterial {
  const image = atlas.image as { width: number; height: number };
  const uniforms = {
    signAtlas: { value: atlas },
    signAtlasSize: { value: new THREE.Vector2(image.width, image.height) },
    signRange: { value: distanceRange },
  };
  const plates = new THREE.MeshStandardMaterial(parameters());
  plates.name = 'worldgen:signs';
  glslSign(plates, uniforms, false);
  const letters = new THREE.MeshStandardMaterial(parameters());
  glslSign(letters, uniforms, true);
  return pair(plates, letters);
}

/** Sign material for an initialized renderer's backend; WebGPU builds the same as nodes. */
export async function createSignMaterialAsync(
  backend: 'webgl' | 'webgpu',
  atlas: THREE.Texture,
  distanceRange: number,
): Promise<SignMaterial> {
  if (backend === 'webgl') return createSignMaterial(atlas, distanceRange);
  const [
    { MeshStandardNodeMaterial },
    { attribute, clamp, float, fwidth, max, texture, uv, vec2, vec4 },
  ] = await Promise.all([import('three/webgpu'), import('three/tsl')]);
  type F = Node<'float'>;
  const image = atlas.image as { width: number; height: number };
  const coords = uv();
  const distance = texture(atlas, coords)
    .r.sub(0.5)
    .mul(2 * distanceRange);
  const texels = fwidth(coords).mul(vec2(image.width, image.height));
  const perPixel = max(max(texels.x, texels.y), 1e-4);
  const scale = max(float(1).div(perPixel), 0.5 / distanceRange);
  const coverage = clamp(distance.mul(scale).add(0.5), 0, 1) as unknown as F;
  const plate = attribute(SIGN_PLATE_ATTRIBUTE, 'vec4') as unknown as Node<'vec4'>;
  const ink = attribute(SIGN_INK_ATTRIBUTE, 'vec4') as unknown as Node<'vec4'>;
  const plates = new MeshStandardNodeMaterial(parameters());
  plates.name = 'worldgen:signs';
  plates.colorNode = vec4(plate.rgb, 1);
  const letters = new MeshStandardNodeMaterial(parameters());
  letters.colorNode = vec4(ink.rgb, 1);
  letters.opacityNode = coverage;
  // No uniforms of their own: replayed render bundles need not refresh every batch each frame.
  plates.userData.bundleStatic = true;
  letters.userData.bundleStatic = true;
  return pair(plates, letters);
}
