// Pedestrians come from the figure-look catalogue: valid figures of every age, varied in skin
// tone and hair. (The catalogue draws skin, face and hair independently of each other; its own
// tests check that statistically. The hand-written wardrobe before it gave rounded hair only to
// the two deepest tones and blond only to the lightest.)

import '@bendyline/molen-figures/client';
import { getComponent } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { DEFAULT_TEMPLATES } from '../src/kernel';

type Person = { palette?: { skin?: string; hair?: string }; features?: { hair?: string } };

function crowd(type: string, count: number): Person[] {
  return Array.from(
    { length: count },
    (_, seed) =>
      DEFAULT_TEMPLATES.pedestrian({ id: `p${seed}`, kind: 'pedestrian', type, seed: seed * 7919 })
        .figure as Person,
  );
}

describe('ambient pedestrians', () => {
  it('are valid figures of every age', () => {
    const figure = getComponent('figure');
    expect(figure).toBeDefined();
    for (const type of ['human.adult', 'human.elder', 'human.child'])
      for (const person of crowd(type, 40))
        expect(figure?.zod.safeParse(person).success, type).toBe(true);
  });

  it('vary in skin tone, hair style and hair colour', () => {
    const people = crowd('human.adult', 400);
    expect(new Set(people.map((p) => p.palette?.skin)).size).toBeGreaterThanOrEqual(8);
    expect(new Set(people.map((p) => p.features?.hair)).size).toBeGreaterThanOrEqual(10);
    expect(new Set(people.map((p) => p.palette?.hair)).size).toBeGreaterThanOrEqual(6);
  });
});
