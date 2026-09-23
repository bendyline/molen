import { expect, it } from 'vitest';
import { componentIssues } from '../src/components';
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
