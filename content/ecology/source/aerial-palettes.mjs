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
  ['#e6e6e2', 5],
  ['#d3d4d0', 4],
  ['#b9bab6', 3],
  ['#9b9d9d', 2],
  ['#74777b', 1],
  ['#b0a693', 1],
];
// Dust settles on Delhi's flat concrete roofs and water tanks: Sentinel-2 frames read them a
// warm mid grey-brown rather than the pale membranes of a North American downtown.
const dustyRoofs = [
  ['#a59b88', 3],
  ['#968d7e', 3],
  ['#b6ad9b', 2],
  ['#7f786d', 1],
  ['#c4bba9', 1],
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
  // Glazed and metal roofs catch the sky: Kyoto's GSI mosaic reads as a silver-grey field.
  if (family === 'east_asian' && home)
    return [
      ['#7c8185', 4],
      ['#8f9395', 4],
      ['#a3a6a6', 3],
      ['#686f75', 2],
      ['#b6b8b5', 2],
      ['#857a6e', 1],
    ];
  return undefined;
}
