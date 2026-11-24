import * as THREE from 'three';

type RGB = readonly [number, number, number];

/** Scene-linear radiance, independent of camera position and floating world origin. */
export interface SkyReflectionState {
  zenith: RGB;
  horizon: RGB;
  ground: RGB;
  twilight: RGB;
  twilightStrength: number;
  sunDirection: RGB;
  sunColor: RGB;
  sunGlow: number;
  clouds: number;
}

/** A backend owns one PMREM generator and reuses its render target across lighting changes. */
export interface SkyReflectionFilter {
  update(texture: THREE.DataTexture): THREE.Texture;
  dispose(): void;
}

const WIDTH = 256;
const HEIGHT = 128;
const clamp = (v: number): number => Math.max(0, Math.min(1, v));
const rgb = (color: THREE.Color): RGB => [color.r, color.g, color.b];
const smooth = (v: number): number => {
  const t = clamp(v);
  return t * t * (3 - 2 * t);
};

/** How far the zenith a surface is lit by sits towards the horizon's brightness (see below). */
const ZENITH_LIFT = 0.5;
/** The exponent of the palette's gradient from horizon to zenith, by the sine of the elevation. */
const SKY_GRADIENT = 0.45;
/** Mean of that gradient over the sky as a level surface sees it (weighted by the cosine). */
const SKY_GRADIENT_MEAN = 2 / (2 + SKY_GRADIENT);

/** Relative luminance of a linear color. */
export const luminance = (color: THREE.Color): number =>
  color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;

/**
 * Sky radiance that lights a level surface exactly as the hemisphere light the map replaces:
 * `brightness` (its intensity over π) times its sky color, `horizon`.
 *
 * A palette's zenith is far darker than its horizon, and most of the sky a surface sees is nearer
 * the zenith. Passed through as drawn, the Earth palette gave level ground 40% of the hemisphere's
 * light and walls 70%, so every cast shadow and the shaded side of every street rendered nearly
 * black. The zenith is drawn deep for the look of it, so it lights from half way to the horizon,
 * which keeps a gradient in reflections without pushing the horizon far above the sky seen.
 */
export function skyFillRadiance(
  zenith: THREE.Color,
  horizon: THREE.Color,
  brightness: number,
): { zenith: RGB; horizon: RGB } {
  const lifted = zenith.clone().lerp(horizon, ZENITH_LIFT);
  const full = luminance(horizon);
  const mean = full + (luminance(lifted) - full) * SKY_GRADIENT_MEAN;
  const scale = brightness * (mean > 0 ? full / mean : 1);
  return {
    zenith: rgb(lifted.multiplyScalar(scale)),
    horizon: rgb(horizon.clone().multiplyScalar(scale)),
  };
}

/** The share of level ground that is in sun rather than in some building's or tree's shadow. */
const GROUND_IN_SUN = 0.5;

/**
 * How much brighter sunlit ground is than its color under the sky alone. Ground in sun lights what
 * stands on it: at noon in the tropics a wall gets no direct sun at all, and most of what it does
 * get comes up from the street. `fill` and `sun` are the light intensities.
 */
export function groundBounce(fill: number, sun: number, sinElevation: number): number {
  return fill > 0 ? 1 + (GROUND_IN_SUN * sun * Math.max(0, sinElevation)) / fill : 1;
}

/** Match the clear-sky palette, then replace directional colour with diffuse cloud radiance. */
export function sampleSkyReflection(
  state: SkyReflectionState,
  x: number,
  y: number,
  z: number,
  out: THREE.Color,
): THREE.Color {
  const dot = x * state.sunDirection[0] + y * state.sunDirection[1] + z * state.sunDirection[2];
  const sky = clamp(y) ** SKY_GRADIENT;
  const sunset =
    state.twilightStrength * Math.exp(-Math.abs(y) * 7) * (0.25 + 0.7 * clamp((dot + 1) / 2) ** 8);
  const ground = y < 0 ? smooth(-y / 0.2) : 0;
  // The directional light provides the direct solar highlight. This broad glow represents
  // atmospheric scattering, avoiding both a second hard sun and low-resolution sparkles.
  const glow = clamp(dot) ** 96 * state.sunGlow;
  const cloud = clamp(state.clouds) * (1 - ground);
  const grey =
    (state.horizon[0] * 0.2126 + state.horizon[1] * 0.7152 + state.horizon[2] * 0.0722) *
    (0.8 + 0.2 * sky);
  const channel = (i: 0 | 1 | 2): number => {
    let v = state.horizon[i] + (state.zenith[i] - state.horizon[i]) * sky;
    v += (state.twilight[i] - v) * sunset;
    v += (state.ground[i] - v) * ground;
    v += (state.sunColor[i] - v) * glow * (1 - ground);
    return Math.max(0, v + (grey - v) * cloud);
  };
  return out.setRGB(channel(0), channel(1), channel(2));
}

/**
 * One small half-float panorama and filtered target per viewer; no model-specific textures or
 * network fetches. Quantization suppresses imperceptible ephemeris changes and camera motion
 * never invalidates the map. Explicit host-assigned scene.environment textures take priority.
 */
