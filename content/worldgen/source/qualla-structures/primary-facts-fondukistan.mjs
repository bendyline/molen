/** Written archaeological controls for the distinct central sanctuary, all imagery unused. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
export function inspectFondukistanPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const bytes = (s) => {
      if (
        typeof s?.path !== 'string' ||
        path.isAbsolute(s.path) ||
        s.path.split(/[\\/]/).includes('..')
      )
        throw Error('unsafe-source');
      const b = fs.readFileSync(path.join(dir, s.path));
      if (hash(b) !== s.sha256) throw Error('source-unbound');
      return b;
    };
    const sources = Object.fromEntries(proof.primarySources.map((s) => [s.key, s]));
    const mission = bytes(sources.mission)
      .toString()
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ');
    const curator = bytes(sources.curator).toString().replace(/\s+/g, ' ');
    const identity = JSON.parse(bytes(proof.nativeIdentity));
    if (
      sources.mission.url !==
        'https://www.dafa-afgh.org/recherche/les-operations-de-terrain-entre-1922-et-1982/fondukistan/' ||
      sources.curator.url !==
        'https://oaj.fupress.net/index.php/ra/article/download/7359/7350/7305' ||
      Object.values(sources).some((s) => s.use !== 'factual-text-only') ||
      ![
        'un sanctuaire et des dépendances',
        'La cour carrée comporte un stûpa central',
        'douze niches',
        'la voûte',
      ].every((s) => mission.includes(s)) ||
      !['1 m 15', '1 m 20', '0 m 75', '0 m 70', '0 m 85', '1 m 30', '4 m 50 sur 4 m 50'].every(
        (s) => curator.includes(s),
      )
    )
      return fail('fondukistan-primary-written-controls-unbound');
    if (
      P.model !== 'fondukistan_central_sanctuary' ||
      P.parentModelIdentity !== 'fondukistan_monastery' ||
      P.kind !== 'central-sanctuary-historical-reconstruction' ||
      P.representedDate !== '0650-01-01' ||
      P.courtSize !== 4.5 ||
      P.courtDimensionIsSurvey !== false ||
      P.nicheCount !== 12 ||
      P.eastNicheWidths.join(',') !== '1.15,1.15,1.2' ||
      P.southNicheWidths.join(',') !== '0.75,0.7,0.85' ||
      P.southDoorWidth !== 1.3 ||
      P.wholeScope !==
        'whole-central-square-sanctuary-court-twelve-vaulted-niches-south-entrance-and-central-stupa' ||
      P.bodyCoordinateSurveyed !== false ||
      P.footprintMeasured !== false ||
      P.heightMeasured !== false ||
      P.allowancesAreMeasuredErrorBounds !== false ||
      P.estimatedHorizontalUncertaintyMeters < 200 ||
      P.estimatedHeightUncertaintyMeters < 1.5 ||
      P.estimatedComponentUncertaintyMeters < 1.5 ||
      identity.coordinateIsSurveyedSanctuaryPoint !== false ||
      identity.structureId !== 'QS-4cb28cfb93ae' ||
      identity.coordinate.some((v, i) => v !== f.anchor[i]) ||
      !f.geometryLabel.includes('NOT a native mapped footprint')
    )
      return fail('fondukistan-scope-or-estimates-changed');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Written DAFA sanctuary identity and twelve-vaulted-niche census, archival six niche widths/1.3m south door and curator approximate4.5m court. All photographs/figures/plans/paintings unused. Outer shell, vaults, stupa profile, finishes, coordinate/facing/height and precise650CEcondition remain original estimates. Separate unlocated dependences are outside this member; parent monastery unfinished.',
    };
  } catch {
    return fail('fondukistan-written-evidence-unreadable');
  }
}

/** Written room functions support an explicitly estimated annex, not an excavated plan. */
export function inspectFondukistanAnnexPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const bytes = (s) => {
      if (
        typeof s?.path !== 'string' ||
        path.isAbsolute(s.path) ||
        s.path.split(/[\\/]/).includes('..')
      )
        throw Error('unsafe-source');
      const b = fs.readFileSync(path.join(dir, s.path));
      if (hash(b) !== s.sha256) throw Error('source-unbound');
      return b;
    };
    const sources = Object.fromEntries(proof.primarySources.map((s) => [s.key, s]));
    const text = bytes(sources.mission)
      .toString()
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ');
    bytes(sources.curator);
    const identity = JSON.parse(bytes(proof.nativeIdentity));
    if (
      sources.mission.url !==
        'https://www.dafa-afgh.org/recherche/les-operations-de-terrain-entre-1922-et-1982/fondukistan/' ||
      Object.values(sources).some((s) => s.use !== 'factual-text-only') ||
      !text.includes('cellules, salle de réunion, communs')
    )
      return fail('annex-functions-unbound');
    if (
      P.model !== 'fondukistan_monastic_annex' ||
      P.parentModelIdentity !== 'fondukistan_monastery' ||
      P.kind !== 'monastic-annex-historical-reconstruction' ||
      P.representedDate !== '0700-01-01' ||
      P.bodyCoordinateSurveyed !== false ||
      P.footprintMeasured !== false ||
      P.heightMeasured !== false ||
      P.layoutMeasured !== false ||
      P.roomCountMeasured !== false ||
      P.allowancesAreMeasuredErrorBounds !== false ||
      identity.coordinateIsSurveyedAnnexPoint !== false ||
      identity.structureId !== 'QS-4cb28cfb93ae' ||
      identity.estimatedAnnexCoordinate.some((v, i) => v !== f.anchor[i]) ||
      !f.geometryLabel.includes('NOT a native mapped footprint') ||
      !['cell', 'meeting hall', 'common rooms'].every((k) =>
        P.rooms.some((r) => r.function === k),
      ) ||
      P.rooms.some(
        (r) =>
          ![r.x0, r.x1, r.z0, r.z1, r.floor, r.foundationBottom, r.height].every(Number.isFinite),
      ) ||
      !proof.estimates.some((s) => s.includes('original estimates'))
    )
      return fail('annex-estimated-scope-unbound');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'DAFA confirms monastic cells, meeting hall and common rooms. Layout, cell count, dimensions, terraced foundations, finish and precise700CEcondition are original estimates; all photographs and plan images unused. Sanctuary is separately completed and unchanged.',
    };
  } catch {
    return fail('annex-written-source-unreadable');
  }
}
