import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  at,
  block,
  cap,
  closed,
  edge,
  face,
  mix,
  pairs,
  palette,
  panel,
  pavilion,
  rect,
  surface,
  trimBlock,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const color = palette({
  wall: 'c7c2b3',
  pilaster: 'b8b2a4',
  molding: 'b7b0a1',
  deep: 'a0998b',
  base: 'b1ab9d',
  joint: '8d887b',
  roof: '615e56',
  cupola: '686d65',
  glass: '4f5a59',
  sash: 'e0ddd0',
  door: '62584b',
  finial: '535a51',
});
const surfaces = {
  wall: surface('wall', 'plaster_lime', 0.88),
  stone: surface('foundation', 'stone_limestone', 0.92),
  trim: surface('trim', 'stone_ashlar', 0.88),
  roof: surface('roof', 'slate', 0.88),
  glass: surface('window', 'storefront', 0.52, 0.035),
  wood: surface('door', 'wood_plain', 0.83),
  metal: surface('roof', 'metal_painted', 0.73, 0.16),
};
const up = [0, 1, 0],
  down = [0, -1, 0];

function apertures(out, wall, slots, bottom, top, fill, lod) {
  let end = 0;
  for (const window of slots) {
    const { center, width, low, high, rise, doorway, frame } = window;
    const left = center - width / 2,
      right = center + width / 2;
    if (left - end > 0.0001) panel(out, fill, wall, end, left, bottom, top, 0, frame);
    end = right;
    if (low > bottom + 0.02) panel(out, fill, wall, left, right, bottom, low, 0, frame);
    const jamb = doorway ? 0.5 : 0.21;
    const n = rise ? [4, 7, 10, 13][lod] : 1;
    const curve = Array.from({ length: n + 1 }, (_, i) => {
      const angle = Math.PI * (1 - i / n);
      return [center + (width / 2) * Math.cos(angle), high + rise * Math.sin(angle)];
    });
    const field = doorway ? 'wood' : 'glass';
    const fieldColor = doorway ? color.door : color.glass;
    panel(out, field, wall, left, right, low, high, -jamb, fieldColor);
    if (rise)
      face(
        out,
        field,
        curve.map(([x, y]) => wall.p(x, y, -jamb)),
        wall.normal,
        fieldColor,
      );
    for (const [[a, b], [c, d]] of pairs(curve)) {
      face(
        out,
        fill,
        [wall.p(a, b), wall.p(c, d), wall.p(c, top), wall.p(a, top)],
        wall.normal,
        frame,
      );
      face(
        out,
        'trim',
        [wall.p(a, b, -jamb), wall.p(c, d, -jamb), wall.p(c, d), wall.p(a, b)],
        down,
        color.deep,
      );
      if (rise && lod)
        face(
          out,
          'trim',
          [
            wall.p(a, b, 0.072),
            wall.p(c, d, 0.072),
            wall.p(c, d + 0.17, 0.072),
            wall.p(a, b + 0.17, 0.072),
          ],
          wall.normal,
          color.molding,
        );
    }
    const side = [wall.normal[2], 0, -wall.normal[0]];
    face(
      out,
      'trim',
      [wall.p(left, low, -jamb), wall.p(left, low), wall.p(left, high), wall.p(left, high, -jamb)],
      side.map((n) => -n),
      color.deep,
    );
    face(
      out,
      'trim',
      [
        wall.p(right, low),
        wall.p(right, low, -jamb),
        wall.p(right, high, -jamb),
        wall.p(right, high),
      ],
      side,
      color.deep,
    );
    face(
      out,
      'trim',
      [wall.p(left, low, -jamb), wall.p(right, low, -jamb), wall.p(right, low), wall.p(left, low)],
      up,
      color.molding,
    );
    if (lod) {
      if (!doorway) {
        trimBlock(
          out,
          'trim',
          wall,
          left - 0.12,
          right + 0.12,
          low - 0.075,
          low + 0.06,
          0,
          0.145,
          color.molding,
        );
        panel(
          out,
          'wood',
          wall,
          left + 0.04,
          right - 0.04,
          mix(low, high, 0.52) - 0.024,
          mix(low, high, 0.52) + 0.034,
          -jamb + 0.027,
          color.sash,
        );
      }
      if (lod > 1)
        panel(
          out,
          'wood',
          wall,
          center - 0.032,
          center + 0.032,
          low,
          rise ? high + rise * 0.89 : high,
          -jamb + 0.036,
          doorway ? color.deep : color.sash,
        );
    }
  }
  if (wall.length - end > 0.0001)
    panel(out, fill, wall, end, wall.length, bottom, top, 0, slots[0]?.frame ?? color.wall);
}

