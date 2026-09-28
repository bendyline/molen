import { describe, expect, it } from 'vitest';
import { encodeGlb, MeshBufferBuilder } from '../dist/kernel.mjs';
import {
  createArchitecturalSurfaceAuthoring,
  resolveArchitecturalSurface,
} from '../scripts/architectural-surface-authoring.mjs';

const wall = { graph: 'wood_painted_lap', slot: 'wall', roughness: 0.63, metallic: 0 };
const clear = {
  slot: 'window',
  localRef: 'palette:#efffff',
  name: 'original-clear-film',
  roughness: 0.16,
  metallic: 0.04,
  alphaMode: 'BLEND',
  baseColorFactor: [0.9, 0.8, 0.7, 0.22],
  doubleSided: true,
};
const points = [
  [0, 0, 0],
  [4, 0, 0],
  [4, 3.2, 0],
  [0, 3.2, 0],
];
const normal = [0, 0, 1];
const color = [0.31, 0.42, 0.53];
const wallRef = 'matgraph:molen.worldgen.material.wood_painted_lap';
const wallGroup = { slot: 'wall', materialRef: wallRef };
const clearGroup = { slot: 'window', materialRef: clear.localRef };
function recorder() {
  const calls = [];
  return {
    calls,
    addQuad: (...args) => calls.push(args),
    addTriangle: (...args) => calls.push(args),
    addConvexPolygon: (...args) => calls.push(args),
  };
}

