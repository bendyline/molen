/** Bound written eyewitness reconstruction of the whole historical Ducor Hotel. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
const safe = (d, p) =>
  typeof p === 'string' && !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..')
    ? path.join(d, p)
    : null;
export function inspectDucorPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    for (const [key, url, phrases] of [
      [
        'fuad',
        'https://jollofroad.zikoko.com/i-checked-into-ducor-hotel-sort-of/',
        [
          'Primary first-hand',
          'directHTTP200',
          'eight storeys',
          'rooftop restaurant',
          'no independently verified publication year',
          'Every image remains unused',
        ],
      ],
      [
        'mccready',
        'https://medium.com/@alastairmccready/the-haunting-remains-of-west-africas-first-5-star-hotel-20abf644b71b',
        [
          'Primary first-hand',
          'published29November2016',
          'eight floors',
          'many balconies and exposed windows',
          'interiors gutted',
          'top floor with sea-facing roof terrace',
          'direct Node HTTP403',
          'No originalHTML byte claim',
          'No source photograph',
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
        !phrases.every((t) => b.toString().includes(t))
      )
        return fail('ducor-primary-eyewitness-written-construction-or-transmission-unbound');
    }
    const n = proof.nativeIdentity,
      p = safe(dir, n?.path),
      b = p && fs.readFileSync(p),
      ip = safe(dir, n?.identityPath),
      ib = ip && fs.readFileSync(ip),
      tp = safe(dir, n?.tilePath),
      tb = tp && fs.readFileSync(tp);
    if (
      !b ||
      !ib ||
      !tb ||
      hash(b) !== n.sha256 ||
      hash(ib) !== n.identityHash ||
      hash(tb) !== n.tileHash
    )
      return fail('ducor-original-whole-hotel-map-and-identity-unbound');
    const data = JSON.parse(b),
      qid = Object.values(JSON.parse(ib).query.pages)[0].pageprops.wikibase_item;
    if (
      qid !== 'Q1263572' ||
      f.mappedIdentity?.wikidataId !== qid ||
      P.model !== 'ducor_hotel' ||
      P.wholeScope !==
        'entire-eight-floor-ruined-concrete-hotel-all-concave-wings-open-facades-and-whole-roof' ||
      P.representedDate !== '2016-11-29' ||
      P.building.storeys !== 8 ||
      P.building.roofTop - P.floor !== 26 ||
      P.estimatedHeightUncertaintyMeters < 4 ||
      P.estimatedComponentRegistrationUncertaintyMeters < 5 ||
      data.feature.id !== 'buildings/35185885128313' ||
      data.poi.properties.name !== 'Ducor Intercontinental Hotel' ||
      data.zoom !== 15 ||
      data.feature.geometry.coordinates.length !== 1 ||
      P.nativeBuildingRing.length !== 12 ||
      JSON.stringify(f.anchor) !== JSON.stringify(data.poi.geometry.coordinates)
    )
      return fail('ducor-whole-eight-floor-ruin-scope-or-correct-hotel-anchor-disagrees');
    const req = createRequire(
        new URL('../../../../packages/terrain/package.json', import.meta.url),
      ),
      { VectorTile } = req('@mapbox/vector-tile'),
      Pbf = req('pbf').default ?? req('pbf'),
      tile = new VectorTile(new Pbf(tb)),
      l = tile.layers.buildings;
    let raw;
    for (let i = 0; i < l.length; i++) {
      const x = l.feature(i);
      if (String(x.id) === '35185885128313') raw = x.toGeoJSON(...data.tile, data.zoom);
    }
    if (JSON.stringify(raw?.geometry) !== JSON.stringify(data.feature.geometry))
      return fail('ducor-whole-hotel-controls-not-original-vector-tile');
    const R = 6378137,
      rad = Math.PI / 180,
      co = Math.cos(f.anchor[1] * rad),
      c = Math.cos(f.heading),
      s = Math.sin(f.heading);
    for (let i = 0; i < 12; i++) {
      const p = data.feature.geometry.coordinates[0][i],
        x = (p[0] - f.anchor[0]) * R * rad * co,
        z = -R * (Math.asinh(Math.tan(p[1] * rad)) - Math.asinh(Math.tan(f.anchor[1] * rad))) * co,
        local = [c * x - s * z, s * x + c * z];
      if (
        local.some(
          (v, k) =>
            Math.abs(v - P.nativeBuildingRing[i][k]) > 1e-7 ||
            Math.abs(v - f.geometry.polygons[0][i][k]) > 1e-7,
        )
      )
        return fail('ducor-original-whole-concave-twelve-control-plan-changed');
    }
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'Whole2016Ducor concrete ruin, all concave wings/eight complete floorplates/full roof/restaurant and open balcony/window shell. Two primary first-hand written accounts, dated2016text and disclosed403/direct text transmission; original quantized z15wholehotel polygon/paired namedPOI/Q1263572 bound. Correct actual hotel anchor chosen before field, story coordinate untouched. Equal26m-height envelope/column/parapet/census/balcony/finish/grade estimated with4mheight/5mcomponentuncertainty. Every image unused; separate reservoir/pool/outbuildings excluded, no sample-wing/photographic/survey/current replacement claim.',
    };
  } catch {
    return fail('ducor-factual-evidence-invalid');
  }
}
