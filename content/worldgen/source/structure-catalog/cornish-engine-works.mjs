import { beam, beamPath } from '../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { withFootprintCaps } from '../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  extrude,
  facade,
  fbox,
  gableRoof,
  opening,
  outwardRing,
  rgb,
  wallFace,
} from '../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cornishMiningGeometry } from './cornish-mine-geometry.mjs';

const granite = rgb('ada28e');
const slate = rgb('657073');
const weatheredRed = rgb('a06359');
const wornGreen = rgb('52645b');
const cream = rgb('d6d0bd');
const iron = rgb('5c605b');
const timber = rgb('665d4d');
const dark = rgb('484b46');
const local = ([x, , z]) => [x, z];

function wheel(out, frame, x, y, d, radius, detail, tint) {
  const count = [8, 12, 16, 24][detail];
  const arc = (a, r, depth) => frame.P(x + Math.cos(a) * r, y + Math.sin(a) * r, depth);
  const ring = Array.from({ length: count }, (_, i) => arc((i * Math.PI * 2) / count, radius, d));
  beamPath(out, 'iron', ring, Math.min(radius * 0.145, 0.23), 0.18, tint, true);
  const spokes = detail === 0 ? 4 : 8;
  for (let i = 0; i < spokes; i++) {
    const a = (i * Math.PI * 2) / spokes;
    beam(out, 'iron', arc(a, radius * 0.19, d), arc(a, radius * 0.97, d), 0.09, 0.12, tint);
  }
  fbox(out, 'iron', frame, x - 0.21, x + 0.21, y - 0.18, y + 0.18, d - 0.34, d + 0.34, dark, {
    bottom: true,
  });
}

function windingBalcony(out, caps, part, face, detail) {
  const { grade, gallery } = part;
  const center = face.length * 0.5;
  const floor = grade + gallery;
  const W = face.length * 0.44;
  const D = 1.65;
  const wheelY = grade + 2.03;
  fbox(out, 'paintedWood', face, center - W, center + W, floor - 0.24, floor, 0, D, timber, {
    bottom: true,
  });
  for (const side of [-1, 1]) {
    const x = center + side * (W - 0.1);
    beam(
      out,
      'iron',
      face.P(x, grade + 0.26, D - 0.12),
      face.P(x, floor, D - 0.12),
      0.16,
      0.18,
      iron,
    );
    beam(
      out,
      'paintedWood',
      face.P(x, floor + 0.91, 0),
      face.P(x, floor + 0.91, D),
      0.12,
      0.12,
      weatheredRed,
    );
  }
  beam(
    out,
    'paintedWood',
    face.P(center - W, floor + 0.91, D),
    face.P(center + W, floor + 0.91, D),
    0.13,
    0.14,
    weatheredRed,
  );
  const bays = detail < 2 ? 3 : 5;
  for (let bay = 0; bay < bays; bay++) {
    const a = center - W + (2 * W * bay) / bays;
    const b = center - W + (2 * W * (bay + 1)) / bays;
    beam(
      out,
      'paintedWood',
      face.P(a, floor, D),
      face.P(b, floor + 0.86, D),
      0.08,
      0.08,
      weatheredRed,
    );
    if (detail > 0)
      beam(
        out,
        'paintedWood',
        face.P(b, floor, D),
        face.P(a, floor + 0.86, D),
        0.08,
        0.08,
        weatheredRed,
      );
  }
  const pad = [
    local(face.P(center - 2.35, 0, 0.28)),
    local(face.P(center + 2.35, 0, 0.28)),
    local(face.P(center + 2.35, 0, 3.14)),
    local(face.P(center - 2.35, 0, 3.14)),
  ];
  extrude(caps, 'rubble', pad, grade - 0.42, grade + 0.38, granite);
  wheel(out, face, center, wheelY, 2.52, 1.66, detail, wornGreen);
  if (detail > 0) wheel(out, face, center, wheelY, 1.43, 1.66, detail, wornGreen);
}

