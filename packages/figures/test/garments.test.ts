/**
 * Garments: every top, legwear and footwear within the triangle budgets at every tier, the
 * reference garments byte-identical when named, layers that cover what they should on every
 * body shape (rays cast at the bind pose), and dresses replacing the bottom in looks.
 */
import { describe, expect, it } from 'vitest';
import { describeFigureLook } from '../src/designer/strings';
import { generateFigureBody } from '../src/kernel/body';
import { descriptorKey, resolveFigureDescriptor } from '../src/kernel/descriptor';
import {
  FIGURE_FOOTWEAR_STYLES,
  FIGURE_LEGWEAR_STYLES,
  FIGURE_TOP_STYLES,
  type FigureDescriptor,
  type FigureTopStyle,
} from '../src/kernel/types';
import {
  DEFAULT_FIGURE_LOOK_CATALOG,
  figureFromLook,
  figureLookReplaced,
  randomFigureLook,
  setFigureLookOption,
  validateFigureLookCatalog,
} from '../src/look';

/** Near, medium and distant caps for a fully styled human (garments, hair, beard, fingers). */
const CAPS = { 0: 9000, 1: 2600, 2: 1200 } as const;

describe('garment budgets', () => {
  it('keeps every top, legwear and footwear within budget with the heaviest hair', () => {
    // The heaviest styles near (locs), at medium (braids) and distant (long).
    for (const top of FIGURE_TOP_STYLES)
      for (const footwear of FIGURE_FOOTWEAR_STYLES)
        for (const legs of FIGURE_LEGWEAR_STYLES)
          for (const hair of ['locs', 'braids', 'long'] as const)
            for (const form of ['masculine', 'feminine'] as const) {
              const d = resolveFigureDescriptor({
                preset: 'human.adult',
                head: { preset: '05' },
                features: {
                  top,
                  footwear,
                  legs,
                  hair,
                  form,
                  hands: 'fingers',
                  facialHair: 'beard',
                  sleeves: 'long',
                  hairTexture: 'coily',
                },
              });
              let previous = Infinity;
              for (const tier of [0, 1, 2] as const) {
                const n = generateFigureBody(d, tier).buffers.triangleCount;
                const what = `${top}/${legs}/${footwear}/${hair}/${form} tier ${tier}`;
                expect(n, what).toBeLessThanOrEqual(CAPS[tier]);
                expect(n, what).toBeLessThan(previous);
                previous = n;
              }
            }
  }, 120_000);

  it('draws named reference shoes exactly like the default', () => {
    for (const tier of [0, 1, 2] as const) {
      const plain = generateFigureBody(resolveFigureDescriptor({ preset: 'human.adult' }), tier);
      const named = generateFigureBody(
        resolveFigureDescriptor({ preset: 'human.adult', features: { footwear: 'shoe' } }),
        tier,
      );
      expect([...named.buffers.positions]).toEqual([...plain.buffers.positions]);
      expect([...named.buffers.colors]).toEqual([...plain.buffers.colors]);
    }
  });

  it('keeps every vertex finite and skinned for every garment', () => {
    for (const top of FIGURE_TOP_STYLES)
      for (const footwear of FIGURE_FOOTWEAR_STYLES) {
        const d = resolveFigureDescriptor({ preset: 'human.adult', features: { top, footwear } });
        for (const tier of [0, 1, 2] as const) {
          const { buffers } = generateFigureBody(d, tier);
          expect([...buffers.positions, ...buffers.normals].every(Number.isFinite)).toBe(true);
          expect(buffers.weights?.every((w) => w >= 0 && w <= 1) ?? true).toBe(true);
        }
      }
  });
});

