import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  extrude,
  fbox,
  opening,
  outwardRing,
  quad4,
  rgb,
  ribbon,
  roundArch,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  marble: { slot: 'wall', graph: 'stone_marble', roughness: 0.94 },
  rubble: { slot: 'wall', graph: 'stone_drywall', roughness: 0.98 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.93 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.95 },
  red: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.97 },
  lead: { slot: 'roof', graph: 'metal_standing_seam', metallic: 0.23, roughness: 0.83 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.67 },
  oak: { slot: 'door', graph: 'wood_vertical', roughness: 0.92 },
};

const marble = rgb('c8c7ba');
const trim = rgb('c6c1a9');
const rubble = rgb('a09a83');
const narthex = rgb('a69170');
const plaster = rgb('c4bdab');
const red = rgb('9e5544');
const tile = rgb('874f39');
const lead = rgb('798486');
const glass = rgb('414043');
const oak = rgb('584238');
const iron = rgb('55544c');
const paint = { marble, rubble, plaster };
const edges = (r) => outwardRing(r).map((p, i, q) => wallFace(p, q[(i + 1) % q.length]));
const skylineRanges = new Set([186205380, 186205388, 186205400, 186226216]);

function skylineRing(ring) {
  const simplified = ring.slice();
  for (let i = simplified.length - 1; i >= 0 && simplified.length > 4; i--) {
    const a = simplified[(i + simplified.length - 1) % simplified.length],
      b = simplified[i],
      c = simplified[(i + 1) % simplified.length];
    const dx = c[0] - a[0],
      dz = c[1] - a[1],
      length = Math.hypot(dx, dz);
    const t = ((b[0] - a[0]) * dx + (b[1] - a[1]) * dz) / length;
    if (t >= 0 && t <= length && Math.abs((b[0] - a[0]) * dz - (b[1] - a[1]) * dx) / length < 0.54)
      simplified.splice(i, 1);
  }
  return simplified;
}

function pane(
  out,
  face,
  u,
  y,
  w,
  h,
  detail,
  { head = 'round', slot = 'glass', tint = glass, mullions = 0, depth = 0.085 } = {},
) {
  if (detail >= 2) {
    opening(out, face, u, y, w, h, {
      head,
      glassSlot: slot,
      glass: tint,
      frame: trim,
      frameSlot: 'trim',
      frameWidth: w * 0.103,
      frameDepth: w * 0.096,
      d: depth,
      mullions,
    });
    return;
  }
  const p = face.P;
  const more = head === 'round' ? w * 0.23 : 0;
  quad4(
    out,
    slot,
    p(u - w * 0.5, y, depth),
    p(u + w * 0.5, y, depth),
    p(u + w * 0.5, y + h - more, depth),
    p(u - w * 0.5, y + h - more, depth),
    tint,
  );
}

function roofed(out, section, wallSlot, wallTint, roofSlot, roofTint, detail) {
  const { r, angle, base, eave, rise, axis, lo, hi, m, panels } = section;
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const project = ([x, z]) => (axis ? z * c - x * s : x * c + z * s);
  const roofY = (v, side) =>
    base + eave + rise * (side ? (hi - v) / (hi - m) : (v - lo) / (m - lo));
  const wallY = (p) => {
    const v = project(p);
    return roofY(v, v > m);
  };
  const foundation = base - 2.55;
  for (const face of edges(detail ? r : skylineRing(r))) {
    const a = face.origin,
      b = face.P(face.length, 0).filter((_, i) => i !== 1);
    const v0 = project(a),
      v1 = project(b);
    const split = (m - v0) / (v1 - v0);
    const stations =
      split > 0.0001 && split < 0.9999 ? [0, face.length * split, face.length] : [0, face.length];
    for (let i = 0; i < stations.length - 1; i++) {
      const start = stations[i],
        end = stations[i + 1];
      if (end - start < 0.005) continue;
      const p = face.P;
      const high = (u) => wallY(p(u, 0).filter((_, i) => i !== 1));
      quad4(
        out,
        wallSlot,
        p(start, foundation),
        p(end, foundation),
        p(end, high(end)),
        p(start, high(start)),
        wallTint,
      );
    }
  }
  for (const [side, rings] of panels.entries()) {
    const slope = rise / (side ? m - hi : m - lo);
    const normal = axis ? [s * slope, 1, -c * slope] : [-c * slope, 1, -s * slope];
    const length = Math.hypot(...normal);
    for (const ring of rings) {
      if (
        !out.addCap(
          roofSlot,
          'palette:#ffffff',
          outwardRing(detail ? ring : skylineRing(ring)),
          [],
          (p) => roofY(project(p), side) + 0.009,
          normal.map((v) => v / length),
          (p) => p,
          roofTint,
        )
      )
        throw Error('Roof triangulation failed for ' + (section.name ?? section.id));
    }
  }
  if (detail >= 2)
    ribbon(out, wallSlot, r, base + 0.13, base + 0.44, wallTint, {
      minLength: 2,
      offset: 0.062,
      inset: 0,
    });
}

