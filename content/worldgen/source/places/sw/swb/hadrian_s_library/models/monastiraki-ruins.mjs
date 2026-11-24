import {
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { deform } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { cleanRing } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import {
  fbox,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  limestone: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.96 },
  rubble: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.98 },
  marble: { slot: 'trim', graph: 'stone_marble', roughness: 0.91 },
  brick: { slot: 'wall', graph: 'brick', roughness: 0.97 },
  sill: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.95 },
  recess: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.84 },
};
const stone = ['b8a68b', 'c2af95', 'b1a18b', 'c9b69a', 'ae9c82'].map(rgb);
const ivory = rgb('d4cabb'),
  white = rgb('dfd9cb'),
  broken = rgb('bca991');
const dark = rgb('7e7060'),
  marble = rgb('c8baa4'),
  brick = rgb('a07764');
const ground = ([x, z]) => -0.42 + Math.max(0, x - 25) * 0.031 + Math.max(0, z - 48) * 0.006;
const blend = (a, b, t) => a + (b - a) * t;
const gate = wallFace(site.columns[0].center, site.columns.at(-1).center);

function simplify(points, tolerance) {
  const result = cleanRing(points);
  for (let pass = 0; pass < 2; pass++) {
    for (let i = result.length - 1; i >= 0 && result.length > 3; i--) {
      const a = result[(i + result.length - 1) % result.length],
        b = result[i],
        c = result[(i + 1) % result.length];
      const dx = c[0] - a[0],
        dz = c[1] - a[1],
        l = Math.hypot(dx, dz);
      if (l > tolerance && Math.abs((b[0] - a[0]) * dz - (b[1] - a[1]) * dx) / l < tolerance)
        result.splice(i, 1);
    }
  }
  return outwardRing(result);
}

function face(out, slot, f, a, b, lo, hi, d, color) {
  const p = f.P;
  quad4(out, slot, p(a, lo, d), p(b, lo, d), p(b, hi, d), p(a, hi, d), color);
}

function crest(part, x, z) {
  const variation = Math.sin(x * 0.31 + z * 0.21 + (part.id % 3));
  if (part.name === 'northeastWall')
    return (
      ground([x, z]) + 0.69 + 4.2 * Math.max(0, 1 - Math.abs(z + 17.15) / 4.5) + 0.31 * variation
    );
  if (part.name === 'eastShelves') return ground([x, z]) + part.height + 0.76 * variation;
  if (part.name === 'westColonnade')
    return part.height + (z < -24 ? 0.14 : Math.max(0, 0.09 * variation + 0.28));
  return ground([x, z]) + part.height + (part.height > 1.5 ? 0.2 : 0.08) * variation;
}

function ruinedWall(out, detail, part) {
  const r = simplify(part.outline, [0.46, 0.12, 0.061, 0.035][detail]);
  const y = (p) => crest(part, ...p),
    tall = part.height > 2.1;
  for (const [i, a] of r.entries()) {
    const b = r[(i + 1) % r.length],
      f = wallFace(a, b),
      l = f.length;
    if (l < 0.026) continue;
    const p = f.P,
      color = stone[(i + part.id) % stone.length];
    const baseA = ground(a) - 1.13,
      baseB = ground(b) - 1.13;
    const upperA = y(a),
      upperB = y(b);
    quad4(
      out,
      tall ? 'limestone' : 'rubble',
      p(0, baseA),
      p(l, baseB),
      p(l, upperB),
      p(0, upperA),
      color,
    );
    if (detail > 0 && l > 0.32 && tall) {
      const low = Math.max(baseA, baseB) + 0.31;
      const top = Math.min(upperA, upperB);
      const rows = Math.max(1, Math.floor((top - low) / (detail < 3 ? 1.05 : 0.69)));
      for (let j = 1; j < rows; j++) {
        const y = blend(low, top, j / rows),
          tone = stone[(j + i) % stone.length];
        face(out, 'sill', f, 0, l, y, y + 0.048, 0.028, tone);
        if (detail < 2 || l < 1.21) continue;
        const n = Math.max(1, Math.round(l / 1.93));
        for (let k = 0; k < n; k++) {
          const u = (l * (k + (j % 2 ? 0.29 : 0.57))) / n;
          face(out, 'sill', f, u, u + 0.021, y, y + (top - low) / rows - 0.045, 0.034, broken);
        }
      }
      if (part.name === 'eastShelves' && l > 1.1 && f.normal[0] < -0.65) {
        const u = l * 0.53,
          base = ground(a) + 1.9,
          high = Math.min(top - 0.55, base + 2.17);
        if (high > base + 0.81) {
          face(out, 'brick', f, u - 0.36, u + 0.36, base, high, 0.052, brick);
          if (detail > 1)
            face(out, 'recess', f, u - 0.235, u + 0.235, base - 0.06, base + 0.34, 0.064, dark);
        }
      }
    }
  }
  const skin = deform(out, ([x, , z]) => [x, crest(part, x, z), z]);
  cap(skin, tall ? 'limestone' : 'rubble', r, 0, broken);
}

