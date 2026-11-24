import { withFootprintCaps } from '../../../../../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  extrude,
  facade,
  fbox,
  gableRoof,
  outwardRing,
  pointedArch,
  quad4,
  rgb,
  roundArch,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.97 },
  ashlar: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.94 },
  ledge: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.99 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.91 },
  door: { slot: 'door', graph: 'wood_vertical', roughness: 0.96 },
};

const stone = rgb('c1bdb0');
const cleanStone = rgb('cfc9b7');
const coping = rgb('c9c2ad');
const lime = rgb('a6a599');
const roof = rgb('5c655f');
const oak = rgb('696155');
const mix = (a, b, t) => a + (b - a) * t;
const at = ([x, z], y) => [x, y, z];

function ground([x, z]) {
  const { origin, size, side, heights } = site.gradeGrid;
  const scale = (side - 1) / size;
  const u = (x - origin[0]) * scale;
  const v = (z - origin[1]) * scale;
  const col = Math.floor(u);
  const row = Math.floor(v);
  const p = row * side + col;
  return mix(
    mix(heights[p], heights[p + 1], u - col),
    mix(heights[p + side], heights[p + side + 1], u - col),
    v - row,
  );
}

function curtain(out, caps, part, detail) {
  const ring = outwardRing(
    detail === 0 ? part.skyline : detail === 1 ? part.district : part.outline,
  );
  const peak = (p) => {
    const uneven =
      part.erosion * (Math.sin(p[0] * 0.116 + p[1] * 0.075) * 0.7 + Math.sin(p[1] * 0.46) * 0.3);
    return ground(p) + part.height + uneven;
  };
  if (!caps.addCap('stone', '', ring, [], peak, [0, 1, 0], (p) => p, coping))
    throw new Error(`Could not triangulate curtain ${part.feature}`);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const lo = ground(a) - part.embed;
    const hi = ground(b) - part.embed;
    quad4(out, 'stone', at(a, lo), at(b, hi), at(b, peak(b)), at(a, peak(a)), stone);
    if (detail < 2 || !part.merlons) continue;
    const f = wallFace(a, b);
    const towardsCourt =
      (part.merlons[0] - a[0]) * f.normal[0] + (part.merlons[1] - a[1]) * f.normal[1];
    if (towardsCourt < 0 || f.length < 3.1) continue;
    const count = Math.floor(f.length / 2.5);
    for (let j = 0; j < count; j++) {
      const u = ((j + 0.5) * f.length) / count;
      const crest = mix(peak(a), peak(b), u / f.length);
      fbox(
        out,
        'stone',
        f,
        u - 0.56,
        u + 0.56,
        crest - 0.16,
        crest + 0.66,
        -0.52,
        0.04,
        cleanStone,
      );
    }
  }
}

function profile(halfWidth, style, detail) {
  if (style === 'flat')
    return [
      [-halfWidth, 0],
      [halfWidth, 0],
    ];
  if (style === 'pointed') return pointedArch(halfWidth, halfWidth * 1.45, detail === 3 ? 5 : 3);
  return roundArch(halfWidth, detail === 3 ? 10 : 5);
}

// Construct paired wall faces and the reveals from the same span so the opening crosses the wall.
function perforatedPanel(
  out,
  frame,
  span,
  bottom,
  crest,
  depth,
  apertures,
  detail,
  capCrest = false,
) {
  const upper = typeof crest === 'number' ? () => crest : crest;
  function face(u0, u1, y0a, y0b, y1a, y1b, cap = true) {
    if (u1 - u0 <= 0.002) return;
    const p = frame.P;
    quad4(out, 'stone', p(u0, y0a, 0), p(u1, y0b, 0), p(u1, y1b, 0), p(u0, y1a, 0), stone);
    quad4(
      out,
      'stone',
      p(u1, y0b, -depth),
      p(u0, y0a, -depth),
      p(u0, y1a, -depth),
      p(u1, y1b, -depth),
      stone,
    );
    if (cap && capCrest)
      quad4(
        out,
        'stone',
        p(u0, y1a, 0),
        p(u1, y1b, 0),
        p(u1, y1b, -depth),
        p(u0, y1a, -depth),
        coping,
      );
  }
  let lo = 0;
  for (const { center, width, sill, spring, arch } of apertures) {
    const half = width / 2;
    const left = center - half;
    const right = center + half;
    const p = frame.P;
    face(lo, left, bottom, bottom, upper(lo), upper(left));
    if (sill > bottom + 0.01) face(left, right, bottom, bottom, sill, sill, false);
    const arc = profile(half, arch, detail);
    for (let i = 1; i < arc.length; i++) {
      const a = center + arc[i - 1][0];
      const b = center + arc[i][0];
      const h = spring + arc[i - 1][1];
      const k = spring + arc[i][1];
      face(a, b, h, k, upper(a), upper(b));
      quad4(out, 'ashlar', p(b, k, 0), p(a, h, 0), p(a, h, -depth), p(b, k, -depth), coping);
    }
    quad4(
      out,
      'ashlar',
      p(left, sill, 0),
      p(left, sill, -depth),
      p(left, spring, -depth),
      p(left, spring, 0),
      cleanStone,
    );
    quad4(
      out,
      'ashlar',
      p(right, sill, -depth),
      p(right, sill, 0),
      p(right, spring, 0),
      p(right, spring, -depth),
      cleanStone,
    );
    if (sill > bottom + 0.01)
      quad4(
        out,
        'ashlar',
        p(left, sill, 0),
        p(right, sill, 0),
        p(right, sill, -depth),
        p(left, sill, -depth),
        cleanStone,
      );
    lo = right;
  }
  face(lo, span, bottom, bottom, upper(lo), upper(span));
}

