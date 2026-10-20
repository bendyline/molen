#!/usr/bin/env node
/** Audit existing references and shortlist public-domain replacements from the
 * same stories' published Qualla media. No downloads, model edits or visual
 * approvals occur here; the shortlist is explicitly pending visual inspection.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  inspectImageryPolicy,
  PUBLIC_DOMAIN_POLICY,
  publicDomainLabel,
} from './imagery-policy.mjs';
import { collectReferences } from './prepare-batch.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const read = (p) => JSON.parse(fs.readFileSync(p));
export function auditImagery({
  repository = root,
  qualla = path.resolve(repository, '../qualla-internal'),
  output = path.join(repository, 'content/worldgen/source/qualla-structures'),
} = {}) {
  const batch = read(path.join(output, 'batches/qualla-001.json'));
  const models = batch.entries.map((entry) => {
    const manifestPath = path.join(repository, entry.sourcePath, 'reference-images.json');
    const manifest = read(manifestPath);
    const current = inspectImageryPolicy({
      qualla,
      references: manifest.references,
      stories: manifest.stories,
      conflicts: manifest.metadataConflicts,
    });
    const { candidates, conflicts } = collectReferences(
      qualla,
      [{ stories: manifest.stories }],
      entry,
    );
    const replacements = candidates
      .filter((r) => publicDomainLabel(r.license))
      .flatMap((reference) => {
        const result = inspectImageryPolicy({
          qualla,
          references: [reference],
          stories: manifest.stories,
          conflicts,
          allowUnhashed: true,
        }).references[0];
        if (!result.eligible) return [];
        return [
          {
            ...reference,
            ...result,
            sha256: createHash('sha256')
              .update(fs.readFileSync(path.join(qualla, reference.path)))
              .digest('hex'),
            visuallyReviewedForThisPolicy: false,
          },
        ];
      });
    return {
      model: entry.modelIdentity,
      name: entry.name,
      sourcePath: entry.sourcePath,
      referenceManifestSha256: createHash('sha256')
        .update(fs.readFileSync(manifestPath))
        .digest('hex'),
      current,
      replacements,
      next:
        current.status === 'passed'
          ? 'Existing selected references satisfy provenance policy; retain current visual/geometry checks.'
          : replacements.length
            ? 'Inspect qualifying Qualla originals, select useful views, then renew source/reference and model review evidence.'
            : 'No eligible image found in these published Qualla story records. Leave imagery review pending; exclude uncertain sources.',
    };
  });
  const document = {
    format: 'molen/structure-imagery-audit@1',
    policy: PUBLIC_DOMAIN_POLICY,
    instructions:
      'Public domain only. Start with imagery already cleared on Qualla. Exclude uncertainty without asking the user about sources.',
    clearanceEvidence:
      'An exact local media path in a story’s published _c media, matching original _m attribution and public-domain basis. Merely downloaded gallery files and AI review scores are insufficient.',
    counts: {
      models: models.length,
      selectedReferences: models.reduce((n, m) => n + m.current.references.length, 0),
      eligibleSelectedReferences: models.reduce(
        (n, m) => n + m.current.references.filter((r) => r.eligible).length,
        0,
      ),
      compliantSelectedSets: models.filter((m) => m.current.status === 'passed').length,
      modelsWithReplacementCandidates: models.filter((m) => m.replacements.length).length,
      replacementCandidates: models.reduce((n, m) => n + m.replacements.length, 0),
    },
    models,
  };
  const destination = path.join(output, 'batches/PUBLIC-DOMAIN-IMAGERY.json');
  const bytes = `${JSON.stringify(document, null, 2)}\n`;
  if (!fs.existsSync(destination) || fs.readFileSync(destination, 'utf8') !== bytes)
    fs.writeFileSync(destination, bytes);
  return document.counts;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  console.log(auditImagery());
