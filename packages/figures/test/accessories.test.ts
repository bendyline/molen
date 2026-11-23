/**
 * Accessories: budgets with everything worn at once, each piece showing where it should (rays
 * cast at the bind pose), hats covering every hair style, hanging hair over a backpack, and
 * accessories in looks and the catalogue.
 */
import { describe, expect, it } from 'vitest';
import { generateFigureBody } from '../src/kernel/body';
import { resolveFigureDescriptor } from '../src/kernel/descriptor';
import {
  FIGURE_HAIR_STYLES,
  FIGURE_HEADWEAR_STYLES,
  type FigureDescriptor,
  type FigureFeatures,
} from '../src/kernel/types';
import {
  DEFAULT_FIGURE_LOOK_CATALOG,
  figureFromLook,
  randomFigureLook,
  setFigureLookOption,
} from '../src/look';
import { firstHit, type RayFrom } from './helpers/raycast';

/** Near, medium and distant caps for a fully styled human with every accessory. */
const CAPS = { 0: 9700, 1: 3000, 2: 1300 } as const;

const EVERYTHING: Partial<FigureFeatures> = {
  headwear: 'cap',
  eyewear: 'sunglasses',
  neckwear: 'scarf',
  backwear: 'backpack',
  earwear: 'headphones',
  wristwear: 'watch',
  bag: 'crossbody',
};

const ACCESSORIES = [
  'headwear',
  'eyewear',
  'neckwear',
  'backwear',
  'earwear',
  'wristwear',
  'bag',
] as const;
type Accessory = (typeof ACCESSORIES)[number];

/**
 * Colors are converted to linear light, so only full or empty channels keep their hue: the
 * accessory under test is pure red, other accessories yellow, and the body cyan (hair), blue
 * (skin), white (top) and magenta (bottom).
 */
function dressed(features: Partial<FigureFeatures>, focus?: Accessory): FigureDescriptor {
  const palette: Record<string, string> = {
    skin: '#0000ff',
    hair: '#00ffff',
    top: '#ffffff',
    outer: '#ffffff',
    bottom: '#ff00ff',
    shoes: '#000000',
    accent: '#000000',
  };
  for (const key of ACCESSORIES) palette[key] = key === focus ? '#ff0000' : '#ffff00';
  return {
    preset: 'human.adult',
    height: 1.75,
    features: { hair: 'crop', facialHair: 'none', ...features },
    palette,
  };
}

