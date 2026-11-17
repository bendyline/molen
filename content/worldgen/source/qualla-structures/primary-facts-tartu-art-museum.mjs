import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const tartuArtMuseumCase = 'tartu-leaning-house-documented-lean-and-classical-facades';
export const tartuArtMuseumModel = 'tartu_art_museum';
const museumUrl = 'https://en.tartmus.ee/tickets/leaning-house/';
const studyUrl = 'https://www.eek.ee/publications/2012/Toimetised_nr_1._Kujundeist_kujunduseks.pdf';
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

export function inspectTartuArtMuseumFacts({ dir, proof, controls, frame, inventory }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  function read(record, expectedPath) {
    const bytes = fs.readFileSync(path.join(dir, expectedPath));
    if (record.path !== expectedPath || hash(bytes) !== record.sha256)
      throw new Error('Evidence path or hash mismatch');
    return JSON.parse(bytes);
  }
  try {
    const facts = read(proof.primarySources, 'reference-rights/leaning-house-facts.json');
    const exclusions = read(
      proof.candidateExclusion,
      'reference-rights/article-image-exclusions.json',
    );
    const footprint = read(proof.nativeIdentity, 'native-map/footprint.json');
    const museum = facts.sources.find(({ url }) => url === museumUrl)?.facts;
    const study = facts.sources.find(({ url }) => url === studyUrl)?.facts;
    const reviewed = new Set(
      exclusions.candidates.filter((row) => row.reason).map((row) => row.path),
    );
    if (
      facts.imageryUsed !== false ||
      museum?.address !== 'Raekoja plats 18' ||
      museum.storeys !== 3 ||
      museum.leanDegrees !== 5.8 ||
      study?.settledSide !== 'Kompanii Street' ||
      study.squareFrontage !== 'narrow with a bracketed balcony' ||
      exclusions.selectedImages !== 0 ||
      !inventory.candidates.every(({ path: imagePath }) => reviewed.has(imagePath))
    )
      return fail('tartu-description-or-image-exclusions-unbound');

    const way = footprint.elements.find(
      (item) => item.type === 'way' && item.id === proof.nativeIdentity.way,
    );
    const nodes = new Map(
      footprint.elements.filter((item) => item.type === 'node').map((item) => [item.id, item]),
    );
    const [lon, lat] = frame.anchor;
    const meters = (Math.PI / 180) * 6378137;
    const longitudeScale = meters * Math.cos((Math.PI / 180) * lat);
    if (
      way?.id !== 30236108 ||
      way.tags.wikidata !== 'Q20530284' ||
      way.tags['maaamet:ETAK'] !== '642094' ||
      frame.sourceHash !== proof.nativeIdentity.sha256 ||
      frame.heading !== 0 ||
      frame.geometry.outline.length !== way.nodes.length - 1 ||
      controls.dimensions.leanDegrees !== museum.leanDegrees ||
      !frame.geometry.outline.every(([x, z], i) => {
        const node = nodes.get(way.nodes[i]);
        return (
          Math.hypot((node.lon - lon) * longitudeScale - x, (lat - node.lat) * meters - z) < 0.001
        );
      })
    )
      return fail('tartu-footprint-or-lean-unbound');

    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'Museum documentation supplies the three storeys and 5.8° lean. The architectural record and mapped footprint establish the settled side and layout. Roof heights, opening spacing and palette are estimates.',
    };
  } catch {
    return fail('tartu-evidence-invalid');
  }
}
