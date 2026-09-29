import { describe, expect, it } from 'vitest';
import { validate } from '../src/index';

const base = {
  format: 'molen/scene@3',
  name: 'town',
  prefabs: { 'npc-car': { components: { renderable: { kind: 'primitive', ref: 'box' } } } },
};

describe('scene ambient block', () => {
  it('accepts an inline network, observer, density and templates', () => {
    const r = validate('scene', {
      ...base,
      ambient: {
        network: { format: 'molen/transport-network@1', ways: [] },
        observer: 'player',
        classes: ['car'],
        density: { car: 6 },
        templates: { car: 'npc-car' },
        radius: 120,
        despawnRadius: 160,
      },
    });
    expect(r.ok, r.ok ? '' : r.formatted).toBe(true);
  });

  it('accepts a scene-relative network path', () => {
    expect(validate('scene', { ...base, ambient: { network: 'roads/network.json' } }).ok).toBe(
      true,
    );
  });

  it('rejects unknown template prefabs and an inverted despawn radius', () => {
    const r = validate('scene', {
      ...base,
      ambient: { templates: { car: 'npc-cars' }, radius: 200, despawnRadius: 100 },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.map((i) => i.code)).toEqual(
        expect.arrayContaining(['unknown_prefab', 'invalid_ambient']),
      );
      expect(r.formatted).toContain('did you mean "npc-car"?');
    }
  });

  it('rejects an unknown class and a wrong network format', () => {
    expect(validate('scene', { ...base, ambient: { classes: ['boat'] } }).ok).toBe(false);
    expect(
      validate('scene', { ...base, ambient: { network: { format: 'molen/terrain@2' } } }).ok,
    ).toBe(false);
  });
});
