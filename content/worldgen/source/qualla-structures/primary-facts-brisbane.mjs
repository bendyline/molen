/** Whole historical hall bound to written heritage/designer facts and street context. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
const safe = (d, p) =>
  typeof p === 'string' && !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..')
    ? path.join(d, p)
    : null;
export function inspectBrisbanePrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    for (const [key, url, phrases] of [
      [
        'icomos',
        'https://www.icomos.org/public/risk/2002/australia2002.htm',
        [
          'Original AustraliaICOMOS2002',
          'directHTTP200',
          'raked seating',
          'raised central auditorium roof',
          'international modernist',
          'demolition for residential tower planned',
          'No source photograph/map/figure adopted',
        ],
      ],
      [
        'designer',
        'https://digital.slq.qld.gov.au/delivery/DeliveryManagerServlet?dps_func=stream&dps_pid=FL4718786',
        [
          'Original StateLibraryQueensland transcript',
          '29November2012',
          'PDFpage18',
          'DirectHTTP200',
          'Designer first-person',
          'built shape followed his design',
          'structure did not precisely follow',
          'not retrieved original1959construction drawings',
          'No protected photo/audio/video/figure',
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
        return fail('brisbane-primary-heritage-or-designer-construction-transmission-unbound');
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
      return fail('brisbane-original-street-context-or-historic-point-unbound');
    const data = JSON.parse(b),
      identity = Object.values(JSON.parse(ib).query.pages)[0];
    if (
      identity.pageprops.wikibase_item !== 'Q4968565' ||
      f.mappedIdentity?.wikidataId !== 'Q4968565' ||
      P.model !== 'brisbane_festival_hall' ||
      P.wholeScope !==
        'entire-historical-FestivalHall-main-building-all-foyers-raised-auditorium-roof-and-side-seating-wings' ||
      P.representedDate !== '2002-01-01' ||
      P.estimatedHistoricalRing?.length !== 4 ||
      P.estimatedPlanUncertaintyFraction < 0.2 ||
      P.estimatedHeightUncertaintyMeters < 3 ||
      P.estimatedComponentRegistrationUncertaintyMeters < 10 ||
      P.building.centralRidge !== 17.4 ||
      P.building.centralEave !== 15.4 ||
      P.building.sideOuterRoof !== 11.4 ||
      P.building.sideInnerRoof !== 9.4 ||
      P.building.wholePlanWidth !== 60 ||
      P.building.wholePlanDepth !== 57 ||
      data.features?.length !== 2 ||
      data.zoom !== 15 ||
      f.geometry.polygons ||
      JSON.stringify(f.anchor) !==
        JSON.stringify([identity.coordinates[0].lon, identity.coordinates[0].lat])
    )
      return fail('brisbane-whole-historical-hall-or-explicit-estimated-plan-disagrees');
    const req = createRequire(
        new URL('../../../../packages/terrain/package.json', import.meta.url),
      ),
      { VectorTile } = req('@mapbox/vector-tile'),
      Pbf = req('pbf').default ?? req('pbf'),
      tile = new VectorTile(new Pbf(tb)),
      layer = tile.layers.roads;
    const R = 6378137,
      rad = Math.PI / 180,
      co = Math.cos(f.anchor[1] * rad),
      c = Math.cos(f.heading),
      s = Math.sin(f.heading);
    for (let j = 0; j < 2; j++) {
      const feature = data.features[j],
        id = ['roads/35184518508560', 'roads/35184518508634'][j];
      if (
        feature.id !== id ||
        feature.properties.name !== ['Charlotte Street', 'Albert Street'][j] ||
        feature.geometry.type !== 'LineString'
      )
        return fail('brisbane-original-street-identity-disagrees');
      let raw;
      for (let i = 0; i < layer.length; i++) {
        const x = layer.feature(i);
        if (String(x.id) === id.split('/')[1]) raw = x.toGeoJSON(...data.tile, data.zoom);
      }
      if (JSON.stringify(raw?.geometry) !== JSON.stringify(feature.geometry))
        return fail('brisbane-original-numerical-street-geometry-changed');
      for (let i = 0; i < feature.geometry.coordinates.length; i++) {
        const p = feature.geometry.coordinates[i],
          x = (p[0] - f.anchor[0]) * R * rad * co,
          z =
            -R * (Math.asinh(Math.tan(p[1] * rad)) - Math.asinh(Math.tan(f.anchor[1] * rad))) * co,
          local = [c * x - s * z, s * x + c * z];
        if (
          local.some(
            (v, k) =>
              Math.abs(v - f.geometry.centerlines[j][i][k]) > 1e-7 ||
              Math.abs(v - f.features[j].points[i][k]) > 1e-7,
          )
        )
          return fail('brisbane-original-six-street-context-controls-changed');
      }
    }
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'Whole2002historicalFestivalHall multipurpose hall/allfoyers/podium/centralraisedauditoriumroof/bothsideseatingroofvolumes. Original primaryICOMOSassessment and originaldesigner oral-history built-shape statement. IndependentQ4968565point and original six numericCharlotte/Albert controls are context only, actual historicoutline absent, no modernTower substitution. Entire60x57mplan and exact sections/roofprofiles/details/finish/grade are declared estimates with20percentplan/10mcomponent/3mheight uncertainty. Every image/drawing/audio/video unused; no facade-only/predecessor/neighbor proxy or photographic/survey/current replacement claim.',
    };
  } catch {
    return fail('brisbane-factual-evidence-invalid');
  }
}
