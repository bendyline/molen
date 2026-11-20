import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const danboJingchengCase = 'chengde-main-audience-hall-native-core-and-written-dimensions';
export const danboJingchengModel = 'danbo_jingcheng_hall';

const digest = (bytes) => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function inspectDanboJingchengFacts({ dir, proof, controls, frame, inventory }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  function readBound(record, expectedPath) {
    const bytes = readFileSync(path.join(dir, expectedPath));
    if (record.path !== expectedPath || record.sha256 !== digest(bytes))
      throw new Error('Danbo Jingcheng evidence changed');
    return JSON.parse(bytes);
  }
  try {
    const map = readBound(proof.nativeIdentity, 'native-map/danbo-jingcheng-core-footprint.json');
    const written = readBound(
      proof.primarySources,
      'reference-rights/danbo-architectural-facts.json',
    );
    const excluded = readBound(
      proof.candidateExclusion,
      'reference-rights/qualla-image-screening.json',
    );
    const owner = written.sources.find(({ url }) => url === map.namedSitePin.sourceUrl)?.facts;
    const dimensions = written.sources.find(({ facts }) => facts.facadeBayCount)?.facts;
    const rejected = new Set(
      excluded.candidates.filter(({ reason }) => reason).map(({ path }) => path),
    );
    const d = controls.dimensions;
    if (
      written.imageryUsed !== false ||
      excluded.selectedImages !== 0 ||
      !inventory.candidates.every(({ path }) => rejected.has(path)) ||
      owner?.rebuiltYear !== 1754 ||
      owner?.timber !== 'nanmu' ||
      dimensions?.facadeBayCount !== 7 ||
      dimensions?.depthBayCount !== 3 ||
      dimensions?.reportedAreaSqM !== 583 ||
      d.facadeBayCount !== 7 ||
      d.depthBayCount !== 3 ||
      d.reportedAreaSqM !== 583
    )
      return fail('danbo-written-architecture-or-exclusions-unbound');
    if (
      map.resort.tags.wikidata !== 'Q1046818' ||
      map.ways[0].id !== 560253561 ||
      map.namedSitePin.name !== '澹泊敬诚' ||
      !same(map.namedSitePin.gcj02, [117.941658, 40.983112]) ||
      Math.hypot(...map.namedSitePin.local) > 20 ||
      frame.sourceHash !== proof.nativeIdentity.sha256 ||
      !same(frame.geometry.outline, map.outline) ||
      !same(d.outline, map.outline)
    )
      return fail('danbo-native-palace-axis-or-padding-unbound');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: digest(readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The named operator waypoint and mapped palace-axis core identify the hall. Seven facade bays, three depth bays, nanmu construction and the roof type are documented. The outer gallery and roof dimensions are estimated.',
    };
  } catch {
    return fail('danbo-jingcheng-evidence-invalid');
  }
}
