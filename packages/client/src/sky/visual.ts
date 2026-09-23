import {
  type EarthObserver,
  type SkyData,
  type SkyPalette,
  skySchema,
  type Vec3,
} from '@bendyline/molen-schema';
import * as THREE from 'three';
import { type EarthSkyState, evaluateEarthSky, skyDirection, skyTimeMs } from './astronomy';

const RAD = Math.PI / 180;
const clamp = (x: number): number => Math.max(0, Math.min(1, x));
function smooth(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

export const defaultSkyPalette: Required<SkyPalette> = {
  dayZenith: '#2374c5',
  dayHorizon: '#b8d7eb',
  twilight: '#f78753',
  nightZenith: '#020510',
  nightHorizon: '#121c32',
  ground: '#18212c',
  sun: '#fff4dc',
  moon: '#dae5f5',
};

export interface SkyFrame {
  sunDirection: Vec3;
  moonDirection?: Vec3;
  sunDiameterDeg: number;
  moonDiameterDeg: number;
  moonIllumination: number;
  daylight: number;
  starVisibility: number;
  earth?: EarthSkyState;
}

export interface SkyStar {
  /** Unit direction in the unrotated star sphere. Earth skies use J2000 equatorial XYZ. */
  direction: Vec3;
  magnitude: number;
  color?: string;
}

export interface SkyVisualOptions {
  /**
   * The star catalog: `decodeStarCatalog` of the `molen.sky` pack for Earth, or an authored
   * world's own. Without one the sky has no stars.
   */
  stars?: readonly SkyStar[];
  shadows?: 'off' | 'low' | 'medium' | 'high';
}

function mesh(
  geometry: THREE.BufferGeometry,
  order: number,
  transparent = false,
): THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> {
  geometry.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(
      new Float32Array(geometry.getAttribute('position').count * 4),
      4,
    ),
  );
  const result = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
      fog: false,
      transparent,
    }),
  );
  result.renderOrder = order;
  result.frustumCulled = false;
  return result;
}

interface CatalogStar {
  direction: THREE.Vector3;
  color: THREE.Color;
  magnitude: number;
}

/** Seven vertices per star (a centre and six rim points), fanned into six triangles. */
function starGeometry(count: number): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(new Float32Array(count * 7 * 3), 3),
  );
  const indices: number[] = [];
  for (let i = 0; i < count; i++) {
    for (let j = 0; j < 6; j++) indices.push(i * 7, i * 7 + j + 1, i * 7 + ((j + 1) % 6) + 1);
  }
  geometry.setIndex(indices);
  return geometry;
}

/** Star colour from its B−V colour index. */
export function starColor(bv: number): THREE.Color {
  return new THREE.Color('#b6d1ff')
    .lerp(new THREE.Color('#fff4e8'), smooth(-0.3, 0.5, bv))
    .lerp(new THREE.Color('#ffb46c'), smooth(0.5, 1.8, bv));
}

/**
 * Generic clear-sky dome, celestial spheres, batched stars and lighting, using standard
 * materials on WebGL and WebGPU. A separate background scene avoids far-plane, reverse-depth,
 * logarithmic-depth and floating-origin coupling. No textures, shaders or network requests.
 */
export class SkyVisual {
  readonly scene: THREE.Scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera = new THREE.PerspectiveCamera(60, 1, 0.01, 10);
  readonly lights: THREE.Group = new THREE.Group();
  readonly sunLight: THREE.DirectionalLight = new THREE.DirectionalLight();
  readonly moonLight: THREE.DirectionalLight = new THREE.DirectionalLight();
  readonly ambientLight: THREE.HemisphereLight = new THREE.HemisphereLight();
  readonly data: SkyData;
  private readonly dome = mesh(new THREE.SphereGeometry(2, 96, 48), -100);
  private readonly sun = mesh(new THREE.SphereGeometry(1, 32, 16), -70, true);
  private readonly moon = mesh(new THREE.SphereGeometry(1, 64, 32), -60, true);
  private readonly stars: ReturnType<typeof mesh>;
  private catalog: readonly CatalogStar[];
  private readonly palette: Record<keyof Required<SkyPalette>, THREE.Color>;
  private lastTime: number | undefined;
  private cloudAttenuation = 0;
  private currentFrame!: SkyFrame;
  private disposed = false;