function cross(out, center, y, size, detail) {
  const [x, z] = center,
    w = detail === 0 ? 0.08 : 0.055;
  beam(out, 'lead', [x, y - 0.04, z], [x, y + size, z], w, w, iron);
  beam(
    out,
    'lead',
    [x - size * 0.34, y + size * 0.64, z],
    [x + size * 0.34, y + size * 0.64, z],
    w,
    w,
    iron,
  );
}

function dome(out, church, detail) {
  const { dome: center, base, drumBase, drumRadius: r, drumHeight, domeRise } = church;
  const floor = base + drumBase,
    top = floor + drumHeight;
  const n = detail === 3 ? 40 : detail === 2 ? 24 : detail === 1 ? 16 : 8;
  const rad = (h, radius, count = n) => radialRing(h, radius, radius, count, center, Math.PI / 8);
  const drum = rad(floor - 0.21, r, 8).map(([x, , z]) => [x, z]);
  extrude(
    out,
    'trim',
    rad(floor - 0.29, r + 0.18, 8).map(([x, , z]) => [x, z]),
    floor - 0.35,
    floor + 0.24,
    trim,
  );
  extrude(out, 'red', drum, floor + 0.12, top, red);
  extrude(
    out,
    'trim',
    rad(top, r + 0.13, 8).map(([x, , z]) => [x, z]),
    top - 0.12,
    top + 0.09,
    trim,
    { top: detail !== 0 },
  );
  const shaping =
    detail >= 2
      ? [
          [0, 1.015],
          [0.185, 0.988],
          [0.41, 0.9],
          [0.65, 0.752],
          [0.83, 0.547],
          [0.946, 0.296],
          [1, 0.035],
        ]
      : detail === 1
        ? [
            [0, 1.02],
            [0.46, 0.873],
            [0.82, 0.552],
            [1, 0.04],
          ]
        : [
            [0, 1.02],
            [0.61, 0.79],
            [1, 0.04],
          ];
  loft(
    out,
    'lead',
    shaping.map(([v, scale]) => rad(top + 0.05 + domeRise * v, r * scale)),
    lead,
  );
  cross(out, center, top + 0.05 + domeRise, church === site.virgin ? 1.13 : 0.67, detail);
  if (!detail) return;
  for (const f of edges(drum)) {
    const u = f.length * 0.5,
      p = f.P;
    const height = drumHeight * 0.67;
    pane(out, f, u, floor + 0.28, f.length * 0.44, height, detail, {
      mullions: church === site.virgin ? 1 : 0,
    });
    const margin = f.length * 0.44;
    const rise = margin * 0.66;
    const spring = top - 0.28 - rise;
    const steps = detail >= 2 ? 10 : 5;
    const inner = roundArch(margin, steps),
      outer = roundArch(margin + 0.12, steps);
    for (let i = 0; i < steps; i++) {
      const point = ([x, y], offset) => p(u + x, spring + (y * rise) / margin + offset, 0.148);
      quad4(
        out,
        'trim',
        point(inner[i], 0),
        point(inner[i + 1], 0),
        point(outer[i + 1], 0.085),
        point(outer[i], 0.085),
        trim,
      );
    }
    for (const side of [-1, 1]) {
      const x = u + margin * side;
      fbox(out, 'trim', f, x - 0.065, x + 0.065, floor + 0.28, spring, 0.065, 0.183, trim);
    }
  }
}

