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
export function aerialRoofPalette(family, home) {
  if (family === 'southwestern')
    return [
      ['#c8c3b7', 5],
      ['#b7b7b0', 4],
      ['#b8a992', 3],
      ['#d2cbbd', 3],
      ['#a57860', 2],
    ];
  if (family === 'east_asian' && home)
    return [
      ['#62676b', 5],
      ['#777b7c', 4],
      ['#8b8d8b', 3],
      ['#555c62', 2],
      ['#82766a', 1],
    ];
  return undefined;
}
