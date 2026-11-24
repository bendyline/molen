import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { withFootprintCaps } from '../../../../../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  extrude,
  facade,
  fan,
  fbox,
  gableRoof,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  spire,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_travertine', roughness: 0.94 },
  detail: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.91 },
  ochre: { slot: 'wall', graph: 'plaster_lime', roughness: 0.92 },
  lead: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.77, metallic: 0.12 },
  clay: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.94 },
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.94 },
  glass: { slot: 'trim', graph: 'metal_painted', roughness: 0.63 },
  wood: { slot: 'door', graph: 'wood_vertical', roughness: 0.94 },
};

const F = facade(site.frame.origin, site.frame.along),
  P = F.P;
const xz = ([x, , z]) => [x, z];
const pale = rgb('c5b9a2'),
  stone = rgb('b7ad96'),
  patina = rgb('a89a83'),
  ochre = rgb('c2a680');
const dark = rgb('625e54'),
  glass = rgb('515353'),
  wood = rgb('695543'),
  clay = rgb('a47154');
const lead = rgb('737f84'),
  warmBrick = rgb('906a59'),
  red = rgb('9e755f'),
  relief = rgb('c6bcab');
const box = (out, s, u, U, y, Y, d, D, c) => fbox(out, s, F, u, U, y, Y, d, D, c);
const faces = (ring) => outwardRing(ring).map((p, i, r) => wallFace(p, r[(i + 1) % r.length]));
const mean = (r) => r.reduce(([x, z], [a, b]) => [x + a / r.length, z + b / r.length], [0, 0]);
const local = ([x, z]) => {
  const dx = x - F.origin[0],
    dz = z - F.origin[1];
  return [dx * F.along[0] + dz * F.along[1], dx * F.normal[0] + dz * F.normal[1]];
};
const square = (x, X, z, Z) =>
  [
    [x, z],
    [X, z],
    [X, Z],
    [x, Z],
  ].map(([u, v]) => xz(P(u, 0, v)));

function porticoArch(out, f, u, w, spring, top, depth, detail) {
  const head = roundArch(w / 2, [3, 5, 9, 12][detail]);
  for (let i = 0; i < head.length - 1; i++) {
    const [a, h] = head[i],
      [b, H] = head[i + 1];
    const p = f.P,
      A = p(u + a, spring + h, 0),
      B = p(u + b, spring + H, 0);
    quad4(out, 'stone', A, B, p(u + b, top, 0), p(u + a, top, 0), pale);
    if (detail > 0) {
      const C = p(u + b, spring + H, -depth),
        D = p(u + a, spring + h, -depth);
      quad4(out, 'detail', D, C, B, A, patina);
      quad4(
        out,
        'detail',
        p(u + a, spring + h, 0.09),
        p(u + b, spring + H, 0.09),
        p(u + b, spring + H + 0.25, 0.08),
        p(u + a, spring + h + 0.25, 0.08),
        pale,
      );
    }
  }
}

function pediment(out, f, u, w, y, rise, depth, detail, type = 'gable') {
  const p = f.P;
  if (type === 'gable') {
    tri(out, 'stone', p(u - w / 2, y, depth), p(u + w / 2, y, depth), p(u, y + rise, depth), stone);
    if (detail > 0) {
      for (const s of [-1, 1])
        beam(
          out,
          'detail',
          p(u + (s * w) / 2, y - 0.055, depth + 0.105),
          p(u, y + rise, depth + 0.1),
          0.2,
          0.2,
          pale,
        );
    }
  } else {
    const r = roundArch(w / 2, detail > 1 ? 10 : 5);
    fan(
      out,
      'stone',
      [
        p(u - w / 2, y, depth),
        p(u + w / 2, y, depth),
        ...r
          .toReversed()
          .slice(1, -1)
          .map(([a, h]) => p(u + a, y + (h * 2 * rise) / w, depth)),
      ],
      stone,
    );
  }
  fbox(
    out,
    'detail',
    f,
    u - w / 2 - 0.079,
    u + w / 2 + 0.078,
    y - 0.2,
    y + 0.06,
    depth - 0.18,
    depth + 0.142,
    pale,
  );
}

