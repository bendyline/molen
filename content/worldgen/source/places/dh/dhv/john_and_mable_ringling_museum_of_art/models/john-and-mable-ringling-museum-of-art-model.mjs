import { readFileSync } from 'node:fs';
import {
  abox,
  fbox,
  gableRoof,
  lathe,
  opening,
  quad4,
  rgb,
  roundArch,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const survey = read('native-map/john-and-mable-ringling-museum-of-art-shape-controls');
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94 },
  limestone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.95 },
  clay: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.86 },
  flatRoof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.91 },
  jade: { slot: 'wall', localRef: 'palette:#fefefe', roughness: 0.42 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.52 },
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.76 },
  grass: { slot: 'wall', localRef: 'palette:#fdfdfd', roughness: 1 },
};
const plaster = rgb('dda79d');
const shadedPlaster = rgb('c99488');
const chalk = rgb('e1d7c2');
const stone = rgb('c1b8a5');
const paving = rgb('c5bdac');
const buttress = rgb('b2967c');
const glass = rgb('4c5855');
const red = rgb('ac6847');
const roof = rgb('c8c9c2');
const leaf = rgb('778759');
const darkLeaf = rgb('6b794c');
const jade = rgb('345851');
const brightJade = rgb('40655c');
const darkJade = rgb('2f4942');
const bronze = rgb('5d6351');
const [[courtWest], [courtEast]] = survey.centralCourtBounds;
const north = -14.32;
const south = 31.45;
const spring = 3.63;
const cornice = survey.heightEstimatesMetres.arcadeCornice;
const courtyardPlatform = 0.36;

function box(out, slot, x0, x1, z0, z1, y0, y1, color, bottom = false) {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color, { bottom });
}

function arcadeBand(out, f, y0, y1, depth, color, slot = 'limestone') {
  fbox(out, slot, f, 0, f.length, y0, y1, -0.28, depth, color, { bottom: true });
}

function column(out, f, u, level) {
  const point = f.P(u, 0, -0.08);
  const foot = courtyardPlatform;
  if (level < 2) {
    quad4(
      out,
      'limestone',
      f.P(u - 0.2, foot, 0.12),
      f.P(u + 0.2, foot, 0.12),
      f.P(u + 0.2, spring, 0.12),
      f.P(u - 0.2, spring, 0.12),
      chalk,
    );
    if (level === 1)
      quad4(
        out,
        'limestone',
        f.P(u + 0.2, foot, -0.24),
        f.P(u - 0.2, foot, -0.24),
        f.P(u - 0.2, spring, -0.24),
        f.P(u + 0.2, spring, -0.24),
        chalk,
      );
    return;
  }
  lathe(
    out,
    'limestone',
    [point[0], point[2]],
    [
      [foot + 0.16, 0.19, 0.19],
      [spring - 0.28, 0.158, 0.158],
      [spring - 0.12, 0.21, 0.21],
    ],
    level === 2 ? 6 : 10,
    chalk,
    { capTop: false },
  );
  fbox(out, 'limestone', f, u - 0.28, u + 0.28, foot, foot + 0.19, -0.37, 0.21, stone);
  fbox(out, 'limestone', f, u - 0.27, u + 0.27, spring - 0.14, spring + 0.07, -0.36, 0.2, chalk);
}

function figure(out, x, z, y, size, slot, color, level) {
  box(
    out,
    'limestone',
    x - size * 0.31,
    x + size * 0.31,
    z - size * 0.27,
    z + size * 0.27,
    y,
    y + size * 0.17,
    stone,
  );
  const base = y + size * 0.17;
  const at = (k) => base + k * size;
  const side = level === 3 ? 6 : 4;
  lathe(
    out,
    slot,
    [x, z],
    [
      [at(0), size * 0.135, size * 0.105],
      [at(0.42), size * 0.175, size * 0.122],
      [at(0.62), size * 0.206, size * 0.128],
      [at(0.69), size * 0.074, size * 0.077],
      [at(0.72), size * 0.112, size * 0.097],
      [at(0.86), size * 0.087, size * 0.092],
      [at(0.89), 0, 0],
    ],
    side,
    color,
    { capTop: false },
  );
}

