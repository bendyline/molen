import { describe, expect, it } from 'vitest';
import { generateFigureBody, resolveFigureDescriptor, rigBindModel } from '../src/kernel';
import { buildHumanHand } from '../src/kernel/body-human-extremities';
import { SkinnedMeshBuilder, skin } from '../src/kernel/skinned-mesh-builder';

describe('relaxed human hands', () => {
  for (const tier of [0, 1, 2] as const) {
    it(`cups the fingers toward the palm at tier ${tier}`, () => {
      const b = new SkinnedMeshBuilder();
      buildHumanHand(b, [0, 0, 0], [0, -1, 0], 1, skin(0), [1, 1, 1], tier, true);
      const { positions: p } = b.finalize(tier);
      const tips: number[] = [];
      for (let i = 0; i < p.length; i += 3) {
        if ((p[i + 1] as number) < -0.82) tips.push(p[i] as number);
      }
      expect(tips.length).toBeGreaterThan(5);
      expect(Math.max(...tips)).toBeLessThan(-0.07);
      expect(Math.min(...tips)).toBeGreaterThan(-0.35);
    });
  }

  it('keeps the turned hand silhouette in the rigid distant mesh', () => {
    const body = generateFigureBody(resolveFigureDescriptor({ preset: 'human.adult' }), 2);
    const bind = rigBindModel(body.rig);
    const offset = (body.rig.index['hand.l'] as number) * 7;
    const wristX = bind[offset] as number,
      wristY = bind[offset + 1] as number;
    const p = body.buffers.positions;
    const x: number[] = [],
      z: number[] = [];
    for (let i = 0; i < p.length; i += 3) {
      if ((p[i] as number) > wristX * 0.75 && (p[i + 1] as number) < wristY) {
        x.push(p[i] as number);
        z.push(p[i + 2] as number);
      }
    }
    expect(x.length).toBeGreaterThan(20);
    // A forward-angled back exposes the broad hand, rather than its thin edge, from the front.
    expect(Math.max(...x) - Math.min(...x)).toBeGreaterThan(Math.max(...z) - Math.min(...z));
  });
});
