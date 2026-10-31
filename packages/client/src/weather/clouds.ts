// Volumetric cloud deck shared by both graphics backends: the cloud model (types, quality
// levels, uniform values computed on the CPU each frame), the textures it samples, the proxy
// geometry it is drawn on and the WebGL material. The WebGPU material builds the same model
// from TSL nodes in three/webgpu-clouds.ts, reading these same uniform objects.
//
// The deck is ray-marched through a slab between the cloud base and top. It is drawn on proxy
// geometry where a view ray first enters the slab (a camera-centred plane at the base from
// below, at the top from above), so the ordinary depth test hides it behind nearer terrain,
// buildings and aircraft under any depth convention. Inside the slab it is drawn on nested
// camera-centred shells, each marching its own range, so an aircraft a few metres away is only
// hidden by the cloud actually in front of it.

import type { CloudType, ResolvedWeather, Vec3 } from '@bendyline/molen-schema';
import * as THREE from 'three';
import type { SkyFrame } from '../sky/visual';
import {
  CIRRUS_SIZE,
  CLOUD_DETAIL_SIZE,
  CLOUD_SHAPE_SIZE,
  CLOUD_WEATHER_SIZE,
  type CloudNoise,
} from './noise';

/**
 * How much work the cloud renderer does per pixel: ray-march steps, light samples, erosion
 * detail and, from 'high', cloud shadows on lit surfaces. Changing it never rebuilds a shader.
 */
export type CloudQuality = 'low' | 'medium' | 'high' | 'ultra';

interface QualitySettings {
  steps: number;
  lightSteps: number;
  detail: boolean;
  shadows: boolean;
}

const QUALITY: Record<CloudQuality, QualitySettings> = {
  low: { steps: 10, lightSteps: 2, detail: false, shadows: false },
  medium: { steps: 20, lightSteps: 3, detail: false, shadows: false },
  high: { steps: 28, lightSteps: 4, detail: true, shadows: true },
  ultra: { steps: 44, lightSteps: 5, detail: true, shadows: true },
};

/** Upper bounds of the shader loops; QUALITY, deepened for thick layers, may not exceed them. */
export const CLOUD_MAX_STEPS = 64;
export const CLOUD_MAX_LIGHT_STEPS = 6;

export function cloudQualitySettings(quality: CloudQuality): Readonly<QualitySettings> {
  return QUALITY[quality];
}

interface TypeShape {
  /** Weather-map channel weights: cumulus cells, column height, stratocumulus, storm cells. */
  mix: [number, number, number, number];
  /** Weather-map repeats per `clouds.scale`. */
  frequency: number;
  /** Shortest column top, as a fraction of the layer thickness. */
  topMin: number;
  /** Height fraction over which the flat base fills in. */
  baseRise: number;
  /** Height fraction where tops begin to round off. */
  topSoft: number;
  /** Spread near the top, 0–1 (cumulonimbus anvils). */
  anvil: number;
  /** How much thinner a column is where the weather field is weak (lumps in a closed layer). */
  relief: number;
  /** How much a cloud narrows from base to top, in weather-field units (domes, towers). */
  taper: number;
  /** How strongly the 3D billow noise carves the body, 0 (sheet) to 1 (cauliflower). */
  shapeErosion: number;
  /** Fine wisps worn from edges at the higher qualities. */
  detailErosion: number;
  /** Billow noise repeat, meters. */
  shapeTile: number;
}

const TYPES: Record<CloudType, TypeShape> = {
  cumulus: {
    mix: [1, 0, 0, 0],
    frequency: 1,
    topMin: 0.45,
    baseRise: 0.06,
    topSoft: 0.3,
    anvil: 0,
    relief: 0.35,
    taper: 0.3,
    shapeErosion: 1,
    detailErosion: 0.3,
    shapeTile: 1700,
  },
  stratocumulus: {
    mix: [0, 0, 1, 0],
    frequency: 1,
    topMin: 0.7,
    baseRise: 0.12,
    topSoft: 0.5,
    anvil: 0,
    relief: 0.55,
    taper: 0.12,
    shapeErosion: 0.75,
    detailErosion: 0.22,
    shapeTile: 2000,
  },
  stratus: {
    mix: [0.5, 0, 0.5, 0],
    frequency: 0.5,
    topMin: 0.85,
    baseRise: 0.2,
    topSoft: 0.55,
    anvil: 0,
    relief: 0.3,
    taper: 0.04,
    shapeErosion: 0.3,
    detailErosion: 0.1,
    shapeTile: 4500,
  },
  cumulonimbus: {
    mix: [0, 0, 0, 1],
    frequency: 1,
    topMin: 0.6,
    baseRise: 0.04,
    topSoft: 0.8,
    anvil: 1,
    relief: 0.25,
    taper: 0.35,
    shapeErosion: 1,
    detailErosion: 0.28,
    shapeTile: 6000,
  },
};