function openings(index, length, level, y, ground, lod) {
  if (!lod && (level !== 0 || (index !== 9 && index !== 16))) return [];
  if (length < 3.4 || index === 15 || index === 18) return [];
  const entrances = level === 0 && (index === 9 || index === 16);
  const count = entrances ? 3 : Math.max(1, Math.round(length / (level === 0 ? 3.6 : 2.87)));
  const pitch = length / count;
  const contents = [];
  for (let j = 0; j < count; j++) {
    const door = entrances && j === 1;
    const w = door
      ? Math.min(2.56, pitch * (index === 9 ? 0.94 : 0.77))
      : Math.min(1.22, pitch * 0.49);
    const rise = level === 1 ? 0 : door ? 0.86 : level === 0 ? 0.49 : 0.52;
    const [low, high] = door
      ? [ground, y + 2.89]
      : [
          [y + 1.1, y + 2.66],
          [y + 5.15, y + 7.52],
          [y + 8.8, y + 10.95],
        ][level];
    contents.push({
      center: (j + 0.5) * pitch,
      width: w,
      low,
      high,
      rise,
      doorway: door,
      frame: level === 0 ? color.base : index === 7 || index === 11 ? color.pilaster : color.wall,
    });
  }
  return contents;
}

function distantOpenings(out, wall, slots, lod) {
  for (const { center, width, low, high, rise, doorway } of slots) {
    const field = doorway ? 'wood' : 'glass';
    const tint = doorway ? color.door : color.glass;
    panel(out, field, wall, center - width / 2, center + width / 2, low, high, 0.022, tint);
    if (rise) {
      const segments = lod ? 5 : 3;
      const points = Array.from({ length: segments + 1 }, (_, i) => {
        const angle = Math.PI * (1 - i / segments);
        return wall.p(center + width * 0.5 * Math.cos(angle), high + rise * Math.sin(angle), 0.022);
      });
      face(out, field, points, wall.normal, tint);
    }
  }
}

