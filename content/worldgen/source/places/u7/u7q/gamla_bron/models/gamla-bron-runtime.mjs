/** Authored browser LODs; detailed source master remains in gamla-bron-model.mjs. */
import {
  beam,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box, tube } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const steel = [0.6, 0.66, 0.63],
  dark = [0.29, 0.35, 0.34],
  stone = [0.36, 0.36, 0.32],
  wood = [0.32, 0.3, 0.25];
const half = 150.5,
  span = 30.1,
  deck = 5.8;

function ring(x, y, steps) {
  const points = [],
    radius = 1.85,
    straight = 2.35;
  for (const sign of [1, -1])
    for (let i = 0; i <= steps; i++) {
      const a = (sign === 1 ? 0 : Math.PI) + (i / steps) * Math.PI;
      points.push([x + Math.cos(a) * radius, y, sign * straight + Math.sin(a) * radius]);
    }
  return points.reverse();
}

// A continuous closed rectangular chord saves the internal end faces of separate beams.
function chord(out, points, z, width, depth) {
  const rings = points.map(([x, y]) => [
    [x, y + depth / 2, z - width / 2],
    [x, y + depth / 2, z + width / 2],
    [x, y - depth / 2, z + width / 2],
    [x, y - depth / 2, z - width / 2],
  ]);
  loft(out, 'steel', rings, steel);
}