/** Extinction per meter at full density and `clouds.density` 1. */
const EXTINCTION = 0.08;
/** Coverage edge width in weather-map units: how gradually a cloud thins out at its margin. */
const SOFTNESS = 0.15;
/** At most how many times longer a view ray's last march step is than its first. */
export const CLOUD_STEP_GROWTH = 6;
/** Longest stretch of a view ray marched through the slab, meters. */
const MAX_PATH = 30_000;
/** Farthest drawn cloud, meters (also bounded by the camera's far plane). */
const MAX_DISTANCE = 140_000;
/** Shell radii for views inside the slab, meters; the last range ends at the draw distance. */
export const CLOUD_SHELLS: readonly number[] = [3, 30, 250, 2000, 12000];

const fract = (x: number): number => x - Math.floor(x);
const clamp = (x: number): number => Math.max(0, Math.min(1, x));
function smooth(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}
function hash(seed: number, salt: number): number {
  let h = Math.imul(seed ^ salt, 2654435761);
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

/**
 * GPU textures over the page's shared noise arrays (see noise.ts). One set per renderer: the
 * cloud-shadow uniforms of every lit shader keep the weather map for the renderer's lifetime.
 */
export class CloudTextures {
  readonly weather: THREE.DataTexture;
  /**
   * The weather map at a sixteenth of its texels (about 250 m each at the default scale), for
   * cloud shadows: plain bilinear filtering of it gives their soft edges with one lookup.
   */
  readonly shadow: THREE.DataTexture;
  readonly shape: THREE.Data3DTexture;
  readonly detail: THREE.Data3DTexture;
  /** Cirrus RGBA; its alpha is rewritten for each coverage (see WeatherVisual). */
  readonly cirrus: THREE.DataTexture;
  private uploaded = new Set<string>();

  constructor(readonly noise: CloudNoise) {
    this.weather = new THREE.DataTexture(noise.weather, CLOUD_WEATHER_SIZE, CLOUD_WEATHER_SIZE);
    this.weather.wrapS = this.weather.wrapT = THREE.RepeatWrapping;
    this.weather.magFilter = THREE.LinearFilter;
    // Blurred levels for soft cloud-shadow edges and distant march steps. Built on the CPU (see
    // sync): three r184's WebGPU backend allocates but never fills a data texture's levels.
    this.weather.minFilter = THREE.LinearMipmapLinearFilter;
    this.weather.generateMipmaps = false;
    this.weather.colorSpace = THREE.NoColorSpace;
    this.weather.name = 'molen:cloud-weather';
    const shadowSize = CLOUD_WEATHER_SIZE / 4;
    this.shadow = new THREE.DataTexture(
      new Uint8Array(shadowSize ** 2 * 4),
      shadowSize,
      shadowSize,
    );
    this.shadow.wrapS = this.shadow.wrapT = THREE.RepeatWrapping;
    this.shadow.magFilter = this.shadow.minFilter = THREE.LinearFilter;
    this.shadow.generateMipmaps = false;
    this.shadow.colorSpace = THREE.NoColorSpace;
    this.shadow.name = 'molen:cloud-shadow';
    // Upload it (clear) at once: every lit shader binds it from its first frame, and three r184's
    // WebGPU backend never rebinds a static material's texture that was unloaded when bound.
    // Later data is written into the same GPU texture (see the renderer's render()).
    this.shadow.needsUpdate = true;
    this.shape = volume(noise.shape, CLOUD_SHAPE_SIZE, 'molen:cloud-shape');
    this.detail = volume(noise.detail, CLOUD_DETAIL_SIZE, 'molen:cloud-detail');
    this.cirrus = new THREE.DataTexture(
      new Uint8Array(CIRRUS_SIZE ** 2 * 4),
      CIRRUS_SIZE,
      CIRRUS_SIZE,
    );
    this.cirrus.wrapS = this.cirrus.wrapT = THREE.RepeatWrapping;
    this.cirrus.magFilter = THREE.LinearFilter;
    this.cirrus.minFilter = THREE.LinearMipmapLinearFilter;
    // Seen edge-on toward the horizon; see the cirrus layer in visual.ts.
    this.cirrus.anisotropy = 8;
    this.cirrus.generateMipmaps = true;
    this.cirrus.colorSpace = THREE.LinearSRGBColorSpace;
    this.cirrus.name = 'molen:cirrus';
  }

  /** Upload each field once its noise is complete. Returns whether the deck can draw. */
  sync(): boolean {
    for (const [name, texture] of [
      ['weather', this.weather],
      ['shape', this.shape],
      ['detail', this.detail],
    ] as const)
      if (!this.uploaded.has(name) && this.noise.has(name)) {
        if (texture === this.weather) {
          const levels = mipChain(this.noise.weather, CLOUD_WEATHER_SIZE);
          this.weather.mipmaps = levels as unknown as THREE.CompressedTextureMipmap[];
          (this.shadow.image.data as Uint8Array).set(levels[2]?.data as Uint8Array);
          this.shadow.needsUpdate = true;
        }
        texture.needsUpdate = true;
        this.uploaded.add(name);
      }
    return (
      this.uploaded.has('weather') && this.uploaded.has('shape') && this.uploaded.has('detail')
    );
  }

  dispose(): void {
    for (const texture of [this.weather, this.shadow, this.shape, this.detail, this.cirrus])
      texture.dispose();
  }
}

/** Every level of a square RGBA8 texture, each a wrapping 2x2 box filter of the last. */
function mipChain(base: Uint8Array, size: number): { data: Uint8Array }[] {
  const levels = [{ data: base, width: size, height: size }];
  for (let from = base, n = size; n > 1; n /= 2) {
    const m = n / 2;
    const data = new Uint8Array(m * m * 4);
    for (let y = 0; y < m; y++)
      for (let x = 0; x < m; x++)
        for (let c = 0; c < 4; c++) {
          const at = (dx: number, dy: number): number =>
            from[((2 * y + dy) * n + 2 * x + dx) * 4 + c] as number;
          data[(y * m + x) * 4 + c] = (at(0, 0) + at(1, 0) + at(0, 1) + at(1, 1) + 2) >> 2;
        }
    levels.push({ data, width: m, height: m });
    from = data;
  }
  return levels;
}

function volume(data: Uint8Array, size: number, name: string): THREE.Data3DTexture {
  const texture = new THREE.Data3DTexture(data, size, size, size);
  texture.format = THREE.RedFormat;
  texture.type = THREE.UnsignedByteType;
  texture.wrapS = texture.wrapT = texture.wrapR = THREE.RepeatWrapping;
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.unpackAlignment = 1;
  texture.colorSpace = THREE.NoColorSpace;
  texture.name = name;
  return texture;
}

/**
 * The deck's uniform values, shared by reference with both backends' materials. Every
 * position is in rendered (floating-origin) coordinates; offsets into the tiling textures are
 * wrapped on the CPU in double precision, so the GPU never sees a large world coordinate.
 */
export class CloudUniforms {
  /** Base, top and 1 / thickness (rendered Y), and the draw distance. */
  readonly slab: THREE.Vector4 = new THREE.Vector4();
  /** Weather-map texels per meter, its wrapped UV offset, and coverage. */
  readonly field: THREE.Vector4 = new THREE.Vector4();
  readonly mix: THREE.Vector4 = new THREE.Vector4();
  /** Shortest column, base rise, top softness, anvil. */
  readonly form: THREE.Vector4 = new THREE.Vector4();
  /** Shape erosion, detail erosion (0 skips the detail lookup), coverage softness. */
  readonly erode: THREE.Vector4 = new THREE.Vector4();
  /** Field relief, taper, and the blurred weather level and lift that spread an anvil. */
  readonly relief: THREE.Vector4 = new THREE.Vector4();
  /** Billow noise repeats per meter and wrapped offset, in texture units. */
  readonly shape: THREE.Vector4 = new THREE.Vector4();
  readonly detail: THREE.Vector4 = new THREE.Vector4();
  /** Steps, light steps, longest marched path (m), extinction per meter at full density. */
  readonly march: THREE.Vector4 = new THREE.Vector4();
  /** Direction toward the light, and the farthest a light ray is marched, meters. */
  readonly sun: THREE.Vector4 = new THREE.Vector4();
  readonly sunColor: THREE.Vector3 = new THREE.Vector3();
  readonly ambientTop: THREE.Vector3 = new THREE.Vector3();
  readonly ambientBottom: THREE.Vector3 = new THREE.Vector3();
  /** Forward and back scattering asymmetry, back-lobe weight, edge fade start (of distance). */
  readonly phase: THREE.Vector4 = new THREE.Vector4(0.6, -0.25, 0.3, 0.7);
  /** The scene's fog for clouds: near, far, density and kind (0 none, 1 linear, 2 exp2). */
  readonly fog: THREE.Vector4 = new THREE.Vector4();
  /** Fog color, and how far haze also fades a cloud out (see setFog). */
  readonly fogColor: THREE.Vector4 = new THREE.Vector4();
  /** Shadow opacity of a fully cloudy column: -ln of the sunlight it lets through. */
  shadowDepth = 0;
  private readonly sunWarm = new THREE.Color('#fff3e2');
  private readonly sunLow = new THREE.Color('#ff9a5c');
  private readonly moon = new THREE.Color('#9fb3d6');
  // Linear radiance per unit of ambient: the sky above a cloud and the ground light below it.
  private readonly skyDay = new THREE.Color().setRGB(0.42, 0.52, 0.7);
  private readonly skyDusk = new THREE.Color().setRGB(0.36, 0.28, 0.4);
  private readonly skyNight = new THREE.Color().setRGB(0.004, 0.006, 0.014);
  private readonly groundDay = new THREE.Color().setRGB(0.22, 0.24, 0.27);
  private readonly groundNight = new THREE.Color().setRGB(0.002, 0.003, 0.006);
  private readonly scratch = new THREE.Color();

  /**
   * Fog the clouds as the scene's `fog` fogs everything else (thinner looking up). Haze also
   * fades a cloud out by `fade` (0–1), so that a fully hazed cloud shows the sky's own horizon
   * behind it, whichever color space the backend fogs in; a closed deck (`fade` 0) has no sky
   * behind it to show and turns the fog's grey instead.
   */
  setFog(fog: THREE.Fog | THREE.FogExp2 | null, fade: number): void {
    if (fog instanceof THREE.Fog) this.fog.set(fog.near, fog.far, 0, 1);
    else if (fog instanceof THREE.FogExp2) this.fog.set(0, 0, fog.density, 2);
    else this.fog.set(0, 0, 0, 0);
    if (fog) this.fogColor.set(fog.color.r, fog.color.g, fog.color.b, fade);
  }

  /** Recompute for one frame. `far` bounds the draw distance. */
  update(
    weather: ResolvedWeather,
    seconds: number,
    origin: Vec3,
    far: number,
    quality: CloudQuality,
    sky: SkyFrame | undefined,
  ): void {
    const { clouds, atmosphere, seed } = weather;
    const type = TYPES[clouds.type];
    const settings = QUALITY[quality];
    const base = clouds.baseAltitude - origin[1];
    this.slab.set(base, base + clouds.thickness, 1 / clouds.thickness, Math.min(MAX_DISTANCE, far));
    // The pattern drifts with the wind; the seed picks where in the tiling fields it starts.
    const wind = atmosphere.windVelocity;
    const sx = hash(seed, 1) * 1e5,
      sy = hash(seed, 2) * 1e5,
      sz = hash(seed, 3) * 1e5;
    const ax = origin[0] - wind[0] * seconds + sx,
      az = origin[2] - wind[2] * seconds + sz;
    const perMeter = type.frequency / clouds.scale;
    this.field.set(perMeter, fract(ax * perMeter), fract(az * perMeter), clouds.coverage);
    this.mix.fromArray(type.mix);
    this.form.set(type.topMin, type.baseRise, type.topSoft, type.anvil);
    this.erode.set(type.shapeErosion, settings.detail ? type.detailErosion : 0, SOFTNESS, 0);
    this.relief.set(type.relief, type.taper, 4, 0.22);
    // Cumulus tops slowly boil upward through the noise.
    const rise = seconds * 0.6 + sy;
    const shapeTile = Math.max(type.shapeTile, clouds.thickness * 0.5);
    const shape = 1 / shapeTile;
    this.shape.set(shape, fract(ax * shape), fract((origin[1] - rise) * shape), fract(az * shape));
    const detailTile = shapeTile / 5.3;
    const detail = 1 / detailTile;
    this.detail.set(
      detail,
      fract(ax * detail),
      fract((origin[1] - rise * 1.6) * detail),
      fract(az * detail),
    );
    // A deep layer (towering cumulonimbus) needs more steps for the same detail, up to twice.
    const depth = Math.min(2, Math.max(1, Math.sqrt(clouds.thickness / 900)));
    this.march.set(
      Math.min(CLOUD_MAX_STEPS, Math.round(settings.steps * depth)),
      settings.lightSteps,
      MAX_PATH,
      EXTINCTION * Math.max(0.05, clouds.density),
    );
    // About a quarter of the sun under a fair-weather cumulus, a fifth under a closed deck: the
    // same light a closed deck leaves without spatial shadows (see the renderer).
    this.shadowDepth = Math.min(1.6, 0.4 + (clouds.density * clouds.thickness) / 400);

    // Light: the sun while it is near or above the horizon (low sun lights cloud bases from
    // below), then the moon, then only the night sky.
    const daylight = sky?.daylight ?? 1;
    const sun = sky?.sunDirection ?? [0.3, 0.8, 0.2];
    const moon = sky?.moonDirection;
    const lightReach = Math.max(200, Math.min(4000, clouds.thickness * 1.5));
    const sunUp = smooth(-0.1, 0.04, sun[1]);
    const cover = clouds.coverage * clouds.density;
    if (sunUp > 0 || !moon || moon[1] <= 0) {
      this.sun.set(sun[0], sun[1], sun[2], lightReach);
      this.scratch.copy(this.sunLow).lerp(this.sunWarm, smooth(0.02, 0.35, sun[1]));
      this.sunColor.set(this.scratch.r, this.scratch.g, this.scratch.b).multiplyScalar(3.2 * sunUp);
    } else {
      this.sun.set(moon[0], moon[1], moon[2], lightReach);
      const lit = (sky?.moonIllumination ?? 0) * smooth(0, 0.15, moon[1]) * 0.12;
      this.sunColor.set(this.moon.r, this.moon.g, this.moon.b).multiplyScalar(lit);
    }
    const dusk = (1 - smooth(0, 0.3, Math.abs(sun[1]))) * smooth(-0.15, 0.05, sun[1]);
    this.scratch
      .copy(this.skyNight)
      .lerp(this.skyDay, daylight)
      .lerp(this.skyDusk, dusk * 0.5);
    // A thick, closed deck darkens its own sky light: the light under an overcast is grey.
    const ambient = (0.25 + daylight * 0.85) * (1 - cover * 0.3);
    this.ambientTop.set(this.scratch.r, this.scratch.g, this.scratch.b).multiplyScalar(ambient);
    this.scratch.copy(this.groundNight).lerp(this.groundDay, daylight);
    this.ambientBottom
      .set(this.scratch.r, this.scratch.g, this.scratch.b)
      .multiplyScalar(ambient * (1 - cover * 0.3));
  }
}

/** Range attribute: where each proxy's march ends (m) and its share of the step count. */
const RANGE = 'cloudRange';

/** A camera-centred square in the XZ plane, unit size, marching to the far side of the slab. */
export function cloudDeckGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.PlaneGeometry(1, 1, 16, 16);
  geometry.rotateX(-Math.PI / 2);
  const range = new Float32Array(geometry.getAttribute('position').count * 2);
  for (let i = 0; i < range.length; i += 2) range.set([1e9, 1], i);
  geometry.setAttribute(RANGE, new THREE.BufferAttribute(range, 2));
  return geometry;
}

