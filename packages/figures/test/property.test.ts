import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  deriveRig,
  evaluatePose,
  FIGURE_MODES,
  FIGURE_PRESET_IDS,
  type FigureDescriptor,
  type FigureMode,
  resolveFigureDescriptor,
  rigBindModel,
  socketBindPosition,
  strideRateFor,
} from '../src/kernel';

const ratio = fc.double({ min: 0.5, max: 1.6, noNaN: true });

const descriptorArb: fc.Arbitrary<FigureDescriptor> = fc.record(
  {
    preset: fc.constantFrom(...FIGURE_PRESET_IDS),
    height: fc.double({ min: 0.2, max: 4, noNaN: true }),
    build: fc.double({ min: -1, max: 1, noNaN: true }),
    proportions: fc.record(
      {
        legRatio: ratio,
        armRatio: ratio,
        torsoRatio: ratio,
        headScale: fc.double({ min: 0.6, max: 2, noNaN: true }),
        neckLength: ratio,
        neckPitch: fc.double({ min: -1.2, max: 1.6, noNaN: true }),
        shoulderWidth: ratio,
        hipWidth: ratio,
        bodyLength: fc.double({ min: 0.8, max: 2.5, noNaN: true }),
        tailLength: fc.double({ min: 0, max: 2, noNaN: true }),
      },
      { requiredKeys: [] },
    ),
  },
  { requiredKeys: ['preset'] },
);

describe('figure properties', () => {
  it('every in-range descriptor yields a grounded rig at its height', () => {
    fc.assert(
      fc.property(descriptorArb, (descriptor) => {
        const resolved = resolveFigureDescriptor(descriptor);
        const rig = deriveRig(resolved);
        const bind = rigBindModel(rig);
        for (const v of bind) expect(Number.isFinite(v)).toBe(true);
        const feet =
          rig.archetype === 'biped'
            ? ['foot.l', 'foot.r']
            : ['foot.fl', 'foot.fr', 'foot.hl', 'foot.hr'];
        for (const foot of feet)
          expect(Math.abs(socketBindPosition(rig, foot, bind)?.[1] ?? 1)).toBeLessThan(1e-6);
        const top = socketBindPosition(
          rig,
          rig.archetype === 'biped' ? 'head.top' : 'withers',
          bind,
        );
        expect(Math.abs((top?.[1] ?? 0) - resolved.height)).toBeLessThan(1e-6 * resolved.height);
      }),
      { numRuns: 150 },
    );
  });

  it('every pose is finite with unit rotations', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...FIGURE_PRESET_IDS),
        fc.constantFrom(...(FIGURE_MODES as readonly FigureMode[])),
        fc.double({ min: 0, max: 12, noNaN: true }),
        fc.double({ min: 0, max: 10000, noNaN: true }),
        fc.integer({ min: 0, max: 1000 }),
        (preset, mode, speed, tick, seed) => {
          const rig = deriveRig(resolveFigureDescriptor({ preset }));
          const pose = evaluatePose(
            rig,
            {
              mode,
              speed,
              strideRate: strideRateFor(speed, rig.legLength),
              phaseAt: 0.25,
              phaseAtTick: 0,
              modeAtTick: 0,
              prevMode: 'idle',
              gait: 'trot',
            },
            tick,
            { tickRate: 60, seed },
          );
          for (let j = 0; j < rig.joints.length; j++) {
            const o = j * 7;
            for (let k = 0; k < 7; k++) expect(Number.isFinite(pose.local[o + k])).toBe(true);
            const len = Math.hypot(
              pose.local[o + 3] as number,
              pose.local[o + 4] as number,
              pose.local[o + 5] as number,
              pose.local[o + 6] as number,
            );
            expect(Math.abs(len - 1)).toBeLessThan(1e-3);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
