import { beam } from '../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { withFootprintCaps } from '../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  extrude,
  facade,
  fbox,
  lathe,
  quad4,
  rgb,
  tri,
} from '../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

export const surfaces = {
  stone: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.94 },
  timber: { slot: 'wall', graph: 'wood_plain', roughness: 0.9 },
  lacquer: { slot: 'trim', graph: 'wood_vertical', roughness: 0.77 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.93 },
  tiles: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.93 },
  bronze: { slot: 'trim', graph: 'metal_copper', roughness: 0.81 },
};

const stone = rgb('8a8480');
const paving = rgb('aaa598');
const plaster = rgb('d9d2bd');
const black = rgb('4f4540');
const darkRed = rgb('703b32');
const red = rgb('a64632');
const weathered = rgb('756557');
const gold = rgb('bc9a53');
const teal = rgb('628279');
const slate = rgb('51585b');
const bronze = rgb('666a58');

const mix = (a, b, t) => a + (b - a) * t;
const xz = ([x, , z]) => [x, z];
const between = (a, b, t) => a.map((v, i) => mix(v, b[i], t));

function roof(out, f, w, d, y, rise, detail, options = {}) {
  const { curl = 0.38, hip = 0.68, tint = slate, crest = false } = options;
  const horizontal = [1, 3, 5, 8][detail];
  const vertical = [1, 2, 4, 6][detail];
  const slopeRows = Array.from({ length: vertical + 1 }, (_, row) => {
    const t = row / vertical;
    const u = mix(w, w * hip, t);
    const v = mix(d, Math.max(0.09, d * 0.047), t);
    const edges = [
      [-u, v],
      [u, v],
      [u, -v],
      [-u, -v],
    ];
    return edges.flatMap((corner, i) =>
      Array.from({ length: horizontal }, (_, j) => {
        const s = j / horizontal;
        const [x, z] = between(corner, edges[(i + 1) % edges.length], s);
        const lift = Math.pow(Math.abs(2 * s - 1), 3.2) * curl * (1 - t);
        return f.P(x, y + rise * Math.pow(t, 1.52) + lift, z);
      }),
    );
  });
  for (let row = 1; row < slopeRows.length; row++) {
    const lower = slopeRows[row - 1];
    const upper = slopeRows[row];
    for (let i = 0; i < lower.length; i++) {
      const j = (i + 1) % lower.length;
      quad4(out, 'tiles', lower[i], lower[j], upper[j], upper[i], tint);
    }
  }
  const ridge = slopeRows.at(-1);
  const top = f.P(0, y + rise + 0.008, 0);
  for (let i = 0; i < ridge.length; i++)
    tri(out, 'tiles', ridge[i], ridge[(i + 1) % ridge.length], top, tint);
  const lip = slopeRows[0];
  const lipDepth = Math.max(0.12, Math.min(0.42, d * 0.069));
  const underside = ([x, Y, z]) => [x, Y - lipDepth, z];
  for (let i = 0; i < lip.length; i++) {
    const j = (i + 1) % lip.length;
    quad4(out, 'lacquer', lip[i], underside(lip[i]), underside(lip[j]), lip[j], black);
    if (detail === 0) continue;
    const soffit = (point) => between(underside(point), f.P(0, y - lipDepth, 0), 0.37);
    quad4(
      out,
      'timber',
      underside(lip[i]),
      soffit(lip[i]),
      soffit(lip[j]),
      underside(lip[j]),
      black,
    );
  }
  if (detail < 2) return;
  beam(
    out,
    'tiles',
    f.P(-w * hip, y + rise + 0.09),
    f.P(w * hip, y + rise + 0.09),
    0.19,
    Math.max(0.18, d * 0.047),
    tint,
  );
  for (const side of [-1, 1]) {
    for (const face of [-1, 1]) {
      const a = f.P(w * side, y + curl, d * face);
      const b = f.P(w * hip * side, y + rise, 0);
      const mid = f.P(mix(w, w * hip, 0.48) * side, y + rise * 0.34 + curl * 0.52, d * 0.54 * face);
      beam(out, 'tiles', a, mid, 0.12, 0.13, tint);
      beam(out, 'tiles', mid, b, 0.12, 0.13, tint);
    }
    if (crest) {
      const at = f.P(w * hip * side, y + rise + 0.12);
      beam(out, 'bronze', at, f.P((w * hip + 0.21) * side, y + rise + 0.6), 0.22, 0.24, gold);
    }
  }
}

