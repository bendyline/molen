// Shared material for instanced scatter (trees, shrubs, ground cover) and props: vertex and
// instance colors, plus leaf-scale speckle so a crown is no longer one flat tone per facet, and
// a little occlusion low in each plant so trunks and lower crowns sit in their own shade. The
// detail is in the shader, from model-space positions and a per-vertex canopy height. One small
// generated atlas cuts leaf cards out along a clump of leaves; every other surface samples its
// opaque white block, so all levels of detail and every prop still share one program.

import * as THREE from 'three';
import type { MeshStandardNodeMaterial, Node } from 'three/webgpu';
import { unit01 } from '../kernel/seed';

/** Scatter material for either the legacy WebGL renderer or the WebGPU node renderer. */
export type ScatterMaterial = THREE.MeshStandardMaterial | MeshStandardNodeMaterial;

const fullyLitTerms = new WeakMap<THREE.Material, Node<'float'>>();

/**
 * A node scatter material's constant shadow term: a twin whose `receivedShadowNode` returns it
 * never samples the sun's shadow map. Undefined for the plain (WebGL) material.
 */
export function scatterFullyLitTerm(material: THREE.Material): Node<'float'> | undefined {
  return fullyLitTerms.get(material);
}

/**
 * Per-vertex `canopy` attribute: 0 for props, 1 + relative height (1 at the base to 2 at the
 * top) for plants. `ModelLibrary` writes it on every geometry it prepares.
 */
export const SCATTER_CANOPY_ATTRIBUTE: 'canopy' = 'canopy';

/** Leaf speckle and clump cell sizes, and the spacing of branch tiers, model meters. */
const LEAF = 0.35;
const CLUMP = 2.2;
const TIER = 1.5;

/**
 * Leaf-card atlas, texels: a leaf sprig in the left square, a fir spray beside it, and an opaque
 * white block at the right, each with clear margins so mip levels do not bleed between them.
 */
const ATLAS_WIDTH = 512;
const ATLAS_HEIGHT = 256;
const SPRAY_FROM = 264;
const SPRAY_TO = 440;
const SOLID_FROM = 480;
/** Twigs fan out about a golden angle apart. */
const TWIG_TURN = 2.39996;

/** Atlas coordinates of a leaf card's corners, counterclockwise from its lower left. */
export const SCATTER_CARD_UVS: readonly (readonly [number, number])[] = [
  [0, 0],
  [ATLAS_HEIGHT / ATLAS_WIDTH, 0],
  [ATLAS_HEIGHT / ATLAS_WIDTH, 1],
  [0, 1],
];

/** Atlas coordinates of a bough card's corners: the spray's root along the lower edge. */
export const SCATTER_SPRAY_UVS: readonly (readonly [number, number])[] = [
  [SPRAY_FROM / ATLAS_WIDTH, 0],
  [SPRAY_TO / ATLAS_WIDTH, 0],
  [SPRAY_TO / ATLAS_WIDTH, 1],
  [SPRAY_FROM / ATLAS_WIDTH, 1],
];

/** Share of a leaf card's half extent that its sprig of leaves reaches; the corners are clear. */
export const SCATTER_CARD_FILL = 0.92;

/**
 * Atlas coordinates of its opaque white block, for every surface that is not a leaf card (bark,
 * fronds, props). A constant coordinate has no screen derivatives, so it always samples the
 * block at full resolution and leaves the vertex color unchanged at any distance.
 */
export const SCATTER_SOLID_UV: readonly [number, number] = [0.97, 0.5];

let atlas: THREE.DataTexture | undefined;

/**
 * The shared leaf atlas, generated once. Each mip level rescales its alpha so as many texels
 * pass the alpha test as at full size: distant cards keep their leafy mass instead of thinning
 * to nothing as coverage averages away.
 */
