import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Heightfield } from '../src/heightfield';
import type { TerrainPyramidTileLayerContext } from '../src/pyramid-stream';
import { createEmptyTerrainSemanticTile } from '../src/semantic-types';
import { createTerrainSurfaceObject, createTerrainSurfaceRenderer } from '../src/surface-client';
import { type TerrainSignalHead, updateTerrainSurfaceSignals } from '../src/surface-signals';

function fixture() {
  const tile = createEmptyTerrainSemanticTile();
  tile.transportation.push(
    {
      class: 'major_road',
      width: 12,
      lanes: 4,
      lines: [
        [
          [0, 0.5],
          [1, 0.5],
        ],
      ],
    },
    {
      class: 'minor_road',
      width: 8,
      lanes: 2,
      lines: [
        [
          [0.5, 0],
          [0.5, 1],
        ],
      ],
    },
  );
  const context = {
    address: { level: 3, x: 0, z: 0 },
    tileSize: 200,
    origin: [0, 0],
    pyramid: { maxLevel: 3 },
    heightfield: new Heightfield(new Float32Array(4), 2, 2, {
      origin: [0, 0],
      worldSize: [200, 200],
      height: { min: 0, max: 1 },
    }),
    signal: new AbortController().signal,
  } as TerrainPyramidTileLayerContext;
  return { tile, context };
}

function colors(object: THREE.Object3D): string[] {
  const lit = object.getObjectByName('surface:signal-lit') as THREE.InstancedMesh;
  return Array.from({ length: lit.count }, (_, i) => {
    const color = new THREE.Color();
    lit.getColorAt(i, color);
    return color.getHexString();
  });
}

describe('intersection traffic signals', () => {
  it('hangs round, shaded signal heads over incoming lanes with truck clearance', () => {
    const { tile, context } = fixture();
    const object = createTerrainSurfaceObject(tile, context, { details: { streetlights: false } });
    const heads = object.userData.trafficSignalHeads as TerrainSignalHead[];
    expect(object.userData.surfaceStats.trafficSignals).toBe(4);
    expect(heads).toHaveLength(6);
    for (const head of heads) {
      expect(head.y - 0.9).toBeGreaterThan(5.5);
      expect(Math.sin(head.yaw)).toBeCloseTo(head.direction[0]);
      expect(Math.cos(head.yaw)).toBeCloseTo(head.direction[1]);
      // Arriving traffic occupies the right side of travel, left of the outward arm direction.
      const lateral = (head.x - 100) * -head.direction[1] + (head.z - 100) * head.direction[0];
      expect(lateral).toBeLessThan(0);
      expect(Math.abs(lateral)).toBeLessThan(head.direction[0] ? 6 : 4);
    }
    const dark = object.getObjectByName('surface:signal-lenses') as THREE.InstancedMesh;
    const lit = object.getObjectByName('surface:signal-lit') as THREE.InstancedMesh;
    expect(dark.count).toBe(heads.length * 3);
    expect(lit.count).toBe(heads.length);
    expect(dark.geometry.type).toBe('CircleGeometry');
    expect(lit.material).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect((lit.material as THREE.MeshBasicMaterial).toneMapped).toBe(false);
    // Signal geometry is independently switchable and absent in historical/simple styles.
    for (const options of [{ style: '1910' as const }, { details: { trafficSignals: false } }]) {
      const hidden = createTerrainSurfaceObject(tile, context, options);
      expect(hidden.userData.trafficSignalHeads).toEqual([]);
      expect(hidden.getObjectByName('surface:signal-lit')).toBeUndefined();
    }
  });

  it('cycles opposite approaches together, clears all red, and supports deterministic seeking', () => {
    const { tile, context } = fixture();
    const object = createTerrainSurfaceObject(tile, context);
    const heads = object.userData.trafficSignalHeads as TerrainSignalHead[];
    const offset = heads[0]?.offset as number;
    for (const [time, group, color] of [
      [0, 0, '21f581'],
      [24, 0, 'ffbd18'],
      [27, -1, 'ff3425'],
      [29, 1, '21f581'],
      [53, 1, 'ffbd18'],
      [56, -1, 'ff3425'],
      [58, 0, '21f581'],
    ] as const) {
      updateTerrainSurfaceSignals(object, time - offset);
      const actual = colors(object);
      for (const [i, head] of heads.entries())
        expect(actual[i]).toBe(head.group === group ? color : 'ff3425');
    }
    updateTerrainSurfaceSignals(object, -offset);
    const lit = object.getObjectByName('surface:signal-lit') as THREE.InstancedMesh;
    const version = lit.instanceMatrix.version;
    updateTerrainSurfaceSignals(object, 1 - offset);
    expect(lit.instanceMatrix.version).toBe(version);
    updateTerrainSurfaceSignals(object, 27 - offset);
    expect(lit.instanceMatrix.version).toBeGreaterThan(version);
    updateTerrainSurfaceSignals(object, -offset);
    expect(colors(object)).toEqual(heads.map((head) => (head.group === 0 ? '21f581' : 'ff3425')));
  });

  it('retains current simulation colours across tile arrival and style rebuilds', async () => {
    const { tile, context } = fixture();
    const renderer = createTerrainSurfaceRenderer();
    renderer.updateSignals(500, () => 'amber');
    const root = renderer.createTile(tile, context);
    expect(new Set(colors(root))).toEqual(new Set(['ffbd18']));
    await renderer.setOptions({ details: { streetlights: false } });
    expect(new Set(colors(root))).toEqual(new Set(['ffbd18']));
    renderer.updateSignals(501, () => 'green');
    expect(new Set(colors(root))).toEqual(new Set(['21f581']));
    expect(() => renderer.updateSignals(Number.NaN)).toThrow(/finite/);
    renderer.dispose();
  });
});
