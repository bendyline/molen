import { readFileSync } from 'node:fs';
import type { MountableData, VehicleStateData } from '@bendyline/molen-kernel/vehicles';
import type { VehicleData } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import {
  deriveRig,
  evaluatePose,
  jointTransform,
  poseModelSpace,
  resolveFigureDescriptor,
} from '../src/kernel';
import { cycleRiderPose } from '../src/kernel/riding';
import {
  DEFAULT_FIGURE_LOOK_CATALOG,
  figureFromLook,
  randomFigureLook,
  setFigureLookHeight,
  setFigureLookOption,
} from '../src/look';

const rig = deriveRig(resolveFigureDescriptor({ preset: 'human.adult' }));
const slugs = [
  'standard-motorcycle',
  'cruiser-motorcycle',
  'motor-scooter',
  'city-bicycle',
  'road-bicycle',
  'cargo-bicycle',
  'underbone-moped',
  'electric-moped',
];

type RiderComponents = { vehicle: VehicleData; mountable: MountableData };
const riderComponents = (category: string, slug: string): RiderComponents => {
  const doc = JSON.parse(
    readFileSync(
      new URL(
        `../../../content/entities/source/${category}/${slug}/entity.types.json`,
        import.meta.url,
      ),
      'utf8',
    ),
  );
  return (Object.values(doc.types)[0] as { components: RiderComponents }).components;
};

