// Screen-sized billboards pinned to world positions: photo pins, place labels rendered to images,
// waypoints. Each marker keeps a constant on-screen size, sits on the ground (re-snapping as finer
// terrain streams in), hides behind hills and buildings through the depth test, fades with
// distance, and is budgeted so only the nearest/most important ones draw. `pick(x, y)` resolves a
// click or tap to a marker id in screen space.

import * as THREE from 'three';

/** What a marker layer needs from a renderer; `Renderer` satisfies it, tests can fake it. */
export interface MarkerHost {
  readonly camera: THREE.Camera;
  /** Parent for world-space objects (rebased near the camera by the renderer). */
  readonly worldRoot: THREE.Object3D;
  /** Drawing size in CSS pixels. */
  getViewportSize(): [number, number];
}

/** An image a marker shows: a canvas, bitmap or image element, or a URL to load. */
export type MarkerImage = TexImageSource | OffscreenCanvas | string;

export interface MarkerSpec {
  id: string;
  /** World X in meters. */
  x: number;
  /** World Z in meters. */
  z: number;
  /** Absolute world height; omit to sit on the ground (`groundHeight` + `elevation`). */
  y?: number;
  /** Meters above the ground when ground-snapped (default 0). */
  elevation?: number;
  image: MarkerImage;
  /** On-screen height in CSS pixels (default 56). */
  size?: number;
  /** Which image point sits on the position: `'bottom'` for pins (default), or `'center'`. */
  anchor?: 'bottom' | 'center';
  /** Higher priority markers are kept first when over budget (default 0). */
  priority?: number;
}

export interface MarkerLayerOptions {
  /** Ground height at world X/Z, or undefined while unknown. Required for ground-snapped markers. */
  groundHeight?: (x: number, z: number) => number | undefined;
  /** Most markers drawn at once; extras nearest last are hidden (default 256). */
  maxVisible?: number;
  /** Distances (meters) over which markers fade out: full at `near`, gone at `far`. */
  fade?: { near: number; far: number };
  /** Hide markers behind terrain and buildings (default true). */
  occlude?: boolean;
  /** Hide ground-snapped markers until their ground height is known (default true). */
  hideUntilGrounded?: boolean;
  renderOrder?: number;
}

export interface MarkerScreenPosition {
  /** CSS pixels from the viewport's left edge. */
  x: number;
  /** CSS pixels from the viewport's top edge. */
  y: number;
  /** Distance from the camera in meters. */
  distance: number;
  /** In front of the camera and inside the viewport. */
  visible: boolean;
}

interface MarkerEntry {
  spec: MarkerSpec;
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  texture: THREE.Texture;
  imageKey: MarkerImage;
  aspect: number;
  groundY: number | undefined;
  distance: number;
}

const scratch = new THREE.Vector3();
const viewSpace = new THREE.Vector3();

/**
 * Project an absolute world position (the coordinates you give markers and cameras) to CSS
 * pixels, accounting for the renderer's floating-origin rebase.
 */
export function projectWorldToScreen(
  host: MarkerHost,
  position: readonly [number, number, number],
): MarkerScreenPosition {
  const [width, height] = host.getViewportSize();
  host.worldRoot.updateWorldMatrix(true, false);
  host.camera.updateMatrixWorld();
  const world = host.worldRoot.localToWorld(scratch.set(position[0], position[1], position[2]));
  viewSpace.copy(world).applyMatrix4(host.camera.matrixWorldInverse);
  const distance = viewSpace.length();
  const inFront = viewSpace.z < 0;
  world.project(host.camera);
  const x = ((world.x + 1) / 2) * width;
  const y = ((1 - world.y) / 2) * height;
  return {
    x,
    y,
    distance,
    visible: inFront && x >= 0 && x <= width && y >= 0 && y <= height,
  };
}

function imageAspect(image: MarkerImage): number | undefined {
  if (typeof image === 'string') return undefined;
  const sized = image as { width?: number; height?: number };
  if (sized.width !== undefined && sized.height !== undefined && sized.height > 0) {
    return sized.width / sized.height;
  }
  return undefined;
}

