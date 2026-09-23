// Bind the default structure library to broad geographic precedents. These are visual priors,
// never claims about the age/style of an individual mapped building. Explicit styles win.
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatJson } from '../../worldgen/scripts/format-json.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(
  await readFile(resolve(root, '../../content/worldgen/structures/catalog.json'), 'utf8'),
);
const path = resolve(root, '../../content/earth/world.atlas.json');
const atlas = JSON.parse(await readFile(path, 'utf8'));
const homes = new Set(['house', 'bungalow', 'cabin', 'farmhouse', 'townhouse']);
const residential = [
  'house',
  'detached',
  'semidetached',
  'residential',
  'bungalow',
  'cabin',
  'terrace',
  'townhouse',
  'townhouses',
  'farmhouse',
];
const variants = (entries) => entries.map((entry) => ({ style: entry.style, weight: 1 }));
const inCountries = (codes) =>
  catalog.entries.filter((entry) => entry.countries.some((code) => codes.includes(code)));
const rulesFor = (entries) => {
  const homeEntries = entries.filter((entry) => homes.has(entry.type) && entry.levels <= 3);
  const rules = [];
  if (homeEntries.length) {
    const base = homeEntries[0].style;
    rules.push({
      when: { class: residential, levelsMin: 4 },
      style: 'molen.worldgen.generic.house',
    });
    rules.push({
      when: { class: ['yes', 'building'], contextClass: ['residential'], levelsMin: 4 },
      style: 'molen.worldgen.generic.house',
    });
    rules.push({
      when: { class: residential, notClass: ['apartments', 'dormitory'], hasHeight: false },
      style: base,
      variants: variants(homeEntries),
    });
    rules.push({
      when: {
        class: ['yes', 'building'],
        contextClass: ['residential'],
        hasHeight: false,
        areaMax: 700,
      },
      style: base,
      variants: variants(homeEntries),
    });
  }
  for (const type of [...new Set(entries.map((entry) => entry.type))].filter(
    (type) => !homes.has(type),
  )) {
    const options = entries.filter((entry) => entry.type === type);
    rules.push({ when: { class: [type] }, style: options[0].style, variants: variants(options) });
  }
  return rules;
};
// Higher-priority small regions take precedence over broader continental envelopes.
const regions = [
  ['north_america', 'North America', [-169, 24, -52, 73], ['US', 'CA'], 1],
  ['mexico', 'Mexico', [-118, 14, -86, 33], ['MX'], 5],
  ['caribbean', 'Caribbean', [-86, 10, -58, 24], ['CU', 'BB', 'TT'], 5],
  ['colombia', 'Colombia', [-79, -4, -66, 13], ['CO'], 5],
  ['andes', 'Central Andean highlands', [-82, -23, -57, 1], ['PE', 'BO'], 4],
  ['chile', 'Chile', [-76, -56, -66, -17], ['CL'], 5],
  ['brazil', 'Brazil', [-74, -34, -34, 6], ['BR'], 3],
  ['britain', 'Britain', [-8, 50, 2, 60], ['GB'], 5],
  ['ireland', 'Ireland', [-11, 51, -5, 56], ['IE'], 6],
  ['nordic', 'Nordic countries', [4, 54, 32, 71], ['NO', 'SE', 'FI', 'DK'], 3],
  ['iceland', 'Iceland', [-25, 63, -13, 67], ['IS'], 5],
  ['baltic', 'Baltic countries', [21, 53, 29, 60], ['EE', 'LV', 'LT'], 5],
  ['france', 'France', [-5, 42, 8, 51], ['FR'], 4],
  ['low_countries', 'Low Countries', [2.5, 49.5, 7.3, 54], ['NL', 'BE'], 6],
  ['germany', 'Germany', [6, 47, 15.5, 55], ['DE'], 5],
  ['alps', 'Alpine region', [6, 45, 17, 48.5], ['CH', 'AT'], 6],
  ['italy', 'Italy', [7, 36, 19, 46], ['IT'], 5],
  ['iberia', 'Iberian Peninsula', [-10, 36, 4, 44], ['ES', 'PT'], 5],
  ['greece', 'Greece', [19, 34, 29, 42], ['GR'], 6],
  [
    'eastern_europe',
    'Eastern Europe',
    [14, 44, 40, 55],
    ['PL', 'CZ', 'RO', 'UA', 'BG', 'RS', 'SK'],
    3,
  ],
  ['adriatic', 'Adriatic coast', [13, 42, 19, 46], ['HR'], 6],
  ['maghreb', 'Northwest Africa', [-14, 27, 12, 37], ['MA', 'TN'], 4],
  ['anatolia', 'Anatolia', [26, 36, 45, 42], ['TR'], 6],
  ['caucasus', 'Caucasus', [40, 40, 47, 44], ['GE'], 7],
  ['levant', 'Levant', [34, 29, 39, 35], ['LB', 'PS', 'JO'], 6],
  ['iran', 'Iran', [44, 25, 64, 40], ['IR'], 5],
  ['arabia', 'Arabian Peninsula', [39, 12, 60, 30], ['YE', 'BH', 'AE', 'QA'], 4],
  ['west_africa', 'West Africa', [-18, 4, 17, 20], ['ML', 'NE', 'GH', 'SN'], 3],
  ['east_africa', 'East Africa', [28, -12, 52, 15], ['KE', 'TZ', 'UG', 'ET'], 3],
  ['south_africa', 'Southern Africa', [16, -35, 33, -22], ['ZA'], 3],
  ['madagascar', 'Madagascar', [43, -26, 51, -11], ['MG'], 4],
  ['south_asia', 'South Asia', [60, 5, 93, 37], ['IN', 'BD', 'NP', 'BT', 'LK', 'PK'], 3],
  ['china', 'China', [74, 18, 135, 54], ['CN'], 2],
  ['korea', 'Korean peninsula', [124, 33, 130, 43], ['KR'], 7],
  ['taiwan', 'Taiwan', [119, 21, 123, 26], ['TW'], 7],
  [
    'mainland_southeast_asia',
    'Mainland Southeast Asia',
    [92, 5, 110, 24],
    ['TH', 'VN', 'KH', 'LA'],
    5,
  ],
  ['maritime_southeast_asia', 'Maritime Southeast Asia', [95, -11, 141, 6], ['MY', 'SG', 'ID'], 4],
  ['philippines', 'Philippines', [116, 5, 127, 20], ['PH'], 6],
  ['australia', 'Australia', [112, -44, 154, -10], ['AU'], 4],
  ['new_zealand', 'New Zealand', [166, -48, 179, -34], ['NZ'], 5],
  ['fiji', 'Fiji', [176, -21, 180, -15], ['FJ'], 5],
  ['pacific', 'South Pacific', [-176, -25, -130, -8], ['TO', 'CK', 'PF'], 4],
];
atlas.regions = atlas.regions.filter((region) => !region.id.startsWith('library.'));
const supplements = {
  'us.pnw': ['craftsman', 'prairie', 'ranch'],
  'us.southwest': ['ranch'],
  jp: ['kyoto_machiya', 'gassho_farmhouse'],
};
for (const region of atlas.regions) {
  const ids = supplements[region.id];
  if (!ids) continue;
  for (const rule of region.bindings.buildings) {
    // Measured geometry and taller residential blocks retain the existing region recipe.
    delete rule.variants;
  }
  const base = region.bindings.buildings[0].style;
  const pool = [
    { style: base, weight: 4 },
    ...ids.map((id) => ({ style: `molen.worldgen.catalog.${id}`, weight: 1 })),
  ];
  // Stable idempotent augmentation: remove previously generated low-rise rules first.
  region.bindings.buildings = region.bindings.buildings.filter(
    (rule) => rule.when?.hasHeight !== false && rule.when?.levelsMin !== 4,
  );
  region.bindings.buildings.unshift({
    when: { class: residential, notClass: ['apartments', 'dormitory'], hasHeight: false },
    style: base,
    variants: pool,
  });
  region.bindings.buildings.splice(1, 0, {
    when: {
      class: ['yes', 'building'],
      contextClass: ['residential'],
      hasHeight: false,
      areaMax: 700,
    },
    style: base,
    variants: pool,
  });
  region.bindings.buildings.unshift({ when: { class: residential, levelsMin: 4 }, style: base });
  region.bindings.buildings.splice(1, 0, {
    when: { class: ['yes', 'building'], contextClass: ['residential'], levelsMin: 4 },
    style: base,
  });
}
for (const [id, title, bbox, countries, priority] of regions) {
  const buildings = rulesFor(inCountries(countries));
  if (buildings.length)
    atlas.regions.push({ id: `library.${id}`, title, priority, bbox, bindings: { buildings } });
}
atlas.default.buildings = rulesFor(
  catalog.entries.filter(
    (entry) => entry.style.startsWith('molen.worldgen.catalog.') && entry.region === 'global',
  ),
);
atlas.version = 3;
// Conservative climate priors: unclassified regions do not acquire inferred canopy.
atlas.default.treeFillFactor = 0;
for (const region of atlas.regions) {
  const fill = { 'us.pnw': 0.9, 'us.southwest': 0, jp: 0.3 }[region.id];
  if (fill !== undefined) region.bindings.treeFillFactor = fill;
}
atlas.doc =
  'The default 120-structure library supplies deterministic regional architectural variety. Broad geographic envelopes and documented precedents are visual priors, not surveyed building identities. Explicit styles and source dimensions win; unmeasured low-rise residential features use stable weighted variants. Existing regional and worldwide fallbacks remain available.';
const output = execFileSync(
  process.execPath,
  [
    resolve(root, '../../node_modules/@biomejs/biome/bin/biome'),
    'format',
    '--stdin-file-path',
    path,
  ],
  { input: `${formatJson(atlas)}\n`, encoding: 'utf8' },
);
if (process.argv.includes('--check')) {
  if ((await readFile(path, 'utf8')) !== output)
    throw new Error(
      'Structure atlas is stale: run node packages/worldgen-earth/scripts/generate-structure-atlas.mjs',
    );
} else await writeFile(path, output);
console.log(`Structure atlas: ${atlas.regions.length} regions.`);
