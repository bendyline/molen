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

const rig = deriveRig(resolveFigureDescriptor({ preset: 'human.adult' }));
const slugs = [
  'standard-motorcycle',
  'cruiser-motorcycle',
  'motor-scooter',
  'city-bicycle',
  'road-bicycle',
  'cargo-bicycle',
];
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
