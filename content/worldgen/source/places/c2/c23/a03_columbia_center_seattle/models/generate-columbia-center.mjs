/**
 * Columbia Center, Seattle (1985): three interlocking dark-glass shafts, each with one concave
 * face (west toward Elliott Bay at 280 m, southeast toward Mount Rainier at 223 m, northeast
 * toward the Cascades at 160 m), stepping down around each other on a three-storey Carnelian
 * granite podium that fills the steep block between Fourth and Fifth Avenues, Columbia and
 * Cherry Streets. Every mapped part in footprint.json is a volume here, so the model's own
 * footprint covers them. Frame: +Z faces Fourth Avenue (southwest), +X runs southeast toward
 * Cherry Street, -Z faces Fifth Avenue; the origin is the tower's plan centroid.
 */

import { readFileSync } from 'node:fs';
import { emitPlaceMaster } from '../../../../../../../../packages/worldgen/scripts/place-master-emitter.mjs';
import {
  fbox,
  opening,
  outwardRing,
  quad4,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const col = {
  glass: rgb('353b42'),
  glassLow: rgb('343a40'),
  lobby: rgb('56626c'),
  spandrel: rgb('48443f'),
  parapet: rgb('454240'),
  granite: rgb('8d6b5d'),
  graniteDark: rgb('7a5b4f'),
  roof: rgb('686560'),
  paving: rgb('8e8a84'),
  mullion: rgb('4a4b4d'),
  door: rgb('2b2f33'),
};
const surfaces = {
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.12, metallic: 0.45 },
  spandrel: { slot: 'wall', graph: 'metal_painted', roughness: 0.42, metallic: 0.35 },
  granite: { slot: 'foundation', graph: 'stone_granite', roughness: 0.55, metallic: 0 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.9, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_stainless', roughness: 0.45, metallic: 0.6 },
  door: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.3, metallic: 0.3 },
};

const frame = JSON.parse(readFileSync(new URL('../footprint.json', import.meta.url), 'utf8'));
const piece = (id) => frame.features.find((f) => f.id === id).pieces[0];

// Heights: the mapped part heights stand on Fourth Avenue's sidewalk at the tower's west face
// (the lowest public entrance), about 5 m under the ground at the anchor.
const AVE4 = -5.0;
const LOW = frame.groundRelative.min - 1;
const PODIUM_TOP = 6.4; // a little over Fifth Avenue; three storeys over Fourth
const STOREY = 3.68;
const FIRST_FLOOR = AVE4 + 12.6;

const podium = piece('35184479213120');
// Segments: outline, top, and whether its outline is a crown setback inside another segment.
const segments = [
  { name: 'northeast', ring: outwardRing(piece('35184703382703').outline), top: AVE4 + 160 },
  { name: 'southeast', ring: outwardRing(piece('35184790221352').outline), top: AVE4 + 223 },
  { name: 'southeast crown', ring: outwardRing(piece('35184790221347').outline), top: AVE4 + 226 },
  { name: 'west', ring: outwardRing(piece('35184790221357').outline), top: AVE4 + 280 },
  { name: 'west crown', ring: outwardRing(piece('35184790221349').outline), top: AVE4 + 286 },
];
const podiumRing = outwardRing(podium.outline);

const inside = ([x, z], ring) => {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i],
      [xj, zj] = ring[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit;
  }
  return hit;
};

// Ground as a plane fitted to the podium's mapped vertex heights (Cherry Street falls 17%).
const ground = (() => {
  const pts = podium.outline.map(([x, z], i) => [x, z, podium.groundAtVertices[i]]);
  const s = { n: 0, x: 0, z: 0, y: 0, xx: 0, zz: 0, xz: 0, xy: 0, zy: 0 };
  for (const [x, z, y] of pts) {
    s.n++;
    s.x += x;
    s.z += z;
    s.y += y;
    s.xx += x * x;
    s.zz += z * z;
    s.xz += x * z;
    s.xy += x * y;
    s.zy += z * y;
  }
  const m = [
    [s.n, s.x, s.z],
    [s.x, s.xx, s.xz],
    [s.z, s.xz, s.zz],
  ];
  const r = [s.y, s.xy, s.zy];
  const det = (q) =>
    q[0][0] * (q[1][1] * q[2][2] - q[1][2] * q[2][1]) -
    q[0][1] * (q[1][0] * q[2][2] - q[1][2] * q[2][0]) +
    q[0][2] * (q[1][0] * q[2][1] - q[1][1] * q[2][0]);
  const d = det(m);
  const [a, b, c] = [0, 1, 2].map(
    (k) => det(m.map((row, i) => row.map((v, j) => (j === k ? r[i] : v)))) / d,
  );
  return (x, z) => a + b * x + c * z;
})();

