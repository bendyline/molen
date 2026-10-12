/** Shabla's complete far silhouette, with shared graph means baked into its single draw. */
import { beam, loft, radialRing } from './authored-structure-mesh.mjs';
import { hipRoof } from './lighthouse-expansion-models.mjs';
import { lathe, panel, transformed } from './lighthouse-models.mjs';
import { SHABLA_HOUSE_CENTER, shablaBaseGallery } from './shabla-detail-model.mjs';
import { box, tube } from './structure-mesh.mjs';

export { buildShablaDistrict, buildShablaNear } from './shabla-detail-model.mjs';

const means = {
  plaster: [0.856015, 0.827728, 0.727643],
  ashlar: [0.687437, 0.660738, 0.602857],
  limestone: [0.7539, 0.710243, 0.616244],
  tiles: [0.559267, 0.552465, 0.529503],
  metal: [0.908889, 0.908889, 0.908889],
  granite: [0.701109, 0.701109, 0.701109],
  wood: [0.825128, 0.825128, 0.825128],
};
const dark = [0.085, 0.105, 0.11],
  white = [0.87, 0.86, 0.8],
  red = [0.61, 0.19, 0.135];
function tint(out) {
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
      k,
      (s, r, p, n, uv, c) =>
        out[k](
          s,
          r,
          p,
          n,
          uv,
          c.map((v, i) => v * (means[s]?.[i] ?? 1)),
        ),
    ]),
  );
}
export function buildShablaSkyline(destination) {
  const out = tint(destination),
    [cx, cz] = SHABLA_HOUSE_CENTER;
  box(out, 'plaster', [cx - 5.3, 0, cz - 5.96], [cx + 5.3, 3.8, cz + 5.96], white);
  hipRoof(out, cx, cz, 5.47, 6.12, 3.8, 1.15, [0.45, 0.35, 0.22]);
  for (const z of [-6.5, -10.5])
    box(
      out,
      'plaster',
      [cx - 3.88, 4.4, cz + 8.36 + z - 0.3],
      [cx - 3.28, 5.6, cz + 8.36 + z + 0.3],
      white,
    );
  box(out, 'ashlar', [-4.25, 0, -4.25], [4.25, 8.05, 4.25], white);
  box(out, 'ashlar', [-4.25, 8.05, -4.25], [4.25, 12.05, 4.25], red);
  box(out, 'limestone', [-4.32, 12.02, -4.32], [4.32, 12.23, 4.32], white);
  shablaBaseGallery(out, 3);
  for (const y of [1.15, 4.8]) panel(out, 'glass', -0.475, 0.475, y, y + 1.75, 4.26, dark);
  panel(transformed(out, Math.PI / 2), 'wood', -0.65, 0.65, 0.55, 2.8, 4.27, [0.25, 0.19, 0.13]);
  for (let i = 0; i < 3; i++)
    box(
      out,
      'granite',
      [4.25, i * 0.18, -1.5],
      [5.2 - i * 0.25, (i + 1) * 0.18, -0.25],
      [0.55, 0.54, 0.49],
    );
  const ys = [12.23, 14.3, 17.7, 20.6, 23.7, 26.4, 29.4],
    apothem = (y) => 2.94 - ((y - 12.23) * 1.02) / 17.17;
  for (let j = 0; j < 6; j++) {
    const lo = ys[j],
      hi = ys[j + 1];
    loft(
      out,
      'ashlar',
      [lo, hi].map((y) =>
        radialRing(
          y,
          apothem(y) / Math.cos(Math.PI / 8),
          apothem(y) / Math.cos(Math.PI / 8),
          8,
          [0, 0],
          Math.PI / 8,
        ),
      ),
      j % 2 ? red : white,
    );
    if (j % 2 === 0)
      panel(
        out,
        'glass',
        -0.265,
        0.265,
        lo + 0.38,
        lo + 0.38 + Math.min(1.5, hi - lo - 0.64),
        apothem(lo + 0.38) + 0.005,
        dark,
      );
  }
  loft(
    out,
    'limestone',
    [
      radialRing(29.4, 2.17, 2.17, 8, [0, 0], Math.PI / 8),
      radialRing(29.62, 2.29, 2.29, 8, [0, 0], Math.PI / 8),
    ],
    white,
  );
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4,
      b = ((i + 1) * Math.PI) / 4;
    const p = [Math.cos(a) * 2.09, 29.63, Math.sin(a) * 2.09],
      q = [Math.cos(b) * 2.09, 30.39, Math.sin(b) * 2.09];
    beam(out, 'metal', p, [p[0], 30.39, p[2]], 0.055, 0.055, dark);
    beam(out, 'metal', [p[0], 30.39, p[2]], q, 0.05, 0.05, dark);
  }
  lathe(
    out,
    'metal',
    [
      [29.64, 1.15],
      [29.95, 1.15],
    ],
    white,
    8,
  );
  lathe(
    out,
    'glass',
    [
      [29.95, 0.98],
      [31.07, 0.98],
    ],
    [0.25, 0.32, 0.33],
    8,
  );
  lathe(
    out,
    'metal',
    [
      [31.08, 1.13],
      [31.18, 1.14],
      [31.45, 0.7],
      [31.62, 0.14],
    ],
    dark,
    8,
  );
  tube(out, 'metal', [0, 31.62, 0], [0, 32, 0], 0.027, dark, 4);
}
