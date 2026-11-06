/** Whole church, from the municipal architectural inventory and original numerical parts. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
const safe = (d, p) =>
  typeof p === 'string' && !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..')
    ? path.join(d, p)
    : null;
export function inspectQuitoPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const s = proof.primarySources?.find((s) => s.key === 'architecture'),
      p = safe(dir, s?.path),
      b = p && fs.readFileSync(p);
    if (
      !b ||
      s.url !==
        'https://www.juntadeandalucia.es/sites/default/files/2021-05/60acb15372964-guia_quito_2.pdf' ||
      s.use !== 'factual-text-only' ||
      hash(b) !== s.sha256 ||
      ![
        'entry77',
        'PDF119-120/printed117-118',
        'Latin-cross',
        'SIX lateral',
        'hemispherical dome',
        'THREE entrance',
        'SIX Solomonic columns FIVE metres high',
        'bell tower demolished after1868',
        'All photographs',
        'images unused',
      ].every((t) => b.toString().includes(t))
    )
      return fail('quito-original-municipal-written-architecture-unbound');
    const np = safe(dir, proof.nativeIdentity?.path),
      nb = np && fs.readFileSync(np);
    if (!nb || hash(nb) !== proof.nativeIdentity.sha256)
      return fail('quito-original-whole-church-unbound');
    const n = JSON.parse(nb);
    if (
      n.source !== 'https://build.protomaps.com/20261029.pmtiles' ||
      n.wikidata !== 'Q3075573' ||
      n.parent?.id !== 'buildings/35185045958243' ||
      n.parent.geometry.coordinates[0].length !== 10 ||
      n.parts?.length !== 5 ||
      n.poi?.properties.name !== 'Iglesia de la Compañia de Jesus'
    )
      return fail('quito-wrong-church-or-incomplete-envelope');
    for (const t of n.tiles) {
      const p = safe(dir, t.path);
      if (!p || hash(fs.readFileSync(p)) !== t.sha256)
        return fail('quito-original-numeric-tile-stale');
    }
    const expected = [
      '35185045958240',
      '35185045958241',
      '35185045958242',
      '35185490580976',
      '35185490580977',
    ].map((id) => `buildings/${id}`);
    if (expected.some((id) => !n.parts.some((p) => p.id === id)))
      return fail('quito-native-main-roof-parts-incomplete');
    if (
      P.model !== 'church_of_la_compania_quito' ||
      P.wholeScope !==
        'whole-compania-quito-ninecontrol-church-sixchapeldomes-crossing-nave-presbytery-sacristy-2004' ||
      P.nativeChurchRing?.length !== 9 ||
      P.nativeParts?.length !== 6 ||
      P.church?.chapels !== 6 ||
      P.church.chapelCenters?.length !== 3 ||
      P.facade?.mainColumns !== 6 ||
      P.facade.columnHeight !== 5 ||
      P.representedDate !== '2004-07-21' ||
      P.estimatedPlanUncertaintyMeters < 3 ||
      P.estimatedHeightUncertaintyMeters < 3
    )
      return fail('quito-whole-church-written-forms-or-estimates-disagree');
    const R = 6378137,
      rad = Math.PI / 180,
      co = Math.cos(f.anchor[1] * rad),
      c = Math.cos(f.heading),
      s0 = Math.sin(f.heading);
    for (const [j, feature] of [n.parent, ...n.parts].entries())
      for (const [i, [lon, lat]] of feature.geometry.coordinates[0].slice(0, -1).entries()) {
        const x = (lon - f.anchor[0]) * R * rad * co,
          z = -R * (Math.asinh(Math.tan(lat * rad)) - Math.asinh(Math.tan(f.anchor[1] * rad))) * co,
          q = [c * x - s0 * z, s0 * x + c * z];
        if (q.some((v, k) => Math.abs(v - f.geometry.polygons[j][i][k]) > 1e-7))
          return fail('quito-original-full-envelope-or-roof-controls-moved');
      }
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Municipal original entry77 written whole Latin-cross church/six chapel cupolas/crossing dome/nave/presbytery/sacristy and three-door six5mSolomonic-column facade; exact ninecontrol envelope/five nativeparts. Every image unused. Hidden roof/sections/ornament/finish/grade estimated; dated2004proposal without lostbell-tower or neighbor proxy.',
    };
  } catch {
    return fail('quito-factual-evidence-unreadable');
  }
}
