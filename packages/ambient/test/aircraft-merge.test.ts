import type { AircraftSpec } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { mergeStaticAircraftParts } from '../src/client/aircraft';

const spec = {
  visual: {
    rotors: [{ node: 'propeller', axis: 'z', multiplier: 1 }],
    gearNodes: ['gear'],
    flaps: [],
    ailerons: [{ node: 'aileron', axis: 'x', multiplier: 0.4 }],
    animation: {
      bindings: [
        {
          node: 'wheel-door',
          source: 'gear',
          property: 'rotation',
          axis: 'x',
          keys: [
            [0, 0],
            [1, 1.5],
          ],
        },
      ],
    },
  },
} as unknown as AircraftSpec;

function part(name: string, material: THREE.Material, x: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  mesh.name = name;
  mesh.position.x = x;
  return mesh;
}

describe('ambient aircraft', () => {
  it('merges still parts per material and keeps every moving part as its own node', () => {
    const metal = new THREE.MeshStandardMaterial({ name: 'metal' });
    const glass = new THREE.MeshStandardMaterial({ name: 'glass' });
    const model = new THREE.Group();
    const fuselage = new THREE.Group();
    fuselage.position.y = 2;
    fuselage.add(part('skin-a', metal, 0), part('skin-b', metal, 3), part('canopy', glass, 1));
    const propeller = new THREE.Group();
    propeller.name = 'propeller';
    propeller.add(part('blade', metal, 0));
    model.add(
      fuselage,
      propeller,
      part('gear', metal, -2),
      part('aileron', metal, 5),
      part('wheel-door', metal, 7),
    );
    mergeStaticAircraftParts(model, spec);
    const meshes: THREE.Mesh[] = [];
    model.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) meshes.push(object as THREE.Mesh);
    });
    const merged = meshes.filter((mesh) => mesh.name.startsWith('ambient-merged:'));
    expect(merged.map((mesh) => mesh.name).sort()).toEqual([
      'ambient-merged:glass',
      'ambient-merged:metal',
    ]);
    // Two metal boxes (12 triangles each), placed in model space with their parent's offset.
    const metalMesh = merged.find((mesh) => mesh.name === 'ambient-merged:metal') as THREE.Mesh;
    expect((metalMesh.geometry.index?.count ?? 0) / 3).toBe(24);
    metalMesh.geometry.computeBoundingBox();
    expect(metalMesh.geometry.boundingBox?.min.y).toBeCloseTo(1.5, 6);
    expect(metalMesh.geometry.boundingBox?.max.x).toBeCloseTo(3.5, 6);
    // Moving parts are untouched: the propeller keeps its blade; gear and aileron stay meshes.
    expect(model.getObjectByName('propeller')?.getObjectByName('blade')).toBeDefined();
    expect(model.getObjectByName('gear')).toBeInstanceOf(THREE.Mesh);
    expect(model.getObjectByName('aileron')?.position.x).toBe(5);
    expect(model.getObjectByName('wheel-door')?.position.x).toBe(7);
    expect(model.getObjectByName('skin-a')).toBeUndefined();
  });

  it('merges the still meshes beneath a moving part in its own frame', () => {
    const metal = new THREE.MeshStandardMaterial({ name: 'metal' });
    const trim = new THREE.MeshStandardMaterial({ name: 'trim' });
    const model = new THREE.Group();
    const propeller = new THREE.Group();
    propeller.name = 'propeller';
    propeller.position.set(0, 1, 4);
    propeller.rotation.z = 0.5;
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Group();
      blade.rotation.z = (i * Math.PI) / 2;
      blade.add(part(`blade-${i}`, metal, 1), part(`blade-${i}-tip`, trim, 2));
      propeller.add(blade);
    }
    const hub = part('hub', metal, 0);
    const gear = part('gear', metal, 0);
    gear.add(part('wheel', trim, 0));
    propeller.add(hub);
    model.add(propeller, gear);
    model.updateMatrixWorld(true);
    const before = new THREE.Box3().setFromObject(propeller, true);
    mergeStaticAircraftParts(model, spec);
    const merged = propeller.children.filter((child) => child.name.startsWith('ambient-merged:'));
    expect(merged.map((mesh) => mesh.name).sort()).toEqual([
      'ambient-merged:metal',
      'ambient-merged:trim',
    ]);
    expect(model.getObjectByName('blade-0')).toBeUndefined();
    // Still where they were, and still turned by the propeller node.
    propeller.updateMatrixWorld(true);
    const after = new THREE.Box3().setFromObject(propeller, true);
    expect(after.min.distanceTo(before.min)).toBeLessThan(1e-5);
    expect(after.max.distanceTo(before.max)).toBeLessThan(1e-5);
    // A lone mesh under a moving part stays as it is.
    expect(gear.getObjectByName('wheel')).toBeInstanceOf(THREE.Mesh);
  });

  it('moves quantized, rotated and scaled parts into model space as three would', () => {
    const material = new THREE.MeshStandardMaterial({ name: 'skin' });
    const source = new THREE.SphereGeometry(1, 6, 4);
    // KHR_mesh_quantization: normalized Int16 positions, normalized Int8 normals.
    const quantize = (values: ArrayLike<number>, array: Int16Array | Int8Array, max: number) => {
      for (let i = 0; i < values.length; i++) array[i] = Math.round((values[i] ?? 0) * max);
      return array;
    };
    const positions = source.getAttribute('position');
    const normals = source.getAttribute('normal');
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(
        quantize(positions.array, new Int16Array(positions.array.length), 32767),
        3,
        true,
      ),
    );
    geometry.setAttribute(
      'normal',
      new THREE.BufferAttribute(
        quantize(normals.array, new Int8Array(normals.array.length), 127),
        3,
        true,
      ),
    );
    geometry.setIndex(source.index);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(1, 2, 3);
    mesh.rotation.set(0.3, -0.7, 1.1);
    mesh.scale.set(2, 0.5, 1.5);
    const parent = new THREE.Group();
    parent.rotation.y = 0.4;
    parent.add(mesh);
    const model = new THREE.Group();
    model.position.set(10, 0, -4);
    model.add(parent);
    model.updateMatrixWorld(true);
    // Reference: three's own transform of a float copy (in place, a quantized one would clamp).
    const expected = new THREE.BufferGeometry();
    for (const name of ['position', 'normal']) {
      const attribute = geometry.getAttribute(name);
      const floats = new Float32Array(attribute.count * 3);
      for (let i = 0; i < floats.length; i++)
        floats[i] = attribute.getComponent(Math.floor(i / 3), i % 3);
      expected.setAttribute(name, new THREE.BufferAttribute(floats, 3));
    }
    expected.applyMatrix4(
      new THREE.Matrix4().multiplyMatrices(model.matrixWorld.clone().invert(), mesh.matrixWorld),
    );
    const want = (name: string) => {
      const attribute = expected.getAttribute(name);
      return Array.from({ length: attribute.count * 3 }, (_, i) =>
        attribute.getComponent(Math.floor(i / 3), i % 3),
      );
    };
    mergeStaticAircraftParts(model, spec);
    const merged = model.getObjectByName('ambient-merged:skin') as THREE.Mesh;
    for (const name of ['position', 'normal']) {
      const got = Array.from(merged.geometry.getAttribute(name).array);
      want(name).forEach((value, i) => {
        expect(got[i]).toBeCloseTo(value, 5);
      });
    }
  });

  it('drops the cabin, animated instruments included, from an ambient copy', () => {
    const metal = new THREE.MeshStandardMaterial({ name: 'metal' });
    const model = new THREE.Group();
    const cockpit = new THREE.Group();
    cockpit.name = 'cockpit';
    cockpit.add(part('altitude-digit', metal, 0), part('panel', metal, 1));
    model.add(part('skin', metal, 3), cockpit);
    mergeStaticAircraftParts(model, {
      visual: {
        ...spec.visual,
        interior: { nodes: ['cockpit'], sources: [], bindings: [] },
        animation: {
          bindings: [
            {
              node: 'altitude-digit',
              source: 'altitude',
              property: 'rotation',
              axis: 'x',
              keys: [
                [0, 0],
                [1, 1],
              ],
            },
          ],
        },
      },
    } as unknown as AircraftSpec);
    expect(model.getObjectByName('cockpit')).toBeUndefined();
    expect(model.getObjectByName('altitude-digit')).toBeUndefined();
    const merged = model.getObjectByName('ambient-merged:metal') as THREE.Mesh;
    // Only the skin: 12 triangles.
    expect((merged.geometry.index?.count ?? 0) / 3).toBe(12);
  });
});
