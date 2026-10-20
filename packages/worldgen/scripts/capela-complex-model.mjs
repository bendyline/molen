/** 'N0546': connected São Francisco host shell and specific bone chapel. */
import { normalFor } from './authored-structure-mesh.mjs';
import { openingBuilder, prepareOpening } from './authored-wall-openings.mjs';
import { buildCapelaInterior } from './capela-interior-model.mjs';
import { box, loft, prism, rect } from './khmer-structure-geometry.mjs';

export function buildCapelaComplex(face, detail, r, sampleTerrain) {
  const a = r.architecturalAngleRadians,
    c = Math.cos(a),
    s = Math.sin(a),
    h = r.host,
    p = r.chapel,
    F = h.floorY,
    grade = (x, z) => sampleTerrain(c * x - s * z, s * x + c * z),
    f = (role, ps, n) => {
      if (detail === 0 && n[1] < -0.5) return;
      face(
        role,
        ps.map(([x, y, z]) => [c * x - s * z, y, s * x + c * z]),
        [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]],
      );
    },
    cut = (holes) => {
      const out = openingBuilder(
        { addTriangle: (role, _ref, ps, n) => f(role, ps, n) },
        holes.map((h) => prepareOpening(h, 0, detail)),
      );
      return (role, ps, n) => {
        for (let i = 1; i < ps.length - 1; i++) {
          const t = [ps[0], ps[i], ps[i + 1]];
          if (Math.hypot(...normalFor(...t)) > 0.5)
            out.addTriangle(role, 'palette:#ffffff', t, n, [], []);
        }
      };
    };
  // The exact occupied host outline, with explicit empty room and access corridor.
  prism(f, 'wall', h.polygon, h.baseY, F + 0.08);
  const naveDoor = {
      center: [-44, -27],
      axis: [0, 1],
      depth: 3,
      shape: 'round',
      width: 2.8,
      bottom: F + 0.1,
      height: 4.7,
      spring: 3.3,
    },
    window = {
      center: [-44, -27],
      axis: [0, 1],
      depth: 2,
      shape: 'round',
      width: 5.5,
      bottom: F + 12,
      height: 5.1,
      spring: 3.2,
    },
    nave = cut([naveDoor, window]),
    lower = cut([naveDoor]);
  for (const polygon of h.lowerPolygons) prism(lower, 'plaster', polygon, F + 0.08, F + 8.5);
  for (const polygon of h.navePolygons) prism(nave, 'wall', polygon, F + 0.08, F + h.eave);
  box(f, 'inset', -43.2, F + 0.1, -27, 0.08, 4.7, 2.8);
  box(f, 'inset', -43.2, F + 12, -27, 0.08, 5.1, 5.5);
  function roof(x0, x1, z0, z1, eave, ridge, alongZ = false) {
    if (alongZ) {
      const mid = (x0 + x1) / 2;
      f(
        'roof',
        [
          [x0, eave, z0],
          [mid, ridge, z0],
          [mid, ridge, z1],
          [x0, eave, z1],
        ],
        [-0.5, 1, 0],
      );
      f(
        'roof',
        [
          [mid, ridge, z0],
          [x1, eave, z0],
          [x1, eave, z1],
          [mid, ridge, z1],
        ],
        [0.5, 1, 0],
      );
      f(
        'plaster',
        [
          [x0, eave, z0],
          [x1, eave, z0],
          [mid, ridge, z0],
        ],
        [0, 0, -1],
      );
      f(
        'plaster',
        [
          [x0, eave, z1],
          [x1, eave, z1],
          [mid, ridge, z1],
        ],
        [0, 0, 1],
      );
    } else {
      const mid = (z0 + z1) / 2;
      f(
        'roof',
        [
          [x0, eave, z0],
          [x1, eave, z0],
          [x1, ridge, mid],
          [x0, ridge, mid],
        ],
        [0, 1, -0.5],
      );
      f(
        'roof',
        [
          [x0, ridge, mid],
          [x1, ridge, mid],
          [x1, eave, z1],
          [x0, eave, z1],
        ],
        [0, 1, 0.5],
      );
      f(
        'wall',
        [
          [x0, eave, z0],
          [x0, eave, z1],
          [x0, ridge, mid],
        ],
        [-1, 0, 0],
      );
      f(
        'wall',
        [
          [x1, eave, z0],
          [x1, eave, z1],
          [x1, ridge, mid],
        ],
        [1, 0, 0],
      );
    }
  }
  roof(-44, 14.5, -38, -16, F + h.eave, F + h.ridge);
  roof(-6.4, 6, -1.7, 20.2, p.floorY + 6.65, p.floorY + 8.25, true);
  roof(-7.1, 6.6, 20.3, 39.2, F + 8.5, F + 10.6, true);
  // North chapel ranges and western connecting white ranges are approximate roof divisions.
  roof(-26.6, 14.7, -46, -38, F + 8.5, F + 10.6);
  roof(-41.6, -15.5, -16, -11.8, F + 8.5, F + 9.8);
  // Five true pointed portico bays inside the mapped west projection.
  const bays = Array.from({ length: 5 }, (_, i) => -35.8 + i * 4.4),
    holes = bays.map((z) => ({
      center: [-49.25, z],
      axis: [0, 1],
      depth: 2,
      shape: 'pointed',
      width: 3.5,
      bottom: F + 0.08,
      height: 6.8,
      spring: 3.6,
    })),
    portico = cut(holes);
  prism(portico, 'wall', rect(-49.23, -27, 0.55, 22.2), F + 0.08, F + 7.3);
  for (const z of [-38.15, -15.85]) box(f, 'wall', -46.8, F + 0.08, z, 5.4, 7.2, 0.4);
  box(f, 'trim', -46.8, F + 7.3, -27, 5.6, 0.35, 22.4);
  if (detail >= 1) {
    for (let i = 0; i <= 5; i++) {
      const z = -38 + i * 4.4;
      box(f, 'trim', -49.65, F + 0.08, z, 0.95, 7.8, 0.7);
      box(f, 'trim', -49.65, F + 2.3, z, 1.1, 0.2, 0.9);
      f(
        'trim',
        [
          [-50.2, F + 7.8, z - 0.5],
          [-49.1, F + 7.8, z - 0.5],
          [-49.65, F + 8.4, z - 0.5],
        ],
        [0, 0, -1],
      );
    }
    for (const z of [-38, -16]) {
      const count = detail === 1 ? 15 : 29;
      for (let i = 0; i < count; i++)
        box(f, 'trim', -43.7 + (i * 58) / (count - 1), F + h.eave, z, 0.62, 0.7, 0.6);
      box(f, 'trim', -14.7, F + h.eave - 0.2, z, 58.4, 0.25, 0.55);
    }
    const count = detail === 1 ? 9 : 17;
    for (let i = 0; i < count; i++) {
      const z = -38 + (i * 22) / (count - 1),
        top = F + h.eave + 3.7 * (1 - Math.abs((z + 27) / 11));
      box(f, 'trim', -44.15, top, z, 0.7, 0.65, 0.65);
    }
    for (let i = 0; i < 6; i++)
      for (const z of [-38.15, -15.85]) box(f, 'trim', -39 + i * 9.6, F + 8.4, z, 0.7, 12.7, 0.75);
    for (let i = 0; i < 5; i++) box(f, 'trim', -44.6, F + 12.1, -29.2 + i * 1.1, 0.25, 4.3, 0.08);
  }
  for (const z of [-38, -16]) {
    const x = -44.2,
      y = F + h.eave - 0.2;
    loft(
      f,
      'trim',
      x,
      z,
      [
        [y, 1.6],
        [y + 1.6, 1.6],
        [y + 3.8, 0.12],
      ],
      false,
      (w) =>
        Array.from({ length: detail === 0 ? 4 : 8 }, (_, i) => [
          (Math.cos((i * Math.PI * 2) / (detail === 0 ? 4 : 8)) * w) / 2,
          (Math.sin((i * Math.PI * 2) / (detail === 0 ? 4 : 8)) * w) / 2,
        ]),
    );
  }
  box(f, 'trim', -44.2, F + h.ridge, -27, 0.15, 1.35, 0.15);
  box(f, 'trim', -44.2, F + h.ridge + 0.82, -27, 0.15, 0.13, 0.8);
  if (detail >= 1) {
    for (const [x, z, w, d] of [
      [-35, -11.55, 2, 0],
      [-26, -11.55, 2, 0],
      [-17.1, -11.55, 1.7, 0],
      [6.69, 25.5, 0, 1.6],
      [6.69, 31.5, 0, 1.6],
      [6.69, 36.5, 0, 1.6],
    ]) {
      for (const Y of [F + 1.5, F + 5.2]) {
        box(f, 'inset', x, Y, z, w || 0.05, 1.8, d || 0.05);
        if (w) {
          box(f, 'trim', x, Y + 1.8, z, 2.2, 0.16, 0.15);
        } else box(f, 'trim', x, Y + 1.8, z, 0.15, 0.16, 1.9);
      }
    }
  }
  // Foyer floor and ceiling, reached from the west courtyard through a real opening.
  const V = r.vestibule,
    [vx0, vz0, vx1, vz1] = V.bounds;
  box(
    f,
    'floor',
    (vx0 + vx1) / 2,
    h.baseY,
    (vz0 + vz1) / 2,
    vx1 - vx0,
    p.floorY + 0.08 - h.baseY,
    vz1 - vz0,
  );
  box(
    f,
    'plaster',
    (vx0 + vx1) / 2,
    p.floorY + V.height,
    (vz0 + vz1) / 2,
    vx1 - vx0,
    0.25,
    vz1 - vz0,
  );
  for (const z of [vz0, vz1]) {
    if (z === vz1) continue;
    box(f, 'plaster', (vx0 + vx1) / 2, p.floorY + 0.08, z, vx1 - vx0, V.height, 0.25);
  }
  box(f, 'plaster', vx1, p.floorY + 0.08, (vz0 + vz1) / 2, 0.25, V.height, vz1 - vz0);
  // A short local approach accommodates the coarse city DEM without altering it.
  const ground = grade(vx0 - 2.5, (vz0 + vz1) / 2),
    N = detail === 0 ? 3 : 6;
  for (let i = 0; i < N; i++) {
    const x = vx0 - 2.5 + ((i + 0.5) * 2.5) / N,
      top = ground + ((p.floorY - ground) * (i + 1)) / N,
      low = Math.min(grade(x, (vz0 + vz1) / 2), ground) - 0.45;
    box(f, 'trim', x, low, (vz0 + vz1) / 2, 2.5 / N, top - low, 2.5);
  }
  buildCapelaInterior(f, detail, r);
}