function gableCanopy(out, f, w, d, y, depth, rise, detail) {
  const segments = [4, 6, 10, 14][detail];
  const profile = (t) =>
    y + rise * (0.59 + 0.55 * Math.cos(Math.PI * t) + 0.16 * Math.cos(2 * Math.PI * t));
  for (let i = 0; i < segments; i++) {
    const s = (2 * i) / segments - 1;
    const t = (2 * (i + 1)) / segments - 1;
    const a = f.P(s * w, profile(s), d);
    const b = f.P(t * w, profile(t), d);
    quad4(
      out,
      'tiles',
      a,
      b,
      f.P(t * w, profile(t) + 0.26, d - depth),
      f.P(s * w, profile(s) + 0.26, d - depth),
      slate,
    );
    quad4(
      out,
      'lacquer',
      f.P(s * w, y - 0.23, d - 0.02),
      f.P(t * w, y - 0.23, d - 0.02),
      b,
      a,
      black,
    );
    if (detail >= 2) beam(out, 'bronze', a, b, 0.078, 0.09, gold);
  }
}

function bracket(out, f, u, d, y, span, shade, detail) {
  const tiers = detail === 3 ? 3 : 2;
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    const w = span * mix(0.34, 0.76, t);
    const depth = span * mix(0.33, 0.78, t);
    const h = y + i * span * 0.22;
    fbox(out, 'lacquer', f, u - w, u + w, h, h + span * 0.19, d - depth, d + depth, shade);
    if (detail === 3)
      fbox(
        out,
        'bronze',
        f,
        u - w * 0.65,
        u + w * 0.65,
        h + span * 0.185,
        h + span * 0.217,
        d - depth * 0.94,
        d + depth * 0.94,
        gold,
      );
  }
}

function post(out, f, u, d, y, top, radius, tint, detail) {
  if (detail < 2) {
    fbox(out, 'lacquer', f, u - radius, u + radius, y, top, d - radius, d + radius, tint);
    return;
  }
  fbox(
    out,
    'stone',
    f,
    u - radius * 1.13,
    u + radius * 1.13,
    y - 0.054,
    y + radius * 0.28,
    d - radius * 1.13,
    d + radius * 1.13,
    stone,
  );
  lathe(
    out,
    'lacquer',
    xz(f.P(u, y, d)),
    [
      [y, radius, radius],
      [top, radius * 0.91, radius * 0.91],
    ],
    detail === 3 ? 10 : 7,
    tint,
    { capTop: false },
  );
}

