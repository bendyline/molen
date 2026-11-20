import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  block,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  palette,
  panel,
  pairs,
  planarMid,
  rect,
  shell,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const { envelopes: outlines, sections, gate } = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));
const colors = palette({
  brick: '98624f',
  hallBrick: 'a36a56',
  brickShadow: '875b4e',
  stock: '9a8267',
  stone: 'c9bd9e',
  dress: 'dfceaa',
  stoneShade: 'ab9b85',
  oldStone: 'beb39b',
  slate: '575354',
  greenSlate: '646861',
  lead: '6e6a67',
  tile: '805b51',
  glass: '505750',
  pewter: '6c7066',
  iron: '4f4d47',
  wood: '514039',
});
const surfaces = {
  brick: surface('wall', 'brick_flemish', 0.94),
  ashlar: surface('wall', 'stone_ashlar', 0.94),
  stone: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.9 },
  roof: surface('roof', 'tile_flat', 0.91),
  metal: surface('trim', 'metal_painted', 0.64, 0.2),
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.46, metallic: 0.05 },
};
const buried = (p) => grade(p) - 0.55;

function mass(out, outline, low, high, wall, tint) {
  shell(out, outline, typeof low === 'number' ? () => low : low, high, {
    wall,
    roof: 'roof',
    color: tint,
    roofColor: colors.lead,
  });
}

function gable(out, [x0, z0, x1, z1], eave, ridge, lengthZ, wall, tone, roofTone) {
  const point = (u, y, v) => (lengthZ ? [u, y, v] : [v, y, u]);
  const [l, a, r, b] = lengthZ ? [x0, z0, x1, z1] : [z0, x0, z1, x1];
  const c = (l + r) / 2;
  const ring = [point(l, eave, a), point(r, eave, a), point(r, eave, b), point(l, eave, b)];
  const p = point(c, ridge, a);
  const q = point(c, ridge, b);
  face(out, 'roof', [ring[0], p, q, ring[3]], [0, 1, 0], roofTone);
  face(out, 'roof', [ring[1], ring[2], q, p], [0, 1, 0], roofTone);
  const direction = lengthZ ? [0, 0, 1] : [1, 0, 0];
  face(
    out,
    wall,
    [ring[0], ring[1], p],
    direction.map((v) => -v),
    tone,
  );
  face(out, wall, [ring[3], ring[2], q], direction, tone);
}

function tracery(out, level, w, u, low, spring, radius, rise, count, square = false) {
  if (level === 0) {
    panel(out, 'glass', w, u - radius, u + radius, low, spring + rise * 0.5, 0.09, colors.glass);
    return;
  }
  if (level > 0)
    panel(
      out,
      'stone',
      w,
      u - radius - 0.18,
      u + radius + 0.18,
      low - 0.17,
      spring + rise + 0.17,
      0.063,
      colors.dress,
    );
  const z = 0.097;
  panel(out, 'glass', w, u - radius, u + radius, low, spring, z, colors.glass);
  if (square) {
    panel(out, 'glass', w, u - radius, u + radius, spring, spring + rise, z, colors.glass);
  } else {
    const n = level >= 2 ? 8 : 4;
    const archPoints = Array.from({ length: n + 1 }, (_, i) => {
      const a = (Math.PI * i) / n;
      return w.p(u + radius * Math.cos(a), spring + Math.sin(a) * rise, z);
    });
    face(out, 'glass', archPoints, w.normal, colors.glass);
  }
  if (level >= 1) {
    const lights = level === 1 ? Math.min(count, 3) : count;
    for (let i = 1; i < lights; i++) {
      const x = mix(u - radius, u + radius, i / lights);
      const h = square ? rise : rise * Math.sqrt(1 - Math.pow((x - u) / radius, 2));
      panel(out, 'stone', w, x - 0.04, x + 0.04, low, spring + h - 0.018, 0.135, colors.dress);
    }
  }
  if (level >= 2) {
    const bar = mix(low, spring, 0.54);
    panel(out, 'stone', w, u - radius, u + radius, bar - 0.06, bar + 0.055, 0.136, colors.dress);
    panel(
      out,
      'stone',
      w,
      u - radius - 0.2,
      u + radius + 0.2,
      low - 0.18,
      low - 0.066,
      0.197,
      colors.stone,
    );
  }
  if (level === 3) {
    for (let i = 1; i < count; i++) {
      const x = mix(u - radius, u + radius, (i - 0.5) / count);
      panel(out, 'metal', w, x - 0.019, x + 0.019, low + 0.14, spring - 0.11, 0.143, colors.iron);
    }
  }
}

