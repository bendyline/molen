import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const ddrMuseumCase = 'berlin-ddr-museum-riverfront-host-wing';
export const ddrMuseumModel = 'ddr_museum';

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const museumFaq = 'https://www.ddr-museum.de/en/visit/faq';
const facadeEngineer =
  'https://priedemann.net/en/projects/projectdb/domaquaree.html?varClass=false&varValue=';

function readEvidence(dir, receipt, file) {
  if (receipt?.path !== file) throw new Error(`Unexpected DDR Museum evidence ${file}`);
  const bytes = readFileSync(join(dir, file));
  if (hash(bytes) !== receipt.sha256) throw new Error(`DDR Museum evidence changed ${file}`);
  return JSON.parse(bytes);
}

export function inspectDdrMuseumFacts({ dir, proof, controls, frame, inventory }) {
  const needsReview = (reason) => ({ status: 'needs-review', reason });
  try {
    const facts = readEvidence(
      dir,
      proof.primarySources,
      'reference-rights/riverfront-building-facts.json',
    );
    const { elements } = readEvidence(
      dir,
      proof.nativeIdentity,
      'native-map/ddr-museum-and-riverfront-wing.json',
    );
    const map = new Map(elements.map((element) => [element.id, element]));
    const [museum, entrance, hotel, stairs] = [175149971, 4237857593, 12706358, 48095488].map(
      (id) => map.get(id),
    );
    if (
      museum?.tags?.wikidata !== 'Q573322' ||
      museum.tags.level !== '-1' ||
      entrance?.tags?.entrance !== 'yes' ||
      frame.anchor.some((value, i) => value !== [entrance.lon, entrance.lat][i]) ||
      hotel?.tags?.building !== 'hotel' ||
      hotel.tags['building:levels'] !== '7' ||
      !hotel.members.some(({ ref, role }) => ref === 202156992 && role === 'outer') ||
      stairs?.tags?.step_count !== '16' ||
      frame.mappedIdentity.museum !== museum.id ||
      frame.mappedIdentity.host !== hotel.id
    )
      return needsReview('ddr-museum-entrance-host-wing-or-stair-not-bound');

    if (
      facts.mode !== 'factual-text-only' ||
      facts.imageryUsed !== false ||
      ![museumFaq, facadeEngineer].every((url) => facts.sources.some((row) => row.url === url)) ||
      controls.dimensions.hostFloors !== 7 ||
      controls.dimensions.hostHeight !== 30 ||
      !inventory.candidates.every(({ path, sourceUrl }) =>
        facts.excludedImages.some(
          (row) => row.path === path && row.sourceUrl === sourceUrl && row.reason,
        ),
      )
    )
      return needsReview('ddr-museum-riverfront-facts-or-imagery-exclusions-not-bound');

    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(readFileSync(join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The museum entrance and approach, seven-storey host wing and stone and glazed exterior are bound to mapped records and written evidence. Exact materials, openings, and upper and lower structure details are approximate.',
    };
  } catch {
    return needsReview('ddr-museum-riverfront-facts-invalid');
  }
}
