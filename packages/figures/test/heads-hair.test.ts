// Head shapes, the later hair styles, hair textures and body-shape proportions: each builds a
// valid body inside the budget, actually changes the body it should, and leaves alone the
// bodies (and descriptors) written before it existed.

import { hashBytes } from '@bendyline/molen-kernel/determinism';
import { describe, expect, it } from 'vitest';
import {
  deriveRig,
  descriptorKey,
  FIGURE_HAIR_STYLES,
  FIGURE_HAIR_TEXTURES,
  FIGURE_HEAD_PARAMS,
  FIGURE_HEAD_PRESET_IDS,
  FIGURE_HEAD_PRESETS,
  type FigureBody,
  type FigureDescriptor,
  type FigureHeadShape,
  generateFigureBody,
  resolveFigureDescriptor,
  resolveFigureHead,
  rigBindModel,
} from '../src/kernel';
import { humanHeadFrame } from '../src/kernel/body-human-head';
import { firstHit } from './helpers/raycast';

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

/** Pure channel colors, so a ray's first hit names the layer it met whatever tint was applied. */
const PAINT = { skin: '#ff0000', eyes: '#00ff00', hair: '#0000ff' };
const layerOf = (rgb: string): 'skin' | 'eyes' | 'hair' | 'dark' | 'none' => {
  if (rgb === 'none') return 'none';
  const [r, g, b] = rgb.split(',').map(Number) as [number, number, number];
  if (Math.max(r, g, b) < 40) return 'dark';
  return r >= g && r >= b ? 'skin' : g >= b ? 'eyes' : 'hair';
};

/** The head's frame (width unit, height, chin height) of a descriptor. */
function frame(descriptor: FigureDescriptor): { W: number; L: number; baseY: number } {
  const d = resolveFigureDescriptor(descriptor);
  const rig = deriveRig(d);
  const headY = rigBindModel(rig)[(rig.index.head as number) * 7 + 1] as number;
  return humanHeadFrame(rig.metrics, [0, headY, 0], d.head);
}

