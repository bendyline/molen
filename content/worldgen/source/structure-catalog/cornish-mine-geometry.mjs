import { withFootprintCaps } from '../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  extrude,
  facade,
  fbox,
  gableRoof,
  lathe,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const surfaceLibrary = {
  rubble: { slot: 'wall', graph: 'stone_drywall', roughness: 0.98 },
  granite: { slot: 'trim', graph: 'stone_granite', roughness: 0.96 },
  brick: { slot: 'trim', graph: 'brick', roughness: 0.96 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.93 },
  timber: { slot: 'wall', graph: 'wood_vertical', roughness: 0.9 },
  bedrock: { slot: 'foundation', graph: 'stone_basalt_raw', roughness: 0.99 },
};
const killas = rgb('ab9c84');
const inside = rgb('897c69');
const cut = rgb('bcb19c');
const stock = rgb('9d604b');
const chimneyStone = rgb('807a6d');
const slateBlue = rgb('6d7478');
const wood = rgb('615b50');
const dark = rgb('404446');
const rockTints = [rgb('6a675b'), rgb('797566'), rgb('777261'), rgb('645e55')];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const faces = (ring) => ring.map((p, i) => wallFace(p, ring[(i + 1) % ring.length]));

// Each window separates two stone faces. The reveal connects them so light passes
// through the opening while the wall still reads as solid masonry at foot level.
function masonry(out, f, width, y, h, depth, openings, detail) {
  function strip(a, b, ay, by, aY, bY) {
    if (b - a < 0.00001) return;
    if (aY - ay < 0.00001 && bY - by < 0.00001) return;
    if (aY - ay < 0.00001) {
      tri(out, 'rubble', f.P(a, ay), f.P(b, by), f.P(b, bY), killas);
      tri(out, 'rubble', f.P(b, by, -depth), f.P(a, ay, -depth), f.P(b, bY, -depth), inside);
      return;
    }
    if (bY - by < 0.00001) {
      tri(out, 'rubble', f.P(a, ay), f.P(b, by), f.P(a, aY), killas);
      tri(out, 'rubble', f.P(b, by, -depth), f.P(a, ay, -depth), f.P(a, aY, -depth), inside);
      return;
    }
    quad4(out, 'rubble', f.P(a, ay), f.P(b, by), f.P(b, bY), f.P(a, aY), killas);
    quad4(
      out,
      'rubble',
      f.P(b, by, -depth),
      f.P(a, ay, -depth),
      f.P(a, aY, -depth),
      f.P(b, bY, -depth),
      inside,
    );
  }
  const reveal = (a, b, A, B, slot, color) =>
    quad4(out, slot, f.P(a, A), f.P(b, B), f.P(b, B, -depth), f.P(a, A, -depth), color);
  let bottom = y;
  for (const { u, span, sill, head, arch, door } of openings) {
    const left = u - span / 2;
    const right = u + span / 2;
    const s = y + sill;
    const top = y + head;
    const peak = top + arch;
    strip(0, width, bottom, bottom, s, s);
    strip(0, left, s, s, peak, peak);
    strip(right, width, s, s, peak, peak);
    reveal(left, right, s, s, 'granite', cut);
    quad4(
      out,
      'granite',
      f.P(left, s),
      f.P(left, s, -depth),
      f.P(left, top, -depth),
      f.P(left, top),
      cut,
    );
    quad4(
      out,
      'granite',
      f.P(right, s, -depth),
      f.P(right, s),
      f.P(right, top),
      f.P(right, top, -depth),
      cut,
    );
    if (arch) {
      const count = [2, 3, 5, 8][detail];
      const rise = (p) => top + arch * Math.sqrt(Math.max(0, 1 - p * p));
      for (let i = 0; i < count; i++) {
        const a = -1 + (i * 2) / count;
        const b = -1 + ((i + 1) * 2) / count;
        const A = u + (a * span) / 2;
        const B = u + (b * span) / 2;
        strip(A, B, rise(a), rise(b), peak, peak);
        reveal(B, A, rise(b), rise(a), 'granite', cut);
      }
    } else reveal(right, left, top, top, 'granite', cut);
    if (detail > 0 && !door)
      fbox(out, 'granite', f, left - 0.14, right + 0.14, s - 0.16, s, -0.12, 0.13, cut);
    if (detail > 1) {
      for (const corner of [left - 0.15, right])
        fbox(out, 'granite', f, corner, corner + 0.15, s, top, -0.035, 0.06, cut);
      if (!arch)
        fbox(out, 'granite', f, left - 0.14, right + 0.14, top, top + 0.2, -0.045, 0.095, cut);
    }
    bottom = peak;
  }
  strip(0, width, bottom, bottom, h, h);
  reveal(0, width, h, h, 'granite', cut);
}