  constructor(data: SkyData, options: SkyVisualOptions = {}) {
    this.data = skySchema.parse(data);
    if (this.data.mode === 'custom') {
      skyDirection(this.data.sunBody.direction);
      if (this.data.moonBody) skyDirection(this.data.moonBody.direction);
    }
    this.palette = Object.fromEntries(
      Object.entries({ ...defaultSkyPalette, ...data.palette }).map(([key, value]) => [
        key,
        new THREE.Color(value),
      ]),
    ) as typeof this.palette;
    this.scene.name = 'molen:sky';
    this.lights.name = 'molen:sky-lights';
    this.dome.name = 'molen:sky-dome';
    this.sun.name = 'molen:sky-sun';
    this.moon.name = 'molen:sky-moon';
    // Each star is a small six-segment radial splat in one mesh, including a soft alpha edge.
    // Unlike GL_POINTS, this renders at the same angular size on native WebGPU.
    this.catalog = this.catalogFrom(options.stars);
    this.stars = mesh(starGeometry(this.catalog.length), -80, true);
    this.stars.material.blending = THREE.AdditiveBlending;
    this.stars.name = 'molen:sky-stars';
    this.scene.add(this.dome, this.stars, this.sun, this.moon);
    this.lights.add(
      this.ambientLight,
      this.sunLight,
      this.sunLight.target,
      this.moonLight,
      this.moonLight.target,
    );
    const shadows = options.shadows ?? 'off';
    if (shadows !== 'off' && data.lighting?.castShadow !== false) {
      this.sunLight.castShadow = true;
      const size = { low: 1024, medium: 2048, high: 4096 }[shadows];
      this.sunLight.shadow.mapSize.set(size, size);
      Object.assign(this.sunLight.shadow.camera, {
        near: 0.5,
        far: 500,
        left: -50,
        right: 50,
        top: 50,
        bottom: -50,
      });
      this.sunLight.shadow.camera.updateProjectionMatrix();
    }
    this.update(0);
  }

  get frame(): SkyFrame {
    return this.currentFrame;
  }

  /** Diffuse cloud lighting; actual celestial occlusion comes from the cloud layer geometry. */
  setCloudAttenuation(value: number): void {
    const next = clamp(value);
    if (next === this.cloudAttenuation) return;
    this.cloudAttenuation = next;
    this.lastTime = undefined;
  }

  /** Move an Earth observer without rebuilding the dome, bodies or star catalog. */
  setObserver(observer: EarthObserver): void {
    if (this.disposed) throw new Error('SkyVisual has been disposed');
    if (this.data.mode !== 'earth') throw new Error('Only Earth skies have an observer');
    const next = skySchema.parse({ ...this.data, observer });
    if (next.mode === 'earth') this.data.observer = next.observer;
    this.lastTime = undefined;
  }

