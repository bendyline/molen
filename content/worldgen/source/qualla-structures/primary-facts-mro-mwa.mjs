/** Whole Phase-I MWA tile and original operator southwest corners; no imagery. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
export function inspectMroMwaPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    for (const [key, url, terms] of [
      [
        'system',
        'https://www.cambridge.org/core/journals/publications-of-the-astronomical-society-of-australia/article/murchison-widefield-array-the-square-kilometre-array-precursor-at-low-radio-frequencies/ED20FE56B17C253DAB94836785D887F0',
        [
          'Primary 2013 MWA system authors',
          '128 tiles',
          '5x5m',
          '16 dual-polarisation',
          '1.10m',
          'Every photo, figure, schematic and map unused',
        ],
      ],
      [
        'operator',
        'https://www.mwatelescope.org/telescope/technology/',
        [
          'Primary operator',
          '74cm span and55cm height',
          'Dielectric feet',
          '10cm',
          'LNA hub',
          'Every image, animation and figure unused',
        ],
      ],
      [
        'configuration',
        'https://mwatelescope.atlassian.net/wiki/spaces/MP/pages/24973313/Telescope+Configurations',
        ['August2013', '128T tiles', 'SOUTHWEST corners', 'Every illustration unused'],
      ],
    ]) {
      const s = proof.primarySources?.find((s) => s.key === key);
      if (!s || path.isAbsolute(s.path) || s.path.split(/[\\/]/).includes('..'))
        return fail('mro-mwa-primary-source-unsafe');
      const b = fs.readFileSync(path.join(dir, s.path));
      if (
        s.url !== url ||
        s.use !== 'factual-text-only' ||
        hash(b) !== s.sha256 ||
        !terms.every((t) => b.toString().includes(t))
      )
        return fail('mro-mwa-primary-written-facts-unbound');
    }
    const n = proof.nativeIdentity;
    if (!n || path.isAbsolute(n.path) || n.path.split(/[\\/]/).includes('..'))
      return fail('mro-mwa-native-source-unsafe');
    const bytes = fs.readFileSync(path.join(dir, n.path)),
      data = JSON.parse(bytes),
      rows = data.rows,
      cells = JSON.parse(
        fs.readFileSync(path.join(dir, 'native-map/original-operator-coordinate-cells.json')),
      )['128T tiles'];
    if (
      hash(bytes) !== n.sha256 ||
      n.instanceCount !== 128 ||
      n.coordinateRole !== 'southwest-corner' ||
      data.sheet !== '128T tiles' ||
      rows.length !== 128 ||
      new Set(rows.map((r) => r.tile)).size !== 128 ||
      hash(fs.readFileSync(path.join(dir, 'native-map', data.originalWorkbook))) !==
        data.workbookHash ||
      !cells.some((r) =>
        Object.values(r).some((v) => String(v).includes('South-West tile corners')),
      )
    )
      return fail('mro-mwa-original-workbook-corners-unbound');
    for (const [i, r] of rows.entries()) {
      const j = i + 2,
        c = cells[i + 1];
      if (
        r.sourcePointRole !== 'southwest-corner' ||
        String(c[`A${j}`]) !== r.tile ||
        Math.abs(Number(c[`B${j}`]) - r.latitude) > 1e-12 ||
        Math.abs(Number(c[`C${j}`]) - r.longitude) > 1e-12
      )
        return fail('mro-mwa-original-corner-rows-changed');
    }
    const first = rows.find((r) => r.tile === '11');
    if (
      f.anchor[0] !== first.longitude ||
      f.anchor[1] !== first.latitude ||
      JSON.stringify(f.geometry.polygons) !== '[[[0,0],[5,0],[5,-5],[0,-5]]]'
    )
      return fail('mro-mwa-SW-anchor-or-derived-5m-envelope-changed');
    if (
      P.model !== 'murchison_widefield_array_tile' ||
      P.parentModelIdentity !== 'murchison_radio_astronomy_observatory' ||
      P.wholeScope !==
        'whole-MWA-PhaseI5m-openmesh-16crossedbowties-feet-hubs-beamformer-cables-128originalSWinstances-2013' ||
      P.instanceCount !== 128 ||
      P.coordinateRole !== 'southwest-corner' ||
      P.elements !== 16 ||
      P.screenSize !== 5 ||
      P.dipoleSpacing !== 1.1 ||
      P.dipoleSpan !== 0.74 ||
      P.dipoleHeight !== 0.55 ||
      P.estimatedComponentUncertaintyMeters < 0.3
    )
      return fail('mro-mwa-whole-equipment-scope-or-estimates-disagree');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Complete5mopenmesh/16crossedbowties/feet/LNAhubs/beamformer/cables. Original128operatorSWcorners/workbook retained, laterPhaseII excluded. Primarywrittenfacts only; allimageryunused. Component/finish/grade/LODmesh visibility estimates explicit; parentobservatory incomplete.',
    };
  } catch {
    return fail('mro-mwa-factual-evidence-unreadable');
  }
}
