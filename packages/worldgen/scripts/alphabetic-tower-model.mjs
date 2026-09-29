/** Original Alphabetic Tower exterior; source photographs remain reference-only. */

import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { beam, loft, radialRing, sphere } from './authored-structure-mesh.mjs';
import { annulus, face, tau, triangle } from './heritage-tower-detail-mesh.mjs';
import { box } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

function inside(p, ring) {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      yes = !yes;
  }
  return yes;
}
function glyph(out, data, angle, y, r) {
  const all = data.contours.flat(),
    lo = [Math.min(...all.map((p) => p[0])), Math.min(...all.map((p) => p[1]))],
    hi = [Math.max(...all.map((p) => p[0])), Math.max(...all.map((p) => p[1]))];
  const scale = Math.min(5.7 / (hi[1] - lo[1]), 6 / (hi[0] - lo[0]));
  const rings = data.contours.map((c) =>
    c.map(([x, yy]) => [(x - (lo[0] + hi[0]) / 2) * scale, (yy - (lo[1] + hi[1]) / 2) * scale]),
  );
  const levels = rings.map((ring, i) =>
    rings.reduce((n, other, j) => n + (i !== j && inside(ring[0], other) ? 1 : 0), 0),
  );
  const p = ([x, yy], depth) => {
    const a = angle + x / r;
    return [Math.sin(a) * (r + depth), y + yy, Math.cos(a) * (r + depth)];
  };
  for (let i = 0; i < rings.length; i++) {
    if (levels[i] % 2) continue;
    const contours = [
      rings[i],
      ...rings.filter((ring, j) => levels[j] === levels[i] + 1 && inside(ring[0], rings[i])),
    ];
    const flat = contours.flat(),
      holes = [];
    let count = contours[0].length;
    for (const c of contours.slice(1)) {
      holes.push(count);
      count += c.length;
    }
    const ids = earcut(flat.flat(), holes);
    for (let j = 0; j < ids.length; j += 3) {
      const pts = ids.slice(j, j + 3).map((k) => flat[k]);
      const area =
        (pts[1][0] - pts[0][0]) * (pts[2][1] - pts[0][1]) -
        (pts[1][1] - pts[0][1]) * (pts[2][0] - pts[0][0]);
      if (Math.abs(area) < 1e-7) continue;
      if (area < 0) pts.reverse();
      triangle(
        out,
        'metal',
        pts.map((q) => p(q, 0.22)),
        [0.94, 0.94, 0.89],
      );
      triangle(
        out,
        'metal',
        pts.toReversed().map((q) => p(q, 0)),
        [0.67, 0.68, 0.65],
      );
    }
    for (const ring of contours)
      for (let j = 0; j < ring.length; j++) {
        const a = ring[j],
          b = ring[(j + 1) % ring.length];
        if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-4) continue;
        face(out, 'metal', [p(a, 0), p(b, 0), p(b, 0.22), p(a, 0.22)], [0.7, 0.72, 0.7]);
      }
  }
}

