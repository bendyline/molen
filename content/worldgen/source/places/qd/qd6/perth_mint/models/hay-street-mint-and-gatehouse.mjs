import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  extrude,
  facade,
  fbox,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  ashlar: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.97 },
  trim: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.95 },
  footing: { slot: 'foundation', graph: 'stone_granite', roughness: 0.98 },
  tile: { slot: 'roof', graph: 'tile_flat', roughness: 0.94 },
  wood: { slot: 'trim', graph: 'wood_painted_lap', roughness: 0.91 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.87 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.62 },
};

const ashlar = rgb('bcaa8b'),
  pale = rgb('d7c5a1'),
  white = rgb('d8d1be'),
  terra = rgb('ac684c');
const terraDark = rgb('975942'),
  base = rgb('8f8573'),
  dark = rgb('555850'),
  green = rgb('596153');
const F = facade(site.frame.origin, site.frame.along);
const faces = (ring) => ring.map((p, i) => wallFace(p, ring[(i + 1) % ring.length]));

function at(f, u, d) {
  const [x, , z] = f.P(u, 0, d);
  return [x, z];
}

function rect(f, u, d, U, D) {
  return outwardRing([at(f, u, d), at(f, U, d), at(f, U, D), at(f, u, D)]);
}

function panel(out, slot, f, u, U, y, Y, d, color) {
  quad4(out, slot, f.P(u, y, d), f.P(U, y, d), f.P(U, Y, d), f.P(u, Y, d), color);
}

function capCourt(out, slot, outline, holes, y, color) {
  if (!holes.length) {
    cap(out, slot, outline, y, color);
    return;
  }
  const mesh = new MeshBufferBuilder();
  const material = 'palette:#ffffff';
  if (
    !mesh.addCap(
      'roof',
      material,
      outline,
      holes,
      () => y,
      [0, 1, 0],
      (p) => p,
      color,
    )
  )
    throw new Error('Could not triangulate the mint factory roof around its court');
  const { positions, indices } = mesh.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const points = Array.from(indices.slice(i, i + 3), (j) => positions.slice(j * 3, j * 3 + 3));
    out.addTriangle(
      slot,
      material,
      points,
      [0, 1, 0],
      points.map(([x, , z]) => [x, z]),
      color,
    );
  }
}

function wallBlock(out, ring, y, Y, slot = 'ashlar', color = ashlar) {
  extrude(out, slot, ring, y, Y, color, { top: false });
  cap(out, slot, ring, Y, color);
}

function hip(out, f, u, d, U, D, y, Y, insetU, insetD) {
  const low = rect(f, u, d, U, D),
    high = rect(f, u + insetU, d + insetD, U - insetU, D - insetD);
  const p = ([x, z], h) => [x, h, z];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    quad4(
      out,
      'tile',
      p(low[i], y),
      p(low[j], y),
      p(high[j], Y),
      p(high[i], Y),
      i % 2 === 0 ? terra : terraDark,
    );
  }
  cap(out, 'tile', high, Y, terra);
}

function chimney(out, f, u, d, y, detail) {
  const shaft = rect(f, u - 0.42, d - 0.46, u + 0.42, d + 0.46);
  wallBlock(out, shaft, y, y + 2.21, 'trim', terraDark);
  wallBlock(
    out,
    rect(f, u - 0.58, d - 0.59, u + 0.58, d + 0.59),
    y + 2.14,
    y + 2.39,
    'tile',
    terra,
  );
  if (detail > 1) {
    const c = at(f, u, d);
    lathe(
      out,
      'tile',
      c,
      [
        [y + 2.39, 0.26, 0.26],
        [y + 2.84, 0.217, 0.217],
        [y + 2.93, 0.27, 0.27],
      ],
      8,
      terraDark,
    );
  }
}

