// Regional recipes remain normal archstyles in the default style pack. A small, separately
// discoverable regional catalog binds them; ecology and third-party style packs stay independent.
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  aerialFlatRoofPalette,
  aerialRoofPalette,
  towerWalls,
  urbanWalls,
} from './aerial-palettes.mjs';
import { architectureFamilies } from './architecture-families.mjs';
import {
  architectureLotFences,
  architectureLotPattern,
  architectureLotPlans,
} from './architecture-lots.mjs';
import { architectureVariants } from './architecture-variants.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../worldgen');
const read = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const check = process.argv.includes('--check');
const written = new Set();
const write = async (path, doc) => {
  const output = `${JSON.stringify(doc, null, 2)}\n`;
  const full = resolve(root, path);
  written.add(full);
  if (check) {
    if ((await readFile(full, 'utf8')).replaceAll('\r\n', '\n') !== output)
      throw new Error(`Regional architecture is stale: ${path}`);
  } else {
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, output);
  }
};
const range = (min, max = min) => ({ min, max });
const weighted = (colors) =>
  colors.map((entry) =>
    Array.isArray(entry) ? { color: entry[0], weight: entry[1] } : { color: entry, weight: 1 },
  );
const palette = (colors, jitter = { hue: 0.005, saturation: 0.015, lightness: 0.025 }) => ({
  entries: weighted(colors),
  jitter,
});
// A roof of fired or split units is never one tone: tile by tile it weathers apart. The guide
// allows a twentieth of lightness; walls keep the tighter paint-shop jitter.
const roofJitter = { hue: 0.008, saturation: 0.03, lightness: 0.045 };
const ref = (name) => `matgraph:molen.worldgen.material.${name}`;
const material = (name) => [{ ref: ref(name), weight: 1 }];
// Meters per repeat of each shared graph (content/worldgen/materials/README.md), so a brick wall
// and a boarded one on the same street each keep their course and board size.
const repeat = {
  siding_lap: [3, 2.4],
  wood_painted_lap: [2, 1.6],
  wood_painted_shingle: [1.6, 1.6],
  wood_weatherboard: [2, 1.25],
  wood_vertical: [1.6, 2],
  brick: [1.92, 0.9],
  stucco: [3, 2.5],
  plaster_lime: [2, 2],
  earth_adobe: [1.35, 0.75],
  stone_limestone: [2.4, 1.6],
  stone_sandstone: [1.8, 1.5],
  concrete_panel: [3, 2.5],
  shingle_asphalt: [2.5, 2.5],
  slate: [1.5, 1.6],
  tile_ceramic: [2.4, 2.4],
  metal_standing_seam: [2.5, 3],
  metal_corrugated: [1.2, 2],
  membrane: [6, 6],
};
const sources = {
  detached: await read('styles/generic/house.archstyle.json'),
  attached: await read('styles/generic/house.archstyle.json'),
  apartments: await read('styles/catalog/modern_apartments.archstyle.json'),
  commercial: await read('styles/generic/commercial.archstyle.json'),
  tower: await read('styles/generic/commercial.archstyle.json'),
  civic: await read('styles/generic/commercial.archstyle.json'),
  industrial: await read('styles/generic/warehouse.archstyle.json'),
  farm: await read('styles/generic/box.archstyle.json'),
  worship: await read('styles/use/place_of_worship.archstyle.json'),
};
const classes = {
  detached: ['house', 'detached', 'semidetached', 'residential', 'bungalow', 'cabin', 'farmhouse'],
  attached: ['terrace', 'townhouse', 'townhouses', 'rowhouse'],
  apartments: ['apartments', 'dormitory', 'residential'],
  commercial: ['commercial', 'office', 'retail', 'hotel', 'shop'],
  tower: ['commercial', 'office', 'hotel', 'apartments', 'residential', 'yes', 'building'],
  civic: [
    'school',
    'kindergarten',
    'hospital',
    'clinic',
    'university',
    'public',
    'civic',
    'government',
  ],
  industrial: ['industrial', 'warehouse', 'factory', 'workshop', 'hangar'],
  farm: ['barn', 'farm_auxiliary', 'stable', 'cowshed', 'sty', 'agricultural'],
  worship: [
    'place_of_worship',
    'church',
    'chapel',
    'cathedral',
    'mosque',
    'temple',
    'synagogue',
    'shrine',
    'monastery',
  ],
};
// What a map adds to a footprint it does not type: the Earth binding's label for a building that
// shares its walls with neighbours, and land that says what stands on it.
const untyped = ['yes', 'building'];
const attachedLabel = 'attached';
const workLand = ['commercial', 'retail', 'industrial', 'farmyard', 'railway', 'port'];
const fieldLand = ['farmland', 'orchard', 'vineyard', 'meadow'];
const civicLand = [
  'school',
  'kindergarten',
  'college',
  'university',
  'education',
  'hospital',
  'civic',
  'government',
  'military',
];
// Uses whose streets read by their rhythm get three facade variants (base, compact, open).
// Sheds, barns, public buildings and places of worship are few to a street and stand alone:
// one recipe each, which keeps a third of the style documents out of the pack.
const rhythm = new Set(['detached', 'attached', 'apartments', 'commercial', 'tower']);
// Families whose older town blocks are brick: red, brown and buff, under a cornice.
const prewarBrick = ['neutral', 'north_american', 'australian', 'oceanian', 'south_african'];
const brickBlock = ['#9c5b46', '#8a4f3e', '#a96b52', '#7c4a3d', '#b58f6e', '#c4a680', '#8f6a58'];
// A slender shaft is a bell tower, a minaret or a chimney, not offices: a tower's floor plate.
const TOWER_AREA = 250;
const pack = await read('stylepack.json');
const precedents = await read('structures/catalog.json');
const explicitStyles = precedents.entries
  .filter((entry) => !entry.existing)
  .map((entry) => ({
    when: { class: [entry.style.split('.').at(-1)] },
    style: entry.style,
  }));
