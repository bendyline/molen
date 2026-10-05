import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';

// Keep one shared-tile model, one ground cutout and one terrain-height placement. The other
// catalog models repeat the same load/surface/eviction assertions and have asset-build checks.
const IDS = ['N0603', 'N0682', 'N0031'];

it('places named landmarks locally, binds shared surfaces and releases them on tile eviction', async () => {
  const out = resolve('.artifacts/landmark-library-golden');
  await promisify(execFile)(
    process.execPath,
    [
      resolve('test/visual/capture-landmark-library.mjs'),
      `--ids=${IDS.join(',')}`,
      '--out-dir',
      out,
      '--force',
    ],
    { cwd: process.cwd(), timeout: 360000, maxBuffer: 4 * 1024 * 1024 },
  );
  for (const id of IDS) {
    const report = JSON.parse(
      await readFile(resolve(out, id, 'shared-capture-report.json'), 'utf8'),
    );
    expect(report.errors).toEqual([]);
    expect(report.eviction).toEqual({
      disposed: true,
      liveModelGeometries: 0,
      groundRestored: true,
    });
    expect(report.placementHash).toMatch(/^sha256:/);
    if (id === 'N0031') {
      for (const frame of report.frames) {
        const samples = frame.state.terrainSamples.filter(
          (sample: { placementId: string }) => sample.placementId === frame.state.placementId,
        );
        expect(samples.length).toBeGreaterThan(0);
        expect(samples[0].coordinate).toEqual([1.936803, 41.4749082]);
        expect(samples[0].height).toBeCloseTo(14.933, 6);
        expect(frame.state.position[1]).toBeCloseTo(0, 6);
      }
    }
    expect(
      report.frames.some((frame: { camera: { placement?: boolean } }) => frame.camera.placement),
    ).toBe(true);
    for (const frame of report.frames) {
      expect(frame.state.mode).toBe('geographic-flat-terrain');
      expect(frame.state.groundCutoutActive).toBe(id === 'N0682');
      if (id === 'N0682') {
        expect(frame.state.groundCoversCutoutProbe).toBe(false);
        expect(report.groundLifecycle).toEqual({
          applicable: true,
          hiddenRestored: true,
          visibleOpen: true,
        });
      } else expect(report.groundLifecycle).toEqual({ applicable: false, unchanged: true });
      expect(frame.state.loads).toContain(report.assetId);
      expect(frame.state.visibleStructures).toEqual([frame.state.placementId]);
      // Calahorra and the Roman bridge legitimately share the256m test tile.
      if (id === 'N0603') expect(frame.state.loads.length).toBeGreaterThan(1);
      expect(Object.keys(frame.state.surfaces).length).toBeGreaterThan(0);
    }
  }
});
