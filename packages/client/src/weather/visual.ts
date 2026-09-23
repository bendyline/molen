import {
  type ResolvedWeather,
  resolveWeather,
  type Vec3,
  type WeatherData,
  weatherSchema,
} from '@bendyline/molen-schema';
import * as THREE from 'three';
import type { SkyFrame } from '../sky/visual';

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
function noise(x: number, y: number, period: number, seed: number): number {
  const ix = Math.floor(x),
    iy = Math.floor(y);
  const fx = smooth(0, 1, x - ix),
    fy = smooth(0, 1, y - iy);
  const a = hash(wrap(ix, period), wrap(iy, period), seed);
  const b = hash(wrap(ix + 1, period), wrap(iy, period), seed);
  const c = hash(wrap(ix, period), wrap(iy + 1, period), seed);
  const d = hash(wrap(ix + 1, period), wrap(iy + 1, period), seed);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}

const CLOUD_RESOLUTION = 256;
const PARTICLE_LIMIT = 1400;

/**
 * Lightweight layered clouds and local precipitation with standard materials on both graphics
 * backends. Patterns are seeded and sampled at absolute simulation time, not integrated frames.
 * Cloud layers use absolute world altitudes; particles are visual and do not accumulate or collide.
 */
export class WeatherVisual {
  readonly object: THREE.Group = new THREE.Group();
  readonly fog: THREE.Fog = new THREE.Fog('#c1c9cd', 0, 50000);
  private state: ResolvedWeather;
  private cloudNoise: Float32Array | undefined;
  private cloudTexture: THREE.DataTexture | undefined;
  private readonly cloudLayers: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[] = [];
  private cloudKey = '';
  private noiseSeed: number | undefined;
  private particles: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | undefined;
  private particleTexture: THREE.DataTexture | undefined;
  private readonly cameraPosition = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly up = new THREE.Vector3();
  private readonly color = new THREE.Color();
  private disposed = false;