/** Seat-relative contact error of every effector, for a pose anchored at the pelvis. */
function contactErrors(
  body: ReturnType<typeof deriveRig>,
  riding: NonNullable<ReturnType<typeof cycleRiderPose>>,
  /** Free hands (a sideways rider) are measured from the hips, which move with body size. */
  freeHands = false,
): { hips: number[]; errors: Record<string, number> } {
  const pose = evaluatePose(
    body,
    { mode: 'sit', speed: 0, strideRate: 0, phaseAt: 0, phaseAtTick: 0, modeAtTick: 0 },
    100,
    { tickRate: 60, anchor: 'pelvis', riding },
  );
  const model = poseModelSpace(pose);
  const errors: Record<string, number> = {};
  const hips = [...jointTransform(model, body.index.hips as number).pos];
  for (const name of ['hand.l', 'hand.r', 'foot.l', 'foot.r'] as const) {
    const actual = jointTransform(model, body.index[name] as number).pos;
    const goal = riding.ik[name];
    if (!goal) throw new Error(`Missing rider target ${name}`);
    const from = freeHands && name.startsWith('hand') ? hips : [0, 0, 0];
    errors[name] = Math.hypot(
      ...actual.map((v, axis) => v - (from[axis] as number) - (goal[axis] as number)),
    );
  }
  return { hips, errors };
}
describe('standing, sideways and handlebar riders', () => {
  // The seat of a standing or sideways rider is an adult's hip position; shorter and taller
  // bodies keep their hands and feet on the deck and bars while their hips move.
  const bodies = [1.55, 1.7, 1.9].map((height) =>
    deriveRig(resolveFigureDescriptor({ preset: 'human.adult', height })),
  );
  it.each([
    ['kick-scooter', 'standing'],
    ['skateboard', 'sideways'],
    ['electric-skateboard', 'sideways'],
    // On snow: boots in the ski bindings with a hand on each pole, and across a snowboard.
    ['skis', 'standing'],
    ['snowboard', 'sideways'],
  ])('%s reaches its deck and grips for every body size', (slug, stance) => {
    const components = riderComponents('cycles', slug);
    expect(components.vehicle.spec.cycle?.stance).toBe(stance);
    const states: VehicleStateData[] = [
      { steer: 0 } as VehicleStateData,
      { steer: components.vehicle.spec.maxSteer } as VehicleStateData,
    ];
    if (components.vehicle.spec.cycle?.kick)
      for (let i = 0; i < 6; i++)
        states.push({ steer: 0, kick: 1, pedalAngle: (i * Math.PI) / 3 } as VehicleStateData);
    for (const body of bodies)
      for (const state of states) {
        const riding = cycleRiderPose(components.vehicle, state, components.mountable.seats[0]);
        if (!riding) throw new Error(`No rider pose for ${slug}`);
        expect(riding.stance).toBe(stance);
        const { hips, errors } = contactErrors(body, riding, stance === 'sideways');
        expect(hips[0]).toBeCloseTo(0, 6);
        expect(hips[2]).toBeCloseTo(0, 6);
        for (const [name, error] of Object.entries(errors))
          expect(error, `${slug} ${body.height} ${name} ${JSON.stringify(state)}`).toBeLessThan(
            0.07,
          );
      }
  });

  it("puts a pushing skateboarder's rear foot on the ground beside the board", () => {
    const components = riderComponents('cycles', 'skateboard');
    const seat = components.mountable.seats[0];
    if (!seat) throw new Error('No seat');
    const riding = cycleRiderPose(
      components.vehicle,
      { steer: 0, kick: 1, pedalAngle: 1 } as VehicleStateData,
      seat,
    );
    const foot = riding?.ik['foot.r'];
    if (!foot) throw new Error('No push foot');
    // Seat-relative: down at shoe height, out past the board's toe-side edge.
    expect(foot[1] + seat.position[1]).toBeLessThan(0.12);
    expect(foot[0] + seat.position[0]).toBeLessThan(-0.15);
    expect(riding?.push).toBe(1);
  });

  it('drives an auto-rickshaw from the saddle with hands on its bars, passengers seated', () => {
    const components = riderComponents('vehicles', 'auto-rickshaw');
    expect(components.vehicle.spec.cycle).toBeUndefined();
    expect(components.vehicle.spec.handlebar).toBeDefined();
    const [driver, passenger] = components.mountable.seats;
    for (const steer of [-components.vehicle.spec.maxSteer, 0, components.vehicle.spec.maxSteer]) {
      const riding = cycleRiderPose(components.vehicle, { steer } as VehicleStateData, driver);
      if (!riding) throw new Error('No driver pose');
      expect(riding.stance).toBeUndefined();
      const { hips, errors } = contactErrors(rig, riding);
      expect(hips).toEqual([0, 0, 0]);
      for (const [name, error] of Object.entries(errors))
        expect(error, `${name} steer ${steer}`).toBeLessThan(0.07);
    }
    expect(cycleRiderPose(components.vehicle, undefined, passenger)).toBeUndefined();
  });

  it('drives a snowmobile from its seat with hands on the bars and boots on the boards', () => {
    const components = riderComponents('vehicles', 'snowmobile');
    expect(components.vehicle.spec.cycle).toBeUndefined();
    expect(components.vehicle.spec.runners).toBeDefined();
    const [driver, passenger] = components.mountable.seats;
    for (const steer of [-components.vehicle.spec.maxSteer, 0, components.vehicle.spec.maxSteer]) {
      const riding = cycleRiderPose(components.vehicle, { steer } as VehicleStateData, driver);
      if (!riding) throw new Error('No driver pose');
      expect(riding.stance).toBeUndefined();
      const { hips, errors } = contactErrors(rig, riding);
      expect(hips).toEqual([0, 0, 0]);
      for (const [name, error] of Object.entries(errors))
        expect(error, `${name} steer ${steer}`).toBeLessThan(0.07);
    }
    expect(passenger?.role).toBe('passenger');
    expect(cycleRiderPose(components.vehicle, undefined, passenger)).toBeUndefined();
  });
});