function mainChurch(out, detail) {
  const church = site.virgin;
  for (const s of church.roofs) {
    roofed(out, s, s.stone, s.stone === 'rubble' ? narthex : marble, 'lead', lead, detail);
  }
  dome(out, church, detail);
  if (!detail) return;
  const southDoor = wallFace([4.29, 29.56], [9.42, 30.035]);
  const westDoor = wallFace([-23.14, 13.95], [-23.67, 20.48]);
  const portal = (f, w, h, rings) => {
    const u = f.length * 0.5,
      y = church.base;
    pane(out, f, u, y + 0.19, w, h, detail, { slot: 'oak', tint: oak, depth: 0.16 });
    if (detail === 1) return;
    for (let i = 0; i < rings; i++) {
      const r = w * 0.5 + 0.17 + i * 0.23;
      const arch = roundArch(r, 12),
        c = f.P;
      for (let j = 1; j < arch.length; j++) {
        const [x0, y0] = arch[j - 1],
          [x1, y1] = arch[j];
        beam(
          out,
          'trim',
          c(u + x0, y + h - w * 0.43 + y0, 0.221),
          c(u + x1, y + h - w * 0.43 + y1, 0.221),
          0.11,
          0.13,
          trim,
        );
      }
      for (const v of [-r, r])
        fbox(
          out,
          'trim',
          f,
          u + v - 0.057,
          u + v + 0.057,
          y + 0.2,
          y + h - w * 0.43,
          0.076,
          0.236,
          trim,
        );
    }
    fbox(out, 'trim', f, u - w * 0.63, u + w * 0.63, y + 0.03, y + 0.19, -0.4, 0.65, trim);
  };
  portal(southDoor, 1.67, 3.62, 3);
  portal(westDoor, 2.12, 4.26, 3);
  for (const [a, b] of [
    [
      [-7.99, 23.45],
      [-3.77, 23.78],
    ],
    [
      [-2.16, 23.86],
      [1.9, 24.2],
    ],
    [
      [2.71, 14.32],
      [-1.42, 13.99],
    ],
    [
      [-2.05, 13.9],
      [-6.5, 13.55],
    ],
    [
      [11.9, 25.49],
      [14.83, 25.73],
    ],
    [
      [18.4, 21.39],
      [18.23, 19.6],
    ],
  ]) {
    const f = wallFace(a, b),
      n = f.length > 8 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const u = (f.length * (i + 0.5)) / n;
      pane(out, f, u, church.base + 4.17, 0.88, 2.45, detail, { mullions: 1 });
      if (detail >= 2)
        fbox(
          out,
          'trim',
          f,
          u - 0.51,
          u + 0.51,
          church.base + 4.1,
          church.base + 4.22,
          0.04,
          0.25,
          trim,
        );
    }
  }
  if (detail >= 2) {
    const f = wallFace([4.29, 25.98], [9.42, 26.45]);
    pane(out, f, f.length * 0.5, church.base + 8.18, 1.12, 2.68, detail, {
      mullions: 1,
      depth: 0.093,
    });
    for (const u of [f.length * 0.19, f.length * 0.81])
      pane(out, f, u, church.base + 8.37, 0.47, 1.76, detail);
    pane(out, westDoor, westDoor.length * 0.5, church.base + 6.43, 0.84, 2.26, detail, {
      mullions: 1,
    });
    for (const face of [
      wallFace([-22.43, 24.15], [-20.2, 24.33]),
      wallFace([-19.1, 24.42], [-17.25, 24.57]),
    ]) {
      const u = face.length * 0.5;
      pane(out, face, u, church.base + 1.6, face.length * 0.76, 4.18, detail, {
        slot: 'rubble',
        tint: rgb('776649'),
        depth: 0.055,
      });
    }
    for (const face of [
      wallFace([-8.01, 23.46], [-3.77, 23.79]),
      wallFace([-2.18, 23.88], [1.91, 24.22]),
      wallFace([11.89, 25.5], [14.85, 25.75]),
    ]) {
      for (let u = 0.25; u < face.length - 0.2; u += 0.52)
        fbox(
          out,
          'trim',
          face,
          u - 0.101,
          u + 0.101,
          church.base + 7.79,
          church.base + 8.18,
          -0.07,
          0.15,
          trim,
        );
    }
  }
}