/** What stands just outside a wall at point p: the tallest other volume there, or the ground. */
function coverAt(p, self) {
  let top = -Infinity;
  for (const s of segments) if (s !== self && inside(p, s.ring)) top = Math.max(top, s.top);
  if (top === -Infinity && inside(p, podiumRing)) top = PODIUM_TOP;
  return top;
}

/**
 * Split edge a→b where any other outline's vertex lies on it (within the map's 0.3 m), through
 * that vertex itself, so a neighbour's wall ends exactly on this one and leaves no crack.
 */
function splitEdge(a, b, self) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    len2 = dx * dx + dz * dz;
  const cuts = [
    [0, a],
    [1, b],
  ];
  for (const ring of [...segments.filter((s) => s !== self).map((s) => s.ring), podiumRing])
    for (const v of ring) {
      const t = ((v[0] - a[0]) * dx + (v[1] - a[1]) * dz) / len2;
      if (t < 0.02 || t > 0.98) continue;
      const px = a[0] + dx * t - v[0],
        pz = a[1] + dz * t - v[1];
      if (Math.hypot(px, pz) < 0.3) cuts.push([t, v]);
    }
  cuts.sort((p, q) => p[0] - q[0] || p[1][0] - q[1][0] || p[1][1] - q[1][1]);
  const out = [];
  for (let i = 0; i + 1 < cuts.length; i++)
    if (cuts[i + 1][0] - cuts[i][0] > 0.01) out.push([cuts[i][1], cuts[i + 1][1]]);
  return out;
}

/** Curtain wall on one wall strip: glass and dark spandrel bands alternating in one plane. */
function curtain(out, a, b, y0, y1, { lobbyTo = -Infinity } = {}) {
  const P = (p, y) => [p[0], y, p[1]];
  const band = (slot, lo, hi, color) => {
    const l = Math.max(lo, y0),
      h = Math.min(hi, y1);
    if (h - l > 0.02) quad4(out, slot, P(a, l), P(b, l), P(b, h), P(a, h), color);
  };
  // Storey bands: spandrel from 0.6 under each floor line to 0.5 over it, glass between.
  let y = y0;
  for (let k = Math.floor((y0 - FIRST_FLOOR) / STOREY); y < y1; k++) {
    const floor = FIRST_FLOOR + k * STOREY;
    const sp0 = floor - 0.6,
      sp1 = floor + 0.5;
    if (sp1 <= y) continue;
    if (sp0 > y) band('glass', y, sp0, y < lobbyTo ? col.lobby : col.glass);
    band('spandrel', Math.max(sp0, y), sp1, col.spandrel);
    y = sp1;
  }
}

/** A slim vertical mullion cap proud of the glass: front, two sides and a top. */
function fin(out, F, u, y0, y1, w = 0.42, d = 0.2) {
  const a = F.P(u - w / 2, y0, 0),
    b = F.P(u + w / 2, y0, 0),
    A = F.P(u - w / 2, y0, d),
    B = F.P(u + w / 2, y0, d);
  const up = (p) => [p[0], y1, p[2]];
  quad4(out, 'metal', A, B, up(B), up(A), col.mullion);
  quad4(out, 'metal', a, A, up(A), up(a), col.mullion);
  quad4(out, 'metal', B, b, up(b), up(B), col.mullion);
  quad4(out, 'metal', up(A), up(B), up(b), up(a), col.mullion);
}

