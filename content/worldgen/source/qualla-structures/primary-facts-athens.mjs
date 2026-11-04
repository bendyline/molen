/** Exact named former exchange; written owner facts, no imagery. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
const safe = (d, p) =>
  typeof p === 'string' && !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..')
    ? path.join(d, p)
    : null;
export function inspectAthensPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    for (const [key, url, terms] of [
      [
        'owner',
        'https://prodea.gr/strapi/uploads/151218_Ethniki_Pangaia_AEEAP_Eggrafo_toy_Arthroy_4_toy_N_3401_2005_2_ad41b2db12.pdf',
        [
          'actual PDF168 /printed167',
          'Six-storey',
          'two basements',
          'mezzanine',
          '11,831.95m2',
          '1,750.99m2',
          'not specify heights',
          'No source photograph',
        ],
      ],
      [
        'culture',
        'https://digitalculture.gov.gr/2025/04/polla-en-thelo-na-sou-po-3o-festival-latreftikis-mousikis/',
        [
          '10Sofokleous',
          '1934-2007',
          'marble steps',
          'columns supporting a simple pediment',
          'Columncount/order/spacing/dimensions',
          'Every image unused',
        ],
      ],
      [
        'phase',
        'https://www.openhouseathens.gr/en/portfolio-item/palaio-xrimatistirio/',
        ['8-10Sofokleous', '1931', '1965-1968', 'not original1934', 'photographs unused'],
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
        return fail('athens-primary-owner-entrance-or-extension-phase-unbound');
    }
    const p = safe(dir, proof.nativeIdentity?.path),
      b = p && fs.readFileSync(p);
    if (!b || hash(b) !== proof.nativeIdentity.sha256)
      return fail('athens-original-named-building-unbound');
    const n = JSON.parse(b),
      xp = safe(dir, n.originalXml?.path),
      xml = xp && fs.readFileSync(xp);
    if (
      !xml ||
      hash(xml) !== n.originalXml.sha256 ||
      n.way?.id !== 234327978 ||
      n.way.tags.name !== 'Παλαιό Χρηματιστήριο Αθηνών' ||
      n.way.tags['addr:housenumber'] !== '8' ||
      n.way.coordinates.length !== 10 ||
      n.excludedAdjacentWay !== 234327993 ||
      !xml.toString().includes('<way id="234327978"')
    )
      return fail('athens-wrong-exchange-adjacent-bank-or-incomplete-native-envelope');
    if (
      P.model !== 'athens_stock_exchange' ||
      P.wholeScope !== 'whole-named-sofokleous-exchange-ninecontrol-post-extension-building-2015' ||
      P.representedDate !== '2015-06-30' ||
      P.nativeExchangeRing?.length !== 9 ||
      P.building?.nominalAboveGroundLevels !== 6 ||
      P.entrance?.estimatedColumns !== 4 ||
      P.estimatedHeightUncertaintyMeters < 6 ||
      P.estimatedPlanUncertaintyMeters < 4 ||
      f.features?.length !== 1 ||
      f.features[0].id !== 'way/234327978'
    )
      return fail('athens-whole-exchange-phase-or-bounded-estimates-disagree');
    const rad = Math.PI / 180,
      R = 6378137,
      co = Math.cos(f.anchor[1] * rad),
      c = Math.cos(f.heading),
      s = Math.sin(f.heading);
    for (const [i, [lon, lat]] of n.way.coordinates.slice(0, -1).entries()) {
      const x = (lon - f.anchor[0]) * R * rad * co,
        z = -R * (Math.asinh(Math.tan(lat * rad)) - Math.asinh(Math.tan(f.anchor[1] * rad))) * co,
        q = [c * x - s * z, s * x + c * z];
      if (
        q.some(
          (v, k) =>
            Math.abs(v - f.geometry.polygons[0][i][k]) > 1e-7 ||
            Math.abs(v - P.nativeExchangeRing[i][k]) > 1e-7,
        )
      )
        return fail('athens-original-full-envelope-moved');
    }
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Whole named original Sofokleous building, primary owner six-storey/hall/mezzanine facts and Ministry marble-stair/column/simple-pediment entrance. Post-extension2015 phase. All imagery unused. Heights/floor interpretation/roof/columncount/openings/finish/grade explicitly estimated; no neighboring bank or earlier/current exchange proxy.',
    };
  } catch {
    return fail('athens-factual-evidence-unreadable');
  }
}