function column(out, u, d, base, top, r, detail) {
  const c = xz(P(u, 0, d)),
    h = top - base;
  if (detail === 0) {
    box(out, 'stone', u - r, u + r, base, top, d - r, d + r, pale);
    return;
  }
  lathe(
    out,
    'detail',
    c,
    [
      [base, r * 1.14, r * 1.14],
      [base + h * 0.07, r * 0.98, r * 0.98],
      [top - h * 0.09, 0.88 * r, 0.88 * r],
      [top, r * 1.13, r * 1.13],
    ],
    detail > 1 ? 12 : 6,
    pale,
  );
}

function statue(out, u, d, y, h, detail) {
  const c = xz(P(u, 0, d));
  box(out, 'stone', u - 0.6, u + 0.6, y, y + h * 0.24, d - 0.43, d + 0.43, pale);
  lathe(
    out,
    'detail',
    c,
    [
      [y + h * 0.24, 0.29, 0.26],
      [y + h * 0.5, 0.33, 0.23],
      [y + h * 0.71, 0.38, 0.24],
      [y + h * 0.805, 0.19, 0.16],
      [y + h * 0.93, 0.18, 0.15],
      [y + h, 0.066, 0.065],
    ],
    detail > 1 ? 8 : 4,
    relief,
  );
}

function rectWindow(out, f, u, y, w, h, detail) {
  if (detail > 1) {
    opening(out, f, u, y, w, h, {
      glassSlot: 'glass',
      frameSlot: 'detail',
      head: 'flat',
      glass,
      frame: pale,
      frameWidth: 0.16,
      frameDepth: 0.14,
      mullions: detail > 2 ? 1 : 0,
      transoms: detail > 2 ? 2 : 0,
    });
    return;
  }
  const a = u - w / 2,
    b = u + w / 2,
    p = f.P;
  quad4(
    out,
    'glass',
    p(a, y, 0.037),
    p(b, y, 0.037),
    p(b, y + h, 0.037),
    p(a, y + h, 0.037),
    glass,
  );
}

