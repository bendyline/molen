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
const SPECK = 0.5;
/**
 * Soil's share where a speck shows. At 2 m cells and 22% the specks were olive blotches a meter
 * across, which read as camouflage from 15–40 m; small and faint they read as thin turf.
 */
const SPECK_SHARE = 0.14;
/** Share of the specks taken out from about 18 m on, with the turf grain that hid them. */
const SPECK_CALM = 0.6;
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
/**
 * Meters over which the 2 m-and-finer turf layers (clumps, grain and its warp, half- and
 * quarter-meter grain, specks) fade out with distance. Past about 60 m they are calmed to a
 * fifth or less and read as busy camouflage on a big lawn seen from the air, yet a lawn filling
 * an aerial view paid for every lookup: on an Apple M2 that view ran GPU-bound and throttled.
 */
const OCTAVE_REACH: [number, number] = [60, 120];
/** Mottling's share of brightness at full strength (value noise is mostly within ±0.3). */
const MOTTLE = 0.34;
/**
 * Share of the 2 m clump and 1 m grain layers taken out on turf (and of the 4 m layer, below).
 * At full weight they made blobs a meter or two across that read as camouflage from 15–40 m;
 * the half-meter grain keeps it grassy.
 */
const CALM_CLUMP = 0.65;
const CALM_GRAIN = 0.8;
/** Share of turf mottle taken out between 40 and 160 m from the camera. */
const LAWN_DISTANCE_CALM = 0.55;
/**
 * Half-meter grain taken out on turf, and quarter-meter grain added. Strong half-meter cells
 * read as blobs a meter across from 10–30 m (camouflage); quarter-meter grain reads as sward.
 */
const CALM_MICRO = 0.35;
const NANO_GAIN = 0.4;
/**
 * Share of the 4 m-to-quarter-meter turf layers taken out from about 18 m on. Up close they
 * are grass; from a rooftop or across a street at full weight they swung turf brightness ±20%
 * in blobs a meter across, which read as camouflage rather than lawn. At half weight a lawn
 * 20 m off still varied 11% in 10–20 pixel blotches; real turf there is near even.
 */
const TURF_CALM = 0.7;
/** How strongly turf brightness drives its cool/warm cast. */
const SHADE_GAIN = 1.5;
/** Straw-colored dry areas and darker, bluer lush areas on green ground. */
const DRY: [number, number, number] = [1.28, 1.08, 0.6];
const LUSH: [number, number, number] = [0.78, 0.96, 0.84];
/** Hue of turf mottled darker (lusher) and lighter (drier) than its average. */
const SHADE_COOL: [number, number, number] = [0.95, 1.0, 1.06];
const SHADE_WARM: [number, number, number] = [1.02, 1.0, 0.94];
/** Yellow-green and blue-green ends of the hue drift. */
const WARM: [number, number, number] = [1.03, 1.02, 0.93];
const COOL: [number, number, number] = [0.94, 1.0, 1.06];
/** Share of green ground's saturation taken out, so sunlit turf is grass, not lime. */
const MUTE = 0.16;
/**
 * Linear tint on green ground, after the mute: sunlit lawns had drifted to a pale olive (hue
 * about 69°, value 0.57 on screen) that read washed out and yellow; this brings them to about
 * 80° and a little darker, the green of watered turf, short of the palette's lime.
 */
const TURF: [number, number, number] = [0.82, 0.95, 0.8];
/** Linear color of bare soil showing through turf. */
const SOIL: [number, number, number] = [0.2, 0.15, 0.09];
/** Relief amplitude in meters per noise layer (clumps, tufts, close grain). */
const RELIEF: [number, number, number] = [0.08, 0.04, 0.016];
/**
 * Ground detail (the `landcoverDetail` attribute): shrub crowns covering this share of the
 * ground at full brush, and lighter bare-soil patches in 32 m cells. Half-meter orthophotos of
 * Yuma's open desert show separate round creosote and mesquite crowns, 2 to 5 m across, over
 * about 4% of vacant ground; single shrubs that small cannot be placed by the thousand, so the
 * ground carries them. Crowns fade in past the near range, where placed shrubs stand instead.
 */
const BRUSH_SHARE = 0.1;
/** One candidate crown per cell, its radius drawn from this range and kept inside the cell. */
const BRUSH_CELL = 8;
const BRUSH_RADIUS: [number, number] = [1, 2.6];
/** Ground covered when every cell holds a crown: the mean crown area over the cell area. */
const BRUSH_FULL =
  (Math.PI * (BRUSH_RADIUS[1] ** 3 - BRUSH_RADIUS[0] ** 3)) /
  (3 * (BRUSH_RADIUS[1] - BRUSH_RADIUS[0]) * BRUSH_CELL ** 2);
/** Meters per pixel over which crowns resolve; coarser, the ground takes their mean color. */
const BRUSH_RESOLVE: [number, number] = [0.5, 1.5];
const BRUSH_NEAR: [number, number] = [25, 60];
/** Linear crown colors, sunlit center and shaded rim: the olive brown of desert shrubs. */
const BRUSH_LIT: [number, number, number] = [0.088, 0.07, 0.026];
const BRUSH_RIM: [number, number, number] = [0.029, 0.024, 0.009];
/** A crown's area-weighted color: the rim blend, smoothstep(0.2, 1, r), averages 0.608. */
const rimMean = (i: 0 | 1 | 2): number => BRUSH_LIT[i] + (BRUSH_RIM[i] - BRUSH_LIT[i]) * 0.608;
const BRUSH_MEAN: [number, number, number] = [rimMean(0), rimMean(1), rimMean(2)];
const BARE_CELL = 32;
/** Linear lift of a worn, bare-soil patch over its ground. */
const BARE: [number, number, number] = [1.3, 1.24, 1.14];
const glslVec3 = (v: readonly number[]): string => `vec3(${v.map((x) => x.toFixed(3)).join(', ')})`;
/**
 * Texels across the shared lattice texture, and the largest cell read from it. A cell of 4 m or
 * finer repeats in 512 cells, a span that still divides the 4096 m period. One filtered fetch at
 * a smoothstep-remapped coordinate is exactly value noise, where hashing its four corners cost
 * about sixty instructions: most of the ground's per-pixel cost on an Apple M2.
 */
const NOISE_SIZE = 512;
const NOISE_MAX_CELL = 4;

let noiseLattice: THREE.DataTexture | undefined;

/** Random values at integer lattice points, wrapping and linearly filtered (shared, never disposed). */
function groundNoiseLattice(): THREE.DataTexture {
  if (noiseLattice === undefined) {
    const data = new Uint8Array(NOISE_SIZE * NOISE_SIZE);
    let state = 0x9e3779b9;
    for (let i = 0; i < data.length; i++) {
      // xorshift32: uncorrelated neighbours, the same lattice on every run.
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      data[i] = (state >>> 0) & 255;
    }
    noiseLattice = new THREE.DataTexture(
      data,
      NOISE_SIZE,
      NOISE_SIZE,
      THREE.RedFormat,
      THREE.UnsignedByteType,
    );
    noiseLattice.name = 'terrain:noise-lattice';
    noiseLattice.wrapS = noiseLattice.wrapT = THREE.RepeatWrapping;
    noiseLattice.magFilter = noiseLattice.minFilter = THREE.LinearFilter;
    noiseLattice.generateMipmaps = false;
    noiseLattice.needsUpdate = true;
  }
  return noiseLattice;
}

