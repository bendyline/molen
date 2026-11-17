import {
  areaSign,
  bands,
  block,
  closed,
  edge,
  opening,
  pairs,
  palette,
  panel,
  pavilion,
  shell,
  surface,
  trimBlock,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  poured: surface('wall', 'concrete_boardformed', 0.92),
  frame: surface('trim', 'concrete_plain', 0.88),
  lintel: surface('trim', 'metal_painted', 0.79, 0.04),
  roof: surface('roof', 'concrete_panel', 0.94),
  glass: surface('window', 'window_grid', 0.63, 0.02),
};
const c = palette({
  concrete: 'aaa69a',
  frame: 'beb9aa',
  shadow: '8c8b81',
  glass: '626f72',
  roof: 'adaaa0',
  cap: 'c2bdb0',
  service: '848782',
  stain: '969790',
});
function draw(out, lod, plan, grade) {
  const roof = plan.roof;
  const outline = plan.footprint,
    sign = areaSign(outline);
  shell(out, outline, (p) => grade(p) - 0.63, roof, {
    wall: 'poured',
    roof: 'roof',
    color: c.concrete,
    roofColor: c.roof,
  });
  for (const [[a, b], i] of pairs(closed(outline)).map((p, i) => [p, i])) {
    const w = edge(a, b, sign);
    const joined = i >= 14 || i === 0;
    if (joined || w.length < 0.4) continue;
    const low = Math.max(grade(a), grade(b));
    // The real slab edges carry shadows over the recessed glazing.
    trimBlock(out, 'frame', w, 0, w.length, roof - 0.24, roof + 0.14, -0.06, 0.47, c.cap);
    if (w.length < 4.2) continue;
    trimBlock(out, 'frame', w, 0, w.length, 6.58, 7.3, -0.05, lod === 0 ? 0.33 : 0.81, c.frame);
    trimBlock(out, 'frame', w, 0, w.length, 10.16, 10.65, -0.03, lod === 0 ? 0.22 : 0.44, c.frame);
    const openingStart = 0.77,
      openingEnd = w.length - 0.79;
    const top = 6.28;
    const bottom = Math.max(1.62, low + 0.75);
    if (bottom + 1.2 < top) {
      panel(
        out,
        'poured',
        w,
        openingStart - 0.18,
        openingEnd + 0.18,
        bottom - 0.18,
        top + 0.11,
        0.03,
        c.shadow,
      );
      panel(out, 'glass', w, openingStart, openingEnd, bottom, top, 0.048, c.glass);
      if (lod > 0) {
        const n = Math.max(2, Math.ceil((openingEnd - openingStart) / 2.25));
        for (let k = 1; k < n; k++) {
          const u = openingStart + ((openingEnd - openingStart) * k) / n;
          panel(out, 'lintel', w, u - 0.034, u + 0.034, bottom, top, 0.067, c.service);
        }
        bands(
          out,
          w,
          openingStart,
          openingEnd,
          [
            [bottom + 0.03, bottom + 0.11],
            [4.56, 4.65],
            [top - 0.1, top - 0.015],
          ],
          'lintel',
          c.service,
          0.07,
        );
      }
    }
    if (lod > 0) {
      const upperStart = w.length * 0.19,
        upperEnd = w.length * 0.81;
      panel(out, 'poured', w, upperStart - 0.11, upperEnd + 0.11, 10.78, 11.96, 0.034, c.shadow);
      panel(out, 'glass', w, upperStart, upperEnd, 10.91, 11.8, 0.052, c.glass);
      if (lod > 1) {
        const n = Math.max(2, Math.ceil((w.length * 0.62) / 2.9));
        for (let k = 1; k < n; k++) {
          const u = upperStart + ((upperEnd - upperStart) * k) / n;
          panel(out, 'lintel', w, u - 0.044, u + 0.044, 10.87, 11.89, 0.074, c.service);
        }
      }
    }
    if (lod === 3) {
      const n = Math.max(1, Math.floor(w.length / 3.7));
      for (let k = 1; k < n; k++) {
        const x = (k * w.length) / n;
        panel(out, 'poured', w, x - 0.011, x + 0.011, 7.39, 9.97, 0.031, c.stain);
      }
    }
    if (i === 11 && lod > 0) {
      const mid = w.length * 0.49;
      opening(
        out,
        w,
        mid - 1.08,
        mid + 1.08,
        low + 0.27,
        low + 3.2,
        'lintel',
        c.glass,
        'glass',
        c.service,
        lod,
        0.091,
      );
      trimBlock(
        out,
        'frame',
        w,
        mid - 1.84,
        mid + 1.84,
        low + 3.12,
        low + 3.42,
        -0.08,
        1.35,
        c.frame,
      );
    }
  }
  block(out, 'roof', 3.6, roof - 0.02, -5.8, 9.8, 0.79, 7.4, c.shadow);
  block(out, 'roof', 5.2, roof - 0.03, 18.3, 5.0, 0.49, 5.9, c.shadow);
  if (lod === 3)
    for (const x of [7.2, 9.9, 12.2])
      block(out, 'lintel', x, roof + 0.76, -1.6, 0.62, 0.52, 0.46, c.service);
}

export const { model, skyline, district, street, closeup } = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [-48, 27, -54],
    lookAt: [5, 5, 17],
    yaw: -0.8,
    sun: [-470, 510, -350],
    views: [
      { name: 'avenue-du-musee-concrete-terraces', position: [50, 11, -32], lookAt: [10, 6, 3] },
      { name: 'roof-and-hornstein-party-wall', position: [-32, 30, 71], lookAt: [8, 5, 21] },
    ],
    brief:
      'Fred Lebensold’s 1976 Stewart Pavilion, a connected Brutalist addition with horizontal concrete slabs and recessed gallery glazing.',
  },
  draw,
);
