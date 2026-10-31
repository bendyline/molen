import {
  type ResolvedWeather,
  resolveWeather,
  type Vec3,
  type WeatherData,
  weatherSchema,
} from '@bendyline/molen-schema';
import * as THREE from 'three';
import type { SkyFrame } from '../sky/visual';
import type { CloudShadowUniforms } from './cloud-shadows';
import {
  type CloudQuality,
  CloudTextures,
  CloudUniforms,
  cloudDeckGeometry,
  cloudQualitySettings,
  cloudShellGeometry,
  createWebGlCloudMaterial,
} from './clouds';
import { CIRRUS_SIZE, cloudNoise } from './noise';

const clamp = (x: number): number => Math.max(0, Math.min(1, x));
const wrap = (x: number, size: number): number => ((x % size) + size) % size;
function smooth(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}
function hash(x: number, y: number, seed: number): number {
  let h = Math.imul(x ^ seed, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const PARTICLE_LIMIT = 1400;
/** Visibility below which murk veils the sky as well as the ground, meters. */
const VEIL_VISIBILITY = 20000;
/** Depth of the hazy air a view looking straight up crosses, meters. */
const HAZE_DEPTH = 1500;

export interface WeatherVisualOptions {
  /** Cloud textures to draw with. A renderer passes its own; by default the visual makes some. */
  textures?: CloudTextures;
  /** The cloud deck's material for the renderer's backend; the WebGL material by default. */
  createCloudMaterial?: (uniforms: CloudUniforms, textures: CloudTextures) => THREE.Material;
  /** Per-pixel cloud work; default 'medium'. See `setCloudQuality`. */
  quality?: CloudQuality;
  /**
   * Milliseconds of cloud noise generation per `update` until it is complete (default 3); the
   * clouds appear once it is. Infinity builds it all in the first update. Built once per page.
   */
  noiseBudgetMs?: number;
  /**
   * The renderer's backend, which decides how the sky veil matches its fog (three fogs WebGL
   * materials after tone mapping, WebGPU's before). Default 'webgl'.
   */
  backend?: 'webgl' | 'webgpu';
}

/**
 * Volumetric clouds, a high cirrus layer and local precipitation on both graphics backends.
 * Patterns are seeded and sampled at absolute simulation time, not integrated frames. Cloud
 * layers use absolute world altitudes; particles are visual and do not accumulate or collide.
 */
export class WeatherVisual {
  readonly object: THREE.Group = new THREE.Group();
  readonly fog: THREE.Fog = new THREE.Fog('#c1c9cd', 0, 50000);
  private state: ResolvedWeather;
  private readonly textures: CloudTextures;
  private readonly ownsTextures: boolean;
  private readonly createCloudMaterial: WeatherVisualOptions['createCloudMaterial'];
  private readonly noiseBudgetMs: number;
  private readonly uniforms = new CloudUniforms();
  private quality: CloudQuality;
  private cloudMaterial: THREE.Material | undefined;
  private deck: THREE.Mesh | undefined;
  private shells: THREE.Mesh | undefined;
  private deckReady = false;
  private cirrus: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | undefined;
  private cirrusCoverage: number | undefined;
  private readonly backend: 'webgl' | 'webgpu';
  /** Murk over the sky in poor visibility; see updateVeil. */
  private veil: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> | undefined;
  private veilVisibility: number | undefined;
  private particles: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | undefined;
  private particleTexture: THREE.DataTexture | undefined;
  private readonly cameraPosition = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly up = new THREE.Vector3();
  private readonly color = new THREE.Color();
  private disposed = false;

  constructor(data: WeatherData, options: WeatherVisualOptions = {}) {
    this.state = resolveWeather(weatherSchema.parse(data));
    this.object.name = 'molen:weather';
    this.ownsTextures = options.textures === undefined;
    this.textures = options.textures ?? new CloudTextures(cloudNoise());
    this.createCloudMaterial = options.createCloudMaterial;
    this.quality = options.quality ?? 'medium';
    this.noiseBudgetMs = options.noiseBudgetMs ?? 3;
    this.backend = options.backend ?? 'webgl';
  }

  /** Resolved copy; editing it does not change the visual. */
  get data(): ResolvedWeather {
    return resolveWeather(this.state);
  }

  /** Replace weather while retaining geometry, particles and cached noise. */
  setData(data: WeatherData): void {
    if (this.disposed) throw new Error('WeatherVisual has been disposed');
    this.state = resolveWeather(weatherSchema.parse(data));
  }

  get cloudAttenuation(): number {
    return this.state.clouds.coverage * this.state.clouds.density;
  }

  /** Per-pixel cloud work. Uniform-driven: changing it rebuilds nothing. */
  setCloudQuality(quality: CloudQuality): void {
    this.quality = quality;
  }

  get cloudQuality(): CloudQuality {
    return this.quality;
  }

  /**
   * Whether lit surfaces get spatial cloud shadows this frame: from 'high' quality, once the
   * clouds have appeared. While they do, direct light needs no uniform cloud dimming.
   */
  get shadowsActive(): boolean {
    return cloudQualitySettings(this.quality).shadows && this.deckVisible() && this.deckReady;
  }

  /** Write this frame's cloud shadow into a renderer's lit-shader uniforms. */
  writeShadows(uniforms: CloudShadowUniforms, active: boolean = this.shadowsActive): void {
    const u = this.uniforms;
    uniforms.molenCloudShadow.value.set(active ? 1 : 0, u.slab.x, u.slab.y, 0);
    uniforms.molenCloudField.value.copy(u.field);
    uniforms.molenCloudMix.value.copy(u.mix);
    uniforms.molenCloudFit.value.set(u.erode.z, u.shadowDepth, 0.35, u.relief.x);
  }

  /** Cloud layers drawn (the volumetric layer and cirrus) and precipitation particles. */
  get stats(): { cloudLayers: number; particles: number } {
    return {
      cloudLayers:
        Number(this.deck?.visible === true || this.shells?.visible === true) +
        Number(this.cirrus?.visible === true),
      particles: this.particles?.visible ? this.particles.geometry.drawRange.count / 6 : 0,
    };
  }

  /** Update camera-relative geometry using the renderer's absolute floating origin. */
  update(seconds: number, camera: THREE.Camera, origin: Vec3, sky?: SkyFrame): void {
    if (this.disposed) throw new Error('WeatherVisual has been disposed');
    if (!Number.isFinite(seconds)) throw new Error('Weather time must be finite');
    camera.updateWorldMatrix(true, false);
    camera.getWorldPosition(this.cameraPosition);
    this.right.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    this.up.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
    const daylight = sky?.daylight ?? 1;
    this.updateClouds(seconds, camera, origin, daylight, sky);
    this.updateParticles(seconds, origin, daylight);
    this.object.updateMatrixWorld(true);
  }

  /**
   * Combine weather visibility with an authored/streaming fog limit without mutating it. The
   * clouds are fogged with the result (see CloudUniforms.setFog).
   */
  fogFor(base: THREE.Fog | THREE.FogExp2 | null, sky?: SkyFrame): THREE.Fog | THREE.FogExp2 {
    const fog = this.limitFog(base, sky);
    this.veil?.material.color.copy(fog.color);
    this.uniforms.setFog(fog, 1 - smooth(0.5, 0.9, this.cloudAttenuation));
    return fog;
  }

  private limitFog(
    base: THREE.Fog | THREE.FogExp2 | null,
    sky: SkyFrame | undefined,
  ): THREE.Fog | THREE.FogExp2 {
    const visibility = this.state.visibility;
    // Clear weather must preserve the authored clear foreground as well as the far limit.
    // Only bring the fade closer when weather actually reduces the scene's visibility.
    if (base instanceof THREE.Fog && base.far <= visibility) return base;
    // Preserve an explicitly authored exponential fog when it is already denser.
    if (base instanceof THREE.FogExp2 && base.density >= 2 / visibility) return base;
    this.fog.near = Math.min(visibility * 0.035, base instanceof THREE.Fog ? base.near : 400);
    this.fog.far = Math.min(visibility, base instanceof THREE.Fog ? base.far : Infinity);
    this.fog.near = Math.min(this.fog.near, this.fog.far * 0.1);
    if (base) this.fog.color.copy(base.color);
    else this.fog.color.set('#0b1220').lerp(this.color.set('#c1c9cd'), sky?.daylight ?? 1);
    // Under a closed deck the murk is grey, not the clear sky's blue.
    const overcast = smooth(0.5, 0.9, this.cloudAttenuation);
    if (overcast > 0) {
      const { r, g, b } = this.fog.color;
      const grey = (r * 0.2126 + g * 0.7152 + b * 0.0722) * 0.85;
      this.fog.color.lerp(this.color.setRGB(grey, grey, grey), overcast * 0.8);
    }
    return this.fog;
  }

  private deckVisible(): boolean {
    const { coverage, density } = this.state.clouds;
    return coverage > 0 && density > 0;
  }

  private buildDeck(): void {
    const material =
      this.createCloudMaterial?.(this.uniforms, this.textures) ??
      createWebGlCloudMaterial(this.uniforms, this.textures);
    this.cloudMaterial = material;
    this.deck = new THREE.Mesh(cloudDeckGeometry(), material);
    this.deck.name = 'molen:cloud-deck';
    this.shells = new THREE.Mesh(cloudShellGeometry(), material);
    this.shells.name = 'molen:cloud-shells';
    for (const mesh of [this.deck, this.shells]) {
      mesh.frustumCulled = false;
      mesh.visible = false;
      this.object.add(mesh);
    }
  }

  private updateClouds(
    seconds: number,
    camera: THREE.Camera,
    origin: Vec3,
    daylight: number,
    sky: SkyFrame | undefined,
  ): void {
    const { clouds } = this.state;
    const deck = this.deckVisible();
    const wanted = [
      ...(deck ? (['weather', 'shape', 'detail'] as const) : []),
      ...(clouds.cirrus > 0 ? (['cirrus'] as const) : []),
    ];
    if (wanted.length > 0) this.textures.noise.build(wanted, this.noiseBudgetMs);
    this.deckReady = this.textures.sync();
    const far =
      camera instanceof THREE.PerspectiveCamera || camera instanceof THREE.OrthographicCamera
        ? camera.far
        : 50000;
    this.uniforms.update(this.state, seconds, origin, far, this.quality, sky);
    if (deck && this.deckReady && !this.deck) this.buildDeck();
    if (this.deck && this.shells) {
      const shown = deck && this.deckReady;
      const altitude = this.cameraPosition.y + origin[1];
      const top = clouds.baseAltitude + clouds.thickness;
      // Inside the layer every view ray starts in cloud: draw the shells around the camera.
      const inside = altitude > clouds.baseAltitude && altitude < top;
      this.deck.visible = shown && !inside;
      this.shells.visible = shown && inside;
      const slab = this.uniforms.slab;
      this.deck.position.set(
        this.cameraPosition.x,
        altitude <= clouds.baseAltitude ? slab.x : slab.y,
        this.cameraPosition.z,
      );
      this.deck.scale.set(2 * slab.w, 1, 2 * slab.w);
      this.shells.position.copy(this.cameraPosition);
    }
    this.updateCirrus(seconds, origin, far, daylight, sky?.sunDirection ?? [0.3, 0.8, 0.2]);
    this.updateVeil(far);
  }

  /**
   * In fog, rain or snow the murk hides the sky too, not only the ground: a camera-centred
   * dome in the fog color, behind everything nearer, opaque toward the horizon and thinner
   * overhead, where a view crosses less hazy air. Clouds draw over it, and a fully hazed cloud
   * shows it. Absent in clear air (visibility from 20 km).
   */
  private updateVeil(far: number): void {
    const visibility = this.state.visibility;
    const shown = visibility < VEIL_VISIBILITY;
    if (this.veil) this.veil.visible = shown;
    if (!shown) return;
    if (!this.veil) {
      const geometry = new THREE.SphereGeometry(1, 32, 16);
      geometry.setAttribute(
        'color',
        new THREE.BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 4), 4),
      );
      this.veil = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          vertexColors: true,
          transparent: true,
          depthWrite: false,
          side: THREE.BackSide,
          fog: false,
          // WebGPU fogs before tone mapping, so a fogged surface is tone mapped; WebGL after.
          toneMapped: this.backend === 'webgpu',
        }),
      );
      this.veil.name = 'molen:visibility-veil';
      // Behind every other transparent weather surface, though it is centred on the camera.
      this.veil.renderOrder = -1;
      this.veil.frustumCulled = false;
      this.object.add(this.veil);
    }
    if (visibility !== this.veilVisibility) {
      this.veilVisibility = visibility;
      const positions = this.veil.geometry.getAttribute('position');
      const colors = this.veil.geometry.getAttribute('color');
      const strength = smooth(VEIL_VISIBILITY, VEIL_VISIBILITY * 0.4, visibility);
      for (let i = 0; i < positions.count; i++) {
        const path = HAZE_DEPTH / Math.max(Math.abs(positions.getY(i)), 0.03);
        colors.setXYZW(i, 1, 1, 1, (1 - Math.exp((-3 * path) / visibility)) * strength);
      }
      colors.needsUpdate = true;
    }
    // Beyond twice the visibility everything is fully fogged anyway.
    this.veil.scale.setScalar(Math.min(far * 0.9, Math.max(1500, visibility * 2)));
    this.veil.position.copy(this.cameraPosition);
  }

  /**
   * Cirrus are thin ice streaks combed out by the jet stream, so this layer is a flat sheet: a
   * stretched texture turned to lie along the wind, at the cirrus altitude.
   */
  private updateCirrus(
    seconds: number,
    origin: Vec3,
    far: number,
    daylight: number,
    sun: Vec3,
  ): void {
    const { clouds, atmosphere } = this.state;
    const ready = clouds.cirrus > 0 && this.textures.noise.has('cirrus');
    if (this.cirrus) this.cirrus.visible = ready;
    if (!ready) return;
    if (!this.cirrus) {
      const geometry = new THREE.PlaneGeometry(1, 1, 16, 16);
      geometry.rotateX(-Math.PI / 2);
      const positions = geometry.getAttribute('position');
      const colors = new Float32Array(positions.count * 4);
      for (let j = 0; j < positions.count; j++) {
        const r = Math.max(Math.abs(positions.getX(j)), Math.abs(positions.getZ(j))) * 2;
        colors.set([1, 1, 1, 1 - smooth(0.55, 1, r)], j * 4);
      }
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
      this.cirrus = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          map: this.textures.cirrus,
          vertexColors: true,
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      this.cirrus.name = 'molen:cirrus';
      this.cirrus.frustumCulled = false;
      this.object.add(this.cirrus);
    }
    if (clouds.cirrus !== this.cirrusCoverage) {
      this.cirrusCoverage = clouds.cirrus;
      const noise = this.textures.noise.cirrus;
      const pixels = this.textures.cirrus.image.data as Uint8Array;
      const threshold = 1 - clouds.cirrus;
      for (let i = 0; i < CIRRUS_SIZE ** 2; i++) {
        const alpha = smooth(threshold - 0.1, threshold + 0.35, (noise[i] ?? 0) / 255);
        pixels[i * 4] = pixels[i * 4 + 1] = pixels[i * 4 + 2] = 255;
        pixels[i * 4 + 3] = Math.round(alpha * 200);
      }
      this.textures.cirrus.needsUpdate = true;
    }
    const layer = this.cirrus;
    const size = Math.max(2000, Math.min(160000, far * 1.4));
    const wind = atmosphere.windVelocity;
    const angle = Math.hypot(wind[0], wind[2]) > 0.01 ? Math.atan2(-wind[2], wind[0]) : 0;
    layer.rotation.y = angle;
    layer.position.set(
      this.cameraPosition.x,
      clouds.cirrusAltitude - origin[1],
      this.cameraPosition.z,
    );
    layer.scale.set(size, 1, size);
    // Turned by `angle`, the plane's U axis runs along (cos, 0, -sin) and V along (-sin, 0, -cos).
    const cos = Math.cos(angle),
      sin = Math.sin(angle);
    // Cirrus ride the jet stream, faster than the surface wind.
    const ax = this.cameraPosition.x + origin[0] - wind[0] * 2.5 * seconds;
    const az = this.cameraPosition.z + origin[2] - wind[2] * 2.5 * seconds;
    const scale = clouds.scale * 1.6;
    const map = layer.material.map as THREE.Texture;
    map.repeat.set(size / scale, size / scale);
    map.offset.set(
      wrap((ax * cos - az * sin) / scale - size / scale / 2, 1),
      wrap((-ax * sin - az * cos) / scale - size / scale / 2, 1),
    );
    this.color.set('#101829').lerp(new THREE.Color('#eef2f6'), daylight);
    const sunset = (1 - smooth(0, 0.3, Math.abs(sun[1]))) * smooth(-0.2, 0.05, sun[1]);
    this.color.lerp(new THREE.Color('#ffb48f'), sunset * 0.7);
    this.color.multiplyScalar(1 + daylight * 1.6);
    layer.material.color.copy(this.color);
  }

  private buildParticles(): void {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(PARTICLE_LIMIT * 4 * 3), 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    const uv = new Float32Array(PARTICLE_LIMIT * 4 * 2);
    const indices: number[] = [];
    for (let i = 0; i < PARTICLE_LIMIT; i++) {
      uv.set([0, 0, 1, 0, 1, 1, 0, 1], i * 8);
      const n = i * 4;
      indices.push(n, n + 1, n + 2, n, n + 2, n + 3);
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geometry.setIndex(indices);
    const pixels = new Uint8Array(32 * 32 * 4);
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) {
        const r = Math.hypot((x - 15.5) / 15.5, (y - 15.5) / 15.5);
        pixels.set([255, 255, 255, (1 - smooth(0.15, 1, r)) * 255], (y * 32 + x) * 4);
      }
    this.particleTexture = new THREE.DataTexture(pixels, 32, 32);
    this.particleTexture.magFilter = THREE.LinearFilter;
    this.particleTexture.needsUpdate = true;
    this.particles = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        map: this.particleTexture,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        opacity: 0.65,
      }),
    );
    this.particles.name = 'molen:precipitation';
    this.particles.frustumCulled = false;
    this.object.add(this.particles);
  }

  private updateParticles(seconds: number, origin: Vec3, daylight: number): void {
    const { precipitation: p, seed, atmosphere: a } = this.state;
    const count = p.kind === 'none' ? 0 : Math.round(PARTICLE_LIMIT * p.intensity);
    if (count > 0 && !this.particles) this.buildParticles();
    if (!this.particles) return;
    this.particles.visible = count > 0;
    this.particles.geometry.setDrawRange(0, count * 6);
    if (!count) return;
    const rain = p.kind === 'rain';
    this.particles.material.color.set('#6c809c').lerp(this.color.set('#f2f6ff'), daylight);
    this.particles.material.color.multiplyScalar(1 + daylight * 2);
    this.particles.material.opacity = rain ? 0.42 : 0.85;
    const positions = this.particles.geometry.getAttribute('position');
    const c = this.cameraPosition;
    const width = 52,
      height = 34;
    const absolute = [c.x + origin[0], c.y + origin[1], c.z + origin[2]];
    for (let i = 0; i < count; i++) {
      const r = hash(i, 0, seed),
        s = hash(i, 1, seed),
        t = hash(i, 2, seed);
      const fall = rain ? 13 + r * 7 : 0.8 + r * 0.8;
      const x =
        c.x +
        wrap(r * width + a.windVelocity[0] * seconds - (absolute[0] ?? 0) + width / 2, width) -
        width / 2;
      const y =
        c.y +
        wrap(
          t * height + (a.windVelocity[1] - fall) * seconds - (absolute[1] ?? 0) + height / 2,
          height,
        ) -
        height / 2;
      const z =
        c.z +
        wrap(s * width + a.windVelocity[2] * seconds - (absolute[2] ?? 0) + width / 2, width) -
        width / 2;
      const halfWidth = rain ? 0.009 + r * 0.009 : 0.035 + r * 0.055;
      const halfLength = rain ? 0.35 + r * 0.25 : halfWidth;
      const ux = rain ? -a.windVelocity[0] / fall : this.up.x;
      const uy = rain ? 1 : this.up.y;
      const uz = rain ? -a.windVelocity[2] / fall : this.up.z;
      const flutterX = rain ? 0 : Math.sin(seconds * 1.2 + r * 30) * 0.7;
      const flutterZ = rain ? 0 : Math.cos(seconds * 0.8 + s * 30) * 0.6;
      for (let j = 0; j < 4; j++) {
        const side = j === 0 || j === 3 ? -1 : 1,
          top = j < 2 ? -1 : 1;
        positions.setXYZ(
          i * 4 + j,
          x + flutterX + this.right.x * halfWidth * side + ux * halfLength * top,
          y + this.right.y * halfWidth * side + uy * halfLength * top,
          z + flutterZ + this.right.z * halfWidth * side + uz * halfLength * top,
        );
      }
    }
    positions.needsUpdate = true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.deck?.geometry.dispose();
    this.shells?.geometry.dispose();
    this.cloudMaterial?.dispose();
    this.cirrus?.geometry.dispose();
    this.cirrus?.material.dispose();
    this.veil?.geometry.dispose();
    this.veil?.material.dispose();
    if (this.ownsTextures) this.textures.dispose();
    this.particles?.geometry.dispose();
    this.particles?.material.dispose();
    this.particleTexture?.dispose();
    this.object.removeFromParent();
    this.object.clear();
  }
}