function balustrade(out, f, base, level, height = 0.9, statuary = false) {
  arcadeBand(out, f, base, base + 0.12, 0.21, stone);
  arcadeBand(out, f, base + height - 0.12, base + height, 0.23, chalk);
  if (level === 0) return;
  const spacing = level === 1 ? 4.25 : level === 2 ? 1.4 : 0.58;
  const count = Math.max(2, Math.ceil(f.length / spacing));
  for (let i = 1; i < count; i++) {
    const at = (i * f.length) / count;
    const w = level >= 2 ? 0.075 : 0.19;
    if (level === 3) {
      const [x, , z] = f.P(at, 0, 0.02);
      lathe(
        out,
        'limestone',
        [x, z],
        [
          [base + 0.1, 0.1, 0.1],
          [base + height * 0.38, 0.086, 0.086],
          [base + height * 0.67, 0.048, 0.048],
          [base + height - 0.08, 0.084, 0.084],
        ],
        4,
        chalk,
        { capTop: false },
      );
    } else
      fbox(
        out,
        'limestone',
        f,
        at - w,
        at + w,
        base + 0.07,
        base + height - 0.07,
        -0.11,
        0.12,
        stone,
      );
  }
  if (statuary && level >= 2) {
    const count = Math.ceil(f.length / 6.2);
    for (let i = 0; i < count; i++) {
      const [x, , z] = f.P(((i + 0.5) * f.length) / count, 0, 0.02);
      figure(out, x, z, base + height, 1.45, 'limestone', chalk, level);
    }
  }
}

function colonnade(out, f, bays, level) {
  const pitch = f.length / bays;
  const h = (pitch - 0.32) / 2;
  const arc = roundArch(h, [2, 5, 8, 13][level]);
  const height = 1.64;
  for (let bay = 0; bay < bays; bay++) {
    const u = (bay + 0.5) * pitch;
    for (let k = 1; k < arc.length; k++) {
      const [[a, ay], [b, by]] = [arc[k - 1], arc[k]];
      const ya = spring + (ay * height) / h;
      const yb = spring + (by * height) / h;
      quad4(
        out,
        'plaster',
        f.P(u + a, ya),
        f.P(u + b, yb),
        f.P(u + b, cornice),
        f.P(u + a, cornice),
        plaster,
      );
      if (level >= 2)
        quad4(
          out,
          'plaster',
          f.P(u + b, yb),
          f.P(u + a, ya),
          f.P(u + a, ya, -0.43),
          f.P(u + b, yb, -0.43),
          shadedPlaster,
        );
      if (level >= 2)
        quad4(
          out,
          'limestone',
          f.P(u + a, ya, 0.018),
          f.P(u + b, yb, 0.018),
          f.P(u + b * 1.068, yb + 0.09, 0.018),
          f.P(u + a * 1.068, ya + 0.09, 0.018),
          chalk,
        );
    }
    const left = bay === 0 ? 0 : u - pitch + h;
    quad4(
      out,
      'plaster',
      f.P(left, spring),
      f.P(u - h, spring),
      f.P(u - h, cornice),
      f.P(left, cornice),
      plaster,
    );
    if (bay + 1 === bays)
      quad4(
        out,
        'plaster',
        f.P(u + h, spring),
        f.P(f.length, spring),
        f.P(f.length, cornice),
        f.P(u + h, cornice),
        plaster,
      );
    column(out, f, bay * pitch, level);
    if (level >= 2) {
      const [x, , z] = f.P(u, 0, 0.055);
      const point = f.P(u, 5.82, 0.055);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const b = ((i + 1) * Math.PI) / 4;
        const ring = (angle) =>
          f.P(u + 0.21 * Math.cos(angle), 5.82 + 0.21 * Math.sin(angle), 0.058);
        tri(out, 'limestone', [x, point[1], z], ring(a), ring(b), stone);
      }
    }
  }
  column(out, f, f.length, level);
  arcadeBand(out, f, cornice - 0.1, cornice + 0.15, 0.29, chalk);
  if (level >= 1) balustrade(out, f, cornice + 0.15, level, 0.92, true);
}

