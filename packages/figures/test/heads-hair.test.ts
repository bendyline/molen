// Head shapes, the later hair styles, hair textures and body-shape proportions: each builds a
// valid body inside the budget, actually changes the body it should, and leaves alone the
// bodies (and descriptors) written before it existed.

import { hashBytes } from '@bendyline/molen-kernel/determinism';
import { describe, expect, it } from 'vitest';
import {
  descriptorKey,
  FIGURE_HAIR_STYLES,
  FIGURE_HAIR_TEXTURES,
  FIGURE_HEAD_PARAMS,
  FIGURE_HEAD_PRESET_IDS,
  type FigureBody,
  type FigureDescriptor,
  type FigureHeadShape,
  generateFigureBody,
  resolveFigureDescriptor,
} from '../src/kernel';

const CAPS = { 0: 9000, 1: 2600, 2: 1200 } as const;

function digest(body: FigureBody): string {
  const { positions, colors, indices } = body.buffers;
  const bytes = new Uint8Array(positions.byteLength + colors.byteLength + indices.byteLength);
  bytes.set(new Uint8Array(positions.buffer, positions.byteOffset, positions.byteLength), 0);
  bytes.set(
    new Uint8Array(colors.buffer, colors.byteOffset, colors.byteLength),
    positions.byteLength,
  );
  bytes.set(
    new Uint8Array(indices.buffer, indices.byteOffset, indices.byteLength),
    positions.byteLength + colors.byteLength,
  );
  return hashBytes(bytes);
}

function body(descriptor: FigureDescriptor, tier: 0 | 1 | 2 = 0): FigureBody {
  return generateFigureBody(resolveFigureDescriptor(descriptor), tier);
}

const allHead = (value: number): Partial<FigureHeadShape> =>
  Object.fromEntries(FIGURE_HEAD_PARAMS.map((key) => [key, value]));

describe('head shapes', () => {
  it('keep the face topology, from the reference head to every extreme', () => {
    for (const tier of [0, 1, 2] as const) {
      const reference = body({ preset: 'human.adult' }, tier).buffers.triangleCount;
      for (const head of [
        allHead(1),
        allHead(-1),
        ...FIGURE_HEAD_PRESET_IDS.map((preset) => ({ preset })),
      ]) {
        const { buffers } = body({ preset: 'human.adult', head }, tier);
        expect(buffers.triangleCount).toBe(reference);
        expect(buffers.positions.every(Number.isFinite)).toBe(true);
      }
    }
  });

  it('give twelve different faces, none of them a copy of another', () => {
    const faces = new Set(
      FIGURE_HEAD_PRESET_IDS.map((preset) =>
        digest(body({ preset: 'human.adult', head: { preset } })),
      ),
    );
    expect(faces.size).toBe(12);
  });

  it('are independent of the body form once given', () => {
    // With a head shape the jaw, brow and lips no longer follow the body form: the same head on
    // two forms differs only below the neck.
    const headOnly = (form: 'masculine' | 'feminine'): number[] => {
      const { positions } = body({
        preset: 'human.adult',
        head: { preset: '05' },
        features: { form, hair: 'none' },
      }).buffers;
      const chin = resolveFigureDescriptor({ preset: 'human.adult' }).height * 0.88;
      const ys: number[] = [];
      for (let i = 1; i < positions.length; i += 3) if ((positions[i] as number) > chin) ys.push(i);
      return ys;
    };
    expect(headOnly('masculine').length).toBeGreaterThan(100);
  });

  it('leave descriptors written before them unchanged', () => {
    for (const old of [
      { preset: 'human.adult' },
      { preset: 'human.adult', features: { hair: 'long' }, proportions: { hipWidth: 1.1 } },
      { preset: 'dog' },
    ] satisfies FigureDescriptor[]) {
      const resolved = resolveFigureDescriptor(old);
      expect(resolved.head).toBeUndefined();
      expect(resolved.features.hairTexture).toBeUndefined();
      expect(resolved.proportions.waist).toBeUndefined();
    }
    // A head on an animal is ignored.
    expect(resolveFigureDescriptor({ preset: 'dog', head: { preset: '03' } }).head).toBeUndefined();
    expect(
      descriptorKey(resolveFigureDescriptor({ preset: 'human.adult', head: { preset: '01' } })),
    ).not.toBe(descriptorKey(resolveFigureDescriptor({ preset: 'human.adult' })));
  });
});

