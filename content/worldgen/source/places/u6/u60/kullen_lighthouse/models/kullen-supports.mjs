/** Plausible mounting details for previously disconnected exterior parts; not surveyed hardware. */
import { ring } from '../../../../../../../../packages/worldgen/scripts/lighthouse-expansion-models.mjs';
import { buildKullen } from '../../../../../../../../packages/worldgen/scripts/lighthouse-kullen-lizard-models.mjs';
import {
  lathe,
  transformed,
} from '../../../../../../../../packages/worldgen/scripts/lighthouse-models.mjs';
import { box, tube } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const white = [0.87, 0.88, 0.84],
  dark = [0.065, 0.075, 0.071],
  stone = [0.59, 0.55, 0.455];

export function porchGroundContact(out) {
  box(out, 'ashlar', [3.12, 0, -1.01], [6.4, 0.1, 1.66], [0.41, 0.405, 0.345]);
  box(out, 'granite', [3.16, 0, -2.5], [5.01, 0.02, -1.01], stone);
}

export function opticMount(out, { sides = 8, extendCheeks = false } = {}) {
  for (let f = 0; f < 3; f++) {
    const o = transformed(out, (f * Math.PI * 2) / 3);
    box(o, 'metal', [-1.34, 9.81, 0.82], [1.34, 9.91, 1.01], dark);
    tube(o, 'metal', [0, 9.86, 0], [0, 9.86, 0.92], 0.045, white, sides);
    if (extendCheeks)
      for (const x of [-1.3, 1.3])
        tube(o, 'metal', [x, 9.52, 0.86], [x, 9.7, 0.86], 0.032, dark, 10);
  }
}

export function buildSupportedKullen(out) {
  buildKullen(out);
  // The original rail radius is 2.28m, outside the old 2.18m platform.
  ring(out, 'metal', 9.46, 2.18, 2.42, 0.12, white, 160);
  // Join the weather mast into the upper drum/platform instead of leaving its foot in air.
  tube(out, 'metal', [0.93, 9.46, -1.48], [0.93, 10, -1.48], 0.025, white, 10);
  lathe(
    transformed(out, 0, [6.15, 0, -0.77]),
    'granite',
    [
      [2.94, 0.38],
      [2.97, 0.38],
    ],
    stone,
    64,
  );
  box(out, 'wood', [3, 3.18, -1.15], [6.58, 3.2, 1.73], [0.37, 0.225, 0.13]);
  porchGroundContact(out);
  opticMount(out, { extendCheeks: true });
}