  /** Seek in simulation seconds. Earth render samples use a stable one-second UTC grid. */
  update(simulationSeconds: number): SkyFrame {
    if (this.disposed) throw new Error('SkyVisual has been disposed');
    if (!Number.isFinite(simulationSeconds)) throw new Error('Sky simulation time must be finite');
    const data = this.data;
    const time =
      data.mode === 'earth' ? Math.floor(skyTimeMs(data.time, simulationSeconds) / 1000) * 1000 : 0;
    if (time === this.lastTime) return this.currentFrame;
    this.lastTime = time;
    const earth = data.mode === 'earth' ? evaluateEarthSky(time, data.observer) : undefined;
    const sunDirection =
      earth?.sun.direction ??
      skyDirection(data.mode === 'custom' ? data.sunBody.direction : [0, 1, 0]);
    const moonDirection =
      earth?.moon.direction ??
      (data.mode === 'custom' && data.moonBody ? skyDirection(data.moonBody.direction) : undefined);
    const sunVector = new THREE.Vector3(...sunDirection);
    const moonVector = moonDirection ? new THREE.Vector3(...moonDirection) : undefined;
    const moonIllumination =
      earth?.moon.illuminatedFraction ?? (moonVector ? (1 - moonVector.dot(sunVector)) / 2 : 0);
    const altitude = Math.asin(sunDirection[1]) / RAD;
    const daylight = smooth(-12, 8, altitude);
    const starVisibility =
      (1 - smooth(-18, -4, altitude)) *
      (1 - 0.65 * moonIllumination * smooth(0, 0.5, moonDirection?.[1] ?? -1));
    const sunDiameterDeg =
      earth?.sun.angularDiameterDeg ??
      (data.mode === 'custom' ? (data.sunBody.angularDiameterDeg ?? 0.53) : 0.53);
    const moonDiameterDeg =
      earth?.moon.angularDiameterDeg ??
      (data.mode === 'custom' ? (data.moonBody?.angularDiameterDeg ?? 0.53) : 0.53);
    this.currentFrame = {
      sunDirection,
      ...(moonDirection ? { moonDirection } : {}),
      sunDiameterDeg,
      moonDiameterDeg,
      moonIllumination,
      daylight,
      starVisibility,
      ...(earth ? { earth } : {}),
    };
    this.updateDome(altitude, sunVector, daylight);
    this.updateBody(this.sun, sunVector, sunDiameterDeg * (data.sun?.size ?? 1), sunVector, false);
    this.sun.visible = data.sun?.visible !== false && this.sun.visible;
    this.moon.visible = false;
    if (moonVector && data.moon?.visible !== false)
      this.updateBody(
        this.moon,
        moonVector,
        moonDiameterDeg * (data.moon?.size ?? 1),
        sunVector,
        true,
      );
    const rotation = new THREE.Matrix4();
    if (earth)
      rotation.makeBasis(
        ...(earth.starBasis.map((v) => new THREE.Vector3(...v)) as [
          THREE.Vector3,
          THREE.Vector3,
          THREE.Vector3,
        ]),
      );
    else if (data.mode === 'custom')
      rotation.makeRotationFromEuler(
        new THREE.Euler(
          ...((data.starRotationDeg ?? [0, 0, 0]).map((v) => v * RAD) as [number, number, number]),
        ),
      );
    this.updateStars(
      rotation,
      starVisibility,
      moonVector,
      moonDiameterDeg * (data.moon?.size ?? 1),
    );

    const light = data.lighting;
    this.sunLight.color
      .copy(this.palette.sun)
      .lerp(this.palette.twilight, 1 - smooth(0, 18, altitude));
    this.sunLight.intensity = (light?.sunIntensity ?? 3) * smooth(-0.8, 8, altitude);
    this.moonLight.color.copy(this.palette.moon);
    this.moonLight.intensity =
      (light?.moonIntensity ?? 0.12) *
      moonIllumination *
      smooth(0, 0.2, moonDirection?.[1] ?? -1) *
      (1 - daylight);
    this.ambientLight.color.copy(this.palette.nightHorizon).lerp(this.palette.dayHorizon, daylight);
    this.ambientLight.groundColor.copy(this.palette.ground);
    this.ambientLight.intensity =
      (light?.nightAmbient ?? 0.025) * (1 - daylight) + (light?.dayAmbient ?? 0.6) * daylight;
    this.sunLight.intensity *= 1 - this.cloudAttenuation * 0.92;
    this.moonLight.intensity *= 1 - this.cloudAttenuation * 0.9;
    this.ambientLight.intensity *= 1 - this.cloudAttenuation * 0.2;
    this.ambientLight.color.lerp(
      new THREE.Color('#b9c2cb'),
      this.cloudAttenuation * daylight * 0.6,
    );
    return this.currentFrame;
  }

