/** Original, meter-scale polygonal airframes. +Y up, +Z forward, +X pilot's left.
 * No image textures. Each airframe has a hollow shell, authored planform and cockpit aperture.
 */
import '../../worldgen/scripts/install-deterministic-math.mjs';
import * as T from 'three';
import { a400Frame, buildA400M } from './aircraft/a400m.mjs';
import { buildH125, h125Frame } from './aircraft/airbus-h125.mjs';
import { buildH145, h145Frame } from './aircraft/airbus-h145.mjs';
import { an124Frame, buildAn124 } from './aircraft/an-124.mjs';
import { atr72Frame, buildATR72 } from './aircraft/atr-72.mjs';
import { av8Frame, buildAV8B } from './aircraft/av-8b.mjs';
import { aw139Frame, buildAW139 } from './aircraft/aw139.mjs';
import { baronFrame, buildBaron } from './aircraft/baron-g58.mjs';
import { beech18Frame, buildBeech18 } from './aircraft/beech-18.mjs';
import { bell206Frame, buildBell206 } from './aircraft/bell-206.mjs';
import { bell407Frame, buildBell407 } from './aircraft/bell-407.mjs';
import { bell412Frame, buildBell412 } from './aircraft/bell-412.mjs';
import { bonanzaFrame, buildBonanza } from './aircraft/bonanza-g36.mjs';
import { buildC5M, c5Frame } from './aircraft/c-5m.mjs';
import { buildC17A, c17Frame } from './aircraft/c-17a.mjs';
import { buildC130J, c130Frame } from './aircraft/c-130j.mjs';
import { buildCaravan, caravanFrame } from './aircraft/caravan-ex.mjs';
import { buildCessna172, cessna172Frame } from './aircraft/cessna-172s.mjs';
import { buildCessna182, cessna182Frame } from './aircraft/cessna-182t.mjs';
import { buildCH47, ch47Frame } from './aircraft/ch-47.mjs';
import { buildCherokee, cherokeeFrame } from './aircraft/cherokee.mjs';
import { buildCirrus, cirrusFrame } from './aircraft/cirrus-sr22t.mjs';
import { buildDC3, dc3Frame } from './aircraft/dc-3.mjs';
import { beaverFrame, buildBeaver } from './aircraft/dhc-2.mjs';
import { buildTwinOtter, twinOtterFrame } from './aircraft/dhc-6.mjs';
import { buildDiamond, diamondFrame } from './aircraft/diamond-da42.mjs';
import { buildF14D, f14Frame } from './aircraft/f-14d.mjs';
import { buildF15C, f15Frame } from './aircraft/f-15c.mjs';
import { buildF16B, f16Frame } from './aircraft/f-16b.mjs';
import { buildF22A, f22Frame } from './aircraft/f-22a.mjs';
import { buildF35A, f35Frame } from './aircraft/f-35a.mjs';
import { buildFA18C, fa18Frame } from './aircraft/fa-18c.mjs';
import { buildGripenC, gripenFrame } from './aircraft/gripen-c.mjs';
import { buildHuey, hueyFrame } from './aircraft/huey.mjs';
import { buildKingAir, kingAirFrame } from './aircraft/king-air-350i.mjs';
import { buildMiG29A, mig29Frame } from './aircraft/mig-29a.mjs';
import { buildMV22, mv22Frame } from './aircraft/mv-22b.mjs';
import { buildPorter, porterFrame } from './aircraft/pc-6.mjs';
import { buildPC12, pc12Frame } from './aircraft/pilatus-pc12.mjs';
import { buildRafaleC, rafaleFrame } from './aircraft/rafale-c.mjs';
import { buildR44, r44Frame } from './aircraft/robinson-r44.mjs';
import { buildTyphoon, typhoonFrame } from './aircraft/typhoon.mjs';
import { buildUH60, uh60Frame } from './aircraft/uh-60.mjs';
import { addAircraftCockpit } from './aircraft-interiors.mjs';
import { detailKit } from './vehicle-detail.mjs';

const pi = Math.PI;
const material = (name, color, metalness = 0.15, roughness = 0.55, extra = {}) =>
  new T.MeshStandardMaterial({ name, color, metalness, roughness, flatShading: true, ...extra });
