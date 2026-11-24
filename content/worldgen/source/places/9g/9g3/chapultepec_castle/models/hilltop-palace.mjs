import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { deform } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import {
  abox,
  facade,
  fbox,
  opening,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  stone: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.95 },
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.93 },
  trim: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.86 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.91 },
  canopy: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.81 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.8 },
  foliage: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.96 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.49 },
};

const base = rgb('888078'),
  darkStone = rgb('777169'),
  tan = rgb('c8c0aa'),
  cream = rgb('dbd1bc');
const warm = rgb('b6a58b'),
  cladding = rgb('aaa495'),
  tile = rgb('ad8f70'),
  white = rgb('d7dad4');
const glass = rgb('566770'),
  shade = rgb('5d5e55'),
  iron = rgb('424e4b'),
  grass = rgb('68784b');
const terrace = site.terrace,
  gallery = site.gardenHeight;
const frame = facade(site.origin, site.along);
const outer = outwardRing(site.plan),
  building = outwardRing(site.inset);
const courtyard = outwardRing(site.court),
  towerPlan = outwardRing(site.mast);
const ledge = 17.18;

function surface(out, slot, F, u0, u1, y0, y1, d, color) {
  const p = F.P;
  quad4(out, slot, p(u0, y0, d), p(u1, y0, d), p(u1, y1, d), p(u0, y1, d), color);
}

function pane(out, detail, F, u, y, w, h, { arch = false, d = 0, color = glass } = {}) {
  if (detail < 3 || !arch) {
    if (detail > 0)
      surface(
        out,
        'trim',
        F,
        u - w / 2 - 0.12,
        u + w / 2 + 0.12,
        y - 0.08,
        y + h + 0.11,
        d + 0.035,
        cream,
      );
    surface(out, 'glass', F, u - w / 2, u + w / 2, y, y + h, d + 0.071, color);
    if (detail > 1) surface(out, 'metal', F, u - 0.029, u + 0.029, y, y + h, d + 0.1, iron);
    return;
  }
  const at = facade(
    F.P(0, 0, d + 0.08).filter((_, i) => i !== 1),
    F.along,
  );
  opening(out, at, u, y, w, h, {
    head: 'round',
    glassSlot: 'glass',
    frameSlot: 'trim',
    glass: color,
    frame: cream,
    frameWidth: detail === 2 ? 0.1 : 0.165,
    d: 0.033,
    frameDepth: 0.12,
    sill: detail > 2,
    mullions: detail > 2 ? 1 : 0,
    transoms: detail > 2 ? 2 : 0,
    mullionColor: shade,
  });
}

function railing(out, detail, F, a, b, y, d, stone = false) {
  if (b - a < 0.45 || detail === 0) return;
  const slot = stone ? 'trim' : 'metal',
    fill = stone ? cream : iron;
  const h = stone ? 1.05 : 0.87;
  for (const top of [y + 0.08, y + h - 0.12])
    fbox(out, slot, F, a, b, top, top + 0.125, d - 0.07, d + 0.08, fill);
  if (detail === 1) return;
  const count = Math.ceil((b - a) / (detail === 2 ? 1.67 : 0.61));
  for (let k = 0; k <= count; k++) {
    const u = a + ((b - a) * k) / count;
    fbox(out, slot, F, u - 0.047, u + 0.047, y + 0.12, y + h - 0.08, d - 0.047, d + 0.051, fill);
  }
}

function footings(out, detail) {
  for (const [i, a] of outer.entries()) {
    const b = outer[(i + 1) % outer.length],
      F = wallFace(a, b);
    if (F.length < 0.04) continue;
    surface(
      out,
      'stone',
      F,
      0,
      F.length,
      site.foundationBottom,
      terrace,
      0,
      i % 7 === 3 ? darkStone : base,
    );
    if (detail === 0) continue;
    if (detail === 1)
      surface(out, 'trim', F, 0, F.length, terrace - 0.38, terrace - 0.11, 0.08, warm);
    else fbox(out, 'trim', F, 0, F.length, terrace - 0.38, terrace - 0.11, -0.22, 0.17, warm);
    const east = (a[0] + b[0]) / 2 > 124;
    if (east || F.length > 12) {
      railing(out, detail, F, 0.2, F.length - 0.2, terrace, -0.34, true);
      if (F.length > 4)
        for (const u of [0.35, F.length - 0.35])
          fbox(out, 'trim', F, u - 0.24, u + 0.24, terrace, terrace + 1.12, -0.65, -0.04, warm);
    }
    if (east && F.length > 4.2 && detail > 1) {
      const n = Math.floor(F.length / 5.2);
      for (let i = 0; i < n; i++)
        pane(out, detail, F, ((i + 0.5) * F.length) / n, terrace - 4.85, 1.62, 1.87, {
          arch: true,
          color: darkStone,
        });
    }
  }
  cap(out, 'stone', site.plan, terrace, cladding);
}