/** A group of screen-sized world markers; add markers with `set`, advance with `update`. */
export class MarkerLayer {
  readonly object: THREE.Group = new THREE.Group();
  private readonly entries = new Map<string, MarkerEntry>();
  private readonly textures = new Map<MarkerImage, { texture: THREE.Texture; users: number }>();
  private readonly loader = new THREE.TextureLoader();
  private visible = true;
  private disposed = false;

  constructor(
    private readonly host: MarkerHost,
    private readonly options: MarkerLayerOptions = {},
  ) {
    this.object.name = 'molen:markers';
  }

  /** Replace the marker set. Markers are matched by id, so unchanged images are not reloaded. */
  set(markers: readonly MarkerSpec[]): void {
    if (this.disposed) return;
    const seen = new Set<string>();
    for (const spec of markers) {
      seen.add(spec.id);
      const existing = this.entries.get(spec.id);
      if (existing !== undefined) {
        if (existing.imageKey !== spec.image) {
          this.release(existing.imageKey);
          existing.texture = this.acquire(spec.image, existing);
          existing.imageKey = spec.image;
          existing.material.map = existing.texture;
          existing.material.needsUpdate = true;
          existing.aspect = imageAspect(spec.image) ?? existing.aspect;
        }
        if (existing.spec.x !== spec.x || existing.spec.z !== spec.z) existing.groundY = undefined;
        existing.spec = { ...spec };
        continue;
      }
      const entry = this.create(spec);
      this.entries.set(spec.id, entry);
      this.object.add(entry.sprite);
    }
    for (const [id, entry] of this.entries) {
      if (!seen.has(id)) this.remove(id, entry);
    }
  }

  /** Marker ids currently in the layer. */
  ids(): string[] {
    return [...this.entries.keys()];
  }

  /**
   * Per frame: snap to ground, fade, budget, and size markers for the current camera. Pass the
   * camera's absolute world position (the one given to `setCamera`).
   */
  update(cameraPosition: readonly [number, number, number]): void {
    if (this.disposed) return;
    const [, viewportHeight] = this.host.getViewportSize();
    const perPixel = this.worldPerPixel(viewportHeight);
    const hideUntilGrounded = this.options.hideUntilGrounded ?? true;
    const candidates: MarkerEntry[] = [];
    for (const entry of this.entries.values()) {
      const { spec } = entry;
      let y = spec.y;
      if (y === undefined) {
        const ground = this.options.groundHeight?.(spec.x, spec.z);
        if (ground !== undefined) entry.groundY = ground;
        y =
          entry.groundY === undefined
            ? hideUntilGrounded
              ? undefined
              : (spec.elevation ?? 0)
            : entry.groundY + (spec.elevation ?? 0);
      }
      entry.sprite.visible = false;
      if (y === undefined || !this.visible) continue;
      entry.sprite.position.set(spec.x, y, spec.z);
      entry.distance = Math.hypot(
        spec.x - cameraPosition[0],
        y - cameraPosition[1],
        spec.z - cameraPosition[2],
      );
      candidates.push(entry);
    }
    candidates.sort(
      (a, b) =>
        (b.spec.priority ?? 0) - (a.spec.priority ?? 0) ||
        a.distance - b.distance ||
        a.spec.id.localeCompare(b.spec.id),
    );
    const budget = this.options.maxVisible ?? 256;
    const fade = this.options.fade;
    for (const [index, entry] of candidates.entries()) {
      if (index >= budget) break;
      const opacity =
        fade === undefined
          ? 1
          : Math.max(0, Math.min(1, (fade.far - entry.distance) / (fade.far - fade.near)));
      if (opacity <= 0) continue;
      const size = entry.spec.size ?? 56;
      entry.material.opacity = opacity;
      entry.sprite.scale.set(size * entry.aspect * perPixel, size * perPixel, 1);
      entry.sprite.center.set(0.5, (entry.spec.anchor ?? 'bottom') === 'bottom' ? 0 : 0.5);
      entry.sprite.visible = true;
    }
  }

