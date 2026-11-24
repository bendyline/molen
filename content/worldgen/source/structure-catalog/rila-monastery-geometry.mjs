import { beam } from '../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { withFootprintCaps } from '../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  extrude,
  facade,
  fbox,
  gableRoof,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

export const surfaces = {
  stone: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.96 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.95 },
  wood: { slot: 'trim', graph: 'wood_vertical', roughness: 0.91 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.95 },
  copper: { slot: 'trim', graph: 'metal_copper', roughness: 0.79 },
};

const limestone = rgb('b3a691');
const grey = rgb('8e8779');
const pale = rgb('d5cbb3');
const stucco = rgb('d4cbbb');
const red = rgb('a06046');
const dark = rgb('5a5048');
const wood = rgb('745c47');
const clay = rgb('985f49');
const patina = rgb('5b7467');
const gilt = rgb('b49956');
const mix = (a, b, t) => a + (b - a) * t;
const xz = ([x, , z]) => [x, z];
const center = (ring) =>
  ring.reduce(([a, b], [x, z]) => [a + x / ring.length, b + z / ring.length], [0, 0]);

function panel(out, slot, f, u, U, y, Y, d, tint) {
  quad4(out, slot, f.P(u, y, d), f.P(U, y, d), f.P(U, Y, d), f.P(u, Y, d), tint);
}

function archRow(out, f, start, width, floor, height, depth, detail, stripe = false) {
  const end = start + width;
  const mid = start + width / 2;
  const radius = Math.min(width * 0.416, height * 0.355);
  const spring = floor + height * 0.59;
  const top = floor + height;
  const trim = Math.max(0.1, Math.min(width * 0.043, 0.25));
  const point = (r, a, d = 0) => f.P(mid + r * Math.cos(a), spring + r * Math.sin(a), d);
  const begin = mid - radius;
  const finish = mid + radius;
  const n = [2, 3, 6, 8][detail];
  const tint = stripe ? pale : stucco;
  panel(out, 'plaster', f, start, begin, floor, top, 0, tint);
  panel(out, 'plaster', f, finish, end, floor, top, 0, tint);
  quad4(
    out,
    'plaster',
    f.P(begin, floor, 0),
    f.P(begin, spring, 0),
    f.P(begin, spring, -depth),
    f.P(begin, floor, -depth),
    tint,
  );
  quad4(
    out,
    'plaster',
    f.P(finish, floor, -depth),
    f.P(finish, spring, -depth),
    f.P(finish, spring, 0),
    f.P(finish, floor, 0),
    tint,
  );
  for (let i = 0; i < n; i++) {
    const a = Math.PI * (1 - i / n);
    const b = Math.PI * (1 - (i + 1) / n);
    const r = stripe ? radius + trim : radius;
    const A = point(r, a),
      B = point(r, b);
    quad4(out, 'plaster', A, B, [B[0], top, B[2]], [A[0], top, A[2]], tint);
    const y = stripe && i % 2 ? dark : tint;
    if (stripe)
      quad4(
        out,
        'plaster',
        point(radius, a, 0.025),
        point(radius, b, 0.025),
        point(r, b, 0.025),
        point(r, a, 0.025),
        y,
      );
    if (detail >= 1 || stripe)
      quad4(
        out,
        'plaster',
        point(radius, b, -depth),
        point(radius, a, -depth),
        point(radius, a),
        point(radius, b),
        y,
      );
  }
  if (detail < 2) return;
  for (const u of [begin, finish]) {
    fbox(
      out,
      'stone',
      f,
      u - trim * 0.28,
      u + trim * 0.28,
      floor - 0.03,
      floor + 0.21,
      -depth,
      0.17,
      limestone,
    );
    fbox(
      out,
      'wood',
      f,
      u - trim * 0.82,
      u + trim * 0.82,
      spring - 0.15,
      spring,
      -depth,
      0.11,
      stripe ? dark : wood,
    );
  }
}

