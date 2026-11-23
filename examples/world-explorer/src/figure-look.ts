import {
  type FigureDescriptor,
  type FigureLook,
  figureFromLook,
  normalizeFigureLook,
  randomFigureLook,
} from '@bendyline/molen-figures/look';

/**
 * Where the figure on the page came from: drawn for this visit, designed here, named by the link,
 * or drawn for this visit in place of the designed one.
 */
export type FigureLookSource = 'random' | 'saved' | 'link' | 'visit';

export interface FigureLookChoice {
  look: FigureLook;
  source: FigureLookSource;
}

/** The pieces of `localStorage` used here; any of them may throw in a private window. */
export type FigureLookStorage = Pick<Storage, 'getItem' | 'setItem'>;

const STORAGE_KEY = 'molen.world-explorer.figure';

/**
 * Whether the viewer has a figure: `?figure=0` leaves it out, and so do frozen captures
 * (`?freeze=1`) unless they ask for one, as they do ambient life.
 */
export function figureWanted(params: URLSearchParams): boolean {
  const figure = params.get('figure');
  return figure === null ? params.get('freeze') !== '1' : figure !== '0';
}

/** A new person. `crypto.randomUUID` is missing on plain-http hosts other than localhost. */
export function randomLook(): FigureLook {
  return randomFigureLook(globalThis.crypto?.randomUUID?.() ?? String(Math.random()));
}

/**
 * The figure a visit starts with: the one `?figure=<seed>` names, else the one designed here
 * before, else someone new.
 */
export function initialLook(
  params: URLSearchParams,
  storage: FigureLookStorage | undefined,
): FigureLookChoice {
  const seed = params.get('figure');
  if (seed !== null && seed !== '' && seed !== '0' && seed !== '1')
    return { look: randomFigureLook(seed), source: 'link' };
  const saved = savedLook(storage);
  return saved !== undefined
    ? { look: saved, source: 'saved' }
    : { look: randomLook(), source: 'random' };
}

function savedLook(storage: FigureLookStorage | undefined): FigureLook | undefined {
  try {
    const text = storage?.getItem(STORAGE_KEY);
    return text ? normalizeFigureLook(JSON.parse(text)).look : undefined;
  } catch {
    // Storage refused, or not a look: start with someone new.
    return undefined;
  }
}

/** Keep a designed look for later visits. */
export function rememberLook(storage: FigureLookStorage | undefined, look: FigureLook): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(look));
  } catch {
    // The figure just does not outlive the page.
  }
}

/**
 * The bodies of a look: as it walks, and as it sits, without what a seat back or a canopy leaves
 * no room for (a backpack, a shoulder bag, a wide brim).
 */
export function figureBodies(look: FigureLook): {
  standing: FigureDescriptor;
  seated: FigureDescriptor;
} {
  const { backwear: _backwear, bag: _bag, headwear, ...kept } = look.outfit.accessories;
  return {
    standing: figureFromLook(look),
    seated: figureFromLook(look, {
      outfit: {
        ...look.outfit,
        accessories: {
          ...kept,
          ...(headwear !== undefined && headwear.id !== 'headwear.sunhat' ? { headwear } : {}),
        },
      },
    }),
  };
}
