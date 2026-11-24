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

const rock = rgb('9b846d');
const ashlar = rgb('ac9478');
const pale = rgb('c5b99e');
const rockColors = ['907a65', 'a89174', '9b836e', '837668', 'b5a086'].map(rgb);
const TAU = 2 * Math.PI;
const mix = (a, b, t) => a + (b - a) * t;

function radiusAt(profile, y) {
  for (let i = 1; i < profile.length; i++) {
    const [top, r1] = profile[i];
    if (y > top) continue;
    const [base, r0] = profile[i - 1];
    return mix(r0, r1, Math.max(0, (y - base) / (top - base)));
  }
  return profile.at(-1)[1];
}

function courseHeights(part, detail) {
  const count =
    detail === 0 ? 1 : Math.max(1, Math.ceil(part.height / [1.2, 1.0, 0.45, 0.25][detail]));
  const y = Array.from({ length: count + 1 }, (_, i) => (part.height * i) / count);
  if (part.entry) y.push(part.entry.height);
  const levels = [...new Set(y)].sort((a, b) => a - b);
  return levels.filter((h, i) => i === levels.length - 1 || levels[i + 1] - h > 0.005);
}

function sections(part, detail) {
  const count = part.radius[0] > 8 ? [16, 24, 36, 52][detail] : [6, 9, 16, 24][detail];
  if (!part.entry)
    return Array.from({ length: count }, (_, i) => ({
      a: (i * TAU) / count,
      b: ((i + 1) * TAU) / count,
    }));
  const angle = part.entry.angle;
  const half = Math.asin(part.entry.width / (2 * Math.min(...part.radius)));
  const repeat = part.entry.opposite ? 2 : 1;
  const arc = TAU / repeat;
  const intervals = Math.ceil(count / repeat);
  return Array.from({ length: repeat }, (_, i) => {
    const start = angle + i * arc;
    return [
      { a: start - half, b: start + half, entry: true },
      ...Array.from({ length: intervals }, (_, j) => ({
        a: start + half + (j * (arc - 2 * half)) / intervals,
        b: start + half + ((j + 1) * (arc - 2 * half)) / intervals,
      })),
    ];
  }).flat();
}

function masonryRing(out, part, detail) {
  const sectors = sections(part, detail);
  const courses = courseHeights(part, detail);
  const slot = part.finished ? 'cut' : 'rubble';
  const {
    center: [x, z],
    radius: [rx, rz],
    ground,
    profile,
    phase,
    height,
  } = part;
  const at = (y, angle, inner = false, buried = false) => {
    const f = radiusAt(profile, y / height);
    const broken = Math.sin(5 * angle + phase) * 0.48 + Math.sin(9 * angle + phase * 2) * 0.52;
    const r = f * (1 + part.edge * broken) - (inner ? part.thickness : 0);
    const radial = Math.max(0.09, r);
    const lintel = part.entry?.height ?? 0;
    const rise = Math.max(0, y - lintel) / Math.max(0.2, height - lintel);
    const uneven = part.crown * broken * rise ** 2;
    return [
      x + rx * radial * Math.cos(angle),
      ground + (buried ? -part.embed : y + uneven),
      z + rz * radial * Math.sin(angle),
    ];
  };
  for (let c = 1; c < courses.length; c++) {
    const below = courses[c - 1];
    const above = courses[c];
    const entryOpen = part.entry && above <= part.entry.height + 0.005;
    for (const [i, { a, b, entry }] of sectors.entries()) {
      if (entryOpen && entry) continue;
      const ob0 = at(below, b, false, c === 1);
      const oa0 = at(below, a, false, c === 1);
      const oa1 = at(above, a);
      const ob1 = at(above, b);
      const ia0 = at(below, a, true, c === 1);
      const ib0 = at(below, b, true, c === 1);
      const ia1 = at(above, a, true);
      const ib1 = at(above, b, true);
      const stone = rockColors[(i * 3 + c * 7 + phase) % rockColors.length];
      const base = part.pale ? pale : part.finished ? ashlar : rock;
      const tint = part.finished ? 0.21 : 0.45;
      const color = detail < 2 ? base : base.map((v, j) => mix(v, stone[j], tint));
      quad4(out, slot, ob0, oa0, oa1, ob1, color);
      if (detail > 0) quad4(out, slot, ia0, ib0, ib1, ia1, rock);
      if (c === courses.length - 1) {
        quad4(out, 'rubble', oa1, ia1, ib1, ob1, color);
        if (part.closed) tri(out, 'rubble', ia1, [x, ground + height - 0.1, z], ib1, color);
      }
      if (entryOpen && sectors.at(i - 1).entry) quad4(out, slot, oa0, ia0, ia1, oa1, color);
      if (entryOpen && sectors[(i + 1) % sectors.length].entry)
        quad4(out, slot, ib0, ob0, ob1, ib1, color);
      if (entry && Math.abs(below - part.entry.height) < 0.008)
        quad4(out, slot, ob0, ib0, ia0, oa0, color);
    }
  }
  if (!part.entry || detail === 0) return;
  const { angle, height: clear, width, opposite } = part.entry;
  for (const direction of opposite ? [angle, angle + Math.PI] : [angle]) {
    const run = [-Math.sin(direction), Math.cos(direction)];
    const p = [x + rx * Math.cos(direction) * 0.96, z + rz * Math.sin(direction) * 0.96];
    const frame = facade(p, run);
    if (clear < height - 0.14)
      fbox(
        out,
        slot,
        frame,
        -width * 0.76,
        width * 0.76,
        ground + clear,
        ground + clear + 0.18,
        -0.17,
        0.11,
        ashlar,
      );
    fbox(
      out,
      'rubble',
      frame,
      -width * 0.46,
      width * 0.46,
      ground - 0.07,
      ground + 0.1,
      -0.28,
      0.37,
      rock,
    );
  }
}