function roofFor(out, f, width, length, y, peak, tint, slot = 'roof') {
  const A = xz(f.P(-width / 2, 0, -length / 2));
  const B = xz(f.P(width / 2, 0, -length / 2));
  const C = xz(f.P(-width / 2, 0, length / 2));
  const D = xz(f.P(width / 2, 0, length / 2));
  const a = xz(f.P(0, 0, -length / 2));
  const b = xz(f.P(0, 0, length / 2));
  if (width > length * 1.2) {
    const p = xz(f.P(-width / 2, 0, 0));
    const q = xz(f.P(width / 2, 0, 0));
    gableRoof(out, slot, p, q, length, y, peak, tint, { endSlot: 'plaster', endColor: stucco });
  } else {
    gableRoof(out, slot, a, b, width, y, peak, tint, { endSlot: 'plaster', endColor: stucco });
  }
  const eaves = outwardRing([A, B, D, C]);
  for (let i = 0; i < eaves.length; i++) {
    const [x, z] = eaves[i],
      [X, Z] = eaves[(i + 1) % eaves.length];
    quad4(out, 'wood', [x, y - 0.14, z], [X, y - 0.14, Z], [X, y, Z], [x, y, z], dark);
  }
}

function courtRing(out, caps, site, detail) {
  const c = site.court;
  extrude(caps, 'stone', c.surface, c.floor - 0.38, c.floor + 0.04, grey);
  for (const [outer, ...holes] of c.body)
    extrude(caps, 'stone', outer, c.footing, c.eave - 0.03, limestone, { holes });
  for (const [outer, ...holes] of c.roofStrips) {
    const ys = new Map(c.ridge.map(([x, z]) => [x + ',' + z, c.eave + 3.15]));
    const ring = outwardRing(outer);
    const inside = holes.map((h) => outwardRing(h).reverse());
    if (
      !caps.addCap(
        'roof',
        '',
        ring,
        inside,
        ([x, z]) => ys.get(x + ',' + z) ?? c.eave,
        [0, 1, 0],
        (p) => p,
        clay,
      )
    )
      throw new Error('Rila residential roof polygon failed triangulation');
  }
  const court = outwardRing(c.inner).reverse();
  for (let i = 0; i < court.length; i++) {
    const f = wallFace(court[i], court[(i + 1) % court.length]);
    if (f.length < 1.8) continue;
    const n = Math.max(1, Math.round(f.length / [1, 9.65, 5.15, 4.4][detail]));
    const gate = c.gates.find((g) => {
      const [x, z] = g.inside.map((v, i) => v - f.origin[i]);
      const along = x * f.along[0] + z * f.along[1];
      const depth = x * f.normal[0] + z * f.normal[1];
      return Math.abs(depth) < 0.6 && along >= -0.2 && along <= f.length + 0.2;
    });
    if (detail === 0) {
      panel(
        out,
        'plaster',
        f,
        0,
        f.length,
        gate ? gate.floor + gate.height : c.floor,
        c.eave - 0.42,
        0,
        stucco,
      );
      continue;
    }
    const width = f.length / n;
    const floorCount = detail === 1 ? 2 : 3;
    const floorHeight = (c.eave - c.floor - 2.15) / floorCount;
    for (let level = 0; level < floorCount; level++) {
      const y = c.floor + level * floorHeight + 0.08;
      for (let j = 0; j < n; j++) {
        if (level === 0 && gate) {
          const delta = [
            f.P((j + 0.5) * width, 0)[0] - gate.inside[0],
            f.P((j + 0.5) * width, 0)[2] - gate.inside[1],
          ];
          if (Math.hypot(...delta) < gate.width * 0.66 + width * 0.5) continue;
        }
        archRow(out, f, j * width, width, y, floorHeight - 0.23, 0.58, detail - 1);
      }
      if (level > 0) {
        fbox(out, 'wood', f, 0, f.length, y - 0.3, y, -2.2, 0.13, wood);
        if (detail >= 2) fbox(out, 'wood', f, 0, f.length, y + 0.08, y + 0.73, -0.04, 0.07, dark);
      }
    }
    fbox(out, 'wood', f, 0, f.length, c.eave - 2.1, c.eave - 0.35, -0.21, 0.17, wood);
    if (detail === 3)
      for (let j = 0; j < n; j++)
        panel(
          out,
          'wood',
          f,
          width * (j + 0.3),
          width * (j + 0.7),
          c.eave - 1.89,
          c.eave - 0.78,
          0.179,
          dark,
        );
  }
  for (const g of c.gates) {
    const f = facade(g.outside, g.cross);
    const span = g.width * 0.49;
    const faceHeight = g.apron + g.height;
    archRow(out, f, -g.width * 0.5, g.width, g.apron, g.height, 0.96, detail, true);
    fbox(out, 'stone', f, -span, span, faceHeight, c.eave, -1.02, 0.012, limestone);
    const ceiling = Math.max(faceHeight, g.floor + 3.38);
    fbox(out, 'stone', f, -span, span, ceiling, c.eave, -g.depth, -1.02, limestone, {
      bottom: true,
    });
    if (detail === 0) {
      quad4(
        out,
        'stone',
        f.P(-span, g.apron, 0.13),
        f.P(span, g.apron, 0.13),
        f.P(span, g.floor, -g.depth),
        f.P(-span, g.floor, -g.depth),
        grey,
      );
      continue;
    }
    const steps = Math.min(
      detail === 1 ? 7 : 26,
      Math.max(1, Math.ceil(Math.abs(g.floor - g.apron) / 0.25)),
    );
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const h = mix(g.apron, g.floor, (i + 1) / steps);
      fbox(
        out,
        'stone',
        f,
        -span,
        span,
        Math.min(g.apron, h) - 0.48,
        h,
        (-g.depth * (i + 1)) / steps,
        -g.depth * t + 0.025,
        grey,
      );
    }
  }
  if (detail < 2) return;
  const ring = outwardRing(c.outer);
  for (const [i, p] of ring.entries()) {
    const f = wallFace(p, ring[(i + 1) % ring.length]);
    if (f.length < 7) continue;
    const n = Math.max(1, Math.floor(f.length / 5.5));
    for (let j = 0; j < n; j++) {
      const x = (f.length * (j + 0.5)) / n;
      panel(out, 'wood', f, x - 0.32, x + 0.32, c.eave - 3.59, c.eave - 2.28, 0.05, dark);
      if (detail === 3)
        panel(out, 'wood', f, x - 0.23, x + 0.23, c.eave - 6.13, c.eave - 4.98, 0.049, dark);
    }
  }
}