/** Nested camera-centred spheres, far ones first so each draw blends over the one behind it. */
export function cloudShellGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = CLOUD_SHELLS.length - 1; i >= 0; i--) {
    const radius = CLOUD_SHELLS[i] as number;
    const sphere = new THREE.SphereGeometry(radius, 24, 12);
    const count = sphere.getAttribute('position').count;
    const range = new Float32Array(count * 2);
    const end = CLOUD_SHELLS[i + 1] ?? 1e9;
    for (let j = 0; j < range.length; j += 2) range.set([end, 0.4], j);
    sphere.deleteAttribute('normal');
    sphere.deleteAttribute('uv');
    sphere.setAttribute(RANGE, new THREE.BufferAttribute(range, 2));
    parts.push(sphere);
  }
  // A plain merge: concatenated vertices and offset indices, in the order above.
  const positions: number[] = [];
  const ranges: number[] = [];
  const indices: number[] = [];
  for (const part of parts) {
    const offset = positions.length / 3;
    positions.push(...(part.getAttribute('position').array as Float32Array));
    ranges.push(...(part.getAttribute(RANGE).array as Float32Array));
    for (const index of part.getIndex()?.array ?? []) indices.push(index + offset);
    part.dispose();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute(RANGE, new THREE.Float32BufferAttribute(ranges, 2));
  geometry.setIndex(indices);
  return geometry;
}

