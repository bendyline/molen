/** Exact native whole bridge layout and published engineering dimensions; no imagery. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const digest = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
const safe = (dir, p) =>
  typeof p === 'string' && !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..')
    ? path.join(dir, p)
    : undefined;
const normalize = (b) => b.toString().replace(/\s+/g, ' ');
export function inspectMaputoPrimaryFacts({ dir, proof, controls, frame }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const expected = {
      authority: [
        'https://www.mofcom.gov.cn/newarticle/beltandroad/mz/enindex.shtml',
        [
          'main span of 680 m',
          'each 141.2 m high',
          'north approach span is 1.09 km',
          'south approach span is 1.23 km',
          'precast concrete T-beams',
          '3.01 km',
        ],
      ],
      engineering: [
        'https://trid.trb.org/View/1590697',
        [
          '3 Meter hohen und 25,60 Meter langen Stahlhohlkastenelementen',
          'Tragkabel aus 91 vorgefertigten Litzenbündeln',
          'in 60 Metern Höhe',
        ],
      ],
    };
    for (const [key, [url, phrases]] of Object.entries(expected)) {
      const source = proof.primarySources?.find((s) => s.key === key),
        file = safe(dir, source?.path);
      if (
        !file ||
        source.url !== url ||
        source.use !== 'factual-text-only' ||
        !source.path.endsWith('.txt')
      )
        return fail('maputo-primary-source-missing');
      const bytes = fs.readFileSync(file),
        body = normalize(bytes);
      if (digest(bytes) !== source.sha256 || !phrases.every((p) => body.includes(p)))
        return fail('maputo-primary-metrics-unbound');
    }
    const file = safe(dir, proof.nativeIdentity?.path),
      bytes = file && fs.readFileSync(file);
    if (!bytes || digest(bytes) !== proof.nativeIdentity.sha256)
      return fail('maputo-native-unbound');
    const native = JSON.parse(bytes),
      expectedIds = [378386159, 529725302, 638819906, 643276204, 643276231, 764038469, 1309091556];
    const ids = native.elements
      .filter((e) => e.type === 'way')
      .map((w) => w.id)
      .sort((a, b) => a - b);
    if (
      JSON.stringify(ids) !== JSON.stringify([...expectedIds].sort((a, b) => a - b)) ||
      !native.sourceUrl?.startsWith('https://api.openstreetmap.org/api/0.6/map.json?bbox=') ||
      frame.mappedIdentity?.wikidataId !== 'Q19275941' ||
      controls.model !== 'maputo_katembe_bridge' ||
      controls.wholeScope !== 'whole-suspension-bridge-and-all-intrinsic-elevated-approaches'
    )
      return fail('maputo-whole-identity-mismatch');
    const nodes = new Map(native.elements.filter((e) => e.type === 'node').map((n) => [n.id, n]));
    const r = (6378137 * Math.PI) / 180,
      co = Math.cos((frame.anchor[1] * Math.PI) / 180);
    for (const id of expectedIds) {
      const way = native.elements.find((e) => e.type === 'way' && e.id === id);
      const feature = frame.features?.find((f) => f.id === `way/${id}`);
      if (!way.tags?.bridge || !feature || feature.points.length !== way.nodes.length)
        return fail('maputo-native-plan-incomplete');
      if (
        !way.nodes.every((n, i) => {
          const p = nodes.get(n),
            q = feature.points[i];
          return (
            p &&
            q &&
            Math.abs(q[0] - (p.lon - frame.anchor[0]) * r * co) < 1e-7 &&
            Math.abs(q[1] + (p.lat - frame.anchor[1]) * r) < 1e-7
          );
        })
      )
        return fail('maputo-native-controls-changed');
    }
    if (
      controls.bridge?.mainSpan !== 680 ||
      controls.bridge?.towerHeight !== 141.2 ||
      controls.bridge?.deckWidth !== 25.6 ||
      controls.bridge?.deckDepth !== 3 ||
      controls.bridge?.navigationClearance !== 60 ||
      controls.nativeRoads?.length !== 7
    )
      return fail('maputo-geometric-metrics-disagree');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: digest(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'Whole native bridge/approach layout and published span/tower/deck metrics verified. Portal sections, cable sag/hanger census, piers, finish and grades remain explicit estimates; no photographic or survey approval claimed.',
    };
  } catch {
    return fail('maputo-factual-evidence-invalid');
  }
}