function roofEquipment(out, x0, x1, z, y, level) {
  if (level < 1) return;
  for (let i = 0; i < 11; i++) {
    const x = x0 + ((x1 - x0) * (i + 0.5)) / 11;
    const width = i % 3 === 0 ? 2.4 : 1.65;
    box(out, 'flatRoof', x - width / 2, x + width / 2, z - 1.15, z + 1.15, y, y + 0.34, roof);
    if (level >= 2)
      box(
        out,
        'dark',
        x - width / 2 + 0.12,
        x + width / 2 - 0.12,
        z - 0.83,
        z + 0.83,
        y + 0.32,
        y + 0.42,
        glass,
      );
  }
}

function galleryRanges(out, level) {
  const west = courtWest + 1.2;
  const east = courtEast + 0.05;
  const galleryLip = 6.94;
  box(out, 'plaster', west, east + 0.36, -29.18, north - 3.45, -3.0, galleryLip, plaster);
  box(out, 'plaster', west, east + 0.35, south + 3.45, 46.2, -3.0, galleryLip, plaster);
  box(
    out,
    'flatRoof',
    west - 0.18,
    east + 0.26,
    -29.46,
    north + 0.15,
    cornice - 0.38,
    cornice,
    roof,
    true,
  );
  box(
    out,
    'flatRoof',
    west - 0.18,
    east + 0.26,
    south - 0.15,
    46.45,
    cornice - 0.38,
    cornice,
    roof,
    true,
  );
  box(
    out,
    'flatRoof',
    west,
    east,
    -28.76,
    north - 3.9,
    galleryLip - 0.02,
    galleryLip + 0.055,
    roof,
  );
  box(out, 'flatRoof', west, east, south + 3.9, 45.88, galleryLip - 0.02, galleryLip + 0.055, roof);
  box(out, 'limestone', west, east, north - 3.55, north + 0.2, -2.7, courtyardPlatform, paving);
  box(out, 'limestone', west, east, south - 0.2, south + 3.55, -2.7, courtyardPlatform, paving);
  roofEquipment(out, west + 11, east - 3, -23.4, galleryLip + 0.055, level);
  roofEquipment(out, west + 11, east - 3, 40.9, galleryLip + 0.055, level);
  colonnade(out, wallFace([west, north], [east, north]), 24, level);
  colonnade(out, wallFace([east, south], [west, south]), 24, level);

  if (level >= 2) {
    const inner = [
      wallFace([west, north - 3.45], [east, north - 3.45]),
      wallFace([east, south + 3.45], [west, south + 3.45]),
    ];
    for (const f of inner) {
      for (let i = 0; i < 9; i++) {
        const u = 7 + i * 10;
        opening(out, f, u, courtyardPlatform, 1.08, 2.84, {
          head: 'flat',
          glassSlot: 'dark',
          frameSlot: 'limestone',
          glass,
          frame: chalk,
          frameWidth: 0.12,
          mullions: level >= 2 ? 1 : 0,
        });
      }
    }
  }
}

