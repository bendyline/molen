import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { transform } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { cleanRing } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  gableRoof,
  opening,
  outwardRing,
  quad4,
  ribbon,
  roundArch,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.97 },
  limestone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.94 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', metallic: 0.24, roughness: 0.82 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.95 },
  wood: { slot: 'door', graph: 'wood_vertical', roughness: 0.89 },
  stone: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.95 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.71 },
};
const lime = rgb('d8d3c5');
const shade = rgb('bbb7a9');
const trim = rgb('cbbda2');
const chalk = rgb('e1d8c3');
const roof = rgb('646969');
const clay = rgb('9a614a');
const oak = rgb('554839');
const glass = rgb('535856');
const sepia = rgb('927b60');
const angle = (site.planAngleDegrees * Math.PI) / 180;
const rect = (x, X, z, Z) => [
  [x, z],
  [x, Z],
  [X, Z],
  [X, z],
];
const faces = (r) => outwardRing(r).map((a, i, q) => wallFace(a, q[(i + 1) % q.length]));

function simpleRing(ring, detail) {
  const r = cleanRing(ring);
  if (detail) return r;
  for (let i = r.length - 1; i >= 0 && r.length > 4; i--) {
    const a = r[(i + r.length - 1) % r.length],
      b = r[i],
      c = r[(i + 1) % r.length];
    const dx = c[0] - a[0],
      dz = c[1] - a[1],
      length = Math.hypot(dx, dz) || 1;
    const t = ((b[0] - a[0]) * dx + (b[1] - a[1]) * dz) / length;
    if (t >= 0 && t <= length && Math.abs((b[0] - a[0]) * dz - (b[1] - a[1]) * dx) / length < 0.45)
      r.splice(i, 1);
  }
  return r;
}
function positioned(out) {
  const model = transform(out, -angle);
  model.addCap = (slot, ref, rings, holes, y, n, uv, tint) => {
    const temp = new MeshBufferBuilder();
    if (!temp.addCap('wall', ref, rings, holes, y, n, uv, tint)) return false;
    const { positions, indices } = temp.finalize();
    for (let i = 0; i < indices.length; i += 3) {
      const p = [0, 1, 2].map((j) => positions.slice(3 * indices[i + j], 3 * indices[i + j] + 3));
      model.addTriangle(
        slot,
        ref,
        p,
        n,
        [
          [0, 0],
          [1, 0],
          [1, 1],
        ],
        tint,
      );
    }
    return true;
  };
  return model;
}

function panel(out, slot, f, l, r, y, h, d, tint) {
  const p = f.P;
  quad4(out, slot, p(l, y, d), p(r, y, d), p(r, h, d), p(l, h, d), tint);
}

function window(out, f, u, y, w, h, detail, options = {}) {
  const { door = false, round = false, depth = 0.085 } = options;
  if (detail <= 2 && !round) {
    if (detail >= 2)
      panel(
        out,
        'limestone',
        f,
        u - w * 0.59,
        u + w * 0.59,
        y - 0.12,
        y + h + 0.115,
        depth - 0.015,
        trim,
      );
    panel(
      out,
      door ? 'wood' : 'glass',
      f,
      u - w * 0.5,
      u + w * 0.5,
      y,
      y + h,
      depth,
      door ? oak : glass,
    );
    if (detail >= 2 && !door)
      panel(out, 'limestone', f, u - 0.031, u + 0.031, y, y + h, depth + 0.033, trim);
    return;
  }
  const tint = door ? oak : glass,
    slot = door ? 'wood' : 'glass';
  if (detail < 3) {
    const p = f.P,
      r = w * 0.5,
      spring = y + h - r;
    panel(out, slot, f, u - r, u + r, y, spring, depth, tint);
    const arch = roundArch(r, detail === 2 ? 6 : 4);
    for (let i = 1; i < arch.length; i++) {
      const [a, b] = arch[i - 1],
        [x, z] = arch[i];
      tri(
        out,
        slot,
        p(u, spring, depth),
        p(u + x, spring + z, depth),
        p(u + a, spring + b, depth),
        tint,
      );
    }
    if (detail === 2 && !door)
      panel(out, 'limestone', f, u - 0.031, u + 0.031, y, spring + 0.065, depth + 0.033, trim);
    return;
  }
  opening(out, f, u, y, w, h, {
    head: round ? 'round' : 'flat',
    frameSlot: 'limestone',
    glassSlot: slot,
    glass: tint,
    frame: trim,
    frameWidth: 0.075,
    frameDepth: depth + 0.071,
    d: depth,
    mullions: door ? 0 : 1,
    sill: !door,
  });
}