function loggia(out, detail) {
  const d = 5.21,
    y0 = 1.11,
    crown = 23.2,
    middle = 11.47;
  const wingSpan = [
    [-35.4, -9.9],
    [18.35, 34.8],
  ];
  for (const [u, U] of wingSpan) {
    box(out, 'ochre', u, U, -1.84, 22.88, -4.37, 4.17, ochre);
    box(out, 'detail', u - 0.24, U + 0.26, 22.58, 23.54, -4.62, 4.48, pale);
    if (detail) box(out, 'stone', u - 0.08, U + 0.083, 10.6, 11.08, -4.47, 4.43, stone);
    if (detail) box(out, 'stone', u - 0.07, U + 0.072, 1.05, 1.46, -4.46, 4.41, pale);
    if (detail > 0) {
      const f = facade(xz(P(0, 0, 4.19)), F.along);
      const n = Math.round((U - u) / 4.39);
      fbox(out, 'detail', f, u - 0.11, U + 0.11, 24.08, 24.3, -0.22, 0.2, pale);
      const bars = Math.round((U - u) / (detail === 1 ? 1.63 : 0.89));
      for (let j = 0; j < bars; j++) {
        const x = u + ((U - u) * (j + 0.5)) / bars;
        fbox(out, 'detail', f, x - 0.1, x + 0.1, 23.52, 24.1, -0.12, 0.092, pale);
      }
      for (let i = 0; i < n; i++) {
        const width = (U - u) / n,
          a = u + width * i,
          b = a + width,
          x = (a + b) / 2;
        fbox(out, 'detail', f, a - 0.15, a + 0.17, 1.52, 22.44, -0.11, 0.21, pale);
        for (const [y, h, w] of [
          [2.03, 2.99, 1.89],
          [12.11, 3.22, 2.0],
          [19.21, 1.27, 2.12],
        ])
          rectWindow(out, f, x, y, w, h, detail);
        if (i % 2 === 0 && detail > 1) {
          pediment(out, f, x, 2.76, 16.17, 0.38, 0.11, detail, i % 3 === 0 ? 'gable' : 'round');
          fbox(out, 'detail', f, x - 1.22, x + 1.23, 11.96, 12.32, -0.02, 0.38, pale);
        }
      }
    }
  }
  const positions = [-9.84, -4.62, 0.82, 6.19, 11.54, 17.72];
  for (const u of positions) column(out, u, d, y0, middle - 0.31, 0.59, detail);
  box(out, 'stone', -10.61, 18.52, middle - 0.34, middle + 0.4, -3.76, 5.57, pale);
  box(out, 'ochre', -10.2, 18.43, y0, 22.36, -4.52, -3.47, patina);
  for (let i = 0; i < positions.length - 1; i++) {
    const u = (positions[i] + positions[i + 1]) / 2;
    box(out, 'wood', u - 1.72, u + 1.73, y0, 8.61, -3.46, -3.35, wood);
    if (detail > 0)
      pediment(out, F, u, 4.56, 10.73, 0.89, d + 0.24, detail, i === 2 ? 'round' : 'gable');
  }
  const f = facade(xz(P(0, 0, d + 0.08)), F.along);
  const u0 = -5.41,
    u1 = 0.05,
    u2 = 6.68,
    u3 = 12.88;
  const center = [(u0 + u1) / 2, (u1 + u2) / 2, (u2 + u3) / 2];
  const widths = [4.54, 5.61, 4.67];
  for (const [i, u] of center.entries())
    porticoArch(out, f, u, widths[i], i === 1 ? 18.56 : 17.68, crown, 1.19, detail);
  for (const [u, U] of [
    [-10.61, u0],
    [u0 - 0.53, u0 + 0.47],
    [u1 - 0.51, u1 + 0.51],
    [u2 - 0.51, u2 + 0.49],
    [u3 - 0.47, u3 + 0.45],
    [u3, 18.52],
  ]) {
    box(out, 'stone', u, U, 11.87, 23.25, 4.32, 5.29, pale);
  }
  for (const u of [u0, u1, u2, u3]) column(out, u, 5.59, 12.02, 22.67, 0.48, detail);
  box(out, 'detail', -10.74, 18.64, 23.25, 24.38, -4.63, 5.57, pale);
  pediment(out, F, 3.38, 10.76, 24.31, 2.67, 5.68, detail);
  for (const u of [-8.7, -3.23, 3.33, 8.92, 15.18])
    if (detail > 0 || u === 3.33) statue(out, u, 5.08, u === 3.33 ? 25.89 : 24.36, 3.68, detail);
  box(out, 'stone', -35.68, 34.96, 0.58, 1.18, 2.87, 5.57, patina);
  const steps = [2, 4, 9, 12][detail];
  for (let i = 0; i < steps; i++)
    box(
      out,
      'stone',
      -35.59,
      34.94,
      -0.86,
      (1.16 * (i + 1)) / steps,
      3.48,
      10.37 - (4.72 * i) / steps,
      stone,
    );
}

