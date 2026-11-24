import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { deform } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import {
  facade,
  fbox,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { lettering } from '../../../../../../../../packages/worldgen/scripts/stadium-lettering.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  wall: { slot: 'wall', graph: 'metal_standing_seam', roughness: 0.91 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.84 },
  base: { slot: 'foundation', graph: 'concrete_panel', roughness: 0.94 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.79 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.46 },
};
const cladding = rgb('c0c8c7'),
  white = rgb('dce2de'),
  fascia = rgb('b9c4c3');
const baseColor = rgb('a8a79b'),
  shade = rgb('666d6c'),
  glass = rgb('465961'),
  lightGlass = rgb('6c8186');
const trim = rgb('bfc7c3'),
  dark = rgb('666e68');
const { sill, foundationBottom } = site;
const c = Math.cos(site.rotation),
  s = Math.sin(site.rotation);
const toWorld = ([x, y, z]) => [x * c + z * s, y, z * c - x * s];

function heightAt(band, x) {
  const f = Math.max(0, Math.min(1, (x - band.west) / (band.east - band.west)));
  return band.eave + (band.crown - band.eave) * (1 - f * f);
}

function triangulate(out, ring, band) {
  const q = new MeshBufferBuilder();
  if (
    !q.addCap(
      'roof',
      '',
      ring,
      [],
      () => 0,
      [0, 1, 0],
      (p) => p,
      white,
    )
  )
    throw new Error('Wave roof strip could not be triangulated');
  const { positions, indices } = q.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const p = Array.from(indices.slice(i, i + 3), (j) => {
      const x = positions[j * 3],
        z = positions[j * 3 + 2];
      return [x, heightAt(band, x), z];
    });
    tri(out, 'roof', ...p, white);
  }
}

function podium(out, detail) {
  const outline = outwardRing(site.plan);
  for (const [i, pt] of outline.entries()) {
    const f = wallFace(pt, outline[(i + 1) % outline.length]);
    if (detail === 0)
      quad4(
        out,
        'base',
        f.P(0, foundationBottom),
        f.P(f.length, foundationBottom),
        f.P(f.length, sill),
        f.P(0, sill),
        baseColor,
      );
    else fbox(out, 'base', f, 0, f.length, foundationBottom, sill, -0.21, 0, baseColor);
    if (detail > 0) {
      fbox(out, 'trim', f, 0, f.length, sill - 0.29, sill - 0.07, -0.021, 0.075, fascia);
      if (detail > 1 && f.normal[0] > 0.52 && f.length > 7) {
        const count = Math.round(f.length / 2.65);
        const step = f.length / count;
        for (let i = 0; i < count; i++) {
          const u = i * step + 0.45;
          fbox(out, 'glazing', f, u, u + step * 0.59, 0.76, sill - 0.32, 0, 0.04, shade);
        }
      }
    }
  }
}

function shellWall(out, f, band, detail) {
  const P = f.P,
    leading = f.normal[0] > 0.97,
    across = Math.abs(f.normal[0]) < 0.86;
  const small = band.west > 10;
  const count = Math.max(1, Math.ceil(f.length / [5.9, 4.25, 2.81, 1.72][detail]));
  const step = f.length / count,
    height = (u) => heightAt(band, P(u, 0)[0]) - 0.018;
  for (let i = 0; i < count; i++) {
    const a = i * step,
      b = (i + 1) * step,
      ha = height(a),
      hb = height(b),
      x = P((a + b) / 2, 0)[0];
    const crest = (x - band.west) / (band.east - band.west);
    const pane = (leading && (small || !across)) || (across && crest < 0.29);
    const color = pane ? (small ? lightGlass : glass) : cladding;
    const k =
      detail === 3 || (detail === 2 && pane)
        ? color.map((v) => v * (0.98 + ((i * 7) % 4) * 0.014))
        : color;
    quad4(
      out,
      pane ? 'glazing' : 'wall',
      P(a, sill, 0),
      P(b, sill, 0),
      P(b, hb, 0),
      P(a, ha, 0),
      k,
    );
    if (detail === 0) continue;
    const overhang = across ? 0.78 : 0.31;
    quad4(
      out,
      'roof',
      P(a, ha + 0.017, overhang),
      P(b, hb + 0.017, overhang),
      P(b, hb + 0.017, 0),
      P(a, ha + 0.017, 0),
      white,
    );
    if (detail > 1)
      quad4(
        out,
        'trim',
        P(a, ha - 0.24, overhang),
        P(b, hb - 0.24, overhang),
        P(b, hb + 0.018, overhang),
        P(a, ha + 0.018, overhang),
        fascia,
      );
    if (detail > 0) {
      if (pane) {
        fbox(out, 'trim', f, a - 0.045, a + 0.045, sill + 0.016, ha - 0.07, -0.025, 0.073, trim);
        const pitch = detail === 3 ? 2.74 : 3.95;
        if (detail > 1)
          for (let y = sill + pitch; y < Math.min(ha, hb) - 0.43; y += pitch)
            fbox(out, 'trim', f, a, b, y - 0.044, y + 0.044, -0.024, 0.05, trim);
      } else if (detail > 1 && across) {
        fbox(out, 'trim', f, a - 0.019, a + 0.019, sill + 0.021, ha - 0.16, -0.009, 0.048, fascia);
      }
      if (detail > 1 && across)
        fbox(out, 'trim', f, a - 0.044, a + 0.044, ha - 0.43, ha - 0.24, -0.025, overhang, trim);
    }
  }
}

