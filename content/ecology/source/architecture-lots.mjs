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