function tower(out, detail) {
  const { outline, height, rise } = site.tower,
    center = mean(outline),
    eave = height - rise;
  extrude(out, 'brick', outline, -1.5, eave, warmBrick, { top: false });
  const towerFacades = faces(outline).filter((f) => f.length > 4.8);
  const levels = [29.42, 36.18, 43.42, 50.4, 57.12, 63.96];
  for (const f of towerFacades) {
    for (const [i, y] of levels.entries()) {
      if (detail === 0 && i !== 2 && i !== levels.length - 1) continue;
      fbox(out, 'detail', f, 0, f.length, y - 0.2, y + 0.13, -0.096, 0.24, pale);
      if (detail === 0) continue;
      const w = Math.min(1.39, f.length * 0.211);
      for (const u of [f.length * 0.31, f.length * 0.69]) {
        if (detail === 1) {
          quad4(
            out,
            'glass',
            f.P(u - w / 2, y - 5.06, 0.044),
            f.P(u + w / 2, y - 5.06, 0.044),
            f.P(u + w / 2, y - 1.37, 0.044),
            f.P(u - w / 2, y - 1.37, 0.044),
            glass,
          );
        } else {
          opening(out, f, u, y - 5.05, w, 3.68, {
            head: 'round',
            frameSlot: 'brick',
            glassSlot: 'glass',
            glass,
            frame: red,
            frameWidth: 0.14,
            mullions: detail > 2 ? 1 : 0,
          });
        }
      }
    }
  }
  const clockFace = towerFacades.sort(
    (a, b) =>
      b.normal[0] * F.normal[0] +
      b.normal[1] * F.normal[1] -
      a.normal[0] * F.normal[0] -
      a.normal[1] * F.normal[1],
  )[0];
  if (detail > 0) {
    const x = clockFace.length * 0.48,
      y = 40.08,
      n = detail > 1 ? 18 : 10;
    const disk = (r, d) =>
      Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        return clockFace.P(x + r * Math.cos(a), y + r * Math.sin(a), d);
      });
    fan(out, 'detail', disk(1.34, 0.138), stone);
    fan(out, 'glass', disk(1.17, 0.161), rgb('747366'));
    beam(
      out,
      'detail',
      clockFace.P(x, y, 0.199),
      clockFace.P(x + 0.33, y + 0.71, 0.199),
      0.089,
      0.047,
      pale,
    );
  }
  spire(out, 'lead', center, 4.92, 4, eave, 10.36, lead, {
    rotation: Math.atan2(F.along[1], F.along[0]) + Math.PI / 4,
  });
  lathe(
    out,
    'lead',
    center,
    [
      [74.26, 0.22, 0.22],
      [74.53, 0.26, 0.26],
      [74.72, 0.18, 0.18],
      [75, 0.02, 0.02],
    ],
    detail > 1 ? 8 : 5,
    lead,
  );
}

function chapelDome(out, parts, detail) {
  const { dome, lantern } = parts,
    c = mean(dome.outline),
    base = dome.height - dome.rise;
  extrude(out, 'stone', dome.outline, 22.84, base, pale, { top: false });
  const n = [6, 10, 16, 24][detail],
    r = 8.66;
  const profile =
    detail === 0
      ? [
          [base, r, r],
          [base + 8.22, 5.1, 5.1],
          [44.98, 1.26, 1.26],
        ]
      : [
          [base, r, r],
          [base + 0.73, 8.59, 8.59],
          [base + 3.11, 7.83, 7.83],
          [base + 5.73, 6.63, 6.63],
          [base + 8.31, 5.02, 5.02],
          [base + 10.25, 2.4, 2.4],
          [44.98, 1.3, 1.3],
        ];
  lathe(out, 'lead', c, profile, n, lead);
  if (detail > 0) {
    for (const f of faces(dome.outline)) {
      fbox(out, 'detail', f, 0, f.length, base - 0.4, base - 0.05, -0.09, 0.28, pale);
      rectWindow(out, f, f.length / 2, base - 7.9, f.length * 0.37, 5.39, detail);
      if (detail > 1)
        pediment(out, f, f.length / 2, f.length * 0.67, base - 2.26, 0.67, 0.24, detail, 'round');
    }
  }
  extrude(out, 'stone', lantern.outline, 44.59, 49.24, stone, { top: false });
  lathe(
    out,
    'lead',
    mean(lantern.outline),
    [
      [49.15, 1.48, 1.48],
      [50.35, 1.02, 1.02],
      [51.46, 0.1, 0.1],
    ],
    detail > 0 ? 10 : 6,
    lead,
  );
}

