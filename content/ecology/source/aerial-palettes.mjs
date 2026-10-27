// Photo-review priors, not measured city quotas. Shared by the regional style generator.
// Weights are independent for walls and roofs; mapped/landmark appearances remain authoritative.
export const urbanWalls = [
  ['#d2cec5', 5],
  ['#b8bfc4', 4],
  ['#ddd6c6', 3],
  ['#9eacb8', 3],
  ['#e3e0d8', 3],
  ['#8f9397', 2],
  ['#a9b3a7', 1],
  ['#ae8b78', 1],
];
export const towerWalls = [
  ['#b8bfc4', 5],
  ['#9eacb8', 5],
  ['#d2cec5', 4],
  ['#ddd6c6', 3],
  ['#8f9397', 3],
  ['#76848d', 2],
  ['#a8634b', 1],
];
// Flat commercial, civic, tower and shed roofs over the membrane texture. Matched orthophotos of
// Seattle, Bellevue and Sydney show white and pale grey membranes first, then grey decks,
// gravel ballast and a few dark ones; two warm greys read as one beige city from the air.
export const flatRoofs = [
  ['#ecece8', 7],
  ['#dadbd7', 4],
  ['#c0c1bd', 3],
  ['#9b9d9d', 2],
  ['#74777b', 1],
  ['#b5ab98', 1],
];
// Dust settles on Delhi's flat concrete roofs and water tanks: Sentinel-2 frames read them a
// warm mid grey-brown rather than the pale membranes of a North American downtown.
const dustyRoofs = [
  ['#a8987c', 3],
  ['#988a73', 3],
  ['#b8a88d', 2],
  ['#82786a', 1],
  ['#c6b79c', 1],
];
export function aerialFlatRoofPalette(family) {
  return family === 'south_asian' ? dustyRoofs : flatRoofs;
}
export function aerialRoofPalette(family, home) {
  if (family === 'south_asian' && home) return dustyRoofs;
  if (family === 'southwestern')
    return [
      ['#c8c3b7', 5],
      ['#b7b7b0', 4],
      ['#b8a992', 3],
      ['#d2cbbd', 3],
      ['#a57860', 2],
    ];
  // Glazed and metal roofs catch the sky: Kyoto's GSI mosaic reads as a silver-grey field, and
  // half-meter crops put residential roofs at a median grey of 155 (sRGB).
  if (family === 'east_asian' && home)
    return [
      ['#999ea3', 4],
      ['#adb1b3', 4],
      ['#bfc2c2', 3],
      ['#80868c', 2],
      ['#cfd1ce', 2],
      ['#978d82', 1],
    ];
  return undefined;
}