function ruinShell(out, part, detail) {
  const outline = outwardRing(detail < 2 ? part.skyline : part.outline);
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    const frame = wallFace(a, b);
    if (frame.length < 0.12) continue;
    const rise = (p) => part.height + ground(p) * part.gradeFollow + part.datum;
    const crest0 = rise(a) + part.erosion * Math.sin(a[0] * 0.21 + a[1] * 0.19);
    const crest1 = rise(b) + part.erosion * Math.sin(b[0] * 0.21 + b[1] * 0.19);
    const localGround = Math.max(ground(a), ground(b), part.platform ?? -999);
    const bottom = Math.min(ground(a), ground(b), localGround) - part.embed;
    const top = (u) => {
      const crest = mix(crest0, crest1, u / frame.length);
      if (!part.principal || detail < 2) return crest;
      const edge = (u / frame.length) * (1 - u / frame.length) * 4;
      return crest - edge * part.erosion * Math.sin(u * 0.66 + a[0] * 0.27) ** 2;
    };
    const depth = part.depth;
    const p = frame.P;
    if (detail === 0) {
      quad4(
        out,
        'stone',
        p(0, bottom, 0),
        p(frame.length, bottom, 0),
        p(frame.length, crest1, 0),
        p(0, crest0, 0),
        stone,
      );
      continue;
    }
    const apertures = [];
    if (
      (detail > 1 || part.principal) &&
      frame.length > (detail === 1 ? 20 : 4.0) &&
      Math.min(crest0, crest1) - localGround > 3.3
    ) {
      const available = Math.min(crest0, crest1) - localGround;
      const count = Math.max(
        1,
        Math.min(detail === 1 ? 1 : 6, Math.round(frame.length / part.windowSpacing)),
      );
      const width = Math.min(part.windowWidth, (frame.length / count) * 0.4);
      const sill = localGround + available * 0.53;
      const spring = sill + Math.min(part.windowHeight, available * 0.25);
      const erosionAllowance = part.principal && detail > 1 ? part.erosion * 0.72 : 0;
      if (spring + width * 0.6 < Math.min(crest0, crest1) - erosionAllowance - 0.22)
        for (let j = 0; j < count; j++)
          apertures.push({
            center: (frame.length * (j + 0.5)) / count,
            width,
            sill,
            spring,
            arch: part.arch,
          });
    }
    perforatedPanel(out, frame, frame.length, bottom, top, depth, apertures, detail, detail > 1);
    if (detail < 2) {
      quad4(
        out,
        'stone',
        p(0, crest0, 0),
        p(frame.length, crest1, 0),
        p(frame.length, crest1, -depth),
        p(0, crest0, -depth),
        coping,
      );
      continue;
    }
    // Short returns meet the next face and seal the exposed thickness at a broken corner.
    quad4(
      out,
      'stone',
      p(0, bottom, -depth),
      p(0, bottom, 0),
      p(0, crest0, 0),
      p(0, crest0, -depth),
      stone,
    );
    quad4(
      out,
      'stone',
      p(frame.length, bottom, 0),
      p(frame.length, bottom, -depth),
      p(frame.length, crest1, -depth),
      p(frame.length, crest1, 0),
      stone,
    );
  }
}

function gate(out, arch, detail) {
  const f = facade(arch.front, arch.along);
  const half = arch.width / 2;
  const depth = arch.depth;
  const top = arch.threshold + arch.height;
  const bottom = arch.threshold - 1.1;
  const p = f.P;
  const opening = {
    center: half,
    sill: bottom,
    width: arch.clear,
    spring: arch.threshold + arch.spring,
    arch: 'round',
  };
  perforatedPanel(out, f, arch.width, bottom, top, depth, [opening], detail);
  quad4(
    out,
    'stone',
    p(0, top, 0),
    p(arch.width, top, 0),
    p(arch.width, top, -depth),
    p(0, top, -depth),
    coping,
  );
  quad4(
    out,
    'stone',
    p(0, bottom, -depth),
    p(0, bottom, 0),
    p(0, top, 0),
    p(0, top, -depth),
    stone,
  );
  quad4(
    out,
    'stone',
    p(arch.width, bottom, 0),
    p(arch.width, bottom, -depth),
    p(arch.width, top, -depth),
    p(arch.width, top, 0),
    stone,
  );
  if (detail < 2) return;
  const inner = roundArch(arch.clear / 2, detail === 3 ? 12 : 7);
  const outer = roundArch(arch.clear / 2 + 0.26, detail === 3 ? 12 : 7);
  for (let i = 1; i < inner.length; i++) {
    quad4(
      out,
      'ashlar',
      p(half + inner[i - 1][0], opening.spring + inner[i - 1][1], 0.035),
      p(half + inner[i][0], opening.spring + inner[i][1], 0.035),
      p(half + outer[i][0], opening.spring + outer[i][1], 0.046),
      p(half + outer[i - 1][0], opening.spring + outer[i - 1][1], 0.046),
      cleanStone,
    );
  }
}