function buildAlphabet(out) {
  const steel = [0.83, 0.86, 0.86],
    dark = [0.25, 0.3, 0.32],
    base = [0.61, 0.62, 0.6],
    R = 14.94;
  const p = (a, y, r = R) => [Math.sin(a) * r, y, Math.cos(a) * r];
  const phase = Math.PI / 12;
  loft(
    out,
    'concrete',
    [
      radialRing(0, 15.35, 15.35, 12, [0, 0], phase),
      radialRing(0.75, 15.35, 15.35, 12, [0, 0], phase),
    ],
    base,
  );
  // Twelve primary columns follow the mapped twelve-sided footprint.
  for (let i = 0; i < 12; i++) {
    const a = phase + (i * tau) / 12;
    beam(out, 'metal', p(a, 0.75), p(a, 116), 0.42, 0.42, steel);
    for (let j = 0; j < 12; j++) {
      const y = 1 + j * 9.55,
        top = y + 9.55,
        b = a + tau / 12;
      beam(out, 'metal', p(a, y), p(b, top), 0.18, 0.18, steel);
      beam(out, 'metal', p(b, y), p(a, top), 0.18, 0.18, steel);
      beam(out, 'metal', p(a, y), p(b, y), 0.18, 0.18, steel);
    }
    box(
      out,
      'concrete',
      [Math.sin(a) * R - 0.65, 0.74, Math.cos(a) * R - 0.65],
      [Math.sin(a) * R + 0.65, 1.14, Math.cos(a) * R + 0.65],
      base,
    );
  }
  // Central glazed lift/stair core and its visible steel mullions.
  loft(
    out,
    'glass',
    [radialRing(0.75, 3.65, 3.65, 12), radialRing(112, 3.65, 3.65, 12)],
    [0.11, 0.18, 0.2],
  );
  for (let i = 0; i < 12; i++) {
    const a = (i * tau) / 12;
    beam(out, 'metal', p(a, 0.75, 3.7), p(a, 112, 3.7), 0.15, 0.15, dark);
    for (let y = 2; y < 112; y += 3.8)
      beam(out, 'metal', p(a, y, 3.71), p(a + tau / 12, y, 3.71), 0.11, 0.12, steel);
  }
  // Open double helix mesh bands: the interior steel lattice stays visible through their wire grids.
  const turns = 1.85,
    start = 4.0,
    r = 15.12,
    span = 102;
  for (let strand = 0; strand < 2; strand++) {
    const a0 = phase + strand * Math.PI,
      segments = 360;
    const at = (t, offset = 0) => p(a0 + t * tau * turns, start + t * span + offset, r);
    for (let i = 0; i < segments; i++) {
      const t = i / segments,
        u = (i + 1) / segments;
      for (const yy of [-3.05, 3.05]) beam(out, 'metal', at(t, yy), at(u, yy), 0.16, 0.19, dark);
      // Fine open sheet-metal mesh retains the dark, continuous ribbon silhouette seen
      // in the tourism overview while preserving real gaps between individual wires.
      const wire = [0.27, 0.3, 0.31];
      const sheet = (a, b, c, d) => {
        triangle(out, 'metal', [a, b, c], wire);
        triangle(out, 'metal', [a, c, d], wire);
        triangle(out, 'metal', [c, b, a], wire);
        triangle(out, 'metal', [d, c, a], wire);
      };
      for (let row = 0; row < 23; row++) {
        const yy = -3.02 + row * 0.27;
        sheet(at(t, yy), at(u, yy), at(u, yy + 0.085), at(t, yy + 0.085));
      }
      const dt = 0.09 / (tau * turns * r);
      sheet(at(t, -3.05), at(t + dt, -3.05), at(t + dt, 3.05), at(t, 3.05));
    }
    // Short radial brackets tie the sign ribbon to the structural cylinder.
    for (let i = 0; i <= 36; i++) {
      const t = i / 36,
        a = a0 + t * tau * turns,
        y = start + t * span;
      beam(out, 'metal', p(a, y, R - 0.4), p(a, y, r), 0.12, 0.12, steel);
    }
  }
  const letters = JSON.parse(
    readFileSync(structureSourcePath('n0582_alphabetic_tower', 'reference-metadata.json'), 'utf8'),
  ).letters;
  for (let i = 0; i < 33; i++) {
    const strand = i < 17 ? 0 : 1,
      k = strand ? i - 17 : i,
      n = strand ? 16 : 17,
      t = (k + 0.45) / n;
    glyph(out, letters[i], phase + strand * Math.PI + t * tau * turns, start + t * span, r + 0.04);
  }
  // The glazed globe is individually triangulated, matching the fabricator’s space frame.
  const center = 115.1,
    rx = 14.94,
    ry = 14.9,
    rows = 18,
    sides = 36;
  const globe = (j, i) => {
    const lat = -Math.PI / 2 + (j / rows) * Math.PI,
      a = (i * tau) / sides + (j % 2 ? tau / sides / 2 : 0);
    return [
      Math.sin(a) * Math.cos(lat) * rx,
      center + Math.sin(lat) * ry,
      Math.cos(a) * Math.cos(lat) * rx,
    ];
  };
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < sides; i++) {
      const a = globe(j, i),
        b = globe(j, i + 1),
        c = globe(j + 1, i),
        d = globe(j + 1, i + 1),
        tint = (i * 7 + j * 3) % 9;
      const color = [0.2 + tint * 0.015, 0.37 + tint * 0.012, 0.46 + tint * 0.014];
      if (j > 0) triangle(out, 'glass', [a, b, c], color);
      if (j < rows - 1) triangle(out, 'glass', [b, d, c], color);
      if (j > 0) beam(out, 'metal', a, b, 0.07, 0.08, steel);
      beam(out, 'metal', a, c, 0.07, 0.08, steel);
      if (j < rows - 1) beam(out, 'metal', b, c, 0.07, 0.08, steel);
    }
  // Observation balcony at the globe springing and its transparent-looking open rail.
  annulus(out, 'metal', 11.6, 15.17, 104.65, 105.05, dark, 96);
  for (let i = 0; i < 96; i++) {
    const a = (i * tau) / 96,
      b = ((i + 1) * tau) / 96;
    beam(out, 'metal', p(a, 105.05, 15.1), p(a, 106.15, 15.1), 0.04, 0.04, steel);
    beam(out, 'metal', p(a, 106.15, 15.1), p(b, 106.15, 15.1), 0.06, 0.06, steel);
  }
  // Ground-level lift doors and a shallow entrance threshold; landscaping remains map-owned.
  box(out, 'metal', [-2, 0.75, 3.6], [2, 3.7, 3.86], steel);
  for (const s of [-1, 1])
    box(
      out,
      'glass',
      [s > 0 ? 0.05 : -1.82, 0.92, 3.87],
      [s > 0 ? 1.82 : -0.05, 3.48, 3.91],
      [0.12, 0.2, 0.23],
    );
  for (let i = 0; i < 5; i++)
    box(
      out,
      'concrete',
      [-3.2, i * 0.15, 4.4 + i * 0.38],
      [3.2, (i + 1) * 0.15, 4.78 + i * 0.38],
      base,
    );
}

