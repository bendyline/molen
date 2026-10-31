/** Original Imperial Observatory office: municipal construction facts and whole numeric footprint. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
const safe = (d, p) =>
  typeof p === 'string' && !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..')
    ? path.join(d, p)
    : null;
export function inspectQingdaoPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const s = proof.primarySources?.find((s) => s.key === 'municipal'),
      sp = safe(dir, s?.path),
      sb = sp && fs.readFileSync(sp);
    if (
      !sb ||
      s.url !== 'https://www.qingdao.gov.cn/lslm/zt/whyc/wwzl/202111/t20211126_3877116.shtml' ||
      s.use !== 'factual-text-only' ||
      hash(sb) !== s.sha256 ||
      ![
        'actual cached web-search paragraph',
        'no direct originalHTML byte claim',
        'rough dressed granite',
        'three above-ground storeys and one basement',
        'beaver-tail tile roof',
        'crenellated tower reported21.6m',
        'not used as building heights or terrain datum',
      ].every((t) => sb.toString().includes(t))
    )
      return fail('qingdao-municipal-architecture-and-honest-retrieval-unbound');
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
      return fail('qingdao-original-numeric-map-and-published-identity-unbound');
    const data = JSON.parse(b),
      qid = Object.values(JSON.parse(ib).query.pages)[0].pageprops.wikibase_item;
    if (
      qid !== 'Q24833163' ||
      f.mappedIdentity?.wikidataId !== qid ||
      P.model !== 'qingdao_observatory' ||
      P.wholeScope !==
        'whole-original-imperial-observatory-office-three-storeys-complete-tiled-roof-and-intrinsic-crenellated-granite-tower' ||
      P.building.storeys !== 3 ||
      P.building.roofMaterial !== 'beaver-tail-tile' ||
      P.tower.storeys !== 7 ||
      P.tower.reportedHeight !== 21.6 ||
      P.tower.estimatedHorizontalRegistrationUncertaintyMeters < 6 ||
      data.feature.id !== 'buildings/35184907806464' ||
      data.poi.properties['name:en'] !== 'Former site of German Imperial Observatory' ||
      data.zoom !== 15 ||
      data.feature.geometry.coordinates[0].length !== 5
    )
      return fail('qingdao-whole-original-office-and-intrinsic-tower-disagree');
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
      if (String(x.id) === '35184907806464') raw = x.toGeoJSON(...data.tile, data.zoom);
    }
    if (JSON.stringify(raw?.geometry) !== JSON.stringify(data.feature.geometry))
      return fail('qingdao-whole-numeric-office-does-not-match-original-vector-tile');
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
        return fail('qingdao-original-whole-map-controls-changed');
    }
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'Entire original three-storey ImperialObservatoryoffice/alltiledroofslopes/basementexterior and intrinsic21.6mgranitecrenellatedtower. Municipalwrittenconstructionfacts; cachedparagraph provenance and directfailure disclosed, no originalHTMLclaim. Wholeoriginalz15numericfourcontrolway535717632 footprint/pairednamedPOI and independentQ24833163bound, not a native-node survey. Towercornerplan/registration/sections/roof/detail/finish/grade explicitboundedestimates. Reportedaltitude never sets height or terrain; independentastronomydome/directorhouse/campus excluded. Allimagery unused, no photographic/survey/current replacement claim.',
    };
  } catch {
    return fail('qingdao-factual-evidence-invalid');
  }
}