function stripedWalls(out, caps, ring, from, to, detail) {
  if (detail === 0) {
    extrude(caps, 'plaster', ring, from, to, red, { top: false });
    return;
  }
  const n = [1, 6, 10, 14][detail];
  for (let i = 0; i < n; i++)
    extrude(
      caps,
      'plaster',
      ring,
      mix(from, to, i / n),
      mix(from, to, (i + 1) / n),
      i % 2 ? pale : red,
      { top: false },
    );
}

function dome(out, at, base, radius, height, detail) {
  if (detail === 0) {
    lathe(
      out,
      'copper',
      at,
      [
        [base, radius, radius],
        [base + height * 0.61, radius, radius],
        [base + height * 0.88, radius * 0.76, radius * 0.76],
        [base + height, radius * 0.057, radius * 0.057],
      ],
      6,
      patina,
    );
    return;
  }
  const crown = base + height;
  const n = [8, 10, 14, 18][detail];
  const shape = [
    [0, 1],
    [0.53, 1],
    [0.61, 1.08],
    [0.71, 1.03],
    [0.85, 0.83],
    [0.96, 0.44],
    [1, 0.057],
  ];
  lathe(
    out,
    'plaster',
    at,
    shape.slice(0, 2).map(([y, r]) => [base + y * height, radius * r, radius * r]),
    n,
    pale,
  );
  lathe(
    out,
    'copper',
    at,
    shape.slice(1).map(([y, r]) => [base + y * height, radius * r, radius * r]),
    n,
    patina,
  );
  if (detail >= 1) {
    for (let j = 0; j < (detail === 1 ? 5 : 8); j++) {
      const angle = (j * Math.PI) / (detail === 1 ? 2.5 : 4);
      const [x, z] = [Math.cos(angle), Math.sin(angle)];
      const f = facade([at[0] + x * radius * 1.012, at[1] + z * radius * 1.012], [z, -x]);
      opening(out, f, 0, base + height * 0.14, radius * 0.33, height * 0.33, {
        head: 'round',
        d: 0.025,
        glassSlot: 'wood',
        glass: dark,
        frameWidth: 0,
        sill: false,
      });
    }
  }
  const [x, z] = at;
  const h = Math.max(0.65, radius * 0.43);
  beam(out, 'copper', [x, crown - 0.05, z], [x, crown + h, z], 0.06, 0.06, gilt);
  if (detail >= 1)
    beam(
      out,
      'copper',
      [x - h * 0.31, crown + h * 0.71, z],
      [x + h * 0.31, crown + h * 0.71, z],
      0.06,
      0.06,
      gilt,
    );
}

