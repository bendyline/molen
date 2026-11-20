import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const solvaySchoolCase = 'solvay-r42-surveyed-entrance-and-firsthand-building-description';
export const solvaySchoolModel = 'solvay_brussels_school_of_economics_and_management';

const hash = (bytes) => 'sha256:' + createHash('sha256').update(bytes).digest('hex');

function boundDocument(dir, binding, expectedPath) {
  if (binding?.path !== expectedPath) throw Error('Unexpected Solvay School source path');
  const bytes = readFileSync(join(dir, expectedPath));
  if (hash(bytes) !== binding.sha256) throw Error('Unbound Solvay School source');
  return JSON.parse(bytes);
}

export function inspectSolvaySchoolFacts({ dir, controls, frame, proof }) {
  try {
    const map = boundDocument(dir, proof.nativeIdentity, 'native-map/solvay-r42.json');
    const facts = boundDocument(dir, proof.primarySources, 'reference-rights/primary-source-facts.json');
    const sources = Object.fromEntries(facts.sources.map((source) => [source.key, source]));
    const [lon, lat] = frame.anchor;
    const scale = (6378137 * Math.PI) / 180;
    const c = Math.cos(frame.heading);
    const s = Math.sin(frame.heading);
    const samePoint = ([lng, phi], [u, v]) => {
      const x = (lng - lon) * scale * Math.cos((lat * Math.PI) / 180);
      const z = (lat - phi) * scale;
      return Math.hypot(c * x - s * z - u, s * x + c * z - v) < 0.00001;
    };
    const plan = controls.dimensions;
    if (
      proof.nativeIdentity.way !== 84491972 ||
      map.building.id !== proof.nativeIdentity.way ||
      Number(map.building.tags['building:levels']) !== 5 ||
      map.school.id !== 12379370034 || map.school.tags.wikidata !== 'Q3247899' ||
      map.entrance.id !== 981664995 || map.entrance.tags['addr:housenumber'] !== '42' ||
      frame.mappedIdentity?.wikidataId !== map.school.tags.wikidata ||
      proof.nativeIdentity.sha256 !== frame.sourceHash ||
      facts.model !== solvaySchoolModel || controls.model !== facts.model ||
      proof.primarySources.use !== 'factual-text-only' ||
      !facts.sources.every((source) => source.use === 'factual-text-only') ||
      sources.owner?.facts.wings !== 2 || sources.owner.facts.siteChangeMeters !== 12 ||
      sources.owner.facts.roof !== 'rounded white overhang' ||
      sources.owner.facts.outerCladding !== 'turquoise-patinated copper' ||
      sources.engineer?.facts.aboveGroundLevels !== 5 ||
      map.building.coordinates.length !== plan.outline.length ||
      JSON.stringify(frame.geometry.outline) !== JSON.stringify(plan.outline) ||
      !map.building.coordinates.every((point, i) => samePoint(point, plan.outline[i])) ||
      !samePoint([map.entrance.lon, map.entrance.lat], plan.surveyedEntrance)
    ) return { status: 'needs-review', reason: 'solvay-r42-control-mismatch' };

    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(readFileSync(join(dir, 'primary-facts-reconstruction.json'))),
      notes: 'The surveyed number 42 entrance, five-storey shell footprint and named university establish the placement. ULB and the structural engineer substantiate the two wings, slope, copper cladding, five levels and rounded canopy.',
    };
  } catch {
    return { status: 'needs-review', reason: 'solvay-r42-facts-invalid' };
  }
}
