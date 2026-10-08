// Regional recipes remain normal archstyles in the default style pack. A small, separately
// discoverable regional catalog binds them; ecology and third-party style packs stay independent.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { architectureFamilies } from './architecture-families.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../worldgen');
const read = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const check = process.argv.includes('--check');
const write = async (path, doc) => {
  const output = `${JSON.stringify(doc, null, 2)}\n`;
  const full = resolve(root, path);
  if (check) {
    if ((await readFile(full, 'utf8')).replaceAll('\r\n', '\n') !== output)
      throw new Error(`Regional architecture is stale: ${path}`);
  } else {
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, output);
  }
};
const range = (min, max = min) => ({ min, max });
const palette = (colors) => ({
  entries: colors.map((color) => ({ color, weight: 1 })),
  jitter: { hue: 0.005, saturation: 0.015, lightness: 0.025 },
});
const material = (name) => [{ ref: `matgraph:molen.worldgen.material.${name}`, weight: 1 }];
const sources = {
  detached: await read('styles/generic/house.archstyle.json'),
  attached: await read('styles/generic/house.archstyle.json'),
  apartments: await read('styles/catalog/modern_apartments.archstyle.json'),
  commercial: await read('styles/generic/commercial.archstyle.json'),
  civic: await read('styles/generic/commercial.archstyle.json'),
  industrial: await read('styles/generic/warehouse.archstyle.json'),
  farm: await read('styles/generic/box.archstyle.json'),
};
const classes = {
  detached: ['house', 'detached', 'semidetached', 'residential', 'bungalow', 'cabin', 'farmhouse'],
  attached: ['terrace', 'townhouse', 'townhouses', 'rowhouse'],
  apartments: ['apartments', 'dormitory', 'residential'],
  commercial: ['commercial', 'office', 'retail', 'hotel', 'shop'],
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
  farm: ['barn', 'farm_auxiliary', 'stable'],
};
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
for (const family of architectureFamilies) {
  for (const [type, source] of Object.entries(sources)) {
    const style = structuredClone(source);
    const home = type === 'detached' || type === 'attached';
    const shed = type === 'industrial' || type === 'farm';
    style.id = id(family.id, type);
    style.title = `${family.title}: ${type}`;
    style.doc =
      'Broad construction prior for an ordinary mapped building. Source outline, height, levels and use take precedence. This does not infer historical age or a surveyed architectural identity.';
    style.applicability = { classes: classes[type] };
    style.props = [];
    style.facade.details = {};
    style.facade.details.entrance = shed
      ? { width: type === 'industrial' ? 3.4 : 2.8, height: 3.1, style: 'service' }
      : { width: home ? 1.05 : 1.9, height: home ? 2.15 : 2.5, style: home ? 'single' : 'double' };
    style.massing.floorHeight = range(shed ? 4.5 : 2.85, shed ? 6 : 3.1);
    delete style.massing.groundFloorHeight;
    if (type === 'apartments')
      style.massing.heightFallback = [
        { when: { areaMax: 180 }, levels: range(2, 3) },
        { levels: range(3, 5) },
      ];
    if (type === 'attached') style.massing.heightFallback = [{ levels: range(2, 3) }];
    if (type === 'civic')
      style.massing.heightFallback = [
        { when: { class: ['hospital', 'university'] }, levels: range(2, 4) },
        { levels: range(1, 2) },
      ];
    if (shed) style.massing.heightFallback = [{ levels: range(1) }];
    style.massing.wings.secondaryHeightScale = range(1);
    style.materials.wall.choices = material(
      shed ? 'concrete_panel' : home ? family.wall : 'stucco',
    );
    style.materials.wall.palette = 'regional_wall';
    style.materials.wall.uvScale ??= [3, 2.5];
    style.materials.roof.uvScale ??= [2.5, 2.5];
    style.materials.roof.palette = 'regional_roof';
    style.materials.trim.palette = 'regional_trim';
    style.palettes.regional_wall = palette(family.colors);
    style.palettes.regional_roof = palette(family.roofColors);
    style.palettes.regional_trim = palette(['#dcd8cc', '#8c918c']);
    style.roof.features = undefined;
    if (home || type === 'farm') {
      style.roof.overhang = range(...family.eaves);
      style.roof.perWing = true;
      style.roof.complexFootprint = 'wings';
      style.roof.choices =
        family.pitch === null
          ? [structuredClone(flat)]
          : [
              {
                type: 'gable',
                weight: 3,
                pitchDeg: range(...family.pitch),
                when: { levelsMax: 3 },
              },
              { type: 'hip', weight: 2, pitchDeg: range(...family.pitch), when: { levelsMax: 3 } },
              { ...structuredClone(flat), when: { levelsMin: 4 } },
            ];
      style.materials.roof.choices = material(family.roof);
    } else {
      style.roof.choices = [structuredClone(flat)];
      style.roof.overhang = range(0, 0.12);
      style.materials.roof.choices = material('membrane');
      style.palettes.regional_roof = palette(['#a9aaa0', '#bab8a9']);
    }
    style.facade.bays.width = range(shed ? 5.5 : family.bay, shed ? 7 : family.bay + 0.25);
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
    if (family.shutters && home) style.facade.details.shutters = true;
    if (family.balcony && type === 'apartments')
      style.facade.details.balconies = { depth: family.balcony, railing: 'open', every: 2 };
    if (family.awning && !shed) style.facade.details.awnings = { depth: family.awning };
    if (family.veranda && type === 'detached')
      style.facade.details.veranda = { depth: family.veranda, columns: true };
    if (type === 'attached') style.roof.overhang = range(0.1, 0.25);
    const path = `styles/regional/${family.id}/${type}.archstyle.json`;
    pack.styles[style.id] = path;
    await write(path, style);
  }
  const use = (type, when) => ({ when, style: id(family.id, type) });
  const residential = [...classes.detached, ...classes.attached];
  // Type-specific rules precede context guesses. A school in a residential block stays a school.
  const rules = [
    // A caller's explicit named architectural precedent remains available in every region.
    ...explicitStyles,
    ...['industrial', 'farm', 'civic', 'commercial'].map((type) =>
      use(type, { class: classes[type] }),
    ),
    use('apartments', { class: ['apartments', 'dormitory'] }),
    use('apartments', { class: residential, levelsMin: 4 }),
    use('apartments', { class: residential, heightMin: 12 }),
    use('attached', { class: classes.attached }),
    use('detached', { class: classes.detached }),
    use('apartments', { class: ['yes', 'building'], contextClass: ['residential'], levelsMin: 4 }),
    use('apartments', { class: ['yes', 'building'], contextClass: ['residential'], heightMin: 12 }),
    use('industrial', { class: ['yes', 'building'], contextClass: ['industrial'] }),
    use('commercial', { class: ['yes', 'building'], contextClass: ['commercial', 'retail'] }),
    use('detached', { class: ['yes', 'building'], contextClass: ['residential'], areaMax: 400 }),
    use('apartments', { class: ['yes', 'building'], contextClass: ['residential'], areaMin: 400 }),
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
    styles: architectureFamilies.length * Object.keys(sources).length,
    profiles: catalog.profiles.length,
  }),
);