function smallChurch(out, church, detail) {
  const king = church === site.king;
  roofed(
    out,
    church,
    king ? 'marble' : 'rubble',
    king ? marble : narthex,
    king ? 'lead' : 'tile',
    king ? lead : tile,
    detail,
  );
  if (king) dome(out, church, detail);
  if (!detail) return;
  const walls = edges(church.r).filter((f) => f.length > (king ? 1.28 : 2.55));
  const entrance = walls.reduce((a, b) => (a.normal[0] < b.normal[0] ? a : b));
  for (const f of walls) {
    const u = f.length * 0.5;
    if (f === entrance)
      pane(out, f, u, church.base + 0.19, king ? 1.47 : 1.19, king ? 3.08 : 2.52, detail, {
        slot: 'oak',
        tint: oak,
      });
    else
      pane(
        out,
        f,
        u,
        church.base + (king ? 2.63 : 1.55),
        king ? 0.72 : 0.54,
        king ? 2.06 : 1.64,
        detail,
        { mullions: king ? 1 : 0 },
      );
  }
}

function range(out, section, detail) {
  const color = paint[section.stone];
  roofed(out, section, section.stone, color, 'tile', tile, detail);
  if (!detail) return;
  for (const face of edges(section.r)) {
    if (face.length < 3.85) continue;
    const bays = Math.floor(face.length / 3.15);
    for (let i = 0; i < bays; i++) {
      const u = (face.length * (i + 0.5)) / bays;
      pane(out, face, u, section.base + section.eave - 2.41, 0.85, 1.44, detail, { head: 'flat' });
      if (section.eave > 6.5 && detail >= 2) {
        pane(out, face, u, section.base + 0.68, 1.33, 2.67, detail, {
          head: 'round',
          slot: i % 3 === 1 ? 'oak' : 'glass',
          tint: i % 3 === 1 ? oak : glass,
        });
      }
    }
  }
}

function wall(out, { points, height, width }, detail) {
  const pts =
    detail === 0 ? points.filter((_, i) => i % 4 === 0 || i === points.length - 1) : points;
  const sides = pts.map(([x, z, y], i) => {
    const a = pts[Math.max(0, i - 1)],
      b = pts[Math.min(pts.length - 1, i + 1)];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [
      [x - ((b[1] - a[1]) * width * 0.5) / d, z + ((b[0] - a[0]) * width * 0.5) / d, y],
      [x + ((b[1] - a[1]) * width * 0.5) / d, z - ((b[0] - a[0]) * width * 0.5) / d, y],
    ];
  });
  const p = ([x, z, y], h) => [x, y + h, z];
  for (let i = 1; i < sides.length; i++) {
    const [a, b] = sides[i - 1],
      [c, d] = sides[i];
    quad4(out, 'rubble', p(a, -1.5), p(c, -1.5), p(c, height), p(a, height), rubble);
    quad4(out, 'rubble', p(d, -1.5), p(b, -1.5), p(b, height), p(d, height), rubble);
    quad4(out, 'rubble', p(a, height), p(c, height), p(d, height), p(b, height), rubble);
  }
  for (const [a, b] of [sides[0], sides.at(-1).slice().reverse()])
    quad4(out, 'rubble', p(a, -1.5), p(b, -1.5), p(b, height), p(a, height), rubble);
}