function keep(out, part, detail) {
  const ring = outwardRing(detail === 0 ? part.skyline : part.outline);
  const levels = [
    [part.base, 1.03],
    [part.base + 1.2, 1.008],
    [part.top - 0.85, 0.975],
    [part.top, 0.962],
  ];
  const center = part.center;
  const shells = levels.map(([y, s]) => outlineAt(ring, center, s).map((p) => at(p, y)));
  for (let j = 1; j < shells.length; j++) {
    const lower = shells[j - 1];
    const upper = shells[j];
    for (let i = 0; i < ring.length; i++) {
      const k = (i + 1) % ring.length;
      quad4(out, 'stone', lower[i], lower[k], upper[k], upper[i], stone);
    }
  }
  const caps = withFootprintCaps(out);
  const outer = outlineAt(ring, center, 0.962);
  const inner = outlineAt(ring, center, 0.85);
  // Cap the masonry rim while leaving the lookout deck recessed inside the parapet.
  caps.addCap(
    'stone',
    '',
    outer,
    [inner],
    () => part.top,
    [0, 1, 0],
    (p) => p,
    coping,
  );
  if (detail < 1) return;
  extrude(caps, 'ashlar', inner, part.top - 1.45, part.top, coping, {
    holes: [outlineAt(ring, center, 0.79)],
  });
  caps.addCap(
    'ashlar',
    '',
    inner,
    [],
    () => part.top - 1.45,
    [0, 1, 0],
    (p) => p,
    cleanStone,
  );
  for (const [angle, h] of [
    [0.92, 0.58],
    [2.54, 0.76],
    [4.78, 0.44],
  ]) {
    const radial = [Math.cos(angle), Math.sin(angle)];
    const origin = center.map((p, i) => p + radial[i] * part.radius[i] * 0.994);
    const f = facade(origin, [-radial[1], radial[0]]);
    const base = mix(part.base, part.top, h);
    fbox(out, 'door', f, -0.25, 0.25, base, base + 1.26, -0.05, 0.12, oak);
    fbox(out, 'ashlar', f, -0.51, 0.51, base - 0.23, base - 0.05, -0.12, 0.22, cleanStone);
  }
}

function outlineAt(ring, center, scale) {
  return ring.map((v) => v.map((p, i) => mix(center[i], p, scale)));
}

function roofed(out, caps, part, detail) {
  extrude(caps, 'stone', part.outline, part.base, part.eave, stone);
  gableRoof(out, 'slate', part.ridge[0], part.ridge[1], part.width, part.eave, part.crown, roof, {
    overhang: 0.19,
    endSlot: 'stone',
    endColor: cleanStone,
  });
  if (detail < 1) return;
  const f = wallFace(part.front[0], part.front[1]);
  for (let i = 0; i < part.bays; i++) {
    const u = f.length * ((i + 0.5) / part.bays);
    const h = part.base + (part.eave - part.base) * 0.39;
    const a = profile(0.42, part.arch, detail).map(([x, y]) => f.P(u + x, h + 1.25 + y, 0.085));
    const l = f.P(u - 0.42, h, 0.085);
    const r = f.P(u + 0.42, h, 0.085);
    quad4(out, 'door', l, r, a.at(-1), a[0], oak);
    for (let j = 2; j < a.length; j++) tri(out, 'door', a[0], a[j], a[j - 1], oak);
    fbox(out, 'ashlar', f, u - 0.62, u + 0.62, h - 0.15, h - 0.03, -0.14, 0.26, cleanStone);
  }
}

function rockFaces(out, detail) {
  for (const ridge of site.cliffs) {
    const pairs = detail === 0 ? ridge.skyline : ridge.stations;
    for (let i = 1; i < pairs.length; i++) {
      const [a, b, c] = pairs[i - 1];
      const [d, e, f] = pairs[i];
      tri(out, 'ledge', a, d, e, lime);
      tri(out, 'ledge', a, e, b, lime);
      tri(out, 'ledge', b, e, f, lime);
      tri(out, 'ledge', b, f, c, lime);
    }
  }
}

function build(out, detail) {
  const caps = withFootprintCaps(out);
  rockFaces(out, detail);
  for (const part of site.curtains) if (part.minDetail <= detail) curtain(out, caps, part, detail);
  for (const part of site.shells) if (part.minDetail <= detail) ruinShell(out, part, detail);
  for (const part of site.gates) if (part.minDetail <= detail) gate(out, part, detail);
  for (const part of site.roofs) roofed(out, caps, part, detail);
  keep(out, site.keep, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