function parapet(out, level, w, y, tone) {
  panel(out, 'stone', w, 0, w.length, y - 0.23, y + 0.29, 0.16, colors.stone);
  if (level === 0) return;
  const n = Math.max(1, Math.round(w.length / (level === 1 ? 3.7 : 1.65)));
  for (let i = 0; i < n; i++) {
    const x = ((i + 0.5) * w.length) / n;
    const half = (w.length / n) * 0.275;
    panel(out, 'brick', w, x - half, x + half, y + 0.28, y + 0.83, 0.14, tone);
    panel(
      out,
      'stone',
      w,
      x - half - 0.028,
      x + half + 0.028,
      y + 0.81,
      y + 0.98,
      0.197,
      colors.dress,
    );
    if (level >= 2) {
      const p = w.p(x - half - 0.028, y + 0.98, 0.197);
      const q = w.p(x + half + 0.028, y + 0.98, 0.197);
      beam(out, 'stone', p, q, 0.31, 0.095, colors.stone);
    }
  }
}

function pilaster(out, w, u, y, top, level) {
  const [x, , z] = w.p(u, 0, 0.16);
  beam(out, 'stone', [x, y, z], [x, top + 0.24, z], 0.62, 0.59, colors.stone);
  if (level >= 2) {
    block(out, 'stone', x - 0.39, top + 0.08, z - 0.39, 0.78, 0.19, 0.78, colors.dress);
    loft(
      out,
      'stone',
      [
        [top + 0.27, 0.29],
        [top + 1.29, 0.08],
      ].map(([h, r]) => radialRing(h, r, r, level === 3 ? 8 : 4, [x, z])),
      colors.dress,
    );
  }
}

function hallFacade(out, level, box, base, top, main, lengthZ) {
  const outline = rect(...box);
  for (const [i, [a, b]] of pairs(closed(outline)).entries()) {
    const w = edge(a, b);
    const long = (i % 2 === 1) === lengthZ;
    const count = long ? (main === 'great' ? 7 : main === 'old' ? 5 : 8) : 1;
    const y = base + 3.5;
    for (let j = 0; j < count; j++) {
      if (level === 0 && j % 3 !== 0) continue;
      const u = ((j + 0.5) * w.length) / count;
      const r = Math.min((w.length / count) * 0.38, long ? 2.0 : 3.1);
      tracery(
        out,
        level,
        w,
        u,
        y,
        top - 2.4,
        r,
        1.25,
        main === 'great' ? 7 : 4,
        long && main !== 'old',
      );
      if (level >= 2 && long && j > 0) pilaster(out, w, (j * w.length) / count, base, top, level);
      if (level >= 2 && main !== 'old')
        tracery(
          out,
          level - 1,
          w,
          u,
          base + 0.63,
          base + 1.9,
          Math.min(r * 0.74, 0.95),
          0.31,
          2,
          true,
        );
    }
    if (long) parapet(out, level, w, top, main === 'great' ? colors.hallBrick : colors.brick);
  }
}

function turret(out, level, [x, z], low, body, radius, top, brick, pointed = true) {
  const n = level === 0 ? 4 : 8;
  loft(
    out,
    'brick',
    [
      [low, radius],
      [body, radius],
      [body + 0.28, radius + 0.13],
    ].map(([h, r]) => radialRing(h, r, r, n, [x, z], Math.PI / 4)),
    brick,
  );
  if (pointed) {
    loft(
      out,
      'roof',
      [
        [body + 0.27, radius + 0.14],
        [top, 0.07],
      ].map(([h, r]) => radialRing(h, r, r, n, [x, z], Math.PI / 4)),
      colors.lead,
    );
  } else if (level > 0) {
    const points = radialRing(body + 0.3, radius + 0.14, radius + 0.14, n, [x, z], Math.PI / 4);
    for (const [xx, y, zz] of points)
      block(out, 'stone', xx - 0.15, y, zz - 0.15, 0.3, 0.48, 0.3, colors.stone);
  }
}