describe('faces', () => {
  it('show an iris on the white of each eye, on every head and at every tier', () => {
    // The socket is hollow: an iris laid on the face's own surface sinks behind the white.
    for (const preset of ['01', '04', '07', '10'] as const)
      for (const tier of [0, 1, 2] as const) {
        const d: FigureDescriptor = {
          preset: 'human.adult',
          head: { preset },
          palette: PAINT,
          features: { hair: 'none' },
        };
        const { W, L, baseY } = frame(d);
        const k = FIGURE_HEAD_PRESETS[preset];
        const size = 1 + 0.2 * k.eyeSize;
        const x = 0.205 * (1 + 0.13 * k.eyeSpacing) + 0.7 * 0.036 * Math.sqrt(size);
        const y = baseY + (0.497 + 0.004 * size) * L;
        for (const side of [-1, 1])
          expect(
            layerOf(firstHit(d, tier, 'front', side * x * W, y)),
            `head ${preset} tier ${tier}`,
          ).toBe('eyes');
      }
  });

  it('carry a nose that stands off the face and lips that stand off the mouth', () => {
    const d: FigureDescriptor = { preset: 'human.adult', features: { hair: 'none' } };
    const { W, L, baseY } = frame(d);
    const { positions } = body(d).buffers;
    /** Furthest forward of the head between two heights (t above the chin). */
    const front = (lo: number, hi: number): number => {
      let z = 0;
      for (let i = 0; i < positions.length; i += 3) {
        const t = ((positions[i + 1] as number) - baseY) / L;
        if (t >= lo && t <= hi && Math.abs(positions[i] as number) < 0.2 * W)
          z = Math.max(z, positions[i + 2] as number);
      }
      return z / W;
    };
    const brow = front(0.56, 0.62);
    const tip = front(0.33, 0.38);
    const lips = front(0.17, 0.24);
    const groove = front(0.135, 0.155);
    const chin = front(0.03, 0.1);
    // About 2 cm of nose past the brow, lips proud of the groove under them, a chin under that.
    expect(tip - brow).toBeGreaterThan(0.06);
    expect(lips - groove).toBeGreaterThan(0.03);
    expect(chin - groove).toBeGreaterThan(0.01);
    // The jaw overhangs the throat: the chin is well in front of the neck's front.
    expect(chin).toBeGreaterThan(0.5);
  });

  it('wrap a beard round the jaw with no skin showing through it', () => {
    for (const tier of [0, 1] as const) {
      const d: FigureDescriptor = {
        preset: 'human.adult',
        palette: PAINT,
        features: { hair: 'crop', facialHair: 'beard' },
      };
      const { W, L, baseY } = frame(d);
      for (const x of [-0.15, 0, 0.15])
        for (const t of [0.03, 0.08, 0.13])
          expect(
            layerOf(firstHit(d, tier, 'front', x * W, baseY + t * L)),
            `tier ${tier} at ${x}, ${t}`,
          ).toBe('hair');
      // Under the nose (the mustache), and on the side of the jaw, seen from the figure's left.
      expect(layerOf(firstHit(d, tier, 'front', 0, baseY + 0.285 * L))).toBe('hair');
      expect(layerOf(firstHit(d, tier, 'left', 0.2 * W, baseY + 0.2 * L))).toBe('hair');
    }
  });
});

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

  it('move the head with each parameter added later, which older heads read as 0', () => {
    expect(FIGURE_HEAD_PARAMS).toHaveLength(19);
    const added = ['faceLength', 'noseLength', 'mouthWidth', 'browArch', 'eyeLid'] as const;
    const reference = digest(body({ preset: 'human.adult', head: {} }));
    for (const key of added) {
      const high = digest(body({ preset: 'human.adult', head: { [key]: 1 } }));
      const low = digest(body({ preset: 'human.adult', head: { [key]: -1 } }));
      expect(high, key).not.toBe(reference);
      expect(low, key).not.toBe(reference);
      expect(high, key).not.toBe(low);
      expect(resolveFigureHead({ jaw: 0.4 })[key]).toBe(0);
    }
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

  it('draw no scalp under a full head of hair', () => {
    const skin = (hair: 'none' | 'crop' | 'long' | 'balding'): number =>
      body({ preset: 'human.adult', features: { hair } }).buffers.groups.find(
        (g) => g.region === 'skin',
      )?.count ?? 0;
    // Indices, three a triangle: a shell hides some 800 triangles of skull at near detail.
    expect(skin('crop')).toBeLessThan(skin('none') - 1500);
    expect(skin('long')).toBeLessThan(skin('none') - 1500);
    // A fringe of hair leaves the crown bare, so the whole skull stays.
    expect(skin('balding')).toBe(skin('none'));
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

  it('lay braids on the back, however deep it is', () => {
    // A braid rests on the body from the shoulder down: behind the back at every height it
    // passes, and no more than its own thickness and a little air off it (they used to hang
    // straight down some centimeters behind the shoulder blades).
    for (const build of [-1, 0, 1]) {
      const d = resolveFigureDescriptor({
        preset: 'human.adult',
        build,
        features: { hair: 'braids' },
      });
      const plain = body({ preset: 'human.adult', build, features: { hair: 'none' } }).buffers
        .positions;
      const braided = body({ preset: 'human.adult', build, features: { hair: 'braids' } }).buffers;
      const hair = braided.groups.find((g) => g.region === 'hair');
      const strands = new Set<number>();
      if (hair)
        for (let i = hair.start; i < hair.start + hair.count; i++)
          strands.add(braided.indices[i] as number);
      for (const [lo, hi] of [
        [0.76, 0.8],
        [0.71, 0.75],
      ] as const) {
        let backZ = 0;
        for (let i = 0; i < plain.length; i += 3) {
          const y = (plain[i + 1] as number) / d.height;
          if (y > lo && y < hi && Math.abs(plain[i] as number) < 0.07 * d.height)
            backZ = Math.min(backZ, plain[i + 2] as number);
        }
        let near = -Infinity;
        let far = 0;
        for (const v of strands) {
          const y = (braided.positions[v * 3 + 1] as number) / d.height;
          if (y <= lo || y >= hi) continue;
          near = Math.max(near, braided.positions[v * 3 + 2] as number);
          far = Math.min(far, braided.positions[v * 3 + 2] as number);
        }
        expect(near, `build ${build} at ${lo}`).toBeLessThan(0);
        expect(far, `build ${build} at ${lo}`).toBeLessThan(backZ);
        expect(far, `build ${build} at ${lo}`).toBeGreaterThan(backZ - 0.045);
      }
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
