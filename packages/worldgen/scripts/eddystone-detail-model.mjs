/** Eddystone derivative recipe; the original offshore master recipe remains unchanged. */
import { beam } from './authored-structure-mesh.mjs';
import { ring as originalRing, shell } from './lighthouse-expansion-models.mjs';
import {
  lantern as originalLantern,
  lathe as originalLathe,
  railRing as originalRailRing,
  panel,
  transformed,
} from './lighthouse-models.mjs';
import { box, tube as originalTube } from './structure-mesh.mjs';

const gray = [0.58, 0.55, 0.46],
  pale = [0.77, 0.76, 0.69],
  dark = [0.07, 0.085, 0.09],
  red = [0.55, 0.12, 0.075];
export function buildEddystoneDetail(out, resolution = 1) {
  const subdivisions = (n) => Math.max(4, Math.round(n * resolution));
  const lathe = (o, s, p, c, n) => originalLathe(o, s, p, c, subdivisions(n));
  const ring = (o, s, y, a, b, h, c, n) => originalRing(o, s, y, a, b, h, c, subdivisions(n));
  const tube = (o, s, a, b, r, c, n) =>
    originalTube(o, s, a, b, r, c, Math.max(3, Math.round(n * resolution)));
  const railRing = (o, y, r, h, c, n) => originalRailRing(o, y, r, h, c, subdivisions(n));
  const lantern = (o, c) => originalLantern(o, { ...c, segments: subdivisions(c.segments) });
  function cagedLadder(out, y0, y1, r, angle) {
    const o = transformed(out, angle);
    for (const x of [-0.29, 0.29]) tube(o, 'metal', [x, y0, r], [x, y1, r], 0.025, dark, 8);
    for (let y = y0 + 0.15; y < y1; y += 0.29)
      tube(o, 'metal', [-0.29, y, r], [0.29, y, r], 0.025, dark, 8);
  }
  function buildDetailed(out) {
    lathe(
      out,
      'ashlar',
      [
        [0, 6.9],
        [3.8, 6.9],
        [4.1, 6.55],
      ],
      [0.34, 0.32, 0.25],
      128,
    );
    const profile = [
      [4.1, 5.52],
      [7, 5.15],
      [11, 4.62],
      [16, 4.05],
      [22, 3.62],
      [29, 3.26],
      [36, 3.1],
      [40.45, 3.18],
    ];
    const holes = [
      { angle: 0, y: 18.8, w: 1.12, h: 2.05, grid: true },
      { angle: 0, y: 25.2, w: 0.77, h: 1.3, grid: true },
      { angle: 0, y: 31.6, w: 0.72, h: 1.3, grid: true },
      { angle: 0, y: 37.4, w: 0.7, h: 1.15, grid: true },
      { angle: 1.2, y: 22.4, w: 0.68, h: 1.15, grid: true },
      { angle: 1.2, y: 28.6, w: 0.68, h: 1.15, grid: true },
      { angle: 1.2, y: 34.9, w: 0.68, h: 1.15, grid: true },
    ];
    shell(out, {
      profile,
      holes,
      slot: 'ashlar',
      color: (y) => (y < 8 ? [0.35, 0.34, 0.26] : y < 12 ? [0.5, 0.48, 0.36] : gray),
      segments: subdivisions(144),
    });
    lathe(
      out,
      'granite',
      [
        [40.35, 3.2],
        [40.75, 3.7],
        [41, 3.9],
        [41.28, 3.9],
      ],
      gray,
      128,
    );
    ring(out, 'metal', 41.25, 2.4, 4.05, 0.2, [0.19, 0.18, 0.14], 128);
    lantern(out, {
      bottom: 41.45,
      radius: 2.72,
      height: 4.05,
      color: [0.35, 0.08, 0.045],
      segments: 24,
      roofHeight: 0.75,
    });
    // Photographed dark solar apron wraps the gallery, divided into actual panel modules.
    for (let i = 0; i < 32; i++) {
      const o = transformed(out, (i * Math.PI) / 16),
        r = 3.77,
        w = 0.35;
      panel(o, 'glass', -w, w, 41.48, 43.14, r, [0.055, 0.105, 0.17]);
      for (const x of [-w, w])
        beam(o, 'metal', [x, 41.45, r + 0.03], [x, 43.18, r + 0.03], 0.045, 0.035, pale);
      for (const y of [41.47, 42.3, 43.16])
        beam(o, 'metal', [-w, y, r + 0.03], [w, y, r + 0.03], 0.035, 0.035, pale);
    }
    railRing(out, 41.4, 3.96, 1.86, dark, 48);
    // Modern above-lantern helideck with eight legs and crossed supporting steelwork.
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        b = ((i + 1) * Math.PI) / 4;
      const p = (r, y, t) => [Math.sin(t) * r, y, Math.cos(t) * r];
      beam(out, 'metal', p(3.25, 43.2, a), p(4.15, 48.5, a), 0.15, 0.15, red);
      beam(out, 'metal', p(3.25, 43.2, a), p(4.15, 48.5, b), 0.085, 0.085, red);
      beam(out, 'metal', p(3.25, 43.2, b), p(4.15, 48.5, a), 0.085, 0.085, red);
      beam(out, 'metal', p(4.15, 48.4, a), p(6.8, 48.77, a), 0.17, 0.24, dark);
    }
    lathe(
      out,
      'metal',
      [
        [48.55, 6.25],
        [48.8, 6.25],
      ],
      [0.24, 0.3, 0.26],
      64,
    );
    ring(out, 'metal', 48.8, 6.18, 6.3, 0.08, pale, 96);
    ring(out, 'metal', 48.81, 4.2, 4.32, 0.012, [0.85, 0.78, 0.2], 96);
    // H marking uses thin mesh strips, retaining a normal GLB without texture duplication.
    for (const x of [-0.85, 0.85])
      box(out, 'metal', [x - 0.14, 48.81, -1.3], [x + 0.14, 48.825, 1.3], pale);
    box(out, 'metal', [-0.85, 48.81, -0.14], [0.85, 48.825, 0.14], pale);
    for (let i = 0; i < 64; i++) {
      const a = (i * Math.PI) / 32,
        b = ((i + 1) * Math.PI) / 32,
        p = (r, y, t) => [Math.sin(t) * r, y, Math.cos(t) * r];
      tube(out, 'metal', p(6.3, 48.77, a), p(7.3, 49, a), 0.02, dark, 6);
      tube(out, 'metal', p(7.3, 49, a), p(7.3, 49, b), 0.025, dark, 6);
      if (i % 2 === 0) tube(out, 'metal', p(6.75, 48.88, a), p(6.75, 48.88, b), 0.016, dark, 6);
    }
    cagedLadder(out, 0.3, 4.2, 6.95, 0);
    // The upper door's boat-hoist attachment is separately modeled.
    const o = transformed(out, 0);
    beam(o, 'metal', [0, 20.9, 3.9], [0, 22.1, 5.8], 0.1, 0.13, dark);
    tube(o, 'metal', [0, 22.1, 5.8], [0, 18.6, 5.8], 0.015, dark, 6);
  }

  buildDetailed(out);
  // The original lathe delegates to capped loft: its helideck is already closed.
}
export function buildEddystoneOriginal(out) {
  buildEddystoneDetail(out);
}
export function buildEddystoneMaster(out) {
  buildEddystoneDetail(out);
}
export function buildEddystoneStreet(out) {
  buildEddystoneDetail(out, 0.45);
}
