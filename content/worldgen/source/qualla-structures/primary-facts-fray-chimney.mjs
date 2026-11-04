/** Whole civil chimney and numeric flue mouths, never a reduced proxy for the entire mill. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const hash = (b) => 'sha256:' + createHash('sha256').update(b).digest('hex');
export function inspectFrayChimneyPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const required = ['builder', 'flues', 'summary'],
      sources = Object.fromEntries(proof.primarySources.map((s) => [s.key, s]));
    for (const s of [...required.map((k) => sources[k]), proof.nativeIdentity]) {
      if (
        typeof s?.path !== 'string' ||
        path.isAbsolute(s.path) ||
        s.path.split(/[\\/]/).includes('..')
      )
        return fail('fray-chimney-unsafe-source');
      if (hash(fs.readFileSync(path.join(dir, s.path))) !== s.sha256)
        return fail('fray-chimney-source-hash-unbound');
    }
    const builder = fs
        .readFileSync(path.join(dir, sources.builder.path), 'utf8')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' '),
      j = JSON.parse(fs.readFileSync(path.join(dir, proof.nativeIdentity.path))),
      node = j.elements.find((e) => e.type === 'node' && e.id === 10263472316),
      works = j.elements.find((e) => e.type === 'way' && e.id === 119015899),
      flues = JSON.parse(fs.readFileSync(path.join(dir, sources.flues.path)));
    if (
      sources.builder.url !== 'https://www.cosud.com/proyecto/109' ||
      sources.builder.use !== 'factual-text-only' ||
      !builder.includes('Altura total de la chimenea 117 m.') ||
      !builder.includes('Botnia') ||
      !builder.includes('Fray Bentos')
    )
      return fail('fray-chimney-builder-height-unbound');
    if (
      node?.tags.man_made !== 'chimney' ||
      works?.tags.name !== 'Planta UPM' ||
      works.tags.product !== 'pulp' ||
      proof.nativeIdentity.featureId !== 'node/10263472316' ||
      f.anchor.some((v, i) => v !== [node.lon, node.lat][i])
    )
      return fail('fray-chimney-original-point-unbound');
    if (
      sources.flues.url !==
        'https://ri.unsam.edu.ar/bitstream/123456789/1299/1/TDOC%203IA%202016%20OEE.pdf' ||
      sources.flues.use !== 'numerical-data-only' ||
      flues.sourceUrl !== sources.flues.url ||
      !flues.appearanceUnused ||
      flues.records.length !== 5 ||
      flues.records.some(
        (r, i) => r.diameterMeters !== [4.6, 2.5, 1.5, 1.2, 0.3][i] || r.heightMeters !== 120,
      )
    )
      return fail('fray-chimney-numerical-flues-unbound');
    if (
      P.model !== 'fray_bentos_mill_main_chimney' ||
      P.parentModelIdentity !== 'fray_bentos_pulp_mill' ||
      P.kind !== 'multiflue-concrete-chimney' ||
      P.originalNativeNode !== 10263472316 ||
      P.civilHeight !== 117 ||
      Math.abs(P.shellTop - P.floor - 117) > 1e-8 ||
      P.flues.length !== 5 ||
      P.flues.some(
        (r, i) => r.diameterMeters !== flues.records[i].diameterMeters || r.top !== P.floor + 120,
      ) ||
      P.estimatedRadiusUncertaintyMeters < 3 ||
      P.estimatedHeightUncertaintyMeters < 3 ||
      P.estimatedComponentUncertaintyMeters < 2 ||
      !f.geometryLabel.includes('NOT a native mapped footprint')
    )
      return fail('fray-chimney-whole-scope-or-estimates-disagree');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Original actual mill chimney point and builder117m civil height; five original numerical flue diameters/120m exhaust reference. Radius/taper/centres/projection/gallery/finish/grade estimates explicit. Every image unused; parent mill unfinished.',
    };
  } catch {
    return fail('fray-chimney-evidence-unreadable');
  }
}