function build(out, level) {
  const far = level === 0,
    close = level === 3,
    street = level >= 2,
    segments = [3, 6, 10, 10][level];
  // One closed deck at far/street distances, transverse boards only for the close view.
  if (close)
    for (let x = -half; x < half; x += 0.56)
      box(out, 'wood', [x, deck - 0.14, -3.15], [Math.min(half, x + 0.554), deck, 3.15], wood);
  else box(out, far ? 'steel' : 'wood', [-half, deck - 0.14, -3.15], [half, deck, 3.15], wood);
  for (const z of street ? [-3.05, -1.5, 0, 1.5, 3.05] : [])
    beam(out, 'steel', [-half, 5.33, z], [half, 5.33, z], 0.22, 0.52, dark);
  if (street)
    for (let x = -half; x <= half; x += span / (close ? 10 : 5))
      beam(out, 'steel', [x, 5.1, -3.25], [x, 5.1, 3.25], 0.16, 0.32, dark);
  for (let bay = 0; bay < 10; bay++) {
    const start = -half + bay * span;
    const points = Array.from({ length: segments + 1 }, (_, i) => [
      start + (i / segments) * span,
      deck + 0.12 + 3.38 * 4 * (i / segments) * (1 - i / segments),
    ]);
    for (const sign of [-1, 1]) {
      const z = sign * 2.83;
      chord(out, points, z, 0.24, 0.29);
      if (!far)
        for (let i = 1; i < segments; i++) {
          if (!street && i % 2 === 0) continue;
          const [x, y] = points[i];
          beam(out, 'steel', [x, deck + 0.06, z], [x, y, z], 0.1, 0.14, steel);
        }
      if (street)
        for (let i = 0; i < segments; i++) {
          const a = points[i],
            b = points[i + 1];
          beam(
            out,
            'steel',
            i < segments / 2 ? [a[0], deck + 0.04, z] : [a[0], a[1], z],
            i < segments / 2 ? [b[0], b[1], z] : [b[0], deck + 0.04, z],
            0.07,
            0.095,
            steel,
          );
          if (close)
            for (const [x, y] of [a, [a[0], deck + 0.13]])
              box(
                out,
                'steel',
                [x - 0.2, y - 0.2, z - 0.032],
                [x + 0.2, y + 0.2, z + 0.032],
                steel,
              );
        }
    }
  }
  // Rounded masonry, separate open trestles; no solid wall filling the river spans.
  for (let i = 1; i < 10; i++) {
    const x = -half + i * span;
    if (far) box(out, 'steel', [x - 1.85, 0, -4.2], [x + 1.85, 2.57, 4.2], stone);
    else {
      loft(out, 'stone', [ring(x, 0, street ? 8 : 4), ring(x, 2.35, street ? 8 : 4)], stone);
      loft(
        out,
        'stone',
        [ring(x, 2.35, street ? 8 : 4), ring(x, 2.57, street ? 8 : 4)],
        stone.map((v) => v + 0.02),
      );
      if (close)
        for (let y = 0.335; y < 2.34; y += 0.335) {
          const p = ring(x, y, 8);
          for (let j = 0; j < p.length; j++)
            tube(
              out,
              'stone',
              p[j],
              p[(j + 1) % p.length],
              0.012,
              stone.map((v) => v + 0.06),
              4,
            );
        }
    }
    for (const dx of far ? [0] : [-1.25, 1.25])
      for (const z of [-2.85, 2.85]) {
        beam(out, 'steel', [x + dx, 2.57, z], [x + dx, 5.11, z], far ? 0.36 : 0.28, 0.31, steel);
        if (street)
          for (const y of [2.65, 5.02])
            box(
              out,
              'steel',
              [x + dx - 0.3, y - 0.08, z - 0.32],
              [x + dx + 0.3, y + 0.08, z + 0.32],
              dark,
            );
      }
    if (!far)
      for (const dir of [-1, 1])
        beam(
          out,
          'steel',
          [x - 1.25, 2.83, dir * 2.85],
          [x - 1.25, 4.94, -dir * 2.85],
          0.13,
          0.12,
          steel,
        );
    if (street)
      for (const z of [-2.85, 2.85])
        for (const dir of [-1, 1])
          beam(
            out,
            'steel',
            [x + dir * 1.25, 2.83, z],
            [x - dir * 1.25, 4.94, z],
            0.11,
            0.11,
            steel,
          );
    if (street)
      tube(
        out,
        'pole',
        [x + 0.55, 2.54, 3.61],
        [x + 0.55, 14.2, 3.61],
        0.09,
        [0.59, 0.54, 0.43],
        close ? 12 : 8,
      );
    if (close && i < 9)
      for (let j = 0; j < 8; j++) {
        const p = (t) => [x + 0.55 + span * t, 13.61 - 0.55 * 4 * t * (1 - t), 3.19];
        tube(out, 'steel', p(j / 8), p((j + 1) / 8), 0.014, dark, 4);
      }
  }
  if (!far) {
    // The ESE utility main is an identity feature, kept even in the district view.
    tube(out, 'steel', [-half, 4.45, 3.03], [half, 4.45, 3.03], 0.41, dark, close ? 16 : 8);
    if (street) {
      tube(out, 'steel', [-half, 4.45, -2.95], [half, 4.45, -2.95], 0.12, dark, 8);
      for (let i = 1; i < 10; i++) {
        const x = -half + i * span;
        for (const dir of [-1, 1])
          beam(
            out,
            'steel',
            [x + 1.25, 2.83, dir * 2.85],
            [x + 1.25, 4.94, -dir * 2.85],
            0.13,
            0.12,
            steel,
          );
        for (const dx of [-1.25, 1.25])
          for (const y of [2.85, 4.76])
            beam(out, 'steel', [x + dx, y, -2.85], [x + dx, y, 2.85], 0.16, 0.16, steel);
      }
    }
    if (street)
      for (let x = -half + 2; x < half; x += span / 5) {
        tube(out, 'steel', [x - 0.05, 4.45, 3.03], [x + 0.05, 4.45, 3.03], 0.445, dark, 8);
        beam(out, 'steel', [x, 5.05, 3.03], [x, 4.03, 3.03], 0.07, 0.07, steel);
      }
    for (const sign of [-1, 1]) {
      const z = sign * 3.23;
      for (const h of street ? [0.34, 0.75, 1.17] : [1.17])
        beam(out, 'steel', [-154.5, deck + h, z], [154.5, deck + h, z], 0.047, 0.055, steel);
      if (street)
        for (let x = -154.5; x <= 154.5; x += close ? 1.505 : 3.01)
          beam(out, 'steel', [x, deck, z], [x, deck + 1.2, z], 0.053, 0.055, steel);
      if (close)
        for (let x = -half + 1.5; x < half; x += span / 4)
          box(
            out,
            'steel',
            [x - 0.16, deck + 0.65, z - 0.075],
            [x + 0.16, deck + 0.75, z + 0.075],
            dark,
          );
    }
  }
  for (const sign of [-1, 1]) {
    const x = sign * (half + 1.9);
    box(out, far ? 'steel' : 'stone', [x - 2.1, 0, -4.2], [x + 2.1, deck - 0.2, 4.2], stone);
    // A closed supported end pavement, continuous with the full deck.
    box(
      out,
      far ? 'steel' : 'stone',
      [x - 2.1, deck - 0.2, -3.35],
      [x + 2.1, deck, 3.35],
      [0.27, 0.28, 0.27],
    );
  }
}

function grain(out) {
  return {
    addQuad(component, ref, points, normal, uv, color) {
      if (component === 'pole' || (component === 'wood' && Math.abs(normal[1]) > 0.98)) {
        ref = 'metric:uv';
        uv = points.map((p) => (component === 'pole' ? [p[1], p[2]] : [p[2], p[0]]));
      }
      out.addQuad(component, ref, points, normal, uv, color);
    },
    addTriangle(...args) {
      out.addTriangle(...args);
    },
    addConvexPolygon(...args) {
      out.addConvexPolygon(...args);
    },
  };
}
export function buildGamlaSkyline(out) {
  build(grain(out), 0);
}
export function buildGamlaDistrict(out) {
  build(grain(out), 1);
}
export function buildGamlaStreet(out) {
  build(grain(out), 2);
}
export function buildGamlaCloseup(out) {
  build(grain(out), 3);
}