function bays(out, detail, F, y0, y1, east) {
  const n = Math.max(1, Math.round(F.length / [11, 6.95, 5.64, 4.7][detail]));
  const bay = F.length / n;
  if (y0 < 5 && east && (detail > 0 || Math.abs(F.normal[0]) > 0.8)) {
    const r = bay * 0.35,
      spring = y0 + 3.32,
      inset = 0.61;
    const curve = roundArch(r, detail < 2 ? 4 : 7);
    surface(out, 'wall', F, 0, F.length, y0, y1, -inset, shade);
    for (let i = 0; i < n; i++) {
      const a = i * bay,
        b = (i + 1) * bay,
        c = (a + b) / 2;
      surface(out, 'wall', F, a, c - r, y0, y1, 0, tan);
      surface(out, 'wall', F, c + r, b, y0, y1, 0, tan);
      for (let j = 1; j < curve.length; j++) {
        const [u, h] = curve[j - 1],
          [v, k] = curve[j],
          p = F.P;
        quad4(
          out,
          'wall',
          p(c + u, spring + h, 0),
          p(c + v, spring + k, 0),
          p(c + v, y1, 0),
          p(c + u, y1, 0),
          tan,
        );
        if (detail > 0)
          quad4(
            out,
            'trim',
            p(c + u, spring + h, -inset),
            p(c + v, spring + k, -inset),
            p(c + v, spring + k, 0),
            p(c + u, spring + h, 0),
            warm,
          );
      }
      pane(out, detail, F, c, y0 + 0.15, r * 1.26, 3.64, {
        arch: detail > 1,
        d: -inset + 0.02,
        color: shade,
      });
    }
  } else {
    surface(out, 'wall', F, 0, F.length, y0, y1, 0, tan);
    for (let j = 0; j < n; j++) {
      const u = (j + 0.5) * bay;
      pane(out, detail, F, u, y0 + 0.87, bay * (east ? 0.77 : 0.48), y1 - y0 - 1.72, {
        arch: !east && detail > 1,
      });
      if (east && detail > 1)
        for (const x of [u - 0.26 * bay, u + 0.26 * bay])
          surface(out, 'metal', F, x - 0.027, x + 0.027, y0 + 1.02, y1 - 0.77, 0.152, cream);
    }
    if (east && detail > 0)
      for (const h of [0.43, 2.17, 3.87])
        surface(out, 'trim', F, 0, F.length, y0 + h, y0 + h + 0.055, 0.179, cream);
  }
}

function elevations(out, detail) {
  for (const [i, a] of building.entries()) {
    const b = building[(i + 1) % building.length],
      F = wallFace(a, b);
    if (F.length < 0.008) continue;
    const alcazar = (a[0] + b[0]) / 2 > 120 && F.length > 7;
    if (F.length < (detail === 0 ? 7.6 : 1.25))
      surface(out, 'wall', F, 0, F.length, terrace, ledge, 0, tan);
    else {
      bays(out, detail, F, terrace, 8.89, alcazar);
      bays(out, detail, F, 8.89, gallery + 1.67, alcazar);
      surface(out, 'wall', F, 0, F.length, gallery + 1.67, ledge, 0, tan);
    }
    for (const h of [8.78, 15.2, 16.59]) {
      if (detail === 1) surface(out, 'trim', F, 0, F.length, h, h + 0.2, 0.062, cream);
      else if (detail > 1) fbox(out, 'trim', F, 0, F.length, h, h + 0.2, -0.04, 0.19, cream);
    }
    if (detail > 1) railing(out, detail, F, 0, F.length, ledge, -0.28, true);
  }
  const court = courtyard.slice().reverse();
  for (const [i, a] of court.entries()) {
    const F = wallFace(a, court[(i + 1) % court.length]);
    surface(out, 'wall', F, 0, F.length, terrace, ledge, 0, warm);
    if (detail > 0) railing(out, detail, F, 0, F.length, ledge, -0.02, true);
  }
  for (const r of site.bodyCaps) cap(out, 'tile', r, ledge, tile);
}

function vault(out, detail, x0, x1, d0, d1) {
  const n = [5, 8, 13, 20][detail];
  const y0 = ledge + 0.17;
  const p = (u, t) => [u, y0 + 3.1 * Math.sin(t * Math.PI), d0 + t * (d1 - d0)];
  for (let j = 1; j <= n; j++) {
    const a = (j - 1) / n,
      b = j / n;
    quad4(
      out,
      'canopy',
      p(x0, a),
      p(x0, b),
      p(x1, b),
      p(x1, a),
      j % 3 === 0 ? rgb('bcc2be') : white,
    );
    const left = [p(x0, b), p(x0, a), [x0, y0, d0 + a * (d1 - d0)], [x0, y0, d0 + b * (d1 - d0)]];
    const right = [p(x1, a), p(x1, b), [x1, y0, d0 + b * (d1 - d0)], [x1, y0, d0 + a * (d1 - d0)]];
    if (j === 1 || j === n) {
      left.splice(j === 1 ? 2 : 3, 1);
      right.splice(j === 1 ? 3 : 2, 1);
      tri(out, 'wall', ...left, tan);
      tri(out, 'wall', ...right, tan);
    } else {
      quad4(out, 'wall', ...left, tan);
      quad4(out, 'wall', ...right, tan);
    }
  }
}

