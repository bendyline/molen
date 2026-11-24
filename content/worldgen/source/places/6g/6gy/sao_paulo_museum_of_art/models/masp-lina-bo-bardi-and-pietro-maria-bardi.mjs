import {
  extrude,
  facade,
  fan,
  fbox,
  outwardRing,
  quad4,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.97 },
  red: { slot: 'trim', graph: 'concrete_boardformed', roughness: 0.92 },
  glass: { slot: 'window', graph: 'glass_frit_triangular', roughness: 0.41, metallic: 0.11 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.82 },
  ribs: { slot: 'wall', graph: 'metal_corrugated', roughness: 0.86, metallic: 0.05 },
  paving: { slot: 'foundation', graph: 'stone_granite', roughness: 0.98 },
  louver: { slot: 'trim', graph: 'metal_perforated_square', roughness: 0.85 },
};

const F = facade(site.frame.origin, site.frame.along);
const P = (u, y, d) => F.P(u, y, d);
const xz = ([x, , z]) => [x, z];
const red = rgb('9e3736');
const redLite = rgb('ad3b39');
const concrete = rgb('93918a');
const underside = rgb('817d74');
const black = rgb('484f52');
const rail = rgb('6e6b61');
const pavement = rgb('9b9890');
const panelShade = rgb('384143');
const expansionSheet = rgb('73736b');
const glazed = rgb('75878e');
const clear = rgb('798d96');
const { underside: bottom, roof, girderTop, podiumRear } = site.geometry;
const { width, depth } = site.hallFrame;
const grade = (u) => Math.min(2.4, Math.max(-0.13, -0.125 + (u + 3.4) * 0.031));
const localPoint = ([u, v]) => xz(P(u, 0, v));

function panel(out, slot, f, u, U, y, Y, d, color) {
  quad4(out, slot, f.P(u, y, d), f.P(U, y, d), f.P(U, Y, d), f.P(u, Y, d), color);
}
function box(out, slot, u, U, y, Y, d, D, color) {
  fbox(out, slot, F, u, U, y, Y, d, D, color, { bottom: true });
}
function block(out, slot, outline, y, Y, color, { bottom = false, bottomColor = color } = {}) {
  extrude(out, slot, outline, y, Y, color, { top: false });
  cap(out, slot, outline, Y, color);
  if (bottom)
    fan(
      out,
      slot,
      outwardRing(outline)
        .reverse()
        .map(([x, z]) => [x, y, z]),
      bottomColor,
    );
}
function faces(outline) {
  const ring = outwardRing(outline);
  return ring.map((a, i) => wallFace(a, ring[(i + 1) % ring.length]));
}

function portals(out, detail) {
  for (const { outline } of site.piers) block(out, 'red', outline, -8.85, girderTop, red);
  for (const { outline } of site.girders) block(out, 'red', outline, 22.0, girderTop, redLite);
  if (detail > 1) {
    for (const { outline } of site.piers)
      for (const f of faces(outline)) {
        for (let y = 2.52; y < girderTop - 0.4; y += 1.31) {
          fbox(out, 'red', f, 0.014, f.length - 0.014, y, y + 0.028, -0.016, 0.014, redLite);
        }
      }
  }
}

function curtain(out, f, index, detail) {
  const l = f.length;
  const low = bottom + 0.55;
  const top = roof - 1.48;
  const beam = 14.97;
  const materialTone = index % 2 === 0 ? clear : glazed;
  if (detail === 0) {
    panel(out, 'glass', f, 0, l, low, top, 0, materialTone);
    return;
  }
  const count = Math.round(l / (detail === 1 ? 3.0 : 1.34));
  for (let i = 0; i < count; i++) {
    const u = (i * l) / count,
      U = ((i + 1) * l) / count;
    const a = 0.037 + Math.sin(i * 4.13 + index) * 0.019;
    const color = materialTone.map((v, k) => v + a * (k === 0 ? 0.71 : 0.96));
    const dark = materialTone.map((v, k) => v - 0.027 * Math.cos(i * 2.71 + k));
    panel(out, 'glass', f, u + 0.017, U - 0.017, low, beam - 0.036, 0.013, color);
    panel(out, 'glass', f, u + 0.017, U - 0.017, beam + 0.036, top, 0.013, dark);
    const slim = detail === 1 ? 0.084 : 0.058;
    fbox(
      out,
      'metal',
      f,
      u - slim / 2,
      u + slim / 2,
      low - 0.028,
      top + 0.024,
      -0.025,
      0.104,
      black,
    );
    if (detail > 1 && (index === 1 || index === 3) && i % 13 >= 10) {
      panel(out, 'louver', f, u + 0.058, U - 0.051, beam + 0.22, top - 0.23, 0.041, panelShade);
    }
    if (detail === 3) {
      panel(out, 'metal', f, u + 0.028, u + 0.046, low + 0.041, top - 0.067, 0.026, panelShade);
      panel(out, 'metal', f, u + 0.043, U - 0.043, beam + 0.089, beam + 0.11, 0.027, black);
    }
  }
  fbox(out, 'metal', f, 0, l, beam - 0.053, beam + 0.058, -0.023, 0.083, black);
  fbox(out, 'metal', f, 0, l, low - 0.047, low + 0.039, -0.015, 0.076, black);
  fbox(out, 'metal', f, 0, l, top - 0.033, top + 0.045, -0.02, 0.057, black);
}

