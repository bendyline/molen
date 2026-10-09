// Authored regional crop mixtures are visual priors, not surveyed agricultural statistics.
// Source crop tags and retrieved classifications take precedence in the runtime adapter.
const cropId = (name) => `molen.ecology.crop.${name}`;
const plantId = (name) => `molen.ecology.plant.${name}`;
const annuals = [
  ['maize', 'Corn / maize rows', 'maize', 2.5, '#87a34c', '#b5ac6d'],
  ['soybean', 'Soybean rows', 'broadleaf', 0.85, '#83a65c', '#b6a166'],
  ['wheat', 'Wheat and small cereal rows', 'cereal', 1.05, '#a4b473', '#c9b56f'],
  ['rice', 'Rice rows', 'rice', 1.1, '#8faa61', '#bdae68'],
  ['cotton', 'Cotton rows', 'cotton', 1.15, '#90a56c', '#bba772'],
  ['sugarcane', 'Sugarcane rows', 'cane', 3, '#82a460', '#b9a878'],
  ['sunflower', 'Sunflower rows', 'sunflower', 1.8, '#8caa56', '#b39a56'],
  ['rapeseed', 'Oilseed crop rows', 'broadleaf', 1.15, '#a8b56d', '#c6b35f'],
  ['root_crop', 'Root and vegetable crop beds', 'roots', 0.5, '#8aab62', '#a79d64'],
  ['sorghum', 'Sorghum and millet rows', 'cereal', 1.65, '#a2ad69', '#b4a073'],
];
export function agriculturePlants(plant) {
  return annuals.map(([name, title, cropKind, height, foliage, bark]) =>
    plant(name, title, 'crop', 'columnar', height, 3.2, foliage, {
      cropKind,
      bark,
      stemRadius: 0.015,
      crownBase: 0,
      lean: 0,
      patch: true,
    }),
  );
}
const aliases = {
  maize: ['maize', 'corn'],
  soybean: ['soybean', 'soybeans', 'soya'],
  wheat: ['wheat', 'barley', 'rye', 'oats', 'cereals', 'cereal'],
  rice: ['rice', 'paddy'],
  cotton: ['cotton'],
  sugarcane: ['sugarcane', 'sugar_cane'],
  sunflower: ['sunflower', 'sunflowers'],
  rapeseed: ['rapeseed', 'canola'],
  root_crop: ['potato', 'potatoes', 'sugar_beet', 'sugarbeet', 'vegetables'],
  sorghum: ['sorghum', 'millet'],
};
export function agricultureCrops() {
  const result = annuals.map(([name, , , , color, ripe]) => ({
    id: cropId(name),
    aliases: aliases[name],
    model: plantId(name),
    variants: ['', '.spreading', '.slender'].map((suffix) => plantId(name) + suffix),
    kind: 'annual',
    spacing: name === 'rice' ? 0.8 : 1.15,
    interval: 3.2,
    color,
    soil: '#b0a07d',
    ripe,
    sowingMonth: name === 'wheat' ? 10 : name === 'rice' ? 5 : 4,
    growingMonths: name === 'wheat' ? 9 : name === 'sugarcane' ? 10 : 6,
  }));
  for (const [name, model, cropAliases, kind, spacing, interval, color] of [
    ['olive', 'olive', ['olives', 'olive', 'olive_trees'], 'orchard', 8, 7, '#a2ae7a'],
    [
      'fruit',
      'fruit_tree',
      ['fruit', 'apple', 'apples', 'pear', 'pears', 'citrus', 'oranges', 'almonds'],
      'orchard',
      8,
      8,
      '#99ad70',
    ],
    ['dates', 'date_palm', ['dates', 'date_palms'], 'orchard', 9, 9, '#b9b180'],
    ['coconut', 'coconut', ['coconuts', 'coconut_palms'], 'orchard', 9, 9, '#9dac73'],
    ['oil_palm', 'oil_palm', ['oil_palms', 'oil_palm'], 'orchard', 9, 8, '#96a76d'],
    ['coffee', 'coffee', ['coffee', 'coffea'], 'orchard', 3, 2.5, '#9baa70'],
    ['tea', 'tea', ['tea'], 'orchard', 2.4, 1.8, '#96aa68'],
    ['banana', 'banana', ['banana', 'bananas', 'banana_plants'], 'orchard', 4, 4, '#a0b279'],
    ['rubber', 'rubber', ['rubber', 'rubber_trees'], 'orchard', 8, 6, '#9aa775'],
    ['grapes', 'grapevine', ['grapes', 'grapevines', 'vineyard'], 'vineyard', 3, 2, '#b1ab79'],
    [
      'pasture',
      'grass',
      ['pasture', 'hay', 'grass', 'alfalfa', 'clover'],
      'pasture',
      2,
      3,
      '#95ab69',
    ],
    ['fallow', 'dry_grass', ['fallow', 'idle', 'bare_soil'], 'fallow', 3, 4, '#b6a681'],
  ])
    result.push({
      id: cropId(name),
      aliases: cropAliases,
      model: plantId(model),
      variants: ['', '.spreading', '.slender'].map((suffix) => plantId(model) + suffix),
      kind,
      spacing,
      interval,
      color,
      soil: '#b0a07d',
      ripe: color,
      sowingMonth: 4,
      growingMonths: 6,
    });
  return result;
}
const mix = (...entries) => entries.map(([name, weight]) => ({ crop: cropId(name), weight }));
export function agricultureForHabitat(name) {
  let crops = mix(['maize', 5], ['soybean', 3], ['wheat', 2], ['pasture', 1]);
  let orchards = mix(['fruit', 1]);
  let tropical = false;
  if (/boreal|siberian|tundra|montane|steppe/.test(name))
    crops = mix(['wheat', 5], ['pasture', 3], ['rapeseed', 1], ['root_crop', 1]);
  if (/desert|sonoran|atacama|arid/.test(name)) {
    crops = mix(['wheat', 3], ['cotton', 2], ['sorghum', 3], ['fallow', 2]);
    orchards = mix(['dates', 3], ['olive', 1]);
  }
  if (/mediterranean|chaparral|fynbos|heath/.test(name)) {
    crops = mix(['wheat', 4], ['olive', 3], ['grapes', 2], ['sunflower', 1]);
    orchards = mix(['olive', 4], ['fruit', 2]);
  }
  if (/rainforest|dry_forest|tropical|savanna|mangrove|flooded/.test(name)) {
    tropical = true;
    crops = mix(['maize', 4], ['sugarcane', 2], ['rice', 2], ['root_crop', 2]);
    orchards = mix(['banana', 3], ['coffee', 2], ['oil_palm', 2], ['coconut', 1]);
  }
  if (/african_savanna/.test(name))
    crops = mix(['sorghum', 5], ['maize', 3], ['cotton', 1], ['pasture', 2]);
  if (/asian_moist|east_asian/.test(name)) {
    crops = mix(['rice', 5], ['wheat', 2], ['maize', 2], ['root_crop', 1]);
    orchards = mix(['fruit', 4], ['tea', 2]);
  }
  if (/australian|nz_|southern_beech/.test(name)) {
    crops = mix(['pasture', 5], ['wheat', 3], ['rapeseed', 1], ['sugarcane', 1]);
    orchards = mix(['fruit', 4], ['grapes', 1]);
  }
  return { crops, orchards, tropical };
}

