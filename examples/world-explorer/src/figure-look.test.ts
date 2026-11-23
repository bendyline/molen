import { figureFromLook, figureLookKey, randomFigureLook } from '@bendyline/molen-figures/look';
import { describe, expect, it } from 'vitest';
import {
  type FigureLookStorage,
  figureBodies,
  figureWanted,
  initialLook,
  rememberLook,
} from './figure-look';

const query = (text: string): URLSearchParams => new URLSearchParams(text);

function memory(): FigureLookStorage & { size: number } {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    get size() {
      return items.size;
    },
  };
}

const refusing: FigureLookStorage = {
  getItem() {
    throw new Error('refused');
  },
  setItem() {
    throw new Error('refused');
  },
};

describe('the explorer figure', () => {
  it('is left out by figure=0 and by frozen captures that do not ask for it', () => {
    expect(figureWanted(query(''))).toBe(true);
    expect(figureWanted(query('figure=ada'))).toBe(true);
    expect(figureWanted(query('figure=0'))).toBe(false);
    expect(figureWanted(query('freeze=1'))).toBe(false);
    expect(figureWanted(query('freeze=1&figure=1'))).toBe(true);
    expect(figureWanted(query('freeze=1&figure=ada'))).toBe(true);
  });

  it('starts as someone new each visit until one is designed', () => {
    const storage = memory();
    const first = initialLook(query(''), storage);
    const second = initialLook(query('figure=1'), storage);
    expect([first.source, second.source]).toEqual(['random', 'random']);
    expect(figureLookKey(first.look)).not.toBe(figureLookKey(second.look));
    // Only a designed figure is kept.
    expect(storage.size).toBe(0);
    rememberLook(storage, first.look);
    const kept = initialLook(query(''), storage);
    expect(kept.source).toBe('saved');
    expect(figureLookKey(kept.look)).toBe(figureLookKey(first.look));
  });

  it('lets a link name the figure, whatever is saved', () => {
    const storage = memory();
    rememberLook(storage, randomFigureLook('someone else'));
    const named = initialLook(query('figure=ada'), storage);
    expect(named.source).toBe('link');
    expect(figureLookKey(named.look)).toBe(figureLookKey(randomFigureLook('ada')));
  });

  it('starts with someone new when storage is refused or holds no look', () => {
    expect(initialLook(query(''), refusing).source).toBe('random');
    expect(() => rememberLook(refusing, randomFigureLook('ada'))).not.toThrow();
    expect(initialLook(query(''), undefined).source).toBe('random');
    const broken = { ...memory(), getItem: () => '{' };
    expect(initialLook(query(''), broken).source).toBe('random');
  });

  it('takes off in a seat what a seat back or canopy has no room for, and nothing else', () => {
    const base = randomFigureLook('ada');
    const look = {
      ...base,
      outfit: {
        ...base.outfit,
        accessories: {
          backwear: { id: 'backwear.backpack', colors: {} },
          bag: { id: 'bag.shoulder', colors: {} },
          headwear: { id: 'headwear.sunhat', colors: {} },
          wristwear: { id: 'wristwear.watch', colors: {} },
        },
      },
    };
    const { standing, seated } = figureBodies(look);
    expect(standing).toEqual(figureFromLook(look));
    expect(standing.features).toMatchObject({ headwear: 'sunhat' });
    expect(seated).toEqual(
      figureFromLook({
        ...look,
        outfit: {
          ...look.outfit,
          accessories: { wristwear: look.outfit.accessories.wristwear },
        },
      }),
    );
    // A close-fitting hat stays on.
    const capped = figureBodies({
      ...look,
      outfit: {
        ...look.outfit,
        accessories: { headwear: { id: 'headwear.cap', colors: {} } },
      },
    });
    expect(capped.seated).toEqual(capped.standing);
  });
});
