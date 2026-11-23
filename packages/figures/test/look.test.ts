import { validateByKind } from '@bendyline/molen-schema';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  FIGURE_LOOK_FILE_EXAMPLE,
  generateFigureBody,
  resolveFigureDescriptor,
} from '../src/kernel';
import {
  DEFAULT_FIGURE_LOOK_CATALOG,
  type FigureLook,
  type FigureLookCatalog,
  type FigureLookSteer,
  figureFromLook,
  figureLookOptions,
  figureLookPool,
  normalizeFigureLook,
  randomFigureLook,
  setFigureLookColor,
  setFigureLookHeight,
  setFigureLookOption,
  validateFigureLookCatalog,
} from '../src/look';

const catalog = DEFAULT_FIGURE_LOOK_CATALOG;
const STEERS: readonly FigureLookSteer[] = ['masculine', 'feminine', 'unspecified'];
const NEUTRAL_FIELDS = ['skin', 'eyes', 'head', 'hair', 'hairTexture', 'hairColor'] as const;

function category(id: string) {
  const found = catalog.categories.find((c) => c.id === id);
  if (found === undefined) throw new Error(id);
  return found;
}

describe('the default people catalogue', () => {
  it('passes its own checks', () => {
    expect(validateFigureLookCatalog(catalog)).toEqual([]);
  });

  it('never steers skin, head, hair or eyes', () => {
    for (const id of ['head', 'hair', 'hairTexture']) expect(category(id).neutral, id).toBe(true);
    for (const c of catalog.categories)
      if (c.neutral)
        for (const option of c.options) expect(option.steer, option.id).toBeUndefined();
  });

  it('labels skin as one ungrouped ramp, light to deep', () => {
    const skin = catalog.palettes.skin;
    expect(skin).toHaveLength(10);
    expect(skin.map((s) => s.label)).toEqual(skin.map((_, i) => `Tone ${i + 1} of 10`));
    const lightness = skin.map((s) => {
      const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(s.hex.slice(i, i + 2), 16));
      return 0.2126 * (r as number) + 0.7152 * (g as number) + 0.0722 * (b as number);
    });
    for (let i = 1; i < lightness.length; i++)
      expect(lightness[i]).toBeLessThan(lightness[i - 1] as number);
    for (const swatch of skin) expect(swatch.weight).toBeUndefined();
  });

  it('catches the mistakes a host catalogue can make', () => {
    const broken: FigureLookCatalog = {
      ...catalog,
      aliases: { 'hair.short': 'hair.crop', 'hair.gone': 'hair.nowhere' },
      categories: catalog.categories.map((c) =>
        c.id === 'hair'
          ? {
              ...c,
              options: c.options.map((o, i) => (i === 0 ? { ...o, steer: { feminine: 2 } } : o)),
            }
          : c,
      ),
    };
    const problems = validateFigureLookCatalog(broken).join('\n');
    expect(problems).toMatch(/steered in a neutral category/);
    expect(problems).toMatch(/"hair.short" is still a live option id/);
    expect(problems).toMatch(/unknown option "hair.nowhere"/);
  });
});