function eastRange(out, level) {
  const [a, b] = survey.eastTileRoofBounds;
  const start = north - 16.4;
  const end = south + 15.2;
  const inner = courtEast + 4.67;
  const east = 81.55;
  const eave = 9.42;
  box(out, 'plaster', inner, east, start, end, -2.9, eave, plaster);
  box(
    out,
    'limestone',
    inner - 4.8,
    inner + 0.02,
    north - 0.11,
    south + 0.11,
    -2.7,
    courtyardPlatform,
    paving,
  );
  box(
    out,
    'flatRoof',
    inner - 4.8,
    inner + 0.01,
    north - 0.15,
    south + 0.15,
    cornice - 0.38,
    cornice,
    roof,
    true,
  );
  colonnade(out, wallFace([courtEast, south], [courtEast, north]), 12, level);
  const mid = (a[0] + b[0]) / 2 + 0.7;
  gableRoof(
    out,
    'clay',
    [mid, start],
    [mid, end],
    east - inner,
    eave,
    survey.heightEstimatesMetres.originalEastRoofRidge,
    red,
    { overhang: 0.76, endSlot: 'plaster', endColor: plaster },
  );
  const eastFace = wallFace([east, end], [east, start]);
  const courtFace = wallFace([inner, start], [inner, end]);
  const center = eastFace.length / 2;
  arcadeBand(out, eastFace, 6.88, 7.12, 0.21, chalk);
  arcadeBand(out, courtFace, 7.05, 7.25, 0.2, chalk);
  if (level === 0) return;
  for (const side of [eastFace, courtFace]) {
    for (let i = 0; i < 13; i++) {
      const u = ((i + 0.5) * side.length) / 13;
      opening(out, side, u, 7.6, 1.45, 1.15, {
        glassSlot: 'dark',
        frameSlot: 'limestone',
        glass,
        frame: chalk,
        frameWidth: 0.12,
        mullions: level >= 2 ? 1 : 0,
      });
    }
  }
  for (const offset of [-4.8, 0, 4.8]) {
    const x = center + offset;
    const middle = offset === 0;
    fbox(out, 'plaster', eastFace, x - 1.91, x + 1.91, -0.12, 5.06, -0.1, 0.34, shadedPlaster);
    opening(out, eastFace, x, 0.22, middle ? 2.63 : 2.1, middle ? 4.22 : 3.65, {
      head: 'round',
      glassSlot: 'dark',
      frameSlot: 'limestone',
      glass,
      frame: chalk,
      frameWidth: 0.26,
      d: 0.365,
      mullions: 1,
    });
    if (level >= 2) {
      for (let i = 0; i < 7; i++) {
        for (const sign of [-1, 1]) {
          const u = x + sign * 1.52;
          fbox(
            out,
            'limestone',
            eastFace,
            u - 0.18,
            u + 0.18,
            0.3 + i * 0.46,
            0.69 + i * 0.46,
            0.31,
            0.5,
            buttress,
          );
        }
      }
    }
  }
  for (let i = 0; i < 4; i++)
    fbox(
      out,
      'limestone',
      eastFace,
      center - 8.15,
      center + 8.15,
      -0.52 + i * 0.146,
      -0.23 + i * 0.146,
      0.24,
      2.7 - i * 0.48,
      paving,
    );
}

function slopedPanel(out, x0, x1, z0, z1, ix0, ix1, iz0, iz1, eave, ridge) {
  const outer = [
    [x0, eave, z0],
    [x0, eave, z1],
    [x1, eave, z1],
    [x1, eave, z0],
  ];
  const inner = [
    [ix0, ridge, iz0],
    [ix0, ridge, iz1],
    [ix1, ridge, iz1],
    [ix1, ridge, iz0],
  ];
  for (let i = 0; i < 4; i++)
    quad4(out, 'flatRoof', outer[i], outer[(i + 1) % 4], inner[(i + 1) % 4], inner[i], roof);
}

function searingWing(out, level) {
  const [[x0, z0], [x1, z1]] = survey.skyspaceApertureBounds;
  const w = -90.14;
  const e = -30.58;
  const n = -62.65;
  const s = -14.27;
  const eave = 8.23;
  const high = survey.heightEstimatesMetres.attachedSearingRoofRidge;
  // The central bay stays open to the sky through both roofs.
  box(out, 'plaster', w, x0, n, s, -3.1, eave, plaster);
  box(out, 'plaster', x1, e, n, s, -3.1, eave, plaster);
  box(out, 'plaster', x0, x1, n, z0, -3.1, eave, plaster);
  box(out, 'plaster', x0, x1, z1, s, -3.1, eave, plaster);
  slopedPanel(
    out,
    w - 0.33,
    e + 0.27,
    n - 0.27,
    s + 0.26,
    x0 - 6.8,
    x1 + 6.8,
    z0 - 6.4,
    z1 + 6.4,
    eave,
    high,
  );
  box(out, 'flatRoof', x0 - 6.8, x0, z0 - 6.4, z1 + 6.4, high - 0.23, high, roof);
  box(out, 'flatRoof', x1, x1 + 6.8, z0 - 6.4, z1 + 6.4, high - 0.23, high, roof);
  box(out, 'flatRoof', x0, x1, z0 - 6.4, z0, high - 0.23, high, roof);
  box(out, 'flatRoof', x0, x1, z1, z1 + 6.4, high - 0.23, high, roof);
  box(out, 'limestone', x0, x1, z0, z1, -2.5, 0.27, paving);
  if (level < 2) return;
  for (const f of [
    wallFace([x0, z0], [x0, z1]),
    wallFace([x0, z1], [x1, z1]),
    wallFace([x1, z1], [x1, z0]),
    wallFace([x1, z0], [x0, z0]),
  ]) {
    const inward = -0.32;
    for (let i = 1; i < 5; i++) {
      const at = (f.length * i) / 5;
      fbox(
        out,
        'limestone',
        f,
        at - 0.095,
        at + 0.095,
        0.26,
        6.72,
        inward - 0.1,
        inward + 0.1,
        chalk,
      );
    }
  }
}