export function aircraftFrame(s) {
  if (s.slug === 'atr-72-600') return atr72Frame();
  if (s.slug === 'dc-3') return dc3Frame();
  if (s.slug === 'beech-18') return beech18Frame();
  if (s.slug === 'pc-6') return porterFrame();
  if (s.slug === 'dhc-2') return beaverFrame();
  if (s.slug === 'dhc-6') return twinOtterFrame();
  if (s.slug === 'av-8b') return av8Frame();
  if (s.slug === 'mv-22b') return mv22Frame();
  if (s.slug === 'c-5m') return c5Frame();
  if (s.slug === 'an-124') return an124Frame();
  if (s.slug === 'a400m') return a400Frame();
  if (s.slug === 'c-17a') return c17Frame();
  if (s.slug === 'c-130j') return c130Frame();
  if (s.slug === 'mig-29a') return mig29Frame();
  if (s.slug === 'gripen-c') return gripenFrame();
  if (s.slug === 'typhoon') return typhoonFrame();
  if (s.slug === 'rafale-c') return rafaleFrame();
  if (s.slug === 'f-35a') return f35Frame();
  if (s.slug === 'f-22a') return f22Frame();
  if (s.slug === 'fa-18c') return fa18Frame();
  if (s.slug === 'f-14d') return f14Frame();
  if (s.slug === 'f-15c') return f15Frame();
  if (s.slug === 'f-16b') return f16Frame();
  if (s.slug === 'pilatus-pc12') return pc12Frame();
  if (s.slug === 'diamond-da42') return diamondFrame();
  if (s.slug === 'cirrus-sr22t') return cirrusFrame();
  if (s.slug === 'king-air-350i') return kingAirFrame();
  if (s.slug === 'baron-g58') return baronFrame();
  if (s.slug === 'bonanza-g36') return bonanzaFrame();
  if (s.slug === 'cessna-182t') return cessna182Frame();
  if (s.slug === 'cessna-208b') return caravanFrame();
  if (s.slug === 'cessna-172s') return cessna172Frame();
  if (s.slug === 'pa-28-180') return cherokeeFrame();
  if (s.slug === 'uh-1h') return hueyFrame();
  if (s.slug === 'bell-206b') return bell206Frame();
  if (s.slug === 'bell-407') return bell407Frame();
  if (s.slug === 'bell-412ep') return bell412Frame();
  if (s.slug === 'robinson-r44') return r44Frame();
  if (s.slug === 'airbus-h125') return h125Frame();
  if (s.slug === 'airbus-h145') return h145Frame();
  if (s.slug === 'uh-60m') return uh60Frame();
  if (s.slug === 'ch-47f') return ch47Frame();
  if (s.slug === 'aw139') return aw139Frame();
  const heli = s.category === 'helicopter',
    fighter = ['fighter', 'vtol'].includes(s.category);
  const large = ['cargo', 'regional', 'airliner', 'business', 'heritage'].includes(s.category);
  const radius = s.width / 2;
  const cy = heli
    ? s.height * 0.41
    : fighter
      ? Math.max(1.12, s.height * 0.32)
      : large
        ? radius + Math.max(0.65, s.height * 0.12)
        : Math.max(0.9, s.height * 0.35);
  const ry = heli ? s.width * 0.57 : fighter ? s.width * 0.34 : radius * 0.96;
  const cabinZ = heli
    ? (s.body ?? s.length * 0.55) * (s.shape === 'tandem' ? 0.4 : 0.23)
    : fighter
      ? s.length * 0.19
      : large || s.category === 'tiltrotor'
        ? s.length * 0.35
        : s.length * 0.12;
  const eyeY = heli
    ? cy + ry * (s.shape === 'tandem' ? 0.4 : 0.65)
    : fighter
      ? cy + ry + 0.29
      : large
        ? cy + ry * 0.7
        : cy + ry * 0.77;
  const cabinWidth = fighter ? 0.77 : Math.min(s.width * (heli ? 0.7 : 0.77), large ? 2.7 : 1.7);
  const eyeX = fighter ? 0 : Math.min(0.57, cabinWidth * 0.27) * (heli ? -1 : 1);
  const eye = [eyeX, eyeY, cabinZ];
  return {
    heli,
    fighter,
    large,
    radius,
    cy,
    ry,
    cabinZ,
    cabinWidth,
    eye,
    panelZ: cabinZ + 0.67,
    floor: eyeY - 1.02,
  };
}

function group(parent, name, at = [0, 0, 0]) {
  const g = new T.Group();
  g.name = name;
  g.position.fromArray(at);
  parent.add(g);
  return g;
}