  /** Copy view orientation/projection only; celestial bodies never translate with the camera. */
  prepareCamera(camera: THREE.Camera): void {
    camera.updateWorldMatrix(true, false);
    camera.getWorldQuaternion(this.camera.quaternion);
    if (camera instanceof THREE.PerspectiveCamera) {
      this.camera.projectionMatrix.copy(camera.projectionMatrix);
      // A sky has its own safe clip range; copy lens/view-offset settings, not scene distances.
      this.camera.fov = camera.fov;
      this.camera.aspect = camera.aspect;
      this.camera.zoom = camera.zoom;
      this.camera.filmGauge = camera.filmGauge;
      this.camera.filmOffset = camera.filmOffset;
      this.camera.view = camera.view ? { ...camera.view } : null;
    } else if (camera instanceof THREE.OrthographicCamera) {
      this.camera.fov = 60;
      this.camera.aspect = (camera.right - camera.left) / (camera.top - camera.bottom);
      this.camera.zoom = 1;
      this.camera.filmOffset = 0;
      this.camera.view = null;
    }
    this.camera.coordinateSystem = camera.coordinateSystem;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    // Lights and targets follow the rebased camera together, preserving the celestial direction
    // while keeping the finite shadow frustum near the viewer in large worlds.
    const center = camera.getWorldPosition(new THREE.Vector3());
    this.sunLight.target.position.copy(center);
    this.sunLight.position
      .copy(center)
      .addScaledVector(new THREE.Vector3(...this.frame.sunDirection), 200);
    this.moonLight.target.position.copy(center);
    this.moonLight.position
      .copy(center)
      .addScaledVector(new THREE.Vector3(...(this.frame.moonDirection ?? [0, -1, 0])), 200);
  }

  private updateDome(altitude: number, sun: THREE.Vector3, daylight: number): void {
    const colors = this.dome.geometry.getAttribute('color');
    const positions = this.dome.geometry.getAttribute('position');
    const horizon = this.palette.nightHorizon.clone().lerp(this.palette.dayHorizon, daylight);
    const zenith = this.palette.nightZenith.clone().lerp(this.palette.dayZenith, daylight);
    const twilight = smooth(-18, -4, altitude) * (1 - smooth(0, 16, altitude));
    const color = new THREE.Color();
    const dir = new THREE.Vector3();
    for (let i = 0; i < positions.count; i++) {
      dir.fromBufferAttribute(positions, i).normalize();
      color.copy(horizon).lerp(zenith, clamp(dir.y) ** 0.45);
      const nearSun = clamp((dir.dot(sun) + 1) / 2) ** 8;
      color.lerp(
        this.palette.twilight,
        twilight * Math.exp(-Math.abs(dir.y) * 7) * (0.25 + 0.7 * nearSun),
      );
      if (dir.y < 0)
        color.lerp(
          this.palette.ground.clone().multiplyScalar(0.08 + daylight * 0.92),
          smooth(0, 0.2, -dir.y),
        );
      // Clear-sky forward glow. Distance haze and volumetric scattering are separate concerns.
      const glow = clamp(dir.dot(sun)) ** 96 * smooth(-2, 5, altitude) * 0.22;
      color.lerp(this.palette.sun, glow);
      colors.setXYZW(i, color.r, color.g, color.b, 1);
    }
    colors.needsUpdate = true;
  }

  private updateBody(
    body: ReturnType<typeof mesh>,
    direction: THREE.Vector3,
    diameter: number,
    sun: THREE.Vector3,
    lunar: boolean,
  ): void {
    const radius = Math.sin((Math.min(170, diameter) * RAD) / 2);
    body.position.copy(direction);
    body.scale.setScalar(radius);
    body.visible = direction.y + radius > 0;
    const positions = body.geometry.getAttribute('position');
    const colors = body.geometry.getAttribute('color');
    const base = lunar
      ? this.palette.moon
      : this.palette.sun.clone().lerp(this.palette.twilight, 1 - smooth(0, 0.2, direction.y));
    const normal = new THREE.Vector3();
    for (let i = 0; i < positions.count; i++) {
      normal.fromBufferAttribute(positions, i).normalize();
      const illumination = lunar
        ? (this.data.moon?.earthshine ?? 0.025) + Math.max(0, normal.dot(sun)) * 0.975
        : 2.5;
      // Subtle procedural albedo variation; an artistic moon surface, not a lunar atlas.
      const albedo = lunar
        ? 0.85 +
          0.15 * Math.sin(normal.x * 27 + Math.sin(normal.y * 19) * 2) * Math.sin(normal.z * 21)
        : 1;
      colors.setXYZW(
        i,
        base.r * illumination * albedo,
        base.g * illumination * albedo,
        base.b * illumination * albedo,
        smooth(-0.0003, 0.0003, direction.y + normal.y * radius),
      );
    }
    colors.needsUpdate = true;
    // A sphere must show only its near-facing surface for correct lunar phases.
    body.material.side = THREE.FrontSide;
  }