function chaoWing(out, level) {
  box(out, 'plaster', -84.0, -30.65, 31.62, 48.45, -3.45, 7.98, plaster);
  box(out, 'flatRoof', -84.0, -30.65, 31.62, 48.45, 7.97, 8.05, roof);
  box(out, 'plaster', -90.0, -84.0, 31.62, 52.92, -3.45, 8.73, shadedPlaster);
  const west = -96.1;
  const east = -84.1;
  const n = 42.98;
  const s = 52.95;
  box(out, 'jade', west, east, n, s, -2.85, survey.heightEstimatesMetres.ChaoPavilionParapet, jade);
  box(out, 'flatRoof', west + 0.2, east - 0.2, n + 0.25, s - 0.25, 10.59, 10.72, roof);
  if (level === 0) return;
  const f = wallFace([west, n], [west, s]);
  opening(out, f, f.length * 0.51, 0.47, 3.9, 5.1, {
    glassSlot: 'dark',
    frameSlot: 'jade',
    glass,
    frame: darkJade,
    frameWidth: 0.22,
    mullions: 2,
  });
  const pitch = level === 3 ? 0.62 : 1.28;
  if (level >= 2)
    for (let y = 0.68; y < 10.42; y += pitch)
      for (let u = 0.3; u < f.length - 0.54; u += pitch) {
        if (y < 5.77 && u > f.length * 0.51 - 2.2 && u < f.length * 0.51 + 1.99) continue;
        const shade = Math.floor((y + u) / pitch) % 4 === 0 ? brightJade : darkJade;
        quad4(
          out,
          'jade',
          f.P(u, y, 0.018),
          f.P(u + pitch * 0.89, y, 0.018),
          f.P(u + pitch * 0.8, y + pitch * 0.89, 0.093),
          f.P(u, y + pitch * 0.89, 0.07),
          shade,
        );
      }
}