function hall(out, f, w, d, grade, height, type, detail, style) {
  const { body, frame, trim, canopy = false, roofTint = slate } = style;
  const gate = type === 'gate' || type === 'towerGate';
  const open = gate || type === 'pavilion' || type === 'cloister';
  const upper = type === 'towerGate';
  const raised = type === 'raisedHall';
  const roofY = grade + height * (upper ? 0.76 : 0.67);
  const crossbeam = upper ? grade + height * 0.48 : roofY - height * 0.13;
  const x = w * 0.75;
  const z = d * 0.68;
  const base =
    grade + (type === 'sanbutsu' ? 1.03 : raised ? height * 0.2 : Math.min(0.62, height * 0.08));
  const radius = Math.min(0.43, w * 0.092, height * 0.072);
  if (detail === 0) {
    if (open) {
      const clearance = gate ? x * 0.36 : x * 0.74;
      for (const side of [-1, 1]) {
        const [u, U] = [side * x, side * clearance].sort((a, b) => a - b);
        fbox(out, 'lacquer', f, u, U, base, crossbeam, -z * 0.3, z * 0.3, frame);
      }
      fbox(out, 'lacquer', f, -x, x, crossbeam, roofY, -z, z, frame);
      if (upper)
        roof(out, f, w, d, crossbeam + height * 0.04, height * 0.11, detail, {
          curl: height * 0.032,
          tint: roofTint,
        });
    } else {
      fbox(out, style.wallSlot, f, -x, x, base, roofY + height * 0.05, -z, z, body);
    }
    if (type === 'sanbutsu')
      roof(out, f, w, d, grade + height * 0.38, height * 0.12, detail, { curl: 0.38, hip: 0.81 });
    roof(
      out,
      f,
      w * (upper ? 0.9 : 1),
      d * (upper ? 0.86 : 1),
      roofY,
      grade + height - roofY,
      detail,
      { curl: height * 0.029, tint: roofTint },
    );
    return;
  }
  const deep = type === 'cloister';
  const columns = deep ? Math.max(3, Math.ceil(w / 2.1)) : gate ? 3 : w > 8 ? 5 : 3;
  const pathClear = gate ? x * 0.36 : 0;
  const positions = gate
    ? [-x, -pathClear, pathClear, x]
    : Array.from({ length: detail === 0 ? 2 : columns + 1 }, (_, i) =>
        mix(-x, x, i / (detail === 0 ? 1 : columns)),
      );
  if (!open) {
    fbox(out, style.wallSlot, f, -x, x, base, roofY + height * 0.05, -z, z, body);
    if (detail >= 1) {
      for (const side of [-1, 1]) {
        const spacing = (2 * x) / (columns + 1);
        for (let i = 0; i < columns; i++) {
          const u = -x + (i + 1) * spacing;
          const a = side * z;
          const panel = (width, bottom, top, depth, tint) =>
            fbox(
              out,
              'lacquer',
              f,
              u - width,
              u + width,
              bottom,
              top,
              Math.min(a, a + side * depth),
              Math.max(a, a + side * depth),
              tint,
            );
          panel(spacing * 0.32, base + 0.15, base + height * 0.36, 0.087, trim);
          panel(spacing * 0.263, base + 0.22, base + height * 0.328, 0.12, black);
          if (detail >= 2)
            for (const j of [-1, 0, 1]) {
              const U = u + j * spacing * 0.135;
              beam(
                out,
                'lacquer',
                f.P(U, base + height * 0.16, a + side * 0.126),
                f.P(U, base + height * 0.33, a + side * 0.126),
                0.049,
                0.04,
                frame,
              );
            }
        }
      }
    }
  }
  for (const side of [-1, 1]) {
    for (const u of positions) {
      post(out, f, u, side * z, base, crossbeam + height * 0.015, radius, frame, detail);
      if (detail >= 2)
        bracket(
          out,
          f,
          u,
          side * z,
          roofY - height * 0.072,
          height * 0.087,
          upper ? teal : frame,
          detail,
        );
    }
    const v = side * z;
    fbox(
      out,
      'lacquer',
      f,
      -w * 0.89,
      w * 0.89,
      crossbeam,
      crossbeam + height * 0.067,
      v - radius,
      v + radius,
      trim,
    );
    fbox(
      out,
      'lacquer',
      f,
      -w * 0.84,
      w * 0.84,
      roofY - height * 0.077,
      roofY,
      v - radius * 1.15,
      v + radius * 1.15,
      frame,
    );
  }
  if (gate) {
    for (const side of [-1, 1]) {
      const [left, right] = [side * pathClear, side * x].sort((a, b) => a - b);
      fbox(
        out,
        'lacquer',
        f,
        left,
        right,
        base,
        crossbeam,
        -z * 0.34,
        z * 0.34,
        upper ? black : red,
      );
      if (detail >= 2) {
        fbox(
          out,
          'lacquer',
          f,
          left + radius * 0.65,
          right - radius * 0.65,
          crossbeam - height * 0.12,
          crossbeam - height * 0.079,
          z * 0.34,
          z * 0.38,
          gold,
        );
      }
    }
  }
  if (upper) {
    fbox(out, style.wallSlot, f, -x * 0.85, x * 0.85, crossbeam, roofY, -z * 0.85, z * 0.85, body);
    if (detail >= 1) {
      for (const s of [-1, 1])
        for (let j = -2; j <= 2; j++) {
          const u = j * x * 0.29;
          fbox(
            out,
            'lacquer',
            f,
            u - radius * 0.7,
            u + radius * 0.7,
            crossbeam + height * 0.12,
            roofY - height * 0.063,
            s * z * 0.86 - 0.09,
            s * z * 0.86 + 0.09,
            trim,
          );
        }
    }
    roof(out, f, w, d, crossbeam + height * 0.065, height * 0.124, detail, {
      curl: height * 0.042,
      tint: roofTint,
      hip: 0.74,
    });
  }
  if (type === 'sanbutsu') {
    const lower = grade + height * 0.38;
    roof(out, f, w, d, lower, height * 0.12, detail, { curl: 0.52, hip: 0.81 });
    fbox(out, 'stone', f, -w * 0.74, w * 0.74, grade - 0.61, base, d * 0.45, d * 0.68, paving);
    const steps = [2, 3, 6, 9][detail];
    for (let i = 0; i < steps; i++) {
      const top = mix(grade, base, (i + 1) / steps);
      fbox(
        out,
        'stone',
        f,
        -w * 0.58,
        w * 0.58,
        grade - 0.49,
        top,
        d * 0.67,
        mix(d * 0.97, d * 0.69, i / steps),
        paving,
      );
    }
  }
  if (raised) {
    const deckX = w * 0.88;
    const deckZ = d * 0.9;
    fbox(out, 'timber', f, -deckX, deckX, base - 0.14, base, -deckZ, deckZ, frame);
    for (const side of [-1, 1])
      for (const u of [-deckX, 0, deckX])
        post(out, f, u, side * deckZ, grade + 0.17, base, 0.15, frame, detail);
    for (const side of [-1, 1]) {
      const u = side * deckX;
      beam(
        out,
        'lacquer',
        f.P(u, base + 0.52, -deckZ),
        f.P(u, base + 0.52, deckZ),
        0.1,
        0.075,
        frame,
      );
      for (const v of [-deckZ, 0, deckZ]) post(out, f, u, v, base, base + 0.57, 0.078, frame, 0);
    }
    for (let i = 0, steps = [2, 3, 5, 7][detail]; i < steps; i++)
      fbox(
        out,
        'timber',
        f,
        -w * 0.32,
        w * 0.32,
        grade + mix(0.19, base - grade, i / steps),
        grade + mix(0.19, base - grade, (i + 1) / steps),
        deckZ - 0.05,
        deckZ + (steps - i) * 0.16,
        frame,
      );
  }
  roof(
    out,
    f,
    w * (upper ? 0.9 : 1),
    d * (upper ? 0.86 : 1),
    roofY,
    grade + height - roofY,
    detail,
    { curl: height * 0.038, tint: roofTint, hip: deep ? 0.91 : 0.69, crest: canopy },
  );
  if (canopy)
    gableCanopy(
      out,
      f,
      w * 0.42,
      d * 1.02,
      grade + height * (upper ? 0.76 : 0.66),
      d * 0.64,
      height * 0.115,
      detail,
    );
  if (type === 'pavilion' && style.bell) {
    lathe(
      out,
      'bronze',
      f.origin,
      [
        [base + height * 0.16, w * 0.31, w * 0.31],
        [base + height * 0.26, w * 0.27, w * 0.27],
        [base + height * 0.46, w * 0.16, w * 0.16],
      ],
      detail >= 2 ? 12 : 6,
      bronze,
    );
  }
}

