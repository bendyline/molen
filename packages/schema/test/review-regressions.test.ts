import { describe, expect, it } from 'vitest';
import { componentIssues, createComponentRegistry, getComponent, validate } from '../src/index';

const base = { format: 'molen/scene@3', name: 'review' };
describe('review F05/F06: pure contextual validation', () => {
  it('cannot override built-in schemas, including from an invalid document', () => {
    const before = getComponent('transform');
    const invalid = validate('scene', {
      ...base,
      components: { transform: { description: 'override', examples: [{}] } },
      entities: [{ id: 'a', components: { transform: { pos: 'bad' } } }],
    });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.issues.some((i) => i.code === 'reserved_component')).toBe(true);
    expect(getComponent('transform')).toBe(before);
    expect(
      validate('scene', { ...base, entities: [{ components: { transform: { pos: 'bad' } } }] }).ok,
    ).toBe(false);
  });
  it('keeps the same custom name independent across concurrent project contexts', async () => {
    const make = (type: string) =>
      createComponentRegistry(
        {
          scoreValue: {
            description: 'score',
            examples: [{}],
            schema: { type: 'object', properties: { value: { type } }, required: ['value'] },
          },
        },
        { owner: 'project' },
      ).registry;
    const number = make('number');
    const string = make('string');
    const results = await Promise.all(
      [number, string].map(async (registry) =>
        validate(
          'scene',
          { ...base, entities: [{ components: { scoreValue: { value: 5 } } }] },
          { registry },
        ),
      ),
    );
    expect(results.map((r) => r.ok)).toEqual([true, false]);
    expect(getComponent('scoreValue')).toBeUndefined();
    expect(componentIssues('scoreValue', { value: 'five' }, '', { registry: string })).toEqual([]);
  });
  it('validates overrides after prefab inheritance, and type overrides when context is supplied', () => {
    const prefab = {
      ...base,
      prefabs: {
        base: { components: { transform: { pos: [0, 0, 0] } } },
        child: { extends: 'base', components: { transform: { rot: [0, 0, 0, 1] } } },
      },
      entities: [{ prefab: 'child', components: { transform: { pos: 'bad' } } }],
    };
    const result = validate('scene', prefab);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.issues.some((i) => i.path === '/entities/0/components/transform/pos')).toBe(
        true,
      );
    const type = validate(
      'scene',
      { ...base, entities: [{ type: 'demo.hero', components: { health: { hp: 'bad' } } }] },
      {
        types: new Map([['demo.hero', { components: { health: { hp: 1 } }, scripts: [] }]]),
      },
    );
    expect(type.ok).toBe(false);
  });
});
