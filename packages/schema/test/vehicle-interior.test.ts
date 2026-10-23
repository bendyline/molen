import { expect, it } from 'vitest';
import { componentIssues, getComponent } from '../src/components';
import { vehicleInteriorSchema } from '../src/vehicle-interior';

it('validates formula dependencies, arities, collisions and cyclic graphs in all adapters', () => {
  const binding = { node: 'dial', source: 'knots', property: 'rotation', axis: 'z', scale: 1 };
  const data = {
    sources: { speed: { component: 'aircraftState', path: ['airspeed'] } },
    derived: { knots: { op: 'multiply', args: ['speed', 3600 / 1852] } },
    bindings: [binding],
  };
  expect(componentIssues('model.signals', data)).toEqual([]);
  expect(componentIssues('model.signals', { ...data, sources: {} })).not.toEqual([]);
  expect(vehicleInteriorSchema.safeParse({ nodes: ['panel'], ...data, sources: {} }).success).toBe(
    true,
  );
  for (const derived of [
    { knots: { op: 'divide', args: ['speed'] } },
    { knots: { op: 'eval', args: ['speed'] } },
    { knots: { op: 'add', args: ['knots', 1] } },
    { knots: { op: 'add', args: ['other', 1] }, other: { op: 'add', args: ['knots', 1] } },
    { knots: { op: 'multiply', args: ['speed', 2] }, speed: { op: 'abs', args: [1] } },
  ]) {
    expect(componentIssues('model.signals', { ...data, derived })).not.toEqual([]);
    expect(vehicleInteriorSchema.safeParse({ nodes: ['panel'], ...data, derived }).success).toBe(
      false,
    );
  }
  const tooMany = Object.fromEntries(
    Array.from({ length: 257 }, (_, i) => [`x${i}`, { op: 'abs', args: [1] }]),
  );
  expect(
    vehicleInteriorSchema.safeParse({ nodes: ['panel'], bindings: [], derived: tooMany }).success,
  ).toBe(false);
});

it('checks visibility ownership, response times and cyclic limits', () => {
  const parse = (bindings: object[]) =>
    vehicleInteriorSchema.safeParse({ nodes: ['panel'], bindings }).success;
  const rotation = { node: 'dial', source: 'speed', property: 'rotation', axis: 'z', scale: 1 };
  const visible = { node: 'lamp', source: 'on', property: 'visible', scale: 1, missing: 'rest' };
  expect(parse([rotation, visible])).toBe(true);
  expect(parse([visible, visible])).toBe(false);
  expect(parse([{ ...visible, axis: 'x' }])).toBe(false);
  expect(parse([{ ...visible, responseSeconds: 1 }])).toBe(false);
  expect(parse([{ ...rotation, axis: undefined }])).toBe(false);
  expect(parse([{ ...rotation, responseSeconds: -1 }])).toBe(false);
  expect(parse([{ ...rotation, period: 2 * Math.PI, responseSeconds: 0.2 }])).toBe(true);
  expect(parse([{ ...rotation, period: 0 }])).toBe(false);
  expect(parse([{ ...rotation, period: 2 * Math.PI, min: 0 }])).toBe(false);
});

it('rejects contradictory instrument ranges and competing transform bindings', () => {
  const binding = { node: 'dial', source: 'speed', property: 'rotation', axis: 'z', scale: 1 };
  expect(vehicleInteriorSchema.safeParse({ nodes: ['cabin'], bindings: [binding] }).success).toBe(
    true,
  );
  expect(
    vehicleInteriorSchema.safeParse({
      nodes: ['cabin'],
      bindings: [{ ...binding, min: 2, max: 1 }],
    }).success,
  ).toBe(false);
  expect(
    vehicleInteriorSchema.safeParse({
      nodes: ['cabin'],
      bindings: [binding, { ...binding, source: 'rpm' }],
    }).success,
  ).toBe(false);
});

it('validates generic model signals and rejects undeclared sources and invalid paths', () => {
  const data = {
    sources: { rpm: { component: 'avionics', path: ['engines', 1, 'rpm'] } },
    bindings: [{ node: 'tach', source: 'rpm', property: 'rotation', axis: 'z', scale: 1 }],
  };
  expect(componentIssues('model.signals', data)).toEqual([]);
  expect(componentIssues('model.signals', { ...data, sources: {} }).length).toBeGreaterThan(0);
  expect(
    componentIssues('model.signals', {
      ...data,
      sources: { rpm: { component: 'avionics', path: [-1] } },
    }).length,
  ).toBeGreaterThan(0);
});

it('accepts keyframed bindings and rejects ambiguous or unordered curves', () => {
  const keyed = {
    node: 'door',
    source: 'gear',
    property: 'rotation',
    axis: 'x',
    keys: [
      [0, 0],
      [0.12, 1.5],
      [0.88, 1.5],
      [1, 0],
    ],
    ease: 'smooth',
  };
  const parses = (binding: object) =>
    vehicleInteriorSchema.safeParse({ nodes: ['cabin'], bindings: [binding] }).success;
  expect(parses(keyed)).toBe(true);
  // Exactly one calibration: a curve or a scale, never both or neither.
  expect(parses({ ...keyed, scale: 1 })).toBe(false);
  const { keys: _keys, ease: _ease, ...bare } = keyed;
  expect(parses(bare)).toBe(false);
  // Signals strictly ascending, at least two keys; offset and ease belong to one calibration.
  expect(
    parses({
      ...keyed,
      keys: [
        [0, 0],
        [0, 1],
      ],
    }),
  ).toBe(false);
  expect(parses({ ...keyed, keys: [[0, 0]] })).toBe(false);
  expect(parses({ ...keyed, offset: 0.1 })).toBe(false);
  expect(parses({ ...bare, scale: 1, ease: 'smooth' })).toBe(false);
});

it("keeps a vehicle's exterior animation off the channels its interior binds", () => {
  const example = getComponent('vehicle')?.meta.examples?.[0] as {
    visual: Record<string, unknown>;
  };
  const dial = { node: 'dial', source: 'speed', property: 'rotation', axis: 'z', scale: 1 };
  const withVisual = (visual: object) => ({ ...example, visual: { ...example.visual, ...visual } });
  const interior = { nodes: ['cabin'], bindings: [dial] };
  expect(componentIssues('vehicle', withVisual({ interior, animation: { bindings: [] } }))).toEqual(
    [],
  );
  expect(
    componentIssues(
      'vehicle',
      withVisual({ interior, animation: { bindings: [{ ...dial, node: 'door' }] } }),
    ),
  ).toEqual([]);
  expect(
    componentIssues('vehicle', withVisual({ interior, animation: { bindings: [dial] } })).length,
  ).toBeGreaterThan(0);
});