function rockFooting(out, f, depth, base, grade, slope, detail) {
  const breaks = detail > 1 ? [0, 0.33, 0.68, 1] : [0, 1];
  for (let j = 0; j + 1 < breaks.length; j++) {
    const u = breaks[j] * f.length;
    const v = breaks[j + 1] * f.length;
    const A = f.P(u, grade - 0.4, 0.045);
    const B = f.P(v, grade - 0.4, 0.045);
    const C = f.P(v, base, -0.37);
    const D = f.P(u, base, -0.37);
    const M = f.P((u + v) * 0.5, slope, 0.39 + 0.28 * (j % 2));
    tri(out, 'bedrock', D, C, M, rockTints[j]);
    tri(out, 'bedrock', C, B, M, rockTints[j + 1]);
    tri(out, 'bedrock', B, A, M, rockTints[j]);
    tri(out, 'bedrock', A, D, M, rockTints[j + 1]);
  }
  fbox(out, 'rubble', f, 0, f.length, grade - 0.42, grade, -depth, -0.008, inside);
}

function ruin(out, caps, part, detail) {
  const { outline, grade, base, height, front, kind } = part;
  const ring = outwardRing(outline);
  const walls = faces(ring);
  const edge = walls.reduce(
    (best, f, i) => (dot(f.normal, front) > dot(walls[best].normal, front) ? i : best),
    0,
  );
  const body = kind === 'engine';
  const heightLimit = grade + height;
  const depth = body ? Math.min(1.26, height * 0.11) : Math.min(0.78, height * 0.22);
  // A grade-matched masonry skirt seats the shell in rock without filling its interior.
  for (let i = 0; i < walls.length; i++) {
    const f = walls[i];
    const L = f.length;
    const nose = i === edge;
    const rear = dot(f.normal, front) < -0.82;
    if (L < 0.05) continue;
    const tall = heightLimit - (body && rear ? height * 0.07 : 0);
    const h = tall - grade;
    const openings = [];
    if ((body || detail > 0) && L > (body ? 2.8 : 4.2) && h > 3) {
      openings.push({
        u: L * (nose ? 0.53 : 0.47),
        span: Math.min(1.65, L * 0.31),
        sill: 0.06,
        head: Math.min(2.12, h * 0.31),
        arch: nose && detail > 0 ? Math.min(0.53, h * 0.075) : 0,
        door: true,
      });
    }
    if (body && (nose || detail > 0) && h > 5.1 && L > 2.4) {
      openings.push({
        u: L * (nose ? 0.53 : 0.47),
        span: Math.min(1.19, L * 0.24),
        sill: h * 0.47,
        head: h * 0.64,
        arch: nose && detail > 0 ? 0.21 : 0,
      });
      if (nose && detail > 0 && h > 8.0)
        openings.push({ u: L * 0.53, span: L * 0.22, sill: h * 0.77, head: h * 0.92, arch: 0 });
    }
    if (part.ledge) rockFooting(out, f, depth, base, grade, part.ledge, detail);
    else fbox(out, 'rubble', f, 0, L, base, grade, -depth, -0.008, inside);
    masonry(out, f, L, grade, tall, depth, openings, detail);
    if (body && (nose || rear) && L > 2.8 && !(nose && part.flatFront)) {
      const apex = tall + height * (nose ? 0.142 : 0.183);
      const P = (u, y, d = 0) => f.P(u, y, d);
      tri(out, 'rubble', P(0, tall), P(L, tall), P(L * 0.51, apex), killas);
      tri(out, 'rubble', P(L, tall, -depth), P(0, tall, -depth), P(L * 0.51, apex, -depth), inside);
      quad4(
        out,
        'granite',
        P(0, tall),
        P(L * 0.51, apex),
        P(L * 0.51, apex, -depth),
        P(0, tall, -depth),
        cut,
      );
      quad4(
        out,
        'granite',
        P(L * 0.51, apex),
        P(L, tall),
        P(L, tall, -depth),
        P(L * 0.51, apex, -depth),
        cut,
      );
    }
    if (detail > 1 && body && L > 2.4) {
      const count = Math.floor(h / 0.58);
      for (let j = 0; j < count; j++) {
        const start = grade + 0.1 + j * 0.56;
        const length = j % 2 ? 0.29 : 0.4;
        fbox(out, 'granite', f, 0, length, start, start + 0.48, -0.04, 0.048, cut);
      }
    }
  }
  if (part.floor) extrude(caps, 'rubble', ring, grade - 0.16, grade - 0.045, inside);
}

