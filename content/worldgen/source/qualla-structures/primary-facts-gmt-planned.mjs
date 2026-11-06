/** 2024 designer-document visualization, expressly not an as-built or future completion claim. */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => 'sha256:' + createHash('sha256').update(b).digest('hex');
export function inspectGmtPlannedPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const bytes = (s) => {
        if (!s || path.isAbsolute(s.path) || s.path.split(/[\\/]/).includes('..'))
          throw Error('unsafe');
        const b = fs.readFileSync(path.join(dir, s.path));
        if (hash(b) !== s.sha256) throw Error('changed');
        return b;
      },
      sources = Object.fromEntries(proof.primarySources.map((s) => [s.key, s])),
      text = bytes(sources.designers).toString().replace(/\s+/g, ' '),
      facts = JSON.parse(bytes(sources.status)),
      identity = JSON.parse(bytes(proof.nativeIdentity));
    if (
      sources.designers.url !==
        'https://heavymovablestructures.org/wp-content/uploads/2024/12/The-Giant-Magellan-Telescope-Enclosure.pdf' ||
      ![
        'seven 8.4m',
        'cylindrical rotating',
        '~12m',
        '~52m',
        '27.675m',
        '29.525m',
        '46 meter tall',
        'over 300 wind vents',
      ].every((s) => text.includes(s)) ||
      facts.originalTechnicalSource.facts.reportedDesignHeightMeters !== 65
    )
      return fail('gmt-planned-original-designer-facts-unbound');
    if (
      P.model !== 'giant_magellan_summit_enclosure' ||
      P.parentModelIdentity !== 'giant_magellan_telescope' ||
      P.representationKind !== 'planned-design' ||
      P.asBuilt !== false ||
      P.operatingStructure !== false ||
      P.representedDate !== '2024-10-07' ||
      P.designHeight !== 65 ||
      P.baseHeight !== 12 ||
      P.shutterHeight !== 46 ||
      P.mirrorCount !== 7 ||
      P.mirrorDiameter !== 8.4 ||
      P.footprintMeasured !== false ||
      P.bodyCoordinateSurveyed !== false ||
      P.allowancesAreMeasuredErrorBounds !== false ||
      identity.coordinateIsSurveyedEnclosurePoint !== false ||
      identity.coordinate.some((v, i) => v !== f.anchor[i]) ||
      f.identityStatus !== 'planned-design-only-not-as-built-enclosure' ||
      !proof.estimates.some((s) => s.includes('not a claim of a physically finished enclosure'))
    )
      return fail('gmt-planned-status-or-design-scope-unbound');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Explicit2024designer-document visualization:65m cylindrical enclosure,12m fixed base,46m L-shutters and seven8.4m mirror segments. Exact roof/shutter pose, framing, colours, panels and site grade are original estimates. No completed current/as-built enclosure, future completion date or imported drawing/image geometry claimed; existing support assets unchanged.',
    };
  } catch {
    return fail('gmt-planned-original-evidence-unreadable');
  }
}
