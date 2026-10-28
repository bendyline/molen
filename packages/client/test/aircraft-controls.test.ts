import { readFileSync } from 'node:fs';
import type { AircraftInputData, AircraftSpec, AircraftStateData } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  type AircraftCockpitControl,
  applyAircraftControl,
  createAircraftCockpit,
  createAircraftVisual,
} from '../src/aircraft';

const requireValue = <T>(value: T | undefined): T => {
  if (value === undefined) throw new Error('Missing cockpit test fixture');
  return value;
};
const spec = requireValue(
  Object.values(
    JSON.parse(
      readFileSync(
        new URL(
          '../../../content/entities/source/aircraft/baron-g58/entity.types.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ).types as Record<string, { components: { aircraft: { spec: AircraftSpec } } }>,
  )[0],
).components.aircraft.spec;
const input: AircraftInputData = {
  power: 0.4,
  pitch: 0,
  roll: 0,
  yaw: 0,
  engine: true,
  gear: true,
  flaps: false,
  brake: false,
};
const control = (
  action: AircraftCockpitControl['action'],
  engine?: string,
): AircraftCockpitControl => ({
  id: action,
  label: action,
  nodes: [],
  action,
  ...(engine ? { engine } : {}),
});
const state = { grounded: false, engines: {}, velocity: [0, 0, 0] } as unknown as AircraftStateData;

describe('cockpit pilot inputs', () => {
  it('retains independent mixture and governor settings when common power changes', () => {
    const left = requireValue(spec.engines?.[0]).id;
    const right = requireValue(spec.engines?.[1]).id;
    let next = applyAircraftControl(input, { control: control('mixture', left), value: 0 }, spec);
    next = applyAircraftControl(next, { control: control('propeller', right), value: 0.3 }, spec);
    next = applyAircraftControl(next, { control: control('power'), value: 0.8 }, spec);
    expect(next.engines?.[left]?.mixture).toBe(0);
    expect(next.engines?.[right]?.propeller).toBe(0.3);
    next = applyAircraftControl(next, { control: control('mixture'), value: 1 }, spec);
    expect(next.engines?.[left]?.mixture).toBeUndefined();
    expect(next.engines?.[right]?.propeller).toBe(0.3);
    expect(next.mixture).toBe(1);
  });
  it('keeps each engine independent, then synchronizes power without resetting cutoffs', () => {
    const left = requireValue(spec.engines?.[0]).id,
      right = requireValue(spec.engines?.[1]).id;
    let next = applyAircraftControl(
      input,
      { control: control('power', left), value: 0.8 },
      spec,
      state,
    );
    next = applyAircraftControl(next, { control: control('engine', right), value: 0 }, spec, state);
    expect(next.engines?.[left]?.power).toBe(0.8);
    expect(next.power).toBe(0.4);
    expect(next.engines?.[right]?.enabled).toBe(false);
    expect(input.engines).toBeUndefined();
    next = applyAircraftControl(next, { control: control('power'), value: 0.65 }, spec, state);
    expect(next.power).toBe(0.65);
    expect(next.engines?.[left]?.power).toBeUndefined();
    expect(next.engines?.[right]?.enabled).toBe(false);
  });
  it('honors grounded/fixed gear restrictions and rejects invalid engine or nonfinite input', () => {
    const gear = { control: control('gear'), value: 0 };
    expect(applyAircraftControl(input, gear, spec, { ...state, grounded: true })).toBe(input);
    expect(
      applyAircraftControl(
        input,
        gear,
        { ...spec, airplane: { ...requireValue(spec.airplane), fixedGear: true } },
        state,
      ),
    ).toBe(input);
    expect(applyAircraftControl(input, gear, spec, state).gear).toBe(false);
    expect(
      applyAircraftControl(input, { control: control('power', 'unknown'), value: 1 }, spec),
    ).toBe(input);
    expect(applyAircraftControl(input, { control: control('power'), value: NaN }, spec)).toBe(
      input,
    );
  });
});

describe('cockpit meshes', () => {
  it('wires authored switches and selectors to commands, retaining legacy stick animation', () => {
    const model = new THREE.Group();
    const bindingSpec = structuredClone(spec);
    delete bindingSpec.visual.interior;
    bindingSpec.visual.controlStick = { node: 'stick', pitchAxis: 'x', rollAxis: 'z' };
    const stick = new THREE.Group();
    stick.name = 'stick';
    model.add(stick);
    const engine = requireValue(bindingSpec.engines?.[0]).id;
    const added = [
      { action: 'engine', engine },
      { action: 'gear' },
      { action: 'flaps' },
      { action: 'brake' },
    ].map((metadata, index) => {
      const node = new THREE.Group();
      node.name = `authored-${index}`;
      node.position.y = 1;
      node.userData.aircraftControl = {
        ...metadata,
        motion: { property: 'position', axis: 'y', scale: 0.1 },
      };
      model.add(node);
      return node;
    });
    const invalid = new THREE.Group();
    invalid.name = 'unknown-engine';
    invalid.userData.aircraftControl = { action: 'engine', engine: 'missing' };
    model.add(invalid);
    const visual = createAircraftVisual(model, bindingSpec);
    const next = {
      ...input,
      pitch: 0.5,
      gear: false,
      flaps: 0.6,
      brake: true,
      engines: { [engine]: { enabled: false } },
    };
    visual.update({ ...state, gearPosition: 1, flapPosition: 0 }, next, 0);
    expect(added.map((node) => node.position.y)).toEqual([1, 1, 1.06, 1.1]);
    expect(stick.rotation.x).toBeCloseTo(0.11);
    expect(visual.cockpit.controls.some((c) => c.nodes.includes(invalid.name))).toBe(false);
    visual.dispose();
  });
  const fixture = () => {
    const model = new THREE.Group();
    const bindingSpec: AircraftSpec = structuredClone(spec);
    const left = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.15, 0.15),
      new THREE.MeshBasicMaterial(),
    );
    left.name = 'left-throttle';
    left.position.x = 0.3;
    const right = left.clone();
    right.name = 'right-throttle';
    right.position.x = -0.3;
    const yoke = left.clone();
    yoke.name = 'control-yoke';
    yoke.position.set(0, -0.4, 0);
    model.add(left, right, yoke);
    bindingSpec.visual.interior = {
      nodes: [],
      bindings: [
        ...[left, right].map((node) => ({
          node: node.name,
          source: 'power',
          property: 'rotation' as const,
          axis: 'x' as const,
          scale: 0.7,
        })),
        { node: yoke.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: 0.2 },
        { node: yoke.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.5 },
      ],
    };
    return { model, bindingSpec, left, right, yoke };
  };
  it('picks the named control, ignores glass, and cannot click through a solid panel or hidden parent', () => {
    const { model, bindingSpec, left } = fixture();
    const cockpit = createAircraftCockpit(model, bindingSpec);
    const ray = new THREE.Ray(new THREE.Vector3(0.3, 0, 2), new THREE.Vector3(0, 0, -1));
    expect(cockpit.pick(ray)?.nodes).toContain(left.name);
    const cover = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.2 }),
    );
    cover.position.z = 1;
    model.add(cover);
    expect(cockpit.pick(ray)?.nodes).toContain(left.name);
    cover.material.opacity = 1;
    expect(cockpit.pick(ray)).toBeUndefined();
    cover.visible = false;
    model.visible = false;
    expect(cockpit.pick(ray)).toBeUndefined();
  });
  it('animates independent throttles and both stick axes from the same pilot commands', () => {
    const { model, bindingSpec, left, right, yoke } = fixture();
    const visual = createAircraftVisual(model, bindingSpec);
    const throttle = requireValue(visual.cockpit.controls.find((c) => c.nodes.includes(left.name)));
    let next = applyAircraftControl(input, { control: throttle, value: 0.9 }, bindingSpec, state);
    next = applyAircraftControl(
      next,
      { control: control('stick'), value: -0.6, pitch: 0.3 },
      bindingSpec,
      state,
    );
    visual.update(state, next, 0);
    expect(left.rotation.x).toBeCloseTo(0.9 * 0.7);
    expect(right.rotation.x).toBeCloseTo(0.4 * 0.7);
    expect(yoke.rotation.x).toBeCloseTo(0.3 * 0.2);
    expect(yoke.rotation.z).toBeCloseTo(-0.6 * 0.5);
    expect(spec.visual.interior?.bindings.some((b) => b.source === 'power')).toBe(true);
    visual.dispose();
  });
});
