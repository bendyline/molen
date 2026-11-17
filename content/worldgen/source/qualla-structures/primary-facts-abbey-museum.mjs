import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const abbeyMuseumCase = 'abbey-museum-mapped-envelope-and-gallery-extension';
export const abbeyMuseumModel = 'abbey_museum_of_art_and_archaeology';

const announcement =
  'https://abbeymuseum.com.au/abbey-museum-wins-gamaa-award-for-sustainable-practices/';
const access = 'https://abbeymuseum.com.au/accessibility/';
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

export function inspectAbbeyMuseumFacts({ dir, proof, controls, frame, inventory }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  function read(record, expected) {
    const bytes = fs.readFileSync(path.join(dir, expected));
    if (record.path !== expected || hash(bytes) !== record.sha256)
      throw new Error('Evidence path or hash mismatch');
    return JSON.parse(bytes);
  }
  try {
    const sources = read(proof.primarySources, 'reference-rights/museum-facts.json');
    const exclusions = read(
      proof.candidateExclusion,
      'reference-rights/article-image-exclusions.json',
    );
    const footprint = read(proof.nativeIdentity, 'native-map/footprint.json');
    const project = sources.sources.find(({ url }) => url === announcement)?.facts;
    const entrance = sources.sources.find(({ url }) => url === access)?.facts;
    const reviewed = new Set(
      exclusions.candidates.filter(({ reason }) => reason).map(({ path }) => path),
    );
    if (
      sources.imageryUsed !== false ||
      project?.extensionCompleted !== '2024-06' ||
      !project.gallery ||
      !project.cafe ||
      entrance?.door !== 'paired automatic glass sliding doors' ||
      entrance?.stepFree !== true ||
      exclusions.selectedImages !== 0 ||
      !inventory.candidates.every((entry) => reviewed.has(entry.path))
    )
      return fail('abbey-museum-facts-or-exclusions-unbound');

    const way = footprint.elements.find(
      (entry) => entry.type === 'way' && entry.id === proof.nativeIdentity.way,
    );
    const nodes = new Map(
      footprint.elements.filter((entry) => entry.type === 'node').map((entry) => [entry.id, entry]),
    );
    const [lon, lat] = frame.anchor;
    const m = (6378137 * Math.PI) / 180;
    const scale = m * Math.cos((lat * Math.PI) / 180);
    if (
      way?.id !== 272207636 ||
      way.tags.wikidata !== 'Q17000681' ||
      frame.sourceHash !== proof.nativeIdentity.sha256 ||
      frame.heading !== 0 ||
      frame.geometry.outline.length !== way.nodes.length - 1 ||
      controls.dimensions.entranceWay !== 1157300963 ||
      !frame.geometry.outline.every(([x, z], i) => {
        const node = nodes.get(way.nodes[i]);
        return Math.hypot((node.lon - lon) * scale - x, (lat - node.lat) * m - z) < 0.001;
      })
    )
      return fail('abbey-museum-footprint-unbound');

    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The named map outline fixes the museum envelope, and the museum and builder describe the current public entrance and addition. Roof divisions, finish and the exact extension boundary are estimates.',
    };
  } catch {
    return fail('abbey-museum-evidence-invalid');
  }
}