function mould(out, f, u, y, r, detail, { tall = 0, depth = 0.1, tint = chalk } = {}) {
  const steps = detail === 3 ? 11 : detail === 2 ? 6 : 4;
  const inner = roundArch(r, steps),
    outer = roundArch(r + 0.075, steps);
  const p = f.P;
  for (let i = 1; i <= steps; i++)
    quad4(
      out,
      'limestone',
      p(u + inner[i - 1][0], y + inner[i - 1][1], depth),
      p(u + inner[i][0], y + inner[i][1], depth),
      p(u + outer[i][0], y + outer[i][1], depth),
      p(u + outer[i - 1][0], y + outer[i - 1][1], depth),
      tint,
    );
  if (tall)
    for (const s of [-1, 1])
      panel(
        out,
        'limestone',
        f,
        u + s * r - 0.043,
        u + s * r + 0.043,
        y - tall,
        y + 0.021,
        depth,
        tint,
      );
}

function cross(out, x, z, y, h, detail) {
  const w = detail === 3 ? 0.035 : 0.06;
  beam(out, 'roof', [x, y - 0.049, z], [x, y + h, z], w, w, roof);
  for (const [t, r] of detail >= 2
    ? [
        [0.38, 0.28],
        [0.68, 0.34],
        [0.86, 0.19],
      ]
    : [[0.65, 0.32]])
    beam(out, 'roof', [x - r * h, y + t * h, z], [x + r * h, y + t * h, z], w, w, roof);
}

function tower(out, center, radius, base, eave, top, detail, crownScale = 1) {
  const radial = (y, r) => radialRing(y, r, r, 8, center, Math.PI / 8);
  const wall = radial(base, radius).map(([x, , z]) => [x, z]);
  extrude(out, 'plaster', wall, base, eave, lime);
  const ring = radial(eave, radius * 1.13).map(([x, , z]) => [x, z]);
  loft(
    out,
    'roof',
    [radial(eave - 0.041, radius * 1.13), radial(eave + 0.15, radius * 1.035), radial(top, 0.077)],
    roof,
  );
  cross(out, ...center, top, crownScale, detail);
  if (!detail) return;
  ribbon(out, 'limestone', wall, eave - 0.39, eave - 0.17, chalk, {
    inset: 0,
    minLength: 0.8,
    offset: 0.058,
  });
  for (const f of faces(wall)) {
    const u = f.length * 0.5,
      w = f.length * 0.39,
      h = eave - base;
    window(out, f, u, base + h * 0.155, w, h * 0.68, detail, { round: true });
    if (detail >= 2) {
      mould(out, f, u, eave - h * 0.21, w * 0.69, detail, { tall: h * 0.55, depth: 0.13 });
      for (const s of [-1, 1]) {
        const q = u + s * w * 0.78;
        fbox(
          out,
          'limestone',
          f,
          q - 0.062,
          q + 0.062,
          base + 0.75,
          eave - 0.64,
          -0.035,
          0.126,
          chalk,
        );
      }
    }
  }
  if (detail === 3)
    ribbon(out, 'limestone', ring, eave + 0.04, eave + 0.11, sepia, {
      inset: 0,
      minLength: 1,
      offset: 0.043,
    });
}