describe('random looks', () => {
  it('are deterministic, valid and already normal', () => {
    for (let i = 0; i < 200; i++) {
      for (const steer of STEERS) {
        const look = randomFigureLook(`seed-${i}`, { steer });
        expect(randomFigureLook(`seed-${i}`, { steer })).toEqual(look);
        const normal = normalizeFigureLook(look);
        expect(normal.issues).toEqual([]);
        expect(normal.changed).toBe(false);
        expect(validateByKind('figure-look', look).ok).toBe(true);
      }
    }
  });

  it('draw neutral choices independently of the steer', () => {
    for (let i = 0; i < 300; i++) {
      const looks = STEERS.map((steer) => randomFigureLook(i, { steer }));
      for (const field of NEUTRAL_FIELDS) {
        expect(looks[1]?.person[field], field).toBe(looks[0]?.person[field]);
        expect(looks[2]?.person[field], field).toBe(looks[0]?.person[field]);
      }
    }
  });

  it('draw skin, hair style and hair colour independently of each other', () => {
    // Joint frequencies match the product of the marginals: with 12,000 draws over 10 tones and
    // 10 styles, the largest cell deviation observed was about 0.004; allow 0.012.
    const n = 12000;
    const joint = new Map<string, number>();
    const skin = new Map<string, number>();
    const hair = new Map<string, number>();
    const color = new Map<string, number>();
    const skinColor = new Map<string, number>();
    const bump = (map: Map<string, number>, key: string): void => {
      map.set(key, (map.get(key) ?? 0) + 1);
    };
    for (let i = 0; i < n; i++) {
      const { person } = randomFigureLook(`independence-${i}`);
      bump(skin, person.skin);
      bump(hair, person.hair);
      bump(color, person.hairColor);
      bump(joint, `${person.skin}|${person.hair}`);
      bump(skinColor, `${person.skin}|${person.hairColor}`);
    }
    expect(skin.size).toBe(10);
    let worst = 0;
    for (const [pair, count] of joint) {
      const [s, h] = pair.split('|') as [string, string];
      const expected = ((skin.get(s) ?? 0) / n) * ((hair.get(h) ?? 0) / n);
      worst = Math.max(worst, Math.abs(count / n - expected));
    }
    for (const [pair, count] of skinColor) {
      const [s, c] = pair.split('|') as [string, string];
      const expected = ((skin.get(s) ?? 0) / n) * ((color.get(c) ?? 0) / n);
      worst = Math.max(worst, Math.abs(count / n - expected));
    }
    expect(worst).toBeLessThan(0.012);
    // Skin tones are drawn uniformly: each near a tenth.
    for (const count of skin.values()) expect(Math.abs(count / n - 0.1)).toBeLessThan(0.015);
  });

  it('lean on suggested options under a steer without removing any', () => {
    const facial = new Set<string>();
    const bodies: Record<FigureLookSteer, Set<string>> = {
      masculine: new Set(),
      feminine: new Set(),
      unspecified: new Set(),
    };
    for (let i = 0; i < 600; i++) {
      for (const steer of STEERS) bodies[steer].add(randomFigureLook(i, { steer }).person.body);
      const feminine = randomFigureLook(i, { steer: 'feminine' });
      facial.add(feminine.person.facialHair);
      expect(randomFigureLook(i, { steer: 'masculine' }).outfit.bottom.id).not.toBe('bottom.skirt');
    }
    expect([...facial]).toEqual(['facial.none']);
    expect(bodies.unspecified.size).toBe(9);
    expect(bodies.masculine.size).toBe(6);
    expect(bodies.feminine.size).toBe(6);
    for (const steer of STEERS) {
      const listed = figureLookOptions('body', { steer }).map((e) => e.option.id);
      expect(listed.sort()).toEqual(
        category('body')
          .options.map((o) => o.id)
          .sort(),
      );
    }
    const masculine = figureLookOptions('body', { steer: 'masculine' });
    expect(masculine.findIndex((e) => !e.suggested)).toBe(6);
    expect(masculine.slice(6).every((e) => !e.suggested)).toBe(true);
  });

  it('keep the parts asked for', () => {
    const a = randomFigureLook('a');
    const b = randomFigureLook('b', { keep: { look: a, parts: ['person'] } });
    expect(b.person).toEqual(a.person);
    const c = randomFigureLook('c', { keep: { look: a, parts: ['outfit', 'skin'] } });
    expect(c.outfit).toEqual(a.outfit);
    expect(c.person.skin).toBe(a.person.skin);
  });

  it('fill a pool with every presentation', () => {
    const pool = figureLookPool('crowd', { count: 30 });
    expect(pool).toHaveLength(30);
    expect(new Set(pool.map((look) => JSON.stringify(look))).size).toBeGreaterThan(25);
  });
});

