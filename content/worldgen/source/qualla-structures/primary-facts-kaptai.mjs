/** Whole Kaptai dam, all sixteen spillway gates and five-unit western powerhouse. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
const safe = (d, p) =>
  typeof p === 'string' && !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..')
    ? path.join(d, p)
    : null;
export function inspectKaptaiPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    for (const [key, url, phrases] of [
      [
        'adb',
        'https://asiacleanenergyforum.adb.org/wp-content/uploads/2018/06/Hongwei-Zhang-Bangladesh-Kaptai-Lake-Overview.pdf',
        [
          'OriginalADB2018',
          'PDFpage2',
          'directHTTP200',
          '671m',
          '46m',
          '227m',
          '16gates',
          '2x40MW+3x50MW',
          'all photographs/GoogleEarthprints/figures are unused',
        ],
      ],
      [
        'cuet',
        'https://cuet.ac.bd/icmere/ICMERE%202015%20Proceedings/Session-V(A)/ICMERE2015-PI-091.pdf',
        [
          'PrimaryICMERE2015',
          'PDFpage2/Table1',
          '670.6m',
          '45.7m',
          '7.6m',
          'OriginaldirectPDFreturned404',
          'no originalPDFbyte claim',
        ],
      ],
      [
        'jica',
        'https://openjicareport.jica.go.jp/pdf/12269759_02.pdf',
        [
          'PrimaryJICA2016',
          '16radialspillwaygates onleftside',
          '11.5mwide',
          'OriginalPDFdownloadtimedout',
          'no originalPDFbyte',
        ],
      ],
      [
        'research',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC8504746/',
        [
          'Primary2021fieldresearch',
          'section3.1',
          'west of the main dam',
          'four-unitcensus conflicts',
          'not adopted',
          'recaptchachallenge',
          'Figures/maps/photographs',
          'unused',
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
        return fail('kaptai-primary-engineering-written-facts-or-retrieval-qualification-unbound');
    }
    const n = proof.nativeIdentity,
      paths = ['path', 'spillPath', 'identityPath', 'tilePath'],
      hashes = ['sha256', 'spillHash', 'identityHash', 'tileHash'],
      bytes = paths.map((k) => {
        const p = safe(dir, n?.[k]);
        return p && fs.readFileSync(p);
      });
    if (bytes.some((b, i) => !b || hash(b) !== n[hashes[i]]))
      return fail('kaptai-original-main-dam-road-spillway-or-identity-unbound');
    const data = JSON.parse(bytes[0]),
      sp = JSON.parse(bytes[1]),
      identity = Object.values(JSON.parse(bytes[2]).query.pages)[0],
      dam = data.elements.find((e) => e.type === 'way' && e.id === 1042087277),
      road = data.elements.find((e) => e.type === 'way' && e.id === 244292483),
      ns = new Map(data.elements.filter((e) => e.type === 'node').map((e) => [e.id, e]));
    if (
      identity.pageprops.wikibase_item !== 'Q1734089' ||
      dam?.tags.wikidata !== 'Q1734089' ||
      dam.nodes.length !== 23 ||
      road?.nodes.length !== 16 ||
      sp.feature.id !== 'landuse/35184881546777' ||
      sp.feature.properties.kind !== 'dam' ||
      P.model !== 'kaptai_dam' ||
      P.wholeScope !==
        'whole-earthfill-dam-sixteen-radial-gate-leftbank-spillway-and-entire-five-unit-western-powerhouse-intake' ||
      P.representedDate !== '2018-06-01' ||
      P.dam.nominalHeight !== 45.7 ||
      P.dam.crownWidth !== 7.6 ||
      P.dam.reportedLength !== 670.6 ||
      P.spillway.gates !== 16 ||
      P.spillway.reportedLength !== 227 ||
      P.spillway.clearGateWidth !== 11.5 ||
      P.powerhouse.units !== 5 ||
      P.powerhouse.nameplateMW !== 230 ||
      P.estimatedPowerhousePlanUncertaintyFraction < 0.25 ||
      P.estimatedPowerhouseRegistrationUncertaintyMeters < 50 ||
      f.heading !== 0 ||
      JSON.stringify(f.anchor) !== '[92.225,22.495]'
    )
      return fail('kaptai-whole-engineering-scope-census-or-declared-estimates-disagree');
    const R = 6378137,
      rad = Math.PI / 180,
      co = Math.cos(f.anchor[1] * rad),
      local = (p) => [
        (p[0] - f.anchor[0]) * R * rad * co,
        -R * (Math.asinh(Math.tan(p[1] * rad)) - Math.asinh(Math.tan(f.anchor[1] * rad))) * co,
      ];
    const originals = [
        dam.nodes.slice(0, -1).map((id) => {
          const p = ns.get(id);
          return local([p.lon, p.lat]);
        }),
        sp.feature.geometry.coordinates[0].slice(0, -1).map(local),
        road.nodes.map((id) => {
          const p = ns.get(id);
          return local([p.lon, p.lat]);
        }),
      ],
      controls = [f.geometry.polygons[0], f.geometry.polygons[1], f.geometry.centerlines[0]];
    if (
      JSON.stringify(originals) !== JSON.stringify(controls) ||
      JSON.stringify(P.nativeDamRing) !== JSON.stringify(originals[0]) ||
      JSON.stringify(P.nativeSpillwayRing) !== JSON.stringify(originals[1]) ||
      JSON.stringify(P.nativeCrest) !== JSON.stringify(originals[2])
    )
      return fail('kaptai-original-forty-five-numerical-controls-changed');
    const req = createRequire(
        new URL('../../../../packages/terrain/package.json', import.meta.url),
      ),
      { VectorTile } = req('@mapbox/vector-tile'),
      Pbf = req('pbf').default ?? req('pbf'),
      tile = new VectorTile(new Pbf(bytes[3])),
      l = tile.layers.landuse;
    let raw;
    for (let i = 0; i < l.length; i++) {
      const a = l.feature(i);
      if (String(a.id) === '35184881546777') raw = a.toGeoJSON(...sp.tile, sp.zoom);
    }
    if (JSON.stringify(raw?.geometry) !== JSON.stringify(sp.feature.geometry))
      return fail('kaptai-original-spillway-envelope-vector-disagrees');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'Whole earthfill45.7mdam/7.6mcrown/original666.66mcrestroad, complete227mleftbankspillway/all16radialgates and entirewesternfive-unit230MWpowerhouse/intake/penstockexteriors. PrimaryoriginalADBwrittenfacts and explicitcachedCUET/JICA/fieldresearch transmission; no protectedimagery. Original22dam/16road/7spillwaycontrols bound. Preciseroles/toes/slope/plantplan/roof/chute/gateheight/finish/grade estimates, powerhouse25percentplan/50mregistrationuncertainty. No bareembankment/oneunit/solarfarm/neighborproxy, proposedextension or currentworld/survey claim.',
    };
  } catch {
    return fail('kaptai-factual-evidence-invalid');
  }
}