function towers(out) {
  for (const s of segments) {
    const r = s.ring;
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.05) continue;
      for (const [p, q] of splitEdge(a, b, s)) {
        const F = wallFace(p, q);
        if (F.length < 0.05) continue;
        const probe = F.P(F.length / 2, 0, 0.35);
        const cover = coverAt([probe[0], probe[2]], s);
        if (cover >= s.top) continue;
        const atGround = cover === -Infinity;
        const y0 = atGround ? LOW : cover - 0.3;
        const local = ground(probe[0], probe[2]);
        // A solid band crowns each shaft; below it the storeys run to the deck or the plaza.
        curtain(out, p, q, y0, s.top - 1.4, { lobbyTo: atGround ? local + 7.5 : -Infinity });
        quad4(
          out,
          'spandrel',
          [p[0], s.top - 1.4, p[1]],
          [q[0], s.top - 1.4, q[1]],
          [q[0], s.top, q[1]],
          [p[0], s.top, p[1]],
          col.parapet,
        );
        if (atGround)
          fbox(out, 'granite', F, 0, F.length, LOW, local + 0.45, 0, 0.12, col.graniteDark);
        // Dark mullion caps, every other one of the 1.5 m module, mid-facet on the curves.
        const n = Math.max(1, Math.round(F.length / 3.0));
        for (let k = 0; k < n; k++)
          fin(out, F, (F.length * (k + 0.5)) / n, Math.max(y0, local - 0.5), s.top - 1.4);
      }
    }
    if (
      !out.addCap(
        'roof',
        'palette:#ffffff',
        r,
        [],
        () => s.top,
        [0, 1, 0],
        (p) => p,
        col.roof,
      )
    )
      throw new Error(`${s.name}: roof triangulation failed`);
  }
}

function podiumBlock(out) {
  const r = podiumRing;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    const F = wallFace(a, b);
    if (F.length < 0.05) continue;
    // Skip the edges the northeast shaft's concave face shares with the plaza notch.
    const probe = F.P(F.length / 2, 0, -0.35);
    if (segments.some((s) => inside([probe[0], probe[2]], s.ring))) continue;
    quad4(
      out,
      'granite',
      [a[0], LOW, a[1]],
      [b[0], LOW, b[1]],
      [b[0], PODIUM_TOP, b[1]],
      [a[0], PODIUM_TOP, a[1]],
      col.granite,
    );
    // Coping and a low granite parapet round the deck.
    fbox(
      out,
      'granite',
      F,
      -0.05,
      F.length + 0.05,
      PODIUM_TOP,
      PODIUM_TOP + 1.05,
      -0.6,
      0.12,
      col.graniteDark,
      { bottom: false },
    );
    if (F.length < 7) continue;
    // Tall glazed bays between granite piers where the wall stands a storey or more clear.
    const n = Math.round(F.length / 7.4);
    for (let k = 0; k < n; k++) {
      const u = (F.length * (k + 0.5)) / n;
      const [gx, , gz] = F.P(u, 0, 0);
      const g = Math.max(ground(gx, gz), LOW + 1);
      const head = PODIUM_TOP - 2.0;
      if (head - g < 3.4) continue;
      const wide = (F.length / n) * 0.62;
      const lobby = F.normal[1] > 0.9 && Math.abs(gx - -6) < 8; // Fourth Avenue lobby
      opening(out, F, u, g + (lobby ? 0.05 : 0.6), wide, head - g - (lobby ? 0.05 : 0.6), {
        glass: lobby ? col.lobby : col.glassLow,
        frame: col.mullion,
        frameSlot: 'metal',
        frameWidth: 0.2,
        frameDepth: 0.16,
        mullions: lobby ? 3 : 2,
        transoms: head - g > 8 ? 2 : 1,
        sill: !lobby,
      });
      if (lobby) {
        // Glass doors and a projecting canopy over the Fourth Avenue entrance.
        fbox(
          out,
          'metal',
          F,
          u - wide / 2 - 0.6,
          u + wide / 2 + 0.6,
          g + 3.4,
          g + 3.75,
          0,
          3.2,
          col.mullion,
          { bottom: true },
        );
        for (const du of [-1.2, 1.2])
          opening(out, F, u + du, g + 0.05, 1.8, 2.7, {
            glass: col.door,
            glassSlot: 'door',
            frame: col.mullion,
            frameSlot: 'metal',
            frameWidth: 0.12,
            sill: false,
            d: 0.08,
          });
      }
    }
  }
  if (
    !out.addCap(
      'roof',
      'palette:#ffffff',
      r,
      [],
      () => PODIUM_TOP,
      [0, 1, 0],
      (p) => p,
      col.paving,
    )
  )
    throw new Error('podium deck triangulation failed');
}