function aperture(out, f, u, span, y, spring, top, depth, back, detail) {
  const points = roundArch(span, [4, 6, 9, 12][detail]);
  for (let i = 0; i < points.length - 1; i++) {
    const [a, ha] = points[i],
      [b, hb] = points[i + 1];
    const A = f.P(u + a, spring + ha, depth),
      B = f.P(u + b, spring + hb, depth);
    quad4(out, 'ashlar', A, B, f.P(u + b, top, depth), f.P(u + a, top, depth), ashlar);
    quad4(out, 'trim', f.P(u + a, spring + ha, back), f.P(u + b, spring + hb, back), B, A, pale);
    quad4(
      out,
      'ashlar',
      f.P(u + a, top, back),
      f.P(u + b, top, back),
      f.P(u + b, spring + hb, back),
      f.P(u + a, spring + ha, back),
      ashlar,
    );
    if (detail > 0)
      quad4(
        out,
        'trim',
        f.P(u + a, spring + ha, depth + 0.05),
        f.P(u + b, spring + hb, depth + 0.05),
        f.P(u + b * 1.12, spring + hb + 0.11, depth + 0.1),
        f.P(u + a * 1.12, spring + ha + 0.11, depth + 0.1),
        pale,
      );
  }
  quad4(
    out,
    'trim',
    f.P(u - span, y, depth),
    f.P(u - span, y, back),
    f.P(u - span, spring, back),
    f.P(u - span, spring, depth),
    pale,
  );
  quad4(
    out,
    'trim',
    f.P(u + span, y, back),
    f.P(u + span, y, depth),
    f.P(u + span, spring, depth),
    f.P(u + span, spring, back),
    pale,
  );
}

function col(out, f, u, d, y, Y, r, detail) {
  const profile =
    detail < 2
      ? [
          [y, r],
          [Y, r],
        ]
      : [
          [y, r * 1.15],
          [y + 0.19, r * 1.15],
          [y + 0.27, r],
          [Y - 0.21, r],
          [Y - 0.09, r * 1.27],
          [Y, r * 1.27],
        ];
  lathe(
    out,
    'trim',
    at(f, u, d),
    profile.map(([y, r]) => [y, r, r]),
    [4, 6, 8, 12][detail],
    white,
  );
}

function factory(out, detail) {
  for (const [ring, ...holes] of site.shell) {
    const outer = outwardRing(ring);
    extrude(out, 'ashlar', outer, -1.85, 9.97, ashlar, { holes, top: false });
    capCourt(out, 'tile', outer, holes, 9.97, terraDark);
    if (!detail) continue;
    for (const face of [
      ...faces(outer),
      ...holes.flatMap((h) => faces(outwardRing(h).reverse())),
    ]) {
      if (face.length < 1.75) continue;
      const n = Math.max(1, Math.round(face.length / 4.17));
      for (let i = 0; i < n; i++) {
        const u = (face.length * (i + 0.5)) / n;
        for (const y of [1.45, 5.12]) {
          const w = Math.min(0.89, (face.length / n) * 0.29);
          panel(out, 'glass', face, u - w, u + w, y, y + 2.25, 0.028, dark);
          if (detail > 1) {
            panel(out, 'trim', face, u - w - 0.09, u + w + 0.09, y - 0.11, y, 0.15, pale);
            panel(out, 'wood', face, u - 0.042, u + 0.042, y, y + 2.25, 0.048, white);
          }
        }
      }
      panel(out, 'trim', face, 0, face.length, 9.82, 9.98, 0.08, pale);
    }
  }

  // Separate the long factory ranges and leave the mapped service court clear.
  hip(out, F, 0.6, -43.03, 50.25, -27.21, 9.97, 12.67, 4.1, 6.1);
  hip(out, F, -1.22, -79.73, 37.74, -44.23, 9.97, 13.32, 5.0, 15.4);
  hip(out, F, 40.21, -57.88, 54.62, -44.17, 9.97, 12.88, 4.7, 5.12);
}

function galleries(out, u, U, detail) {
  const step = (U - u) / 3;
  for (let i = 0; i <= 3; i++) {
    const a = u + i * step;
    const left = Math.max(u, a - 0.29),
      right = Math.min(U, a + 0.29);
    fbox(out, 'ashlar', F, left, right, 1.07, 5.44, -0.61, 0.08, ashlar);
    col(out, F, a, -0.15, 5.66, 8.42, 0.133, detail);
  }
  for (let i = 0; i < 3; i++) {
    const a = u + (i + 0.5) * step;
    aperture(out, F, a, step / 2 - 0.29, 1.07, 3.76, 5.44, 0.04, -0.6, detail);
  }
  fbox(out, 'trim', F, u, U, 5.32, 5.69, -3.46, 0.33, pale, { bottom: true });
  fbox(out, 'wood', F, u, U, 6.37, 6.48, -0.04, 0.18, white);
  if (detail > 1) {
    for (let i = 0; i < 16; i++) {
      const a = u + ((U - u) * (i + 0.5)) / 16;
      panel(out, 'wood', F, a - 0.052, a + 0.052, 5.69, 6.37, 0.18, white);
    }
  } else panel(out, 'wood', F, u, U, 5.72, 6.33, 0.08, pale);
}