function shells(out, detail) {
  for (const band of site.roofs) {
    for (const ring of band.sections[detail]) triangulate(out, ring, band);
    for (const outline of band.outlines) {
      const ring = outwardRing(outline);
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i],
          b = ring[(i + 1) % ring.length];
        if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 0.017)
          shellWall(out, wallFace(a, b), band, detail);
      }
    }
  }
}

function entrances(out, detail) {
  for (const { point, wall, grade, width } of site.entrances) {
    const edge = wallFace(...wall),
      f = facade(point, edge.along);
    const w = width / 2,
      y = grade + 3.54;
    fbox(out, 'base', f, -w - 0.39, w + 0.39, foundationBottom, grade, -0.41, 1.35, baseColor);
    fbox(out, 'glazing', f, -w + 0.22, w - 0.22, grade, y, 0.012, 0.044, glass);
    fbox(out, 'trim', f, -w - 0.43, w + 0.43, y - 0.16, y + 0.088, -0.07, 2.31, white, true);
    for (const u of [-w, 0, w])
      fbox(out, 'trim', f, u - 0.058, u + 0.058, grade, y, 0.04, 0.18, trim);
    if (detail > 1)
      for (const u of [-w + 0.17, w - 0.17])
        fbox(out, 'trim', f, u - 0.065, u + 0.065, grade, y - 0.16, 1.75, 1.88, trim);
  }
}

function wordmark(out, detail) {
  if (detail < 2) return;
  const p = [18.13, 7.73],
    f = facade(p, [0, -1]);
  fbox(out, 'base', f, -21.2, 21.2, 5.52, 7.29, -0.21, 0.18, baseColor);
  const text = 'NATIONAL MARITIME MUSEUM',
    width = 35;
  const z = 0.24,
    h = 0.95,
    y = 5.94;
  const p2 = (p) => f.P(...p);
  const applied = deform(out, p2);
  lettering(applied, text.replace(/[OU]/g, ' '), {
    width,
    height: h,
    y,
    z,
    slot: 'trim',
    color: dark,
    stroke: 0.071,
  });
  for (let i = 0; i < text.length; i++) {
    const square = text[i] === 'O';
    if (!square && text[i] !== 'U') continue;
    const glyph = square
      ? [
          [0.02, 0.2],
          [0.26, 0.01],
          [0.74, 0.01],
          [0.96, 0.2],
          [0.96, 0.8],
          [0.74, 0.99],
          [0.26, 0.99],
          [0.02, 0.8],
          [0.02, 0.2],
        ]
      : [
          [0.04, 1],
          [0.04, 0.25],
          [0.27, 0.012],
          [0.73, 0.012],
          [0.93, 0.25],
          [0.93, 1],
        ];
    beamPath(
      out,
      'trim',
      glyph.map(([a, b]) =>
        f.P(((i - text.length / 2 + a * 0.74) * width) / text.length, y + b * h, z),
      ),
      0.071,
      0.071,
      dark,
    );
  }
}

function build(out, detail) {
  const local = deform(out, toWorld);
  podium(local, detail);
  shells(local, detail);
  entrances(local, detail);
  wordmark(local, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