function greatHall(out, level) {
  const base = 0.61;
  const hall = [-72.13, 6.56, -49.12, 50.24];
  const library = [-76.63, -24.34, -29.66, -5.39];
  const connector = rect(-70.75, -5.53, -51.05, 6.65);
  const h = sections.greatHall,
    l = sections.library;
  mass(out, rect(...hall), buried, base + h.eave, 'brick', colors.hallBrick);
  mass(out, rect(...library), buried, base + l.eave, 'brick', colors.hallBrick);
  mass(out, connector, buried, base + l.eave + 0.7, 'brick', colors.brick);
  gable(out, hall, base + h.eave, base + h.ridge, true, 'brick', colors.hallBrick, colors.slate);
  gable(out, library, base + l.eave, base + l.ridge, false, 'brick', colors.hallBrick, colors.lead);
  hallFacade(out, level, hall, base, h.eave + base, 'great', true);
  hallFacade(out, level, library, base, l.eave + base, 'library', false);
  for (const x of [-70.55, -50.29])
    turret(out, level, [x, 48.65], base, base + 20.4, 2.14, base + 20.9, colors.hallBrick, false);
  turret(out, level, [-31.55, -6.65], base, base + 17.8, 1.42, base + 24.55, colors.brick);
  turret(out, level, [-74.95, -22.94], base, base + 17.3, 1.4, base + 21.5, colors.brick);
  turret(out, level, [-58.58, 21.75], base + 24.68, base + 27.35, 0.77, base + 31.6, colors.brick);
  if (level >= 1) {
    for (const [x, z, y] of [
      [-67.42, -14.4, 20.8],
      [-56.8, -14.4, 20.1],
      [-63.9, 10.1, 24.5],
      [-64.1, 35, 24.8],
    ]) {
      block(out, 'brick', x, y, z, 1.72, 4.5, 1.43, colors.brick);
      block(out, 'stone', x - 0.12, y + 4.5, z - 0.12, 1.96, 0.22, 1.66, colors.stone);
      for (const d of level === 3 ? [0.15, 0.65, 1.15] : [0.2, 0.95])
        block(out, 'brick', x + d, y + 4.71, z + 0.36, 0.32, 0.54, 0.32, colors.brickShadow);
    }
  }
}

function oldHall(out, level) {
  const base = -1.02;
  const profile = sections.oldHall;
  const box = [33.43, 51.47, 45.55, 80.97];
  mass(out, outlines.oldHall, buried, base + profile.eave, 'brick', colors.brick);
  gable(
    out,
    box,
    base + profile.eave,
    base + profile.ridge,
    true,
    'brick',
    colors.brick,
    colors.tile,
  );
  hallFacade(out, level, box, base, base + profile.eave, 'old', true);
  const w = edge([33.4, 80.96], [33.4, 51.44]);
  for (const u of [3.3, 26.1]) {
    const p = w.p(u, base, 0.88);
    block(
      out,
      'brick',
      p[0] - 0.69,
      base,
      p[2] - 1.34,
      1.44,
      profile.eave,
      2.75,
      colors.brickShadow,
    );
    tracery(out, level, w, u, base + 2.07, base + 8.2, 0.91, 0.78, 3);
  }
  turret(
    out,
    level,
    [39.52, 65.9],
    base + profile.ridge - 0.08,
    base + 19.25,
    0.57,
    base + 20.55,
    colors.brick,
  );
}