/** Shared by both backends' shaders; kept as one string so the two stay in step. */
const GLSL_MODEL = /* glsl */ `
uniform sampler2D cloudWeather;
uniform highp sampler3D cloudShape;
uniform highp sampler3D cloudDetail;
uniform vec4 cloudSlab;
uniform vec4 cloudField;
uniform vec4 cloudMix;
uniform vec4 cloudForm;
uniform vec4 cloudErode;
uniform vec4 cloudRelief;
uniform vec4 cloudShapeUv;
uniform vec4 cloudDetailUv;
uniform vec4 cloudMarch;
uniform vec4 cloudSun;
uniform vec3 cloudSunColor;
uniform vec3 cloudAmbientTop;
uniform vec3 cloudAmbientBottom;
uniform vec4 cloudPhase;
uniform vec4 cloudFog;
uniform vec4 cloudFogColor;

// Cloud density 0–1 at a rendered position; h receives the height fraction in the slab. A
// march step spanning many weather texels reads a blurred level (lod) and skips the billows,
// so a coarse step returns the average cloud over its length rather than a hit or a miss.
float cloudDensity(vec3 p, float lod, bool detailed, out float h) {
  h = (p.y - cloudSlab.x) * cloudSlab.z;
  if (h <= 0.0 || h >= 1.0) return 0.0;
  vec2 uv = p.xz * cloudField.x + cloudField.yz;
  vec4 w = textureLod(cloudWeather, uv, lod);
  float field = dot(w, cloudMix);
  // Wider margins for coarse steps, which then see a cloud's average rather than its edge.
  float soft = cloudErode.z * (1.0 + lod * 0.6);
  // Field values above this are cloud; coverage 1 puts it below 0, closing the layer.
  float threshold = 1.0 - cloudField.w * (1.0 + soft);
  // Each column's top: the height channel, lowered where the field is weak, so even a closed
  // layer is lumpy and lets more light through where it is thin.
  float hn = h / (mix(cloudForm.x, 1.0, w.g) * (1.0 - cloudRelief.x * (1.0 - field)));
  if (hn >= 1.0) return 0.0;
  // Anvils: near the top of a storm cell the cloud spreads well beyond its tower.
  float spread = cloudForm.w * smoothstep(0.55, 0.9, hn);
  if (spread > 0.0)
    field = mix(field, max(field, dot(textureLod(cloudWeather, uv, lod + cloudRelief.z), cloudMix) + cloudRelief.w), spread);
  // Clouds narrow toward their tops (domes, towers), but an anvil does not.
  float cover = clamp((field - threshold - cloudRelief.y * hn * (1.0 - spread)) / soft, 0.0, 1.0);
  if (cover <= 0.0) return 0.0;
  float profile = smoothstep(0.0, cloudForm.y, hn) * (1.0 - smoothstep(cloudForm.z, 1.0, hn));
  float body = cover * mix(profile, 1.0, spread * 0.5);
  if (body <= 0.0) return 0.0;
  // Flat bases: the billows carve the sides and tops, and the underside only a little.
  float carve = cloudErode.x * mix(0.3, 1.0, smoothstep(0.0, 0.3, hn)) *
    (1.0 - smoothstep(2.0, 4.5, lod));
  float s = 1.0;
  if (carve > 0.0) s = mix(1.0, textureLod(cloudShape, p * cloudShapeUv.x + cloudShapeUv.yzw, 0.0).r, carve);
  float d = clamp((s - 1.0 + body) / max(body, 0.001), 0.0, 1.0) * body;
  if (detailed && cloudErode.y > 0.0 && d > 0.0 && lod < 2.0) {
    float n = textureLod(cloudDetail, p * cloudDetailUv.x + cloudDetailUv.yzw, 0.0).r;
    // Wispy below, billowed above.
    float wear = mix(n, 1.0 - n, clamp(hn * 3.0, 0.0, 1.0)) * cloudErode.y;
    d = clamp((d - wear) / (1.0 - wear), 0.0, 1.0);
  }
  return d;
}

// Optical depth toward the light from p: doubling steps that together reach the edge of the
// layer along the light, or cloudSun.w meters if that is nearer.
float cloudLightDepth(vec3 p, float lod) {
  float edge = cloudSun.y > 0.0 ? cloudSlab.y : cloudSlab.x;
  float reach = abs(cloudSun.y) > 1e-4 ? min(cloudSun.w, (edge - p.y) / cloudSun.y) : cloudSun.w;
  float len = reach / (exp2(cloudMarch.y) - 1.0);
  float depth = 0.0;
  float along = 0.0;
  for (int k = 0; k < ${CLOUD_MAX_LIGHT_STEPS}; k++) {
    if (float(k) >= cloudMarch.y) break;
    float h;
    depth += cloudDensity(p + cloudSun.xyz * (along + len * 0.5), lod, false, h) * len;
    along += len;
    len *= 2.0;
  }
  return depth * cloudMarch.w;
}

float cloudPhaseHG(float c, float g) {
  float g2 = g * g;
  return (1.0 - g2) / pow(max(1.0 + g2 - 2.0 * g * c, 1e-4), 1.5);
}

// Premultiplied colour and opacity of the cloud along a ray from ro (unit rd), from the proxy
// at distance t0 to the end of its range; entry receives where the march starts.
vec4 cloudMarchRay(vec3 ro, vec3 rd, float t0, vec2 range, float jitter, out float entry) {
  entry = t0;
  float enter = 0.0;
  float leave = 1e9;
  if (abs(rd.y) > 1e-5) {
    float tb = (cloudSlab.x - ro.y) / rd.y;
    float tt = (cloudSlab.y - ro.y) / rd.y;
    enter = max(min(tb, tt), 0.0);
    leave = max(tb, tt);
  } else if (ro.y <= cloudSlab.x || ro.y >= cloudSlab.y) {
    return vec4(0.0);
  }
  float a = max(t0, enter);
  entry = a;
  float b = min(min(leave, range.x), min(cloudSlab.w, a + cloudMarch.z));
  if (b <= a) return vec4(0.0);
  float steps = max(2.0, floor(cloudMarch.x * range.y + 0.5));
  // Through the layer, steps grow geometrically, the last up to ${CLOUD_STEP_GROWTH} times the
  // first: what shows of a cloud is its first optical depth, so the budget goes there. Along
  // it (a ray grazing the layer toward the horizon) the next cloud may be anywhere, so they
  // stay nearly even.
  float span = mix(${CLOUD_STEP_GROWTH}.0, 1.5, smoothstep(2.0, 8.0, (b - a) * cloudSlab.z));
  float growth = pow(span, 1.0 / steps);
  float ds = (b - a) * (growth - 1.0) / (span - 1.0) * pow(growth, jitter);
  float t = a + ds / pow(growth, jitter) * (pow(growth, jitter) - 1.0) / (growth - 1.0);
  float c = dot(rd, cloudSun.xyz);
  // Two lobes: a bright silver lining toward the light, a little back-scatter away from it.
  float phase = mix(cloudPhaseHG(c, cloudPhase.x), cloudPhaseHG(c, cloudPhase.y), cloudPhase.z);
  float transmittance = 1.0;
  vec3 color = vec3(0.0);
  for (int i = 0; i < ${CLOUD_MAX_STEPS}; i++) {
    if (float(i) >= steps || transmittance < 0.01) break;
    vec3 p = ro + rd * t;
    float stepLength = ds;
    t += ds;
    ds *= growth;
    float lod = clamp(log2(stepLength * cloudField.x * ${CLOUD_WEATHER_SIZE}.0), 0.0, 6.0);
    float h;
    float d = cloudDensity(p, lod, true, h);
    if (d <= 0.0) continue;
    float depth = cloudLightDepth(p, lod);
    // Beer's law for light straight from the sun, and a diffusion term for light scattered on
    // through the cloud, which falls off slowly: even a thick deck is grey underneath, not black.
    float sunlight = exp(-depth) * phase + 0.3 / (1.0 + 0.08 * depth);
    vec3 light = cloudSunColor * sunlight + mix(cloudAmbientBottom, cloudAmbientTop, h);
    float stepTransmittance = exp(-d * cloudMarch.w * stepLength);
    color += transmittance * (1.0 - stepTransmittance) * light;
    transmittance *= stepTransmittance;
  }
  float alpha = (1.0 - transmittance) *
    (1.0 - smoothstep(cloudSlab.w * cloudPhase.w, cloudSlab.w, a));
  return vec4(color * (alpha / max(1.0 - transmittance, 1e-4)), alpha);
}

// Haze lies near the ground: a ray climbing to a cloud crosses less of it than its length.
float cloudFogFactor(float distance, vec3 rd) {
  float depth = distance * mix(1.0, 0.35, smoothstep(0.05, 0.5, abs(rd.y)));
  if (cloudFog.w < 0.5) return 0.0;
  if (cloudFog.w < 1.5) return smoothstep(cloudFog.x, cloudFog.y, depth);
  return 1.0 - exp(-cloudFog.z * cloudFog.z * depth * depth);
}
`;

