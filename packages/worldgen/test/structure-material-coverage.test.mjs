import { describe, expect, it } from 'vitest';
import {
  inspectStructureMaterials,
  summarizeStructureMaterials,
} from '../scripts/structure-material-coverage.mjs';

const ref = 'matgraph:molen.worldgen.material.wood_painted_lap';
const refs = new Set([ref]);
const surface = { ref, slot: 'wall', uv: 'repeats' };

describe('structure material coverage', () => {
  it('checks every primitive sharing a material instead of accepting any UV-bearing mesh', () => {
    const result = inspectStructureMaterials(
      {
        materials: [{ name: 'siding', extras: { molenSurface: surface } }],
        meshes: [
          {
            primitives: [
              { material: 0, attributes: { POSITION: 0, TEXCOORD_0: 1, COLOR_0: 2 } },
              { material: 0, attributes: { POSITION: 3 } },
              { material: 0, attributes: { POSITION: 4, TEXCOORD_0: null } },
            ],
          },
        ],
      },
      refs,
    );
    expect(result.issues).toEqual([{ material: 0, code: 'missing-uv0' }]);
    expect(result.definitions[0]).toMatchObject({
      primitives: 3,
      uv0Primitives: 1,
      vertexColorPrimitives: 1,
    });
  });

  it('reports invalid references and binding conventions while leaving private art and glass local', () => {
    const result = inspectStructureMaterials(
      {
        materials: [
          {
            name: 'brick',
            extras: { molenSurface: { ref: 'matgraph:typo', slot: 'typo', uv: 'meters' } },
          },
          { name: 'unique mural', pbrMetallicRoughness: { baseColorTexture: { index: 0 } } },
          {
            name: 'glass',
            alphaMode: 'BLEND',
            doubleSided: true,
            pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 0.4] },
          },
        ],
      },
      refs,
    );
    expect(result.issues.map((issue) => issue.code)).toEqual([
      'unknown-surface',
      'invalid-slot',
      'invalid-uv-convention',
    ]);
    expect(result.definitions[1]).toMatchObject({
      sharedSurface: undefined,
      textureSlots: ['baseColor'],
    });
    expect(result.definitions[2]).toMatchObject({
      sharedSurface: undefined,
      alphaMode: 'BLEND',
      doubleSided: true,
    });
  });

  it('counts masters once and reports local repetition without treating names as shared surfaces', () => {
    const document = {
      materials: [
        { name: 'paint', extras: { molenSurface: surface } },
        { name: 'seat', alphaMode: 'BLEND' },
      ],
      meshes: [{ primitives: [{ material: 0, attributes: { TEXCOORD_0: 0 } }] }],
    };
    const local = { materials: [{ name: 'seat' }] };
    const models = [
      {
        path: 'source/places/u0/u00/a/models/source.glb',
        materials: 2,
        sharedMaterialRefs: [ref],
        materialCoverage: inspectStructureMaterials(document, refs),
      },
      {
        path: 'source/places/u0/u00/b/models/source.glb',
        materials: 1,
        sharedMaterialRefs: [],
        materialCoverage: inspectStructureMaterials(local, refs),
      },
      {
        path: 'assets/a/model.glb',
        materials: 2,
        sharedMaterialRefs: [ref],
        materialCoverage: inspectStructureMaterials(document, refs),
      },
    ];
    const entries = ['a', 'b'].map((key) => ({
      key,
      collection: 'next-1000',
      hasModel: true,
      sourcePath: `content/worldgen/source/places/u0/u00/${key}`,
    }));
    const summary = summarizeStructureMaterials(models, entries);
    expect(summary.models).toBe(2);
    expect(summary.collections).toEqual([
      {
        collection: 'next-1000',
        models: 2,
        modelsWithSharedSurfaces: 1,
        sharedDefinitions: 1,
        localDefinitions: 2,
        transparentLocalDefinitions: 1,
      },
    ]);
    expect(summary.sharedSurfaceUsage[0]).toMatchObject({ ref, models: 1, sourceKeys: ['a'] });
    expect(summary.unboundModels.map((model) => model.key)).toEqual(['b']);
    expect(summary.repeatedLocalNames).toEqual([
      { name: 'seat', models: 2, definitions: 2, alphaModes: ['BLEND', 'OPAQUE'], textured: false },
    ]);
    expect(() => summarizeStructureMaterials([], entries)).toThrow('Missing authored master');
  });

  it('does not count an unused shared definition as adoption or graph usage', () => {
    const document = {
      materials: [
        { name: 'unused paint', extras: { molenSurface: surface } },
        { name: 'visible local finish' },
      ],
      meshes: [{ primitives: [{ material: 1, attributes: { POSITION: 0 } }] }],
    };
    const models = [
      {
        path: 'source/places/u0/u00/a/models/source.glb',
        materials: 2,
        sharedMaterialRefs: [ref],
        materialCoverage: inspectStructureMaterials(document, refs),
      },
    ];
    const entries = [
      {
        key: 'a',
        collection: 'next-1000',
        hasModel: true,
        sourcePath: 'content/worldgen/source/places/u0/u00/a',
      },
    ];
    const summary = summarizeStructureMaterials(models, entries);
    expect(summary.collections[0]).toMatchObject({
      models: 1,
      modelsWithSharedSurfaces: 0,
      sharedDefinitions: 1,
      localDefinitions: 1,
    });
    expect(summary.sharedSurfaceUsage).toEqual([]);
    expect(summary.unboundModels.map((model) => model.key)).toEqual(['a']);
  });
});