function gate(out, data, detail) {
  const { A, B, base, depth, spring, height, top } = data,
    f = wallFace(A, B);
  const west = data === site.westGate;
  const L = f.length,
    p = f.P,
    D = -depth,
    margin = west ? 0.43 : 0.34;
  const radius = L * 0.5 - margin,
    u = L * 0.5;
  const h = height - spring;
  const crown = (v) => base + spring + h * v;
  const arch = roundArch(radius, detail === 3 ? 16 : detail === 2 ? 10 : detail === 1 ? 8 : 4);
  for (const [a, b] of [
    [west ? -2.27 : -0.63, margin],
    [L - margin, L + (west ? 2.04 : 0.63)],
  ])
    fbox(out, 'rubble', f, a, b, base - 1.9, base + top, D, 0.09, rubble);
  if (detail)
    for (const [x0, x1] of [
      [0, margin],
      [L - margin, L],
    ])
      fbox(out, 'trim', f, x0, x1, base - 0.09, crown(0), D - 0.027, 0.142, trim);
  for (let i = 1; i < arch.length; i++) {
    const [x, y] = arch[i - 1],
      [X, Y] = arch[i];
    const a = u + x,
      b = u + X,
      aY = crown(y / radius),
      bY = crown(Y / radius);
    quad4(
      out,
      'rubble',
      p(a, aY, 0.09),
      p(b, bY, 0.09),
      p(b, base + top, 0.09),
      p(a, base + top, 0.09),
      rubble,
    );
    quad4(
      out,
      'rubble',
      p(b, bY, D),
      p(a, aY, D),
      p(a, base + top, D),
      p(b, base + top, D),
      rubble,
    );
    quad4(out, 'trim', p(a, aY, D), p(b, bY, D), p(b, bY, 0.15), p(a, aY, 0.15), trim);
    if (detail) {
      const bw = 0.31,
        lo = u + (x * (radius + bw)) / radius,
        hi = u + (X * (radius + bw)) / radius;
      quad4(
        out,
        'trim',
        p(a, aY, 0.156),
        p(b, bY, 0.156),
        p(hi, bY + (bw * Y) / radius, 0.157),
        p(lo, aY + (bw * y) / radius, 0.157),
        trim,
      );
    }
  }
  fbox(
    out,
    'rubble',
    f,
    west ? -2.33 : -0.35,
    L + (west ? 2.12 : 0.35),
    base + top - 0.15,
    base + top,
    D - 0.07,
    0.16,
    rubble,
  );
  if (west) {
    const set = base + top;
    const r = data.ring;
    for (const [a, b] of [
      [r[0], r[1]],
      [r[4], r[5]],
    ]) {
      const face = wallFace(a, b);
      if (detail && face.length > 2.3)
        pane(out, face, face.length * 0.5, set - 3.87, 0.7, 1.94, detail);
    }
    extrude(out, 'rubble', r, set - 0.18, set + 0.21, rubble, { topSlot: 'tile', topColor: tile });
  } else {
    for (const t of data.towers) {
      const corner = t
        .map((v, i) => (i % 2 === 0 || i === t.length - 1 ? v : null))
        .filter(Boolean);
      const r = detail === 0 ? corner : t;
      const rim = base + top + 1.44;
      extrude(out, 'rubble', r, base - 3.17, rim, rubble);
      if (detail >= 2)
        ribbon(out, 'trim', r, rim - 0.13, rim, trim, { minLength: 0.32, inset: 0, offset: 0.041 });
    }
    const [x, y, z] = p(u, base + top, -0.15);
    cross(out, [x, z], y, 0.74, detail);
  }
}

function build(surfaces, detail) {
  // Triangulate the mapped roofs and pass their faces through the shared surface author.
  const out = {
    ...surfaces,
    addCap(slot, ref, ring, holes, height, normal, uv, tint) {
      const scratch = new MeshBufferBuilder();
      if (!scratch.addCap('wall', ref, ring, holes, height, normal, uv, tint)) return false;
      const { positions, indices } = scratch.finalize();
      for (let i = 0; i < indices.length; i += 3) {
        const points = [0, 1, 2].map((j) =>
          positions.slice(indices[i + j] * 3, indices[i + j] * 3 + 3),
        );
        surfaces.addTriangle(
          slot,
          ref,
          points,
          normal,
          points.map((p) => uv([p[0], p[2]])),
          tint,
        );
      }
      return true;
    },
  };
  mainChurch(out, detail);
  smallChurch(out, site.king, detail);
  smallChurch(out, site.nicholas, detail);
  for (const section of site.wings)
    if (detail || skylineRanges.has(section.id)) range(out, section, detail);
  for (const section of site.perimeter) wall(out, section, detail);
  if (detail >= 2) for (const ruin of site.ruins) wall(out, ruin, detail);
  gate(out, site.eastGate, detail);
  gate(out, site.westGate, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