function floatingHall(out, detail) {
  block(out, 'concrete', site.hall, bottom, bottom + 0.55, concrete, {
    bottom: true,
    bottomColor: underside,
  });
  block(out, 'concrete', site.hall, roof - 1.51, roof, concrete);
  for (const [i, f] of faces(site.hall).entries()) curtain(out, f, i, detail);
  if (detail > 1) {
    // These ribs mark the board-formed soffit and leave the plaza unobstructed.
    for (let i = 1; i < 12; i++) {
      const d = (i * depth) / 12;
      box(
        out,
        'concrete',
        0.02,
        width - 0.02,
        bottom - 0.021,
        bottom + 0.013,
        d - 0.024,
        d + 0.024,
        underside,
      );
    }
  }
  if (detail > 0)
    box(out, 'concrete', 4.67, 9.42, roof - 0.03, roof + 0.81, 12.16, 17.01, concrete);
}

function terrace(out, detail) {
  const points = [
    [-3.4, -0.13],
    [76.0, -0.13],
    [76.0, 39.27],
    [68.8, podiumRear],
    [-3.4, podiumRear],
  ];
  const A = ([u, d]) => P(u, grade(u), d);
  const underside = ([u, d]) => P(u, -9.14, d);
  const ring = outwardRing(points.map(localPoint));
  const plaza = points.map(A);
  fan(out, 'paving', plaza.slice().reverse(), pavement);
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    quad4(
      out,
      'concrete',
      underside(points[j]),
      underside(points[i]),
      plaza[i],
      plaza[j],
      concrete,
    );
  }
  if (detail === 0) return;
  for (const f of faces(ring)) {
    const side = f.normal[0] * F.normal[0] + f.normal[1] * F.normal[1];
    if (side < 0.35) continue;
    const count = Math.max(2, Math.round(f.length / 3.58));
    for (let i = 0; i < count; i++) {
      const u = ((i + 0.5) * f.length) / count;
      const a = (f.length / count) * 0.45;
      for (const y of [-7.42, -3.17]) {
        panel(out, 'glass', f, u - a, u + a, y, y + 2.51, 0.024, glazed);
        fbox(
          out,
          'concrete',
          f,
          u - a - 0.03,
          u + a + 0.03,
          y - 0.14,
          y - 0.01,
          0.003,
          0.086,
          concrete,
        );
      }
      if (detail > 1) fbox(out, 'metal', f, u - 0.032, u + 0.035, -7.42, -4.9, 0, 0.072, black);
    }
  }
  const back = wallFace(xz(P(-3.15, 0, podiumRear)), xz(P(68.81, 0, podiumRear)));
  for (let i = 0; i <= (detail > 1 ? 24 : 10); i++) {
    const x = (back.length * i) / (detail > 1 ? 24 : 10);
    const y = grade(x - 3.15);
    fbox(out, 'metal', back, x - 0.032, x + 0.032, y - 0.025, y + 1.1, -0.07, 0.026, rail);
  }
  const bar = (y) =>
    quad4(
      out,
      'metal',
      back.P(0, grade(-3.15) + y, 0.03),
      back.P(back.length, grade(68.81) + y, 0.03),
      back.P(back.length, grade(68.81) + y + 0.06, 0.03),
      back.P(0, grade(-3.15) + y + 0.06, 0.03),
      rail,
    );
  bar(0.58);
  bar(1.04);
}

