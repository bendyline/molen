import { validateByKind } from '@bendyline/molen-schema';
import { resolveMapOverride } from '@bendyline/molen-worldgen-earth/kernel';
import { describe, expect, it } from 'vitest';
import { createOverrideSamples, HOST_MODEL_REF, LANDMARK_ASSET } from './override-samples';

const NEEDLE: [number, number] = [-122.3493, 47.62051];
const loads: string[] = [];
const samples = createOverrideSamples({
  loadScene: async (name) => {
    loads.push(name);
    return { scene: {}, bounds: { min: [0, 0, 0], max: [1, 1, 1] } } as never;
  },
});

describe('override sample sets', () => {
  it('offers each set under its own key', () => {
    expect(samples.map((sample) => sample.key)).toEqual([
      'box',
      'warehouse',
      'school',
      'landmark',
      'model',
      'market',
      'park',
      'empty',
    ]);
    for (const sample of samples) expect(sample.title.length, sample.key).toBeGreaterThan(0);
  });

  it('builds a valid override that fits the extent each set declares, whichever way it faces', () => {
    for (const sample of samples)
      for (const heading of [undefined, 0.7]) {
        const override = sample.build('test', {
          center: NEEDLE,
          ...(heading !== undefined ? { heading } : {}),
        });
        // Throws, naming what is wrong, for anything the view would refuse.
        const resolved = resolveMapOverride(override);
        expect(override.area, sample.key).toEqual({
          center: NEEDLE,
          size: sample.extent,
          ...(heading !== undefined ? { heading } : {}),
        });
        // Nothing the map edit places stands outside the rectangle the set asks to have cleared.
        for (let i = 0; i < 4; i++)
          expect(resolved.bounds[i], `${sample.key} bounds ${i}`).toBeCloseTo(
            resolved.areaBounds[i] as number,
            6,
          );
        // Neither does what a view adds beside it.
        const [halfX, halfZ] = [sample.extent[0] / 2, sample.extent[1] / 2];
        for (const entity of [...(override.actors ?? []), ...(override.vehicles ?? [])]) {
          expect(Math.abs(entity.position[0]), `${sample.key}/${entity.id}`).toBeLessThan(halfX);
          expect(Math.abs(entity.position[1]), `${sample.key}/${entity.id}`).toBeLessThan(halfZ);
        }
        // As a document: everything but the scene's loader, which is a function.
        const { scene: _scene, ...data } = override;
        const checked = validateByKind('map-overrides', {
          format: 'molen/map-overrides@1',
          overrides: [data],
        });
        expect(checked.ok, `${sample.key}: ${checked.ok ? '' : checked.formatted}`).toBe(true);
      }
  });

  it('clears at least the ground it is given, and never less than its own', () => {
    for (const sample of samples) {
      const wide = sample.build('wide', { center: NEEDLE, size: [300, 5] });
      expect('size' in wide.area && wide.area.size, sample.key).toEqual([300, sample.extent[1]]);
      expect(() => resolveMapOverride(wide), sample.key).not.toThrow();
    }
  });

  it('shows each kind of content a map override can carry', () => {
    const built = new Map(
      samples.map((sample) => [sample.key, sample.build(sample.key, { center: NEEDLE })]),
    );
    expect(built.get('box')?.buildings).toHaveLength(1);
    expect(built.get('warehouse')?.buildings?.[0]?.use).toBe('warehouse');
    expect(built.get('warehouse')?.vehicles?.length).toBeGreaterThan(0);
    const school = built.get('school');
    expect(school?.buildings?.length).toBeGreaterThanOrEqual(5);
    expect(school?.buildings?.every((building) => building.use === 'school')).toBe(true);
    expect(school?.props?.some((prop) => 'kind' in prop && prop.kind === 'tree')).toBe(true);
    expect(school?.props?.some((prop) => 'kind' in prop && prop.kind === 'bench')).toBe(true);
    expect(school?.actors?.length).toBeGreaterThan(0);
    expect(school?.surface).toBe('plaza');
    // A landmark of the content packs by asset id, and the sample's own model by its ref.
    expect(built.get('landmark')?.models?.[0]?.asset).toBe(LANDMARK_ASSET);
    expect(built.get('model')?.models?.[0]?.asset).toBe(HOST_MODEL_REF);
    expect(built.get('park')?.clear).toEqual({ roads: true });
    expect(built.get('park')?.surface).toBe('grass');
    const empty = built.get('empty');
    expect(empty?.buildings ?? empty?.models ?? empty?.props ?? empty?.scene).toBeUndefined();
  });

  it('loads the market scene only when a viewer comes near', async () => {
    const market = samples.find((sample) => sample.key === 'market');
    const override = market?.build('market', { center: NEEDLE });
    expect(loads).toEqual([]);
    await override?.scene?.load(new AbortController().signal);
    expect(loads).toEqual(['market']);
  });
});