interface TerrainGroundState {
  origin: { value: THREE.Vector2 };
  strength: { value: number };
}

const states = new WeakMap<THREE.Material, TerrainGroundState>();

const GLSL = /* glsl */ `
  varying vec2 vTerrainGround;
  uniform float terrainGroundStrength;
  uniform sampler2D terrainGroundNoiseMap;

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
    if (cell <= ${NOISE_MAX_CELL.toFixed(1)})
      return textureLod(terrainGroundNoiseMap, (i + u + 0.5) / ${NOISE_SIZE.toFixed(1)}, 0.0).r;
    float a = terrainGroundHash(i, period);
    float b = terrainGroundHash(i + vec2(1.0, 0.0), period);
    float c = terrainGroundHash(i + vec2(0.0, 1.0), period);
    float d = terrainGroundHash(i + vec2(1.0, 1.0), period);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  // The lattice value of one integer cell: a texel center, so bilinear lookup returns it unblended.
  float terrainGroundCell(vec2 cell) {
    return textureLod(terrainGroundNoiseMap, (cell + 0.5) / ${NOISE_SIZE.toFixed(1)}, 0.0).r;
  }

  // Bare patches and shrub crowns (see BRUSH_SHARE). Where crowns fall below a pixel the ground
  // settles to their mean color at their share, so scrubland keeps its tone from the air.
  vec3 terrainGroundDetail(vec3 base, vec2 detail, float distance) {
    vec2 p = vTerrainGround;
    // Derivatives stay outside the branches: they are undefined in divergent control flow.
    float footprint = max(max(length(dFdx(p)), length(dFdy(p))), 0.0001);
    vec3 color = base;
    if (detail.y > 0.0) {
      float edge = 0.7 - 0.14 * detail.y;
      float patchShare = smoothstep(edge - 0.05, edge + 0.05,
        terrainGroundNoise(p + vec2(97.0, 41.0), ${BARE_CELL.toFixed(1)}));
      color *= mix(vec3(1.0), ${glslVec3(BARE)}, patchShare);
    }
    float share = detail.x * ${BRUSH_SHARE.toFixed(2)} *
      smoothstep(${BRUSH_NEAR[0].toFixed(1)}, ${BRUSH_NEAR[1].toFixed(1)}, distance);
    if (share > 0.0) {
      vec3 far = mix(color, ${glslVec3(BRUSH_MEAN)}, share);
      float resolved = 1.0 - smoothstep(${BRUSH_RESOLVE[0].toFixed(2)}, ${BRUSH_RESOLVE[1].toFixed(2)}, footprint);
      if (resolved > 0.0) {
        // One candidate crown per cell, present with probability share / BRUSH_FULL; its
        // radius and offset keep it inside the cell, so no neighbor is read.
        vec2 cell = floor(p / ${BRUSH_CELL.toFixed(1)});
        float radius = mix(${BRUSH_RADIUS[0].toFixed(2)}, ${BRUSH_RADIUS[1].toFixed(2)},
          terrainGroundCell(cell + vec2(57.0, 331.0)));
        vec2 jitter = vec2(terrainGroundCell(cell), terrainGroundCell(cell + vec2(211.0, 97.0))) - 0.5;
        vec2 center = (cell + 0.5) * ${BRUSH_CELL.toFixed(1)} + jitter * (${BRUSH_CELL.toFixed(1)} - 2.0 * radius);
        float d = length(p - center);
        float soft = max(footprint, 0.15);
        float crown = step(terrainGroundCell(cell + vec2(389.0, 23.0)), min(share / ${BRUSH_FULL.toFixed(4)}, 1.0)) *
          (1.0 - smoothstep(radius - soft, radius + soft, d));
        vec3 shaded = mix(${glslVec3(BRUSH_LIT)}, ${glslVec3(BRUSH_RIM)}, smoothstep(0.2, 1.0, d / radius));
        far = mix(far, mix(color, shaded, crown), resolved);
      }
      color = far;
    }
    return color;
  }

  // The share of the neighboring class at this pixel: the interpolated weight thresholded
  // against wandering noise, so a class boundary becomes an organic, ragged edge. Far away the
  // noise would shimmer, so it settles to the smooth weight.
  float terrainGroundEdge(float weight, float distance) {
    vec2 p = vTerrainGround;
    // Up close, half-meter tufts and then blade-scale specks break the contour, so one class
    // thins into the other rather than ending on a smooth blob outline or in blob islands.
    float footprint = max(max(length(dFdx(p)), length(dFdy(p))), 0.0001);
    // Within the last few meters the tufts and specks grow to dozens of pixels and read as torn
    // paper, so there the edge keeps only its broad wander.
    float underfoot = smoothstep(0.004, 0.016, footprint);
    float tuft = (1.0 - smoothstep(0.25, 0.6, footprint / ${TUFT.toFixed(1)})) * underfoot;
    float blade = (1.0 - smoothstep(0.25, 0.6, footprint / ${(BLADE * 2).toFixed(3)})) * underfoot;
    // Inside a class (no neighbor in reach, so the weight is 0 or 1) there is no edge to draw:
    // most landcover skips all four lookups, and the finest two wherever they have faded.
    if (weight <= 0.0 || weight >= 1.0) return weight;
    float n = terrainGroundNoise(p + vec2(57.0, 211.0), ${EDGE.toFixed(1)}) * 0.66 +
      terrainGroundNoise(p + vec2(13.0, 97.0), ${FRINGE.toFixed(1)}) * 0.24 +
      (tuft > 0.0 ? mix(0.5, terrainGroundNoise(p + vec2(31.0, 5.0), ${TUFT.toFixed(1)}), tuft) : 0.5) * 0.04 +
      (blade > 0.0 ? mix(0.5, terrainGroundNoise(p + vec2(19.0, 7.0), ${(BLADE * 2).toFixed(3)}), blade) : 0.5) * 0.06;
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
    float reach = 1.0 - smoothstep(${OCTAVE_REACH[0].toFixed(1)}, ${OCTAVE_REACH[1].toFixed(1)}, distance);
    nano *= reach;
    micro *= reach;
    grain *= reach;
    clump *= reach;
    specks *= reach;
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
    float calm = 1.0 - ${TURF_CALM.toFixed(2)} * green * smoothstep(6.0, 18.0, distance);
    float turf = (0.45 + 0.55 * green) * calm;
    float mottle =
      (terrainGroundNoise(p, ${BROAD.toFixed(1)}) - 0.5) * 0.55 * broad +
      (terrainGroundNoise(p, ${MID.toFixed(1)}) - 0.5) * 0.25 * (1.0 - 0.4 * green) * mid +
      (nFine - 0.5) * 0.22 * (1.0 - 0.6 * green) * fine * calm +
      (nClump - 0.5) * 0.24 * (1.0 - ${CALM_CLUMP.toFixed(2)} * green) * clump * turf +
      (nGrain - 0.5) * 0.9 * (1.0 - ${CALM_GRAIN.toFixed(2)} * green) * grain * turf +
      (nMicro - 0.5) * 0.8 * (1.0 - ${CALM_MICRO.toFixed(2)} * green) * micro * turf +
      (nNano - 0.5) * 0.7 * (1.0 + ${NANO_GAIN.toFixed(2)} * green) * nano * turf;
    // A lawn seen from 50–200 m reads as an even sward; full mottle there was a busy camouflage.
    mottle *= 1.0 - ${LAWN_DISTANCE_CALM.toFixed(2)} * green * smoothstep(40.0, 160.0, distance);
    float lum = 1.0 + mottle * ${MOTTLE.toFixed(3)} * terrainGroundStrength;
    // Darker turf is lusher and bluer, lighter turf drier and yellower: shade alone on a
    // yellow-green reads as olive camouflage.
    float turfShade = clamp((lum - 1.0) * ${SHADE_GAIN.toFixed(1)}, -1.0, 1.0);
    vec3 turfCast = turfShade < 0.0 ? ${glslVec3(SHADE_COOL)} : ${glslVec3(SHADE_WARM)};
    // Dry and lush patches, hue drift and bare specks only tint green ground: skip their
    // lookups elsewhere (paving, sand, rock), and the specks wherever they have faded.
    float area = 0.5, hue = 0.5, speck = 0.0;
    if (green > 0.0) {
      area = terrainGroundNoise(p + vec2(311.0, 173.0), ${PATCH.toFixed(1)});
      hue = terrainGroundNoise(p + vec2(71.0, 29.0), ${HUE.toFixed(1)});
      if (specks > 0.0)
        speck = smoothstep(0.68, 0.82, terrainGroundNoise(p + vec2(5.0, 143.0), ${SPECK.toFixed(1)}));
    }
    float dry = clamp(smoothstep(0.5, 0.78, area) * green * broad * 0.3 * terrainGroundStrength, 0.0, 1.0);
    float lush = clamp((1.0 - smoothstep(0.22, 0.45, area)) * green * broad * 0.35 * terrainGroundStrength, 0.0, 1.0);
    vec3 tint = mix(vec3(1.0), ${glslVec3(DRY)}, dry) * mix(vec3(1.0), ${glslVec3(LUSH)}, lush);
    tint *= mix(vec3(1.0), mix(${glslVec3(WARM)}, ${glslVec3(COOL)}, hue),
      clamp(green * mid * 0.35 * terrainGroundStrength, 0.0, 1.0));
    speck = clamp(speck * green * specks * ${SPECK_SHARE.toFixed(2)} * terrainGroundStrength *
      (1.0 - ${SPECK_CALM.toFixed(2)} * smoothstep(6.0, 18.0, distance)), 0.0, 1.0);
    tint *= mix(vec3(1.0), ${glslVec3(SOIL)} / max(base, vec3(0.001)), speck);
    tint *= mix(vec3(1.0), turfCast, abs(turfShade) * green * 0.6 * terrainGroundStrength);
    // Sunlit turf reads lime when a palette green is lit at full strength; mute it a little.
    vec3 muted = mix(vec3(dot(base, vec3(0.2126, 0.7152, 0.0722))), base, ${(1 - MUTE).toFixed(2)});
    tint *= mix(vec3(1.0), muted / max(base, vec3(0.001)) * ${glslVec3(TURF)},
      clamp(green * terrainGroundStrength, 0.0, 1.0));
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
  cell: (cell: Node<'vec2'>) => Node<'float'>;
} {
  const { dot, float, floor, fract, mix, texture, vec2, vec3 } = tsl;
  type F = Node<'float'>;
  type V2 = Node<'vec2'>;
  const lattice = groundNoiseLattice();
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
    // Sampled at mip 0 explicitly: the call sits inside layer branches, where implicit
    // derivatives are undefined.
    if (size <= NOISE_MAX_CELL) {
      const sampled = texture(lattice, i.add(u).add(0.5).div(NOISE_SIZE) as unknown as V2).level(
        float(0) as unknown as Node,
      ) as unknown as Node<'vec4'>;
      return sampled.r as unknown as F;
    }
    const a = hash(i, period);
    const b = hash(i.add(vec2(1, 0)), period);
    const c = hash(i.add(vec2(0, 1)), period);
    const d = hash(i.add(vec2(1, 1)), period);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) as unknown as F;
  };
  // terrainGroundCell: one integer cell's lattice value, read at its texel center.
  const cell = (c: V2): F =>
    (
      texture(lattice, c.add(0.5).div(NOISE_SIZE) as unknown as V2).level(
        float(0) as unknown as Node,
      ) as unknown as Node<'vec4'>
    ).r as unknown as F;
  return { hash, noise, cell };
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
  material.onBeforeCompile = (shader, renderer): void => {
    // Renderer-wide hooks (a Molen renderer's cloud shadows) live on the prototype.
    THREE.Material.prototype.onBeforeCompile.call(material, shader, renderer);
    Object.assign(shader.uniforms, {
      terrainGroundOrigin: state.origin,
      terrainGroundStrength: state.strength,
      terrainGroundNoiseMap: { value: groundNoiseLattice() },
    });
    shader.vertexShader = `
      ${options.agriculture ? 'attribute vec4 agricultureRows; attribute vec3 agricultureSoil; attribute vec4 landcoverBlend; attribute vec2 landcoverDetail; varying vec4 vAgricultureRows; varying vec3 vAgricultureSoil; varying vec4 vLandcoverBlend; varying vec2 vLandcoverDetail;' : ''}
      varying vec2 vTerrainGround;
      uniform vec2 terrainGroundOrigin;
    ${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vTerrainGround = (modelMatrix * vec4(transformed, 1.0)).xz + terrainGroundOrigin;
       ${options.agriculture ? 'vAgricultureRows = agricultureRows; vAgricultureSoil = agricultureSoil; vLandcoverBlend = landcoverBlend; vLandcoverDetail = landcoverDetail;' : ''}`,
    );
    shader.fragmentShader = `${GLSL}
      ${options.agriculture ? 'varying vec4 vAgricultureRows; varying vec3 vAgricultureSoil; varying vec4 vLandcoverBlend; varying vec2 vLandcoverDetail;' : ''}
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
       diffuseColor.rgb = mix(diffuseColor.rgb, fieldColor * strip, vAgricultureRows.z);
       diffuseColor.rgb = terrainGroundDetail(diffuseColor.rgb, vLandcoverDetail, terrainGroundDistance);`
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
    `terrain-ground@34:${options.agriculture === true}`;
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
    floor,
    Fn,
    fract,
    If,
    and,
    materialColor,
    max,
    min,
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
  const { noise, cell } = tslNoise(tsl);
  const origin = uniform(new THREE.Vector2()).setName('terrainGroundOrigin');
  const amount = uniform(strength(options)).setName('terrainGroundStrength');
  const p = positionWorld.xz.add(origin).toVar() as unknown as V2;
  const distance = positionView.length().toVar();
  const footprint = max(max(dFdx(p).length(), dFdy(p).length()), 0.0001).toVar();
  const fade = (cell: number): F =>
    smoothstep(0.25, 0.6, footprint.div(cell)).oneMinus() as unknown as F;
  const reach = smoothstep(OCTAVE_REACH[0], OCTAVE_REACH[1], distance).oneMinus().toVar();
  const near = (cell: number): F => fade(cell).mul(reach).toVar() as unknown as F;
  const nano = near(NANO);
  const blade = fade(BLADE);
  const micro = near(MICRO);
  const grain = near(GRAIN);
  const fine = fade(FINE);
  const clump = near(CLUMP);
  const specks = near(SPECK);
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
  // Within the last few meters the tufts and specks grow to dozens of pixels and read as torn
  // paper, so there the land-class edge keeps only its broad wander.
  const underfoot = smoothstep(0.004, 0.016, footprint);
  const tuft = fade(TUFT).mul(underfoot) as unknown as F;
  const speckle = fade(BLADE * 2).mul(underfoot) as unknown as F;
  if (options.agriculture) {
    const blend = varying(attribute('landcoverBlend', 'vec4')) as unknown as Node<'vec4'>;
    // Up close, half-meter tufts and then blade-scale specks break the contour, so one class
    // thins into the other rather than ending on a smooth blob outline or in blob islands.
    // Inside a class (no neighbor in reach, so the weight is 0 or 1) there is no edge to draw:
    // most landcover skips all four lookups, and the finest two wherever they have faded.
    const cover = Fn(() => {
      const result = blend.x.toVar();
      If(and(blend.x.greaterThan(0), blend.x.lessThan(1)), () => {
        const fine = vec2(0.5, 0.5).toVar();
        If(tuft.greaterThan(0), () => {
          fine.x.assign(noise(p.add(vec2(31, 5)) as unknown as V2, TUFT));
        });
        If(speckle.greaterThan(0), () => {
          fine.y.assign(noise(p.add(vec2(19, 7)) as unknown as V2, BLADE * 2));
        });
        const n = clamp(
          noise(p.add(vec2(57, 211)) as unknown as V2, EDGE)
            .mul(0.66)
            .add(noise(p.add(vec2(13, 97)) as unknown as V2, FRINGE).mul(0.24))
            .add(mix(0.5, fine.x, tuft).mul(0.04))
            .add(mix(0.5, fine.y, speckle).mul(0.06))
            .sub(0.5)
            .mul(1.7)
            .add(0.5),
          0,
          1,
        );
        const edge = blend.x.mul(1.24).sub(0.12);
        const organic = smoothstep(edge.sub(0.16), edge.add(0.16), n).oneMinus();
        result.assign(mix(blend.x, organic, smoothstep(200, 700, distance).oneMinus()));
      });
      return result;
    })();
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
    // Bare patches and shrub crowns, as terrainGroundDetail in the GLSL path.
    const detail = varying(attribute('landcoverDetail', 'vec2')) as unknown as Node<'vec2'>;
    const resolved = smoothstep(BRUSH_RESOLVE[0], BRUSH_RESOLVE[1], footprint).oneMinus();
    const groundBase = base;
    const detailed = Fn(() => {
      const color = groundBase.toVar();
      If(detail.y.greaterThan(0), () => {
        const edge = detail.y.mul(-0.14).add(0.7);
        const patchShare = smoothstep(
          edge.sub(0.05),
          edge.add(0.05),
          noise(p.add(vec2(97, 41)) as unknown as V2, BARE_CELL),
        );
        color.mulAssign(mix(vec3(1), vec3(...BARE), patchShare));
      });
      const share = detail.x
        .mul(BRUSH_SHARE)
        .mul(smoothstep(BRUSH_NEAR[0], BRUSH_NEAR[1], distance))
        .toVar();
      If(share.greaterThan(0), () => {
        const far = mix(color, vec3(...BRUSH_MEAN), share).toVar();
        If(resolved.greaterThan(0), () => {
          const at = floor(p.div(BRUSH_CELL)).toVar() as unknown as V2;
          const radius = mix(
            BRUSH_RADIUS[0],
            BRUSH_RADIUS[1],
            cell(at.add(vec2(57, 331)) as unknown as V2),
          ).toVar();
          const jitter = vec2(cell(at), cell(at.add(vec2(211, 97)) as unknown as V2)).sub(0.5);
          const center = at
            .add(0.5)
            .mul(BRUSH_CELL)
            .add(jitter.mul(radius.mul(-2).add(BRUSH_CELL)));
          const d = p.sub(center).length().toVar();
          const soft = max(footprint, 0.15);
          const crown = step(
            cell(at.add(vec2(389, 23)) as unknown as V2),
            min(share.div(BRUSH_FULL), 1),
          ).mul(smoothstep(radius.sub(soft), radius.add(soft), d).oneMinus());
          const shaded = mix(
            vec3(...BRUSH_LIT),
            vec3(...BRUSH_RIM),
            smoothstep(0.2, 1, d.div(radius)),
          );
          far.assign(mix(far, mix(color, shaded, crown), resolved));
        });
        color.assign(far);
      });
      return color;
    })().toVar() as unknown as V3;
    factor = factor.mul(detailed.div(max(base, vec3(0.001)))) as unknown as V3;
    base = detailed;
  }
  const green = clamp(base.g.sub(max(base.r, base.b)).mul(10), 0, 1).toVar();
  const calm = green
    .mul(smoothstep(6, 18, distance))
    .mul(-TURF_CALM)
    .add(1)
    .toVar();
  const turf = green.mul(0.55).add(0.45).mul(calm);
  const mottle = noise(p, BROAD)
    .sub(0.5)
    .mul(0.55)
    .mul(broad)
    .add(noise(p, MID).sub(0.5).mul(green.mul(-0.4).add(1).mul(0.25)).mul(mid))
    .add(nFine.sub(0.5).mul(green.mul(-0.6).add(1).mul(0.22)).mul(fine).mul(calm))
    .add(nClump.sub(0.5).mul(green.mul(-CALM_CLUMP).add(1).mul(0.24)).mul(clump).mul(turf))
    .add(nGrain.sub(0.5).mul(green.mul(-CALM_GRAIN).add(1).mul(0.9)).mul(grain).mul(turf))
    .add(nMicro.sub(0.5).mul(green.mul(-CALM_MICRO).add(1).mul(0.8)).mul(micro).mul(turf))
    .add(nNano.sub(0.5).mul(green.mul(NANO_GAIN).add(1).mul(0.7)).mul(nano).mul(turf));
  // A lawn seen from 50–200 m reads as an even sward; full mottle there was a busy camouflage.
  const lum = mottle
    .mul(
      green
        .mul(smoothstep(40, 160, distance))
        .mul(-LAWN_DISTANCE_CALM)
        .add(1),
    )
    .mul(MOTTLE)
    .mul(amount)
    .add(1);
  // Darker turf is lusher and bluer, lighter turf drier and yellower: shade alone on a
  // yellow-green reads as olive camouflage.
  const shade = clamp(lum.sub(1).mul(SHADE_GAIN), -1, 1);
  const cast = mix(vec3(...SHADE_WARM), vec3(...SHADE_COOL), step(shade, 0));
  // Dry and lush patches, hue drift and bare specks only tint green ground: skip their lookups
  // elsewhere (paving, sand, rock), and the specks wherever they have faded.
  const greenNoise = Fn(() => {
    const result = vec3(0.5, 0.5, 0).toVar();
    If(green.greaterThan(0), () => {
      result.x.assign(noise(p.add(vec2(311, 173)) as unknown as V2, PATCH));
      result.y.assign(noise(p.add(vec2(71, 29)) as unknown as V2, HUE));
      If(specks.greaterThan(0), () => {
        result.z.assign(smoothstep(0.68, 0.82, noise(p.add(vec2(5, 143)) as unknown as V2, SPECK)));
      });
    });
    return result;
  })().toVar() as unknown as V3;
  const area = greenNoise.x;
  const dry = clamp(smoothstep(0.5, 0.78, area).mul(green).mul(broad).mul(0.3).mul(amount), 0, 1);
  const lush = clamp(
    smoothstep(0.22, 0.45, area).oneMinus().mul(green).mul(broad).mul(0.35).mul(amount),
    0,
    1,
  );
  const hue = greenNoise.y;
  const drift = mix(
    vec3(1),
    mix(vec3(...WARM), vec3(...COOL), hue),
    clamp(green.mul(mid).mul(0.35).mul(amount), 0, 1),
  );
  const speck = clamp(
    greenNoise.z
      .mul(green)
      .mul(specks)
      .mul(SPECK_SHARE)
      .mul(amount)
      .mul(smoothstep(6, 18, distance).mul(-SPECK_CALM).add(1)),
    0,
    1,
  );
  const bare = mix(vec3(1), vec3(...SOIL).div(max(base, vec3(0.001))), speck);
  // Sunlit turf reads lime when a palette green is lit at full strength; mute it a little.
  const muted = mix(vec3(dot(base, vec3(0.2126, 0.7152, 0.0722))), base, 1 - MUTE)
    .div(max(base, vec3(0.001)))
    .mul(vec3(...TURF));
  const tint = mix(vec3(1), vec3(...DRY), dry)
    .mul(mix(vec3(1), vec3(...LUSH), lush))
    .mul(drift)
    .mul(bare)
    .mul(mix(vec3(1), cast, abs(shade).mul(green).mul(0.6).mul(amount)))
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
/** Tint of the soil margin where paving meets the ground (a factor over the paving color). */
const VERGE: [number, number, number] = [0.63, 0.62, 0.5];
/** Footprint (meters per pixel) by which the soil margin is gone: past it, a third of a meter of
 * tan along every paved edge drew a ruled outline round each lawn from rooftop height. */
const VERGE_FADE = 0.12;
/** Asphalt aggregate: chip size in meters, and how much pale chips lighten and pits darken. */
const STONE = 0.03125;
const STONE_LIGHT = 0.28;
const STONE_DARK = 0.22;
/** How far tufts of lawn creep over cast paving, and the size of a tuft, meters. */
const CREEP = 0.1;
const CREEP_TUFT = 0.35;

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
    // Each layer only where it still shows: past its fade every term it feeds is zero, so a
    // distant view skips those noise lookups. Derivatives stay outside the branches, where
    // they are defined; a branch's boundary lies where its terms have already faded out.
    // Aggregate a few centimeters across at eye level, then quarter-meter and meter grain.
    float pebble = 1.0 - smoothstep(0.25, 0.6, footprint / 0.0625);
    float chip = 1.0 - smoothstep(0.25, 0.6, footprint / ${STONE.toFixed(5)});
    float grain = 0.0;
    float stones = 0.0;
    if (near > 0.0) {
      grain = (terrainGroundNoise(p, 1.0) - 0.5) * 0.7 * near;
      if (close > 0.0) {
        grain += (terrainGroundNoise(p, 0.25) - 0.5) * close;
        if (pebble > 0.0) {
          grain += (terrainGroundNoise(p, 0.0625) - 0.5) * 0.8 * pebble;
          // Stones in the binder: pale chips and dark pits, crisp rather than a soft grain.
          if (chip > 0.0) stones = (smoothstep(0.7, 0.78,
            terrainGroundNoise(p + vec2(0.37, 0.11), ${STONE.toFixed(5)})) * ${STONE_LIGHT.toFixed(2)} -
            smoothstep(0.72, 0.8, terrainGroundNoise(p + vec2(0.71, 0.53), ${STONE.toFixed(5)})) *
            ${STONE_DARK.toFixed(2)}) * chip;
        }
      }
    }
    float blotch = (terrainGroundNoise(p, 16.0) - 0.5) * 0.8;
    if (mid > 0.0) blotch += (terrainGroundNoise(p, 4.0) - 0.5) * mid;
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
    float wear = isRoad * step(0.5, lane) * mid;
    if (wear > 0.0) {
      float q = fract(across / max(lane, 0.5));
      float tracks = exp(-pow((q - 0.27) / 0.075, 2.0)) + exp(-pow((q - 0.73) / 0.075, 2.0));
      float drip = exp(-pow((q - 0.5) / 0.06, 2.0)) *
        smoothstep(0.35, 0.75, terrainGroundNoise(p + vec2(41.0, 9.0), 2.0));
      vec2 patchCell = vec2(floor(along / 9.0), floor(across / max(lane, 0.5)));
      float patchPick = terrainGroundHash(patchCell + vec2(17.0, 5.0), 65536.0);
      vec2 patchLocal = vec2(along - patchCell.x * 9.0, across - patchCell.y * max(lane, 0.5));
      float repair = step(0.8, patchPick) * terrainPavementBox(patchLocal,
        vec2(1.0 + patchPick * 2.0, 0.3), vec2(6.5 + patchPick * 2.0, max(lane, 0.5) - 0.3), aa);
      wear *= 0.16 * tracks + 0.12 * drip + 0.06 * repair;
    }
    // Grit and oil collect along a road's edges, in the gutters.
    float width = code - kind * 128.0;
    float gutter = isRoad * mid * (1.0 - smoothstep(0.0, 0.6, min(across, width - across)));
    float stains = isParking * mid * 0.24;
    if (stains > 0.0) stains *= smoothstep(0.62, 0.86,
      terrainGroundNoise(p + vec2(31.0, 7.0), 2.0) * 0.6 + terrainGroundNoise(p + vec2(9.0, 47.0), 1.0) * 0.4);
    float asphalt = (1.0 + grain * 0.24 + blotch * 0.26) * (1.0 + stones) * (1.0 - wear) *
      (1.0 - stains) * (1.0 - 0.22 * gutter);
    // Concrete: slabs with saw-cut joints (1.5 m sidewalk, 3 m curb), each slab its own tone.
    float slab = isSidewalk * 1.5 + isCurb * 3.0 + (1.0 - isConcrete) * 1.5;
    float joint = terrainPavementLine(along, slab, 0.009);
    float slabTone = terrainGroundHash(vec2(floor(along / slab), 3.0 + isCurb), 65536.0);
    float concrete = (0.95 + slabTone * 0.09) * (1.0 + grain * 0.12 + blotch * 0.1) *
      (1.0 - 0.34 * joint);
    // Concrete weathers: darker water and grime stains a meter or two across from mid distance,
    // and close up the odd dark spot of gum or oil, so a sidewalk is not new-poured.
    float weather = isConcrete * mid;
    if (weather > 0.0) {
      weather *= smoothstep(0.45, 0.95, terrainGroundNoise(p + vec2(37.0, 19.0), 2.0) * 0.6 +
        terrainGroundNoise(p + vec2(13.0, 59.0), 0.5) * 0.4) * 0.11;
      if (pebble > 0.0) weather += isConcrete * pebble * 0.18 *
        smoothstep(0.84, 0.92, terrainGroundNoise(p + vec2(71.0, 3.0), 0.125));
    }
    concrete *= 1.0 - weather;
    // Pavers: a half-meter grid in world space.
    float pavers = max(terrainPavementLine(p.x, 0.5, 0.006), terrainPavementLine(p.y, 0.5, 0.006));
    float paverTone = terrainGroundHash(floor(p / 0.5), 8192.0);
    float plaza = (0.94 + paverTone * 0.1) * (1.0 - 0.3 * pavers) * (1.0 + grain * 0.1);
    // Paint wears through to the asphalt beneath in patches.
    float worn = isPaint * near;
    if (worn > 0.0) worn = smoothstep(0.52, 0.8, terrainGroundNoise(p, 0.5) * 0.6 +
      terrainGroundNoise(p + vec2(3.0, 61.0), 0.25) * 0.4) * 0.6 * near;
    vec3 paint = mix(vec3(1.0), vec3(0.032, 0.036, 0.04) / max(base, vec3(0.001)), worn) *
      (0.97 + grain * 0.08);
    // A 12 cm line must not remain a bright pixel-wide stripe at airplane altitude.
    paint = mix(vec3(0.093, 0.100, 0.104) / max(base, vec3(0.001)), paint,
      smoothstep(0.25, 1.25, width / max(footprint, 0.0001)));
    float loose = 1.0 + grain * 0.35 + blotch * 0.2;
    float plain = 1.0 + blotch * 0.08;
    float isPlain = 1.0 - clamp(isAsphalt + isConcrete + isPaint + isPlaza + isLoose, 0.0, 1.0);
    // Lived-in detail: hairline cracks in asphalt and concrete, a manhole cover in a lane on most
    // 45 m stretches of road, and storm-drain grates along the gutters.
    float crackField = 0.5;
    float crackMask = 0.0;
    if (near > 0.0) {
      crackField = terrainGroundNoise(p + vec2(23.0, 11.0), 2.0);
      crackMask = smoothstep(0.62, 0.8, terrainGroundNoise(p + vec2(5.0, 71.0), 8.0));
    }
    float crackWidth = max(fwidth(crackField) * 1.5, 0.002);
    float crack = (1.0 - smoothstep(0.0, crackWidth, abs(crackField - 0.5))) * crackMask * near *
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
    // Underfoot (the last few meters) the margin's cells grow to dozens of pixels and read as
    // torn paper, so it closes back to the band's formed edge there.
    float underfoot = smoothstep(0.004, 0.016, footprint);
    // Lawn grows over the one frayed edge of a street sidewalk or a parking lot (its lawn side) in
    // tufts a hand's width wide, read from mid distance down. Not over footpaths or plazas: those
    // often abut other paving, where tufts would cut a ragged seam between two slabs.
    float lawnSide = (isSidewalk + isParking) * step(0.5, soft) * (1.0 - step(2.5, soft));
    // The margin reaches under a meter into the band, so only fragments within 2 m of a frayed
    // edge pay for its noise.
    float fray = 0.0;
    float spill = 0.5;
    if (edge < 2.0) {
      spill = terrainGroundNoise(p + vec2(43.0, 17.0), 0.5);
      float ragged = mix(fine, coarse, isLoose);
      if (ragged > 0.0) {
        float clump = terrainGroundNoise(p + vec2(13.0, 2.0), 0.2) - 0.5;
        float blades = blade > 0.0 ? (terrainGroundNoise(p + vec2(3.0, 31.0), 0.05) - 0.5) * blade : 0.0;
        float tatter = 0.5 + clump * 0.3 + blades * 1.4;
        if (isLoose > 0.0) tatter = 0.5 +
          (terrainGroundNoise(p + vec2(7.0, 23.0), 0.8) - 0.5) * 0.35 + clump * 0.2 + blades * 1.3;
        fray = clamp(tatter, 0.0, 1.0) * mix(${FRAY.toFixed(2)}, ${LOOSE_FRAY.toFixed(2)}, isLoose) * ragged;
      }
      float creep = lawnSide * (1.0 - smoothstep(0.25, 0.6, footprint / 0.5));
      if (creep > 0.0) creep *= clamp(terrainGroundNoise(p + vec2(19.0, 7.0), ${CREEP_TUFT.toFixed(2)}) - 0.35, 0.0, 0.5) *
        2.0 * ${CREEP.toFixed(2)};
      fray = (fray + creep) * underfoot;
      // Farther off, a loose edge wanders over a few meters, by about three pixels (at most half
      // the band), so a dirt track or gravel shoulder never ends on a ruled line at any distance.
      float wander = isLoose * min(clamp(footprint * 2.5, 0.0, 0.6), width * 0.5) *
        (1.0 - smoothstep(0.25, 0.6, footprint / 3.0));
      if (wander > 0.0) fray += wander * terrainGroundNoise(p + vec2(29.0, 11.0), 3.0);
      fray *= min(terrainGroundStrength, 1.0);
    }
    // Soil washes and is tracked onto paving where it meets the ground: a patchy brown margin
    // about a third of a meter wide, so a lawn edge reads as worn rather than ruled, close up.
    float grime = (1.0 - smoothstep(0.0, 0.35, edge - fray)) * step(edge, 63.0) *
      (0.35 + 0.65 * smoothstep(0.3, 0.7, spill)) * 0.45 *
      (1.0 - smoothstep(0.25, 0.6, footprint / ${VERGE_FADE.toFixed(2)}));
    vec3 factor = mix(vec3(1.0), (isPaint > 0.5 ? paint : vec3(1.0)) * scalar *
      mix(vec3(1.0), ${glslVec3(VERGE)}, grime), terrainGroundStrength);
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
  material.onBeforeCompile = (shader, renderer): void => {
    // Renderer-wide hooks (a Molen renderer's cloud shadows) live on the prototype.
    THREE.Material.prototype.onBeforeCompile.call(material, shader, renderer);
    Object.assign(shader.uniforms, {
      terrainGroundOrigin: state.origin,
      terrainGroundStrength: state.strength,
      terrainGroundNoiseMap: { value: groundNoiseLattice() },
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
  material.customProgramCacheKey = (): string => 'terrain-pavement@29';
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
    float,
    floor,
    fract,
    Fn,
    If,
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
  // rgb: the detail factor; a: the frayed edge's coverage in pixels (below -0.5 is ground).
  const pavement = Fn(() => {
    const kind = floor(detail.z.div(128).add(0.001)).toVar() as unknown as F;
    const along = detail.x.toVar() as unknown as F;
    const across = detail.y;
    const lane = detail.w;
    // Derivatives first, in uniform control flow. Each layer below then runs only where it
    // still shows: past its fade every term it feeds is zero, so a distant view skips those
    // noise lookups, and a branch's boundary lies where its terms have already faded out.
    const footprint = max(max(dFdx(p).length(), dFdy(p).length()), 0.0001).toVar();
    const aa = max(fwidth(along), 0.0001).toVar() as unknown as F;
    const close = smoothstep(0.25, 0.6, footprint.div(0.25)).oneMinus().toVar();
    const near = smoothstep(0.25, 0.6, footprint.div(1)).oneMinus().toVar();
    const mid = smoothstep(0.25, 0.6, footprint.div(4)).oneMinus().toVar();
    // Aggregate a few centimeters across at eye level, then quarter-meter and meter grain.
    const pebble = smoothstep(0.25, 0.6, footprint.div(0.0625)).oneMinus().toVar();
    const chip = smoothstep(0.25, 0.6, footprint.div(STONE)).oneMinus().toVar();
    const grain = float(0).toVar();
    const stones = float(0).toVar();
    If(near.greaterThan(0), () => {
      grain.assign(noise(p, 1).sub(0.5).mul(0.7).mul(near));
      If(close.greaterThan(0), () => {
        grain.addAssign(noise(p, 0.25).sub(0.5).mul(close));
        If(pebble.greaterThan(0), () => {
          grain.addAssign(noise(p, 0.0625).sub(0.5).mul(0.8).mul(pebble));
          // Stones in the binder: pale chips and dark pits, crisp rather than a soft grain.
          If(chip.greaterThan(0), () => {
            stones.assign(
              smoothstep(0.7, 0.78, noise(p.add(vec2(0.37, 0.11)) as unknown as V2, STONE))
                .mul(STONE_LIGHT)
                .sub(
                  smoothstep(0.72, 0.8, noise(p.add(vec2(0.71, 0.53)) as unknown as V2, STONE)).mul(
                    STONE_DARK,
                  ),
                )
                .mul(chip),
            );
          });
        });
      });
    });
    const blotch = noise(p, 16).sub(0.5).mul(0.8).toVar();
    If(mid.greaterThan(0), () => {
      blotch.addAssign(noise(p, 4).sub(0.5).mul(mid));
    });
    // Variables, not expressions: an expression used both inside a branch and after it would
    // be assigned only where it was first built.
    const is = (k: number): F =>
      step(0.5, abs(kind.sub(k)))
        .oneMinus()
        .toVar() as unknown as F;
    const isRoad = is(1);
    const isSidewalk = is(2);
    const isCurb = is(3);
    const isPaint = is(4);
    const isParking = is(5);
    const isPlaza = is(6);
    const isLoose = step(6.5, kind).toVar() as unknown as F;
    const isAsphalt = isRoad.add(isParking);
    const isConcrete = isSidewalk.add(isCurb);
    const line = (coord: F, spacing: number | F, half: number): F => {
      const d = abs(fract(coord.div(spacing).add(0.5)).sub(0.5)).mul(spacing);
      const w = max(fwidth(coord), 0.0001);
      return smoothstep(half, w.add(half), d)
        .oneMinus()
        .mul(smoothstep(0.03, 0.12, w).oneMinus()) as unknown as F;
    };
    const laneWidth = max(lane, 0.5);
    const width = detail.z.sub(kind.mul(128)).toVar() as unknown as F;
    // Derivative-based terms, still outside any branch: joints, pavers, grate slats, covers.
    const slab = isSidewalk.mul(1.5).add(isCurb.mul(3)).add(isConcrete.oneMinus().mul(1.5));
    const joint = line(along, slab as unknown as F, 0.009).toVar();
    const pavers = max(
      line(p.x as unknown as F, 0.5, 0.006),
      line(p.y as unknown as F, 0.5, 0.006),
    ).toVar();
    const slats = line(along, 0.09, 0.022).toVar();
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
    const coverAa = max(fwidth(coverR), 0.004).toVar();
    const bump = (x: F, at: number, width: number): F =>
      exp(pow(x.sub(at).div(width), 2).negate()) as unknown as F;
    // Asphalt: polished wheel tracks, an oil line down each lane and the odd darker repaired
    // section, on lanes at mid distance and closer.
    const wear = isRoad.mul(step(0.5, lane)).mul(mid).toVar();
    If(wear.greaterThan(0), () => {
      const q = fract(across.div(laneWidth)) as unknown as F;
      const tracks = bump(q, 0.27, 0.075).add(bump(q, 0.73, 0.075));
      const drip = bump(q, 0.5, 0.06).mul(
        smoothstep(0.35, 0.75, noise(p.add(vec2(41, 9)) as unknown as V2, 2)),
      );
      const patchCell = vec2(floor(along.div(9)), floor(across.div(laneWidth)));
      const patchPick = hash(patchCell.add(vec2(17, 5)) as unknown as V2, 65536);
      const patchLocal = vec2(
        along.sub(patchCell.x.mul(9)),
        across.sub(patchCell.y.mul(laneWidth)),
      );
      const low = vec2(patchPick.mul(2).add(1), 0.3);
      const high = vec2(patchPick.mul(2).add(6.5), laneWidth.sub(0.3));
      const inside = clamp(patchLocal.sub(low).div(aa).add(0.5), 0, 1).mul(
        clamp(high.sub(patchLocal).div(aa).add(0.5), 0, 1),
      );
      const repair = step(0.8, patchPick).mul(inside.x).mul(inside.y);
      wear.mulAssign(tracks.mul(0.16).add(drip.mul(0.12)).add(repair.mul(0.06)));
    });
    // Grit and oil collect along a road's edges, in the gutters.
    const gutter = isRoad
      .mul(mid)
      .mul(smoothstep(0, 0.6, min(across, width.sub(across))).oneMinus());
    const stains = isParking.mul(mid).mul(0.24).toVar();
    If(stains.greaterThan(0), () => {
      stains.mulAssign(
        smoothstep(
          0.62,
          0.86,
          noise(p.add(vec2(31, 7)) as unknown as V2, 2)
            .mul(0.6)
            .add(noise(p.add(vec2(9, 47)) as unknown as V2, 1).mul(0.4)),
        ),
      );
    });
    const asphalt = grain
      .mul(0.24)
      .add(blotch.mul(0.26))
      .add(1)
      .mul(stones.add(1))
      .mul(wear.oneMinus())
      .mul(stains.oneMinus())
      .mul(gutter.mul(0.22).oneMinus());
    const slabTone = hash(vec2(floor(along.div(slab)), isCurb.add(3)) as unknown as V2, 65536);
    // Concrete weathers: darker water and grime stains a meter or two across from mid distance,
    // and close up the odd dark spot of gum or oil, so a sidewalk is not new-poured.
    const weather = isConcrete.mul(mid).toVar();
    If(weather.greaterThan(0), () => {
      weather.mulAssign(
        smoothstep(
          0.45,
          0.95,
          noise(p.add(vec2(37, 19)) as unknown as V2, 2)
            .mul(0.6)
            .add(noise(p.add(vec2(13, 59)) as unknown as V2, 0.5).mul(0.4)),
        ).mul(0.11),
      );
      If(pebble.greaterThan(0), () => {
        weather.addAssign(
          isConcrete
            .mul(pebble)
            .mul(0.18)
            .mul(smoothstep(0.84, 0.92, noise(p.add(vec2(71, 3)) as unknown as V2, 0.125))),
        );
      });
    });
    const concrete = slabTone
      .mul(0.09)
      .add(0.95)
      .mul(grain.mul(0.12).add(blotch.mul(0.1)).add(1))
      .mul(joint.mul(0.34).oneMinus())
      .mul(weather.oneMinus());
    const paverTone = hash(floor(p.div(0.5)) as unknown as V2, 8192);
    const plaza = paverTone
      .mul(0.1)
      .add(0.94)
      .mul(pavers.mul(0.3).oneMinus())
      .mul(grain.mul(0.1).add(1));
    // Paint wears through to the asphalt beneath in patches.
    const worn = isPaint.mul(near).toVar();
    If(worn.greaterThan(0), () => {
      worn.assign(
        smoothstep(
          0.52,
          0.8,
          noise(p, 0.5)
            .mul(0.6)
            .add(noise(p.add(vec2(3, 61)) as unknown as V2, 0.25).mul(0.4)),
        )
          .mul(0.6)
          .mul(near),
      );
    });
    const wornPaint = mix(vec3(1), vec3(0.032, 0.036, 0.04).div(max(base, vec3(0.001))), worn).mul(
      grain.mul(0.08).add(0.97),
    );
    const paint = mix(
      vec3(0.093, 0.1, 0.104).div(max(base, vec3(0.001))),
      wornPaint,
      smoothstep(0.25, 1.25, width.div(max(footprint, 0.0001))),
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
    const crackField = float(0.5).toVar();
    const crackMask = float(0).toVar();
    If(near.greaterThan(0), () => {
      crackField.assign(noise(p.add(vec2(23, 11)) as unknown as V2, 2));
      crackMask.assign(smoothstep(0.62, 0.8, noise(p.add(vec2(5, 71)) as unknown as V2, 8)));
    });
    const crackWidth = max(fwidth(crackField).mul(1.5), 0.002);
    const crack = smoothstep(0, crackWidth, abs(crackField.sub(0.5)))
      .oneMinus()
      .mul(crackMask)
      .mul(near)
      .mul(isAsphalt.add(isConcrete));
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
    // Underfoot (the last few meters) the margin's cells grow to dozens of pixels and read as
    // torn paper, so it closes back to the band's formed edge there.
    // Lawn grows over the one frayed edge of a street sidewalk or a parking lot (its lawn side) in
    // tufts a hand's width wide, read from mid distance down. Not over footpaths or plazas: those
    // often abut other paving, where tufts would cut a ragged seam between two slabs.
    const lawnSide = isSidewalk.add(isParking).mul(step(0.5, soft)).mul(step(2.5, soft).oneMinus());
    // The margin reaches under a meter into the band, so only fragments within 2 m of a frayed
    // edge pay for its noise.
    const fray = float(0).toVar();
    const spill = float(0.5).toVar();
    If(edge.lessThan(2), () => {
      spill.assign(noise(p.add(vec2(43, 17)) as unknown as V2, 0.5));
      const ragged = mix(fine, coarse, isLoose).toVar();
      If(ragged.greaterThan(0), () => {
        const clump = noise(p.add(vec2(13, 2)) as unknown as V2, 0.2)
          .sub(0.5)
          .toVar();
        const blades = float(0).toVar();
        If(blade.greaterThan(0), () => {
          blades.assign(
            noise(p.add(vec2(3, 31)) as unknown as V2, 0.05)
              .sub(0.5)
              .mul(blade),
          );
        });
        const tatter = clump.mul(0.3).add(blades.mul(1.4)).add(0.5).toVar();
        If(isLoose.greaterThan(0), () => {
          tatter.assign(
            noise(p.add(vec2(7, 23)) as unknown as V2, 0.8)
              .sub(0.5)
              .mul(0.35)
              .add(clump.mul(0.2))
              .add(blades.mul(1.3))
              .add(0.5),
          );
        });
        fray.assign(
          clamp(tatter, 0, 1)
            .mul(mix(FRAY, LOOSE_FRAY, isLoose))
            .mul(ragged),
        );
      });
      const creep = lawnSide.mul(smoothstep(0.25, 0.6, footprint.div(0.5)).oneMinus()).toVar();
      If(creep.greaterThan(0), () => {
        creep.mulAssign(
          clamp(noise(p.add(vec2(19, 7)) as unknown as V2, CREEP_TUFT).sub(0.35), 0, 0.5).mul(
            2 * CREEP,
          ),
        );
      });
      fray.assign(fray.add(creep).mul(smoothstep(0.004, 0.016, footprint)));
      // Farther off, a loose edge wanders over a few meters, by about three pixels (at most half
      // the band), so a dirt track or gravel shoulder never ends on a ruled line at any distance.
      const wander = isLoose
        .mul(min(clamp(footprint.mul(2.5), 0, 0.6), width.mul(0.5)))
        .mul(smoothstep(0.25, 0.6, footprint.div(3)).oneMinus())
        .toVar();
      If(wander.greaterThan(0), () => {
        fray.addAssign(wander.mul(noise(p.add(vec2(29, 11)) as unknown as V2, 3)));
      });
      fray.mulAssign(min(amount, 1));
    });
    // Soil washes and is tracked onto paving where it meets the ground: a patchy brown margin
    // about a third of a meter wide, so a lawn edge reads as worn rather than ruled, close up.
    const grime = smoothstep(0, 0.35, edge.sub(fray))
      .oneMinus()
      .mul(step(edge, 63))
      .mul(smoothstep(0.3, 0.7, spill).mul(0.65).add(0.35))
      .mul(0.45)
      .mul(smoothstep(0.25, 0.6, footprint.div(VERGE_FADE)).oneMinus());
    const factor = mix(
      vec3(1),
      mix(vec3(1), paint, isPaint)
        .mul(scalar)
        .mul(mix(vec3(1), vec3(...VERGE), grime)),
      amount,
    );
    // Coverage ramps across about a pixel at the frayed edge, so with multisampling alpha to
    // coverage antialiases the ragged margin instead of stair-stepping it.
    const margin = edge.sub(fray).toVar() as unknown as F;
    return vec4(factor, margin.div(max(fwidth(margin), 0.0001)));
  })().toVar() as unknown as Node<'vec4'>;
  const material = new MeshStandardNodeMaterial(pavementParameters(options));
  material.name = 'terrain-pavement';
  const color = materialColor as unknown as Node<'vec4'>;
  material.colorNode = vec4(color.rgb.mul(pavement.rgb), color.a);
  const coverage = pavement.a;
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
