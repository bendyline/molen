import { expect, it } from 'vitest';
import { componentIssues, getComponent } from '../src/components';
import { vehicleInteriorSchema } from '../src/vehicle-interior';

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