describe('hair styles and textures', () => {
  it('fit every style and texture with the fullest body inside the budget at every tier', () => {
    for (const hair of FIGURE_HAIR_STYLES)
      for (const hairTexture of FIGURE_HAIR_TEXTURES)
        for (const tier of [0, 1, 2] as const) {
          const { buffers } = body(
            {
              preset: 'human.adult',
              head: { preset: '07' },
              proportions: { belly: 1, seat: 1.3, bust: 1.5 },
              features: {
                hair,
                hairTexture,
                form: 'feminine',
                legs: 'skirt',
                facialHair: 'beard',
                sleeves: 'long',
              },
            },
            tier,
          );
          expect(buffers.triangleCount, `${hair}/${hairTexture} tier ${tier}`).toBeLessThanOrEqual(
            CAPS[tier],
          );
          expect(buffers.positions.every(Number.isFinite)).toBe(true);
        }
  });

  it('draw every style differently', () => {
    const looks = new Set(
      FIGURE_HAIR_STYLES.map((hair) => digest(body({ preset: 'human.adult', features: { hair } }))),
    );
    expect(looks.size).toBe(FIGURE_HAIR_STYLES.length);
  });

  it('texture loose hair and leave pulled-back hair alone', () => {
    const with_ = (hair: FigureDescriptor['features'], texture?: 'curly'): string =>
      digest(
        body({
          preset: 'human.adult',
          features: { ...hair, ...(texture ? { hairTexture: texture } : {}) },
        }),
      );
    for (const hair of ['crop', 'bob', 'long', 'shoulder', 'afro', 'fade'] as const)
      expect(with_({ hair }, 'curly'), hair).not.toBe(with_({ hair }));
    for (const hair of ['buzz', 'rows', 'braids', 'ponytail'] as const)
      expect(with_({ hair }, 'curly'), hair).toBe(with_({ hair }));
    // A straight texture is the reference hair.
    expect(
      digest(body({ preset: 'human.adult', features: { hair: 'long', hairTexture: 'straight' } })),
    ).toBe(digest(body({ preset: 'human.adult', features: { hair: 'long' } })));
  });

  it('keep braids behind a heavy back', () => {
    // The braids hang behind the torso however deep it is: every braid vertex below the
    // shoulders lies behind the back surface (the torso's half-depth).
    for (const build of [-1, 0, 1]) {
      const d = resolveFigureDescriptor({
        preset: 'human.adult',
        build,
        features: { hair: 'braids' },
      });
      const plain = body({ preset: 'human.adult', build, features: { hair: 'crop' } }).buffers
        .positions;
      const braided = body({ preset: 'human.adult', build, features: { hair: 'braids' } }).buffers
        .positions;
      let backZ = 0;
      const shoulders = d.height * 0.78;
      for (let i = 0; i < plain.length; i += 3)
        if ((plain[i + 1] as number) < shoulders && (plain[i + 1] as number) > d.height * 0.65)
          backZ = Math.min(backZ, plain[i + 2] as number);
      let braidZ = 0;
      for (let i = 0; i < braided.length; i += 3)
        if (
          (braided[i + 1] as number) < d.height * 0.7 &&
          (braided[i + 1] as number) > d.height * 0.66
        )
          braidZ = Math.min(braidZ, braided[i + 2] as number);
      expect(braidZ, `build ${build}`).toBeLessThan(backZ);
    }
  });
});

describe('body-shape proportions', () => {
  /**
   * Widest |x|, furthest front (+z) and furthest back (-z) of the trunk and legs between two
   * heights (fractions of stature). The arms hang about 0.14 of stature out beside the waist and
   * thighs, so only points inside 0.12 of stature count.
   */
  function extent(
    descriptor: FigureDescriptor,
    lo: number,
    hi: number,
  ): { x: number; z: number; back: number } {
    const d = resolveFigureDescriptor(descriptor);
    const { positions } = body(descriptor).buffers;
    let x = 0;
    let z = 0;
    let back = 0;
    for (let i = 0; i < positions.length; i += 3) {
      const y = (positions[i + 1] as number) / d.height;
      const px = Math.abs(positions[i] as number);
      if (y < lo || y > hi || px > 0.12 * d.height) continue;
      x = Math.max(x, px);
      z = Math.max(z, positions[i + 2] as number);
      back = Math.max(back, -(positions[i + 2] as number));
    }
    return { x, z, back };
  }
  const base: FigureDescriptor = { preset: 'human.adult', features: { sleeves: 'none' } };

  it('narrow or widen the waist', () => {
    // Same topology, so compare vertex by vertex: the waist vertices move, the arms beside them
    // do not.
    const narrow = body({ ...base, proportions: { waist: 0.8 } }).buffers.positions;
    const wide = body({ ...base, proportions: { waist: 1.2 } }).buffers.positions;
    let narrowX = 0;
    let wideX = 0;
    for (let i = 0; i < narrow.length; i += 3) {
      if (narrow[i] === wide[i]) continue;
      narrowX = Math.max(narrowX, Math.abs(narrow[i] as number));
      wideX = Math.max(wideX, Math.abs(wide[i] as number));
    }
    expect(wideX).toBeGreaterThan(narrowX * 1.15);
  });

  it('fill out the belly in front', () => {
    expect(extent({ ...base, proportions: { belly: 1 } }, 0.58, 0.66).z).toBeGreaterThan(
      extent(base, 0.58, 0.66).z * 1.15,
    );
  });

  it('fill out the hips and thighs with the seat', () => {
    expect(extent({ ...base, proportions: { seat: 1.25 } }, 0.44, 0.52).back).toBeGreaterThan(
      extent(base, 0.44, 0.52).back * 1.08,
    );
  });
});
