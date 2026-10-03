import { expect, test } from 'vitest';
import { landmarkSceneTriangles } from './visual/landmark-capture-geometry.mjs';

test('geometry evidence counts repeated mesh nodes and only the selected scene', () => {
  const gltf = {
    scene: 1,
    scenes: [{ nodes: [3] }, { nodes: [0] }],
    nodes: [{ children: [1, 2] }, { mesh: 0 }, { mesh: 0 }, { mesh: 1 }],
    meshes: [{ primitives: [{ indices: 0 }] }, { primitives: [{ indices: 1 }] }],
    accessors: [{ count: 36 }, { count: 300 }],
  };
  expect(landmarkSceneTriangles(gltf)).toBe(24);
  gltf.nodes[2].extensions = { EXT_mesh_gpu_instancing: { attributes: { TRANSLATION: 2 } } };
  gltf.accessors.push({ count: 3 });
  expect(landmarkSceneTriangles(gltf)).toBe(48);
  expect(landmarkSceneTriangles(gltf, { expandGpuInstances: false })).toBe(24);
  gltf.nodes[2].extensions.EXT_mesh_gpu_instancing.attributes.ROTATION = 1;
  expect(() => landmarkSceneTriangles(gltf, { expandGpuInstances: false })).toThrow();
});

test('triangle strips, fans and nonindexed meshes count without counting lines', () => {
  const gltf = {
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    accessors: [{ count: 8 }],
    meshes: [
      {
        primitives: [
          { mode: 5, attributes: { POSITION: 0 } },
          { mode: 6, indices: 0 },
          { mode: 1, indices: 0 },
        ],
      },
    ],
  };
  expect(landmarkSceneTriangles(gltf)).toBe(12);
  gltf.nodes[0].children = [0];
  expect(() => landmarkSceneTriangles(gltf)).toThrow('cyclic');
});