describe('explicit architectural surface authoring', () => {
  it('requires known graphs, physical repeats, legal mesh slots and explicit local references', () => {
    expect(resolveArchitecturalSurface(wall)).toEqual({
      surface: wall,
      repeat: [2, 1.6],
      ref: wallRef,
    });
    expect(resolveArchitecturalSurface(clear).repeat).toEqual([1, 1]);
    for (const surface of [
      { ...wall, graph: 'missing_graph' },
      { ...wall, graph: 'toString' },
      { ...wall, slot: 'facade' },
      { ...wall, localRef: 'palette:#ffffff' },
      { slot: 'wall' },
      { slot: 'wall', localRef: '' },
    ])
      expect(() => resolveArchitecturalSurface(surface)).toThrow();
    for (const repeat of [[0, 1], [-1, 1], [1, Infinity], [1, NaN], [2], '2,2'])
      expect(() => resolveArchitecturalSurface(wall, { wood_painted_lap: repeat })).toThrow(
        'Invalid physical repeat',
      );
  });

  it('uses meter-scale planar UVs while passing geometry, normals and vertex colors through', () => {
    const target = recorder();
    const wrapped = createArchitecturalSurfaceAuthoring({ wall }).wrap(target);
    wrapped.addQuad('wall', 'palette:#ffffff', points, normal, [], color);
    expect(target.calls[0]).toEqual([
      'wall',
      wallRef,
      points,
      normal,
      [
        [0, 0],
        [2, 0],
        [2, 2],
        [0, 2],
      ],
      color,
    ]);
    expect(target.calls[0][2]).toBe(points);
    expect(target.calls[0][3]).toBe(normal);
    expect(target.calls[0][5]).toBe(color);
    const horizontal = [
      [0, 0, 0],
      [4, 0, 0],
      [4, 0, 3.2],
    ];
    wrapped.addTriangle('wall', 'palette:#ffffff', horizontal, [0, 1, 0], [], color);
    expect(target.calls[1][4]).toEqual([
      [0, 0],
      [2, 0],
      [2, -2],
    ]);
  });

  it('honors explicit metric quads and keeps triangle conversion opt-in', () => {
    const metricUvs = [
      [0, 0],
      [2, 0],
      [2, 1.6],
      [0, 1.6],
    ];
    for (const metricTriangleUv of [false, true]) {
      const target = recorder();
      const wrapped = createArchitecturalSurfaceAuthoring({ wall }, { metricTriangleUv }).wrap(
        target,
      );
      wrapped.addQuad('wall', 'metric:uv', points, normal, metricUvs, color);
      wrapped.addTriangle(
        'wall',
        'metric:uv',
        points.slice(0, 3),
        normal,
        metricUvs.slice(0, 3),
        color,
      );
      expect(target.calls[0][4]).toEqual([
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ]);
      expect(target.calls[1][4]).toEqual(
        metricTriangleUv
          ? [
              [0, 0],
              [1, 0],
              [1, 1],
            ]
          : [
              [0, 0],
              [2, 0],
              [2, 2],
            ],
      );
    }
  });

  it('passes a metric UV callback to convex polygons and rejects undeclared components', () => {
    const target = recorder();
    const wrapped = createArchitecturalSurfaceAuthoring({ wall }).wrap(target);
    wrapped.addConvexPolygon('wall', 'palette:#ffffff', points, normal, () => [0, 0], color);
    expect(target.calls[0][4]([3, 1.6, 0])).toEqual([1.5, 1]);
    expect(() => wrapped.addQuad('constructor', '', points, normal, [], color)).toThrow(
      'Unknown architectural surface',
    );
  });

  it('keeps portable alpha/PBR parameters and only binds explicitly shared surfaces', () => {
    const authoring = createArchitecturalSurfaceAuthoring({ wall, clear });
    const wrapped = authoring.wrap(recorder());
    wrapped.addQuad('wall', '', points, normal, [], color);
    wrapped.addQuad('clear', '', points, normal, [], color);
    const materials = authoring.materials([wallGroup, clearGroup]);
    expect(materials[0]).toEqual({
      name: 'wood_painted_lap',
      roughness: 0.63,
      metallic: 0,
      sharedSurface: { ref: wallRef, slot: 'wall', uv: 'repeats' },
    });
    expect(materials[1]).toEqual({
      name: clear.name,
      roughness: clear.roughness,
      metallic: clear.metallic,
      alphaMode: 'BLEND',
      baseColorFactor: clear.baseColorFactor,
      doubleSided: true,
    });
    expect(materials[1]).not.toHaveProperty('sharedSurface');
    expect(() => authoring.materials([{ slot: 'roof', materialRef: wallRef }])).toThrow(
      'Unknown GLB surface',
    );
  });

  it('preserves opaque sidedness by default and provides explicit legacy emission compatibility', () => {
    const pane = {
      slot: 'window',
      localRef: 'palette:#aaaaaa',
      roughness: 0.2,
      doubleSided: true,
      baseColorFactor: [1, 0.9, 0.8, 1],
    };
    for (const legacyAlphaFields of [false, true]) {
      const authoring = createArchitecturalSurfaceAuthoring({ pane }, { legacyAlphaFields });
      authoring.wrap(recorder()).addQuad('pane', '', points, normal, [], color);
      const [material] = authoring.materials([{ slot: 'window', materialRef: pane.localRef }]);
      if (legacyAlphaFields) {
        expect(material).not.toHaveProperty('doubleSided');
        expect(material).not.toHaveProperty('baseColorFactor');
      } else {
        expect(material.doubleSided).toBe(true);
        expect(material.baseColorFactor).toEqual(pane.baseColorFactor);
      }
    }
  });

  it('encodes the same GLB bytes as explicit geometry, UVs and portable materials', () => {
    const authored = new MeshBufferBuilder();
    const authoring = createArchitecturalSurfaceAuthoring({ wall, clear });
    const wrapped = authoring.wrap(authored);
    wrapped.addQuad('wall', 'palette:#ffffff', points, normal, [], color);
    wrapped.addTriangle('clear', 'palette:#ffffff', points.slice(0, 3), normal, [], color);
    const mesh = authored.finalize();
    const manual = new MeshBufferBuilder();
    manual.addQuad(
      'wall',
      wallRef,
      points,
      normal,
      [
        [0, 0],
        [2, 0],
        [2, 2],
        [0, 2],
      ],
      color,
    );
    manual.addTriangle(
      'window',
      clear.localRef,
      points.slice(0, 3),
      normal,
      [
        [0, 0],
        [4, 0],
        [4, 3.2],
      ],
      color,
    );
    const expected = encodeGlb(
      manual.finalize(),
      [
        {
          name: 'wood_painted_lap',
          roughness: 0.63,
          metallic: 0,
          sharedSurface: { ref: wallRef, slot: 'wall', uv: 'repeats' },
        },
        {
          name: clear.name,
          roughness: 0.16,
          metallic: 0.04,
          alphaMode: 'BLEND',
          baseColorFactor: [0.9, 0.8, 0.7, 0.22],
          doubleSided: true,
        },
      ],
      'surface-adapter-test',
    );
    expect(encodeGlb(mesh, authoring.materials(mesh.groups), 'surface-adapter-test')).toEqual(
      expected,
    );
  });
});
