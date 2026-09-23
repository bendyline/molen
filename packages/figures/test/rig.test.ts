import { describe, expect, it } from 'vitest';
import {
  BIPED_JOINT_NAMES,
  BIPED_SOCKET_NAMES,
  deriveRig,
  FIGURE_PRESET_IDS,
  type FigureJoint,
  figureMountable,
  mirrorName,
  QUADRUPED_JOINT_NAMES,
  QUADRUPED_SOCKET_NAMES,
  resolveFigureDescriptor,
  rigBindModel,
  socketBindPosition,
} from '../src/kernel';

describe('canonical rigs', () => {
  for (const preset of FIGURE_PRESET_IDS) {
    describe(preset, () => {
      const descriptor = resolveFigureDescriptor({ preset });
      const rig = deriveRig(descriptor);
      const bind = rigBindModel(rig);
      const names =
        rig.archetype === 'biped'
          ? [BIPED_JOINT_NAMES, BIPED_SOCKET_NAMES]
          : [QUADRUPED_JOINT_NAMES, QUADRUPED_SOCKET_NAMES];

      it('lists joints parent-first with the canonical names', () => {
        expect(rig.joints.map((j) => j.name)).toEqual(names[0]);
        rig.joints.forEach((joint, index) => {
          expect(joint.parent).toBeLessThan(index);
          expect(rig.index[joint.name]).toBe(index);
          for (const v of [...joint.bindPos, ...joint.bindRot])
            expect(Number.isFinite(v)).toBe(true);
        });
      });

      it('exposes every canonical socket', () => {
        expect(rig.sockets.map((s) => s.name)).toEqual(names[1]);
      });

      it('stands on the ground with the reference point at the descriptor height', () => {
        const feet =
          rig.archetype === 'biped'
            ? ['foot.l', 'foot.r']
            : ['foot.fl', 'foot.fr', 'foot.hl', 'foot.hr'];
        for (const foot of feet) {
          const pos = socketBindPosition(rig, foot, bind);
          expect(pos?.[1]).toBeCloseTo(0, 9);
        }
        const top = socketBindPosition(
          rig,
          rig.archetype === 'biped' ? 'head.top' : 'withers',
          bind,
        );
        expect(top?.[1]).toBeCloseTo(descriptor.height, 9);
        expect(rig.eyeHeight).toBeGreaterThan(0.5 * descriptor.height);
        // Quadrupeds carry their eyes above the withers; bipeds never above the head top.
        const eyeCap =
          rig.archetype === 'biped' ? descriptor.height + 1e-9 : 1.35 * descriptor.height;
        expect(rig.eyeHeight).toBeLessThanOrEqual(eyeCap);
      });

      it('is left/right symmetric', () => {
        for (const joint of rig.joints) {
          const mirror = mirrorName(joint.name);
          if (mirror === joint.name) {
            expect(joint.bindPos[0]).toBeCloseTo(0, 12);
            continue;
          }
          const other = rig.joints[rig.index[mirror] as number] as FigureJoint;
          expect(other.bindPos[0]).toBeCloseTo(-joint.bindPos[0], 12);
          expect(other.bindPos[1]).toBeCloseTo(joint.bindPos[1], 12);
          expect(other.bindPos[2]).toBeCloseTo(joint.bindPos[2], 12);
        }
      });
    });
  }

  it('scales to an overridden height exactly', () => {
    const rig = deriveRig(
      resolveFigureDescriptor({ preset: 'human.adult', height: 2.2, build: 0.8 }),
    );
    expect(socketBindPosition(rig, 'head.top')?.[1]).toBeCloseTo(2.2, 9);
    const child = deriveRig(
      resolveFigureDescriptor({ preset: 'human.child', proportions: { legRatio: 1.4 } }),
    );
    expect(socketBindPosition(child, 'head.top')?.[1]).toBeCloseTo(1.15, 9);
  });

  it('derives passenger seats from rideable sockets', () => {
    const horse = deriveRig(resolveFigureDescriptor({ preset: 'horse' }));
    const mountable = figureMountable(horse);
    expect(mountable.seats.map((s) => s.id)).toEqual(['saddle']);
    expect(mountable.seats[0]?.position[1]).toBeGreaterThan(horse.legLength);
    expect(mountable.exits).toHaveLength(3);
    expect(
      figureMountable(deriveRig(resolveFigureDescriptor({ preset: 'human.adult' }))).seats,
    ).toEqual([]);
  });
});