  /** The front-most drawn marker under a CSS-pixel point, if any. */
  pick(x: number, y: number): string | undefined {
    let best: { id: string; distance: number } | undefined;
    for (const [id, entry] of this.entries) {
      if (!entry.sprite.visible) continue;
      const p = entry.sprite.position;
      const screen = projectWorldToScreen(this.host, [p.x, p.y, p.z]);
      if (screen.distance <= 0) continue;
      const height = entry.spec.size ?? 56;
      const width = height * entry.aspect;
      const bottom = (entry.spec.anchor ?? 'bottom') === 'bottom';
      const top = bottom ? screen.y - height : screen.y - height / 2;
      if (x < screen.x - width / 2 || x > screen.x + width / 2 || y < top || y > top + height) {
        continue;
      }
      if (best === undefined || screen.distance < best.distance) {
        best = { id, distance: screen.distance };
      }
    }
    return best?.id;
  }

  /** Where a marker's anchor point appears on screen (for DOM callouts), if it exists. */
  screenPosition(id: string): MarkerScreenPosition | undefined {
    const entry = this.entries.get(id);
    if (entry === undefined) return undefined;
    const p = entry.sprite.position;
    const screen = projectWorldToScreen(this.host, [p.x, p.y, p.z]);
    return { ...screen, visible: screen.visible && entry.sprite.visible };
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (!visible) for (const entry of this.entries.values()) entry.sprite.visible = false;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const [id, entry] of this.entries) this.remove(id, entry);
    this.object.removeFromParent();
  }

  private worldPerPixel(viewportHeight: number): number {
    const camera = this.host.camera;
    if (camera instanceof THREE.PerspectiveCamera) {
      // Size-unattenuated sprites scale by view distance, so one unit spans this angle.
      return (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / viewportHeight;
    }
    if (camera instanceof THREE.OrthographicCamera) {
      return (camera.top - camera.bottom) / camera.zoom / viewportHeight;
    }
    return 1 / viewportHeight;
  }

  private create(spec: MarkerSpec): MarkerEntry {
    const material = new THREE.SpriteMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: this.options.occlude ?? true,
      sizeAttenuation: false,
    });
    const entry: MarkerEntry = {
      spec: { ...spec },
      sprite: new THREE.Sprite(material),
      material,
      texture: undefined as unknown as THREE.Texture,
      imageKey: spec.image,
      aspect: imageAspect(spec.image) ?? 1,
      groundY: undefined,
      distance: 0,
    };
    entry.texture = this.acquire(spec.image, entry);
    material.map = entry.texture;
    entry.sprite.name = `marker:${spec.id}`;
    entry.sprite.userData.markerId = spec.id;
    entry.sprite.visible = false;
    if (this.options.renderOrder !== undefined) entry.sprite.renderOrder = this.options.renderOrder;
    return entry;
  }

  private remove(id: string, entry: MarkerEntry): void {
    entry.sprite.removeFromParent();
    entry.material.dispose();
    this.release(entry.imageKey);
    this.entries.delete(id);
  }

  private acquire(image: MarkerImage, entry: MarkerEntry): THREE.Texture {
    const cached = this.textures.get(image);
    if (cached !== undefined) {
      cached.users++;
      return cached.texture;
    }
    let texture: THREE.Texture;
    if (typeof image === 'string') {
      texture = this.loader.load(image, (loaded) => {
        const aspect = imageAspect(loaded.image as TexImageSource);
        if (aspect === undefined) return;
        for (const other of this.entries.values())
          if (other.imageKey === image) other.aspect = aspect;
        entry.aspect = aspect;
      });
    } else {
      texture = new THREE.Texture(image as TexImageSource);
      texture.needsUpdate = true;
    }
    texture.colorSpace = THREE.SRGBColorSpace;
    this.textures.set(image, { texture, users: 1 });
    return texture;
  }

  private release(image: MarkerImage): void {
    const cached = this.textures.get(image);
    if (cached === undefined) return;
    cached.users--;
    if (cached.users > 0) return;
    cached.texture.dispose();
    this.textures.delete(image);
  }
}

/** Create a marker layer and attach it under the host's world root. */
export function createMarkerLayer(host: MarkerHost, options: MarkerLayerOptions = {}): MarkerLayer {
  const layer = new MarkerLayer(host, options);
  host.worldRoot.add(layer.object);
  return layer;
}