function parterre(out, level) {
  const [x0, x1, x2, x3] = survey.courtyardLandings;
  const mid = (north + south) / 2;
  const stages = [
    [x0 - 3, x1, -1.58],
    [x1, x2, -1.13],
    [x2, x3, -0.57],
    [x3, courtEast + 0.14, 0.12],
  ];
  for (const [from, to, y] of stages) {
    box(out, 'limestone', from, to - 0.012, north, south, -3.72, y, paving);
    if (to - from < 5) continue;
    for (const [z0, z1] of [
      [north + 2.0, mid - 2.1],
      [mid + 2.1, south - 2.0],
    ]) {
      const lawn = y + 0.038;
      box(out, 'grass', from + 0.84, to - 0.76, z0, z1, y, lawn, to === x1 ? leaf : darkLeaf);
      if (level >= 2 && from === x2) {
        for (let ix = 0; ix < 4; ix++)
          for (let iz = 0; iz < 2; iz++) {
            const x = from + 3.75 + ix * 6.7;
            const z = z0 + 3.35 + iz * 6.05;
            box(
              out,
              'limestone',
              x - 1.78,
              x + 1.78,
              z - 1.78,
              z + 1.78,
              lawn,
              lawn + 0.076,
              paving,
            );
            box(
              out,
              'grass',
              x - 1.15,
              x + 1.15,
              z - 1.15,
              z + 1.15,
              lawn + 0.065,
              lawn + 0.11,
              leaf,
            );
          }
      }
    }
  }
  if (level >= 1) {
    for (let i = 1; i < stages.length - 1; i++) {
      const [x, , y] = stages[i];
      for (const [z0, z1] of [
        [north + 0.9, mid - 2.27],
        [mid + 2.27, south - 0.9],
      ])
        balustrade(out, wallFace([x, z0], [x, z1]), y + 0.015, level, 0.75);
      for (let stair = 0; stair < 4; stair++)
        box(
          out,
          'limestone',
          x - 2.1 + stair * 0.52,
          x + 0.07,
          mid - 2.24,
          mid + 2.24,
          y - 0.61,
          stages[i - 1][2] + ((stair + 1) * (y - stages[i - 1][2])) / 4,
          chalk,
        );
    }
  }
  const [westX, westZ] = survey.westTerraceAxis;
  const radial = (i) => {
    const angle = (i / 16 - 0.5) * Math.PI;
    return [westX - 3.15 + 4.0 * Math.cos(angle), westZ + 16.55 * Math.sin(angle)];
  };
  const stride = level === 0 ? 4 : 1;
  for (let i = 0; i < 16; i += stride) {
    const f = wallFace(radial(i), radial(i + stride));
    fbox(out, 'limestone', f, 0, f.length, -2.1, -0.81, -0.49, 0.12, stone);
    if (level >= 2) balustrade(out, f, -0.81, level, 0.62);
  }
  if (level >= 1) figure(out, westX + 1.35, westZ, -1.57, 3.35, bronzeSlot, bronze, level);
  if (level >= 2) {
    for (const [x, z, y, h] of [
      [2, -3, -1.57, 1.72],
      [4, 22, -1.57, 1.87],
      [20, -4, -1.12, 1.66],
      [19, 21, -1.12, 1.99],
      [44, -3, -0.56, 1.65],
      [47, 23, -0.56, 1.71],
    ])
      figure(out, x, z, y, h, bronzeSlot, bronze, level);
  }
}

const bronzeSlot = 'bronze';
function build(out, level) {
  galleryRanges(out, level);
  eastRange(out, level);
  searingWing(out, level);
  chaoWing(out, level);
  parterre(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'john-and-mable-ringling-museum-of-art-model.mjs';
const aerial = [-91, 92, 112];
const target = [-10, 2.7, 0];
const openingOutline = [
  [courtWest - 2.9, north + 0.03],
  [courtEast - 0.02, north + 0.03],
  [courtEast - 0.02, south - 0.03],
  [courtWest - 2.9, south - 0.03],
];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'art-museum',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The Ringling Museum of Art in Sarasota with open pink colonnades, a terraced sculpture garden, the tiled east range and the attached Searing and Chao wings.',
  camera: aerial,
  lookAt: target,
  sunDirection: [-44, 61, -46],
  mediumFiContext: {
    scale: 1.16,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  groundCutout: {
    outline: openingOutline,
    basis:
      'The museum owns the steps and sunken parterre between the loggias. Native terrain outside the court remains at original grade.',
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    outlines: survey.outsideEnvelopes,
    minimumCoverage: 0.87,
    basis:
      'Replace the original mapped gallery envelope and the attached Searing Wing. Keep neighboring estate buildings.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'renaissance-court-overhead', position: [-52, 103, 76], lookAt: [-6, 1, 0] },
    { name: 'courtyard-arcades-and-parterre', position: [-28, 4.6, 19], lookAt: [42, 3, -4] },
    { name: 'historic-east-entry', position: [114, 9, 9], lookAt: [73, 4, 8] },
    { name: 'searing-wing-open-roof', position: [-82, 52, -66], lookAt: [-62, 4, -42] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'ringling-museum-' + reviewLod,
    position: aerial,
    lookAt: target,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 2.0,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.86, surfaces },
      street: { export: 'street', errorMeters: 0.28, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.1, surfaces },
    },
  },
};