function mainChurch(out, caps, p, detail) {
  const f = facade(p.center, p.along);
  const { width, depth, grade, stem, drumLocations } = p;
  extrude(caps, 'stone', p.outline, p.base, grade + 0.25, limestone);
  stripedWalls(out, caps, stem, grade + 0.25, grade + 9.75, detail);
  const centerRoof = facade(xz(f.P(0, 0, -4.5)), p.along);
  roofFor(
    out,
    centerRoof,
    width * 0.68,
    depth * 0.78,
    grade + 9.75,
    grade + 13.45,
    patina,
    'copper',
  );
  const W = width * 0.47;
  const D = depth * 0.47;
  const hinge = -D * 0.16;
  const porch = [xz(f.P(-W, 0, D)), xz(f.P(W, 0, D)), xz(f.P(W, 0, hinge)), xz(f.P(-W, 0, hinge))];
  extrude(caps, 'copper', porch, grade + 5.72, grade + 6.05, patina);
  const porchWalls = outwardRing(porch);
  for (let i = 0; i < porchWalls.length; i++) {
    const g = wallFace(porchWalls[i], porchWalls[(i + 1) % porchWalls.length]);
    const facing = g.normal[0] * f.normal[0] + g.normal[1] * f.normal[1];
    if (facing < -0.8) continue;
    const n = Math.max(1, Math.round(g.length / [11, 6.05, 4.08, 4.08][detail]));
    for (let j = 0; j < n; j++)
      archRow(
        out,
        g,
        (g.length * j) / n,
        g.length / n,
        grade + 0.33,
        5.37,
        0.58,
        detail,
        detail > 0,
      );
  }
  if (detail >= 2) {
    for (const [i, side] of outwardRing(stem).entries()) {
      const ring = outwardRing(stem);
      const g = wallFace(side, ring[(i + 1) % ring.length]);
      if (g.length < 4.7) continue;
      const n = Math.max(1, Math.floor(g.length / 5.2));
      for (let j = 0; j < n; j++) {
        const u = (g.length * (j + 0.5)) / n;
        opening(out, g, u, grade + 6.69, 1.14, 2.37, {
          head: 'round',
          d: 0.08,
          glass: dark,
          glassSlot: 'wood',
          frameSlot: 'stone',
          frame: pale,
          frameWidth: detail === 3 ? 0.14 : 0,
          sill: false,
        });
      }
    }
  }
  for (const [u, d, elevation, r, h] of drumLocations)
    dome(out, xz(f.P(u, 0, d)), grade + elevation, r, h, detail);
}

function tower(out, caps, p, detail) {
  const h = p.grade + p.height;
  extrude(caps, 'stone', p.outline, p.base, h - 1.13, limestone);
  const ring = outwardRing(p.outline);
  for (let i = 0; i < ring.length; i++) {
    const f = wallFace(ring[i], ring[(i + 1) % ring.length]);
    if (f.length < 1.62) continue;
    const n = Math.max(1, Math.round(f.length / (detail === 0 ? 4.9 : 1.67)));
    if (detail === 0) panel(out, 'stone', f, 0, f.length, h - 1.13, h - 0.83, 0.02, grey);
    else fbox(out, 'stone', f, 0, f.length, h - 1.35, h - 0.85, -0.35, 0.14, grey);
    for (let j = 0; j < n; j++) {
      const x = (f.length * (j + 0.5)) / n;
      const width = (f.length / n) * 0.45;
      fbox(out, 'stone', f, x - width * 0.5, x + width * 0.5, h - 0.86, h, -0.33, 0.08, limestone);
      if (detail > 0) panel(out, 'wood', f, x - 0.2, x + 0.2, h - 3.85, h - 3.06, 0.07, dark);
      if (detail >= 2 && j % 2 === 0)
        opening(out, f, x, p.grade + p.height * 0.55, Math.min(1.12, width), p.height * 0.199, {
          head: 'round',
          d: 0.058,
          glassSlot: 'wood',
          glass: dark,
          frameSlot: 'stone',
          frame: grey,
          frameWidth: detail === 3 ? 0.075 : 0,
          sill: false,
        });
    }
  }
  if (p.belfry) {
    const f = facade(p.belfry.center, p.belfry.along);
    const width = p.belfry.width;
    const ground = p.grade + 0.29;
    fbox(
      out,
      'stone',
      f,
      -width * 0.48,
      width * 0.48,
      p.base,
      ground + 3.22,
      -1.17,
      1.19,
      limestone,
    );
    for (const j of [-1, 0])
      archRow(out, f, j * width * 0.48, width * 0.48, ground + 3.3, 5.48, 1.16, detail, detail > 0);
    roofFor(out, f, width * 1.03, 2.8, ground + 8.94, ground + 10.24, clay);
  }
}

