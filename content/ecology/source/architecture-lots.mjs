// Relative frequencies of reusable plans, independent of materials and facade variants.
// These are construction priors for invented lots, never changes to mapped footprints.
export function architectureLotPlans(family, type) {
  const choices = (weights) =>
    Object.entries(weights).map(([shape, weight]) => ({ shape, weight }));
  if (type === 'commercial') return choices({ shopfront: 1 });
  if (type === 'attached') return choices({ compact: 5, cottage: 1 });
  if (type !== 'detached') return undefined;
  if (family === 'southwestern')
    return choices({ 'front-garage': 5, ranch: 4, 'side-garage': 3, courtyard: 2, cottage: 1 });
  if (family === 'north_american' || family === 'australasian')
    return choices({ 'front-garage': 4, 'side-garage': 3, cottage: 4, ranch: 3 });
  if (family === 'arid' || family === 'mediterranean' || family === 'south_asian')
    return choices({ courtyard: 5, ranch: 2, cottage: 2, compact: 2 });
  if (family === 'east_asian' || family === 'southeast_asian')
    return choices({ compact: 5, cottage: 3, courtyard: 2 });
  return choices({ cottage: 5, ranch: 3, courtyard: 1, compact: 2 });
}

// Keep open yards in every pool. Only a known synthetic lot may receive a boundary treatment.
export function architectureLotFences(family, type) {
  if (type !== 'detached') return undefined;
  const weights = ['southwestern', 'arid', 'mediterranean', 'south_asian', 'east_asian'].includes(
    family,
  )
    ? { none: 4, masonry: 5, rail: 1 }
    : ['north_american', 'oceanian', 'northern', 'tropical_timber'].includes(family)
      ? { none: 4, timber: 5, rail: 1 }
      : { none: 5, timber: 2, masonry: 1, rail: 2 };
  return Object.entries(weights).map(([kind, weight]) => ({ kind, weight }));
}