const id = (family, type) => `molen.worldgen.regional.${family}.${type}`;
const flat = { type: 'flat', weight: 1, parapet: { height: range(0.35, 0.55), thickness: 0.25 } };
const catalog = {
  format: 'molen/regional-catalog@1',
  id: 'molen.worldgen.regional',
  version: 1,
  title: 'Ordinary regional architecture',
  stylePack: pack.name,
  requires: [],
  overrides: [],
  profiles: [],
  scatters: [],
};
for (const key of Object.keys(pack.styles))
  if (key.startsWith('molen.worldgen.regional.')) delete pack.styles[key];

/** Weighted material choices, each tinted from its own palette, plus the palettes themselves. */
function materialChoices(list, prefix, style) {
  const union = [];
  const total = list.reduce((sum, entry) => sum + entry.weight, 0);
  const choices = list.map((entry) => {
    const key = `${prefix}_${entry.material}`;
    style.palettes[key] =
      prefix === 'roof' ? palette(entry.colors, roofJitter) : palette(entry.colors);
    // The whole part's palette, for readers that want one answer: every color at the weight it
    // is actually drawn with.
    for (const { color, weight } of weighted(entry.colors))
      union.push([
        color,
        Math.round(((entry.weight / total) * weight * 1000) / entry.colors.length) / 10,
      ]);
    return {
      ref: ref(entry.material),
      weight: entry.weight,
      palette: key,
      ...(repeat[entry.material] ? { uvScale: repeat[entry.material] } : {}),
    };
  });
  return { choices, union };
}

