/** Complete restored historical hotel, actual courtyard and intrinsic restoration wings. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
const safe = (d, p) =>
  typeof p === 'string' && !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..')
    ? path.join(d, p)
    : null;
export function inspectBristolPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    for (const [key, url, phrases] of [
      [
        'restorer',
        'https://odessa-life.od.ua/uk/article-uk/pro-rekonstrukcziyu-odeskogo-gotelyu-brystol',
        [
          'first-person21June2011interview',
          'restorationarchitectNataliaMerzhievska',
          'copperdrains',
          'new courtyard building',
          'fouradditionalfloors',
          'not original2011bytes',
        ],
      ],
      [
        'owner',
        'https://bristol-hotel.com.ua/eng/rooms/',
        [
          'DirectHTTP200',
          'reopening15December2010',
          'fourth-floorattic',
          'Mansard withskylights',
          'privatebalconies',
        ],
      ],
      [
        'qualla-story',
        'https://qualla.com/bristol-hotel-odesa/',
        [
          'User-owned localstory',
          'whitemarblecolumns/Neoclassicalstatuary',
          'RenaissanceRevival/BaroqueRevival',
          'missileinjury/damage31January2025',
          'dated2014intactexterior',
          'noOperaTheatre dome inference',
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
        return fail(
          'bristol-restorer-owner-and-own-story-construction-or-historical-phase-unbound',
        );
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
      return fail('bristol-original-whole-map-courtyard-and-published-identity-unbound');
    const data = JSON.parse(b),
      qid = Object.values(JSON.parse(ib).query.pages)[0].pageprops.wikibase_item;
    if (
      qid !== 'Q4096565' ||
      f.mappedIdentity?.wikidataId !== qid ||
      P.model !== 'bristol_hotel_odesa' ||
      P.wholeScope !==
        'entire-restored-hotel-street-wings-courtyard-wings-hall-annex-all-roofs-and-true-open-courtyard' ||
      P.representedDate !== '2014-06-01' ||
      P.building.mansardStorey !== 4 ||
      P.bands.length !== 4 ||
      P.bands[1].storeys !== 5 ||
      P.bands[2].storeys !== 2 ||
      P.estimatedComponentRegistrationUncertaintyMeters < 10 ||
      data.feature.id !== 'buildings/52776563891876' ||
      data.poi.properties['name:en'] !== 'Bristol' ||
      data.zoom !== 15 ||
      data.feature.geometry.coordinates.length !== 2 ||
      P.nativeCourtyardHoles?.[0]?.length !== 4
    )
      return fail('bristol-complete-historical-hotel-annexes-and-open-courtyard-scope-disagree');
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
      if (String(x.id) === '52776563891876') raw = x.toGeoJSON(...data.tile, data.zoom);
    }
    if (JSON.stringify(raw?.geometry) !== JSON.stringify(data.feature.geometry))
      return fail('bristol-outer-and-courtyard-rings-do-not-match-original-vector-tile');
    const R = 6378137,
      rad = Math.PI / 180,
      co = Math.cos(f.anchor[1] * rad),
      c = Math.cos(f.heading),
      sine = Math.sin(f.heading);
    for (let j = 0; j < 2; j++)
      for (let i = 0; i < 4; i++) {
        const p = data.feature.geometry.coordinates[j][i],
          x = (p[0] - f.anchor[0]) * R * rad * co,
          z =
            -R * (Math.asinh(Math.tan(p[1] * rad)) - Math.asinh(Math.tan(f.anchor[1] * rad))) * co,
          local = [c * x - sine * z, sine * x + c * z],
          a = j ? P.nativeCourtyardHoles[0] : P.nativeBuildingRing,
          b = j ? f.geometry.holes[0] : f.geometry.polygons[0];
        if (local.some((v, k) => Math.abs(v - a[i][k]) > 1e-7 || Math.abs(v - b[i][k]) > 1e-7))
          return fail('bristol-original-whole-outer-and-courtyard-controls-changed');
      }
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'Whole2014restoredBristolhotel, streetL/courtyardaccommodation/hallannex/allroofs and genuineopeninnercourtyard. Primarypublishedrestorerfirstpersonwholecourtyard/fouraddedfloor/copper/restoredmoulding facts; ownerfourthmansardfloor/skylights/balconies/reopening and ownQuallawrittenwhitecolumns/statues/BaroqueRenaissance/2025damagephase. Originalnumericz15outer+hole andsame-IDnamedPOI/Q4096565bound. Exactwing-role/height/roof/census/ornament/finish/grade estimates explicit,10mcomponentregistrationuncertainty. No sourceimages/plans/artwork/domeinference, adjacentbuilding/facadeproxy, surveyed/photographic/currentreplacement claim.',
    };
  } catch {
    return fail('bristol-factual-evidence-invalid');
  }
}