/** The layer a hit color names: the accessory under test, 'gear' (others), or a body layer. */
function layer(d: FigureDescriptor, rgb: string): string {
  if (rgb === 'none') return 'none';
  const [r, g, b] = rgb.split(',').map((n) => Number(n) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  if (max < 0.25) return 'dark';
  const on = (c: number): boolean => c > 0.5 * max;
  const key = `${on(r) ? 1 : 0}${on(g) ? 1 : 0}${on(b) ? 1 : 0}`;
  const focus = ACCESSORIES.find((a) => d.palette?.[a] === '#ff0000') ?? 'red';
  return (
    { '100': focus, '110': 'gear', '011': 'hair', '001': 'skin', '111': 'top', '101': 'bottom' }[
      key
    ] ?? `other(${rgb})`
  );
}

/** Layers met by rays from `from` over a grid of (u, v). */
function scan(
  d: FigureDescriptor,
  tier: 0 | 1 | 2,
  from: RayFrom,
  us: readonly number[],
  vs: readonly number[],
): string[] {
  const hits: string[] = [];
  for (const u of us) for (const v of vs) hits.push(layer(d, firstHit(d, tier, from, u, v)));
  return hits;
}
const range = (from: number, to: number, steps: number): number[] =>
  Array.from({ length: steps + 1 }, (_, i) => from + ((to - from) * i) / steps);

describe('accessory budgets', () => {
  it('keeps a figure wearing every accessory within budget, cheaper at each lower tier', () => {
    for (const top of ['hoodie', 'coat', 'jacket', 'dress'] as const)
      for (const hair of ['locs', 'braids', 'long', 'afro', 'bun'] as const)
        for (const headwear of FIGURE_HEADWEAR_STYLES)
          for (const legs of ['skirt', 'long'] as const) {
            const d = resolveFigureDescriptor({
              preset: 'human.adult',
              head: { preset: '05' },
              features: {
                ...EVERYTHING,
                headwear,
                top,
                hair,
                legs,
                footwear: 'sandal',
                hands: 'fingers',
                facialHair: 'beard',
                sleeves: 'long',
                hairTexture: 'coily',
              },
            });
            let previous = Infinity;
            for (const tier of [0, 1, 2] as const) {
              const n = generateFigureBody(d, tier).buffers.triangleCount;
              const what = `${top}/${hair}/${headwear}/${legs} tier ${tier}`;
              expect(n, what).toBeLessThanOrEqual(CAPS[tier]);
              expect(n, what).toBeLessThan(previous);
              previous = n;
            }
          }
  }, 120_000);

  it('keeps every accessory finite and skinned at every tier', () => {
    const d = resolveFigureDescriptor(dressed({ ...EVERYTHING, hair: 'long' }));
    for (const tier of [0, 1, 2] as const) {
      const { buffers } = generateFigureBody(d, tier);
      expect([...buffers.positions, ...buffers.normals].every(Number.isFinite)).toBe(true);
      expect(buffers.weights?.every((w) => w >= 0 && w <= 1) ?? true).toBe(true);
    }
  });
});

describe('accessories where they belong', { timeout: 60_000 }, () => {
  it('covers the crown of every hair style with every hat', () => {
    for (const hair of FIGURE_HAIR_STYLES)
      for (const headwear of FIGURE_HEADWEAR_STYLES)
        for (const tier of [0, 1, 2] as const) {
          const hits = scan(
            dressed({ hair, headwear }, 'headwear'),
            tier,
            'above',
            [-0.04, 0, 0.04],
            [-0.03, 0, 0.03],
          );
          expect(
            hits.every((h) => h === 'headwear'),
            `${hair}/${headwear} tier ${tier}: ${hits}`,
          ).toBe(true);
        }
  }, 120_000);

  it('keeps the hair below a hat band', () => {
    const d = dressed({ hair: 'long', headwear: 'beanie' });
    for (const tier of [0, 1] as const)
      expect(scan(d, tier, 'back', [0], range(1.45, 1.55, 4))).toContain('hair');
  });

  it('puts glasses before the eyes and headphones over the ears and crown', () => {
    for (const eyewear of ['glasses', 'sunglasses'] as const) {
      const hits = scan(
        dressed({ eyewear }, 'eyewear'),
        0,
        'front',
        range(-0.06, 0.06, 24),
        range(1.58, 1.67, 9),
      );
      expect(hits.filter((h) => h === 'eyewear').length, eyewear).toBeGreaterThan(10);
      if (eyewear === 'sunglasses')
        expect(hits.filter((h) => h === 'dark').length).toBeGreaterThan(10);
    }
    expect(
      scan(dressed({}, 'eyewear'), 0, 'front', range(-0.06, 0.06, 24), range(1.58, 1.67, 9)),
    ).not.toContain('eyewear');
    for (const headwear of [undefined, 'cap'] as const) {
      const d = dressed({ earwear: 'headphones', ...(headwear ? { headwear } : {}) }, 'earwear');
      for (const tier of [0, 1, 2] as const) {
        const sides = scan(d, tier, 'left', range(-0.04, 0.03, 7), range(1.57, 1.65, 8));
        expect(sides.filter((h) => h === 'earwear').length, `cups tier ${tier}`).toBeGreaterThan(
          10,
        );
      }
      const top = scan(d, 0, 'above', [0], range(-0.06, 0.04, 20));
      expect(top, `band ${headwear ?? 'bare'}`).toContain('earwear');
    }
  });

  it('wraps a scarf round the neck and lays its end down the chest', () => {
    for (const top of ['shirt', 'hoodie', 'jacket'] as const) {
      const d = dressed({ neckwear: 'scarf', top }, 'neckwear');
      const hits = scan(d, 0, 'front', range(-0.07, 0.07, 14), range(1.43, 1.5, 7));
      expect(hits.filter((h) => h === 'neckwear').length, top).toBeGreaterThan(30);
      expect(scan(d, 0, 'front', range(0.0, 0.06, 6), range(1.32, 1.4, 4)), top).toContain(
        'neckwear',
      );
    }
  });

  it('lays a backpack on the back, with long hair and braids falling over it', () => {
    const plain = scan(
      dressed({ backwear: 'backpack' }, 'backwear'),
      0,
      'back',
      range(-0.08, 0.08, 8),
      range(1.12, 1.3, 6),
    );
    expect(
      plain.every((h) => h === 'backwear'),
      plain.join(' '),
    ).toBe(true);
    for (const hair of ['long', 'braids'] as const)
      for (const tier of [0, 1] as const) {
        const hits = scan(
          dressed({ backwear: 'backpack', hair }, 'backwear'),
          tier,
          'back',
          range(-0.08, 0.08, 16),
          range(1.15, 1.32, 8),
        );
        expect(hits, `${hair} tier ${tier}`).toContain('hair');
        // Nothing of the torso shows through: only the pack and the hair over it.
        expect(
          // (dark: the ties of braids)
          hits.filter((h) => h !== 'backwear' && h !== 'hair' && h !== 'dark'),
          `${hair} tier ${tier}`,
        ).toEqual([]);
      }
    // The straps come over the shoulders onto the chest.
    const front = scan(
      dressed({ backwear: 'backpack' }, 'backwear'),
      0,
      'front',
      range(-0.12, 0.12, 24),
      range(1.3, 1.4, 5),
    );
    expect(front.filter((h) => h === 'backwear').length).toBeGreaterThan(4);
  });

  it('hangs a bag at the right hip, its strap across the chest and back', () => {
    for (const top of ['shirt', 'coat'] as const) {
      const d = dressed({ bag: 'crossbody', top }, 'bag');
      const hip = scan(d, 0, 'front', range(-0.24, -0.06, 18), range(0.86, 1.04, 9));
      expect(hip.filter((h) => h === 'bag').length, top).toBeGreaterThan(10);
      expect(scan(d, 0, 'front', [-0.02, 0, 0.02, 0.04], range(1.1, 1.42, 32)), top).toContain(
        'bag',
      );
      expect(scan(d, 0, 'back', [-0.02, 0, 0.02, 0.04], range(1.1, 1.42, 32)), top).toContain(
        'bag',
      );
    }
  });

  it('straps a watch to the left wrist, near and at medium detail', () => {
    const d = dressed({ wristwear: 'watch' }, 'wristwear');
    for (const tier of [0, 1] as const)
      expect(
        scan(d, tier, 'left', range(-0.05, 0.05, 20), range(0.8, 0.98, 18)),
        `tier ${tier}`,
      ).toContain('wristwear');
    expect(scan(d, 2, 'left', range(-0.05, 0.05, 20), range(0.8, 0.98, 18))).not.toContain(
      'wristwear',
    );
  });
});

describe('accessories in looks', () => {
  it('offers every slot, and wears and removes an accessory', () => {
    const slots = ['headwear', 'eyewear', 'neckwear', 'backwear', 'earwear', 'wristwear', 'bag'];
    for (const slot of slots)
      expect(
        DEFAULT_FIGURE_LOOK_CATALOG.categories.some((c) => c.id === slot),
        slot,
      ).toBe(true);
    let look = randomFigureLook('acc');
    for (const slot of slots) look = setFigureLookOption(look, slot as 'bag', null);
    expect(figureFromLook(look).features?.headwear).toBeUndefined();
    look = setFigureLookOption(look, 'headwear', 'headwear.beanie');
    look = setFigureLookOption(look, 'eyewear', 'eyewear.glasses');
    const figure = figureFromLook(look);
    expect(figure.features?.headwear).toBe('beanie');
    expect(figure.features?.eyewear).toBe('glasses');
    expect(figure.palette?.headwear).toBe(look.outfit.accessories.headwear?.colors.headwear);
    const gear = DEFAULT_FIGURE_LOOK_CATALOG.palettes.gear.map((s) => s.hex);
    expect(gear).toContain(look.outfit.accessories.eyewear?.colors.eyewear);
    look = setFigureLookOption(look, 'headwear', null);
    expect(figureFromLook(look).features?.headwear).toBeUndefined();
  });

  it('draws accessories at random about as often as each slot says', () => {
    const n = 600;
    const worn: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      const look = randomFigureLook(`acc-${i}`);
      for (const slot of Object.keys(look.outfit.accessories)) worn[slot] = (worn[slot] ?? 0) + 1;
    }
    for (const category of DEFAULT_FIGURE_LOOK_CATALOG.categories) {
      if (category.chance === undefined) continue;
      const share = (worn[category.id] ?? 0) / n;
      expect(Math.abs(share - category.chance), category.id).toBeLessThan(0.06);
    }
  });
});