function leafAtlas(): THREE.DataTexture {
  if (atlas !== undefined) return atlas;
  const tone = new Float32Array(ATLAS_WIDTH * ATLAS_HEIGHT).fill(0.8);
  const alpha = new Float32Array(ATLAS_WIDTH * ATLAS_HEIGHT);
  /** One stroke in texels, kept within the columns `[left, right)` of its region. */
  const paint = (
    from: readonly [number, number],
    direction: number,
    length: number,
    width: number,
    shade: number,
    leaf: boolean,
    [left, right]: readonly [number, number],
  ): void => {
    const dx = Math.cos(direction),
      dy = Math.sin(direction);
    const reach = length + width;
    const x0 = Math.max(left, Math.floor(from[0] - reach)),
      x1 = Math.min(right - 1, Math.ceil(from[0] + reach));
    const y0 = Math.max(0, Math.floor(from[1] - reach)),
      y1 = Math.min(ATLAS_HEIGHT - 1, Math.ceil(from[1] + reach));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5 - from[0],
          py = y + 0.5 - from[1];
        const along = (px * dx + py * dy) / length;
        const across = -px * dy + py * dx;
        if (along < 0 || along > 1) continue;
        // A pointed blade, widest a little below its middle; a twig or needle is a tapering
        // stroke.
        const half = leaf
          ? (width / 2) * Math.sin(Math.PI * along ** 0.8) ** 0.8
          : (width / 2) * (1 - 0.6 * along);
        const cover = Math.min(1, Math.max(0, half - Math.abs(across) + 0.5));
        if (cover <= 0) continue;
        // Darker at the stalk and along the midrib, one half of each blade a little lighter.
        const rib = Math.max(0, 1 - Math.abs(across));
        const value = leaf
          ? shade * (0.84 + 0.16 * along) * (1 - 0.2 * rib) * (across > 0 ? 1.05 : 0.97)
          : shade;
        const i = y * ATLAS_WIDTH + x;
        tone[i] = (tone[i] as number) + (value - (tone[i] as number)) * cover;
        alpha[i] = cover + (alpha[i] as number) * (1 - cover);
      }
  };
  const size = ATLAS_HEIGHT;
  const sprig: [number, number] = [0, size];
  // Twigs from the sprig's middle, under the leaves, show through the gaps between them.
  for (let i = 0; i < 6; i++)
    paint(
      [size / 2, size / 2],
      (i * TWIG_TURN) % (Math.PI * 2),
      0.36 * size,
      0.012 * size,
      0.42,
      false,
      sprig,
    );
  const leaves = Array.from({ length: 180 }, (_, i) => {
    const length = 0.075 + 0.05 * unit01(7, i * 5);
    const radius = (0.46 - length) * unit01(7, i * 5 + 1) ** 0.6;
    const angle = Math.PI * 2 * unit01(7, i * 5 + 2);
    return {
      from: [size * (0.5 + Math.cos(angle) * radius), size * (0.5 + Math.sin(angle) * radius)] as [
        number,
        number,
      ],
      // Leaves point outward from the sprig, give or take; inner leaves sit in its shade.
      direction: angle + (unit01(7, i * 5 + 3) - 0.5) * 1.6,
      length: length * size,
      width: length * size * (0.44 + 0.16 * unit01(7, i * 5 + 4)),
      shade: (0.66 + 0.34 * unit01(7, i * 5 + 5)) * (0.8 + (0.2 * radius) / 0.38),
    };
  });
  // Brighter leaves draw last, on top, so the sprig has depth.
  leaves.sort((a, b) => a.shade - b.shade);
  for (const leaf of leaves)
    paint(leaf.from, leaf.direction, leaf.length, leaf.width, leaf.shade, true, sprig);
  // The fir spray: a stem from its root (row 0) to its tip, branchlets alternating forward along
  // it, widest a third of the way up, each fringed with needles that lighten toward its tip.
  const spray: [number, number] = [SPRAY_FROM, SPRAY_TO];
  const middle = (SPRAY_FROM + SPRAY_TO) / 2,
    spread = (SPRAY_TO - SPRAY_FROM) / 2 - 4;
  const stem = ATLAS_HEIGHT - 10;
  paint([middle, 4], Math.PI / 2, stem, 3.2, 0.48, false, spray);
  /**
   * A branchlet fringed with needles both ways, lightening toward its tip. Needle pitch, angle and
   * each branchlet's own tone vary: an even comb of branchlets, alike in tone, read on a tree as
   * stacked parallel stripes.
   */
  const branchlet = (
    root: readonly [number, number],
    direction: number,
    length: number,
    stream: number,
    tone = 1,
  ): void => {
    paint(root, direction, length, 2, 0.5 * tone, false, spray);
    for (let s = 2, n = 0; s < length; s += 1.5 + 0.9 * unit01(13, stream + n), n++)
      for (const turn of [-0.75, 0.75]) {
        const at = s / length;
        const jitter = unit01(11, stream + n * 2 + (turn > 0 ? 1 : 0));
        paint(
          [root[0] + Math.cos(direction) * s, root[1] + Math.sin(direction) * s],
          direction + turn + (jitter - 0.5) * 0.7,
          (9 - 4 * at) * (0.7 + 0.6 * jitter),
          2,
          (0.58 + 0.34 * at) * (0.86 + 0.24 * jitter) * tone,
          false,
          spray,
        );
      }
  };
  for (let k = 0; k < 34; k++) {
    const t = Math.min(0.97, 0.04 + (0.92 * (k + 0.9 * unit01(12, k))) / 34);
    const side = k % 2 === 0 ? -1 : 1;
    const forward = 0.75 + 0.5 * unit01(12, k + 100);
    const envelope = Math.sin(Math.PI * t ** 0.75) ** 0.8;
    const length =
      (spread * (0.12 + 0.88 * envelope) * (0.72 + 0.28 * unit01(12, k + 200))) / Math.sin(forward);
    const root: [number, number] = [middle, 4 + t * stem];
    const direction = Math.atan2(Math.cos(forward), side * Math.sin(forward));
    const tone = 0.78 + 0.3 * unit01(12, k + 300);
    branchlet(root, direction, length, k * 1000, tone);
    // Shorter side shoots fill the gaps between branchlets.
    for (const [at, n] of [
      [0.35, 1],
      [0.65, 2],
    ] as const)
      if (length > 24)
        branchlet(
          [
            root[0] + Math.cos(direction) * length * at,
            root[1] + Math.sin(direction) * length * at,
          ],
          direction + side * 0.55,
          length * 0.34,
          k * 1000 + n * 300,
          tone,
        );
  }
  let width = ATLAS_WIDTH,
    height = ATLAS_HEIGHT;
  // Clear texels take the tone of the leaves beside them (a few rings, then their region's mean),
  // so filtering at a cut edge never blends a pale rim into the leaves: at medium distance, where
  // a card is a few texels across, that rim read as pale speckles across every crown.
  const known = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) known[i] = (alpha[i] as number) > 0.02 ? 1 : 0;
  for (let pass = 0; pass < 8; pass++) {
    const found: [number, number][] = [];
    for (let y = 0; y < height; y++)
      for (let x = 0; x < SOLID_FROM; x++) {
        const i = y * width + x;
        if (known[i]) continue;
        let sum = 0,
          count = 0;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const nx = x + dx,
            ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= SOLID_FROM || ny >= height) continue;
          const j = ny * width + nx;
          if (!known[j]) continue;
          sum += tone[j] as number;
          count++;
        }
        if (count > 0) found.push([i, sum / count]);
      }
    for (const [i, value] of found) {
      tone[i] = value;
      known[i] = 1;
    }
  }
  for (const [from, to] of [
    [0, SPRAY_FROM],
    [SPRAY_FROM, SOLID_FROM],
  ] as const) {
    let sum = 0,
      count = 0;
    for (let y = 0; y < height; y++)
      for (let x = from; x < to; x++)
        if (known[y * width + x]) {
          sum += tone[y * width + x] as number;
          count++;
        }
    const mean = count > 0 ? sum / count : 0.8;
    for (let y = 0; y < height; y++)
      for (let x = from; x < to; x++) if (!known[y * width + x]) tone[y * width + x] = mean;
  }
  const level0 = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const solid = i % width >= SOLID_FROM;
    level0[i * 4] =
      level0[i * 4 + 1] =
      level0[i * 4 + 2] =
        Math.round(Math.min(1, solid ? 1 : (tone[i] as number)) * 255);
    level0[i * 4 + 3] = solid ? 255 : Math.round((alpha[i] as number) * 255);
  }
  const coverage = (data: Uint8Array, w: number, h: number, scale: number): number => {
    let passed = 0;
    // The leaf and spray regions, left of the solid block.
    const span = Math.max(1, (w * SOLID_FROM) / ATLAS_WIDTH);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < span; x++)
        if ((data[(y * w + x) * 4 + 3] as number) * scale > 127.5) passed++;
    return passed / (span * h);
  };
  const target = coverage(level0, width, height, 1);
  const mipmaps = [{ data: level0, width, height }];
  while (width > 1 || height > 1) {
    const previous = mipmaps[mipmaps.length - 1] as {
      data: Uint8Array;
      width: number;
      height: number;
    };
    const w = Math.max(1, width >> 1),
      h = Math.max(1, height >> 1);
    const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let r = 0,
          a = 0,
          plain = 0;
        for (const [sx, sy] of [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ] as const) {
          const o =
            (Math.min(height - 1, y * 2 + sy) * width + Math.min(width - 1, x * 2 + sx)) * 4;
          const weight = previous.data[o + 3] as number;
          r += (previous.data[o] as number) * weight;
          a += weight;
          plain += previous.data[o] as number;
        }
        const o = (y * w + x) * 4;
        data[o] = data[o + 1] = data[o + 2] = Math.round(a > 0 ? r / a : plain / 4);
        data[o + 3] = Math.round(a / 4);
      }
    // The alpha scale that keeps the cards' coverage at its full-size share.
    let low = 1,
      high = 4;
    for (let step = 0; step < 16; step++) {
      const middle = (low + high) / 2;
      if (coverage(data, w, h, middle) < target) low = middle;
      else high = middle;
    }
    for (let i = 3; i < data.length; i += 4)
      data[i] = Math.min(255, Math.round((data[i] as number) * high));
    mipmaps.push({ data, width: w, height: h });
    width = w;
    height = h;
  }
  atlas = new THREE.DataTexture(level0, ATLAS_WIDTH, ATLAS_HEIGHT, THREE.RGBAFormat);
  atlas.name = 'worldgen:leaf-atlas';
  atlas.mipmaps = mipmaps as unknown as THREE.DataTexture['mipmaps'];
  atlas.generateMipmaps = false;
  atlas.minFilter = THREE.LinearMipmapLinearFilter;
  atlas.magFilter = THREE.LinearFilter;
  atlas.needsUpdate = true;
  return atlas;
}

