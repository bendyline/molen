/** Whole ASKAP equipment and all actual native positions; no imagery or site proxy. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
export function inspectMroAskapPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const s = proof.primarySources?.find((s) => s.key === 'antenna'),
      n = proof.nativeIdentity;
    for (const p of [s?.path, n?.path])
      if (typeof p !== 'string' || path.isAbsolute(p) || p.split(/[\\/]/).includes('..'))
        return fail('mro-askap-unsafe-source');
    const text = fs.readFileSync(path.join(dir, s.path)),
      bytes = fs.readFileSync(path.join(dir, n.path));
    if (
      s.url !== 'https://arxiv.org/abs/2102.01870' ||
      s.use !== 'factual-text-only' ||
      hash(text) !== s.sha256 ||
      ![
        '12mdiameter',
        'focalratiof/D0.5',
        'symmetricquadrupod',
        'primefocusPAFreceiver',
        'threeaxisazimuth/elevation/rollmount',
        'Everyphoto/figure/plan/drawing unused',
      ].every((t) => text.toString().includes(t))
    )
      return fail('mro-askap-primary-mechanical-facts-unbound');
    if (hash(bytes) !== n.sha256 || n.referenceNode !== '2377898985' || n.instanceCount !== 36)
      return fail('mro-askap-original-numeric-positions-unbound');
    const nodes = JSON.parse(bytes).nodes,
      refs = nodes.map((n) => Number(n.tags['ref:ASKAP'])).sort((a, b) => a - b),
      reference = nodes.find((n) => n.id === P.referenceNode);
    if (
      nodes.length !== 36 ||
      refs.some((v, i) => v !== i + 1) ||
      new Set(nodes.map((n) => n.id)).size !== 36 ||
      nodes.some((n) => n.type !== 'node' || n.tags.diameter !== '12' || !n.tags.name) ||
      reference?.tags.name !== 'Biyarli' ||
      reference.coordinate.some((v, i) => v !== f.anchor[i])
    )
      return fail('mro-askap-native-36-identities-or-primary-anchor-changed');
    if (
      P.model !== 'askap_radio_antenna' ||
      P.parentModelIdentity !== 'murchison_radio_astronomy_observatory' ||
      P.wholeScope !==
        'whole-ASKAP12m-paraboloid-quadrupod-feed-backframe-threeaxis-mount-pedestal-base-36nativeinstances-2013' ||
      P.diameter !== 12 ||
      P.focalRatio !== 0.5 ||
      P.focalLength !== 6 ||
      P.instanceCount !== 36 ||
      P.estimatedHeightUncertaintyMeters < 1.5 ||
      f.geometry.polygons[0].length !== 32
    )
      return fail('mro-askap-whole-equipment-scope-or-estimates-disagree');
    for (const [i, p] of f.geometry.polygons[0].entries())
      if (
        p.some(
          (v, k) =>
            Math.abs(v - 6 * (k === 0 ? Math.cos : Math.sin)((i * 2 * Math.PI) / 32)) > 1e-7,
        )
      )
        return fail('mro-askap-derived-reflector-envelope-changed');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Whole12mparaboloid/quadrupod/PAF/rearframe/mount/pedestal/base, all36actualnativepoints. Primarywrittenfacts only; allimageryunused. Derived32circle isreporteddiameter, notoriginalmappedfoundation. Pose/height/support/detail/finish/grade estimates explicit; wholeparentobservatory incomplete.',
    };
  } catch {
    return fail('mro-askap-factual-evidence-unreadable');
  }
}
