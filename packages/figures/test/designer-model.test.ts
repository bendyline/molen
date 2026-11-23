import { describe, expect, it } from 'vitest';
import {
  createFigureDesignerModel,
  describeFigureLook,
  FIGURE_DESIGNER_STRINGS_EN,
  figureDesignerStringKeys,
  figureDesignerText,
  formatFigureHeight,
} from '../src/designer';
import { randomFigureLook } from '../src/look';

let seeds = 0;
const nextSeed = (): string => `test-${seeds++}`;

describe('the designer model', () => {
  it('records one undo step per committed edit and redoes it', () => {
    const changes: string[] = [];
    const model = createFigureDesignerModel({ look: randomFigureLook('m'), randomSeed: nextSeed });
    model.subscribe((_, change) => changes.push(`${change.source}:${change.committed}`));
    const start = model.look;
    const hair = start.person.hair === 'hair.bun' ? 'hair.crop' : 'hair.bun';
    const bottom = start.outfit.bottom.id === 'bottom.skirt' ? 'bottom.shorts' : 'bottom.skirt';
    model.choose('hair', hair);
    model.choose('bottom', bottom);
    expect(model.look.person.hair).toBe(hair);
    expect(model.figure.features?.legs).toBe(bottom === 'bottom.skirt' ? 'skirt' : 'shorts');
    expect(model.canUndo).toBe(true);
    model.undo();
    expect(model.look.outfit.bottom.id).toBe(start.outfit.bottom.id);
    model.undo();
    expect(model.look).toEqual(start);
    expect(model.canUndo).toBe(false);
    model.redo();
    expect(model.look.person.hair).toBe(hair);
    expect(changes).toEqual(['hair:true', 'bottom:true', 'undo:true', 'undo:true', 'redo:true']);
  });

  it('turns a drag into one step from where it began', () => {
    const model = createFigureDesignerModel({ look: randomFigureLook('drag') });
    const start = model.look.person.height;
    const committed: boolean[] = [];
    model.subscribe((_, change) => committed.push(change.committed));
    for (const h of [1.6, 1.62, 1.64]) model.setHeight(h, { commit: false });
    model.setHeight(1.64);
    expect(committed).toEqual([false, false, false, true]);
    expect(model.look.person.height).toBe(1.64);
    model.undo();
    expect(model.look.person.height).toBe(start);
    expect(model.canUndo).toBe(false);
  });

  it('ignores edits that change nothing', () => {
    const model = createFigureDesignerModel({ look: randomFigureLook('same') });
    let calls = 0;
    model.subscribe(() => calls++);
    model.choose('hair', model.look.person.hair);
    model.setColor('skin', model.look.person.skin);
    expect(calls).toBe(0);
    expect(model.canUndo).toBe(false);
  });

  it('randomizes under the steer, keeping the parts asked for', () => {
    const model = createFigureDesignerModel({
      look: randomFigureLook('r'),
      steer: 'feminine',
      randomSeed: nextSeed,
    });
    const person = model.look.person;
    for (let i = 0; i < 20; i++) {
      model.randomize(['person']);
      expect(model.look.person).toEqual(person);
    }
    for (let i = 0; i < 40; i++) {
      model.randomize();
      expect(model.look.person.facialHair).toBe('facial.none');
    }
  });

  it('shows a uniform without changing the look, and takes outside looks quietly', () => {
    const model = createFigureDesignerModel({ look: randomFigureLook('u') });
    const uniform = randomFigureLook('uniform').outfit;
    model.outfit = uniform;
    expect(model.figure.palette?.top).toBe(uniform.top.colors.top);
    expect(model.look.outfit).not.toEqual(uniform);
    let calls = 0;
    model.subscribe(() => calls++);
    model.setLook({ nonsense: true });
    expect(calls).toBe(0);
    expect(model.look.format).toBe('molen/figure-look@1');
  });
});

describe('designer strings', () => {
  it('falls back from host strings to English to the catalogue', () => {
    expect(figureDesignerText('steer.masculine')).toBe('Masculine');
    expect(figureDesignerText('steer.masculine', { strings: { 'steer.masculine': 'Male' } })).toBe(
      'Male',
    );
    expect(figureDesignerText('steer.feminine', { strings: () => undefined })).toBe('Feminine');
    expect(figureDesignerText('option.hair.bun')).toBe('Bun');
    expect(figureDesignerText('swatch.skin.#9d6742')).toBe('Tone 6 of 10');
    expect(
      figureDesignerText('status.changed', { params: { category: 'Hair', option: 'Bun' } }),
    ).toBe('Hair: Bun');
  });

  it('lists every key a translator needs', () => {
    const keys = figureDesignerStringKeys();
    for (const key of Object.keys(FIGURE_DESIGNER_STRINGS_EN)) expect(keys).toContain(key);
    expect(keys).toContain('option.body.straight');
    expect(keys).toContain('category.facialHair');
    expect(keys).toContain('swatch.fabric.#2f3b52');
  });

  it('formats heights and describes a look in one sentence', () => {
    expect(formatFigureHeight(1.72, 'metric')).toBe('1.72 m');
    expect(formatFigureHeight(1.72, 'imperial')).toBe('5 ft 8 in');
    const text = describeFigureLook(randomFigureLook('describe'));
    expect(text).toMatch(/^1\.\d\d m, \w+ body, Tone \d+ of 10 skin, /);
    expect(text).not.toMatch(/option\.|swatch\./);
  });
});
