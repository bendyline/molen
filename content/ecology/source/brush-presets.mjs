// Structural habitat forms, not additional taxonomic or occurrence claims.
export function brushPlants(plant) {
  return [
    plant('shade_shrub', 'Open woodland multi-stem shrub', 'shrub', 'round', 2.4, 3.6, '#718b51', {
      stemRadius: 0.035,
    }),
    plant(
      'sclerophyll_thicket',
      'Dense dry evergreen thicket',
      'thicket',
      'round',
      2.1,
      4.2,
      '#89966b',
      { stemRadius: 0.045 },
    ),
    plant(
      'thorn_thicket',
      'Open thorny dryland tangle',
      'thicket',
      'branching',
      1.4,
      3.4,
      '#9b9f77',
      { stemRadius: 0.025 },
    ),
    plant('bramble', 'Arching leafy woodland tangle', 'thicket', 'branching', 1.6, 4, '#698348', {
      stemRadius: 0.025,
    }),
    plant(
      'tropical_shrub',
      'Humid broadleaf understory shrub',
      'shrub',
      'round',
      3.2,
      4.2,
      '#648b50',
      { stemRadius: 0.045 },
    ),
    plant(
      'broadleaf_herbs',
      'Broad-leaved forest herb colony',
      'forb',
      'paddle',
      1.1,
      2.8,
      '#789850',
      { stemRadius: 0.018, bark: '#98a967' },
    ),
    plant(
      'meadow_forbs',
      'Mixed meadow stalks and seed heads',
      'forb',
      'columnar',
      0.9,
      2.5,
      '#8eaa69',
      { stemRadius: 0.014, bark: '#b6aa78' },
    ),
    plant('dry_forbs', 'Sparse dryland herb stalks', 'forb', 'branching', 0.65, 2.3, '#aaa77b', {
      stemRadius: 0.012,
      bark: '#b5a17d',
    }),
    plant('sedge_patch', 'Wetland sedge tussock patch', 'grass', 'columnar', 0.95, 3.2, '#8da167', {
      patch: true,
      bark: '#ada779',
    }),
    plant('fern_colony', 'Overlapping humid forest ferns', 'fern', 'feather', 1.1, 3.6, '#709951', {
      patch: true,
    }),
    plant('moss_mat', 'Low moss and cushion vegetation', 'mat', 'round', 0.16, 3.4, '#819763', {
      bark: '#99a574',
    }),
    plant('leaf_litter', 'Loose broadleaf litter patch', 'mat', 'paddle', 0.12, 3.8, '#9b8c62', {
      bark: '#7d7155',
    }),
    plant('needle_litter', 'Low conifer litter hummocks', 'mat', 'paddle', 0.1, 3.8, '#9c906f', {
      bark: '#827751',
    }),
    plant(
      'ground_vine',
      'Trailing woodland groundcover',
      'vine',
      'branching',
      0.4,
      3.8,
      '#7b9657',
      { stemRadius: 0.014 },
    ),
    plant(
      'tropical_runner',
      'Tropical broadleaf ground runners',
      'vine',
      'branching',
      0.65,
      4.4,
      '#749b55',
      { stemRadius: 0.022 },
    ),
    plant(
      'fallen_log',
      'Fallen trunk with broken limbs',
      'fallenwood',
      'branching',
      0.75,
      4.5,
      '#91876b',
      { bark: '#89795f' },
    ),
    plant(
      'temperate_sapling',
      'Small woodland broadleaf sapling',
      'broadleaf',
      'columnar',
      3.4,
      2.4,
      '#80a15b',
      { crownBase: 0.18, stemRadius: 0.055 },
    ),
    plant(
      'boreal_sapling',
      'Small boreal conifer regeneration',
      'conifer',
      'columnar',
      2.5,
      1.7,
      '#6b875c',
      { crownBase: 0.1, stemRadius: 0.04 },
    ),
    plant(
      'tropical_sapling',
      'Small tropical broadleaf regeneration',
      'broadleaf',
      'round',
      4.2,
      3.6,
      '#789f55',
      { crownBase: 0.2, stemRadius: 0.06 },
    ),
    plant(
      'liana_canopy',
      'Humid canopy with supported trunk climbers',
      'broadleaf',
      'round',
      15,
      11,
      '#628b4d',
      { crownBase: 0.52, stemRadius: 0.4, climber: '#85a55a' },
    ),
  ];
}

export function brushComposition(name, surface) {
  const tropical = ['rainforest', 'asian_moist_forest', 'oceanic_tropical'].includes(name);
  const polar = ['tundra', 'montane_grassland', 'nz_tussock'].includes(name);
  const boreal = ['boreal', 'siberian_boreal'].includes(name);
  const wetland = name === 'mangrove' || name === 'flooded_grassland';
  const arid = surface === 'desert';
  const dry = surface === 'dry';
  if (name === 'ice') return { shrubs: [], floor: [], herbs: [], density: 0 };
  if (wetland) return { shrubs: [], floor: [], herbs: ['sedge_patch'], density: 0 };
  if (polar)
    return { shrubs: ['heath'], floor: ['moss_mat'], herbs: ['alpine_grass'], density: 100 };
  if (arid)
    return {
      shrubs: ['thorn_thicket'],
      floor: [],
      herbs: ['dry_forbs'],
      density: name === 'atacama' ? 8 : 90,
    };
  if (tropical)
    return {
      shrubs: [
        ['tropical_shrub', 5],
        ['tropical_sapling', 2],
      ],
      floor: [['leaf_litter', 4], 'tropical_runner', 'fallen_log'],
      herbs: [['fern_colony', 3], 'broadleaf_herbs'],
      density: 1100,
      climbers: true,
    };
  if (boreal)
    return {
      shrubs: [['heath', 4], 'boreal_sapling'],
      floor: [['needle_litter', 3], 'moss_mat', 'fallen_log'],
      herbs: ['alpine_grass'],
      density: 400,
    };
  if (dry)
    return {
      shrubs: [['sclerophyll_thicket', 4], 'thorn_thicket'],
      floor: ['leaf_litter', 'fallen_log'],
      herbs: ['dry_forbs'],
      density: 650,
    };
  return {
    shrubs: [['shade_shrub', 5], 'bramble', 'temperate_sapling'],
    floor: [['leaf_litter', 3], 'moss_mat', 'ground_vine', 'fallen_log'],
    herbs:
      surface === 'wet' ? [['fern_colony', 4], 'broadleaf_herbs'] : ['meadow_forbs', 'fern_colony'],
    density: surface === 'wet' ? 1000 : 750,
  };
}