export class SkyReflections {
  readonly texture: THREE.DataTexture;
  private readonly pixels = new Uint16Array(WIDTH * HEIGHT * 4);
  private readonly directions = new Float32Array(WIDTH * HEIGHT * 3);
  private key: string | undefined;
  private result: THREE.Texture | undefined;
  private disposed = false;

  /** False when a host has replaced the scene environment with its own texture. */
  get active(): boolean {
    return this.result !== undefined && this.scene.environment === this.result;
  }

  constructor(
    private readonly scene: THREE.Scene,
    private readonly filter: SkyReflectionFilter,
  ) {
    this.texture = new THREE.DataTexture(
      this.pixels,
      WIDTH,
      HEIGHT,
      THREE.RGBAFormat,
      THREE.HalfFloatType,
    );
    this.texture.name = 'molen:sky-reflection-radiance';
    this.texture.mapping = THREE.EquirectangularReflectionMapping;
    this.texture.colorSpace = THREE.LinearSRGBColorSpace;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    // DataTexture.flipY=false: the first row is v=0, i.e. the southern hemisphere.
    for (let row = 0; row < HEIGHT; row++) {
      const latitude = ((row + 0.5) / HEIGHT - 0.5) * Math.PI;
      for (let col = 0; col < WIDTH; col++) {
        const longitude = ((col + 0.5) / WIDTH - 0.5) * 2 * Math.PI;
        const index = (row * WIDTH + col) * 3;
        this.directions[index] = Math.cos(latitude) * Math.cos(longitude);
        this.directions[index + 1] = Math.sin(latitude);
        this.directions[index + 2] = Math.cos(latitude) * Math.sin(longitude);
      }
    }
  }

  update(state: SkyReflectionState): boolean {
    if (this.disposed) return false;
    if (this.scene.environment !== null && this.scene.environment !== this.result) return false;
    const key = [
      ...state.zenith,
      ...state.horizon,
      ...state.ground,
      ...state.twilight,
      state.twilightStrength,
      ...state.sunDirection,
      ...state.sunColor,
      state.sunGlow,
      state.clouds,
    ]
      .map((v) => Math.round(v * 128))
      .join(',');
    if (key === this.key) {
      if (this.result) this.scene.environment = this.result;
      return false;
    }
    const color = new THREE.Color();
    for (let i = 0; i < WIDTH * HEIGHT; i++) {
      sampleSkyReflection(
        state,
        this.directions[i * 3] as number,
        this.directions[i * 3 + 1] as number,
        this.directions[i * 3 + 2] as number,
        color,
      );
      this.pixels[i * 4] = THREE.DataUtils.toHalfFloat(color.r);
      this.pixels[i * 4 + 1] = THREE.DataUtils.toHalfFloat(color.g);
      this.pixels[i * 4 + 2] = THREE.DataUtils.toHalfFloat(color.b);
      this.pixels[i * 4 + 3] = THREE.DataUtils.toHalfFloat(1);
    }
    this.texture.needsUpdate = true;
    this.result = this.filter.update(this.texture);
    this.result.name = 'molen:sky-reflection-pmrem';
    this.scene.environment = this.result;
    this.key = key;
    return true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.scene.environment === this.result) this.scene.environment = null;
    this.filter.dispose();
    this.texture.dispose();
    this.result = undefined;
  }
}

export function createWebGlSkyReflectionFilter(renderer: THREE.WebGLRenderer): SkyReflectionFilter {
  let generator: THREE.PMREMGenerator | undefined;
  let target: THREE.WebGLRenderTarget | undefined;
  return {
    update(texture) {
      generator ??= new THREE.PMREMGenerator(renderer);
      target = generator.fromEquirectangular(texture, target);
      return target.texture;
    },
    dispose() {
      target?.dispose();
      generator?.dispose();
      target = undefined;
      generator = undefined;
    },
  };
}

/** Fallback for authored/static light rigs without a celestial SkyVisual. */
export function reflectionStateFromLights(
  ambient: THREE.HemisphereLight | undefined,
  sun: THREE.DirectionalLight | undefined,
  background: THREE.Color,
  clouds: number,
): SkyReflectionState {
  // HemisphereLight supplies irradiance; an environment map stores radiance. The PBR shader
  // integrates radiance over the hemisphere (π), so copying light intensity directly triples it.
  const brightness = (ambient?.intensity ?? 0.5) / Math.PI;
  const sky = skyFillRadiance(background, ambient?.color ?? background, brightness);
  const direction = sun
    ? sun.position.clone().sub(sun.target.position).normalize()
    : new THREE.Vector3(0, 1, 0);
  const ground = (ambient?.groundColor ?? new THREE.Color('#283b32'))
    .clone()
    .multiplyScalar(
      brightness * groundBounce(ambient?.intensity ?? 0.5, sun?.intensity ?? 0, direction.y),
    );
  return {
    zenith: sky.zenith,
    horizon: sky.horizon,
    ground: rgb(ground),
    twilight: sky.horizon,
    twilightStrength: 0,
    sunDirection: direction.toArray(),
    sunColor: sun ? rgb(sun.color) : sky.horizon,
    sunGlow: Math.min(0.22, (sun?.intensity ?? 0) * 0.08),
    clouds,
  };
}
