/** Whole reported Pink Hall; no appearance imagery or plan images adopted. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
export function inspectMubarakPinkHallPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const read = (s) => {
      if (
        typeof s?.path !== 'string' ||
        path.isAbsolute(s.path) ||
        s.path.split(/[\\/]/).includes('..')
      )
        throw Error('path');
      const b = fs.readFileSync(path.join(dir, s.path));
      if (hash(b) !== s.sha256) throw Error('hash');
      return JSON.parse(b);
    };
    const sources = Object.fromEntries(proof.primarySources.map((s) => [s.key, s])),
      study = read(sources.study),
      district = read(sources.district),
      native = read(proof.nativeIdentity),
      v = study.reportedFacts;
    if (
      sources.study.url !==
        'https://www.researchgate.net/publication/330983827_Conservation_of_Mubarak_Mandi_Complex_Jammu_-_Issues_and_Strategies' ||
      study.authorUploadUrl !== sources.study.url ||
      study.primaryAuthor !== 'Sakshi Sahni' ||
      study.retrieval !== 'public-author-upload-web-text-extraction' ||
      study.imageryUsed !== false ||
      study.allFiguresAndPlansUnused !== true ||
      v.reportedRectangleFeet.join(',') !== '95,36' ||
      v.reportedHeightFeet !== 40 ||
      v.courtyardFacingColumns !== 5 ||
      v.courtyardFacingArches !== 5 ||
      v.oneArchIsEntrance !== true ||
      district.sourceUrl !== 'https://jammu.nic.in/tourist-place/mubarak-mandi-palace/' ||
      district.imageryUsed !== false ||
      district.facts.museum !== 'Dogra Art Museum' ||
      district.facts.building !== 'Pink Hall'
    )
      return fail('pink-hall-written-controls-unbound');
    if (
      P.model !== 'mubarak_mandi_pink_hall' ||
      P.parentModelIdentity !== 'mubarak_mandi_palace' ||
      P.kind !== 'reported-rectangular-palace-hall' ||
      P.representedDate !== '2012-04-01' ||
      P.wholeScope !== 'whole-reported-PinkHall-rectangle-five-courtyard-arches-and-jharokhas' ||
      Math.abs(P.length - 95 * 0.3048) > 1e-9 ||
      Math.abs(P.depth - 36 * 0.3048) > 1e-9 ||
      Math.abs(P.parapetTop - P.floor - 40 * 0.3048) > 1e-9 ||
      P.courtyardArches !== 5 ||
      P.courtyardColumns !== 5 ||
      P.reportedDimensionsAreConfirmedExterior !== false ||
      P.bodyCoordinateSurveyed !== false ||
      P.footprintMeasured !== false ||
      P.heightMeasured !== false ||
      P.allowancesAreMeasuredErrorBounds !== false ||
      P.estimatedHorizontalUncertaintyMeters < 25 ||
      P.estimatedComponentUncertaintyMeters < 2 ||
      native.contextOutlineIsWholePinkHall !== false ||
      native.way.id !== '1135600638' ||
      native.museum.id !== '10585778903' ||
      native.originalContextCentroid.some((v, i) => v !== f.anchor[i]) ||
      native.headingEstimate !== f.heading ||
      !f.geometryLabel.includes('NOT the native ten-corner')
    )
      return fail('pink-hall-whole-scope-or-estimates-disagree');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Primary author written dimensions/bay census and official museum identity retained. Original numerical museum context is explicitly not the whole reported rectangle. All appearance images unused. Reported inside/outside dimensions, exterior details, sections, registration and precise2012condition remain explicit interpretations; whole palace unfinished.',
    };
  } catch {
    return fail('pink-hall-evidence-unreadable');
  }
}