function engineHouse(out, caps, p, detail) {
  const eave = p.grade + p.height;
  extrude(caps, 'rubble', p.outline, p.base, eave, granite);
  const ends = [-1, 1].map((side) =>
    p.center.map((x, i) => x + p.along[i] * side * p.length * 0.5),
  );
  gableRoof(out, 'slate', ...ends, p.width, eave, eave + p.rise, slate, {
    endSlot: p.gallery || p.redGable ? 'paintedWood' : 'rubble',
    endColor: p.gallery || p.redGable ? weatheredRed : granite,
    overhang: 0.19,
  });

  const ring = outwardRing(p.outline);
  const walls = ring.map((point, i) => wallFace(point, ring[(i + 1) % ring.length]));
  const aim = (f) =>
    (f.normal[0] * p.front[0] + f.normal[1] * p.front[1]) * Math.min(1, f.length / 4);
  const face = walls.reduce((best, wall) => (aim(best) >= aim(wall) ? best : wall));
  if (p.gallery) windingBalcony(out, caps, p, face, detail);
  if (detail === 0) return;
  for (const wall of walls.filter((w) => w.length > 3)) {
    const doorway = wall === face;
    const count = wall.length > 10.5 && !doorway ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const pos = (wall.length * (i + 1)) / (count + 1);
      for (const level of [0, 1, 2]) {
        const door = doorway && level === 0;
        const floor = p.grade + (door ? 0.045 : (0.19 + level * 0.279) * p.height);
        const windowHeight = door ? 2.35 : 1.28;
        opening(out, wall, pos, floor, door ? 1.38 : 0.91, windowHeight, {
          glassSlot: door ? 'paintedWood' : 'iron',
          frameSlot: 'rubble',
          glass: door ? timber : dark,
          frame: cream,
          frameWidth: detail > 1 ? 0.15 : 0,
          frameDepth: 0.115,
          sill: !door,
          mullions: detail > 1 && !door ? 1 : 0,
          transoms: detail > 1 && !door ? 1 : 0,
          head: door ? 'round' : 'flat',
        });
      }
    }
    if (detail > 1) {
      const bands = Math.floor(p.height / 0.64);
      for (let i = 0; i < bands; i++) {
        const at = p.grade + i * 0.63;
        fbox(out, 'rubble', wall, 0, i % 2 ? 0.27 : 0.42, at, at + 0.51, -0.035, 0.065, cream);
      }
    }
  }
}

function headframe(out, caps, head, detail) {
  const { grade: y, height: h, width, depth, dismantled } = head;
  const f = facade(head.center, head.along);
  const tint = head.green ? wornGreen : iron;
  const A = width * 0.5;
  const B = depth * 0.5;
  const top = y + h;
  for (const side of [-1, 1]) {
    const x = side * A;
    const crown = side * A * 0.68;
    for (const end of [-1, 1]) {
      const foot = head.asymmetric && end > 0 ? B * 0.185 : end * B;
      beam(out, 'iron', f.P(x, y + 0.21, foot), f.P(crown, top, end * 0.46), 0.27, 0.3, tint);
      const plinth = [
        local(f.P(x - 0.39, 0, foot - 0.48)),
        local(f.P(x + 0.39, 0, foot - 0.48)),
        local(f.P(x + 0.39, 0, foot + 0.48)),
        local(f.P(x - 0.39, 0, foot + 0.48)),
      ];
      extrude(caps, 'rubble', plinth, y - 0.85, y + 0.29, granite);
    }
    beam(out, 'iron', f.P(x, y + 0.3, -B), f.P(crown, top - 0.24, 0.46), 0.19, 0.24, tint);
    if (detail > 0)
      beam(out, 'iron', f.P(x, y + 0.3, B), f.P(crown, top - 0.24, -0.46), 0.17, 0.2, tint);
  }
  fbox(out, 'iron', f, -A * 0.72, A * 0.72, top - 0.44, top - 0.08, -0.75, 0.75, tint);
  if (!dismantled) {
    wheel(out, f, 0, top + 0.4, 0.52, head.sheave, detail, tint);
    wheel(out, f, 0, top + 0.4, -0.52, head.sheave, detail, tint);
  }
  if (detail > 0)
    for (const end of [-1, 1]) {
      const depth = head.asymmetric && end > 0 ? 0.82 : end * B * 0.61;
      beam(
        out,
        'iron',
        f.P(-A * 0.84, y + h * 0.51, depth),
        f.P(A * 0.84, y + h * 0.51, depth),
        0.18,
        0.18,
        tint,
      );
      beam(
        out,
        'iron',
        f.P(-A * 0.85, y + h * 0.42, depth),
        f.P(A * 0.71, top - 0.35, end * 0.51),
        0.12,
        0.16,
        tint,
      );
    }
}

export function cornishEngineWorks(site) {
  const base = cornishMiningGeometry({
    ...site,
    mines: site.mines.filter((p) => p.kind !== 'works'),
  });
  const works = site.mines.filter((p) => p.kind === 'works');
  const surfaces = {
    ...base.surfaces,
    slate: { slot: 'roof', graph: 'slate', roughness: 0.93 },
    paintedWood: { slot: 'trim', graph: 'wood_painted_lap', roughness: 0.91 },
    iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.88 },
  };
  const build = (baseLevel, detail) => (out) => {
    baseLevel(out);
    const caps = withFootprintCaps(out);
    for (const house of works) engineHouse(out, caps, house, detail);
    for (const head of site.headframes) headframe(out, caps, head, detail);
  };
  const buildSkyline = build(base.buildSkyline, 0);
  const buildDistrict = build(base.buildDistrict, 1);
  const buildStreet = build(base.buildStreet, 2);
  const buildCloseup = build(base.buildCloseup, 3);
  return {
    surfaces,
    buildSkyline,
    buildDistrict,
    buildStreet,
    buildCloseup,
    buildMaster: buildCloseup,
  };
}
