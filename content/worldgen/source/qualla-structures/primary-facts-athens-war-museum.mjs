import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const athensWarMuseumCase = 'athens-war-museum-native-1231213-open-atrium';
export const athensWarMuseumModel = 'athens_war_museum';

function hash(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function readRecord(dir, evidence, name) {
  if (evidence?.path !== name) throw Error('Unexpected museum evidence path');
  const bytes = readFileSync(join(dir, name));
  if (hash(bytes) !== evidence.sha256) throw Error('Museum evidence hash mismatch');
  return JSON.parse(bytes);
}

export function inspectAthensWarMuseumFacts({ dir, controls, frame, proof }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const native = readRecord(dir, proof.nativeIdentity, 'native-map/roof-and-atrium.json');
    const sources = readRecord(
      dir,
      proof.primarySources,
      'reference-rights/primary-source-facts.json',
    );
    const tourism = sources.sources.find(
      ({ url }) =>
        url === 'https://www.visitgreece.gr/en/experiences/nature/beaches/athens-war-museum',
    );
    const originalResearch = sources.sources.find(
      ({ url }) => url === 'https://doi.org/10.1017/pub.2026.10319',
    );
    if (
      sources.format !== 'molen/primary-architectural-facts@1' ||
      sources.model !== athensWarMuseumModel ||
      proof.primarySources.use !== 'factual-text-only' ||
      tourism?.use !== 'factual-text-only' ||
      tourism.facts.bauhausInfluence !== true ||
      originalResearch?.use !== 'factual-text-only' ||
      originalResearch.facts.cantileveredGallery !== true ||
      originalResearch.facts.openAirSquareAtrium !== true ||
      originalResearch.facts.recessedLowerFloor !== true
    )
      return fail('athens-war-museum-written-facts-unbound');

    const [lon, lat] = frame.anchor;
    const radians = Math.PI / 180;
    const meters = radians * 6378137;
    const c = Math.cos(frame.heading),
      s = Math.sin(frame.heading);
    const matches = ([a, b], [u, v]) => {
      const x = (a - lon) * meters * Math.cos(lat * radians);
      const z = (lat - b) * meters;
      return Math.hypot(c * x - s * z - u, s * x + c * z - v) < 0.000008;
    };
    const mapped = (way, role, count, outline) =>
      way.nodes.length === count &&
      outline.length === count &&
      way.nodes.every((point, i) => matches(point, outline[i])) &&
      native.relation.members.some(
        ({ type, ref, role: use }) => type === 'way' && Number(ref) === way.id && use === role,
      );
    const { outer, atrium, gallerySoffit, upperTop, plazaY } = controls.dimensions;
    if (
      frame.mappedIdentity.wikidataId !== 'Q1788831' ||
      native.ways.site.tags.wikidata !== frame.mappedIdentity.wikidataId ||
      native.ways.site.id !== 318587299 ||
      frame.mappedIdentity.relation !== 1231213 ||
      native.relation.id !== proof.nativeIdentity.relation ||
      native.relation.id !== frame.mappedIdentity.relation ||
      frame.sourceUrl !== 'https://www.openstreetmap.org/relation/1231213' ||
      native.sourceUrl !== frame.sourceUrl ||
      frame.sourceHash !== proof.nativeIdentity.sha256 ||
      native.ways.outer.id !== 27599927 ||
      native.ways.atrium.id !== 82150733 ||
      !mapped(native.ways.outer, 'outer', 5, frame.geometry.outline) ||
      !mapped(native.ways.atrium, 'inner', 4, frame.geometry.holes[0]) ||
      JSON.stringify(outer) !== JSON.stringify(frame.geometry.outline) ||
      JSON.stringify(atrium) !== JSON.stringify(frame.geometry.holes[0]) ||
      controls.model !== athensWarMuseumModel ||
      !controls.dimensions.estimatedHeights ||
      !Number.isFinite(plazaY) ||
      !(gallerySoffit > 2 && gallerySoffit < upperTop)
    )
      return fail('athens-war-museum-footprint-or-controls-unbound');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(readFileSync(join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'Verified the Athens War Museum building perimeter, open square atrium and contemporary owner and firsthand written sources. Vertical dimensions, plaza steps and bay subdivisions are estimates.',
    };
  } catch {
    return fail('athens-war-museum-facts-invalid');
  }
}