export const alphabeticTower = {
  id: 'n0582_alphabetic_tower',
  planId: 'N0582',
  title: 'Alphabetic Tower',
  wikidata: 'Q18822753',
  build: buildAlphabet,
  authoringFile: 'alphabetic-tower-model.mjs',
  brief:
    'Batumi’s 130 m language monument: twelve exposed steel columns and cross braces, a central glazed lift core, two open helical mesh ribbons bearing all thirty-three distinct Georgian letters, an observation balcony and a triangulated blue glass globe.',
  size: [31, 130, 31],
  front: 'Mapped twelve-column axis; the circular plan has no single principal facade',
  origin: 'Exact mapped tower center at ground Y=0',
  refs: [
    'https://georgia.travel/alphabetic-tower',
    'https://visitbatumi.com/en/monuments-951/alphabet-tower',
    'https://storage.georgia.travel/images/alphabetic-tower-gnta.webp',
    'https://anro.es/nuestros-proyectos-en-georgia/',
    'https://miarpe2008.com/torre-alphabetic-tower',
    'https://miarpe2008.com/wp-content/uploads/2018/07/alphabetic-tower-galeria2-1024x576.jpg',
    'https://miarpe2008.com/wp-content/uploads/2018/07/alphabetic-tower-galeria1-1024x576.jpg',
    'https://github.com/google/fonts/tree/main/ofl/notosansgeorgian',
    'https://www.openstreetmap.org/way/405852444',
  ],
  facts: {
    heightMeters: 130,
    baseDiameterMeters: 30,
    alphabetLetters: 33,
    primaryColumns: 12,
    helicalRibbons: 2,
    architect: 'Alberto Domingo Cabo',
    completed: 2011,
  },
  scaleBasis:
    'Georgian national and regional tourism sources publish 130 m height and thirty-three letters; steel fabricator ANRO publishes a 30 m base. Their current whole-tower photograph and glazing-contractor construction/roof photographs establish the open twelve-column frame, wire ribbons and triangular glass globe. Every letter is static extruded geometry derived from licensed Noto Sans Georgian outlines; font provenance and OFL text are preserved in reference-metadata.json.',
  geographicProposal: {
    anchor: [41.639350155, 41.655962931],
    heading: -0.271883819375,
    source: 'https://www.openstreetmap.org/way/405852444',
    evidence:
      'The exact-identity twelve-sided outline sets center, diameter and column axes. The cylindrical tower is rotationally symmetric at the structural-grid interval; the asymmetric helical letter phase follows the primary overview photograph, with no ground-facing facade claim.',
    orientationConfidence: 'exact-twelve-sided-structural-grid',
    limitations:
      'The primary sources establish the helix rhythm and full alphabet but do not publish fabrication station coordinates for every letter. The letter sequence is reconstructed along the two ribbons; the small ground threshold is a local reconstruction.',
  },
  limits: [
    'Thirty-three separate readable Georgian glyphs are represented using the openly licensed Noto Sans Georgian design. They are a typographic reconstruction, not copied fabrication CAD for the original sculptures.',
    'The observed open steel structure and outer globe are complete. Rotating restaurant motion, interior furniture and seasonal light shows are not part of this static exterior asset.',
  ],
  cameras: [
    { name: 'alphabet-ribbons', position: [37, 49, 43], lookAt: [0, 46, 0] },
    { name: 'globe-diagrid', position: [42, 127, 44], lookAt: [0, 116, 0] },
    { name: 'open-steel-base', position: [31, 19, 37], lookAt: [0, 18, 0] },
    { name: 'upper-balcony', position: [36, 108, -45], lookAt: [0, 103, 0] },
    { name: 'far-silhouette', position: [165, 83, 210], lookAt: [0, 64, 0] },
  ],
};