/** Extruded voussoirs form the head while stone jambs leave the opening clear. */
function openArch(out, f, u, r, spring, top, depth, detail, slot = 'plaster') {
  const p = f.P,
    points = roundArch(r, [2, 2, 7, 12][detail]);
  for (let i = 1; i < points.length; i++) {
    const [a, y] = points[i - 1],
      [b, h] = points[i];
    const l = u + a,
      rr = u + b,
      yl = spring + y,
      yr = spring + h;
    quad4(out, slot, p(l, yl, 0.006), p(rr, yr, 0.006), p(rr, top, 0.006), p(l, top, 0.006), lime);
    if (detail >= 2)
      quad4(
        out,
        slot,
        p(rr, yr, -depth),
        p(l, yl, -depth),
        p(l, top, -depth),
        p(rr, top, -depth),
        shade,
      );
    quad4(
      out,
      'limestone',
      p(l, yl, -depth),
      p(rr, yr, -depth),
      p(rr, yr, 0.009),
      p(l, yl, 0.009),
      trim,
    );
  }
  if (detail >= 2) mould(out, f, u, spring, r, detail, { depth: 0.075 });
}

function porchArcade(out, r, base, eave, detail) {
  const plinth = base + 1.14,
    spring = base + 4.35,
    top = base + 6.63;
  extrude(out, 'plaster', r, base - 1.35, plinth, lime);
  if (!detail) {
    const [x, X, z, Z] = [0, 1].flatMap((axis) => [
      Math.min(...r.map((p) => p[axis])),
      Math.max(...r.map((p) => p[axis])),
    ]);
    for (const [a, b] of [
      [x, z],
      [x, Z],
      [X, z],
      [X, Z],
    ])
      abox(out, 'limestone', [a - 0.21, plinth, b - 0.21], [a + 0.21, top, b + 0.21], trim, {
        bottom: false,
      });
    extrude(out, 'plaster', r, top - 0.09, eave, lime, { topSlot: 'roof', topColor: roof });
    return;
  }
  for (const f of faces(r)) {
    if (f.normal[0] > 0.77) continue;
    if (f.length < 1.2) continue;
    const n = Math.max(1, Math.round(f.length / 3.5)),
      width = f.length / n;
    const radius = width * 0.39;
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) * width;
      for (const [a, b] of [
        [i * width, u - radius],
        [u + radius, (i + 1) * width],
      ]) {
        if (detail < 2 || (i === 0 && a === 0) || (i === n - 1 && b === f.length))
          fbox(out, 'limestone', f, a, b, plinth, spring + 0.08, -0.46, 0.04, trim);
        else {
          const interior = i * width;
          if (a !== interior) continue;
          const [x, , z] = f.P(interior, 0, -0.168);
          const r = Math.min(0.36, width * 0.103);
          loft(
            out,
            'limestone',
            [
              [plinth, r * 1.34],
              [plinth + 0.23, r * 1.34],
              [plinth + 0.32, r],
              [spring - 0.31, r * 0.82],
              [spring - 0.17, r * 1.19],
              [spring + 0.08, r * 1.21],
            ].map(([y, s]) => radialRing(y, s, s, detail === 3 ? 12 : 7, [x, z])),
            trim,
          );
        }
      }
      openArch(out, f, u, radius, spring, top, 0.51, detail);
    }
  }
  extrude(out, 'plaster', r, top - 0.12, eave, lime, { topSlot: 'roof', topColor: roof });
  ribbon(out, 'limestone', r, top + 0.06, top + 0.24, chalk, {
    offset: 0.095,
    inset: 0,
    minLength: 1,
  });
  ribbon(out, 'limestone', r, eave - 0.41, eave - 0.02, trim, {
    offset: 0.15,
    inset: 0,
    minLength: 1,
  });
  if (detail >= 2)
    for (const f of faces(r)) {
      const n = Math.floor(f.length / 1.91);
      for (let i = 0; i < n; i++) {
        const u = (f.length * (i + 0.5)) / n;
        mould(out, f, u, eave - 1.12, 0.535, detail, { tall: 0.57 });
      }
    }
}