  constructor(data: WeatherData) {
    this.state = resolveWeather(weatherSchema.parse(data));
    this.object.name = 'molen:weather';
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

  get stats(): { cloudLayers: number; particles: number } {
    return {
      cloudLayers: this.cloudLayers.filter((layer) => layer.visible).length,
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
    this.updateClouds(seconds, camera, origin, daylight, sky?.sunDirection ?? [0.3, 0.8, 0.2]);
    this.updateParticles(seconds, origin, daylight);
    this.object.updateMatrixWorld(true);
  }

  /** Combine weather visibility with an authored/streaming fog limit without mutating it. */
  fogFor(base: THREE.Fog | THREE.FogExp2 | null, sky?: SkyFrame): THREE.Fog | THREE.FogExp2 {
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
    return this.fog;
  }

  private buildClouds(): void {
    const texture = new THREE.DataTexture(
      new Uint8Array(CLOUD_RESOLUTION ** 2 * 4),
      CLOUD_RESOLUTION,
      CLOUD_RESOLUTION,
    );
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.colorSpace = THREE.LinearSRGBColorSpace;
    this.cloudTexture = texture;
    for (let i = 0; i < 2; i++) {
      const geometry = new THREE.PlaneGeometry(1, 1, 24, 24);
      geometry.rotateX(-Math.PI / 2);
      const positions = geometry.getAttribute('position');
      const colors = new Float32Array(positions.count * 4);
      for (let j = 0; j < positions.count; j++) {
        const r = Math.max(Math.abs(positions.getX(j)), Math.abs(positions.getZ(j))) * 2;
        colors.set([1, 1, 1, 1 - smooth(0.6, 1, r)], j * 4);
      }
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
      const map = i === 0 ? texture : texture.clone();
      const material = new THREE.MeshBasicMaterial({
        map,
        vertexColors: true,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        fog: false,
      });
      const layer = new THREE.Mesh(geometry, material);
      layer.name = `molen:cloud-layer-${i}`;
      layer.frustumCulled = false;
      this.cloudLayers.push(layer);
      this.object.add(layer);
    }
  }

  private updateClouds(
    seconds: number,
    camera: THREE.Camera,
    origin: Vec3,
    daylight: number,
    sun: Vec3,
  ): void {
    const { clouds, seed, atmosphere } = this.state;
    const visible = clouds.coverage > 0 && clouds.density > 0;
    if (visible && !this.cloudTexture) this.buildClouds();
    for (const layer of this.cloudLayers) layer.visible = visible;
    if (!visible) return;
    if (seed !== this.noiseSeed) {
      this.noiseSeed = seed;
      this.cloudKey = '';
      this.cloudNoise = new Float32Array(CLOUD_RESOLUTION ** 2);
      for (let y = 0; y < CLOUD_RESOLUTION; y++)
        for (let x = 0; x < CLOUD_RESOLUTION; x++) {
          let value = 0,
            weight = 0;
          for (let octave = 0; octave < 5; octave++) {
            const frequency = 8 * 2 ** octave,
              amplitude = 0.5 ** octave;
            value +=
              noise(
                (x / CLOUD_RESOLUTION) * frequency,
                (y / CLOUD_RESOLUTION) * frequency,
                frequency,
                seed + octave,
              ) * amplitude;
            weight += amplitude;
          }
          this.cloudNoise[y * CLOUD_RESOLUTION + x] = value / weight;
        }
    }
    const key = `${clouds.coverage},${clouds.density},${sun.map((v) => Math.round(v * 20)).join(',')}`;
    if (key !== this.cloudKey && this.cloudTexture && this.cloudNoise) {
      this.cloudKey = key;
      const pixels = this.cloudTexture.image.data as Uint8Array;
      const field = this.cloudNoise;
      const threshold = 0.78 - clouds.coverage * 0.62;
      for (let y = 0; y < CLOUD_RESOLUTION; y++)
        for (let x = 0; x < CLOUD_RESOLUTION; x++) {
          const i = y * CLOUD_RESOLUTION + x,
            n = field[i] ?? 0;
          const dx = (field[y * CLOUD_RESOLUTION + ((x + 1) % CLOUD_RESOLUTION)] ?? n) - n;
          const dz = (field[((y + 1) % CLOUD_RESOLUTION) * CLOUD_RESOLUTION + x] ?? n) - n;
          const rim = 1 - smooth(threshold, threshold + 0.25, n);
          const shade = clamp(
            0.56 + rim * 0.3 + (dx * sun[0] + dz * sun[2]) * 4 - clouds.density * 0.15,
          );
          const alpha =
            smooth(threshold - 0.075, threshold + 0.075, n) * (1 - Math.exp(-clouds.density * 6));
          pixels.set([shade * 255, shade * 255, shade * 255, alpha * 255], i * 4);
        }
      for (const layer of this.cloudLayers)
        if (layer.material.map) layer.material.map.needsUpdate = true;
    }
    const far =
      camera instanceof THREE.PerspectiveCamera || camera instanceof THREE.OrthographicCamera
        ? camera.far
        : 50000;
    const size = Math.max(2000, Math.min(160000, far * 1.4));
    const absoluteX = this.cameraPosition.x + origin[0],
      absoluteZ = this.cameraPosition.z + origin[2];
    this.color.set('#101829').lerp(new THREE.Color('#e4e9ee'), daylight);
    const sunset = (1 - smooth(0, 0.3, Math.abs(sun[1]))) * smooth(-0.15, 0.05, sun[1]);
    this.color.lerp(new THREE.Color('#f6b88d'), sunset * 0.55);
    this.color.multiplyScalar(1 + daylight * 1.8);
    for (const [i, layer] of this.cloudLayers.entries()) {
      layer.position.set(
        this.cameraPosition.x,
        clouds.baseAltitude + i * clouds.thickness - origin[1],
        this.cameraPosition.z,
      );
      layer.scale.set(size, 1, size);
      layer.material.color.copy(this.color);
      const map = layer.material.map as THREE.Texture;
      const scale = clouds.scale * (1 + i * 0.35);
      map.repeat.set(size / scale, size / scale);
      map.offset.set(
        wrap(
          (absoluteX - atmosphere.windVelocity[0] * seconds) / scale - size / scale / 2 + i * 0.31,
          1,
        ),
        wrap(
          -(absoluteZ - atmosphere.windVelocity[2] * seconds) / scale - size / scale / 2 + i * 0.47,
          1,
        ),
      );
    }
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
    for (const layer of this.cloudLayers) {
      layer.geometry.dispose();
      layer.material.map?.dispose();
      layer.material.dispose();
    }
    this.particles?.geometry.dispose();
    this.particles?.material.dispose();
    this.particleTexture?.dispose();
    this.object.removeFromParent();
    this.object.clear();
  }
}
