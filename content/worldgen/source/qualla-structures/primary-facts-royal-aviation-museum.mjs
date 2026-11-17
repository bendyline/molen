import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const royalAviationCase = 'winnipeg-royal-aviation-museum-mapped-post-2022';

const id = 'royal_aviation_museum_of_western_canada';
export const royalAviationModel = id;

function hash(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function loadEvidence(dir, evidence, name) {
  if (evidence?.path !== name) throw Error('Unexpected aviation museum evidence path');
  const bytes = fs.readFileSync(path.join(dir, name));
  if (hash(bytes) !== evidence.sha256) throw Error('Aviation museum evidence hash mismatch');
  return JSON.parse(bytes);
}

export function inspectRoyalAviationPrimaryFacts({ dir, proof, controls, frame, inventory }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const archive = loadEvidence(
      dir,
      proof.primarySources,
      'reference-rights/airport-museum-facts.json',
    );
    const excluded = loadEvidence(
      dir,
      proof.candidateExclusion,
      'reference-rights/article-image-exclusions.json',
    );
    const native = loadEvidence(
      dir,
      proof.nativeIdentity,
      'native-map/osm-royal-aviation-museum.json',
    );
    const owner = archive.sources.find(
      ({ url }) => url === 'https://www.royalaviationmuseum.com/our-new-home-one-year-later/',
    );
    const designer = archive.sources.find(
      ({ url }) =>
        url ===
        'https://architecture49.com/en/portfolio/projects/royal-aviation-museum-of-western-canada/',
    );
    const builder = archive.sources.find(
      ({ url }) =>
        url === 'https://www.pcl.com/ca/en/our-work/royal-aviation-museum-of-western-canada',
    );
    const known = new Map(excluded.candidates.map((row) => [row.sourceUrl, row.reason]));
    if (
      archive.mode !== 'factual-text-only' ||
      archive.imageryUsed !== false ||
      proof.primarySources.use !== archive.mode ||
      owner?.facts.address !== '2088 Wellington Avenue' ||
      owner.facts.glazedCorner !== 'northwest' ||
      owner.facts.glazedCornerLevels !== 3 ||
      designer?.facts.floorAreaSquareMeters !== 7958 ||
      designer.facts.envelope !== 'metal panels and glass' ||
      builder?.facts.section !== 'single hangar storey with a mezzanine' ||
      excluded.selectedImages !== 0 ||
      !inventory?.candidates.every(({ sourceUrl }) => known.get(sourceUrl)?.trim())
    )
      return fail('aviation-museum-architecture-or-excluded-imagery-unbound');

    const way = native.elements.find((row) => row.type === 'way' && row.id === 1044672921);
    const site = native.elements.find((row) => row.type === 'way' && row.id === 1298193366);
    const door = native.elements.find((row) => row.type === 'node' && row.id === 11841783427);
    const points = new Map(
      native.elements.filter(({ type }) => type === 'node').map((p) => [p.id, p]),
    );
    const outline = frame.geometry.outline;
    const [lon, lat] = frame.anchor;
    const rad = Math.PI / 180;
    const scale = 6378137 * Math.cos(lat * rad);
    const northing = (latitude) => Math.asinh(Math.tan(latitude * rad));
    const cos = Math.cos(frame.heading);
    const sin = Math.sin(frame.heading);
    const close = (node, point) => {
      const x = (node.lon - lon) * rad * scale;
      const z = (northing(lat) - northing(node.lat)) * scale;
      return Math.hypot(cos * x - sin * z - point[0], sin * x + cos * z - point[1]) < 0.000008;
    };
    if (
      controls.model !== id ||
      proof.nativeIdentity.way !== way?.id ||
      way.tags.building !== 'museum' ||
      way.tags['addr:housenumber'] !== '2088' ||
      way.tags['addr:street'] !== 'Wellington Avenue' ||
      site?.tags.wikidata !== 'Q3567485' ||
      frame.mappedIdentity.wikidataId !== site.tags.wikidata ||
      door?.tags.entrance !== 'main' ||
      !way.nodes.includes(door.id) ||
      !close(door, frame.terrainContact.local) ||
      outline.length !== way.nodes.length - 1 ||
      !way.nodes.slice(0, -1).every((n, i) => close(points.get(n), outline[i]))
    )
      return fail('aviation-museum-native-address-or-geometry-unbound');

    const section = controls.section;
    const { eaveHeights, glazedCornerEdges, ridge } = section;
    if (
      !section.estimated ||
      eaveHeights.length !== outline.length ||
      !eaveHeights.every((height) => Number.isFinite(height) && height > 0) ||
      ridge.length !== 3 ||
      !ridge.every(Number.isFinite) ||
      glazedCornerEdges.join(',') !== '1,11' ||
      eaveHeights[0] !== Math.max(...eaveHeights) ||
      section.mezzanineCount !== 1
    )
      return fail('aviation-museum-estimated-section-invalid');

    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The mapped modern museum and entrance match 2088 Wellington Avenue. The owner, architect and builder document the angled glazed corner, metal envelope and hangar-and-mezzanine design. Roof section and fine details are estimates.',
    };
  } catch {
    return fail('aviation-museum-primary-facts-invalid');
  }
}