function courses(out, ring, grade, d, lod) {
  const direction = areaSign(ring);
  const y = d.entranceY,
    h = d.estimateVerticalDimensions;
  const roof = y + h.roof;
  for (const [i, [a, b]] of pairs(closed(ring)).entries()) {
    const wall = edge(a, b, direction);
    const base = Math.min(grade(a), grade(b), y) - 0.43;
    const foot = y + 0.33;
    panel(out, 'stone', wall, 0, wall.length, base, foot, 0, color.base);
    for (const [level, lower, top] of [
      [0, foot, y + h.courseTwo],
      [1, y + h.courseTwo, y + h.courseThree],
      [2, y + h.courseThree, roof],
    ]) {
      const slots = openings(i, wall.length, level, y, foot, lod);
      if (slots.length && lod > 1)
        apertures(out, wall, slots, lower, top, level === 0 ? 'stone' : 'wall', lod);
      else
        panel(
          out,
          level === 0 ? 'stone' : 'wall',
          wall,
          0,
          wall.length,
          lower,
          top,
          0,
          level === 0 ? color.base : color.wall,
        );
      if (lod < 2) distantOpenings(out, wall, slots, lod);
      if (level === 0 && lod > 1) {
        for (const jointY of [y + 0.93, y + 1.61, y + 2.27, y + 2.98, y + 3.66]) {
          let cursor = 0;
          const active = slots.filter((s) => jointY >= s.low - 0.02 && jointY <= s.high + s.rise);
          for (const window of [...active, { center: wall.length, width: 0 }]) {
            const left = window.center - window.width / 2 - 0.018;
            if (left > cursor + 0.017)
              panel(out, 'stone', wall, cursor, left, jointY, jointY + 0.023, 0.016, color.joint);
            cursor = window.center + window.width / 2 + 0.018;
          }
        }
      }
    }
    for (const [low, high, depth] of [
      [y + h.courseTwo - 0.08, y + h.courseTwo + 0.15, 0.16],
      [y + h.courseThree - 0.04, y + h.courseThree + 0.2, 0.19],
      [roof - 0.42, roof - 0.18, 0.24],
      [roof - 0.17, roof + 0.17, 0.37],
    ]) {
      if (lod)
        trimBlock(out, 'trim', wall, 0, wall.length, low, high, -0.016, depth, color.molding);
      else panel(out, 'trim', wall, 0, wall.length, low, high, depth * 0.25, color.molding);
    }
    if (lod > 1 && wall.length > 4) {
      const count = Math.round(wall.length / 1.37);
      for (let k = 0; k < count; k++) {
        const u = ((k + 0.5) * wall.length) / count;
        trimBlock(
          out,
          'trim',
          wall,
          u - 0.115,
          u + 0.115,
          roof - 0.86,
          roof - 0.32,
          -0.01,
          0.23,
          color.deep,
        );
      }
    }
  }
  cap(out, 'roof', ring, roof - 0.085, color.roof);
}

function roundTower(out, info, lod, grade, d) {
  const { center, radius: r, top } = info,
    n = [8, 16, 23, 30][lod];
  const ground = grade(center) - 0.34,
    y = d.entranceY;
  const start = top - 1.87,
    crown = top - 1.11;
  const ring = (h, scale) => radialRing(h, r * scale, r * scale, n, center);
  if (!lod) {
    loft(
      out,
      'wall',
      [ring(ground, 1.015), ring(start - 0.08, 0.965), ring(crown + 0.2, 1.13)],
      color.wall,
      { cap: false },
    );
    loft(
      out,
      'metal',
      [ring(crown + 0.2, 1.13), ring(top - 0.44, 0.79), ring(top - 0.08, 0.31), ring(top, 0.043)],
      color.cupola,
    );
    return;
  }
  loft(out, 'stone', [ring(ground, 1.015), ring(y + 4.68, 1.015)], color.base);
  loft(out, 'wall', [ring(y + 4.68, 0.965), ring(start - 0.08, 0.965)], color.wall);
  loft(
    out,
    'trim',
    [ring(start - 0.13, 1.04), ring(start + 0.05, 1.1), ring(crown, 1.07), ring(crown + 0.2, 1.17)],
    color.molding,
  );
  for (const h of [y + 0.72, y + 4.65, y + 8.18, y + 12.73]) {
    if (lod || h > 8) loft(out, 'trim', [ring(h, 1.012), ring(h + 0.13, 1.065)], color.molding);
  }
  loft(
    out,
    'metal',
    [
      ring(crown + 0.2, 1.1),
      ring(top - 0.69, 0.93),
      ring(top - 0.32, 0.69),
      ring(top - 0.065, 0.26),
      ring(top, 0.045),
    ],
    color.cupola,
  );
  if (lod) {
    const vents = ring(start + 0.09, 1.095).map(([x, , z]) => [x, z]);
    for (let i = 0; i < n; i += lod === 1 ? 3 : 2) {
      const wall = edge(vents[i], vents[(i + 1) % n], 1);
      if (wall.length > 0.12)
        panel(
          out,
          'wood',
          wall,
          wall.length * 0.19,
          wall.length * 0.81,
          start + 0.15,
          crown - 0.035,
          0.014,
          color.finial,
        );
    }
    if (lod > 1) {
      const [x, z] = center;
      beam(out, 'metal', [x, top - 0.03, z], [x, top + 0.62, z], 0.08, 0.08, color.finial);
    }
  }
}

