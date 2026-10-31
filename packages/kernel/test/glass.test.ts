import type { GlassImpact, GlassSurfaceSpec } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { Transform } from '../src/component';
import {
  applyGlassCrash,
  applyGlassImpact,
  damageGlass,
  GlassState,
  initialGlassSurfaceState,
  installGlass,
} from '../src/glass';
import { createWorldFromScene } from '../src/scene';
import { applyKeyframeTo, stateHash, takeKeyframe } from '../src/snapshot';
import {
  initialVehicleState,
  installVehicles,
  stepVehicle,
  VehicleInput,
  vehicleMounts,
} from '../src/vehicles';
import { World } from '../src/world';
import { molenVehicle } from './helpers/entities';

const pane: GlassSurfaceSpec = {
  id: 'screen',
  material: 'laminated',
  center: [0, 1.2, 0.8],
  rotation: [0, 0, 0, 1],
  size: [1.4, 0.7],
  thickness: 0.005,
};
const load: GlassImpact = { impulse: [0, 0, 36], energy: 12, duration: 0.02, point: [0, 0] };
function world(spec: GlassSurfaceSpec = pane): World {
  const w = new World({ seed: 'glass', tickRate: 60 });
  installGlass(w);
  w.spawnRaw(
    { transform: { pos: [2, 0, 3], rot: [0, 0, 0, 1] }, glass: { surfaces: [spec] } },
    'car',
  );
  return w;
}