function flight(out, a, b, y, Y, w, detail) {
  const F = wallFace(a, b);
  const steps = detail === 0 ? 5 : detail === 1 ? 10 : 17;
  for (let i = 0; i < steps; i++) {
    const q = i / steps,
      Q = (i + 1) / steps,
      h = y + (Y - y) * Q;
    fbox(out, 'concrete', F, F.length * q, F.length * Q, h - 0.49, h, -w / 2, w / 2, concrete, {
      bottom: true,
    });
  }
  if (detail < 2) return;
  const L = F.length;
  for (const d of [-w / 2, w / 2]) {
    for (let i = 0; i <= 4; i++) {
      const q = i / 4,
        b = y + (Y - y) * q;
      fbox(
        out,
        'metal',
        F,
        L * q - 0.041,
        L * q + 0.041,
        b - 0.042,
        b + 1.07,
        d - 0.034,
        d + 0.034,
        rail,
      );
    }
    quad4(
      out,
      'metal',
      F.P(0, y + 0.997, d),
      F.P(L, Y + 0.997, d),
      F.P(L, Y + 1.045, d),
      F.P(0, y + 1.045, d),
      rail,
    );
  }
}

function entryStairs(out, detail) {
  const points = site.stair.map(localPoint);
  const y = grade(site.stair[0][0]);
  const landing = 5.32;
  flight(out, points[0], points[1], y, landing, 1.47, detail);
  flight(out, points[1], points[2], landing, bottom + 0.07, 1.5, detail);
  block(
    out,
    'concrete',
    [
      [58.94, 13.75],
      [60.64, 13.75],
      [60.64, 15.33],
      [58.94, 15.33],
    ].map(localPoint),
    landing - 0.26,
    landing,
    concrete,
    { bottom: true, bottomColor: underside },
  );
  if (detail > 1) {
    box(out, 'metal', 58.84, 60.19, grade(59) - 0.02, bottom + 2.01, 11.46, 11.58, black);
    box(out, 'metal', 60.08, 60.22, grade(60) - 0.02, bottom + 2.01, 11.49, 13.92, black);
    box(out, 'glass', 60.12, 60.24, grade(60) + 0.04, bottom + 1.27, 11.65, 13.78, glazed);
  }
}

function expansion(out, detail) {
  const { base } = site.bardi;
  const above = site.bardi.roof;
  const tower = site.tower.outline;
  const annex = site.pavilion.outline;
  const sill = base + 4.95;
  block(out, 'ribs', tower, sill, base + above, expansionSheet);
  block(out, 'concrete', annex, base - 4.52, base + 3.006, concrete);
  const roofPad = site.tower.local;
  const minU = Math.min(...roofPad.map((p) => p[0]));
  const minD = Math.min(...roofPad.map((p) => p[1]));
  const maxU = Math.max(...roofPad.map((p) => p[0]));
  const roofY = base + above;
  if (detail > 0) {
    box(
      out,
      'ribs',
      minU + 2.16,
      maxU - 2.84,
      roofY - 0.05,
      roofY + 0.118,
      minD + 6.09,
      minD + 11.3,
      panelShade,
    );
  }
  for (const [i, f] of faces(tower).entries()) {
    const l = f.length;
    if (l < 0.115) continue;
    const innerRgb = expansionSheet.map((v) => v - (i % 2 === 0 ? 0.038 : 0.023));
    panel(out, 'glass', f, 0, l, base - 0.04, sill + 0.02, -0.011, glazed);
    if (detail === 0) continue;
    fbox(out, 'metal', f, 0, l, sill - 0.113, sill + 0.022, -0.028, 0.08, innerRgb);
    const count = Math.max(1, Math.round(l / (detail === 1 ? 4.8 : 2.34)));
    for (let j = 0; j <= count; j++) {
      const u = (l * j) / count;
      fbox(out, 'metal', f, u - 0.04, u + 0.045, base - 0.07, sill, -0.011, 0.094, black);
      if (detail > 1) {
        fbox(
          out,
          'ribs',
          f,
          u - 0.07,
          u + 0.07,
          sill + 0.08,
          base + above - 0.11,
          0.022,
          0.12,
          innerRgb,
        );
      }
    }
    for (let y = sill + 4.75; y < base + above - 0.4; y += 5.4) {
      fbox(out, 'metal', f, 0.022, l - 0.022, y, y + 0.054, -0.019, 0.057, black);
    }
  }
  if (detail > 1) {
    for (const f of faces(annex)) {
      const l = f.length;
      if (l < 3.8) continue;
      panel(out, 'glass', f, 0.45, l - 0.44, base - 0.02, base + 2.71, 0.021, glazed);
      const bays = Math.max(1, Math.floor(l / 2.43));
      for (let i = 1; i < bays; i++) {
        const u = (i * l) / bays;
        fbox(out, 'metal', f, u - 0.045, u + 0.045, base - 0.025, base + 2.84, 0, 0.085, black);
      }
    }
  }
}

function build(out, detail) {
  terrace(out, detail);
  floatingHall(out, detail);
  portals(out, detail);
  entryStairs(out, detail);
  expansion(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
