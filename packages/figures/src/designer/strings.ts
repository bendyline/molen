/**
 * Every word a figure designer shows, behind typed keys with an English table, so a host can
 * translate or rename anything (a host's presentation names, its own word for "outfit") through
 * a map or a lookup function. Option, category and swatch labels fall back to the catalogue.
 */

import { DEFAULT_FIGURE_LOOK_CATALOG } from '../look/catalog';
import { figureLookCategory, figureLookReplaced } from '../look/figure';
import {
  FIGURE_LOOK_GARMENTS,
  FIGURE_LOOK_SLOTS,
  type FigureLook,
  type FigureLookCatalog,
  type FigureLookColorSlot,
  type FigureLookPaletteId,
} from '../look/types';

/** Fixed string keys (catalogue keys are `category.<id>`, `option.<id>`, `swatch.<palette>.<hex>`). */
export type FigureDesignerStringKey =
  | 'designer.label'
  | 'section.person'
  | 'section.outfit'
  | 'steer.label'
  | 'steer.masculine'
  | 'steer.feminine'
  | 'steer.unspecified'
  | 'color.skin'
  | 'color.hairColor'
  | 'color.eyes'
  | 'color.top'
  | 'color.bottom'
  | 'color.shoes'
  | 'color.accent'
  | 'color.outer'
  | 'color.top.under'
  | 'color.headwear'
  | 'color.eyewear'
  | 'color.neckwear'
  | 'color.backwear'
  | 'color.earwear'
  | 'color.wristwear'
  | 'color.bag'
  | 'color.custom'
  | 'height.label'
  | 'height.value.metric'
  | 'height.value.imperial'
  | 'more.options'
  | 'slot.none'
  | 'action.randomize'
  | 'action.randomizeOutfit'
  | 'action.undo'
  | 'action.redo'
  | 'action.rotateLeft'
  | 'action.rotateRight'
  | 'action.viewHead'
  | 'action.viewBody'
  | 'action.walk'
  | 'action.stand'
  | 'preview.label'
  | 'preview.unavailable'
  | 'status.changed'
  | 'describe.person'
  | 'describe.item';

export const FIGURE_DESIGNER_STRINGS_EN: Readonly<Record<FigureDesignerStringKey, string>> = {
  'designer.label': 'Character designer',
  'section.person': 'Character',
  'section.outfit': 'Clothing & accessories',
  'steer.label': 'Style',
  'steer.masculine': 'Masculine',
  'steer.feminine': 'Feminine',
  'steer.unspecified': 'Unspecified',
  'color.skin': 'Skin tone',
  'color.hairColor': 'Hair colour',
  'color.eyes': 'Eye colour',
  'color.top': 'Colour',
  'color.bottom': 'Colour',
  'color.shoes': 'Colour',
  'color.accent': 'Belt',
  'color.outer': 'Colour',
  'color.top.under': 'Shirt',
  'color.headwear': 'Colour',
  'color.eyewear': 'Frames',
  'color.neckwear': 'Colour',
  'color.backwear': 'Colour',
  'color.earwear': 'Colour',
  'color.wristwear': 'Strap',
  'color.bag': 'Colour',
  'color.custom': 'Custom colour',
  'height.label': 'Height',
  'height.value.metric': '{m} m',
  'height.value.imperial': '{ft} ft {in} in',
  'more.options': 'More options',
  'slot.none': 'None',
  'action.randomize': 'Surprise me',
  'action.randomizeOutfit': 'New outfit',
  'action.undo': 'Undo',
  'action.redo': 'Redo',
  'action.rotateLeft': 'Turn left',
  'action.rotateRight': 'Turn right',
  'action.viewHead': 'Close-up',
  'action.viewBody': 'Full body',
  'action.walk': 'Walk',
  'action.stand': 'Stand',
  'preview.label': 'Preview: {description}',
  'preview.unavailable':
    'The 3D preview is not available on this device. Your choices still apply.',
  'status.changed': '{category}: {option}',
  'describe.person': '{height}, {body} body, {skin} skin, {hair} hair ({hairColor})',
  'describe.item': '{item} ({color})',
};

/** Host strings: a partial map, or a lookup returning undefined for "use the default". */
export type FigureDesignerStrings =
  | Partial<Record<string, string>>
  | ((key: string, params?: Readonly<Record<string, string | number>>) => string | undefined);

function fill(text: string, params: Readonly<Record<string, string | number>> | undefined): string {
  if (params === undefined) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    params[name] === undefined ? whole : String(params[name]),
  );
}

/** The default text of a catalogue key (`category.*`, `option.*`, `swatch.*`), if it is one. */
function catalogText(key: string, catalog: FigureLookCatalog): string | undefined {
  const dot = key.indexOf('.');
  const kind = key.slice(0, dot);
  const rest = key.slice(dot + 1);
  if (kind === 'category') return catalog.categories.find((c) => c.id === rest)?.label;
  if (kind === 'option')
    for (const category of catalog.categories) {
      const option = category.options.find((o) => o.id === rest);
      if (option !== undefined) return option.label;
    }
  if (kind === 'swatch') {
    const [palette, hex] = rest.split('.') as [FigureLookPaletteId, string];
    return catalog.palettes[palette]?.find((swatch) => swatch.hex === hex)?.label;
  }
  return undefined;
}