function entranceTower(out, feature, lod, d) {
  const [cx, front] = feature.center,
    [i, j] = feature.indices;
  const left = d.outline[i][0],
    right = d.outline[j][0],
    w = right - left;
  const base = d.entranceY + d.estimateVerticalDimensions.roof - 0.16;
  const rim = rect(left - 0.16, front - 3.06, right + 0.16, front + 0.22);
  const stage = rect(cx - w * 0.44, front - 2.91, cx + w * 0.44, front + 0.07);
  const capping = rect(cx - w * 0.475, front - 3.06, cx + w * 0.475, front + 0.22);
  loft(
    out,
    'wall',
    [
      rim.map((p) => at(p, base)),
      rim.map((p) => at(p, base + 0.67)),
      stage.map((p) => at(p, base + 0.88)),
      stage.map((p) => at(p, base + 1.47)),
    ],
    color.pilaster,
  );
  loft(
    out,
    'trim',
    [capping.map((p) => at(p, base + 1.42)), capping.map((p) => at(p, base + 1.62))],
    color.molding,
  );
  if (lod > 0) {
    for (const x of [cx - w * 0.32, cx, cx + w * 0.32])
      block(out, 'trim', x - 0.38, base + 1.58, front - 0.27, 0.76, 0.42, 0.48, color.molding);
  }
}

function entranceApproach(out, d, grade, lod) {
  if (!lod) return;
  const [a, b] = d.outline.slice(9, 11);
  const left = a[0] + 0.72,
    right = b[0] - 0.72,
    z = (a[1] + b[1]) / 2;
  const street = Math.min(grade([left, z + 2.01]), grade([right, z + 2.01]), d.entranceY);
  const threshold = Math.max(d.entranceY + 0.31, street + 0.27);
  for (let i = 0; i < 3; i++) {
    const rise = mix(street + 0.045, threshold, (i + 1) / 3);
    block(
      out,
      'stone',
      left,
      street - 0.11,
      z + (2 - i) * 0.3,
      right - left,
      rise - street + 0.11,
      0.32,
      color.base,
    );
  }
}

function draw(out, lod, d, grade) {
  courses(out, d.outline, grade, d, lod);
  for (const tower of d.eastTowers) roundTower(out, tower, lod, grade, d);
  for (const tower of d.southTowers) entranceTower(out, tower, lod, d);
  entranceApproach(out, d, grade, lod);
}

const asset = pavilion(
  import.meta.url,
  {
    surfaces,
    brief:
      'Former Victoria Law Courts at 28 Bastion Square, with paired capped eastern turrets, stepped entrance towers and coursed Victorian masonry.',
    camera: [50, 35, 48],
    lookAt: [0, 7.3, -2],
    yaw: 0.79,
    sun: [380, 510, 450],
    views: [
      { name: 'bastion-square-southeast-courthouse', position: [51, 25, 52], lookAt: [0, 7, 0] },
      {
        name: 'round-east-turrets-and-langley-frontage',
        position: [48, 13, 6],
        lookAt: [13, 7, -1.4],
      },
      {
        name: 'rusticated-bastion-square-entrance',
        position: [-2.4, 5.1, 36],
        lookAt: [-1.5, 6.6, 11],
      },
      { name: 'flat-roof-and-historic-wing', position: [-33, 41, -38], lookAt: [0, 9, -2] },
    ],
  },
  draw,
);
const frame = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url)));
export const { skyline, district, street, closeup } = asset;
export const model = {
  ...asset.model,
  category: 'government',
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.91,
    basis: 'The named 28 Bastion Square building perimeter surveyed in OpenStreetMap.',
  },
};