function passage(out, level, w, left, right, base, spring, top, rise, tint) {
  const center = (left + right) / 2,
    radius = (right - left) / 2;
  const n = [4, 6, 10, 14][level];
  for (let i = 0; i < n; i++) {
    const a = Math.PI * (1 - i / n),
      b = Math.PI * (1 - (i + 1) / n);
    const u = center + radius * Math.cos(a),
      v = center + radius * Math.cos(b);
    const y = spring + rise * Math.sin(a),
      h = spring + rise * Math.sin(b);
    face(out, 'brick', [w.p(u, y), w.p(v, h), w.p(v, top), w.p(u, top)], w.normal, tint);
    if (level > 0)
      face(
        out,
        'stone',
        [w.p(u, y, 0.07), w.p(v, h, 0.07), w.p(v, h + 0.18, 0.08), w.p(u, y + 0.18, 0.08)],
        w.normal,
        colors.stone,
      );
  }
  if (level > 0) {
    panel(out, 'stone', w, left - 0.11, left, base, spring, 0.08, colors.stone);
    panel(out, 'stone', w, right, right + 0.11, base, spring, 0.08, colors.stone);
  }
}

function chapel(out, level) {
  const g = grade([46, 41]);
  const { plinth, deck, eave, ridge } = sections.chapel;
  const box = [32.05, 34.35, 67.62, 49.03],
    nave = rect(...box);
  mass(out, nave, g + deck, g + eave, 'ashlar', colors.stone);
  gable(out, box, g + eave, g + ridge, false, 'ashlar', colors.stone, colors.greenSlate);
  const outline = pairs(closed(nave));
  for (const [i, [a, b]] of outline.entries()) {
    const w = edge(a, b);
    const long = i % 2 === 0;
    const n = long ? 4 : 2;
    for (let j = 0; j < n; j++) {
      const width = w.length / n,
        u = (j + 0.5) * width;
      if (long || j === 0)
        tracery(
          out,
          level,
          w,
          long ? u : w.length / 2,
          g + deck + 1.35,
          g + eave - 2.13,
          long ? 1.55 : 2.25,
          1.3,
          long ? 4 : 7,
        );
      const l = u - width * 0.36,
        r = u + width * 0.36;
      if (level === 0 && j % 2 === 1) continue;
      if (level > 0) {
        panel(out, 'ashlar', w, u - width * 0.5, l, g + plinth, g + deck, 0.025, colors.stone);
        panel(out, 'ashlar', w, r, u + width * 0.5, g + plinth, g + deck, 0.025, colors.stone);
      }
      passage(
        out,
        level,
        w,
        l,
        r,
        g + plinth,
        g + deck - 1.68,
        g + deck + 0.015,
        1.35,
        colors.stone,
      );
      const p = w.p(u - width * 0.5, 0, 0.05);
      block(
        out,
        'ashlar',
        p[0] - 0.43,
        g + plinth - 0.42,
        p[2] - 0.43,
        0.86,
        deck - plinth + 0.48,
        0.86,
        colors.oldStone,
      );
      if (level > 0 && long) pilaster(out, w, u - width * 0.49, g + deck, g + eave, level);
    }
    const p = w.p(w.length, 0, 0.05);
    block(
      out,
      'ashlar',
      p[0] - 0.42,
      g + plinth - 0.42,
      p[2] - 0.42,
      0.84,
      deck - plinth + 0.56,
      0.84,
      colors.stoneShade,
    );
    if (level >= 1 && long) parapet(out, level, w, g + eave, colors.stone);
  }
  if (level >= 1) {
    for (const dx of [0, 1, 2]) {
      const x = 8.0 * dx + 41,
        z = 41.7;
      block(
        out,
        'ashlar',
        x - 0.36,
        g + plinth - 0.39,
        z - 0.36,
        0.72,
        deck - plinth + 0.42,
        0.72,
        colors.stoneShade,
      );
    }
  }
}

function clip(outline, axis, keepMin, cut) {
  const points = [];
  for (const [a, b] of pairs(closed(outline))) {
    const inside = (p) => (keepMin ? p[axis] <= cut : p[axis] >= cut);
    if (inside(a)) points.push(a);
    if (inside(a) !== inside(b)) {
      const t = (cut - a[axis]) / (b[axis] - a[axis]);
      points.push([mix(a[0], b[0], t), mix(a[1], b[1], t)]);
    }
  }
  return points;
}