function smallBuilding(out, caps, p, detail) {
  const f = facade(p.center, p.along);
  const { grade, base, eave, ridge, length, width, outline, theme, porch = 0, apse = 0 } = p;
  const W = width * 0.5;
  const L = length * 0.5;
  const foyer = L - porch;
  const white = ['convent', 'chapel', 'white-chapel'].includes(theme);
  const skin = white ? 'plaster' : 'stone';
  const corners = [
    xz(f.P(-W, 0, -L)),
    xz(f.P(W, 0, -L)),
    xz(f.P(W, 0, foyer)),
    xz(f.P(-W, 0, foyer)),
  ];
  extrude(caps, 'stone', outline, base, grade + 0.12, grey);
  const beamY = theme === 'convent' ? grade + eave * 0.57 : grade + 0.87;
  const wallTop = grade + eave;
  const intact = porch === 0 && !apse;
  const wallOutline = intact ? outline : corners;
  extrude(caps, 'stone', wallOutline, grade + 0.12, beamY, limestone, { top: false });
  extrude(caps, skin, wallOutline, beamY, wallTop, white ? stucco : grey, { top: false });
  const top = p.darkRoof ? dark : clay;
  if (p.roofSections) {
    for (const section of p.roofSections)
      roofFor(
        out,
        facade(section.center, section.along),
        section.width,
        section.length,
        wallTop,
        grade + ridge,
        top,
      );
  } else {
    roofFor(out, f, width + 0.18, length + 0.24, wallTop, grade + ridge, top);
  }
  if (porch > 0) {
    const front = facade(xz(f.P(0, 0, L)), p.along);
    const h = eave - 0.1;
    if (theme === 'stone-porch') {
      archRow(out, front, -W, width, grade + 0.14, h - 0.08, 0.54, detail);
    } else {
      const count = Math.max(2, Math.round(width / 3.65));
      for (let i = 0; i < count; i++) {
        const u = mix(-W * 0.94, W * 0.94, i / (count - 1));
        fbox(out, 'wood', front, u - 0.1, u + 0.1, grade + 0.15, wallTop, -0.27, 0.09, wood);
      }
      fbox(out, 'wood', front, -W, W, wallTop - 0.24, wallTop + 0.01, -0.23, 0.07, dark);
    }
  }
  if (apse > 0) {
    const at = xz(f.P(0, 0, -L));
    const h = grade + eave * 0.66;
    lathe(
      out,
      'stone',
      at,
      [
        [grade + 0.07, apse, apse],
        [h, apse, apse],
      ],
      detail === 0 ? 7 : 10,
      limestone,
    );
    lathe(
      out,
      'roof',
      at,
      [
        [h, apse * 1.05, apse],
        [h + 0.65, 0.13, 0.13],
      ],
      detail === 0 ? 7 : 10,
      clay,
    );
  }
  const front = facade(xz(f.P(0, 0, foyer)), p.along);
  const doorSize = Math.min(1.24, width * 0.32);
  fbox(
    out,
    'wood',
    front,
    -doorSize * 0.5,
    doorSize * 0.5,
    grade + 0.11,
    grade + Math.min(2.1, eave * 0.76),
    0.01,
    0.07,
    dark,
  );
  if (detail >= 1) {
    const ring = outwardRing(wallOutline);
    for (let i = 0; i < ring.length; i++) {
      const w = wallFace(ring[i], ring[(i + 1) % ring.length]);
      if (w.length < 2.4) continue;
      const count = Math.max(
        1,
        Math.min(9, Math.round(w.length / (theme === 'convent' ? 3.0 : 5.4))),
      );
      for (let j = 0; j < count; j++) {
        const x = (w.length * (j + 0.5)) / count;
        if (
          !porch &&
          count % 2 &&
          j === (count - 1) / 2 &&
          w.normal[0] * f.normal[0] + w.normal[1] * f.normal[1] > 0.87
        )
          continue;
        const wide = theme === 'convent' ? 0.4 : 0.23;
        const y = theme === 'convent' ? beamY + 0.49 : grade + eave * 0.49;
        panel(out, 'wood', w, x - wide, x + wide, y, y + Math.min(1.16, eave * 0.23), 0.072, dark);
        if (detail >= 2)
          fbox(out, 'stone', w, x - wide - 0.09, x + wide + 0.09, y - 0.12, y, 0, 0.17, limestone);
      }
    }
  }
  if (theme === 'convent' && detail >= 2) {
    fbox(out, 'wood', f, -W, W, beamY - 0.22, beamY, L - 0.11, L + 0.17, wood);
    fbox(
      out,
      'plaster',
      f,
      W * 0.42,
      W * 0.62,
      grade + ridge - 0.7,
      grade + ridge + 0.68,
      -1.14,
      -0.58,
      pale,
    );
  }
  if (p.balcony && detail >= 1) {
    const half = Math.min(2.22, W * 0.48);
    const deck = beamY + 0.14;
    fbox(out, 'wood', f, -half, half, deck - 0.18, deck, L - 0.06, L + 0.98, wood);
    fbox(out, 'wood', f, -half, half, deck + 0.76, deck + 0.87, L + 0.91, L + 1.01, dark);
    const rails = detail === 1 ? 4 : 8;
    for (let i = 0; i < rails; i++) {
      const u = mix(-half + 0.06, half - 0.06, i / (rails - 1));
      fbox(out, 'wood', f, u - 0.03, u + 0.03, deck, deck + 0.78, L + 0.92, L + 0.98, wood);
    }
    if (detail >= 2)
      for (const u of [-half * 0.88, half * 0.88])
        beam(out, 'wood', f.P(u, deck - 0.82, L), f.P(u, deck - 0.14, L + 0.87), 0.11, 0.15, wood);
  }
  if (p.cross && detail >= 1) {
    const y = grade + ridge;
    const d = L * 0.42;
    beam(out, 'copper', f.P(0, y - 0.32, d), f.P(0, y + 0.62, d), 0.085, 0.065, dark);
    beam(out, 'copper', f.P(-0.2, y + 0.31, d), f.P(0.2, y + 0.31, d), 0.068, 0.061, dark);
  }
  if (detail === 3) {
    const run = Math.max(3, Math.ceil(length / 1.66));
    for (const side of [-1, 1])
      for (let i = 0; i < run; i++) {
        const d = mix(-L + 0.57, L - 0.57, i / (run - 1));
        beam(
          out,
          'wood',
          f.P(side * (W - 0.09), wallTop - 0.17, d),
          f.P(side * (W + 0.37), wallTop - 0.18, d),
          0.15,
          0.14,
          wood,
        );
      }
  }
}

function build(out, site, detail) {
  const caps = withFootprintCaps(out);
  if (site.court) courtRing(out, caps, site, detail);
  if (site.church) mainChurch(out, caps, site.church, detail);
  if (site.tower) tower(out, caps, site.tower, detail);
  for (const part of site.buildings ?? [])
    for (const section of part.sections ?? [part]) smallBuilding(out, caps, section, detail);
}

export function rilaMonasteryGeometry(site) {
  const buildSkyline = (out) => build(out, site, 0);
  const buildDistrict = (out) => build(out, site, 1);
  const buildStreet = (out) => build(out, site, 2);
  const buildCloseup = (out) => build(out, site, 3);
  return {
    surfaces,
    buildSkyline,
    buildDistrict,
    buildStreet,
    buildCloseup,
    buildMaster: buildCloseup,
  };
}