// Natural vegetation is not a crop calendar. These independent authored priors refine the
// generic habitat channel, using the already-shipped atlas rather than another download.
export function agricultureOverrides(regions) {
  const profile = (name, title, match, crops, orchards, tropical = false, priority = 80) => ({
    id: `molen.ecology.agriculture.${name}`,
    title,
    match,
    priority,
    agriculture: { crops: mix(...crops), orchards: mix(...orchards), tropical },
  });
  const zone = (name, title, names, crops, orchards, tropical = false) => {
    const ecoregions = names.map((name) => {
      const region = regions.find((region) => region.name === name);
      if (!region) throw new Error(`Unknown agricultural ecoregion: ${name}`);
      return region.id;
    });
    return profile(name, title, { ecoregions }, crops, orchards, tropical, 100);
  };
  return [
    profile(
      'south_asian_lowland',
      'South and Southeast Asian agricultural prior',
      { realms: ['Indomalayan'], biomes: [1, 2, 7, 9] },
      [
        ['rice', 6],
        ['sugarcane', 2],
        ['maize', 2],
        ['root_crop', 1],
      ],
      [
        ['banana', 3],
        ['oil_palm', 3],
        ['coconut', 2],
        ['rubber', 2],
      ],
      true,
    ),
    profile(
      'european_temperate',
      'Palearctic temperate agricultural prior',
      { realms: ['Palearctic'], biomes: [4] },
      [
        ['wheat', 5],
        ['rapeseed', 2],
        ['maize', 2],
        ['sunflower', 1],
        ['pasture', 2],
      ],
      [['fruit', 1]],
    ),
    profile(
      'african_moist',
      'African moist agricultural prior',
      { realms: ['Afrotropic'], biomes: [1, 2] },
      [
        ['maize', 5],
        ['root_crop', 3],
        ['rice', 1],
        ['sugarcane', 1],
      ],
      [
        ['banana', 3],
        ['coffee', 2],
        ['oil_palm', 2],
      ],
      true,
    ),
    zone(
      'corn_belt',
      'North American tallgrass agricultural prior',
      ['Central Tallgrass prairie', 'Northern Tallgrass prairie', 'Southern Great Lakes forests'],
      [
        ['maize', 6],
        ['soybean', 4],
        ['wheat', 1],
        ['pasture', 1],
      ],
      [['fruit', 1]],
    ),
    zone(
      'cerrado_pampas',
      'South American grain and oilseed agricultural prior',
      ['Cerrado', 'Humid Pampas'],
      [
        ['soybean', 5],
        ['maize', 4],
        ['wheat', 1],
        ['sugarcane', 1],
        ['pasture', 2],
      ],
      [
        ['fruit', 2],
        ['coffee', 1],
      ],
      true,
    ),
    zone(
      'indus_gangetic',
      'Indus and Gangetic agricultural prior',
      [
        'Indus Valley desert',
        'Lower Gangetic Plains moist deciduous forests',
        'Upper Gangetic Plains moist deciduous forests',
        'Terai-Duar savanna and grasslands',
      ],
      [
        ['rice', 5],
        ['wheat', 4],
        ['cotton', 2],
        ['sugarcane', 2],
      ],
      [
        ['fruit', 2],
        ['dates', 1],
      ],
      true,
    ),
    zone(
      'east_asian_lowland',
      'East Asian lowland agricultural prior',
      [
        'Huang He Plain mixed forests',
        'Northeast China Plain deciduous forests',
        'Manchurian mixed forests',
        'Sichuan Basin evergreen broadleaf forests',
      ],
      [
        ['rice', 4],
        ['wheat', 3],
        ['maize', 3],
        ['soybean', 2],
      ],
      [
        ['fruit', 3],
        ['tea', 1],
      ],
    ),
    zone(
      'east_african_highland',
      'East African highland agricultural prior',
      [
        'East African montane forests',
        'Albertine Rift montane forests',
        'Eastern Arc forests',
        'Ethiopian montane forests',
      ],
      [
        ['maize', 5],
        ['root_crop', 2],
        ['wheat', 2],
        ['sorghum', 1],
      ],
      [
        ['coffee', 3],
        ['tea', 3],
        ['banana', 1],
      ],
      true,
    ),
    zone(
      'australian_wheatbelt',
      'Australian grain and pasture agricultural prior',
      ['Murray-Darling woodlands and mallee', 'Eastern Australian temperate forests'],
      [
        ['wheat', 5],
        ['rapeseed', 2],
        ['pasture', 4],
      ],
      [
        ['fruit', 3],
        ['grapes', 2],
      ],
    ),
    zone(
      'australian_tropical',
      'Australian subtropical agricultural prior',
      ['Brigalow tropical savanna'],
      [
        ['sorghum', 3],
        ['sugarcane', 3],
        ['cotton', 2],
        ['pasture', 3],
      ],
      [['fruit', 1]],
      true,
    ),
  ];
}