  /**
   * Replace the star catalog, e.g. once a catalog loaded from a content pack arrives. `undefined`
   * removes the stars. Takes effect on the next update.
   */
  setStars(stars: readonly SkyStar[] | undefined): void {
    if (this.disposed) throw new Error('SkyVisual has been disposed');
    this.catalog = this.catalogFrom(stars);
    const previous = this.stars.geometry;
    this.stars.geometry = starGeometry(this.catalog.length);
    const colors = this.stars.geometry.getAttribute('position').count * 4;
    this.stars.geometry.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(new Float32Array(colors), 4),
    );
    previous.dispose();
    // Force the next update to rewrite star positions even at an unchanged time.
    this.lastTime = undefined;
  }

  private catalogFrom(stars: readonly SkyStar[] | undefined): readonly CatalogStar[] {
    const limit = this.data.stars?.magnitudeLimit ?? 6;
    if (this.data.stars?.enabled === false || stars === undefined) return [];
    return stars
      .filter((s) => s.magnitude <= limit)
      .map((s) => {
        if (!Number.isFinite(s.magnitude)) throw new Error('Star magnitude must be finite');
        return {
          direction: new THREE.Vector3(...skyDirection(s.direction)),
          color: new THREE.Color(s.color ?? '#ffffff'),
          magnitude: s.magnitude,
        };
      });
  }

  private updateStars(
    rotation: THREE.Matrix4,
    visibility: number,
    moon: THREE.Vector3 | undefined,
    moonDiameter: number,
  ): void {
    this.stars.visible = visibility > 0 && this.catalog.length > 0;
    if (!this.stars.visible) return;
    const positions = this.stars.geometry.getAttribute('position');
    const colors = this.stars.geometry.getAttribute('color');
    const d = new THREE.Vector3(),
      right = new THREE.Vector3(),
      up = new THREE.Vector3(),
      p = new THREE.Vector3();
    const pole = new THREE.Vector3(0, 1, 0);
    for (const [i, star] of this.catalog.entries()) {
      d.copy(star.direction).applyMatrix4(rotation).normalize();
      right.crossVectors(Math.abs(d.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : pole, d).normalize();
      up.crossVectors(d, right);
      const size =
        (0.0008 + 0.00045 * Math.max(0, 6 - star.magnitude)) * (this.data.stars?.size ?? 1);
      const occluded =
        moon &&
        this.data.moon?.visible !== false &&
        d.dot(moon) > Math.cos((Math.min(170, moonDiameter) * RAD) / 2);
      const alpha = occluded
        ? 0
        : visibility * smooth(0, 0.06, d.y) * (this.data.stars?.intensity ?? 1);
      const brightness = Math.min(3, 10 ** (-0.2 * (star.magnitude - 2)));
      for (let j = 0; j < 7; j++) {
        p.copy(d);
        if (j > 0)
          p.addScaledVector(right, size * Math.cos(((j - 1) * Math.PI) / 3)).addScaledVector(
            up,
            size * Math.sin(((j - 1) * Math.PI) / 3),
          );
        positions.setXYZ(i * 7 + j, p.x, p.y, p.z);
        colors.setXYZW(
          i * 7 + j,
          star.color.r * brightness,
          star.color.g * brightness,
          star.color.b * brightness,
          j === 0 ? alpha : 0,
        );
      }
    }
    positions.needsUpdate = true;
    colors.needsUpdate = true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const object of [this.dome, this.sun, this.moon, this.stars]) {
      object.geometry.dispose();
      object.material.dispose();
    }
    for (const light of [this.sunLight, this.moonLight, this.ambientLight]) light.dispose();
    this.lights.removeFromParent();
    this.lights.clear();
    this.scene.clear();
  }
}