/** Closed airfoil with separate top/bottom skins, rounded leading edge and thin trailing edge. */
function foil(
  d,
  at,
  span,
  root,
  tip,
  sweep,
  side,
  paint,
  { dihedral = 0, thickness = 0.11, start = 0, end = 1 } = {},
) {
  const points = [],
    indices = [],
    nx = 10,
    ny = 10;
  for (let face = 0; face < 2; face++)
    for (let j = 0; j <= ny; j++) {
      const t = j / ny,
        chord = root + (tip - root) * t;
      for (let i = 0; i <= nx; i++) {
        const u = start + ((end - start) * i) / nx;
        const y =
          (face === 0 ? 1 : -1) *
          chord *
          thickness *
          (0.2969 * Math.sqrt(u) -
            0.126 * u -
            0.3516 * u * u +
            0.2843 * Math.pow(u, 3) -
            0.1036 * Math.pow(u, 4)) *
          5;
        points.push(
          at[0] + side * span * t,
          at[1] + dihedral * span * t + y,
          at[2] + root * 0.5 - sweep * t - chord * u,
        );
      }
    }
  const stride = nx + 1,
    offset = stride * (ny + 1);
  const quad = (a, b, c, e) => indices.push(a, b, c, a, c, e);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const a = j * stride + i;
      if (side > 0) {
        quad(a, a + stride, a + stride + 1, a + 1);
        quad(a + offset, a + 1 + offset, a + stride + 1 + offset, a + stride + offset);
      } else {
        quad(a, a + 1, a + stride + 1, a + stride);
        quad(a + offset, a + stride + offset, a + stride + 1 + offset, a + 1 + offset);
      }
    }
  for (let j = 0; j < ny; j++)
    for (const i of [0, nx]) {
      const a = j * stride + i;
      quad(a, a + offset, a + stride + offset, a + stride);
    }
  for (let i = 0; i < nx; i++)
    for (const j of [0, ny]) {
      const a = j * stride + i;
      quad(a, a + 1, a + 1 + offset, a + offset);
    }
  const geom = new T.BufferGeometry();
  geom.setAttribute('position', new T.Float32BufferAttribute(points, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  d.add(geom, paint);
}
function fin(d, at, height, chord, tip, sweep, material, cant = 0, rudder) {
  const g = group(d.root, 'fin-frame', at);
  g.rotation.z = cant;
  const k = detailKit(g, 'fin-skin');
  // Foil span becomes vertical: +X to +Y.
  k.root.rotation.z = pi / 2;
  foil(k, [0, 0, 0], height, chord, tip, sweep, 1, material, {
    thickness: 0.065,
    end: rudder ? 0.72 : 1,
  });
  k.finish();
  if (rudder) {
    // Keep the hinge outside the static detail batch so import cannot bake away its pivot.
    const hinge = group(d.root.parent, rudder, [at[0], at[1], at[2] - chord * 0.22]),
      r = detailKit(hinge, 'rudder-skin');
    hinge.rotation.z = cant;
    r.root.rotation.z = pi / 2;
    foil(
      r,
      [0, 0, -chord * 0.14],
      height,
      chord * 0.28,
      tip * 0.28,
      sweep + 0.72 * (tip - chord),
      1,
      material,
      { thickness: 0.065 },
    );
    r.finish();
  }
}
function ellipsoid(d, at, size, mat, segments = 24) {
  return d.add(new T.SphereGeometry(1, segments, 12).scale(...size), mat, at);
}

export function buildAircraft(s) {
  if (s.slug === 'atr-72-600') return buildATR72(s);
  if (s.slug === 'dc-3') return buildDC3(s);
  if (s.slug === 'beech-18') return buildBeech18(s);
  if (s.slug === 'pc-6') return buildPorter(s);
  if (s.slug === 'dhc-2') return buildBeaver(s);
  if (s.slug === 'dhc-6') return buildTwinOtter(s);
  if (s.slug === 'av-8b') return buildAV8B(s);
  if (s.slug === 'mv-22b') return buildMV22(s);
  if (s.slug === 'c-5m') return buildC5M(s);
  if (s.slug === 'an-124') return buildAn124(s);
  if (s.slug === 'a400m') return buildA400M(s);
  if (s.slug === 'c-17a') return buildC17A(s);
  if (s.slug === 'c-130j') return buildC130J(s);
  if (s.slug === 'mig-29a') return buildMiG29A(s);
  if (s.slug === 'gripen-c') return buildGripenC(s);
  if (s.slug === 'fa-18c') return buildFA18C(s);
  if (s.slug === 'typhoon') return buildTyphoon(s);
  if (s.slug === 'rafale-c') return buildRafaleC(s);
  if (s.slug === 'f-35a') return buildF35A(s);
  if (s.slug === 'f-22a') return buildF22A(s);
  if (s.slug === 'f-14d') return buildF14D(s);
  if (s.slug === 'f-15c') return buildF15C(s);
  if (s.slug === 'f-16b') return buildF16B(s);
  if (s.slug === 'pilatus-pc12') return buildPC12(s);
  if (s.slug === 'diamond-da42') return buildDiamond(s);
  if (s.slug === 'cirrus-sr22t') return buildCirrus(s);
  if (s.slug === 'king-air-350i') return buildKingAir(s);
  if (s.slug === 'baron-g58') return buildBaron(s);
  if (s.slug === 'bonanza-g36') return buildBonanza(s);
  if (s.slug === 'cessna-182t') return buildCessna182(s);
  if (s.slug === 'cessna-208b') return buildCaravan(s);
  if (s.slug === 'cessna-172s') return buildCessna172(s);
  if (s.slug === 'pa-28-180') return buildCherokee(s);
  if (s.slug === 'bell-206b') return buildBell206(s);
  if (s.slug === 'bell-407') return buildBell407(s);
  if (s.slug === 'bell-412ep') return buildBell412(s);
  if (s.slug === 'robinson-r44') return buildR44(s);
  if (s.slug === 'airbus-h125') return buildH125(s);
  if (s.slug === 'airbus-h145') return buildH145(s);
  if (s.slug === 'uh-60m') return buildUH60(s);
  if (s.slug === 'ch-47f') return buildCH47(s);
  if (s.slug === 'aw139') return buildAW139(s);
  if (s.slug === 'uh-1h') return buildHuey(s);
  const f = aircraftFrame(s),
    root = new T.Group();
  root.name = s.slug;
  const d = detailKit(root, 'airframe'),
    paint = material('airframe-paint', s.color ?? '#dedfd6'),
    accent = material('airframe-accent', s.accent ?? '#52616b');
  const trim = material('panel-seam', '#515d61', 0.2, 0.6),
    rubber = material('tire-rubber', '#25292b', 0, 0.9);
  const glass = material('canopy-glass', '#a6c9cf', 0.05, 0.18, {
    transparent: true,
    opacity: 0.23,
    depthWrite: false,
    side: T.DoubleSide,
  });
  const metallic = material('hot-section-metal', '#747b7b', 0.7, 0.4),
    black = material('intake-shadow', '#283137', 0.1, 0.8);
  const { heli, fighter, large, cy, ry, radius } = f,
    L = s.length;
  paint.side = T.DoubleSide;
  const wingY = heli
    ? cy
    : s.shape.startsWith('high') || s.category === 'tiltrotor'
      ? cy + ry * 0.92
      : cy - ry * 0.52;
  const wingZ = s.wingZ ?? (fighter ? -L * 0.03 : large ? -L * 0.015 : -L * 0.04);
  const wingSpan = s.category === 'tiltrotor' ? 14 : (s.span - s.width) / 2;
  const bodyL = heli ? (s.body ?? L * 0.55) : L;
  // Longitudinal stations capture pointed radomes, blunt transports, cowlings and tapered tails.
  let stations = fighter
    ? [
        [-0.5, 0.25, 0.3],
        [-0.39, 0.78, 0.83],
        [-0.2, 1, 1],
        [0.02, 1, 0.95],
        [0.18, 0.77, 0.8],
        [0.31, 0.55, 0.66],
        [0.42, 0.25, 0.35],
        [0.5, 0.008, 0.015],
      ]
    : heli
      ? [
          [-0.5, 0.57, 0.58],
          [-0.33, 0.92, 0.9],
          [-0.05, 1, 1],
          [0.2, 1, 0.96],
          [0.37, 0.82, 0.8],
          [0.5, 0.1, 0.22],
        ]
      : large
        ? [
            [-0.5, 0.05, 0.12],
            [-0.35, 0.68, 0.76],
            [-0.23, 0.98, 0.98],
            [0.2, 1, 1],
            [0.35, 0.94, 0.75],
            [0.4, 0.82, 0.5],
            [0.43, 0.67, 0.4],
            [0.48, 0.33, 0.17],
            [0.5, 0.02, 0.03],
          ]
        : [
            [-0.5, 0.12, 0.2],
            [-0.33, 0.38, 0.52],
            [-0.15, 0.77, 0.9],
            [0.07, 1, 1],
            [0.22, 0.91, 0.9],
            [0.32, 0.58, 0.58],
            [0.44, 0.5, 0.48],
            [0.5, 0.42, 0.42],
          ];
  if (s.shape === 'robinson')
    stations = [
      [-0.5, 0.12, 0.25],
      [-0.24, 0.78, 0.85],
      [0.05, 1, 1],
      [0.29, 0.91, 0.9],
      [0.48, 0.4, 0.55],
      [0.5, 0.1, 0.1],
    ];
  if (s.shape === 'tandem')
    stations = [
      [-0.5, 0.72, 0.7],
      [-0.38, 0.96, 0.97],
      [0.26, 1, 1],
      [0.4, 0.77, 0.8],
      [0.5, 0.15, 0.25],
    ];
  if (s.category === 'tiltrotor')
    stations = [
      [-0.5, 0.35, 0.35],
      [-0.36, 0.82, 0.83],
      [-0.2, 1, 1],
      [0.2, 1, 1],
      [0.36, 0.94, 0.85],
      [0.46, 0.68, 0.52],
      [0.5, 0.1, 0.15],
    ];
  const ring = (z) => {
    let j = stations.findIndex((a) => a[0] >= z);
    j = Math.max(1, j < 0 ? stations.length - 1 : j);
    const a = stations[j - 1],
      b = stations[j],
      t = Math.max(0, Math.min(1, (z - a[0]) / (b[0] - a[0])));
    return [radius * (a[1] + (b[1] - a[1]) * t), ry * (a[2] + (b[2] - a[2]) * t)];
  };
  const square =
    (heli && ['huey', 'tandem', 'blackhawk'].includes(s.shape)) || s.category === 'tiltrotor';
  const at = (z, a, offset = 0) => {
    const [w, h] = ring(z / bodyL),
      sn = Math.sin(a),
      cs = Math.cos(a);
    return [
      Math.sign(sn) * Math.pow(Math.abs(sn), square ? 0.7 : 1) * (w + offset),
      cy + Math.sign(cs) * Math.pow(Math.abs(cs), square ? 0.7 : 1) * (h + offset),
      z,
    ];
  };
  const shell = [],
    glazing = [],
    n = 48,
    nz = 80;
  const push = (arr, a, b, c) => arr.push(...a, ...b, ...c);
  for (let iz = 0; iz < nz; iz++)
    for (let ia = 0; ia < n; ia++) {
      const z0 = bodyL * (-0.5 + iz / nz),
        z1 = bodyL * (-0.5 + (iz + 1) / nz),
        a0 = (ia * 2 * pi) / n,
        a1 = ((ia + 1) * 2 * pi) / n;
      const z = (z0 + z1) / 2,
        a = (a0 + a1) / 2,
        localY = Math.cos(a);
      // An actual aperture below a raised fighter canopy, never a solid fuselage through the pilot.
      if (fighter && z > f.cabinZ - (s.tandem ? 2.25 : 1.05) && z < f.panelZ + 0.8 && localY > 0.3)
        continue;
      const cockpit =
        !fighter &&
        z > f.cabinZ - 0.7 &&
        z <
          bodyL *
            (['robinson', 'tandem'].includes(s.shape)
              ? 0.49
              : heli
                ? 0.46
                : large || s.category === 'tiltrotor'
                  ? 0.4
                  : 0.3) &&
        at(z, a)[1] > f.eye[1] - (heli ? 0.72 : 0.42) &&
        (s.shape === 'robinson' || localY < 0.86 || z > f.cabinZ - 0.2);
      const passenger =
        !heli &&
        !fighter &&
        large &&
        s.category !== 'cargo' &&
        z > -0.27 * L &&
        z < 0.25 * L &&
        Math.abs(Math.sin(a)) > 0.93 &&
        localY > 0.05 &&
        localY < 0.38 &&
        ((z + L) * 1.3) % 1 < 0.43;
      const array = cockpit || passenger ? glazing : shell;
      const A = at(z0, a0),
        B = at(z1, a0),
        C = at(z1, a1),
        D = at(z0, a1);
      push(array, A, B, C);
      push(array, A, C, D);
    }
  for (const side of [-1, 1])
    for (let i = 0; i < n; i++) {
      const z = side * bodyL * 0.5,
        a = at(z, (i * 2 * pi) / n),
        b = at(z, ((i + 1) * 2 * pi) / n),
        center = [0, cy, z];
      if (side > 0) push(shell, center, b, a);
      else push(shell, center, a, b);
    }
  for (const [verts, mat, name] of [
    [shell, paint, 'hollow-fuselage-skin'],
    [glazing, glass, 'canopy-glazing'],
  ]) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(verts, 3));
    g.computeVertexNormals();
    const m = d.add(g, mat);
    m.name = name;
  }
  // Structural circumferential seams; rivets are placed on these skin joints, not a blanket grid.
  const seamZ = heli
    ? [-0.34, -0.12, 0.16]
    : fighter
      ? [-0.39, -0.24, -0.1, 0.32, 0.42]
      : [-0.32, -0.18, 0.08, 0.28, 0.41];
  for (const fraction of seamZ) {
    const z = fraction * bodyL;
    for (let i = 0; i < n; i++) {
      const a = (i * 2 * pi) / n,
        b = ((i + 1) * 2 * pi) / n;
      if (z > f.cabinZ - 1 && z < f.panelZ + 0.9 && Math.cos(a) > 0.05) continue;
      d.rod(at(z, a, 0.004), at(z, b, 0.004), 0.0045, trim);
      if (i % 2 === 0) d.add(new T.OctahedronGeometry(0.009), metallic, at(z + 0.04, a, 0.009));
    }
  }
  for (const side of [-1, 1])
    for (const a of [1.1, 1.8]) {
      for (let k = 0; k < 26; k++) {
        const z = bodyL * (-0.35 + k * 0.023);
        if (z > f.cabinZ - 0.8 && z < f.panelZ + 0.75) continue;
        d.add(new T.OctahedronGeometry(0.007), metallic, at(z, side * a, 0.008));
      }
    }
  // Windshield frames follow the shell and leave the forward eye ray clear.
  if (!fighter) {
    for (let i = -11; i < 11; i++)
      d.rod(
        at(f.cabinZ - 0.7, (i * pi) / 24, 0.014),
        at(f.cabinZ - 0.7, ((i + 1) * pi) / 24, 0.014),
        0.018,
        accent,
      );
    const windshieldZ = f.panelZ + 0.32,
      topZ = f.cabinZ + 0.08;
    for (const side of [-1, 0, 1]) {
      const x = side * f.cabinWidth * 0.49;
      d.rod([x, f.eye[1] - 0.32, windshieldZ], [x * 0.92, f.eye[1] + 0.28, topZ], 0.018, accent);
    }
    d.rod(
      [-f.cabinWidth * 0.49, f.eye[1] - 0.32, windshieldZ],
      [f.cabinWidth * 0.49, f.eye[1] - 0.32, windshieldZ],
      0.018,
      accent,
    );
    // Door outlines, hinges, latches and boarding grips near the operating station.
    for (const side of [-1, 1]) {
      const x = side * radius * 0.94,
        z = f.cabinZ - 0.85;
      d.rod([x, cy - ry * 0.65, z - 0.42], [x, cy + ry * 0.35, z - 0.42], 0.012, trim);
      d.rod([x, cy - ry * 0.65, z + 0.42], [x, cy + ry * 0.35, z + 0.42], 0.012, trim);
      d.rod([x, cy - ry * 0.65, z - 0.42], [x, cy - ry * 0.65, z + 0.42], 0.012, trim);
      d.rod([x * 1.01, cy, z - 0.1], [x * 1.01, cy, z + 0.16], 0.018, metallic);
      d.box([0.035, 0.11, 0.08], [x, cy + 0.12, z - 0.4], accent);
    }
  } else {
    const start = f.cabinZ - (s.tandem ? 2.25 : 1.05),
      end = f.panelZ + 0.8,
      canopyY = f.eye[1] - 0.33;
    // Elliptical bubble with a genuine open underside; tandem variants have a rear station.
    const verts = [];
    const p = (u, a) => [
      Math.sin(a) * 0.64 * Math.sin(pi * u),
      canopyY + Math.cos(a) * 0.85 * Math.sin(pi * u),
      start + (end - start) * u,
    ];
    for (let j = 0; j < 20; j++)
      for (let i = -12; i < 12; i++) {
        const A = p(j / 20, (i * pi) / 24),
          B = p((j + 1) / 20, (i * pi) / 24),
          C = p((j + 1) / 20, ((i + 1) * pi) / 24),
          D = p(j / 20, ((i + 1) * pi) / 24);
        push(verts, A, B, C);
        push(verts, A, C, D);
      }
    const geom = new T.BufferGeometry();
    geom.setAttribute('position', new T.Float32BufferAttribute(verts, 3));
    geom.computeVertexNormals();
    d.add(geom, glass);
    for (const u of [0.22, 0.77])
      for (let i = -12; i < 12; i++)
        d.rod(p(u, (i * pi) / 24), p(u, ((i + 1) * pi) / 24), 0.022, accent);
    for (const side of [-1, 1])
      d.rod([side * 0.48, canopyY, start + 0.3], [side * 0.48, canopyY, end - 0.3], 0.035, paint);
  }
  const animated = [],
    rotors = [],
    flaps = [],
    ailerons = [];
  const moving = (name, pos) => group(root, name, pos);
  const wing = (side) => {
    const x = side * radius * 0.75,
      span = s.category === 'tiltrotor' ? 6 - radius * 0.75 : wingSpan;
    const g = moving(`wing-${side > 0 ? 'left' : 'right'}`, [x, wingY, wingZ]),
      w = detailKit(g, 'wing-detail');
    const chord = s.chord ?? (large ? L * 0.19 : 1.65),
      tip = s.tipChord ?? chord * 0.62,
      sweep = s.sweep ?? 0.25;
    foil(w, [0, 0, 0], span, chord, tip, sweep, side, paint, {
      dihedral: s.wingAnhedral ?? (fighter ? 0.015 : 0.04),
      thickness: fighter ? 0.06 : 0.1,
    });
    for (const ratio of [0.22, 0.54, 0.82]) {
      const xx = side * span * ratio,
        zz = chord * 0.5 - sweep * ratio,
        c = chord + (tip - chord) * ratio;
      w.rod(
        [xx, 0.04 + span * ratio * (s.wingAnhedral ?? 0.04), zz - 0.18],
        [xx, 0.04 + span * ratio * (s.wingAnhedral ?? 0.04), zz - c + 0.1],
        0.005,
        trim,
      );
      for (let k = 0; k < 12; k++)
        w.add(new T.OctahedronGeometry(0.008), metallic, [
          xx + 0.035,
          0.055 + span * ratio * (s.wingAnhedral ?? 0.04),
          zz - 0.2 - (k * (c - 0.4)) / 12,
        ]);
    }
    for (const [name, center, width, factor] of [
      ['flap', 0.33, 0.3, 0.65],
      ['aileron', 0.77, 0.22, 0.3],
    ]) {
      const xx = side * span * center,
        c = chord + (tip - chord) * center,
        zz = chord * 0.5 - sweep * center - c * 0.82;
      const control = group(g, `${name}-${side > 0 ? 'left' : 'right'}`, [
        xx,
        span * center * (s.wingAnhedral ?? 0.04),
        zz,
      ]);
      const k = detailKit(control, `${name}-surface`);
      k.box([span * width, 0.035, c * 0.16], [0, 0, -c * 0.08], paint);
      k.finish();
      (name === 'flap' ? flaps : ailerons).push({
        node: control.name,
        axis: 'x',
        multiplier: name === 'flap' ? -factor : side * factor,
      });
    }
    if (s.winglets) {
      fin(
        w,
        [side * span, span * 0.04, chord * 0.5 - sweep - tip * 0.6],
        Math.min(2.4, span * 0.16),
        tip * 0.9,
        tip * 0.35,
        0.5,
        accent,
        -side * 0.2,
      );
    }
    w.add(new T.SphereGeometry(0.055, 8, 6), side > 0 ? w.red : w.green, [
      side * span,
      span * (s.wingAnhedral ?? 0.04),
      chord * 0.5 - sweep - tip * 0.3,
    ]);
    w.finish();
    if (s.swing)
      animated.push({
        node: g.name,
        source: 'airspeed',
        property: 'rotation',
        axis: 'y',
        keys: [
          [0, 0],
          [100, 0],
          [250, side * 0.82],
        ],
      });
    if (s.struts)
      d.rod(
        [side * radius * 0.8, cy - ry * 0.7, wingZ],
        [side * (radius + span * 0.58), wingY + span * 0.025, wingZ + 0.1],
        0.035,
        paint,
      );
  };
  if (!heli) {
    wing(-1);
    wing(1);
  }
  // Tail surfaces, canards and leading-edge root extensions have independent planforms.
  if (!heli) {
    const tailZ = -L * 0.38,
      tailH = Math.max(0.7, s.height - cy),
      tailY = cy + (s.tail === 't' ? tailH * 0.88 : ry * 0.28);
    for (const side of [-1, 1]) {
      const name = `pitch-surface-${side}`,
        span = s.span * (s.canard ? 0.17 : fighter ? 0.22 : 0.19),
        chord = L * (s.canard ? 0.12 : 0.15),
        tip = L * (s.canard ? 0.035 : 0.05),
        sweep = L * 0.07;
      const y = s.canard ? cy + ry * 0.55 : tailY,
        z = s.canard ? L * 0.18 : tailZ;
      const hinge = moving(name, [
          s.canard ? side * radius * 0.7 : 0,
          y,
          z - (fighter ? 0 : chord * 0.22),
        ]),
        k = detailKit(hinge, 'pitch-surface');
      if (fighter) foil(k, [0, 0, 0], span, chord, tip, sweep, side, paint, { thickness: 0.06 });
      else {
        foil(d, [0, y, z], span, chord, tip, sweep, side, paint, { thickness: 0.07, end: 0.72 });
        foil(
          k,
          [0, 0, -chord * 0.14],
          span,
          chord * 0.28,
          tip * 0.28,
          sweep + 0.72 * (tip - chord),
          side,
          paint,
          { thickness: 0.07 },
        );
      }
      k.finish();
      animated.push({
        node: name,
        source: 'pitchInput',
        property: 'rotation',
        axis: 'x',
        scale: -0.3,
      });
    }
    const fins = s.twinTail || s.tail === 'twin' ? [-1, 1] : [0];
    for (const side of fins) {
      const name = `rudder-${side}`;
      fin(
        d,
        [side * (fighter ? s.width * 0.58 : s.span * 0.16), cy + ry * (side ? 0.3 : 0.25), tailZ],
        tailH * (side ? 0.82 : 0.91),
        L * 0.19,
        L * 0.07,
        L * (side ? 0.1 : 0.08),
        paint,
        side * (fighter ? 0.19 : 0),
        name,
      );
      animated.push({
        node: name,
        source: 'yawInput',
        property: 'rotation',
        axis: 'y',
        scale: -0.3,
      });
    }
    if (s.lerx || s.chines)
      for (const side of [-1, 1])
        foil(
          d,
          [side * radius * 0.4, cy, L * 0.1],
          s.width * (s.chines ? 0.7 : 0.6),
          L * 0.33,
          0.05,
          L * 0.13,
          side,
          paint,
          { thickness: 0.04 },
        );
  }
  const propeller = (parent, name, r, blades, axis = 'z', engine) => {
    const g = group(parent, name),
      k = detailKit(g, `${name}-blade-meshes`);
    const hub = axis === 'y' ? 0.17 : axis === 'x' ? 0.075 : Math.min(0.42, r * 0.13);
    ellipsoid(k, [0, 0, 0], [hub, hub, axis === 'y' ? 0.12 : hub * 1.5], metallic, 16);
    for (let i = 0; i < blades; i++) {
      const b = group(k.root, `blade-${i}`);
      b.rotation.z = (i * 2 * pi) / blades;
      const q = detailKit(b, 'blade');
      q.root.rotation.x = pi * 0.4;
      const chord = axis === 'y' ? Math.min(0.38, r * 0.055) : r * 0.14;
      foil(q, [r * 0.08, 0, 0], r * 0.92, chord, chord * 0.65, r * 0.015, 1, black, {
        thickness: 0.1,
      });
      q.box([r * 0.07, 0.012, chord * 0.66], [r * 0.96, 0, -r * 0.015], k.ivory);
      q.finish();
    }
    if (axis === 'y') k.root.rotation.x = -pi / 2;
    if (axis === 'x') k.root.rotation.y = pi / 2;
    k.finish();
    rotors.push({
      node: name,
      axis,
      multiplier: axis === 'x' ? 5.2 : s.category === 'tiltrotor' && engine === 'engine-2' ? -1 : 1,
      ...(engine ? { engine } : {}),
    });
    return g;
  };
  const enginePoints = [];
  if (heli) {
    if (s.shape === 'tandem') {
      for (const [j, z] of [-s.body * 0.38, s.body * 0.36].entries()) {
        const hubY = s.height - (j === 0 ? 0.12 : 0.7);
        d.box([radius * 1.1, 1.2, 1.7], [0, hubY - 0.8, z], paint);
        const hub = moving(`hub-${j}`, [0, hubY, z]);
        propeller(hub, `rotor-${j}`, s.span / 2, s.count, 'y');
      }
    } else {
      const hubY = s.height - 0.18,
        hubZ = s.rotorZ ?? -bodyL * 0.08;
      ellipsoid(d, [0, cy + ry * 0.85, -bodyL * 0.13], [radius * 0.66, 0.55, bodyL * 0.24], paint);
      d.rod([0, cy + ry, hubZ], [0, hubY, hubZ], 0.07, metallic);
      const hub = moving('rotor-hub', [0, hubY, hubZ]);
      propeller(hub, 'main-rotor', s.span / 2, s.count, 'y');
      for (const side of [-1, 1])
        d.rod(
          [side * 0.18, hubY - 0.45, hubZ - 0.18],
          [side * 0.42, hubY - 0.1, hubZ + 0.15],
          0.017,
          metallic,
        );
      const tailZ = -L * 0.43,
        tailY = cy + ry * 0.48;
      d.rod([0, cy, -bodyL * 0.31], [0, tailY, tailZ], radius * 0.21, paint);
      fin(d, [0, tailY, tailZ], s.height * 0.32, bodyL * 0.14, bodyL * 0.075, 0.35, paint);
      for (const side of [-1, 1])
        foil(d, [0, tailY, -L * 0.34], s.width * 0.7, 0.75, 0.42, 0.17, side, paint);
      const tail = moving('tail-hub', [
        (s.tailRotor === 'right' ? -1 : 1) * 0.3,
        tailY + 0.3,
        tailZ,
      ]);
      if (s.tailRotor === 'fenestron') d.ring(0.75, 0.14, [0, tailY + 0.3, tailZ], paint, 'x');
      propeller(
        tail,
        'tail-rotor',
        s.tailRotor === 'fenestron' ? 0.63 : s.span * 0.087,
        s.tailRotor === 'fenestron' ? 10 : 2,
        'x',
      );
    }
    for (const side of [-1, 1]) {
      ellipsoid(d, [side * radius * 0.58, cy + ry * 0.8, -bodyL * 0.22], [0.23, 0.27, 0.45], black);
      d.ring(0.21, 0.035, [side * radius * 0.58, cy + ry * 0.8, -bodyL * 0.22 - 0.4], metallic);
    }
  } else {
    const props = !fighter && !s.shape.includes('jet');
    const count =
      s.category === 'tiltrotor'
        ? 2
        : props
          ? s.shape.includes('twin')
            ? 2
            : s.shape === 'high-prop'
              ? s.count
              : 1
          : s.count;
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? 1 : -1,
        pair = Math.floor(i / 2);
      const x =
        count === 1
          ? 0
          : side *
            (fighter
              ? s.width * 0.47
              : s.category === 'tiltrotor'
                ? 6
                : s.shape === 'rear-jet'
                  ? radius + 0.65
                  : s.span * (pair === 0 ? 0.2 : 0.34));
      const z = fighter
        ? -L * 0.27
        : s.category === 'tiltrotor'
          ? 0
          : s.shape === 'rear-jet'
            ? -L * 0.3
            : count === 1
              ? L * 0.43
              : wingZ + 0.5;
      const y = fighter
        ? cy
        : s.category === 'tiltrotor'
          ? wingY
          : s.shape === 'rear-jet'
            ? cy + ry * 0.25
            : count === 1
              ? cy
              : wingY - (props ? 0.05 : Math.max(0.55, s.width * 0.43));
      const engName = `engine-${i + 1}`,
        engine = moving(engName, [x, y, z]);
      enginePoints.push({ id: engName, position: [x, y, z] });
      if (s.category === 'vtol') continue; // Harrier exhaust is the four side nozzles, never a tailpipe.
      const k = detailKit(engine, `${engName}-skin`),
        er = fighter
          ? radius * 0.45
          : s.category === 'tiltrotor'
            ? 0.64
            : props
              ? Math.min(0.66, s.width * 0.32)
              : Math.min(1.65, s.width * 0.4),
        el = fighter ? L * 0.21 : props ? Math.max(1.1, L * 0.12) : Math.max(1.4, L * 0.1);
      const pistonCowl = props && count === 1 && s.shape !== 'high-radial';
      if (pistonCowl) {
        ellipsoid(k, [0, 0, 0], [er, er * 0.64, el * 0.66], paint);
        for (const side of [-1, 1])
          ellipsoid(k, [side * er * 0.58, 0, el * 0.49], [er * 0.22, er * 0.16, 0.04], black, 16);
      } else {
        const nacelle = new T.CylinderGeometry(er, er * 0.86, el, 24, 1, true).rotateX(pi / 2);
        k.add(nacelle, paint);
        k.ring(er, 0.045, [0, 0, el / 2], metallic);
        k.ring(er * 0.86, 0.035, [0, 0, -el / 2], metallic);
        k.add(new T.CircleGeometry(er * 0.94, 24), black, [0, 0, el / 2 - 0.07]);
      }
      if (props) {
        if (!pistonCowl)
          k.add(new T.CircleGeometry(er * 0.86, 24).rotateY(pi), paint, [0, 0, -el / 2]);
        const r =
          s.category === 'tiltrotor'
            ? s.rotorDiameter / 2
            : s.propBlades >= 6
              ? Math.min(2.7, s.span * 0.069)
              : Math.min(1.65, s.span * 0.1);
        const p = group(engine, `${engName}-spinner`, [0, 0, el / 2 + 0.12]);
        propeller(
          p,
          `propeller-${i + 1}`,
          r,
          s.propBlades ?? (s.shape === 'high-radial' ? 2 : s.count > 5 ? 3 : s.count),
          'z',
          engName,
        );
      } else {
        // Inlet guide vanes and nested exhaust rings remain visible close to the aircraft.
        for (let b = 0; b < 12; b++) {
          const a = (b * pi) / 6;
          k.rod(
            [0, 0, el / 2 - 0.05],
            [Math.cos(a) * er * 0.88, Math.sin(a) * er * 0.88, el / 2 - 0.05],
            er * 0.025,
            metallic,
          );
        }
        k.add(new T.CircleGeometry(er * 0.79, 24).rotateY(pi), black, [0, 0, -el / 2 - 0.01]);
        for (let b = 0; b < 16; b++) {
          const a = (b * pi) / 8;
          k.rod(
            [Math.cos(a) * er * 0.82, Math.sin(a) * er * 0.82, -el / 2],
            [Math.cos(a) * er * 0.7, Math.sin(a) * er * 0.7, -el / 2 - 0.15],
            0.025,
            metallic,
          );
        }
      }
      if (!fighter && count > 1 && s.category !== 'tiltrotor')
        k.box([0.18, Math.abs(wingY - y), el * 0.6], [0, (wingY - y) / 2, 0], paint);
      k.finish();
      if (s.category === 'tiltrotor') {
        engine.rotation.x = -pi / 2;
        animated.push({
          node: engName,
          source: 'thrustVector',
          property: 'rotation',
          axis: 'x',
          scale: -pi / 2,
          offset: pi / 2,
          min: 0,
          max: pi / 2,
        });
      }
    }
    if (fighter) {
      const iz = L * 0.13;
      if (s.chin) {
        ellipsoid(d, [0, cy - ry * 0.8, iz], [radius * 0.78, 0.43, L * 0.08], paint);
        ellipsoid(d, [0, cy - ry * 0.85, iz + L * 0.07], [radius * 0.64, 0.31, 0.04], black);
      } else
        for (const side of [-1, 1]) {
          const x = side * radius * 0.92;
          d.box([radius * 0.7, ry * 0.94, L * 0.22], [x, cy, 0], paint);
          d.box([radius * 0.58, ry * 0.72, 0.04], [x, cy, L * 0.11 + 0.02], black);
        }
      if (s.category === 'vtol')
        for (const side of [-1, 1])
          for (const [j, z] of [-0.75, 0.8].entries()) {
            const nozzle = moving(`vector-nozzle-${side}-${j}`, [
              side * radius * 1.05,
              cy - 0.1,
              z,
            ]);
            const k = detailKit(nozzle, 'nozzle');
            k.add(new T.CylinderGeometry(0.23, 0.23, 0.38, 16, 1, true).rotateX(pi / 2), metallic);
            k.add(new T.CircleGeometry(0.2, 16).rotateY(pi), black, [0, 0, -0.2]);
            k.finish();
            animated.push({
              node: nozzle.name,
              source: 'thrustVector',
              property: 'rotation',
              axis: 'x',
              scale: -pi / 2,
              min: -pi / 2,
              max: 0,
            });
          }
    }
  }
  // Undercarriage: tires, rims, oleos, torque links, braces and doors.
  const gearNodes = [];
  if (heli && s.gear === 'skids')
    for (const side of [-1, 1]) {
      const x = side * radius * 1.15;
      d.rod([x, 0.12, -bodyL * 0.3], [x, 0.12, bodyL * 0.32], 0.055, metallic);
      d.rod([x, 0.12, bodyL * 0.32], [x, 0.3, bodyL * 0.4], 0.055, metallic);
      for (const z of [-bodyL * 0.2, bodyL * 0.19])
        d.rod([side * radius * 0.6, cy - ry * 0.7, z], [x, 0.12, z], 0.05, paint);
    }
  else {
    const taildragger = s.gear === 'taildragger',
      bicycle = s.gear === 'bicycle';
    const points = bicycle
      ? [
          [0, L * 0.22],
          [0, -L * 0.12],
          [s.span * 0.38, -0.2],
          [-s.span * 0.38, -0.2],
        ]
      : [
          [0, taildragger ? -L * 0.4 : L * 0.29],
          [radius * (large ? 1.05 : 1.3), -L * 0.08],
          [-radius * (large ? 1.05 : 1.3), -L * 0.08],
        ];
    if (s.shape === 'tandem')
      points.splice(
        0,
        points.length,
        ...[-1, 1].flatMap((side) => [
          [side * radius, bodyL * 0.25],
          [side * radius, -bodyL * 0.32],
        ]),
      );
    for (const [j, [x, z]] of points.entries()) {
      const r = large
        ? Math.max(0.27, Math.min(0.67, s.width * 0.11))
        : Math.max(0.16, Math.min(0.36, s.height * 0.074));
      const top = Math.max(r + 0.25, cy - ry * 0.45),
        g = moving(`gear-${j}`, [x, top, z]),
        k = detailKit(g, 'gear-fittings');
      k.rod([0, 0, 0], [0, -top + r, 0], 0.045, metallic);
      k.rod([0, 0, -0.25], [0, -top + r, 0], 0.025, metallic);
      const axles =
        s.category === 'cargo' && j > 0 ? (s.slug === 'c-5m' || s.slug === 'an-124' ? 4 : 2) : 1;
      for (let a = 0; a < axles; a++)
        for (const dx of large ? [-r * 0.43, r * 0.43] : [0]) {
          const at = [dx, -top + r, (a - (axles - 1) / 2) * r * 2.1];
          k.add(new T.CylinderGeometry(r, r, r * 0.55, 20).rotateZ(pi / 2), rubber, at);
          for (const side of [-1, 1])
            k.add(new T.CircleGeometry(r * 0.5, 14).rotateY((side * pi) / 2), metallic, [
              at[0] + side * r * 0.28,
              at[1],
              at[2],
            ]);
        }
      k.finish();
      if (s.gear !== 'fixed' && s.gear !== 'taildragger' && (!heli || s.gear === 'retract')) {
        gearNodes.push(g.name);
        animated.push({
          node: g.name,
          source: 'gear',
          property: 'rotation',
          axis: 'z',
          scale: (x >= 0 ? 1 : -1) * 1.35,
          offset: -(x >= 0 ? 1 : -1) * 1.35,
        });
      }
    }
  }
  // Navigation lights, antennae and small service fittings.
  d.rod([0, cy + ry, -L * 0.16], [0, cy + ry + 0.28, -L * 0.18], 0.016, accent);
  d.add(new T.SphereGeometry(0.055, 8, 6), d.red, [0, cy + ry + 0.03, -L * 0.12]);
  if (s.ramp) {
    const z = heli ? -bodyL * 0.42 : -L * 0.38,
      w = radius * 0.7;
    d.rod([-w, cy - ry * 0.66, z], [w, cy - ry * 0.66, z], 0.02, trim);
    for (const side of [-1, 1])
      d.rod([side * w, cy - ry * 0.66, z], [side * w, cy + ry * 0.1, z - 0.4], 0.015, trim);
  }
  // Original non-operational markings. No military unit insignia, sponsor logos or weapons.
  for (const side of [-1, 1]) {
    const text = d.text(
      s.slug.toUpperCase().replaceAll('-', ' '),
      [side * (radius + 0.015), cy, -bodyL * 0.18],
      Math.min(0.19, bodyL * 0.017),
      (side * pi) / 2,
      accent,
    );
    text.name = 'airframe-identification';
    d.text(
      fighter ? 'RESCUE' : 'EXIT',
      [side * (radius + 0.02), cy + 0.16, f.cabinZ - 0.82],
      0.055,
      (side * pi) / 2,
      d.ivory,
    );
  }
  d.finish();
  const interior = addAircraftCockpit(root, s, f);
  // Remove collapsed pole/end-cap triangles before export; keep deterministic finite normals.
  root.traverse((object) => {
    if (!object.isMesh) return;
    const geometry = object.geometry,
      positions = geometry.getAttribute('position'),
      indices = geometry.index;
    const kept = [],
      a = new T.Vector3(),
      b = new T.Vector3(),
      c = new T.Vector3();
    for (let i = 0; i < (indices?.count ?? positions.count); i += 3) {
      const ia = indices ? indices.getX(i) : i,
        ib = indices ? indices.getX(i + 1) : i + 1,
        ic = indices ? indices.getX(i + 2) : i + 2;
      a.fromBufferAttribute(positions, ia);
      b.fromBufferAttribute(positions, ib);
      c.fromBufferAttribute(positions, ic);
      if (b.sub(a).cross(c.sub(a)).lengthSq() > 1e-18) kept.push(ia, ib, ic);
    }
    geometry.setIndex(kept);
    geometry.computeVertexNormals();
    const normals = geometry.getAttribute('normal');
    for (let i = 0; i < normals.count; i++) {
      a.fromBufferAttribute(normals, i);
      if (a.lengthSq() < 1e-10) normals.setXYZ(i, 0, 1, 0);
    }
  });
  root.updateMatrixWorld(true);
  return {
    root,
    frame: f,
    visual: { rotors, gearNodes, flaps, ailerons, animation: { bindings: animated }, interior },
    enginePoints,
  };
}
