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
    model.add(fuselage, propeller, part('gear', metal, -2), part('aileron', metal, 5));
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
    expect(model.getObjectByName('skin-a')).toBeUndefined();
  });
});
