import { describe, expect, it } from 'vitest';
import { ModelLibrary } from '../../src/client/instanced-models';
import { LANDMARK_DEFINITIONS, LANDMARKS } from '../helpers/content';

describe('landmark model library', () => {
  it('prepares shared identity and furniture models without any network or loader', async () => {
    const library = new ModelLibrary(undefined, LANDMARK_DEFINITIONS);
    try {
      for (const ref of [
        ...Object.keys(LANDMARKS.signDesigns).map((s) => `builtin:sign.${s}`),
        'builtin:street_lamp',
        'builtin:bench',
        'builtin:bike_rack',
        'builtin:charger',
        'builtin:charger.fast',
      ]) {
        const fine = await library.prepare(ref),
          same = await library.prepare(ref),
          far = await library.prepare(ref, 'distant');
        expect(fine).toBe(same);
        expect(fine.bounds.isEmpty()).toBe(false);
        expect(far.bounds.isEmpty()).toBe(false);
        expect(fine.material).toBe(far.material);
      }
      for (const ref of ['builtin:tree.mapped.broadleaf', 'builtin:tree.mapped.needleleaf']) {
        for (const detail of [false, true, 'distant'] as const) {
          const model = await library.prepare(ref, detail);
          expect(model.bounds.min.y).toBeCloseTo(0);
          expect(model.bounds.max.y).toBeCloseTo(1);
          expect(model.bounds.max.x - model.bounds.min.x).toBeCloseTo(1);
        }
      }
    } finally {
      library.dispose();
    }
  });
});