function entranceCanopy(out, base, detail) {
  const r = rect(-18.27, -15.67, -1.61, 2.65),
    spring = base + 3.77,
    top = base + 5.92;
  for (const f of faces(r)) {
    if (f.normal[0] > 0.78) continue;
    const u = f.length * 0.5,
      radius = f.length * 0.39;
    if (!detail) {
      fbox(out, 'limestone', f, 0, 0.37, base + 0.1, top, -0.36, 0.09, trim);
      continue;
    }
    fbox(out, 'limestone', f, 0, u - radius, base + 0.1, spring + 0.06, -0.36, 0.09, trim);
    fbox(out, 'limestone', f, u + radius, f.length, base + 0.1, spring + 0.06, -0.36, 0.09, trim);
    openArch(out, f, u, radius, spring, top, 0.4, detail);
  }
  extrude(out, 'limestone', r, top - 0.16, top + 0.32, trim);
  const center = [-16.96, 0.53];
  const levels =
    detail >= 2
      ? [
          [0, 1],
          [0.28, 0.94],
          [0.56, 0.82],
          [0.82, 0.56],
          [1, 0.08],
        ]
      : [
          [0, 1],
          [0.58, 0.79],
          [1, 0.08],
        ];
  loft(
    out,
    'roof',
    levels.map(([t, scale]) =>
      radialRing(
        top + 0.31 + t * 1.6,
        1.58 * scale,
        2.24 * scale,
        detail >= 2 ? 16 : 8,
        center,
        Math.PI / 8,
      ),
    ),
    roof,
  );
  if (detail) cross(out, ...center, top + 1.91, 0.66, detail);
  for (let i = 0; i < (detail ? 4 : 2); i++) {
    const count = detail ? 4 : 2;
    abox(
      out,
      'limestone',
      [-19.36 + i * (1.56 / count), base - 0.1, -1.7],
      [-17.8, base + ((i + 1) * 1.15) / count, 2.69],
      trim,
      { bottom: false },
    );
  }
}

function mainChurch(out, detail) {
  const { base, drums, nave, porch, porchHeight, naveHeight } = site.church;
  const eave = base + naveHeight;
  for (const r of porch) porchArcade(out, cleanRing(r), base, base + porchHeight, detail);
  entranceCanopy(out, base, detail);
  for (const raw of nave) {
    const r = simpleRing(raw, detail);
    extrude(out, 'plaster', r, base - 2.4, eave, lime, { topSlot: 'roof', topColor: roof });
    if (detail) {
      ribbon(out, 'limestone', r, base + 0.83, base + 1.23, chalk, {
        offset: 0.094,
        minLength: 0.8,
        inset: 0,
      });
      ribbon(out, 'limestone', r, base + 7.1, base + 7.43, trim, {
        offset: 0.099,
        minLength: 0.8,
        inset: 0,
      });
    }
    if (detail >= 2)
      ribbon(out, 'limestone', r, eave - 0.44, eave - 0.02, chalk, {
        offset: 0.14,
        minLength: 0.8,
        inset: 0,
      });
    for (const f of faces(r)) {
      if (!detail || f.length < 1.55) continue;
      const western = f.normal[0] < -0.7;
      if (western) {
        if (f.length > 8)
          window(out, f, f.length * 0.5, base + 1.16, 2.35, 4.04, detail, {
            round: true,
            door: true,
            depth: 0.09,
          });
        continue;
      }
      const n = Math.max(1, Math.round(f.length / 3.4));
      for (let i = 0; i < n; i++) {
        const u = ((i + 0.5) * f.length) / n;
        window(out, f, u, base + 2.66, 0.68, 2.63, detail);
        if (detail >= 2) mould(out, f, u, base + 9.41, 0.49, detail, { tall: 1.03, depth: 0.081 });
      }
    }
  }
  for (const [i, d] of drums.entries()) {
    const [x, z] = d.center,
      side = i ? 3.49 : 3.47,
      level = base + (i ? 12.55 : 11.95);
    const pedestal = rect(x - side, x + side, z - side, z + side);
    extrude(out, 'plaster', pedestal, eave - 0.22, level, lime, {
      topSlot: 'roof',
      topColor: roof,
    });
    if (detail)
      ribbon(out, 'limestone', pedestal, level - 0.3, level - 0.12, chalk, {
        offset: 0.09,
        inset: 0,
        minLength: 2.5,
      });
    tower(
      out,
      d.center,
      d.radius,
      level - 0.047,
      base + d.eave,
      base + d.eave + 1.24,
      detail,
      1.31,
    );
  }
}

