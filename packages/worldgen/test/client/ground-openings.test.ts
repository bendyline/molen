import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  createGroundOpeningGuard,
  GROUND_OPEN_RECHECK,
  type GroundOpenings,
  GroundOpeningsWatch,
} from '../../src/client/ground-openings';
import { createInstancedPlacementLod } from '../../src/client/instanced-lod';
import type { PreparedModel } from '../../src/client/instanced-models';
import { disposeWorldgenObject } from '../../src/client/upload';
import { PLACEMENT_STRIDE, type PlacementSet } from '../../src/kernel/types';

function model(ref: string, size: number): PreparedModel {
  const geometry = new THREE.BoxGeometry(size, size, size).translate(0, size / 2, 0);
  geometry.computeBoundingBox();
  return {
    ref,
    geometry,
    material: new THREE.MeshStandardMaterial(),
    bounds: (geometry.boundingBox as THREE.Box3).clone(),
    builtin: true,
  };
}
const models = [model('near', 1), model('medium', 1), model('far', 1)] as const;

/** A plant every 4 m over 64 m square at 10 m, and a row of them up at 30 m along z = 30. */
function set(): PlacementSet {
  const points: [number, number, number][] = [];
  for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) points.push([i * 4 + 2, 10, j * 4 + 2]);
  for (let i = 0; i < 16; i++) points.push([i * 4 + 1, 30, 31]);
  const data = new Float32Array(points.length * PLACEMENT_STRIDE);
  points.forEach(([x, y, z], k) => {
    data.set([x, y, z, 0.3, 1, 2, 1, 0.4, 0.5, 0.3], k * PLACEMENT_STRIDE);
  });
  return { setId: 'shrubs', modelRef: 'shrub', count: points.length, data };
}

/** Every instance under `root`, in `frame`'s frame: its position and whether it has any size. */
function instances(root: THREE.Object3D, frame: THREE.Object3D): { at: string; sized: boolean }[] {
  frame.updateMatrixWorld(true);
  const inverse = new THREE.Matrix4().copy(frame.matrixWorld).invert();
  const out: { at: string; sized: boolean }[] = [];
  const matrix = new THREE.Matrix4();
  root.traverse((object) => {
    const batch = object as THREE.InstancedMesh;
    if (!batch.isInstancedMesh) return;
    for (let i = 0; i < batch.count; i++) {
      batch.getMatrixAt(i, matrix);
      const sized = new THREE.Vector3().setFromMatrixScale(matrix).length() > 0;
      matrix.premultiply(batch.matrixWorld).premultiply(inverse);
      const p = new THREE.Vector3().setFromMatrixPosition(matrix);
      out.push({ at: `${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}`, sized });
    }
  });
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

function perspective(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 5000);
  camera.position.set(532, 40, 332);
  camera.updateMatrixWorld();
  return camera;
}

describe('ground openings', () => {
  it('watches a version, or asks again every so many frames without one', () => {
    let version = 3;
    const versioned = new GroundOpeningsWatch({
      near: () => true,
      at: () => false,
      version: () => version,
    });
    expect(versioned.due()).toBe(true);
    expect(versioned.due()).toBe(false);
    version = 4;
    expect(versioned.due()).toBe(true);
    expect(versioned.due()).toBe(false);
    const counted = new GroundOpeningsWatch({ near: () => true, at: () => false });
    const answers = Array.from({ length: GROUND_OPEN_RECHECK * 2 + 1 }, () => counted.due());
    expect(answers.flatMap((due, frame) => (due ? [frame] : []))).toEqual([
      0,
      GROUND_OPEN_RECHECK,
      GROUND_OPEN_RECHECK * 2,
    ]);
  });

  it('hides placed instances on opened ground and shows them again when it closes', () => {
    // The batch's group stands where its tile does; the guard answers in the group's frame.
    const tile = new THREE.Group();
    tile.position.set(500, 0, 300);
    const group = new THREE.Group();
    tile.add(group);
    const placed = createInstancedPlacementLod(set(), models, {
      cellSize: 32,
      cellGrid: { cellsPerAxis: 2 },
      screenSpace: { viewportHeight: 900, maxPixelError: 2 },
    });
    group.add(placed);
    // A cutting over x 20..40, z 20..40, opened below 20 m once `bored`: the plants at 30 m
    // there stand on the hill over its roof.
    let bored = false,
      version = 1,
      asked = 0;
    const inside = (x: number, z: number): boolean => x >= 20 && x < 40 && z >= 20 && z < 40;
    const openings: GroundOpenings = {
      near: (x0, z0, x1, z1) => x0 < 40 && x1 >= 20 && z0 < 40 && z1 >= 20,
      at: (x, y, z) => {
        asked++;
        return bored && inside(x, z) && y < 20;
      },
      version: () => version,
    };
    const guard = createGroundOpeningGuard([placed], openings, 'guard-test');
    group.add(guard);
    tile.updateMatrixWorld(true);
    const whole = instances(placed, group);
    expect(whole.every((instance) => instance.sized)).toBe(true);
    // A shadow camera does nothing; the view camera finds the instances that may be opened.
    guard.update(new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10));
    expect(asked).toBe(0);
    guard.update(perspective());
    expect(guard.watched).toBe(25 + 5);
    expect(asked).toBe(guard.watched);
    expect(guard.hidden).toBe(0);
    expect(instances(placed, group)).toEqual(whole);
    // The bore arrives: nothing until the host's version moves, then the cutting's plants go.
    bored = true;
    guard.update(perspective());
    expect(guard.hidden).toBe(0);
    version++;
    guard.update(perspective());
    expect(guard.hidden).toBe(25);
    const after = instances(placed, group);
    for (const instance of after) {
      const [x, y, z] = instance.at.split(',').map(Number) as [number, number, number];
      expect(instance.sized).toBe(!(inside(x, z) && y < 20));
    }
    // Hidden where it stood, so batch bounds and order are untouched.
    expect(after.map((instance) => instance.at)).toEqual(whole.map((instance) => instance.at));
    // The opening closes: every instance is as it was.
    bored = false;
    version++;
    guard.update(perspective());
    expect(guard.hidden).toBe(0);
    expect(instances(placed, group)).toEqual(whole);
    disposeWorldgenObject(group);
  });
});
