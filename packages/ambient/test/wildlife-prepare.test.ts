import { expect, it } from 'vitest';
import { WildlifeRenderer } from '../src/client/wildlife';
import type { WildlifeAgent } from '../src/kernel/wildlife';
import type { WildlifeSpecies } from '../src/kernel/wildlife-types';

const deer: WildlifeSpecies = {
  id: 'test.deer',
  version: 1,
  title: 'Deer silhouette',
  body: {
    family: 'ungulate',
    height: 1,
    length: 1.5,
    width: 0.4,
    color: '#887766',
    accent: '#ccbb99',
    details: ['antlers'],
  },
  motion: 'walk',
  speed: 1.2,
  roam: 25,
  clearance: 0,
  rest: 0.35,
  margin: 0.3,
};
const agent: WildlifeAgent = {
  id: 'deer-1',
  species: deer.id,
  seed: 7,
  anchor: [10, 0],
  position: [10, 0, 0],
  target: [12, 0],
  heading: 0,
  speed: 0,
  since: 0,
  nextDecision: 1,
  decisions: 0,
  phase: 0,
};
const species = new Map([[deer.id, deer]]);

it('keeps a new animal hidden until a preparing host has built its shaders', async () => {
  let finish = (): void => {};
  const prepared = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const renderer = new WildlifeRenderer(() => prepared);
  renderer.update([agent], species, [0, 0, 0], 0);
  const animal = renderer.group.children[0];
  expect(animal?.visible).toBe(false);
  finish();
  await prepared;
  await Promise.resolve();
  expect(animal?.visible).toBe(true);
  // A host that only starts the build (returns nothing) shows the animal at once, as before.
  const eager = new WildlifeRenderer(() => {});
  eager.update([agent], species, [0, 0, 0], 0);
  expect(eager.group.children[0]?.visible).toBe(true);
});