function chapel(out, detail) {
  const { ring, base, height, dome } = site.chapel,
    r = simpleRing(ring, detail);
  extrude(out, 'plaster', r, base - 3, base + 8.77, lime, { topSlot: 'roof', topColor: roof });
  const copperBase = base + 8.75;
  const neck = radialRing(copperBase, 4.26, 3.61, 8, dome, Math.PI / 8);
  loft(out, 'roof', [neck, radialRing(base + 10.51, 2.96, 2.7, 8, dome, Math.PI / 8)], roof);
  tower(out, dome, 2.71, base + 10.31, base + height - 1.3, base + height - 0.47, detail, 0.47);
  if (detail)
    for (const f of faces(r)) {
      if (f.length < 3.25) continue;
      window(out, f, f.length * 0.5, base + 3.1, 1.18, 3.76, detail, { round: true, mullions: 1 });
    }
}

function arcadeWall(out, f, base, eave, details) {
  const [detail, wide] = details;
  const storey = (eave - base) / 2;
  const n = Math.max(1, Math.round(f.length / (wide ? 6.34 : 3.4)));
  const span = f.length / n,
    radius = span * (wide ? 0.38 : 0.41);
  const p = f.P;
  for (let level = 0; level < 2; level++) {
    const y = base + storey * level,
      top = y + storey,
      spring = top - radius - 0.31;
    if (spring <= y + 0.4) {
      panel(out, 'plaster', f, 0, f.length, y, top, 0, lime);
      continue;
    }
    const margin = span * 0.5 - radius;
    fbox(out, 'plaster', f, 0, margin, y, spring + 0.04, -0.46, 0.03, lime);
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) * span;
      const next = (i + 1) * span;
      fbox(
        out,
        'plaster',
        f,
        next - margin,
        Math.min(next + margin, f.length),
        y,
        spring + 0.04,
        -0.46,
        0.03,
        lime,
      );
      openArch(out, f, u, radius, spring, top, 0.44, detail);
      if (detail >= 2) {
        const [x, , z] = p(u, y, -1.96);
        const back = facade([x, z], f.along);
        window(out, back, 0, y + 0.38, level ? 0.66 : 0.91, 1.63, detail, { door: level === 0 });
      }
    }
    if (level === 1 && detail) {
      fbox(out, 'limestone', f, 0, f.length, y - 0.11, y + 0.16, -0.53, 0.1, trim);
      if (detail >= 2)
        for (let i = 0; i < n; i++) {
          const u = (i + 0.5) * span;
          panel(out, 'wood', f, u - radius, u + radius, y + 0.17, y + 0.72, 0.036, oak);
        }
    }
    if (detail) panel(out, 'plaster', f, 0, f.length, y, top, -2.06, shade);
  }
}