function windingShed(out, caps, part, detail) {
  const { outline, grade, base, height, along, center, length, width } = part;
  const y = grade + height;
  extrude(caps, 'rubble', outline, base, y, killas);
  const end = (distance) => center.map((v, i) => v + along[i] * distance);
  gableRoof(out, 'slate', end(-length / 2), end(length / 2), width, y, y + part.rise, slateBlue, {
    endSlot: 'rubble',
    endColor: killas,
    overhang: 0.17,
  });
  if (detail === 0) return;
  for (const f of faces(outwardRing(outline))) {
    const count = Math.floor(f.length / 3.8);
    for (let i = 0; i < count; i++) {
      const x = (f.length * (i + 1)) / (count + 1);
      const yr = grade + (i % 3 === 0 ? 0.08 : height * 0.36);
      const head = Math.min(y - 0.3, yr + (i % 3 === 0 ? 2.12 : 1.11));
      const d = i % 3 === 0 ? 0.57 : 0.49;
      fbox(out, 'granite', f, x - d - 0.12, x + d + 0.12, yr - 0.12, head + 0.16, 0, 0.075, cut);
      fbox(out, 'timber', f, x - d, x + d, yr, head, 0.071, 0.087, i % 3 === 0 ? wood : dark);
      if (detail > 1 && i % 3 !== 0)
        fbox(out, 'timber', f, x - 0.028, x + 0.028, yr, head, 0.082, 0.13, wood);
    }
  }
}

function chimney(out, p, detail) {
  const n = [7, 10, 13, 18][detail];
  const { center, base, grade, radius: r, height: H, brickFraction } = p;
  const spring = grade + H * (1 - brickFraction);
  const y = grade + H;
  const R = r * 0.58;
  const transition = R + (r - R) * brickFraction;
  const layer = (h, a) => [h, a, a];
  if (detail === 0) {
    lathe(
      out,
      'rubble',
      center,
      [layer(base, r * 1.08), layer(spring, transition)],
      n,
      chimneyStone,
      { capTop: false },
    );
    lathe(out, 'brick', center, [layer(spring, transition), layer(y, R + 0.12)], n, stock);
    return;
  }
  lathe(
    out,
    'rubble',
    center,
    [layer(base, r * 1.08), layer(grade + 0.5, r), layer(spring, transition)],
    n,
    chimneyStone,
    { capTop: false },
  );
  lathe(
    out,
    'brick',
    center,
    [
      layer(spring, transition),
      layer(y - 0.48, R),
      layer(y - 0.28, R + 0.12),
      layer(y, R + 0.12),
      layer(y, R * 0.72),
      layer(y - 0.55, R * 0.72),
      layer(y - 0.87, 0.006),
    ],
    n,
    stock,
    { capTop: true },
  );
  if (detail < 2) return;
  const f = facade(center, [1, 0]);
  fbox(
    out,
    'granite',
    f,
    -r * 0.74,
    r * 0.74,
    base,
    Math.min(grade + 1.4, spring),
    -r * 0.74,
    r * 0.74,
    chimneyStone,
  );
}

function build(out, site, detail) {
  const caps = withFootprintCaps(out);
  for (const part of site.mines) {
    if (part.kind === 'roofed') windingShed(out, caps, part, detail);
    else ruin(out, caps, part, detail);
  }
  for (const stack of site.stacks) chimney(out, stack, detail);
}

export function cornishMiningGeometry(site) {
  const roofed = site.mines.some((p) => p.kind === 'roofed');
  const surfaces = {
    rubble: surfaceLibrary.rubble,
    granite: surfaceLibrary.granite,
    ...(site.stacks.length ? { brick: surfaceLibrary.brick } : {}),
    ...(roofed ? { slate: surfaceLibrary.slate, timber: surfaceLibrary.timber } : {}),
    ...(site.mines.some((p) => p.ledge) ? { bedrock: surfaceLibrary.bedrock } : {}),
  };
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
