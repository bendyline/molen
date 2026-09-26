import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { composeMarkerImage } from '../src/markers/marker-image';
import {
  createMarkerLayer,
  type MarkerHost,
  type MarkerSpec,
  projectWorldToScreen,
} from '../src/markers/marker-layer';

const VIEW: [number, number] = [800, 600];

/** A renderer-shaped host: a real camera and world root, like `Renderer`, without WebGL. */
function host(origin: [number, number, number] = [0, 0, 0]): MarkerHost & {
  camera: THREE.PerspectiveCamera;
  worldRoot: THREE.Group;
  look(position: [number, number, number], target: [number, number, number]): void;
} {
  const camera = new THREE.PerspectiveCamera(60, VIEW[0] / VIEW[1], 0.5, 100_000);
  const worldRoot = new THREE.Group();
  worldRoot.position.set(-origin[0], -origin[1], -origin[2]);
  return {
    camera,
    worldRoot,
    getViewportSize: () => VIEW,
    // Mirrors Renderer.setCamera: the camera lives in rebased coordinates.
    look(position, target) {
      camera.position.set(
        position[0] - origin[0],
        position[1] - origin[1],
        position[2] - origin[2],
      );
      camera.lookAt(target[0] - origin[0], target[1] - origin[1], target[2] - origin[2]);
      camera.updateMatrixWorld();
    },
  };
}

const image = { width: 64, height: 64 } as unknown as TexImageSource;
const wide = { width: 128, height: 64 } as unknown as TexImageSource;

function marker(id: string, x: number, z: number, patch: Partial<MarkerSpec> = {}): MarkerSpec {
  return { id, x, z, image, ...patch };
}

describe('world-to-screen projection', () => {
  it('maps the look target to the viewport center through a rebased origin', () => {
    const rebased = host([1_000_000, 0, -2_000_000]);
    rebased.look([1_000_000, 100, -2_000_000 + 300], [1_000_000, 0, -2_000_000]);
    const center = projectWorldToScreen(rebased, [1_000_000, 0, -2_000_000]);
    expect(center.x).toBeCloseTo(400, 6);
    expect(center.y).toBeCloseTo(300, 6);
    expect(center.visible).toBe(true);
    expect(center.distance).toBeCloseTo(Math.hypot(100, 300), 6);
    const behind = projectWorldToScreen(rebased, [1_000_000, 100, -2_000_000 + 1000]);
    expect(behind.visible).toBe(false);
  });
});

describe('marker layer', () => {
  it('snaps markers to streamed ground and keeps a constant on-screen size', () => {
    const view = host();
    view.look([0, 50, 200], [0, 0, 0]);
    let ground: number | undefined;
    const layer = createMarkerLayer(view, { groundHeight: () => ground });
    layer.set([marker('a', 0, 0, { elevation: 2, size: 40 })]);
    layer.update([0, 50, 200]);
    const sprite = layer.object.children[0] as THREE.Sprite;
    expect(view.worldRoot.children).toContain(layer.object);
    expect(sprite.visible).toBe(false); // ground not loaded yet
    ground = 12;
    layer.update([0, 50, 200]);
    expect(sprite.visible).toBe(true);
    expect(sprite.position.y).toBe(14);
    const perPixel = (2 * Math.tan(Math.PI / 6)) / VIEW[1];
    expect(sprite.scale.y).toBeCloseTo(40 * perPixel, 9);
    expect(sprite.center.y).toBe(0);
  });

  it('draws only the budgeted nearest markers, preferring higher priority', () => {
    const view = host();
    view.look([0, 100, 0], [0, 0, -1]);
    const layer = createMarkerLayer(view, { groundHeight: () => 0, maxVisible: 2 });
    layer.set([
      marker('near', 0, -10),
      marker('mid', 0, -20),
      marker('far', 0, -30),
      marker('vip', 0, -500, { priority: 1 }),
    ]);
    layer.update([0, 100, 0]);
    const drawn = layer.object.children
      .filter((child) => child.visible)
      .map((child) => child.userData.markerId);
    expect(drawn.sort()).toEqual(['near', 'vip']);
  });

  it('fades markers with distance and hides them past the far limit', () => {
    const view = host();
    view.look([0, 0, 0], [0, 0, -1]);
    const layer = createMarkerLayer(view, { fade: { near: 100, far: 200 } });
    layer.set([marker('half', 0, -150, { y: 0 }), marker('gone', 0, -250, { y: 0 })]);
    layer.update([0, 0, 0]);
    const [half, gone] = layer.object.children as THREE.Sprite[];
    expect((half?.material as THREE.SpriteMaterial).opacity).toBeCloseTo(0.5, 9);
    expect(gone?.visible).toBe(false);
  });

  it('picks the front-most marker under a point using its pin footprint', () => {
    const view = host();
    view.look([0, 0, 100], [0, 0, 0]);
    const layer = createMarkerLayer(view);
    layer.set([
      marker('back', 0, -50, { y: 0, size: 60 }),
      marker('front', 0, 0, { y: 0, size: 60, image: wide }),
    ]);
    layer.update([0, 0, 100]);
    // Pins rise above their point: the center pixel row sits at the anchor, the pin above it.
    expect(layer.pick(400, 280)).toBe('front');
    // The wide image extends 60 px each side; the square one only 30.
    expect(layer.pick(455, 280)).toBe('front');
    expect(layer.pick(400, 320)).toBeUndefined();
    expect(layer.screenPosition('front')?.visible).toBe(true);
    layer.setVisible(false);
    expect(layer.pick(400, 280)).toBeUndefined();
  });

  it('reuses textures for shared images, swaps changed ones, and disposes cleanly', () => {
    const view = host();
    const layer = createMarkerLayer(view);
    layer.set([marker('a', 0, 0), marker('b', 1, 0)]);
    const [a, b] = layer.object.children as THREE.Sprite[];
    const shared = (a?.material as THREE.SpriteMaterial).map;
    expect((b?.material as THREE.SpriteMaterial).map).toBe(shared);
    let disposed = 0;
    shared?.addEventListener('dispose', () => {
      disposed++;
    });
    layer.set([marker('a', 0, 0, { image: wide }), marker('b', 1, 0, { image: wide })]);
    expect(disposed).toBe(1);
    layer.set([marker('b', 1, 0, { image: wide })]);
    expect(layer.ids()).toEqual(['b']);
    layer.dispose();
    expect(view.worldRoot.children).not.toContain(layer.object);
    expect(layer.object.children).toHaveLength(0);
  });
});

describe('marker images', () => {
  it('frames the image with a border and a tail whose tip is the bottom-center', () => {
    const calls: string[] = [];
    const context = new Proxy(
      {},
      {
        get:
          (_target, name) =>
          (...args: unknown[]) => {
            calls.push(`${String(name)}(${args.length})`);
          },
        set: () => true,
      },
    );
    let size: [number, number] = [0, 0];
    const canvas = composeMarkerImage({ width: 200, height: 100 } as unknown as HTMLCanvasElement, {
      size: 40,
      borderWidth: 2,
      tail: 8,
      shadow: 4,
      pixelRatio: 1,
      createCanvas: (width, height) => {
        size = [width, height];
        return { width, height, getContext: () => context } as unknown as HTMLCanvasElement;
      },
    });
    expect(canvas).toBeDefined();
    expect(size).toEqual([44 + 8, 4 + 44 + 8]);
    // A centered square crop of the 200x100 source.
    expect(calls).toContain('drawImage(9)');
    expect(calls.filter((call) => call === 'fill(0)')).toHaveLength(2);
  });
});
