import { expect, it } from 'vitest';
import { type AircraftCollisionPart, type AircraftData, getComponent } from '../src/index';

it('validates unique collision sections, joint limits and engine ownership', () => {
  const schema = getComponent('aircraft');
  if (!schema) throw new Error('Missing aircraft schema');
  const sample = schema.meta.examples[0] as AircraftData;
  const body: AircraftCollisionPart = {
    id: 'body',
    role: 'body',
    center: [0, 1, 0],
    massFraction: 0.9,
    probes: [[0, 1, 0]],
    radius: 0.3,
    nodes: [],
  };
  const wing: AircraftCollisionPart = {
    ...body,
    id: 'wing',
    role: 'leftWing',
    massFraction: 0.1,
    breakSpeed: 12,
    nodes: ['wing'],
    engines: ['main'],
  };
  const valid = (parts: AircraftCollisionPart[]) =>
    schema.zod.safeParse({ ...sample, spec: { ...sample.spec, collisionParts: parts } }).success;
  expect(valid([body, wing])).toBe(true);
  expect(valid([wing])).toBe(false);
  expect(valid([body, wing, wing])).toBe(false);
  expect(valid([{ ...body, breakSpeed: 12 }, wing])).toBe(false);
  expect(valid([body, { ...wing, massFraction: 0.9 }])).toBe(false);
  expect(valid([body, { ...wing, radius: 0 }])).toBe(false);
  expect(valid([body, { ...wing, engines: ['absent'] }])).toBe(false);
  expect(
    valid([body, { ...wing, fragments: { nodes: ['detail'], min: [1, 0, 0], max: [0, 1, 1] } }]),
  ).toBe(false);
});
