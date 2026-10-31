/** Whole independent Markar/Ferdowsi clock tower; written facts, no image approval. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
export function inspectMarkarPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    for (const [key, url, phrases] of [
      [
        'historian',
        'https://karizyazd.blogfa.com/post/5138',
        ['Hossein Masarrat', 'reported18m high', 'ارتفاع ۱۸ متر', 'own IRNA interview'],
      ],
      [
        'museum',
        'https://www.markarmuseum.com/62/',
        ['square plan', 'plain sloped roof', 'four clock faces', 'پلان مربعی'],
      ],
    ]) {
      const s = proof.primarySources?.find((s) => s.key === key);
      if (
        !s ||
        s.url !== url ||
        s.use !== 'factual-text-only' ||
        path.isAbsolute(s.path) ||
        s.path.split(/[\\/]/).includes('..')
      )
        return fail('markar-primary-facts-source-invalid');
      const b = fs.readFileSync(path.join(dir, s.path));
      if (
        hash(b) !== s.sha256 ||
        !phrases.every((v) => b.toString().replace(/\s+/g, ' ').includes(v))
      )
        return fail('markar-primary-reported-height-or-form-unbound');
    }
    const p = proof.nativeIdentity?.path;
    if (!p || path.isAbsolute(p) || p.split(/[\\/]/).includes('..'))
      return fail('markar-native-path-invalid');
    const b = fs.readFileSync(path.join(dir, p)),
      n = JSON.parse(b).elements.find((e) => e.type === 'node' && e.id === 4377503094);
    if (
      hash(b) !== proof.nativeIdentity.sha256 ||
      n?.tags.wikidata !== 'Q5902355' ||
      f.mappedIdentity?.wikidataId !== 'Q5902355' ||
      !f.anchor.every((v, i) => v === [n.lon, n.lat][i]) ||
      f.geometry?.point?.some((v) => v !== 0) ||
      P.model !== 'markar_clock_tower' ||
      P.wholeScope !== 'whole-independent-square-four-face-clock-tower-base-body-and-sloped-roof' ||
      P.tower?.reportedHeight !== 18 ||
      P.tower.plan !== 'square' ||
      P.tower.clockFaces !== 4 ||
      P.tower.roof !== 'plain-sloped-hip-reconstruction' ||
      P.tower.heightBasis !== 'Masarrat-own-republished-IRNA-interview-2026' ||
      Math.abs(P.tower.roofTop - P.floor - 18) > 1e-8
    )
      return fail('markar-whole-tower-native-identity-and-reported-height-disagree');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'Whole original namedQ5902355clock tower. Historian’s own republished interview reports18m height; cultural complex describes square plan, fourclockfaces and plain slopedroof. Location point only, no surveyed footprint. Widths, vertical divisions, roof/dial/inscription/fittings/azimuth/finish/grade explicitly estimated; no source imagery, photographic appearance or surveyed/current replacement approval.',
    };
  } catch {
    return fail('markar-factual-evidence-invalid');
  }
}
