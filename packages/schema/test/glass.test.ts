import { expect, it } from 'vitest';
import { componentIssues } from '../src/components';
import { glassImpactSchema, glassSchema } from '../src/glass';

const pane = {
  id: 'screen',
  material: 'laminated',
  center: [0, 1, 1],
  rotation: [0, 0, 0, 1],
  size: [1.4, 0.7],
  thickness: 0.005,
};
it('discovers glass and state as built-in components with validated metric properties', () => {
  expect(componentIssues('glass', { surfaces: [pane] })).toEqual([]);
  expect(componentIssues('glassState', { surfaces: {} })).toEqual([]);
  for (const changed of [
    { thickness: 0 },
    { strength: -1 },
    { density: Infinity },
    { rotation: [0, 0, 0, 2] },
    { size: [1, 0] },
    { material: 'safety' },
    { retentionEnergy: 0 },
  ])
    expect(glassSchema.safeParse({ surfaces: [{ ...pane, ...changed }] }).success).toBe(false);
});
it('rejects duplicate pane ids, competing node ownership and invalid contact loads', () => {
  expect(glassSchema.safeParse({ surfaces: [pane, pane] }).success).toBe(false);
  expect(
    glassSchema.safeParse({
      surfaces: [
        { ...pane, nodes: ['window'] },
        { ...pane, id: 'side', nodes: ['window'] },
      ],
    }).success,
  ).toBe(false);
  const event = {
    entity: 'car',
    surface: 'screen',
    impulse: [0, 0, 100],
    point: [0, 0],
    energy: 10,
    duration: 0.02,
  };
  expect(glassImpactSchema.safeParse(event).success).toBe(true);
  for (const changed of [{ duration: 0 }, { energy: -1 }, { impulse: [Infinity, 0, 0] }])
    expect(glassImpactSchema.safeParse({ ...event, ...changed }).success).toBe(false);
});