/** Look a string up: host strings, then English, then the catalogue, then the key itself. */
export function figureDesignerText(
  key: string,
  options: {
    strings?: FigureDesignerStrings;
    catalog?: FigureLookCatalog;
    params?: Readonly<Record<string, string | number>>;
  } = {},
): string {
  const { strings, params } = options;
  const host =
    typeof strings === 'function'
      ? strings(key, params)
      : strings !== undefined
        ? strings[key]
        : undefined;
  if (host !== undefined) return fill(host, params);
  const english = (FIGURE_DESIGNER_STRINGS_EN as Readonly<Record<string, string>>)[key];
  if (english !== undefined) return fill(english, params);
  return catalogText(key, options.catalog ?? DEFAULT_FIGURE_LOOK_CATALOG) ?? key;
}

/** Every key a translator should cover for a catalogue. */
export function figureDesignerStringKeys(
  catalog: FigureLookCatalog = DEFAULT_FIGURE_LOOK_CATALOG,
): string[] {
  const keys: string[] = Object.keys(FIGURE_DESIGNER_STRINGS_EN);
  for (const category of catalog.categories) {
    keys.push(`category.${category.id}`);
    for (const option of category.options) keys.push(`option.${option.id}`);
  }
  for (const [palette, swatches] of Object.entries(catalog.palettes))
    for (const swatch of swatches) keys.push(`swatch.${palette}.${swatch.hex}`);
  return keys;
}

/** A height for people: '1.72 m', or '5 ft 8 in'. */
export function formatFigureHeight(
  meters: number,
  units: 'metric' | 'imperial',
  strings?: FigureDesignerStrings,
): string {
  if (units === 'imperial') {
    const inches = Math.round(meters / 0.0254);
    return figureDesignerText('height.value.imperial', {
      ...(strings ? { strings } : {}),
      params: { ft: Math.floor(inches / 12), in: inches % 12 },
    });
  }
  return figureDesignerText('height.value.metric', {
    ...(strings ? { strings } : {}),
    params: { m: meters.toFixed(2) },
  });
}

/** The label of a colour: its swatch's name, else the custom-colour label. */
export function figureColorName(
  palette: FigureLookPaletteId,
  hex: string,
  options: { strings?: FigureDesignerStrings; catalog?: FigureLookCatalog } = {},
): string {
  const catalog = options.catalog ?? DEFAULT_FIGURE_LOOK_CATALOG;
  const known = catalog.palettes[palette]?.some((swatch) => swatch.hex === hex);
  return figureDesignerText(known ? `swatch.${palette}.${hex}` : 'color.custom', {
    ...options,
    catalog,
  });
}

/**
 * One sentence describing a look, for a preview's accessible name: who the person is, then what
 * they wear.
 */
export function describeFigureLook(
  look: FigureLook,
  options: {
    strings?: FigureDesignerStrings;
    catalog?: FigureLookCatalog;
    units?: 'metric' | 'imperial';
  } = {},
): string {
  const catalog = options.catalog ?? DEFAULT_FIGURE_LOOK_CATALOG;
  const text = (key: string, params?: Record<string, string | number>): string =>
    figureDesignerText(key, { ...options, catalog, ...(params ? { params } : {}) });
  const { person, outfit } = look;
  const parts = [
    text('describe.person', {
      height: formatFigureHeight(person.height, options.units ?? 'metric', options.strings),
      body: text(`option.${person.body}`),
      skin: figureColorName('skin', person.skin, { ...options, catalog }),
      hair: text(`option.${person.hair}`),
      hairColor: figureColorName('hair', person.hairColor, { ...options, catalog }),
    }),
  ];
  if (person.facialHair !== 'facial.none' && figureLookCategory('facialHair', catalog))
    parts.push(text(`option.${person.facialHair}`));
  const replaced = figureLookReplaced(outfit, catalog);
  const items: [string, { id: string; colors: Partial<Record<FigureLookColorSlot, string>> }][] = [
    ...FIGURE_LOOK_GARMENTS.filter((g) => !replaced.has(g)).map(
      (g) => [g, outfit[g]] as [string, (typeof outfit)['top']],
    ),
    ...FIGURE_LOOK_SLOTS.flatMap((slot) => {
      const item = outfit.accessories[slot];
      return item === undefined ? [] : [[slot, item] as [string, (typeof outfit)['top']]];
    }),
  ];
  for (const [, item] of items) {
    const [slot, hex] = Object.entries(item.colors)[0] ?? [];
    const color =
      slot !== undefined && typeof hex === 'string'
        ? figureColorName(catalog.slotPalettes[slot as FigureLookColorSlot], hex, {
            ...options,
            catalog,
          })
        : undefined;
    const name = text(`option.${item.id}`);
    parts.push(color === undefined ? name : text('describe.item', { item: name, color }));
  }
  return parts.join(', ');
}
