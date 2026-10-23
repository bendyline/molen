/** 'N0748_ART': mapped narrow Art Museum gallery and deep courtyard portal. */
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildYadArt(face, detail, r) {
  const Y = r.floorY,
    E = r.entryX,
    F = r.frontZ;
  const P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]];
  const f = (role, ps, n) => face(role, ps.map(P), P(n));
  const poly = (outline) => ({ outline, holes: [] });
  prism(f, 'floor', poly(r.outer), r.foundationY, Y, true);
  // The notch is cut out of the real wall mass, not drawn as a dark rectangle.
  for (const p of r.body) prism(f, 'concrete', p, Y, Y + 6.8, true);
  box(f, 'concrete', E, Y + 4.2, (r.entryBackZ + F) / 2, 3.8, 2.6, F - r.entryBackZ);
  // Metal rear and side returns leave a traversable recessed entrance volume.
  box(f, 'metal', E, Y + 0.03, r.entryBackZ + 0.04, 3.76, 4.12, 0.08);
  box(f, 'metal', E - 1.85, Y + 0.03, (r.entryBackZ + F) / 2, 0.08, 4.12, F - r.entryBackZ);
  box(f, 'metal', E + 1.85, Y + 0.03, (r.entryBackZ + F) / 2, 0.08, 4.12, F - r.entryBackZ);
  box(f, 'glass', E + 1.796, Y + 0.04, 3.65, 0.025, 2.65, 1.65);
  // A low folded ceiling gives the vestibule its photographed shallow peak.
  f(
    'metal',
    [
      [E - 1.81, Y + 3.85, 2.78],
      [E, Y + 4.13, 2.78],
      [E, Y + 4.13, F - 0.02],
      [E - 1.81, Y + 3.85, F - 0.02],
    ],
    [0, -1, 0],
  );
  f(
    'metal',
    [
      [E, Y + 4.13, 2.78],
      [E + 1.81, Y + 3.85, 2.78],
      [E + 1.81, Y + 3.85, F - 0.02],
      [E, Y + 4.13, F - 0.02],
    ],
    [0, -1, 0],
  );
  // Close the folded ceiling to the lintel and returns; no floating sheet edges.
  for (const [z, nz] of [
    [2.78, -1],
    [F - 0.02, 1],
  ]) {
    for (const sign of [-1, 1]) {
      f(
        'metal',
        [
          [E, Y + 4.13, z],
          [E + sign * 1.81, Y + 3.85, z],
          [E + sign * 1.81, Y + 4.2, z],
          [E, Y + 4.2, z],
        ],
        [0, 0, nz],
      );
    }
  }
  f(
    'metal',
    [
      [E - 1.81, Y + 4.2, 2.78],
      [E + 1.81, Y + 4.2, 2.78],
      [E + 1.81, Y + 4.2, F - 0.02],
      [E - 1.81, Y + 4.2, F - 0.02],
    ],
    [0, 1, 0],
  );
  for (const sign of [-1, 1]) {
    f(
      'metal',
      [
        [E + sign * 1.81, Y + 3.85, 2.78],
        [E + sign * 1.81, Y + 3.85, F - 0.02],
        [E + sign * 1.81, Y + 4.2, F - 0.02],
        [E + sign * 1.81, Y + 4.2, 2.78],
      ],
      [sign, 0, 0],
    );
  }
  // The unseen roof uses a restrained shared flat-roof treatment, not invented gardens.
  for (const p of r.roofField) prism(f, 'roof', p, Y + 6.805, Y + 6.86, true);
  if (detail) {
    box(f, 'concrete', 0, Y + 6.8, F - 0.2, 45.2, 0.35, 0.35);
    box(f, 'concrete', 0, Y + 6.8, -4.35, 44.5, 0.35, 0.35);
    // Plain colour banner keeps the wayfinding accent without reproducing an artwork.
    box(f, 'banner', E - 3.2, Y + 0.18, F + 0.04, 0.7, 4.6, 0.07);
    box(f, 'floor', E - 3.2, Y + 3.7, F + 0.085, 0.7, 0.35, 0.02);
    box(f, 'metal', E + 1.76, Y + 0.05, 2.84, 0.08, 2.65, 0.08);
    box(f, 'metal', E + 1.76, Y + 0.05, 4.46, 0.08, 2.65, 0.08);
    box(f, 'metal', E + 1.76, Y + 2.65, 3.65, 0.08, 0.1, 1.7);
    if (detail >= 2) {
      box(f, 'metal', E + 1.76, Y + 0.08, 3.65, 0.08, 2.57, 0.08);
      box(f, 'metal', E + 1.7, Y + 1.1, 3.65, 0.08, 0.08, 1.7);
      // Sparse broad panel seams inside the vestibule, omitted at district distance.
      for (const x of [E - 1.2, E + 0.55]) box(f, 'metal', x, Y + 0.1, 2.795, 0.075, 3.7, 0.025);
    }
    if (detail === 3) {
      // Four small recessed downlight housings; no emissive glare or baked lighting.
      for (const x of [E - 0.9, E + 0.9])
        for (const z of [3.1, 4.4]) box(f, 'floor', x, Y + 3.97, z, 0.18, 0.08, 0.18);
      box(f, 'metal', E + 1.69, Y + 0.98, 3.3, 0.09, 0.45, 0.08);
      box(f, 'metal', E + 1.69, Y + 0.98, 4.0, 0.09, 0.45, 0.08);
    }
  }
}