function cairn(out, part, detail) {
  const {
    center,
    radius: [rx, rz],
    ground,
    height,
    phase,
    embed,
  } = part;
  lathe(
    out,
    'rubble',
    center,
    [
      [ground - embed, rx, rz],
      [ground + height * 0.28, rx * 0.87, rz * 0.91],
      [ground + height * 0.77, rx * 0.52, rz * 0.48],
      [ground + height, rx * 0.21, rz * 0.18],
    ],
    [7, 9, 11, 13][detail],
    rockColors[phase % rockColors.length],
    { capBottom: false, rotation: phase * 0.61 },
  );
  if (detail < 2) return;
  const count = detail === 2 ? 4 : 8;
  for (let i = 0; i < count; i++) {
    const angle = (i * TAU) / count + phase * 0.39;
    const offset = 0.4 + 0.33 * Math.sin(i + phase) ** 2;
    const p = center.map((v, j) => v + (j ? rz * Math.sin(angle) : rx * Math.cos(angle)) * offset);
    const y = ground + height * (1 - offset) * 0.7;
    const a = 0.18 + Math.min(rx, rz) * 0.095;
    lathe(
      out,
      'rubble',
      p,
      [
        [y - 0.22, a, a * 0.71],
        [y + a * 0.37, a * 0.92, a * 0.68],
        [y + a * 0.64, a * 0.57, a * 0.48],
      ],
      5,
      rockColors[(i + phase) % rockColors.length],
      { capBottom: false },
    );
  }
}

function walls(out, site, detail) {
  const caps = withFootprintCaps(out);
  for (const wall of site.walls) {
    const slot = wall.finished ? 'cut' : 'rubble';
    extrude(caps, slot, wall.outline, wall.y0, wall.y1, wall.finished ? ashlar : rock, {
      ...(wall.holes ? { holes: wall.holes } : {}),
      topSlot: 'rubble',
    });
    if (detail < 2 || wall.y1 - wall.y0 < 0.35) continue;
    const [a, b] = wall.outline;
    const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const frame = facade(a, [b[0] - a[0], b[1] - a[1]]);
    const count = Math.max(1, Math.floor(span / (detail === 3 ? 0.6 : 1.1)));
    const y = wall.y1 - 0.24;
    for (let i = 0; i < count; i++) {
      const u0 = (i * span) / count + 0.065;
      const u1 = ((i + 1) * span) / count - 0.065;
      if (u1 <= u0) continue;
      fbox(out, slot, frame, u0, u1, y - 0.06, y + 0.21, -0.17, 0.065, rockColors[i % 5]);
    }
  }
}

export function omanBronzeAgeGeometry(site) {
  const surfaces = {
    rubble: { slot: 'wall', graph: 'stone_drywall', roughness: 0.98 },
    cut: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.97 },
  };
  const build = (out, detail) => {
    for (const part of site.earthworks) {
      if (part.type === 'cairn') cairn(out, part, detail);
      else masonryRing(out, part, detail);
    }
    walls(out, site, detail);
  };
  const buildSkyline = (out) => build(out, 0);
  const buildDistrict = (out) => build(out, 1);
  const buildStreet = (out) => build(out, 2);
  const buildCloseup = (out) => build(out, 3);
  return {
    surfaces,
    buildSkyline,
    buildDistrict,
    buildStreet,
    buildCloseup,
    buildMaster: buildCloseup,
  };
}