function range(out, s, detail) {
  const { r, base, eave, lo, hi, mid, rise, axis, polygons, kind } = s;
  const cap = base + eave;
  const h = (p, slope) =>
    cap + rise * (slope ? (hi - p[axis]) / (hi - mid) : (p[axis] - lo) / (mid - lo));
  const slopeAt = (p) => h(p, p[axis] > mid ? 1 : 0);
  const useTile = kind === 'gate-range' || kind === 'workshop' || kind === 'range';
  const ring = simpleRing(r, detail);
  for (const f of faces(ring)) {
    const a = f.origin,
      end = f.P(f.length, 0),
      b = [end[0], end[2]];
    const inside =
      (kind === 'north' && f.normal[1] > 0.87) ||
      (kind === 'south' && f.normal[1] < -0.87) ||
      (kind === 'west' && f.normal[0] > 0.87) ||
      (kind === 'south-loggia' && f.normal[1] < -0.33) ||
      (kind === 'north-loggia' && f.normal[1] > 0.34);
    if (detail && inside && f.length > 3.1) {
      arcadeWall(out, f, base, cap, [detail, detail === 1]);
      panel(out, 'stone', f, 0, f.length, base - 3.8, base - 0.015, -0.017, trim);
    } else {
      panel(out, 'plaster', f, 0, f.length, base - 3.8, cap, 0, lime);
      if (detail && f.length > 4.0) {
        const count = Math.max(1, Math.floor(f.length / 4.62));
        for (let i = 0; i < count; i++)
          window(out, f, (f.length * (i + 0.5)) / count, cap - 2.92, 0.75, 1.53, detail);
      }
    }
    const where = (mid - a[axis]) / (b[axis] - a[axis]);
    const positions =
      where > 0.001 && where < 0.999 ? [0, where * f.length, f.length] : [0, f.length];
    for (let i = 1; i < positions.length; i++) {
      const p = f.P,
        L = positions[i - 1],
        R = positions[i];
      const y = (u) => slopeAt(p(u, 0).filter((_, it) => it !== 1));
      if (Math.max(y(L), y(R)) - cap > 0.0004)
        quad4(out, 'plaster', p(L, cap - 0.006), p(R, cap - 0.006), p(R, y(R)), p(L, y(L)), lime);
    }
  }
  for (const [slope, rings] of polygons.entries()) {
    const dy = rise / (slope ? mid - hi : mid - lo);
    const n = axis ? [0, 1, -dy] : [-dy, 1, 0];
    for (const poly of rings) {
      if (
        !out.addCap(
          useTile ? 'tile' : 'roof',
          'palette:#ffffff',
          simpleRing(poly, detail),
          [],
          (p) => h(p, slope) + 0.009,
          n,
          (p) => p,
          useTile ? clay : roof,
        )
      )
        throw Error('Cannot triangulate range ' + s.id);
    }
  }
  if (detail >= 2 && ['north', 'west', 'south'].includes(kind)) {
    for (const f of faces(ring)) {
      if (f.length < 16 || Math.abs(f.normal[axis]) < 0.75) continue;
      const count = Math.floor(f.length / 9);
      for (let i = 0; i < count; i++) {
        const [x, , z] = f.P((f.length * (i + 0.5)) / count, 0, -1.22);
        abox(
          out,
          'plaster',
          [x - 0.34, cap + 0.24, z - 0.26],
          [x + 0.34, cap + rise + 0.22, z + 0.26],
          lime,
          { bottom: false },
        );
        abox(
          out,
          'limestone',
          [x - 0.423, cap + rise + 0.21, z - 0.343],
          [x + 0.423, cap + rise + 0.34, z + 0.343],
          chalk,
          { bottom: false },
        );
      }
    }
  }
}

