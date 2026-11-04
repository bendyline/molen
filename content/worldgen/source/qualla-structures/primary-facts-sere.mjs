/** Original demolished house, primary written facts and explicitly approximate site context. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`,
  safe = (d, p) =>
    typeof p === 'string' && !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..')
      ? path.join(d, p)
      : null;
export function inspectSerePrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    for (const [key, url, terms] of [
      [
        'heritage',
        'https://www.argentina.gob.ar/capital-humano/cultura/monumentos/mansion-sere',
        ['national heritage', 'French-style two-storey', '1900', 'All photographs unused'],
      ],
      [
        'memory',
        'https://www.comisionporlamemoria.org/sitiosdememoria/ficha/espacio-mansion-sere-casa-de-la-memoria-y-la-vida/',
        [
          'web cache',
          'DNS failed',
          'basement',
          'hipped roof',
          'separate later building',
          'Every photograph unused',
        ],
      ],
      [
        'archeology',
        'https://biblioteca.mpf.gov.ar/meran/getDocument.pl?id=7101',
        [
          'GAAMI',
          'PDF142',
          'perimeter tiled paving',
          'South-southeast annex',
          'Every photograph/plan/drawing unused',
        ],
      ],
      [
        'testimony',
        'https://condor-atlanta.org/wp-content/uploads/2024/03/13-Poder-Judicial-de-la-Nacion.pdf',
        [
          'Primary PoderJudicial2009',
          'no original court-host live retrieval claimed',
          'rectangular',
          'closed shutters',
          'ochava',
          'two or three steps',
          'all photographs/maps/drawings unused',
        ],
      ],
    ]) {
      const s = proof.primarySources?.find((s) => s.key === key),
        p = safe(dir, s?.path),
        b = p && fs.readFileSync(p);
      if (
        !b ||
        s.url !== url ||
        s.use !== 'factual-text-only' ||
        hash(b) !== s.sha256 ||
        !terms.every((t) => b.toString().includes(t))
      )
        return fail('sere-primary-architecture-facts-or-transmission-unbound');
    }
    const n = proof.nativeIdentity,
      p = safe(dir, n?.path),
      b = p && fs.readFileSync(p);
    if (
      !b ||
      hash(b) !== n.sha256 ||
      n.contextOnly !== true ||
      n.historicalFootprintAvailable !== false
    )
      return fail('sere-context-or-absent-historical-outline-disguised');
    const raw = JSON.parse(b),
      poi = raw.features.find((v) => v.id === 'pois/35184699885517'),
      roads = raw.features.filter(
        (v) => v.geometry.type === 'LineString' && v.properties.name === 'Blas Parera',
      );
    if (
      !poi ||
      roads.length !== 2 ||
      f.geometry.polygons?.length ||
      P.model !== 'mansion_sere' ||
      P.wholeScope !==
        'whole-original-sere-two-storey-basement-hipped-house-cornerentry-paving-annex-link-1977' ||
      P.house?.storeys !== 2 ||
      P.house.basement !== true ||
      P.house.estimatedWholePlan !== true ||
      P.house.roofForm !== 'hipped' ||
      P.house.entrySteps !== 3 ||
      P.annex.connected !== true ||
      !P.link ||
      !P.paving ||
      P.estimatedPlanUncertaintyMeters < 6 ||
      P.estimatedPositionUncertaintyMeters < 50 ||
      P.representedDate !== '1977-12-31'
    )
      return fail('sere-whole-original-house-or-honest-estimates-disagree');
    const R = 6378137,
      rad = Math.PI / 180,
      co = Math.cos(poi.geometry.coordinates[1] * rad),
      expected = [
        poi.geometry.coordinates[0] - 28.284271247 / (R * rad * co),
        poi.geometry.coordinates[1] - 28.284271247 / (R * rad),
      ],
      local = (q) => [
        (q[0] - f.anchor[0]) * R * rad * co,
        -R * (Math.asinh(Math.tan(q[1] * rad)) - Math.asinh(Math.tan(f.anchor[1] * rad))) * co,
      ];
    if (
      expected.some((v, i) => Math.abs(v - f.anchor[i]) > 1e-12) ||
      f.mappedIdentity.siteContext.id !== poi.id ||
      f.mappedIdentity.positionEstimate.uncertaintyMeters < 50
    )
      return fail('sere-approximate-original-site-position-moved-or-modern-chalet-substituted');
    for (const [i, r] of roads.entries())
      for (const [k, q] of r.geometry.coordinates.entries())
        if (local(q).some((v, a) => Math.abs(v - f.geometry.centerlines[i][k][a]) > 1e-7))
          return fail('sere-original-numeric-street-context-moved');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Whole original two-storey/hippedroof/basement/cornerentry/paving/S-SEannex/link, everyimageunused. Sparse written primaryfacts only. Historic outline/size/finish/sections/50msiteposition estimate explicit; current1997chalet is contextonly, never buildingproxy. Originalfield/frame/floors/sections fixed.',
    };
  } catch {
    return fail('sere-factual-evidence-unreadable');
  }
}