/** The color of the frontmost surface along a ray (z from the front, or from behind). */
function frontmost(
  d: FigureDescriptor,
  tier: 0 | 1 | 2,
  x: number,
  y: number,
  from: 'front' | 'back',
): string {
  const { buffers } = generateFigureBody(resolveFigureDescriptor(d), tier);
  const p = buffers.positions;
  const idx = buffers.indices;
  const sign = from === 'front' ? 1 : -1;
  let best = -Infinity;
  let hit = -1;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] as number,
      b = idx[t + 1] as number,
      c = idx[t + 2] as number;
    const ax = p[a * 3] as number,
      ay = p[a * 3 + 1] as number,
      bx = p[b * 3] as number,
      by = p[b * 3 + 1] as number,
      cx = p[c * 3] as number,
      cy = p[c * 3 + 1] as number;
    const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(det) < 1e-12) continue;
    const l1 = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / det;
    const l2 = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / det;
    const l3 = 1 - l1 - l2;
    if (l1 < 0 || l2 < 0 || l3 < 0) continue;
    const z =
      sign *
      (l1 * (p[a * 3 + 2] as number) +
        l2 * (p[b * 3 + 2] as number) +
        l3 * (p[c * 3 + 2] as number));
    if (z > best) {
      best = z;
      hit = l1 >= l2 && l1 >= l3 ? a : l2 >= l3 ? b : c;
    }
  }
  const col = buffers.colors;
  return hit < 0 ? 'none' : `${col[hit * 3]},${col[hit * 3 + 1]},${col[hit * 3 + 2]}`;
}

/** Pure channel colors, so a hit names its layer whatever tint the builder applied. */
const LAYERS = {
  skin: '#0000ff',
  top: '#ffffff',
  outer: '#00ff00',
  bottom: '#ff00ff',
  shoes: '#ff0000',
  accent: '#ffff00',
};
function layer(rgb: string): string {
  const [r, g, b] = rgb.split(',').map(Number) as [number, number, number];
  if (r > 100 && g > 100 && b > 100) return 'top';
  if (g > 100 && r < 60 && b < 60) return 'outer';
  if (r > 100 && b > 100 && g < 60) return 'bottom';
  if (b > 100 && r < 60 && g < 60) return 'skin';
  if (r > 100 && g < 60 && b < 60) return 'shoes';
  return `other(${rgb})`;
}

function shaped(body: string, top: FigureTopStyle, legs: 'long' | 'skirt'): FigureDescriptor {
  const drawn = setFigureLookOption(randomFigureLook('cover'), 'body', body);
  // No accessories: a scarf or a bag would cover the layers under test.
  const look = { ...drawn, outfit: { ...drawn.outfit, accessories: {} } };
  const f = figureFromLook(look);
  return {
    ...f,
    features: { ...f.features, top, legs, sleeves: 'long', hair: 'none', facialHair: 'none' },
    palette: { ...f.palette, ...LAYERS },
  };
}

const BODIES = (
  DEFAULT_FIGURE_LOOK_CATALOG.categories.find((c) => c.id === 'body')?.options ?? []
).map((o) => o.id);

