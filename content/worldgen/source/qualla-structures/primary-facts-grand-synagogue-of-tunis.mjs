import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const tunisSynagogueCase = 'tunis-osiris-synagogue-mapped-lot-and-valensi-structure';
export const tunisSynagogueModel = 'grand_synagogue_of_tunis';

const digest = (bytes) => 'sha256:' + createHash('sha256').update(bytes).digest('hex');

function readBound(dir, binding, file) {
  if (binding?.path !== file) throw Error('Unexpected Tunis synagogue source');
  const bytes = readFileSync(join(dir, file));
  if (digest(bytes) !== binding.sha256) throw Error('Unbound Tunis synagogue source');
  return JSON.parse(bytes);
}

export function inspectTunisSynagogueFacts({ dir, controls, frame, proof }) {
  try {
    const map = readBound(dir, proof.nativeIdentity, 'native-map/avenue-de-la-liberte.json');
    const facts = readBound(
      dir,
      proof.primarySources,
      'reference-rights/primary-source-facts.json',
    );
    const [lon, lat] = frame.anchor;
    const meters = (6378137 * Math.PI) / 180;
    const c = Math.cos(frame.heading);
    const s = Math.sin(frame.heading);
    const study = Object.fromEntries(facts.sources.map((source) => [source.key, source.facts]));
    const { outline, dome, frontage } = controls.dimensions;
    const matchesFrame = ([lng, phi], [u, v]) => {
      const x = (lng - lon) * meters * Math.cos((lat * Math.PI) / 180);
      const z = (lat - phi) * meters;
      return Math.hypot(c * x - s * z - u, s * x + c * z - v) < 0.00001;
    };
    if (
      map.site.id !== 95134307 ||
      proof.nativeIdentity.way !== map.site.id ||
      map.site.tags.wikidata !== 'Q3115134' ||
      map.addressStreet.id !== 27570086 ||
      map.addressStreet.tags['name:fr'] !== 'Avenue de la Liberté' ||
      frame.mappedIdentity.wikidataId !== map.site.tags.wikidata ||
      frame.sourceHash !== proof.nativeIdentity.sha256 ||
      controls.model !== tunisSynagogueModel ||
      controls.model !== facts.model ||
      proof.primarySources.use !== 'factual-text-only' ||
      !facts.sources.every((source) => source.use === 'factual-text-only') ||
      study.inha.architect !== 'Victor Valensi' ||
      study.inha.built !== '1933–1937' ||
      study.survey.drumWindows !== 12 ||
      study.survey.drumWindows !== dome.windows ||
      study.compare.flankingPavilions !== frontage.pavilions ||
      study.compare.centralEmblem !== 'Magen David' ||
      map.site.coordinates.length !== outline.length ||
      !map.site.coordinates.every((point, i) => matchesFrame(point, outline[i])) ||
      JSON.stringify(frame.geometry.outline) !== JSON.stringify(outline)
    )
      return { status: 'needs-review', reason: 'tunis-synagogue-control-mismatch' };
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: digest(readFileSync(join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The named site and the east side of Avenue de la Liberté fix the frame. The survey describes twelve chamfered drum windows, a stepped dome and pignon, massive square portico pillars, flanking pavilions, and the Magen David.',
    };
  } catch {
    return { status: 'needs-review', reason: 'tunis-synagogue-facts-invalid' };
  }
}
