/** Inferred southern upper connection, bound to original numerical gap and unchanged hall inputs. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
export function inspectMubarakUpperLinkPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const bytes = (s) => {
        if (
          typeof s?.path !== 'string' ||
          path.isAbsolute(s.path) ||
          s.path.split(/[\\/]/).includes('..')
        )
          throw Error('path');
        const b = fs.readFileSync(path.join(dir, s.path));
        if (hash(b) !== s.sha256) throw Error('hash');
        return b;
      },
      source = proof.primarySources[0],
      study = JSON.parse(bytes(source)),
      native = JSON.parse(bytes(proof.nativeIdentity)),
      inputs = JSON.parse(fs.readFileSync(path.join(dir, 'native-map/unchanged-hall-inputs.json'))),
      g = JSON.parse(fs.readFileSync(path.join(dir, 'terrain-grid.json')));
    if (
      source.url !==
        'https://www.researchgate.net/publication/330983827_Conservation_of_Mubarak_Mandi_Complex_Jammu_-_Issues_and_Strategies' ||
      source.use !== 'factual-text-only' ||
      study.primaryAuthor !== 'Sakshi Sahni' ||
      study.imageryUsed !== false ||
      study.allFiguresAndPlansUnused !== true ||
      study.facts.partsJoinedAtUpperFloorAboveDeorhi !== true ||
      study.facts.bothFrontVerandahWidthFeet !== 10 ||
      native.sourceWayIds.join(',') !== '168959079,168959080' ||
      native.exactPairIdentityIndependentlyVerified !== false ||
      native.linkFootprintMeasured !== false ||
      native.proposedDepthMeters !== 3.048
    )
      return fail('upper-link-written-fact-and-inferred-scope-unbound');
    if (
      P.model !== 'mubarak_mandi_southern_courtyard_upper_link' ||
      P.parentModelIdentity !== 'mubarak_mandi_palace' ||
      P.kind !== 'inferred-southern-courtyard-upper-link' ||
      P.representedDate !== '2012-04-01' ||
      P.wholeScope !== 'whole-enclosed-upper-link-and-intrinsic-estimated-gateway-arch' ||
      P.exactPairIdentityIndependentlyVerified !== false ||
      P.linkFootprintMeasured !== false ||
      P.heightMeasured !== false ||
      P.interfaceHeightsSurveyed !== false ||
      P.allLinkSectionsEstimated !== true ||
      P.standaloneSupportPiers !== 0 ||
      P.allowancesAreMeasuredErrorBounds !== false ||
      P.estimatedHeightUncertaintyMeters < 3 ||
      P.estimatedHorizontalUncertaintyMeters < 10 ||
      JSON.stringify(P.nativeRing) !== JSON.stringify(f.geometry.polygons[0]) ||
      !f.geometryLabel.includes('NOT a native mapped')
    )
      return fail('upper-link-scope-or-estimates-changed');
    const expected = ['mubarak_mandi_southern_west_hall', 'mubarak_mandi_southern_east_hall'];
    for (let i = 0; i < 2; i++) {
      const m = inputs.members[i],
        root = `content/worldgen/source/places/tt/ttv/${expected[i]}`;
      if (m.model !== expected[i] || m.sourcePath !== root)
        return fail('upper-link-wrong-hall-input');
      for (const [p, h] of Object.entries(m.sourceFiles)) {
        if (
          path.isAbsolute(p) ||
          p.split(/[\\/]/).includes('..') ||
          hash(fs.readFileSync(path.join(root, p))) !== h
        )
          return fail('upper-link-accepted-hall-input-changed');
      }
      const a = P.interfaces[i],
        s = m.inputSections;
      for (const [k, key] of [
        ['floor', 'arcadeTop'],
        ['archSpring', 'archSpring'],
        ['roof', 'roof'],
        ['parapet', 'parapetTop'],
      ])
        if (Math.abs(a[k] - (m.datumElevationMeters + s[key] - g.modelDatumElevationMeters)) > 1e-8)
          return fail('upper-link-initial-interface-not-derived-from-original-inputs');
    }
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Primary written upper-link/deorhi fact, original numerical gap and unchanged accepted hall input sections/datums. Full bridge pairing/footprint, all link sections/arch/finish and exact2012condition remain explicit inferences/estimates; no ground piers, image license approval or whole-palace completion.',
    };
  } catch {
    return fail('upper-link-evidence-unreadable');
  }
}