function pavilion(out, u, U, detail) {
  const mid = (u + U) / 2,
    w = 1.9;
  fbox(out, 'ashlar', F, u, mid - w, 1.06, 5.83, -0.9, 0.18, ashlar);
  fbox(out, 'ashlar', F, mid + w, U, 1.06, 5.83, -0.9, 0.18, ashlar);
  aperture(out, F, mid, w, 1.06, 3.67, 5.83, 0.18, -0.86, detail);
  fbox(out, 'ashlar', F, u, U, 5.83, 13.84, -0.62, 0.18, ashlar);
  panel(out, 'metal', F, mid - 1.2, mid + 1.2, 1.06, 4.62, -3.32, green);
  for (const y of [5.88, 9.43, 13.45])
    fbox(out, 'trim', F, u - 0.09, U + 0.09, y, y + 0.24, -0.19, 0.42, pale);
  if (!detail) return;
  for (const y of [6.29, 10.07]) {
    for (let i = 0; i < 6; i++) {
      const p = u + ((U - u) * (i + 0.5)) / 6;
      const fa = facade(at(F, 0, 0.18), F.along);
      opening(out, fa, p, y, 1.03, 2.78, {
        head: 'round',
        glass: dark,
        frame: pale,
        frameWidth: detail > 1 ? 0.105 : 0,
        frameSlot: 'trim',
        frameDepth: 0.14,
        mullions: detail > 2 ? 1 : 0,
        sill: detail > 1,
      });
      if (i > 0 && detail > 1)
        col(out, F, p - (U - u) / 12, 0.31, y - 0.04, y + 2.82, 0.127, detail);
    }
  }
}

function mainFront(out, detail) {
  for (const [
    i,
    {
      range: [u, U],
      eaves,
      top,
    },
  ] of site.hipped.entries()) {
    const middle = i === 2,
      gallery = i === 1 || i === 3;
    const w = U - u;
    const box = rect(F, u, -15.41, U, gallery || middle ? -3.4 : 0.015);
    wallBlock(out, box, -1.75, eaves);
    hip(out, F, u - 0.22, -16.03, U + 0.22, 0.35, eaves, top, Math.min(w * 0.38, 3.43), 5.92);
    if (gallery) galleries(out, u, U, detail);
    else if (middle) {
      pavilion(out, u, U, detail);
      if (detail > 0) chimney(out, F, U - 1.63, -10.23, top - 0.24, detail);
    } else {
      for (const y of [1.4, 5.65, 9.99]) panel(out, 'trim', F, u, U, y, y + 0.18, 0.059, pale);
      if (detail > 0) {
        for (const fraction of [0.24, 0.5, 0.76]) {
          const p = u + w * fraction;
          for (const y of [2.79, 6.69]) {
            panel(out, 'glass', F, p - 0.58, p + 0.58, y, y + 2.64, 0.027, dark);
            panel(out, 'trim', F, p - 0.73, p + 0.73, y - 0.13, y, 0.108, pale);
          }
        }
        if (i === 0) chimney(out, F, u + w * 0.52, -10.91, top - 0.48, detail);
      }
    }
  }
}

function gatehouse(out, detail) {
  const G = wallFace(site.gate[1], site.gate[0]),
    w = G.length,
    depth = 6.08;
  const u = w / 2,
    half = 1.54,
    bottom = -1.56,
    spring = 0.88,
    top = 3.22;
  fbox(out, 'ashlar', G, 0, u - half, bottom, top, -depth, 0, ashlar);
  fbox(out, 'ashlar', G, u + half, w, bottom, top, -depth, 0, ashlar);
  aperture(out, G, u, half, bottom, spring, top, 0, -depth, detail);
  hip(out, G, -0.36, -depth - 0.35, w + 0.36, 0.32, top, 5.19, 2.41, 2.62);
  if (detail > 0) {
    const a = at(G, u - 1.19, -3.43),
      b = at(G, u + 1.19, -3.43),
      H = wallFace(b, a);
    panel(out, 'metal', H, 0.03, H.length - 0.03, bottom + 0.11, bottom + 0.25, 0, dark);
    if (detail > 1) {
      for (let i = 0; i < 8; i++) {
        const x = (H.length * (i + 0.5)) / 8;
        panel(out, 'metal', H, x - 0.018, x + 0.018, bottom + 0.16, bottom + 1.48, 0, dark);
      }
    }
    chimney(out, G, w * 0.73, -3.66, 4.88, detail);
  }
  cap(out, 'footing', rect(G, 0, -depth, w, 0), bottom, base);
}

function build(out, detail) {
  factory(out, detail);
  mainFront(out, detail);
  gatehouse(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
