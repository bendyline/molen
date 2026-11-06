/** Original named OSM wall path; dimensions and historical continuity remain estimates. */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => 'sha256:' + createHash('sha256').update(b).digest('hex');
export const litoralPerimeterCases = {
  'litoral-primary-original-osm-whole-perimeter-wall-2023': 'litoral_perimeter_wall',
};
export function inspectLitoralPerimeterPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const safe = (p) =>
      typeof p === 'string' && !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..');
    if (
      litoralPerimeterCases[proof.case] !== P.model ||
      P.kind !== 'litoral-perimeter-wall' ||
      P.parentModelIdentity !== 'litoral_penitentiary'
    )
      return fail('litoral-perimeter-identity-invalid');
    const n = proof.nativeIdentity;
    if (!safe(n?.path)) return fail('litoral-perimeter-native-path-invalid');
    const bytes = fs.readFileSync(path.join(dir, n.path)),
      data = JSON.parse(bytes),
      wall = data.wall;
    if (
      hash(bytes) !== n.sha256 ||
      n.sha256 !== P.numericalRecordHash ||
      n.featureId !== 'osm:way/46012320' ||
      P.nativeSourceId !== n.featureId ||
      wall.id !== '46012320' ||
      wall.tags.name !== 'Penitenciaría del Litoral' ||
      wall.tags.barrier !== 'wall' ||
      wall.tags.amenity !== 'prison' ||
      wall.tags.wikidata !== 'Q108830348'
    )
      return fail('litoral-perimeter-native-record-unbound');
    if (!safe(data.originalResponsePath)) return fail('litoral-perimeter-original-path-invalid');
    const raw = fs.readFileSync(path.join(dir, data.originalResponsePath));
    if (
      hash(raw) !== 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07' ||
      hash(raw) !== data.originalResponseHash ||
      data.sourceUrl !==
        'https://api.openstreetmap.org/api/0.6/map?bbox=-79.947,-2.055,-79.941,-2.049' ||
      f.sourceUrl !== data.sourceUrl
    )
      return fail('litoral-perimeter-original-response-unbound');
    const xml = raw.toString(),
      originalWay = xml.match(/<way\b[^>]*\bid="46012320"[^>]*>([\s\S]*?)<\/way>/)?.[1],
      ids = [...originalWay.matchAll(/<nd ref="(\d+)"\s*\/>/g)].map((m) => m[1]);
    if (
      ids.length !== 9 ||
      ids[0] !== ids[8] ||
      JSON.stringify(ids) !== JSON.stringify(wall.nodes) ||
      wall.missingNodes.length
    )
      return fail('litoral-perimeter-original-path-incomplete');
    const node = (id) => {
      const m = xml.match(new RegExp('<node\\b[^>]*\\bid="' + id + '"[^>]*>'));
      const a = Object.fromEntries(
        [...m[0].matchAll(/([\w:]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]),
      );
      return [Number(a.lon), Number(a.lat)];
    };
    const geo = ids.map(node);
    if (
      JSON.stringify(geo) !== JSON.stringify(wall.coordinates) ||
      P.nativeRing.length !== 8 ||
      JSON.stringify(P.nativeRing) !== JSON.stringify(f.geometry.polygons[0])
    )
      return fail('litoral-perimeter-original-controls-changed');
    const anchor = [0, 1].map((k) => geo.slice(0, -1).reduce((s, p) => s + p[k] / 8, 0)),
      D = (6378137 * Math.PI) / 180,
      co = Math.cos((anchor[1] * Math.PI) / 180),
      local = (p) => [(p[0] - anchor[0]) * D * co, -(p[1] - anchor[1]) * D];
    if (
      f.heading !== 0 ||
      anchor.some((v, k) => Math.abs(v - f.anchor[k]) > 1e-10) ||
      geo
        .slice(0, -1)
        .some((p, i) => local(p).some((v, k) => Math.abs(v - P.nativeRing[i][k]) > 1e-7))
    )
      return fail('litoral-perimeter-original-body-moved');
    const gate = data.gate,
      g = node('11224443220');
    if (
      gate.id !== '11224443220' ||
      JSON.stringify(gate.coordinate) !== JSON.stringify(g) ||
      gate.projectionDistanceMeters > 1.21 ||
      gate.projectedWallEdge !== 4 ||
      P.gate.edge !== 4 ||
      P.gate.width !== 6 ||
      P.gate.height !== 4.5 ||
      JSON.stringify(P.gate.projectionLocal) !== JSON.stringify(gate.projectionLocal)
    )
      return fail('litoral-perimeter-mapped-gate-unbound');
    // These are frozen author estimates; this check makes no claim of surveyed dimensions.
    if (
      P.wallHeight !== 4.5 ||
      P.wallThickness !== 0.4 ||
      P.floor !== 0.25 ||
      P.foundationBottom !== -1.2 ||
      P.estimatedHeightUncertaintyMeters < 3 ||
      P.estimatedHorizontalUncertaintyMeters < 5 ||
      P.estimatedComponentUncertaintyMeters < 2 ||
      P.profiles.length !== 4 ||
      !P.profiles.every((p) => p.filter((v) => v.nativeCorner).length === 8)
    )
      return fail('litoral-perimeter-estimates-unbound');
    const s = proof.primarySources?.find((s) => s.key === 'osm');
    if (
      !safe(s?.path) ||
      s.url !== data.sourceUrl ||
      s.use !== 'factual-text-only' ||
      hash(fs.readFileSync(path.join(dir, s.path))) !== s.sha256
    )
      return fail('litoral-perimeter-primary-source-unbound');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Whole original named closed wall path and one mapped gate retained. Interior stays open; dimensions, finish, exact grade/contact and 2023 continuity remain explicit estimates. All imagery unused.',
    };
  } catch {
    return fail('litoral-perimeter-original-evidence-unreadable');
  }
}