const VERTEX = /* glsl */ `
attribute vec2 cloudRange;
varying vec3 vCloudWorld;
varying vec2 vCloudRange;
#include <common>
#include <logdepthbuf_pars_vertex>
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vCloudWorld = world.xyz;
  vCloudRange = cloudRange;
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <logdepthbuf_vertex>
}
`;

const FRAGMENT = /* glsl */ `
varying vec3 vCloudWorld;
varying vec2 vCloudRange;
#include <common>
#include <logdepthbuf_pars_fragment>
${GLSL_MODEL}
void main() {
  #include <logdepthbuf_fragment>
  vec3 toProxy = vCloudWorld - cameraPosition;
  float t0 = length(toProxy);
  float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  vec3 rd = toProxy / t0;
  float entry;
  vec4 cloud = cloudMarchRay(cameraPosition, rd, t0, vCloudRange, jitter, entry);
  if (cloud.a < 0.002) discard;
  gl_FragColor = vec4(cloud.rgb / cloud.a, cloud.a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  // Where and how three fogs its own WebGL materials (after tone mapping, with the fog color in
  // the output color space), so hazed clouds match hazed ground.
  float hazed = cloudFogFactor(entry, rd);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, linearToOutputTexel(vec4(cloudFogColor.rgb, 1.0)).rgb, hazed);
  gl_FragColor.a *= 1.0 - hazed * cloudFogColor.w;
}
`;