function gate(out, g, detail) {
  const [dx, dz] = g.b.map((v, i) => v - g.a[i]),
    d = Math.hypot(dx, dz);
  const frame = facade(g.a, [-dz / d, dx / d]);
  const p = frame.P,
    spring = g.ground + 2.12,
    crown = spring + g.radius,
    cap = crown + 0.25;
  const ar = roundArch(g.radius, [2, 4, 8, 12][detail]);
  for (const item of g.components) {
    const high = g.ground + item.height;
    const eave = high - (item.id === g.id ? 2.75 : 1.72);
    const outer = simpleRing(item.ring, detail);
    extrude(out, 'plaster', outer, cap, eave, lime);
    for (const r of item.piers)
      extrude(out, 'plaster', simpleRing(r, detail), g.ground - 2.1, cap, lime, { top: false });
    for (const v of item.vaults) {
      const from = Math.min(...v.local.map((p) => p[1])) + 0.09;
      const to = Math.max(...v.local.map((p) => p[1])) - 0.084;
      for (let i = 1; i < ar.length; i++) {
        const [u, y] = ar[i - 1],
          [v, Y] = ar[i],
          lo = spring + y,
          hi = spring + Y;
        quad4(
          out,
          'plaster',
          p(u, lo, -from),
          p(v, hi, -from),
          p(v, cap, -from),
          p(u, cap, -from),
          lime,
        );
        quad4(out, 'plaster', p(v, hi, -to), p(u, lo, -to), p(u, cap, -to), p(v, cap, -to), shade);
        quad4(
          out,
          'limestone',
          p(u, lo, -to),
          p(v, hi, -to),
          p(v, hi, -from),
          p(u, lo, -from),
          trim,
        );
      }
    }
    const x0 = Math.min(...outer.map((p) => p[0])),
      x1 = Math.max(...outer.map((p) => p[0]));
    const z0 = Math.min(...outer.map((p) => p[1])),
      z1 = Math.max(...outer.map((p) => p[1]));
    const center = [(x0 + x1) * 0.5, (z0 + z1) * 0.5];
    if (item.id === g.id) {
      const r = rect(x0 - 0.28, x1 + 0.29, z0 - 0.29, z1 + 0.29);
      for (let i = 0; i < r.length; i++) {
        const a = r[i],
          b = r[(i + 1) % r.length];
        tri(
          out,
          'tile',
          [a[0], eave, a[1]],
          [b[0], eave, b[1]],
          [center[0], high, center[1]],
          clay,
        );
      }
    } else
      gableRoof(out, 'tile', [x0, center[1]], [x1, center[1]], z1 - z0, eave, high, clay, {
        overhang: 0.11,
        endSlot: 'plaster',
        endColor: lime,
      });
    if (detail)
      for (const f of faces(outer)) {
        if (f.length < 5.4) continue;
        window(
          out,
          f,
          f.length * 0.5,
          eave - (item.id === g.id ? 3.01 : 2.65),
          item.id === g.id ? 1.77 : 0.66,
          item.id === g.id ? 2.47 : 1.46,
          detail,
          { round: item.id === g.id },
        );
      }
  }
}

function walls(out, detail) {
  if (detail)
    for (const w of site.walls) {
      for (let i = 1; i < w.points.length; i++) {
        const f = wallFace(w.points[i - 1], w.points[i]);
        fbox(
          out,
          'stone',
          f,
          -0.25,
          f.length + 0.24,
          w.base - 1.62,
          w.base + 1.93,
          -0.43,
          0.43,
          trim,
        );
      }
    }
  if (detail >= 2)
    for (const small of site.reliefParts)
      extrude(out, 'plaster', cleanRing(small.ring), small.base - 1.7, small.base + 4.3, lime, {
        topSlot: 'tile',
        topColor: clay,
      });
}

const mainRoofKinds = new Set(['north', 'west', 'south', 'south-loggia']);
function build(out, detail) {
  const model = positioned(out);
  mainChurch(model, detail);
  chapel(model, detail);
  for (const s of site.ranges) if (detail || mainRoofKinds.has(s.kind)) range(model, s, detail);
  for (const g of site.gates) gate(model, g, detail);
  walls(model, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