function pagoda(out, f, w, d, grade, height, detail) {
  const floor = height * 0.165;
  for (let storey = 0; storey < 5; storey++) {
    const size = 1 - storey * 0.084;
    const y = grade + 0.63 + storey * floor;
    const top = y + floor * 0.62;
    const X = w * size;
    const Z = d * size;
    fbox(out, 'lacquer', f, -X * 0.63, X * 0.63, y, top, -Z * 0.61, Z * 0.61, darkRed);
    if (detail > 0)
      for (const s of [-1, 1])
        for (const side of [-1, 1]) {
          const U = s * X * 0.61;
          const V = side * Z * 0.6;
          post(out, f, U, V, y, top - 0.12, w * 0.05, red, detail);
          if (detail >= 2) bracket(out, f, U, V, top - 0.66, w * 0.12, teal, detail);
        }
    if (detail >= 2) {
      fbox(
        out,
        'lacquer',
        f,
        -X * 0.68,
        X * 0.68,
        top - 0.66,
        top - 0.47,
        -Z * 0.67,
        Z * 0.67,
        gold,
      );
      for (const s of [-1, 1])
        beam(
          out,
          'lacquer',
          f.P(-X * 0.73, y + 0.31, s * Z * 0.74),
          f.P(X * 0.73, y + 0.31, s * Z * 0.74),
          0.15,
          0.14,
          red,
        );
    }
    roof(out, f, X, Z, top, floor * 0.35, detail, { curl: w * 0.106, hip: 0.17 });
  }
  const start = grade + height * 0.831;
  lathe(
    out,
    'bronze',
    f.origin,
    [
      [start, w * 0.161, w * 0.161],
      [start + height * 0.029, w * 0.085, w * 0.085],
      [grade + height - 0.36, 0.085, 0.085],
      [grade + height, 0.018, 0.018],
    ],
    detail >= 2 ? 10 : 5,
    bronze,
  );
  if (detail >= 1)
    for (let i = 0; i < 9; i++) {
      const y = start + height * (0.04 + i * 0.011);
      const r = w * (0.107 - i * 0.004);
      lathe(
        out,
        'bronze',
        f.origin,
        [
          [y, r, r],
          [y + height * 0.003, r, r],
        ],
        detail >= 2 ? 10 : 5,
        bronze,
      );
    }
}