describe('normalizing looks', () => {
  const someLook = (): FigureLook => randomFigureLook('normalize');

  it('is total, valid and idempotent for any value', () => {
    fc.assert(
      fc.property(fc.anything(), (value) => {
        const once = normalizeFigureLook(value);
        expect(validateByKind('figure-look', once.look).ok).toBe(true);
        const twice = normalizeFigureLook(once.look);
        expect(twice.look).toEqual(once.look);
        expect(twice.changed).toBe(false);
      }),
      { numRuns: 300 },
    );
  });

  it('repairs damaged fields of a real look', () => {
    fc.assert(
      fc.property(
        fc.record({
          hair: fc.oneof(fc.string(), fc.constant('hair.bob')),
          skin: fc.oneof(fc.string(), fc.constant('#ABCDEF'), fc.constant('#abc')),
          height: fc.oneof(fc.double(), fc.constant(1.7)),
          top: fc.anything(),
        }),
        (damage) => {
          const look = someLook();
          const broken = {
            ...look,
            person: { ...look.person, hair: damage.hair, skin: damage.skin, height: damage.height },
            outfit: { ...look.outfit, top: damage.top },
          };
          const { look: fixed } = normalizeFigureLook(broken);
          expect(validateByKind('figure-look', fixed).ok).toBe(true);
          if (damage.hair === 'hair.bob') expect(fixed.person.hair).toBe('hair.bob');
          if (damage.skin === '#ABCDEF') expect(fixed.person.skin).toBe('#abcdef');
          if (damage.skin === '#abc') expect(fixed.person.skin).toBe('#aabbcc');
          expect(fixed.person.height).toBeGreaterThanOrEqual(1.5);
          expect(fixed.person.height).toBeLessThanOrEqual(1.95);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('spreads retired ids over the catalogue instead of one default', () => {
    const replaced = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const look = randomFigureLook(i);
      replaced.add(
        normalizeFigureLook({ ...look, person: { ...look.person, hair: 'hair.retired' } }).look
          .person.hair,
      );
    }
    expect(replaced.size).toBeGreaterThan(6);
  });

  it('follows aliases and reports a newer catalogue', () => {
    const renamed: FigureLookCatalog = {
      ...catalog,
      revision: catalog.revision + 1,
      aliases: { 'hair.crop': 'hair.short-crop' },
      categories: catalog.categories.map((c) =>
        c.id === 'hair'
          ? {
              ...c,
              options: c.options.map((o) =>
                o.id === 'hair.crop' ? { ...o, id: 'hair.short-crop' } : o,
              ),
            }
          : c,
      ),
    };
    expect(validateFigureLookCatalog(renamed)).toEqual([]);
    const look = { ...someLook(), person: { ...someLook().person, hair: 'hair.crop' } };
    const upgraded = normalizeFigureLook(look, { catalog: renamed });
    expect(upgraded.look.person.hair).toBe('hair.short-crop');
    expect(upgraded.look.catalog).toBe(`molen.people@${catalog.revision + 1}`);
    expect(upgraded.issues.map((i) => i.code)).toContain('aliased-option');

    const fromFuture = normalizeFigureLook({ ...someLook(), catalog: 'molen.people@9' });
    expect(fromFuture.issues.map((i) => i.code)).toContain('newer-catalog');
    expect(fromFuture.look.catalog).toBe('molen.people@9');
  });

  it('matches the registered format example', () => {
    const { issues, changed } = normalizeFigureLook(FIGURE_LOOK_FILE_EXAMPLE);
    expect(issues).toEqual([]);
    expect(changed).toBe(false);
  });
});

describe('figures from looks', () => {
  it('builds every option of every category at every tier within budget', () => {
    const base = randomFigureLook('budget');
    // Looks may wear accessories: the caps of a fully accessorized figure.
    const caps = { 0: 9700, 1: 3000, 2: 1300 } as const;
    for (const c of catalog.categories) {
      for (const option of c.options) {
        const look = setFigureLookOption(base, c.id, option.id);
        const resolved = resolveFigureDescriptor(figureFromLook(look));
        for (const tier of [0, 1, 2] as const) {
          const { buffers } = generateFigureBody(resolved, tier);
          expect(buffers.triangleCount, `${option.id} tier ${tier}`).toBeLessThanOrEqual(
            caps[tier],
          );
          expect(buffers.positions.every(Number.isFinite), option.id).toBe(true);
        }
      }
    }
  });

  it('carries the person and outfit into the descriptor', () => {
    let look = randomFigureLook('carry');
    look = setFigureLookOption(look, 'hair', 'hair.bun');
    look = setFigureLookOption(look, 'bottom', 'bottom.skirt');
    look = setFigureLookColor(look, 'skin', '#69442D');
    look = setFigureLookColor(look, { item: 'top', slot: 'top' }, '#112233');
    look = setFigureLookHeight(look, 3);
    const figure = figureFromLook(look);
    expect(figure.preset).toBe('human.adult');
    expect(figure.height).toBe(1.95);
    expect(figure.features?.hair).toBe('bun');
    expect(figure.features?.legs).toBe('skirt');
    expect(figure.palette?.skin).toBe('#69442d');
    expect(figure.palette?.top).toBe('#112233');
    expect(figure.palette?.hair).toBe(look.person.hairColor);
    expect(figure.seed).toBeUndefined();
  });

  it('dresses a person in another outfit without changing who they are', () => {
    const person = randomFigureLook('person');
    const uniform = randomFigureLook('uniform').outfit;
    const dressed = figureFromLook(person, { outfit: uniform });
    const own = figureFromLook(person);
    expect(dressed.palette?.skin).toBe(own.palette?.skin);
    expect(dressed.features?.hair).toBe(own.features?.hair);
    expect(dressed.build).toBe(own.build);
    expect(dressed.palette?.top).toBe(uniform.top.colors.top);
  });

  it('keeps an item colour across a change of option', () => {
    const look = setFigureLookColor(
      randomFigureLook('keep'),
      { item: 'top', slot: 'top' },
      '#445566',
    );
    const changed = setFigureLookOption(look, 'top', 'top.sleeveless');
    expect(changed.outfit.top.id).toBe('top.sleeveless');
    expect(changed.outfit.top.colors.top).toBe('#445566');
  });
});