function shaft(out, detail, p, foot, attached = false) {
  const n = [6, 12, 20, 30][detail],
    r = p.radius;
  const ring = (h, radius, flute = false) => {
    const profile = radialRing(foot + h, radius, radius, n, p.center);
    if (!flute || detail < 2) return profile;
    return profile.map(([x, y, z], i) => {
      const scale = i % 2 === 0 ? 1 : 0.91;
      return [p.center[0] + (x - p.center[0]) * scale, y, p.center[1] + (z - p.center[1]) * scale];
    });
  };
  const h = p.height,
    h1 = p.restored ? Math.min(2.11, h * 0.5) : 0.53;
  const top = h - (h > 5.8 ? 0.63 : 0.19);
  const plinth = attached ? 1.08 : 1.33;
  if (detail === 0) {
    loft(out, 'marble', [ring(-0.068, r * plinth), ring(0.42, r * 1.08)], ivory, { cap: false });
    loft(
      out,
      p.restored ? 'marble' : 'limestone',
      [ring(0.39, r), ring(top, r * 0.84)],
      p.restored ? ivory : marble,
      { cap: false },
    );
    loft(out, 'marble', [ring(top - 0.022, r * 0.84), ring(h, r * (h > 5.8 ? 1.08 : 0.79))], ivory);
    return;
  }
  loft(
    out,
    'marble',
    [ring(-0.068, r * plinth), ring(0.22, r * plinth), ring(0.39, r * 1.15), ring(0.51, r * 1.08)],
    ivory,
  );
  loft(
    out,
    p.restored ? 'marble' : 'limestone',
    [ring(0.49, r * 0.95, true), ring(h1, r * 0.92, true)],
    p.restored ? white : marble,
  );
  const band = p.restored && h > 5.8 ? 0.37 : 0.033;
  loft(
    out,
    'limestone',
    [ring(h1, r * 0.92, true), ring(top - band, r * 0.82, true)],
    stone[p.id % stone.length],
  );
  loft(
    out,
    'marble',
    [ring(top - band, r * 0.82, true), ring(top, r * 0.81, true)],
    p.restored ? ivory : marble,
  );
  const crown = h > 5.8 && (p.id !== 729674848 || attached);
  loft(
    out,
    'marble',
    [
      ring(top, r * 0.9),
      ring(top + (h - top) * 0.24, r * 0.91),
      ring(h - 0.066, r * (crown ? 1.16 : 0.87)),
      ring(h, r * (crown ? 1.14 : 0.76)),
    ],
    p.restored ? ivory : marble,
  );
}