function frontSashes(out, level, w, count, heights, tone) {
  const width = w.length / count;
  for (let j = 0; j < count; j++) {
    if (level <= 1 && j % 3 !== 0) continue;
    const u = (j + 0.5) * width;
    const r = Math.min(width * 0.3, 0.88);
    for (const y of heights) {
      if (level >= 2)
        panel(out, 'stone', w, u - r - 0.12, u + r + 0.12, y - 0.08, y + 2.24, 0.06, tone);
      panel(out, 'glass', w, u - r, u + r, y, y + 2.12, 0.09, colors.glass);
      if (level >= 2) {
        panel(out, 'stone', w, u - 0.04, u + 0.04, y, y + 2.12, 0.126, colors.dress);
        panel(out, 'stone', w, u - r, u + r, y + 1.0, y + 1.08, 0.126, colors.dress);
      }
      if (level === 3)
        panel(out, 'metal', w, u - r, u + r, y + 1.55, y + 1.581, 0.151, colors.pewter);
    }
  }
}

function oldBuildings(out, level) {
  const outline = outlines.chambers;
  const [x, z] = gate;
  const endA = z - 4.5,
    endB = z + 4.55;
  const g = grade(gate),
    top = g + 15.35;
  for (const wing of [clip(outline, 1, true, endA), clip(outline, 1, false, endB)]) {
    mass(out, wing, buried, top - 1.1, 'brick', colors.stock);
    if (level >= 1)
      for (const [a, b] of pairs(closed(wing))) {
        const w = edge(a, b, areaSign(wing));
        if (w.length < 4.1 || (level === 1 && w.length < 9.5)) continue;
        frontSashes(
          out,
          level,
          w,
          Math.ceil(w.length / 4.7),
          [g + 1.2, g + 4.3, g + 7.55, g + 10.67],
          colors.stone,
        );
        panel(out, 'stone', w, 0, w.length, top - 1.35, top - 1.12, 0.13, colors.stone);
      }
  }
  const west = x - 9.05,
    east = x + 0.07;
  const base = g + 0.25;
  const roomBase = base + 5.8;
  const narrow = 1.38;
  block(out, 'brick', west, base, endA, east - west, top - base, narrow, colors.brick);
  block(out, 'brick', west, base, endB - narrow, east - west, top - base, narrow, colors.brick);
  block(
    out,
    'brick',
    west,
    roomBase,
    endA + narrow,
    east - west,
    top - roomBase,
    endB - endA - 2 * narrow,
    colors.brick,
  );
  for (const [xx, reverse] of [
    [west, false],
    [east, true],
  ]) {
    const a = [xx, endA],
      b = [xx, endB];
    const w = reverse ? edge(a, b) : edge(b, a);
    passage(
      out,
      level,
      w,
      narrow,
      w.length - narrow,
      base,
      base + 3.04,
      roomBase + 0.08,
      2.28,
      colors.brick,
    );
    for (const y of [base + 6.1, base + 8.9, base + 11.8])
      tracery(out, level, w, w.length * 0.5, y, y + 1.53, 1.05, 0.27, 3, true);
    parapet(out, level, w, top - 0.2, colors.brick);
    if (level >= 1 && reverse) {
      for (const u of [w.length * 0.5 - 0.73, w.length * 0.5, w.length * 0.5 + 0.73])
        panel(out, 'stone', w, u - 0.29, u + 0.29, base + 5.24, base + 5.94, 0.16, colors.dress);
    }
  }
  const tower = rect(x - 4.7, z - 6.98, x - 0.25, z - 3.95);
  mass(out, tower, buried, top + 3.4, 'brick', colors.brickShadow);
  if (level > 0) {
    const w = edge(tower[1], tower[2]);
    frontSashes(
      out,
      level,
      w,
      1,
      [base + 4.3, base + 7.55, base + 10.67, base + 14.45],
      colors.oldStone,
    );
    parapet(out, level, w, top + 3.4, colors.brick);
  }
}