function roofs(out, detail) {
  for (const [r, ...holes] of site.base)
    extrude(out, 'ochre', detail === 0 ? r.filter((_, i) => i % 2 === 0) : r, -5.58, 15.31, ochre, {
      holes,
      topSlot: 'clay',
      topColor: clay,
    });
  const exclude = new Set([
    494854789, 494870409, 494870410, 494870411, 494870412, 494870413, 494870433,
  ]);
  const sky = new Set([494854785, 494854786, 494854787]);
  for (const part of site.parts) {
    if (exclude.has(part.id) || (!detail && !sky.has(part.id))) continue;
    const { outline, height, roof, rise } = part;
    const gable = roof === 'gabled' && detail > 0 && rise > 0.7;
    const eave = gable ? height - rise : height;
    extrude(out, 'ochre', outline, height > 16 ? 8.26 : 5.14, eave, ochre, {
      topSlot: 'clay',
      topColor: clay,
    });
    if (gable) {
      const q = outline.map(local),
        u = q.map((p) => p[0]),
        d = q.map((p) => p[1]);
      const A = Math.min(...u),
        B = Math.max(...u),
        C = Math.min(...d),
        D = Math.max(...d);
      const alongU = B - A > D - C;
      const a = alongU ? P(A + 0.1, 0, (C + D) / 2) : P((A + B) / 2, 0, C + 0.1);
      const b = alongU ? P(B - 0.1, 0, (C + D) / 2) : P((A + B) / 2, 0, D - 0.1);
      gableRoof(out, 'clay', xz(a), xz(b), Math.min(B - A, D - C) - 0.19, eave, height, clay, {
        overhang: 0.13,
        endSlot: 'ochre',
        endColor: ochre,
      });
    }
    if (detail > 1 && height > 16 && part.id % 3 === 0)
      for (const f of faces(outline).filter((f) => f.length > 8.0)) {
        const n = Math.min(6, Math.floor(f.length / 3.5));
        for (let i = 0; i < n; i++)
          rectWindow(out, f, ((i + 0.5) * f.length) / n, height - 5.4, 1.35, 2.65, detail);
      }
  }
  const nave = site.parts.find((p) => p.id === 494854789);
  extrude(out, 'ochre', nave.outline, 14.67, 25, ochre, { top: false });
  gableRoof(out, 'clay', xz(P(1.82, 0, -76.59)), xz(P(1.8, 0, -3.87)), 20.09, 25, 28.0, clay, {
    overhang: 0.24,
    endSlot: 'stone',
    endColor: stone,
  });
  if (detail > 0) {
    for (const s of [-1, 1]) {
      const f = facade(
        xz(P(s < 0 ? -8.32 : 11.87, 0, -41)),
        F.normal.map((v) => -s * v),
      );
      for (const x of [-28, -20.4, -12.9, -5.24, 2.32, 9.79, 17.31, 24.9])
        rectWindow(out, f, x, 21.4, 1.43, 2.72, detail);
    }
  }
}

function rear(out, detail) {
  for (const [r, ...holes] of site.apse) {
    extrude(out, 'stone', r, -3.56, 17.26, pale, { holes, topSlot: 'stone', topColor: stone });
    const c = mean(r);
    const inner = r.map(([x, z]) => [c[0] + (x - c[0]) * 0.89, c[1] + (z - c[1]) * 0.89]);
    extrude(out, 'stone', inner, 17.19, 23.82, stone, { topSlot: 'clay', topColor: clay });
    if (detail > 0)
      for (const f of faces(r).filter((e) => e.length > 1.85 && e.length < 5.55)) {
        fbox(out, 'detail', f, 0, f.length, 16.89, 17.24, -0.115, 0.31, pale);
        if (detail > 1)
          opening(out, f, f.length * 0.53, 8.31, Math.min(f.length * 0.62, 1.6), 5.41, {
            head: 'round',
            glassSlot: 'glass',
            frameSlot: 'detail',
            frame: pale,
            glass,
            frameWidth: 0.17,
            mullions: 1,
          });
      }
  }
  const n = [2, 4, 7, 11][detail];
  for (let i = 0; i < n; i++) {
    const u = i / n,
      scale = 1 - 0.11 * u,
      d = -100.81 + 6.98 * u;
    extrude(
      out,
      'stone',
      square(-38.21 * scale, 40.27 * scale, d, -87.57),
      -5.65,
      -3.46 + (2.33 * (i + 1)) / n,
      patina,
    );
  }
  if (detail > 0) {
    const f = facade(
      xz(P(0, 0, -88.1)),
      F.along.map((v) => -v),
    );
    for (const u of [-33.5, -28.6, -22.2, 19.1, 24.6, 30.2]) {
      rectWindow(out, f, u, 3.86, 1.8, 4.11, detail);
      if (detail > 1) pediment(out, f, u, 2.71, 8.44, 0.53, 0.21, detail, 'round');
    }
  }
}

function build(sink, detail) {
  const out = withFootprintCaps(sink);
  roofs(out, detail);
  loggia(out, detail);
  rear(out, detail);
  tower(out, detail);
  for (const pair of site.domes) chapelDome(out, pair, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
