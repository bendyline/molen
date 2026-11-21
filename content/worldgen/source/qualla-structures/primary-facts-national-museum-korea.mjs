import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const nationalMuseumKoreaCase = 'national-museum-korea-published-massing-and-mapped-plaza';
export const nationalMuseumKoreaModel = 'national_museum_of_korea';

const museumUrl = 'https://www.museum.go.kr/MUSEUM/contents/M0804040000.do';
const designUrl = 'https://junglim.com/en/natl-museum-of-korea/';
const sha256 = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

export function inspectNationalMuseumKoreaFacts({ dir, proof, controls, frame, inventory }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  function checked(record, relative) {
    const bytes = fs.readFileSync(path.join(dir, relative));
    if (record.path !== relative || record.sha256 !== sha256(bytes))
      throw new Error('Source evidence changed');
    return JSON.parse(bytes);
  }
  try {
    const evidence = checked(
      proof.primarySources,
      'reference-rights/museum-architectural-facts.json',
    );
    const excluded = checked(proof.candidateExclusion, 'reference-rights/image-screening.json');
    const map = checked(proof.nativeIdentity, 'native-map/museum-open-plaza-and-pond.json');
    const museum = evidence.sources.find(({ url }) => url === museumUrl)?.facts;
    const design = evidence.sources.find(({ url }) => url === designUrl)?.facts;
    const seen = new Set(
      excluded.candidates.filter(({ reason }) => reason).map(({ path }) => path),
    );
    if (
      evidence.imageryUsed !== false ||
      museum?.lengthMeters !== 404 ||
      museum?.maximumHeightMeters !== 43.08 ||
      design?.openPlaza !== 'roofed and open at both ends' ||
      controls.dimensions.maximumHeight !== museum.maximumHeightMeters ||
      excluded.selectedImages !== 0 ||
      !inventory.candidates.every(({ path }) => seen.has(path))
    )
      return fail('museum-facts-or-exclusions-unbound');

    const way = map.elements.find((r) => r.type === 'way' && r.id === 168364800);
    const rotunda = map.elements.find((r) => r.type === 'way' && r.id === 382079361);
    const nodes = new Map(map.elements.filter((r) => r.type === 'node').map((r) => [r.id, r]));
    const [lon, lat] = frame.anchor;
    const metre = (6378137 * Math.PI) / 180;
    const parallel = metre * Math.cos((lat * Math.PI) / 180);
    const c = Math.cos(frame.heading);
    const s = Math.sin(frame.heading);
    function followsMap(outline, feature) {
      return (
        Array.isArray(outline) &&
        outline.length === feature.nodes.length - 1 &&
        outline.every(([x, z], i) => {
          const node = nodes.get(feature.nodes[i]);
          if (!node) return false;
          const east = (node.lon - lon) * parallel;
          const south = (lat - node.lat) * metre;
          return Math.hypot(x - (c * east - s * south), z - (s * east + c * south)) < 0.001;
        })
      );
    }
    if (
      proof.nativeIdentity.way !== way?.id ||
      way?.tags?.wikidata !== 'Q494407' ||
      rotunda?.tags?.['building:material'] !== 'glass' ||
      frame.sourceHash !== proof.nativeIdentity.sha256 ||
      !followsMap(frame.geometry.outline, way) ||
      !followsMap(controls.dimensions.outline, way) ||
      !followsMap(controls.dimensions.rotunda, rotunda)
    )
      return fail('museum-envelope-or-rotunda-unbound');

    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: sha256(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'Operator, architect and material schedule fix the long wings, maximum height and open-sided canopy. Minor roof changes, glazing bays and stair contours are approximate.',
    };
  } catch {
    return fail('museum-facts-evidence-invalid');
  }
}
