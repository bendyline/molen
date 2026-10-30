/** Whole Theatre Royal, numeric map controls and the state heritage construction description. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
const safe = (d, p) =>
  typeof p === 'string' && !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..')
    ? path.join(d, p)
    : null;
export function inspectHobartPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const s = proof.primarySources?.find((s) => s.key === 'heritage'),
      sp = safe(dir, s?.path),
      sb = sp && fs.readFileSync(sp);
    if (
      !sb ||
      s.url !==
        'https://heritage.tas.gov.au/Documents/THR12110%20Provisional%20entry%20Datasheet%20%26%20CPR.pdf' ||
      s.use !== 'factual-text-only' ||
      hash(sb) !== s.sha256 ||
      ![
        'DirectHTTP200',
        'two frontage storeys',
        'rusticated sandstone',
        'upper brick is rendered',
        'engaged Tuscan columns',
        'central arched entrance',
        'triangular pediment',
        'flytower exceeding18m',
        'Hedberg is a separate',
      ].every((t) => sb.toString().includes(t))
    )
      return fail('hobart-state-heritage-whole-theatre-construction-unbound');
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
      return fail('hobart-original-numeric-map-and-published-identity-unbound');
    const data = JSON.parse(b),
      qid = Object.values(JSON.parse(ib).query.pages)[0].pageprops.wikibase_item;
    if (
      qid !== 'Q3523488' ||
      f.mappedIdentity?.wikidataId !== qid ||
      P.model !== 'theatre_royal_hobart' ||
      P.wholeScope !==
        'entire-original-theatre-auditorium-foyers-mainroof-and-rear-stage-flytower-with-complete-classical-frontage' ||
      P.building.frontStoreys !== 2 ||
      P.flytower.wholeRearStage !== true ||
      P.flytower.heightAboveFloor <= 18 ||
      data.feature.id !== 'buildings/35184560675012' ||
      data.poi.properties.name !== 'Theatre Royal' ||
      data.feature.properties.height !== 8 ||
      data.zoom !== 15 ||
      data.feature.geometry.coordinates[0].length !== 5
    )
      return fail('hobart-entire-physical-theatre-and-flytower-disagree');
    const req = createRequire(
        new URL('../../../../packages/terrain/package.json', import.meta.url),
      ),
      { VectorTile } = req('@mapbox/vector-tile'),
      Pbf = req('pbf').default ?? req('pbf'),
      tile = new VectorTile(new Pbf(tb));
    const l = tile.layers.buildings;
    let raw;
    for (let i = 0; i < l.length; i++) {
      const x = l.feature(i);
      if (String(x.id) === '35184560675012') raw = x.toGeoJSON(...data.tile, data.zoom);
    }
    if (JSON.stringify(raw?.geometry) !== JSON.stringify(data.feature.geometry))
      return fail('hobart-numeric-footprint-does-not-match-original-vector-tile');
    const R = 6378137,
      rad = Math.PI / 180,
      co = Math.cos(f.anchor[1] * rad),
      c = Math.cos(f.heading),
      sine = Math.sin(f.heading);
    for (let i = 0; i < 4; i++) {
      const p = data.feature.geometry.coordinates[0][i],
        x = (p[0] - f.anchor[0]) * R * rad * co,
        z = -R * (Math.asinh(Math.tan(p[1] * rad)) - Math.asinh(Math.tan(f.anchor[1] * rad))) * co,
        local = [c * x - sine * z, sine * x + c * z];
      if (
        local.some(
          (v, k) =>
            Math.abs(v - P.nativeBuildingRing[i][k]) > 1e-7 ||
            Math.abs(v - f.geometry.polygons[0][i][k]) > 1e-7,
        )
      )
        return fail('hobart-original-whole-numeric-map-controls-changed');
    }
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'Whole original namedTheatreRoyalway188586180 numeric four-control footprint bound to original20261029z15MVT and matching namedPOI/independentQ3523488. Stateheritage12110written two-storey rusticatedsandstone/stuccobrick/Tuscanportico/archedentry/pediment/frieze/parapet and rearstageflytower>18m facts. Whole theatre and allroof/stage volumes retained; genericmap8mheight not maximumflytower survey. Exact sections/roof/flyplan/details/finish/grade estimated. No reportimages/maps/drawings, neighboringHedberg/Hotel/campus proxy, photographic/survey/current replacement claim.',
    };
  } catch {
    return fail('hobart-factual-evidence-invalid');
  }
}
