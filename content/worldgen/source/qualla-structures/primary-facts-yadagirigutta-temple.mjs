import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const yadagiriguttaCase = 'yadagirigutta-hilltop-engineered-main-gate-and-stone-hall';
export const yadagiriguttaModel = 'sri_lakshmi_narasimha_swamy_temple_yadagirigutta';

const digest = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

function boundDocument(dir, binding, expectedPath) {
  if (binding?.path !== expectedPath) throw Error('Unexpected Yadagirigutta source path');
  const bytes = readFileSync(join(dir, expectedPath));
  if (digest(bytes) !== binding.sha256) throw Error('Unbound Yadagirigutta source');
  return JSON.parse(bytes);
}

export function inspectYadagiriguttaFacts({ dir, controls, frame, proof }) {
  try {
    const native = boundDocument(dir, proof.nativeIdentity, 'native-map/hilltop-core.json');
    const facts = boundDocument(
      dir,
      proof.primarySources,
      'reference-rights/primary-source-facts.json',
    );
    const [lon, lat] = frame.anchor;
    const meters = (6378137 * Math.PI) / 180;
    const c = Math.cos(frame.heading);
    const s = Math.sin(frame.heading);
    const source = Object.fromEntries(facts.sources.map((item) => [item.key, item.facts]));
    const { outline, mainGate, hall } = controls.dimensions;
    const matchesPoint = ([lng, phi], [u, v]) => {
      const x = (lng - lon) * meters * Math.cos((lat * Math.PI) / 180);
      const z = (lat - phi) * meters;
      return Math.hypot(c * x - s * z - u, s * x + c * z - v) < 0.00001;
    };
    if (
      native.way.id !== 204532940 ||
      proof.nativeIdentity.way !== native.way.id ||
      native.way.tags.wikidata !== 'Q8046503' ||
      frame.mappedIdentity.wikidataId !== native.way.tags.wikidata ||
      frame.sourceHash !== proof.nativeIdentity.sha256 ||
      controls.model !== yadagiriguttaModel ||
      facts.model !== controls.model ||
      proof.primarySources.use !== 'factual-text-only' ||
      !facts.sources.every((item) => item.use === 'factual-text-only') ||
      source.engineer.opened !== '2022-03-28' ||
      source.engineer.stone !== 'black charnockite' ||
      mainGate.height !== source.engineer.gatewayMeters ||
      mainGate.tiers !== source.engineer.gatewayStories ||
      Math.abs(hall.width / 0.3048 - source.sthapathi.hallWidthFeet) > 0.001 ||
      Math.abs(hall.depth / 0.3048 - source.sthapathi.hallDepthFeet) > 0.001 ||
      native.way.coordinates.length !== outline.length ||
      !native.way.coordinates.every((point, i) => matchesPoint(point, outline[i])) ||
      JSON.stringify(frame.geometry.outline) !== JSON.stringify(outline)
    )
      return { status: 'needs-review', reason: 'yadagirigutta-engineered-controls-mismatch' };
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: digest(readFileSync(join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The named native hilltop outline, the project engineer’s 22 m seven-storey gate and black stone descriptions, and the temple sthapathi’s hall dimensions bound the original geometry.',
    };
  } catch {
    return { status: 'needs-review', reason: 'yadagirigutta-facts-invalid' };
  }
}