describe('glass fracture and retention', () => {
  it('ignores gentle, tangential, zero-energy and out-of-pane contacts', () => {
    const intact = initialGlassSurfaceState();
    for (const impact of [
      { ...load, impulse: [0, 0, 0.2] },
      { ...load, impulse: [200, 0, 0] },
      { ...load, energy: 0 },
      { ...load, point: [2, 0] },
    ] as GlassImpact[]) {
      expect(applyGlassImpact(pane, intact, impact).fracture).toBe('intact');
      expect(intact).toEqual(initialGlassSurfaceState());
    }
  });

  it('scales stress with impulse, contact duration, thickness squared and orientation', () => {
    const apply = (spec: GlassSurfaceSpec, impact: GlassImpact) =>
      applyGlassImpact(spec, initialGlassSurfaceState(), impact);
    const base = apply(pane, load);
    expect(base.fracture).toBe('cracked');
    expect(base.retained).toBe(true);
    expect(apply({ ...pane, thickness: 0.01 }, load).peakStress).toBeCloseTo(base.peakStress / 4);
    expect(apply(pane, { ...load, duration: 0.04 }).peakStress).toBeCloseTo(base.peakStress / 2);
    expect(apply(pane, { ...load, impulse: [0, 0, 72] }).peakStress).toBeCloseTo(
      base.peakStress * 2,
    );
    const turned: GlassSurfaceSpec = { ...pane, rotation: [0, Math.SQRT1_2, 0, Math.SQRT1_2] };
    expect(apply(turned, { ...load, impulse: [36, 0, 0] }).peakStress).toBeCloseTo(base.peakStress);
  });

  it('shatters laminated glass without opening a hole; tempered glass releases granules', () => {
    const hit = { ...load, impulse: [0, 0, 160] as [number, number, number], energy: 300 };
    const laminate = applyGlassImpact(pane, initialGlassSurfaceState(), hit);
    expect(laminate.fracture).toBe('shattered');
    expect(laminate.retained).toBe(true);
    const tempered = applyGlassImpact(
      { ...pane, material: 'tempered' },
      initialGlassSurfaceState(),
      hit,
    );
    expect(tempered.fracture).toBe('shattered');
    expect(tempered.retained).toBe(false);
    expect(
      applyGlassImpact({ ...pane, material: 'annealed' }, initialGlassSurfaceState(), load)
        .retained,
    ).toBe(false);
  });

  it('only consumes retention work above the separate force threshold, even for an intact pane', () => {
    const weakFrame = { ...pane, strength: 1e12, retentionForce: 100, retentionEnergy: 5 };
    const detached = applyGlassImpact(weakFrame, initialGlassSurfaceState(), load);
    expect(detached.fracture).toBe('intact');
    expect(detached.retained).toBe(false);
    let state = initialGlassSurfaceState();
    for (let i = 0; i < 100; i++)
      state = applyGlassImpact(pane, state, { ...load, impulse: [0, 0, 1] });
    expect(state.retentionDamage).toBe(0);
    expect(state.fracture).toBe('intact');
  });

  it('records release once, survives checkpoint continuation, and repairs by removing state', () => {
    const w = world({ ...pane, material: 'tempered' });
    const events: string[] = [];
    w.on('*', (event) => {
      if (event.type !== 'glass-impact') events.push(event.type);
    });
    const impact = {
      ...load,
      entity: 'car',
      surface: 'screen',
      impulse: [0, 0, 160] as [number, number, number],
      energy: 300,
      velocity: [0, 0, 15] as [number, number, number],
    };
    w.emit('glass-impact', impact);
    expect(events).toEqual(['glass-cracked', 'glass-shattered', 'glass-released']);
    const state = w.get('car', GlassState);
    expect(state?.surfaces.screen?.release?.position).toEqual([2, 1.2, 3.8]);
    expect(state?.surfaces.screen?.release?.velocity[2]).toBeGreaterThan(15);
    const frame = takeKeyframe(w);
    w.stepN(5);
    w.emit('glass-impact', impact);
    const hash = stateHash(w);
    expect(events).toHaveLength(3);
    applyKeyframeTo(w, frame);
    w.stepN(5);
    w.emit('glass-impact', impact);
    expect(stateHash(w)).toBe(hash);
    w.remove('car', GlassState);
    w.emit('glass-impact', impact);
    expect(events).toHaveLength(6);
  });

  it('responds to pane inertia and yaw shock, without using vehicle forward speed as a threshold', () => {
    const crash = {
      deltaVelocity: [0, 0, -20],
      deltaAngularVelocity: [0, 0, 0],
      velocity: [0, 0, 20],
      angularVelocity: [0, 0, 0],
      centerOfMass: [0, 0, 0],
    } as const;
    // Mutable tuple types are the public JSON contract.
    const w = world();
    applyGlassCrash(w, 'car', structuredClone(crash) as Parameters<typeof applyGlassCrash>[2]);
    expect(w.get('car', GlassState)?.surfaces.screen?.fracture).toBe('shattered');
    const side = world({ ...pane, rotation: [0, Math.SQRT1_2, 0, Math.SQRT1_2] });
    applyGlassCrash(side, 'car', structuredClone(crash) as Parameters<typeof applyGlassCrash>[2]);
    expect(side.get('car', GlassState)?.surfaces.screen?.fracture ?? 'intact').toBe('intact');
    applyGlassCrash(side, 'car', {
      ...structuredClone(crash),
      deltaVelocity: [0, 0, 0],
      deltaAngularVelocity: [0, 30, 0],
    } as Parameters<typeof applyGlassCrash>[2]);
    expect(side.get('car', GlassState)?.surfaces.screen?.fracture).not.toBe('intact');
  });

  it('uses the real vehicle collision path with the same fracture outcome at 30, 60 and 120 Hz', () => {
    for (const tickRate of [30, 60, 120]) {
      const w = new World({ tickRate });
      const car = molenVehicle('molen.entities.vehicle.sedan');
      installVehicles(w, { groundHeight: () => 0, canOccupy: (p) => p[2] < 0.1 });
      w.spawnRaw(
        {
          transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
          vehicle: car,
          vehicleState: { ...initialVehicleState(), speed: 22 },
          glass: { surfaces: [pane] },
          mountable: vehicleMounts(car.spec),
        },
        'car',
      );
      w.spawnRaw(
        {
          transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
          mounted: { vehicle: 'car', seat: 'driver' },
        },
        'driver',
      );
      w.set('car', VehicleInput, { throttle: 0, steering: 0, brake: false });
      w.stepN(tickRate / 10);
      const screen = w.get('car', GlassState)?.surfaces.screen;
      expect(screen?.fracture).toBe('shattered');
      expect(screen?.retained).toBe(true);
      expect(w.get('car', Transform)?.pos[2]).toBeLessThan(0.1);
    }
  });

  it('captures landing shocks, but braking at speed without a collision produces no glass load', () => {
    const car = molenVehicle('molen.entities.vehicle.sedan');
    const controls = { throttle: 0, steering: 0, brake: true };
    const flat = { groundHeight: () => 0 };
    const braked = stepVehicle(
      { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
      { ...initialVehicleState(), speed: 30 },
      controls,
      car.spec,
      1 / 30,
      flat,
    );
    expect(braked.impacts).toHaveLength(0);
    const landing = stepVehicle(
      { pos: [0, 0.1, 0], rot: [0, 0, 0, 1] },
      { ...initialVehicleState(), grounded: false, vy: -15 },
      controls,
      car.spec,
      1 / 30,
      flat,
    );
    expect(landing.impacts).toHaveLength(1);
    expect(landing.impacts[0]?.deltaVelocity[1]).toBeGreaterThan(15);
  });

  it('supports arbitrary stable pane ids without inheriting Object properties', () => {
    const w = world({ ...pane, id: 'toString' });
    damageGlass(w, { ...load, entity: 'car', surface: 'toString' });
    expect(w.get('car', GlassState)?.surfaces.toString?.fracture).toBe('cracked');
  });

  it('automatically handles contacts in a data-authored scene and rejects malformed loads', () => {
    const w = createWorldFromScene({
      format: 'molen/scene@3',
      name: 'glass',
      entities: [
        {
          id: 'pane',
          components: {
            transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
            glass: { surfaces: [pane] },
          },
        },
      ],
    });
    w.emit('glass-impact', { ...load, entity: 'pane', surface: 'screen' });
    expect(w.get('pane', GlassState)?.surfaces.screen?.fracture).toBe('cracked');
    expect(() =>
      damageGlass(w, { ...load, entity: 'pane', surface: 'screen', duration: 0 }),
    ).toThrow();
    expect(() =>
      applyGlassImpact(pane, initialGlassSurfaceState(), { ...load, energy: NaN }),
    ).toThrow();
  });
});
