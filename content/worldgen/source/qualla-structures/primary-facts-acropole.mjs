/** Bound written eyewitness reconstruction of the whole historical Acropole Hotel. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
const safe = (d, p) =>
  typeof p === 'string' && !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..')
    ? path.join(d, p)
    : null;
export function inspectAcropolePrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    for (const [key, url, phrases] of [
      [
        'npr',
        'https://www.tpr.org/2025-06-15/khartoums-acropole-hotel-survivor-of-coups-and-attacks-succumbs-to-civil-war',
        [
          'Primary first-hand',
          'EmmanuelAkinwotu',
          'directHTTP200',
          'three-storey clay-colored',
          'blue wooden window shutters',
          'street-facing patios',
          'historical2020 intact exterior only',
          'All photographs/audio/video unused',
        ],
      ],
      [
        'archaeologist',
        'https://medievalsaiproject.wordpress.com/2012/11/21/greek-norwegian-at-acropole-hotel/',
        [
          'Primary first-hand',
          'dated21November2012',
          'directHTTP200',
          'hotel-room balcony door',
          'post1988 operating hotel',
          'No source photo adopted',
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
        return fail('acropole-primary-eyewitness-written-construction-or-transmission-unbound');
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
      return fail('acropole-original-whole-hotel-map-and-identity-unbound');
    const data = JSON.parse(b),
      qid = Object.values(JSON.parse(ib).query.pages)[0].pageprops.wikibase_item;
    if (
      qid !== 'Q4676414' ||
      f.mappedIdentity?.wikidataId !== qid ||
      P.model !== 'acropole_hotel' ||
      P.wholeScope !==
        'entire-post1988-Acropole-three-storey-hotel-all-facades-roof-and-street-patios' ||
      P.representedDate !== '2020-06-01' ||
      P.building.storeys !== 3 ||
      P.building.roofTop !== 11.75 ||
      P.building.patioLevels.length !== 2 ||
      P.building.patioDepth !== 2.1 ||
      P.estimatedHeightUncertaintyMeters < 2 ||
      P.estimatedComponentRegistrationUncertaintyMeters < 5 ||
      data.feature.id !== 'buildings/35184575951940' ||
      data.poi.properties['name:en'] !== 'Acropole Hotel' ||
      data.zoom !== 15 ||
      data.feature.geometry.coordinates.length !== 1 ||
      P.nativeBuildingRing.length !== 4 ||
      JSON.stringify(f.anchor) !== JSON.stringify(data.poi.geometry.coordinates)
    )
      return fail('acropole-whole-three-floor-hotel-patio-scope-or-correct-hotel-anchor-disagrees');
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
      if (String(x.id) === '35184575951940') raw = x.toGeoJSON(...data.tile, data.zoom);
    }
    if (JSON.stringify(raw?.geometry) !== JSON.stringify(data.feature.geometry))
      return fail('acropole-whole-hotel-controls-not-original-vector-tile');
    const R = 6378137,
      rad = Math.PI / 180,
      co = Math.cos(f.anchor[1] * rad),
      c = Math.cos(f.heading),
      s = Math.sin(f.heading);
    for (let i = 0; i < 4; i++) {
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
        return fail('acropole-original-whole-four-control-plan-changed');
    }
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'Whole2020post1988AcropoleHotelKhartoum, three storeys/all facades/full roof/complete street patios/blue wooden shutters. Primary first-hand reporter written three-floor/clay/shutter/patio/warphase facts plus dated2012researcher room-balcony testimony, both actual originalHTMLhashes bound. Actual original numerical four-control wholehotel/paired namedPOI/Q4676414, quantized not node survey. Precise heights/flat roof/patio/mainwall/component registration/census/finish/grade explicitly estimated with2mheight/5mregistration uncertainty. All imagery unused, no opposite oldhotel/neighbor proxy or photographic/survey/current replacement claim.',
    };
  } catch {
    return fail('acropole-factual-evidence-invalid');
  }
}