/** WebGL deck material reading `uniforms` and `textures` by reference. */
export function createWebGlCloudMaterial(
  uniforms: CloudUniforms,
  textures: CloudTextures,
): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    name: 'molen:clouds',
    uniforms: {
      cloudWeather: { value: textures.weather },
      cloudShape: { value: textures.shape },
      cloudDetail: { value: textures.detail },
      cloudSlab: { value: uniforms.slab },
      cloudField: { value: uniforms.field },
      cloudMix: { value: uniforms.mix },
      cloudForm: { value: uniforms.form },
      cloudErode: { value: uniforms.erode },
      cloudRelief: { value: uniforms.relief },
      cloudShapeUv: { value: uniforms.shape },
      cloudDetailUv: { value: uniforms.detail },
      cloudMarch: { value: uniforms.march },
      cloudSun: { value: uniforms.sun },
      cloudSunColor: { value: uniforms.sunColor },
      cloudAmbientTop: { value: uniforms.ambientTop },
      cloudAmbientBottom: { value: uniforms.ambientBottom },
      cloudPhase: { value: uniforms.phase },
      cloudFog: { value: uniforms.fog },
      cloudFogColor: { value: uniforms.fogColor },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  // One pass: the front and back faces of a proxy are the same cloud.
  material.forceSinglePass = true;
  return material;
}
