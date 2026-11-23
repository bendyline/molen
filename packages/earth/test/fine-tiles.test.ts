import type { TerrainPyramidTileLayerContext } from '@bendyline/molen-terrain/client';
import { describe, expect, it } from 'vitest';
import { isFineTile } from '../src/client/fine-tiles';

const at = (level: number, tileSize: number, maxLevel?: number) => ({
  address: { level, x: 0, z: 0 },
  tileSize,
  pyramid: (maxLevel !== undefined
    ? { maxLevel }
    : {}) as TerrainPyramidTileLayerContext['pyramid'],
});

describe('isFineTile', () => {
  it('takes small tiles, and a package’s finest tiles whatever their size', () => {
    expect(isFineTile(at(15, 1200, 17), 2048)).toBe(true);
    // Zoom 13 in Seattle, where the package ends at zoom 13: nothing finer will come.
    expect(isFineTile(at(13, 3300, 13), 2048)).toBe(true);
    // The same size one level up is a coarse tile under finer ones.
    expect(isFineTile(at(12, 3300, 13), 2048)).toBe(false);
    // Without a known finest level, only the size decides.
    expect(isFineTile(at(13, 3300), 2048)).toBe(false);
  });
});
