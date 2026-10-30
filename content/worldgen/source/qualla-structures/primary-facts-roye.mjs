/** Primary research binds the whole tiered Roye building; no imagery waiver. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
const safe = (d, p) =>
  typeof p === 'string' && !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..')
    ? path.join(d, p)
    : null;
export function inspectRoyePrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    for (const [key, phrases] of [
      [
        'original-preface',
        [
          'Original publisher-linked',
          'DannyHoffman',
          'DirectHTTP200',
          'early2012',
          'eightfloors',
          'every photograph/map/fieldsketch/figure unused',
          'conflicting narrative',
        ],
      ],
      [
        'transmitted-construction',
        [
          'chapter3',
          'printedpage91',
          'Actual written opening paragraph transmitted',
          'Original chapter bytes were not retrieved',
          'central rectangular five-floor tower',
          'multistory tiered plinth',
          'smaller service boxes',
          'No source photos',
        ],
      ],
    ]) {
      const s = proof.primarySources?.find((s) => s.key === key),
        p = safe(dir, s?.path),
        b = p && fs.readFileSync(p);
      if (
        !b ||
        s.url !== 'https://www.dukeupress.edu/monrovia-modern' ||
        s.use !== 'factual-text-only' ||
        hash(b) !== s.sha256 ||
        !phrases.every((t) => b.toString().includes(t))
      )
        return fail('roye-primary-original-preface-or-transmitted-construction-unbound');
    }
    const n = proof.nativeIdentity,
      p = safe(dir, n?.path),
      b = p && fs.readFileSync(p),
      ip = safe(dir, n?.identityPath),
      ib = ip && fs.readFileSync(ip),
      tp = safe(dir, n?.tilePath),
      tb = tp && fs.readFileSync(tp),
      tagp = safe(dir, n?.tagsPath),
      tagb = tagp && fs.readFileSync(tagp);
    if (
      !b ||
      !ib ||
      !tb ||
      !tagb ||
      hash(b) !== n.sha256 ||
      hash(ib) !== n.identityHash ||
      hash(tb) !== n.tileHash ||
      hash(tagb) !== n.tagsHash
    )
      return fail('roye-original-map-identity-or-tags-unbound');
    const data = JSON.parse(b),
      identity = Object.values(JSON.parse(ib).query.pages)[0],
      tags = JSON.parse(tagb);
    if (
      identity.pageprops.wikibase_item !== 'Q1292649' ||
      f.mappedIdentity?.wikidataId !== 'Q1292649' ||
      tags.status !== 200 ||
      !tags.text.includes('way id="142061466"') ||
      !tags.text.includes('alt_name" v="Edward J.Roye Building') ||
      !tags.text.includes('wikidata" v="Q1292649') ||
      P.model !== 'edward_j_roye_building' ||
      P.wholeScope !==
        'entire-Roye-eight-floor-building-whole-tiered-podium-auditorium-five-floor-tower-and-roof-service-boxes' ||
      P.representedDate !== '2012-02-01' ||
      P.building.storeys !== 8 ||
      P.building.towerStoreys !== 5 ||
      P.building.podiumStoreys !== 3 ||
      P.building.serviceBoxes.length !== 2 ||
      P.estimatedHeightUncertaintyMeters < 5 ||
      P.estimatedComponentRegistrationUncertaintyMeters < 10 ||
      data.feature.id !== 'buildings/35184514150298' ||
      data.zoom !== 15 ||
      P.nativeBuildingRing.length !== 6 ||
      JSON.stringify(f.anchor) !==
        JSON.stringify([identity.coordinates[0].lon, identity.coordinates[0].lat])
    )
      return fail('roye-whole-podium-eight-floor-tower-service-boxes-or-identity-disagrees');
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
      if (String(x.id) === '35184514150298') raw = x.toGeoJSON(...data.tile, data.zoom);
    }
    if (JSON.stringify(raw?.geometry) !== JSON.stringify(data.feature.geometry))
      return fail('roye-whole-original-vector-outline-changed');
    const R = 6378137,
      rad = Math.PI / 180,
      co = Math.cos(f.anchor[1] * rad),
      c = Math.cos(f.heading),
      s = Math.sin(f.heading);
    for (let i = 0; i < 6; i++) {
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
        return fail('roye-whole-six-control-podium-frame-changed');
    }
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'Whole early2012Roye building, all attached podium/auditorium/tiered-plinth levels, centralfive-floor tower/realexposedopenings/fullroof/twoserviceboxes. Original primary researcher preface eightfloors and explicitly transmitted same-author construction passage; source conflict and lack of original chapter bytes disclosed. Original numeric wholeway142061466 independently bound originalHTTP200name/altname/Q1292649tags and publishedpoint. Exactcomponentplans/height/census/finish/grade estimates,5mheight/10mcomponent uncertainty. All photographs/sketches/figures/artworks unused; no one-tower/neighbor proxy, photographic/survey/current replacement claim.',
    };
  } catch {
    return fail('roye-factual-evidence-invalid');
  }
}
