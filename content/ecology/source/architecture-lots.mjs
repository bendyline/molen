// Relative frequencies of reusable plans, independent of materials and facade variants.
// These are construction priors for invented lots, never changes to mapped footprints.
const garages = ['north_american', 'northeastern', 'australian', 'oceanian', 'south_african'];
const courtyards = [
  'arid',
  'levantine',
  'aegean',
  'rif',
  'sahelian',
  'tuscan',
  'mediterranean',
  'south_asian',
  'latin',
  'andean',
  'brazilian',
  'southern_cone',
];
const compact = ['east_asian', 'sinic', 'southeast_asian', 'lowland', 'atlantic', 'cotswold'];
const masonryYards = ['southwestern', 'east_asian', ...courtyards, 'sinic'];
const timberYards = [
  'north_american',
  'northeastern',
  'oceanian',
  'australian',
  'northern',
  'tropical_timber',
  'east_slavic',
  'alpine',
];

export function architectureLotPlans(family, type) {
  const choices = (weights) =>
    Object.entries(weights).map(([shape, weight]) => ({ shape, weight }));
  if (type === 'commercial') return choices({ shopfront: 1 });
  if (type === 'attached') return choices({ compact: 5, cottage: 1 });
  if (type !== 'detached') return undefined;
  if (family === 'southwestern')
    return choices({ 'front-garage': 5, ranch: 4, 'side-garage': 3, courtyard: 2, cottage: 1 });
  if (garages.includes(family))
    return choices({ 'front-garage': 4, 'side-garage': 3, cottage: 4, ranch: 3 });
  if (courtyards.includes(family))
    return choices({ courtyard: 5, ranch: 2, cottage: 2, compact: 2 });
  if (compact.includes(family)) return choices({ compact: 5, cottage: 3, courtyard: 2 });
  return choices({ cottage: 5, ranch: 3, courtyard: 1, compact: 2 });
}

// How a family lays out the lots it invents along a street where no building is mapped: the
// share of blocks built as rows (fronts wall to wall at the street), how many fronts to 16 m of
// frontage, how far back they stand, how deep and how tall they are, and the share of frontages
// left open. A family with no entry builds houses in yards, as a North American suburb does.
// Photographs of the towns these stand for show street walls, not yards: a Moroccan medina, a
// terrace in Bath, the tube houses of Hanoi, a Mexican street of continuous fronts.
const row = (share, units, setback, depth, levels, gap = 0.08) => ({
  rows: share,
  units: { min: units[0], max: units[1] },
  setback: { min: setback[0], max: setback[1] },
  depth: { min: depth[0], max: depth[1] },
  levels: { min: levels[0], max: levels[1] },
  gap,
});
const patterns = {
  // Japanese lots fill their frontage close to the street, house by house.
  east_asian: { compact: true },
  atlantic: row(0.65, [2, 3], [1, 3.5], [8, 10], [2, 2]),
  cotswold: row(0.55, [2, 3], [0.5, 2.5], [7, 9], [2, 2]),
  lowland: row(0.85, [2, 3], [0, 1.5], [9, 12], [2, 4]),
  french: row(0.55, [2, 2], [0, 2], [9, 12], [2, 3]),
  continental: row(0.45, [1, 2], [0, 3], [10, 13], [2, 3]),
  alpine: row(0.2, [1, 2], [1, 3], [10, 13], [2, 3]),
  northern: row(0.2, [1, 2], [1, 3], [9, 12], [2, 3]),
  northeastern: row(0.35, [2, 3], [1, 3], [10, 14], [2, 3]),
  mediterranean: row(0.7, [2, 3], [0, 0.8], [8, 12], [2, 3]),
  tuscan: row(0.8, [2, 3], [0, 0.5], [8, 12], [2, 4]),
  aegean: row(0.8, [2, 3], [0, 0.6], [6, 9], [1, 2], 0.12),
  rif: row(0.85, [2, 3], [0, 0.4], [7, 10], [2, 3]),
  arid: row(0.85, [2, 2], [0, 0.5], [9, 13], [1, 3], 0.1),
  levantine: row(0.75, [1, 2], [0, 1.5], [10, 14], [2, 4]),
  sahelian: row(0.7, [1, 2], [0, 0.6], [8, 12], [1, 1], 0.2),
  south_asian: row(0.85, [2, 3], [0, 0.8], [9, 14], [2, 4]),
  // Tube houses: a third of a frontage wide and three times as deep.
  southeast_asian: row(0.8, [3, 3], [0, 1.2], [13, 18], [2, 4]),
  sinic: row(0.65, [2, 3], [0, 1.5], [9, 13], [2, 4]),
  latin: row(0.75, [2, 2], [0, 0.4], [9, 13], [1, 2]),
  andean: row(0.7, [2, 2], [0, 0.5], [8, 12], [1, 2]),
  brazilian: row(0.55, [2, 2], [0, 2], [9, 13], [1, 2]),
  southern_cone: row(0.6, [2, 2], [0, 2], [10, 14], [1, 2]),
  // Compounds more than streets: a few rows along the market road, single-storey.
  tropical_masonry: row(0.3, [1, 2], [0.5, 3], [7, 10], [1, 1], 0.25),
};
export function architectureLotPattern(family) {
  return patterns[family];
}

// Keep open yards in every pool. Only a known synthetic lot may receive a boundary treatment.
export function architectureLotFences(family, type) {
  if (type !== 'detached') return undefined;
  const weights = masonryYards.includes(family)
    ? { none: 4, masonry: 5, rail: 1 }
    : timberYards.includes(family)
      ? { none: 4, timber: 5, rail: 1 }
      : { none: 5, timber: 2, masonry: 1, rail: 2 };
  return Object.entries(weights).map(([kind, weight]) => ({ kind, weight }));
}