describe('seated riders of every body', () => {
  // Every body shape the figure-look catalogue offers, at its shortest, middle and tallest
  // heights: a rider with short legs slides forward and down the saddle to reach the pedals, by
  // one amount through the whole revolution.
  const shapes = DEFAULT_FIGURE_LOOK_CATALOG.categories.find((c) => c.id === 'body')?.options ?? [];
  const riders = (height: number) =>
    shapes.map((option) => ({
      name: `${option.id} ${height} m`,
      rig: deriveRig(
        resolveFigureDescriptor(
          figureFromLook(
            setFigureLookHeight(
              setFigureLookOption(randomFigureLook('r'), 'body', option.id),
              height,
            ),
          ),
        ),
      ),
    }));
  const pose = (body: ReturnType<typeof deriveRig>, riding: ReturnType<typeof cycleRiderPose>) =>
    poseModelSpace(
      evaluatePose(
        body,
        { mode: 'sit', speed: 0, strideRate: 0, phaseAt: 0, phaseAtTick: 0, modeAtTick: 0 },
        100,
        { tickRate: 60, anchor: 'pelvis', riding },
      ),
    );

  it.each(slugs)('%s keeps every rider still on the saddle through a revolution', (slug) => {
    const components = riderComponents('cycles', slug);
    for (const { name, rig: body } of [...riders(1.5), ...riders(1.95)]) {
      let first: number[] | undefined;
      for (let i = 0; i < 8; i++) {
        const riding = cycleRiderPose(
          components.vehicle,
          { pedalAngle: (i * Math.PI) / 4, steer: 0 } as VehicleStateData,
          components.mountable.seats[0],
        );
        const hips = [...jointTransform(pose(body, riding), body.index.hips as number).pos];
        first ??= hips;
        for (const [axis, v] of hips.entries())
          expect(v, `${slug} ${name} crank ${i}`).toBeCloseTo(first[axis] as number, 6);
      }
    }
  });

  it.each(slugs)('%s puts the feet of every body from 1.6 m on the pedals', (slug) => {
    const components = riderComponents('cycles', slug);
    for (const { name, rig: body } of [...riders(1.6), ...riders(1.75), ...riders(1.95)])
      for (let i = 0; i < 8; i++) {
        const riding = cycleRiderPose(
          components.vehicle,
          { pedalAngle: (i * Math.PI) / 4, steer: 0 } as VehicleStateData,
          components.mountable.seats[0],
        );
        if (!riding) throw new Error(`No rider pose for ${slug}`);
        const model = pose(body, riding);
        for (const effector of ['foot.l', 'foot.r'] as const) {
          const actual = jointTransform(model, body.index[effector] as number).pos;
          const goal = riding.ik[effector] as number[];
          // Observed at most 0.07 (a 1.6 m rider at a road bicycle's lowest pedal); allow 0.08.
          expect(
            Math.hypot(...actual.map((v, axis) => v - (goal[axis] as number))),
            `${slug} ${name} ${effector} crank ${i}`,
          ).toBeLessThan(0.08);
        }
      }
  });

  it('leaves an average adult where the saddle puts them', () => {
    for (const slug of slugs) {
      const components = riderComponents('cycles', slug);
      const riding = cycleRiderPose(
        components.vehicle,
        { steer: 0 } as VehicleStateData,
        components.mountable.seats[0],
      );
      const hips = jointTransform(pose(rig, riding), rig.index.hips as number).pos;
      expect(Math.hypot(...hips), slug).toBeLessThan(0.01);
    }
  });
});

describe('cycle rider contact points', () => {
  it.each(
    slugs,
  )('%s anchors the pelvis and reaches grips and pedals throughout a revolution', (slug) => {
    const doc = JSON.parse(
      readFileSync(
        new URL(
          `../../../content/entities/source/cycles/${slug}/entity.types.json`,
          import.meta.url,
        ),
        'utf8',
      ),
    );
    // Source documents own every posture; the pose evaluator has no model-specific branches.
    const components = (
      Object.values(doc.types)[0] as {
        components: { vehicle: VehicleData; mountable: MountableData };
      }
    ).components;
    for (const steer of [-components.vehicle.spec.maxSteer, 0, components.vehicle.spec.maxSteer]) {
      for (let i = 0; i < 8; i++) {
        const riding = cycleRiderPose(
          components.vehicle,
          { pedalAngle: (i * Math.PI) / 4, steer } as VehicleStateData,
          components.mountable.seats[0],
        );
        expect(riding).toBeDefined();
        const pose = evaluatePose(
          rig,
          { mode: 'sit', speed: 0, strideRate: 0, phaseAt: 0, phaseAtTick: 0, modeAtTick: 0 },
          100,
          { tickRate: 60, anchor: 'pelvis', riding },
        );
        const model = poseModelSpace(pose);
        expect(jointTransform(model, rig.index.hips as number).pos).toEqual([0, 0, 0]);
        for (const name of ['hand.l', 'hand.r', 'foot.l', 'foot.r'] as const) {
          const actual = jointTransform(model, rig.index[name] as number).pos;
          const goal = riding?.ik[name];
          if (!goal) throw new Error(`Missing rider target ${name}`);
          expect(
            Math.hypot(...actual.map((v, axis) => v - (goal[axis] as number))),
            `${slug} ${name} steer ${steer} crank ${i}`,
          ).toBeLessThan(0.07);
        }
      }
    }
  });
});