for (const family of architectureFamilies) {
  const traditional = family.urban === 'traditional';
  const flatShare = family.flat ?? (family.pitch === null ? 1 : 0);
  const pitchedLevels = family.pitch === null ? 0 : (family.pitchedLevels ?? 0);
  const aerial = (home) => aerialRoofPalette(family.id, home);
  for (const [type, source] of Object.entries(sources)) {
    const style = structuredClone(source);
    const home = type === 'detached' || type === 'attached';
    const shed = type === 'industrial' || type === 'farm';
    const worship = type === 'worship';
    // An old town's flats, shops and offices are built like its houses.
    const urbanType = type === 'apartments' || type === 'commercial' || type === 'civic';
    const likeHomes = home || type === 'farm' || worship || (urbanType && traditional);
    style.id = id(family.id, type);
    style.lotPlans = architectureLotPlans(family.id, type);
    style.lotFences = architectureLotFences(family.id, type);
    // The street pattern of invented lots travels on the house style, which a binding asks for
    // first when it lays out a block.
    const lots = type === 'detached' ? architectureLotPattern(family.id) : undefined;
    if (lots) style.lots = lots;
    else delete style.lots;
    style.title = `${family.title}: ${type}`;
    style.doc =
      'Broad construction prior for an ordinary mapped building. Source outline, height, levels and use take precedence. This does not infer historical age or a surveyed architectural identity.';
    style.applicability = { classes: classes[type] };
    // Chimneys on houses where winters have them and rooftop units on commercial blocks; sheds
    // stay bare.
    style.props = shed || worship ? [] : structuredClone(source.props ?? []);
    if (home) {
      const chimneys = family.chimneys;
      style.props = style.props.flatMap((prop) => {
        if (prop.id !== 'chimney' || chimneys === undefined) return [prop];
        return chimneys > 0 ? [{ ...prop, probability: chimneys }] : [];
      });
    }
    // Low shops and civic blocks carry a full-size rooftop unit for about every 250 m² of roof,
    // so a flat roof seen from above reads as working plant rather than a blank membrane.
    if (type === 'commercial' || type === 'civic' || type === 'tower')
      for (const prop of style.props)
        if (prop.id === 'hvac')
          Object.assign(prop, {
            count: range(2, 6),
            perAreaM2: 250,
            scale: range(1.1, 1.7),
            lodTier: 1,
          });
    if (['commercial', 'civic', 'tower'].includes(type))
      for (const tier of style.lod?.tiers ?? [])
        if (tier.minTier === 1 && !tier.keep.includes('props')) tier.keep.push('props');
    // Where roofs are terraces they carry the household's water: a cistern on a stand, or a
    // solar heater with its tank. Placed on flat roofs only, near the camera only.
    if (family.rooftop && !shed && !worship && type !== 'tower') {
      const tanks = family.rooftop === 'tanks';
      if (tanks) style.palettes.rooftop = palette(['#3a3b3e', '#ecece6', '#4f6f96', '#cfc6ae']);
      style.props.push({
        id: 'rooftop',
        model: `builtin:rooftop.${tanks ? 'tank' : 'solar'}`,
        anchor: 'roof-flat',
        probability: tanks ? 0.7 : 0.55,
        count: range(1, 3),
        perAreaM2: 90,
        roof: ['flat'],
        spacing: 2.4,
        margin: 0.9,
        scale: range(0.85, 1.15),
        yaw: 'align-wall',
        ...(tanks ? { tintPalette: 'rooftop' } : {}),
        lodTier: 0,
      });
    }
    // Foundation plantings: a few shrubs along a house's walls, flanking its door first.
    if (home)
      style.props.push({
        id: 'foundation-shrubs',
        model: 'builtin:shrub',
        anchor: 'ground-any',
        probability: 0.8,
        count: type === 'detached' ? range(4, 8) : range(3, 6),
        spacing: 1.7,
        margin: 1.1,
        scale: range(0.5, 0.75),
        yaw: 'random',
        lodTier: 0,
      });
    style.facade.details = {};
    style.facade.details.entrance = shed
      ? { width: type === 'industrial' ? 3.4 : 2.8, height: 3.1, style: 'service' }
      : worship
        ? { width: 1.7, height: 2.6, style: 'double' }
        : {
            width: home ? 1.05 : 1.9,
            height: home ? 2.15 : 2.5,
            style: home ? 'single' : 'double',
          };
    // Shops, offices and public buildings have taller storeys than dwellings, so a mapped height
    // gives them fewer floors; an old town's are a little lower than a modern block's.
    const workplace = type === 'commercial' || type === 'civic';
    // A masonry block of an old town: its rooms are taller than a modern flat's, so a mapped
    // height holds fewer storeys of them (a 21 m palazzo is five floors, not seven).
    const oldBlock = urbanType && traditional;
    style.massing.floorHeight = range(
      shed ? 4.5 : worship ? 4.6 : workplace ? (traditional ? 3.2 : 3.5) : oldBlock ? 3.15 : 2.85,
      shed ? 6 : worship ? 4.6 : workplace ? (traditional ? 3.6 : 4) : oldBlock ? 3.5 : 3.1,
    );
    // Shops, a carriage door and a hall stand under the first floor of such a block.
    if (oldBlock) style.massing.groundFloorHeight = range(3.7, 4.3);
    else delete style.massing.groundFloorHeight;
    // Where the map gives no height, a block of flats is a storey taller than the town's row
    // houses: three floors in a Cycladic village, five in Naples. The Earth binding reads the
    // upper figure as the most this region guesses for any unmeasured building.
    if (type === 'apartments') {
      const rows = family.attachedLevels;
      const block = family.blockLevels ?? (rows ? [rows[0] + 1, rows[1] + 1] : [3, 5]);
      style.massing.heightFallback = [
        { when: { areaMax: 180 }, levels: range(Math.min(2, block[0]), Math.max(2, block[1] - 1)) },
        { levels: range(...block) },
      ];
    }
    // A narrow plot in a row is built up; what is too small for stairs stays low.
    if (type === 'attached') {
      const levels = family.attachedLevels ?? [2, 3];
      style.massing.heightFallback = [
        { when: { areaMax: 55 }, levels: range(1, Math.min(2, levels[1])) },
        { levels: range(...levels) },
      ];
    }
    if (type === 'civic')
      style.massing.heightFallback = [
        { when: { class: ['hospital', 'university'] }, levels: range(2, 4) },
        { levels: range(1, 2) },
      ];
    if (shed) style.massing.heightFallback = [{ levels: range(1) }];
    // A chapel is a room; a parish church is a tall one; a cathedral has an upper tier of windows.
    if (worship)
      style.massing.heightFallback = [
        { when: { areaMax: 90 }, height: range(4.2, 5) },
        { when: { areaMax: 400 }, height: range(6.5, 8.5) },
        { height: range(9.5, 12.5) },
      ];
    style.massing.wings.secondaryHeightScale = range(1);
    style.palettes.regional_trim = palette(['#dcd8cc', '#8c918c']);
    style.materials.trim.palette = 'regional_trim';
    if (worship) style.materials.trim.choices = [{ ref: 'palette:#ffffff', weight: 1 }];
    // Walls.
    style.materials.wall.palette = 'regional_wall';
    style.materials.wall.uvScale ??= [3, 2.5];
    if (likeHomes) {
      const { choices, union } = materialChoices(family.walls, 'wall', style);
      style.materials.wall.choices = choices;
      style.palettes.regional_wall = palette(union);
    } else {
      style.materials.wall.choices = material(
        shed || type === 'tower' ? 'concrete_panel' : 'stucco',
      );
      style.palettes.regional_wall = palette(type === 'tower' ? towerWalls : urbanWalls);
    }
    // Roofs.
    style.materials.roof.uvScale ??= [2.5, 2.5];
    style.materials.roof.palette = 'regional_roof';
    style.roof.features =
      family.dormers && home
        ? {
            dormers: {
              probability: 0.3,
              perRidgeMeters: 5,
              style: 'gable',
              when: { areaMin: 110 },
            },
          }
        : undefined;
    const flatRoofColors = family.flatRoof ?? aerialFlatRoofPalette(family.id);
    const pitched = likeHomes && family.pitch !== null && (!urbanType || pitchedLevels > 0);
    if (pitched) {
      style.roof.overhang = range(...family.eaves);
      style.roof.perWing = true;
      style.roof.complexFootprint = 'wings';
      // Slopes up to a deck where no ridge fits, so an old town's irregular plans, courtyard
      // blocks and broad halls keep the roof their neighbours have.
      style.roof.fallback = 'hipped';
      if (family.partyRidge) style.roof.partyRidge = family.partyRidge;
      if (urbanType || worship) {
        style.massing.wings.split = 'rectangles';
        style.massing.wings.maxWingSpan = worship ? 40 : 22;
        style.massing.wings.minWingArea = 16;
      }
      // Houses keep a pitched roof through three storeys; a traditional town's larger blocks
      // through the height its roofs were built to.
      const levelsMax = worship ? 99 : Math.max(urbanType ? 1 : 3, pitchedLevels);
      const pitch = worship
        ? range(Math.min(52, family.pitch[0] + 8), Math.min(56, family.pitch[1] + 8))
        : range(...family.pitch);
      const forms =
        urbanType && family.urbanRoof === 'mansard'
          ? [
              {
                type: 'mansard',
                weight: 4,
                pitchDeg: range(18, 26),
                lowerPitchDeg: range(66, 74),
                when: { levelsMax },
              },
              { type: 'gable', weight: 1, pitchDeg: pitch, when: { levelsMax } },
            ]
          : worship
            ? [{ type: 'gable', weight: 1, pitchDeg: pitch }]
            : [
                { type: 'gable', weight: urbanType ? 1 : 3, pitchDeg: pitch, when: { levelsMax } },
                { type: 'hip', weight: urbanType ? 3 : 2, pitchDeg: pitch, when: { levelsMax } },
              ];
      // Where nearly every roof is a terrace, so is the chapel's: its dome says what it is.
      const ownShare = family.flatByUse?.[type] ?? flatShare;
      const share = urbanType ? 0 : worship ? (flatShare >= 0.8 ? 1 : 0) : ownShare;
      style.roof.choices = [
        ...forms.map((form) => ({ ...form, weight: form.weight * (1 - share) })),
        ...(share > 0
          ? [
              {
                ...structuredClone(flat),
                weight: 5 * share,
                ...(worship ? {} : { when: { levelsMax } }),
              },
            ]
          : []),
        ...(worship ? [] : [{ ...structuredClone(flat), when: { levelsMin: levelsMax + 1 } }]),
      ].filter((choice) => choice.weight > 0);
      const override = aerial(home);
      const { choices, union } = materialChoices(
        override ? [{ ...family.roofs[0], colors: override }] : family.roofs,
        'roof',
        style,
      );
      style.materials.roof.choices = choices;
      style.palettes.regional_roof = palette(union);
      // A flat top on a pitched style is a terrace or a membrane, not tile laid level.
      style.materials.flatRoof = {
        ...style.materials.roof,
        choices: material('membrane'),
        palette: 'regional_flat_roof',
        uvScale: [6, 6],
      };
      // Yuma's light roofs were matched as one palette, flat and tiled alike.
      style.palettes.regional_flat_roof = palette(
        family.id === 'southwestern' && override ? override : flatRoofColors,
      );
    } else if (likeHomes) {
      // A tradition of flat roofs: terraces in the family's own roof colors.
      style.roof.overhang = range(...family.eaves);
      style.roof.perWing = true;
      style.roof.complexFootprint = 'wings';
      style.roof.choices = [structuredClone(flat)];
      style.materials.roof.choices = material('membrane');
      style.materials.roof.uvScale = [6, 6];
      style.palettes.regional_roof = palette(aerial(home) ?? flatRoofColors);
      delete style.materials.flatRoof;
    } else {
      style.roof.choices = [structuredClone(flat)];
      style.roof.overhang = range(0, 0.12);
      style.materials.roof.choices = material('membrane');
      // A 6 m repeat holds 1 m rolls, seams a camera above the street can still resolve.
      style.materials.roof.uvScale = [6, 6];
      style.palettes.regional_roof = palette(aerialFlatRoofPalette(family.id));
      delete style.materials.flatRoof;
    }
    style.facade.bays.width = range(
      shed ? 5.5 : worship ? 3.4 : family.bay,
      shed ? 7 : worship ? 3.8 : family.bay + 0.25,
    );
    style.facade.windows.width = range(family.window, family.window + 0.2);
    style.facade.windows.height = range(1.3, 1.55);
    style.facade.windows.sill = range(0.8, 0.95);
    style.facade.windows.groundFloor = type === 'commercial' ? 'storefront' : 'same';
    style.facade.windows.probabilityPerBay = shed ? 0.3 : 0.88;
    style.facade.windows.style = 'punched';
    if (shed) {
      style.facade.windows.width = range(1.8, 2.3);
      style.facade.windows.height = range(0.7, 1);
      style.facade.windows.sill = range(2.5, 2.9);
    }
    if (worship) {
      // Tall narrow lights, one tier to a chapel and two to a nave.
      style.facade.windows.width = range(0.85, 1);
      style.facade.windows.height = range(2.4, 2.7);
      style.facade.windows.sill = range(1.4, 1.6);
      style.facade.windows.probabilityPerBay = 1;
      style.facade.bands = { base: { height: range(0.5, 0.7) }, floorLines: false };
    }
    if (oldBlock) {
      // Windows taller than wide over a low sill, a plinth, a string course to each floor and a
      // cornice where the roof is flat: what tells a town block from an office of the 1980s.
      style.facade.windows.height = range(1.6, 1.9);
      style.facade.windows.sill = range(0.6, 0.8);
      style.facade.bands = {
        base: { height: range(0.6, 0.95) },
        floorLines: true,
        cornice: { height: 0.42 },
      };
      if (type === 'civic') style.facade.details.framing = { style: 'pilasters', width: 0.45 };
    }
    const dressed = home || (urbanType && traditional);
    if (family.shutters && dressed) style.facade.details.shutters = true;
    if (family.paint && (dressed || worship)) style.facade.details.paint = family.paint;
    // Lap-sided houses case their outside corners with trim boards.
    if (
      home &&
      ['siding_lap', 'wood_painted_lap', 'wood_weatherboard'].includes(family.walls[0].material)
    )
      style.facade.details.cornerBoards = true;
    if (family.balcony && (type === 'apartments' || (type === 'attached' && traditional)))
      style.facade.details.balconies = { depth: family.balcony, railing: 'open', every: 2 };
    if (family.awning && !shed && !worship) style.facade.details.awnings = { depth: family.awning };
    if (family.veranda && type === 'detached')
      style.facade.details.veranda = { depth: family.veranda, columns: true };
    if (family.porch && home && !style.facade.details.veranda)
      style.facade.details.porch =
        type === 'attached' ? { ...family.porch, canopy: 'none' } : family.porch;
    if (type === 'attached') style.roof.overhang = range(0.1, 0.25);
    if (home && family.id === 'southwestern') {
      // Flat/light roofs dominate the reviewed Yuma blocks; tile remains a minority.
      style.roof.choices = [structuredClone(flat), ...style.roof.choices];
      style.roof.choices[0].weight = 8;
      style.roof.fallback = 'flat';
    }
    if (type === 'tower') {
      style.massing.floorHeight = range(3.3, 3.8);
      style.facade.windows.style = 'grid';
      style.facade.windows.width = range(2.1, 2.7);
      style.facade.windows.height = range(2.3, 2.8);
      style.facade.windows.sill = range(0.45, 0.65);
      style.facade.windows.probabilityPerBay = 0.98;
      // The source recipe's setbacks and mapped height preserve the tower/podium envelope.
    }
    const variants = rhythm.has(type) ? architectureVariants(style) : [style];
    // Not every block of a modern town was built in one decade. Of the three facades a block
    // can draw, the compact one is the older building: brick or the town's own wall materials,
    // tall windows, a plinth and a cornice, over a taller ground floor.
    if ((type === 'apartments' || type === 'commercial') && !traditional) {
      const older = variants.find((variant) => variant.id.endsWith('.compact'));
      if (older) {
        const walls = prewarBrick.includes(family.id)
          ? [{ material: 'brick', weight: 1, colors: brickBlock }]
          : family.walls;
        delete older.palettes.regional_wall;
        const { choices, union } = materialChoices(walls, 'wall', older);
        older.materials.wall.choices = choices;
        older.palettes.regional_wall = palette(union);
        older.massing.floorHeight = range(3.3, 3.8);
        older.massing.groundFloorHeight = range(4, 4.8);
        older.facade.windows.style = 'punched';
        older.facade.windows.width = range(family.window * 0.95, family.window * 0.95 + 0.2);
        older.facade.windows.height = range(1.7, 2);
        older.facade.windows.sill = range(0.6, 0.8);
        older.facade.windows.probabilityPerBay = 0.94;
        older.facade.bands = {
          base: { height: range(0.7, 1) },
          floorLines: true,
          cornice: { height: 0.55 },
        };
        older.title = `${style.title}: older masonry block`;
      }
    }
    for (const variant of variants) {
      const suffix = variant.id === style.id ? '' : `_${variant.id.split('.').at(-1)}`;
      const path = `styles/regional/${family.id}/${type}${suffix}.archstyle.json`;
      pack.styles[variant.id] = path;
      await write(path, variant);
    }
  }
  const use = (type, when) => ({
    when,
    style: id(family.id, type),
    variants: (rhythm.has(type) ? ['', '.compact', '.open'] : ['']).map((suffix) => ({
      style: `${id(family.id, type)}${suffix}`,
      weight: 1,
    })),
  });
  const residential = [...classes.detached, ...classes.attached];
  // Where a town's big buildings are its houses' big sisters, an unexplained large footprint is
  // a block of flats; elsewhere it is a shop or an office.
  const large = traditional ? 'apartments' : 'commercial';
  // Type-specific rules precede context guesses. A school in a residential block stays a school.
  const rules = [
    // A caller's explicit named architectural precedent remains available in every region.
    ...explicitStyles,
    // Where shops are single-storey store shells wherever they stand, the Earth binding reads
    // this rule as saying so; elsewhere a shop keeps its building and gains a frontage.
    ...(family.shopShells
      ? [{ when: { class: ['shop_shell'] }, style: 'molen.worldgen.generic.store' }]
      : []),
    use('worship', { class: classes.worship }),
    // Where towns are built in masonry to seven or eight storeys, a 35 m block is still one of
    // them (a palazzo, a cathedral nave); glass and panel start higher.
    use('tower', {
      class: classes.tower,
      heightMin: traditional ? 50 : 35,
      areaMin: TOWER_AREA,
    }),
    use('tower', {
      class: classes.tower,
      levelsMin: traditional ? 15 : 11,
      areaMin: TOWER_AREA,
    }),
    ...['industrial', 'farm', 'civic', 'commercial'].map((type) =>
      use(type, { class: classes[type] }),
    ),
    use('apartments', { class: ['apartments', 'dormitory'] }),
    use('apartments', { class: residential, levelsMin: 4 }),
    use('apartments', { class: residential, heightMin: 12 }),
    use('attached', { class: classes.attached }),
    // A mapped row or block: footprints that share their walls, whatever the land is called.
    use('apartments', {
      class: [attachedLabel],
      notContextClass: [...workLand, ...civicLand],
      levelsMin: 4,
    }),
    use('apartments', {
      class: [attachedLabel],
      notContextClass: [...workLand, ...civicLand],
      heightMin: 12,
    }),
    use('attached', {
      class: [attachedLabel],
      notContextClass: [...workLand, ...civicLand],
      areaMax: 450,
    }),
    use('detached', { class: classes.detached }),
    use('farm', { class: untyped, contextClass: ['farmyard'] }),
    // A large building standing in fields is a barn or a shed, not a shop or a block of flats:
    // the farmhouse beside it stays a house.
    use('farm', { class: untyped, contextClass: fieldLand, areaMin: 250 }),
    use('apartments', { class: untyped, contextClass: ['residential'], levelsMin: 4 }),
    use('apartments', { class: untyped, contextClass: ['residential'], heightMin: 12 }),
    use('industrial', { class: untyped, contextClass: ['industrial'] }),
    use('commercial', { class: untyped, contextClass: ['commercial', 'retail'] }),
    use('civic', { class: untyped, contextClass: civicLand, areaMin: 120 }),
    use('detached', { class: untyped, contextClass: ['residential'], areaMax: 400 }),
    use('apartments', { class: untyped, contextClass: ['residential'], areaMin: 400 }),
    // No land use says what these are. Most of the world's towns are mapped this way, so the
    // region still decides: a building is its region's before it is anything else.
    use(large, { class: untyped, levelsMin: 4 }),
    use(large, { class: untyped, heightMin: 12 }),
    use('detached', { class: untyped, areaMax: 600 }),
    use(large, { class: untyped, areaMin: 600 }),
  ];
  catalog.profiles.push({
    id: `molen.worldgen.regional.profile.${family.id}`,
    title: family.title,
    priority: family.regions.length ? 10 : -10,
    match: family.regions.length ? { regions: family.regions } : {},
    buildings: rules,
  });
}
await write('regional.catalog.json', catalog);
// Families come and go: a style file no family writes any more is stale, not content.
const regionalDir = resolve(root, 'styles/regional');
for (const entry of await readdir(regionalDir, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile()) continue;
  const full = resolve(entry.parentPath, entry.name);
  if (written.has(full)) continue;
  if (check) throw new Error(`Stale regional style: ${full}`);
  await rm(full);
}
if (!check)
  for (const entry of await readdir(regionalDir, { withFileTypes: true }))
    if (entry.isDirectory() && (await readdir(resolve(regionalDir, entry.name))).length === 0)
      await rm(resolve(regionalDir, entry.name), { recursive: true });
// Preserve the manifest's established formatter and unrelated authoring changes.
const previous = await read('stylepack.json');
if (check) {
  if (JSON.stringify(previous.styles) !== JSON.stringify(pack.styles))
    throw new Error('Missing regional styles in stylepack.json');
} else {
  const { formatJson } = await import('../../../packages/worldgen/scripts/format-json.mjs');
  await writeFile(resolve(root, 'stylepack.json'), `${formatJson(pack)}\n`);
}
console.log(
  JSON.stringify({
    families: architectureFamilies.length,
    styles: Object.keys(pack.styles).filter((key) => key.startsWith('molen.worldgen.regional.'))
      .length,
    profiles: catalog.profiles.length,
  }),
);