function stoneRange(out, level, outline, eastRange) {
  const { floors, eave } = sections.stone;
  const y = grade(planarMid(outline));
  mass(out, outline, buried, y + eave, 'ashlar', colors.oldStone);
  for (const [a, b] of pairs(closed(outline))) {
    const w = edge(a, b, areaSign(outline));
    const n = Math.max(1, Math.round(w.length / 3.63));
    if (w.length < 3.08) continue;
    if (level > 0) {
      for (const h of [3.7, 8.74, 13.17])
        panel(out, 'stone', w, 0, w.length, y + h - 0.12, y + h + 0.1, 0.155, colors.dress);
    }
    frontSashes(
      out,
      level,
      w,
      n,
      floors.map((v) => v + y),
      colors.stone,
    );
    if (
      eastRange &&
      w.normal[0] > 0.8 &&
      w.p(0, 0)[2] < -53 &&
      w.p(w.length, 0)[2] < -53 &&
      Math.max(w.p(0, 0)[2], w.p(w.length, 0)[2]) > -64
    ) {
      const u = w.length * 0.46;
      tracery(out, level, w, u, y + 0.17, y + 2.14, 0.95, 0.7, 5);
      panel(out, 'metal', w, u - 0.83, u + 0.83, y + 0.16, y + 2.16, 0.151, colors.iron);
      if (level > 0) {
        const [x, , z] = w.p(u, 0, 1.45);
        for (let k = 0; k < 4; k++)
          block(
            out,
            'stone',
            x - k * 0.145,
            y - 0.3,
            z - 1.03,
            0.18,
            0.42 + k * 0.14,
            2.06,
            colors.stoneShade,
          );
        for (const v of [-1.14, 1.14])
          beam(
            out,
            'metal',
            w.p(u + v, y + 0.25, 1.5),
            w.p(u + v, y + 1.25, 0.16),
            0.075,
            0.075,
            colors.iron,
          );
      }
    }
  }
}

function minimum(out, outline, color, slot, height) {
  mass(out, outline, buried, height, slot, color);
}

function build(out, level) {
  greatHall(out, level);
  oldHall(out, level);
  chapel(out, level);
  oldBuildings(out, level);
  if (level === 0) {
    minimum(out, outlines.stoneWest, colors.oldStone, 'ashlar', sections.stone.eave + 2.25);
    minimum(out, outlines.stoneEast, colors.oldStone, 'ashlar', sections.stone.eave + 2.25);
  } else {
    stoneRange(out, level, outlines.stoneWest, false);
    stoneRange(out, level, outlines.stoneEast, true);
  }
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'lincoln-s-inn-model.mjs';
const camera = [218, 118, 223],
  lookAt = [0, 10, -12];
const errors = { district: 0.88, street: 0.26, closeup: 0.09 };
export const lincolnsInnAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  title: plan.title,
  category: 'civic-institutional',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis:
    'The original Holborn terrain projects beneath the named attached historic footprints and the independent north ranges.',
  brief:
    'Lincoln’s Inn’s Victorian Great Hall and Library, medieval Old Hall, raised Gothic chapel, Tudor Gatehouse and Georgian Stone Buildings.',
  camera,
  lookAt,
  sunDirection: [84, 155, 115],
  mediumFiContext: {
    scale: 1,
    groundY: -0.3,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: outlines.greatHall,
    outlines: Object.values(outlines),
    minimumCoverage: 0.9,
    basis:
      'Named individually mapped collegiate envelopes and the two native boundary-derived Stone Buildings outlines.',
  },
  embeddedCanonicalGraphs: ['brick_flemish', 'stone_ashlar', 'tile_flat', 'metal_painted'],
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'great-hall-and-library', position: [-132, 57, 104], lookAt: [-58, 12, 13] },
    { name: 'chapel-undercroft-and-old-hall', position: [9, 11, 20], lookAt: [48, 7.2, 47] },
    { name: 'chancery-lane-gatehouse', position: [112, 9.2, 67.5], lookAt: [83, 7.6, 68] },
    { name: 'the-two-stone-buildings-ranges', position: [91, 32, -92], lookAt: [31, 9, -72] },
    { name: 'stone-buildings-chancery-entry', position: [82, 6.2, -75], lookAt: [60, 4.2, -73] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'lincolns-inn-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 2.37,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries(errors).map(([name, errorMeters]) => [
        name,
        { export: name, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
};