/** Fifth Avenue entrance: a glass canopy at the foot of the northeast shaft's concave face. */
function fifthAvenueEntrance(out) {
  const arc = piece('35184703382703').outline;
  const i0 = arc.findIndex(([x, z]) => Math.abs(x - -9.31) < 0.05 && Math.abs(z - -17.91) < 0.05);
  const a = arc[i0],
    b = arc[i0 + 1];
  // Ring order in the mapped outline runs the other way round; face the plaza.
  const F = wallFace(b, a);
  const mid = F.P(F.length / 2, 0, 0);
  const g = ground(mid[0], mid[2]);
  fbox(out, 'metal', F, -3, F.length + 3, g + 4.6, g + 4.95, 0, 3.6, col.mullion, { bottom: true });
  for (const du of [-1.0, 1.0])
    opening(out, F, F.length / 2 + du, g, 1.8, 2.8, {
      glass: col.door,
      glassSlot: 'door',
      frame: col.mullion,
      frameSlot: 'metal',
      frameWidth: 0.12,
      sill: false,
      d: 0.08,
    });
}

await emitPlaceMaster({
  generator: import.meta.url,
  planId: 'A03',
  title: 'Columbia Center, Seattle',
  wikidataId: 'Q908703',
  brief:
    "Seattle's tallest building (1985): three interlocking shafts of near-black smoked glass banded by dark metal spandrels, each with one concave face (west at 280 m, southeast at 223 m, northeast at 160 m) stepping down around one another, with setback crowns, on a three-storey Carnelian granite podium that fills the steep block between Fourth and Fifth Avenues, with the Fourth Avenue lobby and canopy and the Fifth Avenue plaza entrance under the northeast face.",
  surfaces,
  smooth: { glass: 24, spandrel: 24 },
  build(out) {
    podiumBlock(out);
    towers(out);
    fifthAvenueEntrance(out);
  },
  dimensions: [
    {
      fact: 'Plan: mapped OSM parts 35184790221357 (280 m) with its crown 35184790221349 (286 m), 35184790221352 (223 m) with its crown 35184790221347 (226 m), 35184703382703 (160 m) and the podium 35184479213120 (14 m); heights stand on the Fourth Avenue sidewalk',
      source: 'footprint.json',
    },
    {
      fact: '76 floors above ground; architectural height 284 m (933 ft), roof 286 m (937 ft); three concave facades with two setbacks so it reads as three towers side by side; base clad in Rosa Purino Carnelian granite; Fifth Avenue is higher than Fourth and Cherry Street beside it slopes 17.1%',
      source: 'https://en.wikipedia.org/wiki/Columbia_Center',
    },
    {
      fact: 'Three large arcs placed back to back, facing west, south and east toward Elliott Bay, Mount Rainier and the Cascades; dark coloration; the block bounded by Fourth and Fifth Avenues, Columbia and Cherry Streets',
      source: 'https://pcad.lib.washington.edu/building/4218/',
    },
    {
      fact: 'Three curved volumes with their concave facades facing outward, each a different height; dark glass with dark metal spandrels giving a subtle horizontal stripe; the three lower levels clad in pink granite',
      source: 'https://buildingsdb.com/WA/seattle/columbia-center/',
    },
    {
      fact: 'Clad in smoked tempered glass and Carnelian granite; dark, concave facade enhanced by setbacks',
      source:
        'https://skyrisecities.com/news/2016/10/seattles-granite-king-views-columbia-center.23274',
    },
  ],
  limitations: [
    'Segment heights are the mapped part heights over the Fourth Avenue sidewalk (5 m under the anchor); the published 284/286 m top is within 2 m of the crown here. Rooftop equipment and the 295 m tip are not modelled.',
    'Plan curves follow the mapped outlines (about 0.3 m tile precision), with smoothed normals on the curved glass; the setback crowns are the mapped inner parts.',
    'The curtain wall is one glass face per wall with a spandrel band per 3.68 m storey; vertical mullions (about 1.5 m apart, under the closeup error) are not drawn.',
    'The podium deck height, its window bays, the Fourth Avenue canopy and the Fifth Avenue entrance are estimated; the podium deck is drawn as plain paving and the underground concourse is omitted.',
  ],
});