describe('garment layers', () => {
  it('covers the waist and hips with a hem over trousers and skirts, on every body', () => {
    for (const body of BODIES)
      for (const top of ['sweater', 'jacket', 'coat'] as const)
        for (const legs of ['long', 'skirt'] as const)
          for (const tier of [0, 1] as const) {
            const d = shaped(body, top, legs);
            const r = resolveFigureDescriptor(d);
            const H = r.height;
            // From the waist (0.6 of stature) down to just above the hem.
            const lowest = top === 'sweater' ? 0.555 : top === 'jacket' ? 0.49 : 0.42;
            const want = top === 'sweater' ? 'top' : 'outer';
            for (let f = 0.6; f >= lowest; f -= 0.015)
              for (const from of ['front', 'back'] as const) {
                const got = layer(frontmost(d, tier, 0, f * H, from));
                expect(got, `${body} ${top}/${legs} tier ${tier} ${from} at ${f.toFixed(3)}H`).toBe(
                  want,
                );
              }
          }
  }, 120_000);

  it('shows no skin between the bodice and skirt of a dress, on every body', () => {
    for (const body of BODIES)
      for (const tier of [0, 1, 2] as const) {
        const d = shaped(body, 'dress', 'long');
        const H = resolveFigureDescriptor(d).height;
        for (let f = 0.66; f >= 0.42; f -= 0.02)
          for (const from of ['front', 'back'] as const)
            expect(layer(frontmost(d, tier, 0, f * H, from)), `${body} tier ${tier} ${f}`).not.toBe(
              'skin',
            );
      }
  }, 60_000);

  it('shows the shirt down the open front of a jacket, from the collar to the button', () => {
    for (const body of BODIES) {
      const d = shaped(body, 'jacket', 'long');
      const H = resolveFigureDescriptor(d).height;
      const hits = [];
      for (let f = 0.8; f >= 0.66; f -= 0.01) hits.push(layer(frontmost(d, 0, 0, f * H, 'front')));
      expect(hits.filter((h) => h === 'top').length, `${body}: ${hits.join(' ')}`).toBeGreaterThan(
        hits.length * 0.8,
      );
    }
  });

  it('raises a boot shaft over the ankle, around trousers or a bare shin', () => {
    for (const legs of ['long', 'cropped', 'shorts'] as const)
      for (const tier of [0, 1, 2] as const) {
        const d: FigureDescriptor = {
          preset: 'human.adult',
          features: { footwear: 'boot', legs },
          palette: LAYERS,
        };
        const H = resolveFigureDescriptor(d).height;
        for (const from of ['front', 'back'] as const)
          expect(layer(frontmost(d, tier, 0.1, 0.085 * H, from)), `${legs} tier ${tier}`).toBe(
            'shoes',
          );
      }
  });

  it('lets wide trousers fall over boots, which stop at the ankle under them', () => {
    for (const tier of [0, 1, 2] as const) {
      const d: FigureDescriptor = {
        preset: 'human.adult',
        features: { footwear: 'boot', legs: 'wide' },
        palette: LAYERS,
      };
      const H = resolveFigureDescriptor(d).height;
      for (const from of ['front', 'back'] as const) {
        expect(layer(frontmost(d, tier, 0.1, 0.085 * H, from)), `tier ${tier}`).toBe('bottom');
        expect(layer(frontmost(d, tier, 0.1, 0.01 * H, from)), `tier ${tier}`).toBe('shoes');
      }
    }
  });
});

describe('garments in looks', () => {
  it('validates the catalogue, including what a garment may replace', () => {
    expect(validateFigureLookCatalog(DEFAULT_FIGURE_LOOK_CATALOG)).toEqual([]);
    const broken = {
      ...DEFAULT_FIGURE_LOOK_CATALOG,
      categories: DEFAULT_FIGURE_LOOK_CATALOG.categories.map((c) =>
        c.id === 'bottom'
          ? { ...c, options: c.options.map((o) => ({ ...o, replaces: ['bottom' as const] })) }
          : c,
      ),
    };
    expect(validateFigureLookCatalog(broken).join('\n')).toContain('may replace only another');
  });

  it('leaves the bottom out under a dress and keeps it in the look', () => {
    let look = randomFigureLook('dress');
    look = setFigureLookOption(look, 'bottom', 'bottom.wide');
    const withTrousers = figureFromLook(look);
    expect(withTrousers.features?.legs).toBe('wide');

    const dressed = setFigureLookOption(look, 'top', 'top.dress');
    expect([...figureLookReplaced(dressed.outfit)]).toEqual(['bottom']);
    const figure = figureFromLook(dressed);
    expect(figure.features?.top).toBe('dress');
    expect(figure.features?.legs).not.toBe('wide');
    expect(dressed.outfit.bottom.id).toBe('bottom.wide');
    expect(describeFigureLook(dressed)).not.toContain('Wide trousers');

    const back = setFigureLookOption(dressed, 'top', 'top.tee');
    expect(figureFromLook(back).features?.legs).toBe('wide');
  });

  it('colours a jacket with its outer colour and the shirt under it', () => {
    const look = setFigureLookOption(randomFigureLook('jacket'), 'top', 'top.jacket');
    expect(Object.keys(look.outfit.top.colors)).toEqual(['outer', 'top']);
    const figure = figureFromLook(look);
    expect(figure.palette?.outer).toBe(look.outfit.top.colors.outer);
    expect(figure.palette?.top).toBe(look.outfit.top.colors.top);
  });

  it('gives each garment its own body (distinct descriptor keys)', () => {
    const keys = new Set<string>();
    for (const top of FIGURE_TOP_STYLES)
      keys.add(
        descriptorKey(resolveFigureDescriptor({ preset: 'human.adult', features: { top } })),
      );
    expect(keys.size).toBe(FIGURE_TOP_STYLES.length);
  });
});