/** Atlas alpha below which a leaf card is cut away. */
const SCATTER_ALPHA_CUT = 0.5;

const parameters = (): THREE.MeshStandardMaterialParameters => ({
  vertexColors: true,
  roughness: 0.92,
  map: leafAtlas(),
  // Leaf cards cut out along the atlas's leaf edges; with multisampling, alpha to coverage
  // antialiases the cut instead of stair-stepping it.
  alphaTest: SCATTER_ALPHA_CUT,
  alphaToCoverage: true,
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
    // Each layer only where it still shows, so distant canopy skips its noise.
    float leafFade = 1.0 - smoothstep(0.25, 0.6, footprint / ${LEAF.toFixed(2)});
    float clumpFade = 1.0 - smoothstep(0.25, 0.6, footprint / ${CLUMP.toFixed(2)});
    float leaf = 0.0;
    if (leafFade > 0.0) leaf = (scatterNoise(p / ${LEAF.toFixed(2)}) - 0.5) * leafFade;
    if (clumpFade > 0.0)
      leaf += (scatterNoise(p / ${CLUMP.toFixed(2)} + 17.0) - 0.5) * 0.7 * clumpFade;
    float height = clamp(vScatterCanopy - 1.0, 0.0, 1.0);
    // Boughs: a darker band between tiers, so a crown reads as layered rather than smooth.
    float tierFade = 1.0 - smoothstep(0.25, 0.6, footprint / ${TIER.toFixed(1)});
    float tier = 0.0;
    if (tierFade > 0.0) {
      // The clump noise wobbles each tier so no crown carries regular stripes.
      float wobble = scatterNoise(p / ${CLUMP.toFixed(2)} + 41.0) - 0.5;
      tier = pow(0.5 + 0.5 * cos(6.2831853 * (q.y / ${TIER.toFixed(1)} + wobble * 0.8)), 3.0) *
        tierFade;
    }
    float occlusion = mix(1.0, mix(0.5, 1.08, smoothstep(0.0, 0.95, height)) * (1.0 - 0.16 * tier),
      plant);
    return (1.0 + leaf * mix(0.12, 0.4, plant)) * occlusion;
  }
`;

/** WebGL scatter material: a standard vertex-color material with the detail in its hooks. */
export function createScatterMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial(parameters());
  material.name = 'worldgen:models';
  material.onBeforeCompile = (shader, renderer): void => {
    // Renderer-wide hooks (a Molen renderer's cloud shadows) live on the prototype.
    THREE.Material.prototype.onBeforeCompile.call(material, shader, renderer);
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
  material.customProgramCacheKey = (): string => 'worldgen-scatter@3';
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
      float,
      floor,
      Fn,
      fract,
      fwidth,
      If,
      materialColor,
      max,
      mix,
      positionGeometry,
      pow,
      cos,
      smoothstep,
      step,
      clamp,
      texture,
      uv,
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
  // Each layer only where it still shows, so distant canopy skips its noise. The derivative
  // comes first, outside the branches.
  const factor = Fn(() => {
    const footprint = max(fwidth(q).length(), 0.0001).toVar();
    const plant = step(0.5, canopy).toVar();
    const leafFade = smoothstep(0.25, 0.6, footprint.div(LEAF)).oneMinus().toVar();
    const clumpFade = smoothstep(0.25, 0.6, footprint.div(CLUMP)).oneMinus().toVar();
    const leaf = float(0).toVar();
    If(leafFade.greaterThan(0), () => {
      leaf.assign(
        noise(p.div(LEAF) as unknown as V2)
          .sub(0.5)
          .mul(leafFade),
      );
    });
    If(clumpFade.greaterThan(0), () => {
      leaf.addAssign(
        noise(p.div(CLUMP).add(17) as unknown as V2)
          .sub(0.5)
          .mul(0.7)
          .mul(clumpFade),
      );
    });
    const height = clamp(canopy.sub(1), 0, 1);
    // Boughs: a darker band between tiers, so a crown reads as layered rather than smooth.
    const tierFade = smoothstep(0.25, 0.6, footprint.div(TIER)).oneMinus().toVar();
    const tier = float(0).toVar();
    If(tierFade.greaterThan(0), () => {
      // The clump noise wobbles each tier so no crown carries regular stripes.
      const wobble = noise(p.div(CLUMP).add(41) as unknown as V2).sub(0.5);
      tier.assign(
        pow(
          cos(
            q.y
              .div(TIER)
              .add(wobble.mul(0.8))
              .mul(2 * Math.PI),
          )
            .mul(0.5)
            .add(0.5),
          3,
        ).mul(tierFade),
      );
    });
    const occlusion = mix(
      1,
      mix(0.5, 1.08, smoothstep(0, 0.95, height)).mul(tier.mul(0.16).oneMinus()),
      plant,
    );
    return leaf
      .mul(mix(0.12, 0.4, plant))
      .add(1)
      .mul(occlusion);
  })().toVar() as unknown as F;
  const material = new MeshStandardNodeMaterial(parameters());
  material.name = 'worldgen:models';
  const color = materialColor as unknown as Node<'vec4'>;
  material.colorNode = vec4(color.rgb.mul(factor), color.a);
  // The cut is a node, not `alphaTest`: Three copies each shadow caster's `alphaTest` onto the
  // light's one shadow-pass material, and every switch between a carded and a solid caster
  // bumped that material's version, so every caster after it rebuilt its render-object key
  // each frame (milliseconds of main thread at street level). The shadow mask samples the atlas
  // itself: in the shadow pass `materialColor` is the shadow material's own color, without the
  // atlas, and every card then cast its whole quad, a hard star of a shadow under each crown.
  material.alphaTest = 0;
  material.alphaTestNode = float(SCATTER_ALPHA_CUT);
  material.maskShadowNode = texture(material.map as THREE.Texture, uv()).a.greaterThanEqual(
    SCATTER_ALPHA_CUT,
  );
  // No uniforms of its own: replayed render bundles need not refresh every batch each frame.
  material.userData.bundleStatic = true;
  fullyLitTerms.set(material, float(1) as unknown as Node<'float'>);
  return material;
}

/**
 * Write the `canopy` attribute: relative height for plants (1 at the base to 2 at the top), 0 for
 * everything else. Every geometry the scatter material draws carries it, so all share a program.
 * A geometry without atlas coordinates also gets the solid `uv` (see `SCATTER_SOLID_UV`).
 */
export function setScatterCanopy(geometry: THREE.BufferGeometry, plant: boolean): void {
  const position = geometry.getAttribute('position');
  if (geometry.getAttribute('uv') === undefined) {
    const uvs = new Float32Array((position?.count ?? 0) * 2);
    for (let i = 0; i < uvs.length; i += 2) {
      uvs[i] = SCATTER_SOLID_UV[0];
      uvs[i + 1] = SCATTER_SOLID_UV[1];
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  }
  if (geometry.getAttribute(SCATTER_CANOPY_ATTRIBUTE) !== undefined) return;
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