function torii(out, f, w, d, grade, height, detail, style) {
  const radius = Math.max(0.12, Math.min(d * 0.57, w * 0.094));
  const top = grade + height;
  for (const side of [-1, 1])
    post(out, f, side * w * 0.65, 0, grade, top - height * 0.07, radius, style.frame, detail);
  fbox(
    out,
    'lacquer',
    f,
    -w * 0.82,
    w * 0.82,
    top - height * 0.33,
    top - height * 0.24,
    -radius * 0.68,
    radius * 0.68,
    style.frame,
  );
  fbox(
    out,
    'lacquer',
    f,
    -w * 0.15,
    w * 0.15,
    top - height * 0.26,
    top - height * 0.095,
    -radius * 0.49,
    radius * 0.49,
    style.trim,
  );
  const y = top - height * 0.08;
  for (const side of [-1, 1])
    beam(out, 'timber', f.P(0, y), f.P(w * side, top), radius * 2, height * 0.12, style.frame);
}

function tomb(out, f, w, grade, detail) {
  const ring = (levels, tint, slot) =>
    lathe(
      out,
      slot,
      f.origin,
      levels.map(([y, size]) => [y + grade, w * size, w * size]),
      detail >= 2 ? 16 : 8,
      tint,
    );
  ring(
    [
      [0.18, 0.87],
      [0.46, 0.87],
      [0.48, 0.73],
      [0.7, 0.73],
      [0.71, 0.56],
      [0.99, 0.56],
    ],
    stone,
    'stone',
  );
  ring(
    [
      [0.99, 0.49],
      [1.14, 0.49],
      [1.19, 0.39],
      [1.55, 0.46],
      [2.1, 0.4],
      [2.27, 0.34],
      [2.32, 0.65],
      [2.46, 0.69],
      [2.72, 0.55],
      [3.16, 0.16],
      [3.27, 0.09],
      [3.42, 0.12],
      [3.65, 0.03],
    ],
    bronze,
    'bronze',
  );
}

const styles = {
  ivory: { body: plaster, frame: plaster, trim: gold, wallSlot: 'plaster', canopy: true },
  gilt: { body: black, frame: black, trim: gold, wallSlot: 'timber', canopy: true },
  temple: { body: darkRed, frame: red, trim: black, wallSlot: 'timber', canopy: false },
  sanctuary: { body: darkRed, frame: red, trim: gold, wallSlot: 'timber', canopy: true },
  oldWood: { body: weathered, frame: weathered, trim: black, wallSlot: 'timber' },
  store: { body: red, frame: darkRed, trim: gold, wallSlot: 'timber' },
  bell: { body: darkRed, frame: red, trim: gold, wallSlot: 'timber', bell: true },
  stone: { body: stone, frame: stone, trim: black, wallSlot: 'stone' },
};

function build(out, parts, detail) {
  const caps = withFootprintCaps(out);
  for (const part of parts) {
    const { center, along, width, depth, base, grade, height, kind, outline } = part;
    if (detail === 0 && part.omitSkyline) continue;
    const f = facade(center, along);
    const w = width * 0.5;
    const d = depth * 0.5;
    const style = styles[part.style];
    const resolution = Math.min(part.detailLimits?.[detail] ?? detail, part.maxDetail ?? 3);
    if (kind === 'torii') {
      torii(out, f, w, d, grade, height, resolution, style);
      continue;
    }
    if (part.segments) {
      for (const segment of part.segments) {
        extrude(caps, 'stone', segment.outline, segment.base, segment.grade + 0.19, stone, {
          topColor: paving,
        });
        hall(
          out,
          facade(segment.center, segment.along),
          segment.width * 0.5,
          segment.depth * 0.5,
          segment.grade,
          height,
          kind,
          resolution,
          style,
        );
      }
      continue;
    }
    extrude(caps, 'stone', outline, base, grade + 0.19, stone, { topColor: paving });
    if (kind === 'tomb') {
      tomb(out, f, w, grade, resolution);
    } else if (kind === 'pagoda') {
      pagoda(out, f, w, d, grade, height, resolution);
    } else if (part.ranges) {
      for (const range of part.ranges) {
        hall(
          out,
          facade(range.center, along),
          range.width * 0.5,
          range.depth * 0.5,
          grade,
          height * range.heightScale,
          range.kind ?? kind,
          resolution,
          { ...style, canopy: style.canopy && range.canopy },
        );
      }
    } else {
      hall(out, f, w, d, grade, height, kind, resolution, style);
    }
  }
}

export function nikkoShrine(parts) {
  const buildSkyline = (out) => build(out, parts, 0);
  const buildDistrict = (out) => build(out, parts, 1);
  const buildStreet = (out) => build(out, parts, 2);
  const buildCloseup = (out) => build(out, parts, 3);
  return {
    surfaces,
    buildSkyline,
    buildDistrict,
    buildStreet,
    buildCloseup,
    buildMaster: buildCloseup,
  };
}
