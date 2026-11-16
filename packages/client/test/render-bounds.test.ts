import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  boxOutsideView,
  expandRenderBounds,
  markRenderBoundsChanged,
  RENDER_BOUNDS,
  RENDER_BOUNDS_STALE,
  viewProjection,
} from '../src/three/render-bounds';

function camera(position: [number, number, number], lookAt: [number, number, number]) {
  const view = new THREE.PerspectiveCamera(60, 16 / 9, 1, 500_000);
  view.position.set(...position);
  view.lookAt(...lookAt);
  view.updateMatrixWorld();
  return viewProjection(view, new THREE.Matrix4());
}

const box = (min: [number, number, number], max: [number, number, number]) =>
  [new THREE.Vector3(...min), new THREE.Vector3(...max)] as const;

describe('render group bounds', () => {
  it('finds a box outside a view only when every corner is beyond one side of it', () => {
    // Looking down -Z from the origin.
    const view = camera([0, 0, 0], [0, 0, -1]);
    expect(boxOutsideView(view, ...box([-10, -10, -200], [10, 10, -100]))).toBe(false);
    // Behind the camera, and far off to each side.
    expect(boxOutsideView(view, ...box([-10, -10, 100], [10, 10, 200]))).toBe(true);
    expect(boxOutsideView(view, ...box([900, -10, -200], [1_000, 10, -100]))).toBe(true);
    expect(boxOutsideView(view, ...box([-1_000, -10, -200], [-900, 10, -100]))).toBe(true);
    expect(boxOutsideView(view, ...box([-10, 500, -200], [10, 600, -100]))).toBe(true);
    // Across the edge of the view, around the camera, and reaching in from behind it: inside.
    expect(boxOutsideView(view, ...box([100, -10, -200], [1_000, 10, -100]))).toBe(false);
    expect(boxOutsideView(view, ...box([-50, -50, -50], [50, 50, 50]))).toBe(false);
    expect(boxOutsideView(view, ...box([-10, -10, -100], [10, 10, 200]))).toBe(false);
    // However far away: the far plane is not a reason to leave ground out.
    expect(boxOutsideView(view, ...box([-10, -10, -900_000], [10, 10, -800_000]))).toBe(false);
  });

  it('agrees with three for an orthographic view such as a shadow map', () => {
    const light = new THREE.OrthographicCamera(-300, 300, 300, -300, 1, 5_000);
    light.position.set(0, 2_000, 0);
    light.lookAt(0, 0, 0);
    light.updateMatrixWorld();
    const view = viewProjection(light, new THREE.Matrix4());
    expect(boxOutsideView(view, ...box([-50, 0, -50], [50, 80, 50]))).toBe(false);
    expect(boxOutsideView(view, ...box([250, 0, -50], [900, 80, 50]))).toBe(false);
    expect(boxOutsideView(view, ...box([400, 0, -50], [900, 80, 50]))).toBe(true);
    expect(boxOutsideView(view, ...box([-50, 0, -900], [50, 80, -310]))).toBe(true);
    // A map is a box along its light too: ground lined up with its sides, but above where it
    // starts or below where it ends, is outside once the depth range is given.
    const depth = { view: light.matrixWorldInverse, near: light.near, far: light.far };
    expect(boxOutsideView(view, ...box([-50, 0, -50], [50, 80, 50]), depth)).toBe(false);
    expect(boxOutsideView(view, ...box([-50, 2_100, -50], [50, 2_500, 50]))).toBe(false);
    expect(boxOutsideView(view, ...box([-50, 2_100, -50], [50, 2_500, 50]), depth)).toBe(true);
    expect(boxOutsideView(view, ...box([-50, -9_000, -50], [50, -3_100, 50]), depth)).toBe(true);
    expect(boxOutsideView(view, ...box([-50, -9_000, -50], [50, -2_900, 50]), depth)).toBe(false);
  });

  it('measures content from its geometry, through nested and instanced parts', () => {
    const frame = new THREE.Group();
    frame.position.set(5_000, 0, 5_000);
    const layer = new THREE.Group();
    layer.position.set(100, 0, 0);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(20, 300, 20));
    tower.position.set(50, 150, 40);
    const yard = new THREE.Group();
    yard.rotation.y = Math.PI / 2;
    yard.position.set(0, 0, 200);
    const shed = new THREE.Mesh(new THREE.BoxGeometry(40, 6, 10));
    shed.position.set(0, 3, 0);
    yard.add(shed);
    const trees = new THREE.InstancedMesh(new THREE.BoxGeometry(4, 12, 4), undefined, 2);
    trees.setMatrixAt(0, new THREE.Matrix4().makeTranslation(-300, 6, 0));
    trees.setMatrixAt(1, new THREE.Matrix4().makeTranslation(0, 6, 700));
    // Boxes their makers worked out, as streamed content's are: read as they stand.
    tower.geometry.computeBoundingBox();
    shed.geometry.computeBoundingBox();
    trees.computeBoundingBox();
    layer.add(tower, yard, trees);
    frame.add(layer);
    // Not attached to a scene and never drawn: local matrices alone.
    const bounds = expandRenderBounds(new THREE.Box3(), layer, frame);
    expect(bounds.min.x).toBeCloseTo(100 - 300 - 2);
    expect(bounds.max.x).toBeCloseTo(100 + 50 + 10);
    expect(bounds.min.y).toBeCloseTo(0);
    expect(bounds.max.y).toBeCloseTo(300);
    // The shed is turned a quarter: its 40 m run along Z.
    expect(bounds.min.z).toBeCloseTo(-2);
    expect(bounds.max.z).toBeCloseTo(702);
    const padded = expandRenderBounds(new THREE.Box3(), layer, frame, 8);
    expect(padded.max.y).toBeCloseTo(308);
    expect(padded.min.x).toBeCloseTo(100 - 300 - 2 - 8);
    // The same content one level down is measured in the frame all the same.
    const direct = expandRenderBounds(new THREE.Box3(), tower, frame);
    expect(direct.min.x).toBeCloseTo(100 + 50 - 10);
    expect(direct.max.z).toBeCloseTo(40 + 10);
    // A mesh with no box of its own costs no pass over its vertices: the box round the sphere
    // three culls it by, which holds it all the same.
    const plain = new THREE.Mesh(new THREE.BoxGeometry(20, 300, 20));
    plain.position.set(50, 150, 40);
    layer.add(plain);
    const loose = expandRenderBounds(new THREE.Box3(), plain, frame);
    expect(plain.geometry.boundingBox).toBeNull();
    expect(loose.containsBox(direct)).toBe(true);
    const radius = Math.hypot(10, 150, 10);
    expect(loose.max.y).toBeCloseTo(150 + radius);
    expect(loose.min.x).toBeCloseTo(100 + 50 - radius);
  });

  it('gives a part marked as moving the sphere it can sweep about its origin', () => {
    const frame = new THREE.Group();
    const hub = new THREE.Group();
    hub.position.set(0, 80, 0);
    hub.userData.dynamicTransform = true;
    // A blade 40 m long, standing straight up from the hub as built.
    const blade = new THREE.Mesh(new THREE.BoxGeometry(2, 40, 1));
    blade.position.set(0, 20, 0);
    hub.add(blade);
    frame.add(hub);
    const bounds = expandRenderBounds(new THREE.Box3(), hub, frame);
    // Wherever it turns, the blade's tip stays within its reach of the hub.
    for (const turn of [0, 1, 2, 3, 4, 5]) {
      hub.rotation.set(turn, turn * 0.7, turn * 1.3);
      hub.updateMatrix();
      const tip = new THREE.Vector3(1, 40, 0.5).applyMatrix4(hub.matrix);
      expect(bounds.containsPoint(tip)).toBe(true);
    }
    expect(bounds.max.y).toBeGreaterThan(80 + 40);
    expect(bounds.min.x).toBeLessThan(-40);
  });

  it('marks the nearest group with bounds as needing them worked out again', () => {
    const tile = new THREE.Group();
    tile.userData[RENDER_BOUNDS] = new THREE.Box3();
    const layer = new THREE.Group();
    const holder = new THREE.Group();
    tile.add(layer);
    layer.add(holder);
    markRenderBoundsChanged(holder);
    expect(tile.userData[RENDER_BOUNDS_STALE]).toBe(true);
    expect(layer.userData[RENDER_BOUNDS_STALE]).toBeUndefined();
    // Outside any group with bounds there is nobody to tell.
    expect(() => markRenderBoundsChanged(new THREE.Group())).not.toThrow();
  });
});