function roofFeatures(out, detail) {
  for (const [a, b, c, d] of [
    [12.4, 54.0, 7.4, 27.25],
    [58, 103.6, 6.15, 25.98],
  ])
    vault(out, detail, a, b, c, d);
  for (const center of [
    [167.28, 10.71],
    [167.31, 37.02],
  ]) {
    const rings = [
      [ledge, 2.12],
      [ledge + 3.54, 1.71],
      [ledge + 3.89, 1.89],
      [ledge + 4.12, 1.89],
    ];
    loft(
      out,
      'wall',
      (detail === 0 ? [rings[0], rings.at(-1)] : rings).map(([y, r]) =>
        radialRing(y, r, r, [6, 10, 18, 25][detail], center),
      ),
      warm,
    );
    loft(
      out,
      'trim',
      [
        [ledge + 4.12, 1.93],
        [ledge + 4.49, 1.93],
      ].map(([y, r]) => radialRing(y, r, r, [6, 10, 18, 25][detail], center)),
      cream,
    );
  }
  cap(out, 'stone', site.court, gallery, cladding);
  for (const [x, d, w, s] of [
    [123.8, 14.6, 7.4, 12.4],
    [123.7, 34.9, 7.2, 11.8],
    [140.2, 10, 8.3, 5.05],
    [151.6, 26.3, 5.6, 10.5],
  ]) {
    abox(
      out,
      'foliage',
      [x - w / 2, gallery, d - s / 2],
      [x + w / 2, gallery + 0.36, d + s / 2],
      grass,
      { bottom: false },
    );
    if (detail > 1) {
      for (const u of [x - w / 2 + 0.26, x + w / 2 - 0.26])
        abox(
          out,
          'foliage',
          [u - 0.25, gallery + 0.33, d - s / 2],
          [u + 0.25, gallery + 0.69, d + s / 2],
          rgb('566744'),
          { bottom: false },
        );
    }
  }
}

function tower(out, detail) {
  const top = site.towerHeight;
  for (const [i, a] of towerPlan.entries()) {
    const F = wallFace(a, towerPlan[(i + 1) % towerPlan.length]);
    surface(out, 'stone', F, 0, F.length, gallery, top - 0.69, 0, warm);
    for (const [y, w, d] of [
      [gallery + 4.78, 0.33, 0.16],
      [gallery + 9.8, 0.46, 0.23],
      [top - 1.32, 0.41, 0.41],
    ]) {
      if (detail === 0) surface(out, 'trim', F, 0, F.length, y, y + w, 0.08, cream);
      else fbox(out, 'trim', F, -0.075, F.length + 0.075, y, y + w, -0.12, d, cream);
    }
    for (const u of [F.length * 0.24, F.length * 0.5, F.length * 0.76]) {
      pane(out, detail, F, u, top - 6.09, 1.47, 3.43, { arch: true, color: shade });
    }
    if (detail > 0)
      pane(out, detail, F, F.length * 0.5, gallery + 2.02, 1.42, 2.92, {
        arch: true,
        color: shade,
      });
    const n = detail === 0 ? 3 : 5;
    for (let j = 0; j < n; j++) {
      const u = (F.length * j) / n;
      fbox(out, 'stone', F, u - 0.29, u + 0.91, top - 0.98, top, -0.49, 0.19, base);
    }
  }
  cap(out, 'stone', site.mast, top - 0.67, base);
  const [x, z] = site.mast.reduce(
    ([a, b], [x, z]) => [a + x / site.mast.length, b + z / site.mast.length],
    [0, 0],
  );
  beam(out, 'metal', [x, top - 0.74, z], [x, top + 6.52, z], 0.083, 0.083, iron);
  const cloth = (t, y) => [
    x + 0.46 + 3.81 * t,
    top + 6.3 - y - t * 0.22,
    z + Math.sin(t * 7.5) * 0.43,
  ];
  for (const [i, c] of ['597a55', 'dddace', 'a75149'].entries()) {
    const a = i / 3,
      b = (i + 1) / 3;
    const p = [cloth(a, 0), cloth(b, 0), cloth(b, 2.2), cloth(a, 2.2)];
    quad4(out, 'metal', ...p, rgb(c));
    quad4(out, 'metal', ...p.slice().reverse(), rgb(c));
  }
}

function build(out, detail) {
  const local = deform(out, ([x, y, z]) => frame.P(x, y, z));
  footings(local, detail);
  elevations(local, detail);
  roofFeatures(local, detail);
  tower(local, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