function porch(out, detail) {
  const { gatePlatform: y } = site,
    l = gate.length;
  fbox(
    out,
    'rubble',
    gate,
    -0.57,
    l + 1.16,
    site.foundationBottom,
    y - 0.16,
    -0.96,
    1.13,
    stone[1],
  );
  fbox(out, 'marble', gate, -0.73, l + 1.28, y - 0.17, y, -0.97, 1.29, marble);
  const steps = detail === 0 ? 2 : 4;
  for (let j = 0; j < steps; j++) {
    const t = j / steps,
      next = (j + 1) / steps;
    fbox(
      out,
      'marble',
      gate,
      -0.8 - j * 0.096,
      l + 1.37 + j * 0.096,
      -0.91,
      blend(y - 0.12, -0.16, t),
      1.29 + t * 2.13,
      1.29 + next * 2.13,
      j % 2 ? marble : ivory,
    );
  }
  for (const column of site.columns) shaft(out, detail, column, y);
  const line = wallFace([-4.85, -31.47], [-11.87, -3.72]);
  const count = detail === 0 ? 2 : 7;
  for (let j = 0; j < count; j++) {
    const u = 2.2 + (j * (line.length - 4.1)) / (count - 1);
    const c = line.P(u, 0, 1.05).filter((_, i) => i !== 1);
    shaft(
      out,
      Math.max(0, detail - 1),
      {
        center: c,
        radius: 0.39,
        height: 6.12 + 0.045 * Math.sin(j),
        id: 729674870 + j,
        restored: false,
      },
      0.09,
      true,
    );
    if (detail > 0) fbox(out, 'sill', line, u - 1.12, u + 1.09, 6.27, 6.67, -0.01, 1.58, stone[1]);
  }
}

function archRemnant(out, detail, part) {
  const outline = outwardRing(part.outline);
  const f = outline
    .map((p, i) => wallFace(p, outline[(i + 1) % outline.length]))
    .sort((a, b) => b.length - a.length)[0];
  const y = ground(f.origin),
    l = f.length,
    span = l * 0.56,
    h = y + part.height;
  const mid = l / 2,
    r = span * 0.5,
    spring = h - r - 0.53;
  fbox(out, 'brick', f, 0, mid - r, y - 0.75, h, -0.81, 0, brick);
  fbox(out, 'limestone', f, mid + r, l, y - 0.75, h, -0.81, 0, stone[1]);
  const a = roundArch(r, [4, 6, 8, 12][detail]);
  for (let i = 1; i < a.length; i++) {
    const [x, z] = a[i - 1],
      [u, v] = a[i],
      p = f.P;
    quad4(
      out,
      'brick',
      p(x + mid, spring + z, 0),
      p(u + mid, spring + v, 0),
      p(u + mid, h, 0),
      p(x + mid, h, 0),
      brick,
    );
    quad4(
      out,
      'rubble',
      p(u + mid, spring + v, 0),
      p(x + mid, spring + z, 0),
      p(x + mid, spring + z, -0.81),
      p(u + mid, spring + v, -0.81),
      broken,
    );
  }
  fbox(out, 'sill', f, 0, l, h, h + 0.08, -0.81, 0, marble);
}

function stoneRows(out, detail) {
  if (detail < 2) return;
  for (const { outline } of site.remnants) {
    const f = outline
      .map((p, i) => wallFace(p, outline[(i + 1) % outline.length]))
      .sort((a, b) => b.length - a.length)[0];
    const y = ground(f.origin),
      n = detail === 2 ? 4 : 6;
    for (let j = 0; j < n; j++) {
      const pos = (f.length * (j + 0.5)) / n;
      const r = 0.31 + (j % 3) * 0.11;
      fbox(
        out,
        'rubble',
        f,
        pos - r,
        pos + r,
        y - 0.32,
        y + 0.32 + (j % 2) * 0.15,
        -1.83,
        -0.32,
        stone[(j + 1) % stone.length],
      );
    }
  }
}

function build(out, detail) {
  for (const p of site.walls) {
    if (p.name === 'libraryArch') archRemnant(out, detail, p);
    else if (detail > 0 || p.height >= 1.15 || p.name === 'apsidalChurch')
      ruinedWall(out, detail, p);
  }
  porch(out, detail);
  stoneRows(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
