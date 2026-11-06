/** Exact original tower technical table identities; no imagery approval. */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => 'sha256:' + createHash('sha256').update(b).digest('hex');
export const augerTowerCases = {
  'auger-primary-whole-coihueco-communications-tower-2005-records-2018':
    'coihueco_communications_tower',
  'auger-primary-whole-los-leones-communications-tower-2005-records-2018':
    'los_leones_communications_tower',
  'auger-primary-whole-los-morados-communications-tower-2005-records-2018':
    'los_morados_communications_tower',
  'auger-primary-whole-loma-amarilla-communications-tower-2005-records-2018':
    'loma_amarilla_communications_tower',
  'auger-primary-whole-malargue-campus-communications-tower-2005-records-2018':
    'malargue_campus_communications_tower',
};
const records = {
  coihueco_communications_tower: {
    utm: [445337, 6114106],
    height: 20,
    faceBearing: 27,
    platforms: [7.5, 12.5, 17, 19],
    antennas: [
      { number: 1, type: 'panel', height: 19, bearing: 49 },
      { number: 2, type: 'panel', height: 19, bearing: 94 },
      { number: 3, type: 'panel', height: 19, bearing: 139 },
      { number: 4, type: 'panel', height: 19, bearing: 184 },
      { number: 5, type: 'panel', height: 14, bearing: 49 },
      { number: 6, type: 'panel', height: 14, bearing: 94 },
      { number: 7, type: 'panel', height: 14, bearing: 139 },
      { number: 8, type: 'panel', height: 14, bearing: 184 },
      { number: 9, type: 'dish', height: 10, bearing: 60.9, diameter: 1.2 },
      { number: 10, type: 'dish', height: 10, bearing: 177.9, diameter: 1.2 },
      { number: 11, type: 'omni', height: 20, bearing: null },
    ],
    tableHash: 'sha256:9499eba621fe9eea8ff5a8547cf902d8e0cbea17e7ec6b6d86e91e3fe9bad610',
    specHash: 'sha256:c750f1497bbdc3b7f27c82630e57733577cc0e3c2011f7d934f39931cf1e2a4e',
    panelHash: 'sha256:a6f9c5c1e88b5224aae70c6aa76b56bcb61cf6bb22e6847a75d996929cb21841',
  },
  los_leones_communications_tower: {
    utm: [459205, 6071832],
    height: 50,
    faceBearing: 90,
    platforms: [10, 20, 30, 38, 48],
    antennas: [
      { number: 1, type: 'panel', height: 39, bearing: 330 },
      { number: 2, type: 'panel', height: 39, bearing: 30 },
      { number: 3, type: 'panel', height: 39, bearing: 90 },
      { number: 4, type: 'panel', height: 34, bearing: 330 },
      { number: 5, type: 'panel', height: 34, bearing: 30 },
      { number: 6, type: 'panel', height: 34, bearing: 90 },
      { number: 7, type: 'dish', height: 49, bearing: 60.5, diameter: 1.2 },
      { number: 8, type: 'dish', height: 49, bearing: 286.6, diameter: 0.6 },
    ],
    tableHash: 'sha256:9499eba621fe9eea8ff5a8547cf902d8e0cbea17e7ec6b6d86e91e3fe9bad610',
    specHash: 'sha256:35812d6829d6ac89221efe2013c8784720882c0eadfb8f41748ff3b91b8aa4f3',
    panelHash: 'sha256:a6f9c5c1e88b5224aae70c6aa76b56bcb61cf6bb22e6847a75d996929cb21841',
  },
  los_morados_communications_tower: {
    utm: [498927, 6094566],
    height: 40,
    faceBearing: 30,
    platforms: [15, 32.5, 37, 39],
    antennas: [
      { number: 1, type: 'panel', height: 39, bearing: 243 },
      { number: 2, type: 'panel', height: 39, bearing: 297 },
      { number: 3, type: 'panel', height: 39, bearing: 337 },
      { number: 4, type: 'panel', height: 39, bearing: 15 },
      { number: 5, type: 'panel', height: 34, bearing: 243 },
      { number: 6, type: 'panel', height: 34, bearing: 297 },
      { number: 7, type: 'panel', height: 34, bearing: 337 },
      { number: 8, type: 'panel', height: 34, bearing: 15 },
      { number: 9, type: 'dish', height: 39, bearing: 240.2, diameter: 1.2 },
      { number: 10, type: 'omni', height: 40, bearing: null },
    ],
    tableHash: 'sha256:9499eba621fe9eea8ff5a8547cf902d8e0cbea17e7ec6b6d86e91e3fe9bad610',
    specHash: 'sha256:90c657bd4776197cdfce0d70c9dc99a8b056382b7e37bfa75420ee6ab44f35f6',
    panelHash: 'sha256:a6f9c5c1e88b5224aae70c6aa76b56bcb61cf6bb22e6847a75d996929cb21841',
  },
  loma_amarilla_communications_tower: {
    utm: [480748, 6134088],
    height: 40,
    faceBearing: 90,
    platforms: [15, 32.5, 37, 39],
    antennas: [
      { number: 1, type: 'panel', height: 39, bearing: 120 },
      { number: 2, type: 'panel', height: 39, bearing: 180 },
      { number: 3, type: 'panel', height: 39, bearing: 240 },
      { number: 4, type: 'panel', height: 34, bearing: 120 },
      { number: 5, type: 'panel', height: 34, bearing: 180 },
      { number: 6, type: 'panel', height: 34, bearing: 240 },
      { number: 7, type: 'dish', height: 39, bearing: 240.7, diameter: 1.2 },
    ],
    tableHash: 'sha256:9499eba621fe9eea8ff5a8547cf902d8e0cbea17e7ec6b6d86e91e3fe9bad610',
    specHash: 'sha256:bf705acb556b96788c218dd1b29748a9eb691d7a591501abd2060fb2bce3c4fc',
    panelHash: 'sha256:a6f9c5c1e88b5224aae70c6aa76b56bcb61cf6bb22e6847a75d996929cb21841',
  },
  malargue_campus_communications_tower: {
    utm: [446984, 6075407],
    height: 50,
    faceBearing: 0,
    platforms: [10, 20, 30, 40, 48],
    antennas: [
      { number: 1, type: 'dish', height: 49, bearing: 357.9, diameter: 1.2 },
      { number: 2, type: 'dish', height: 49, bearing: 106.6, diameter: 0.6 },
      { number: 3, type: 'omni', height: 50, bearing: null },
    ],
    tableHash: 'sha256:9499eba621fe9eea8ff5a8547cf902d8e0cbea17e7ec6b6d86e91e3fe9bad610',
    specHash: 'sha256:fff8020154ff726e09eeef59ba239ce5020c7f47593ea8dee53379e548a794f2',
    panelHash: 'sha256:a6f9c5c1e88b5224aae70c6aa76b56bcb61cf6bb22e6847a75d996929cb21841',
  },
};
export function inspectAugerTowerPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const c = records[P.model],
      s = proof.primarySources?.find((s) => s.key === 'building'),
      n = proof.nativeIdentity;
    for (const p of [s?.path, n?.path])
      if (typeof p !== 'string' || path.isAbsolute(p) || p.split(/[\\/]/).includes('..'))
        return fail('auger-tower-unsafe-path');
    if (
      !c ||
      P.parentModelIdentity !== 'pierre_auger_observatory' ||
      P.kind !== 'communications-tower'
    )
      return fail('auger-tower-wrong-identity');
    const bytes = fs.readFileSync(path.join(dir, n.path)),
      j = JSON.parse(bytes),
      text = fs.readFileSync(path.join(dir, s.path));
    const url =
      'https://hea.cwru.edu/internal/auger/Auger_South_Comms_Systems_Operations_Manual/Communications%20Towers/Auger%20South%20-%20Communications%20Tower%20Antenna%20Data.pdf';
    if (
      s.url !== url ||
      s.use !== 'factual-text-only' ||
      s.sha256 !== hash(text) ||
      !text.toString().includes('all photos, figures, diagrams and plans unused')
    )
      return fail('auger-tower-written-source-unbound');
    for (const [name, k] of [
      ['original-antenna-table.txt', 'tableHash'],
      ['original-tower-spec.txt', 'specHash'],
      ['original-panel-spec.txt', 'panelHash'],
    ])
      if (hash(fs.readFileSync(path.join(dir, 'reference-rights', name))) !== c[k])
        return fail('auger-tower-original-document-changed');
    if (
      hash(bytes) !== n.sha256 ||
      j.key !== P.model ||
      j.recordDate !== '2005-07' ||
      j.sourceUrl !== url ||
      n.featureId !== P.nativeFeatureId ||
      JSON.stringify(j.utm) !== JSON.stringify(c.utm) ||
      JSON.stringify(P.nativeUtm) !== JSON.stringify(c.utm) ||
      JSON.stringify(P.antennas) !== JSON.stringify(c.antennas) ||
      JSON.stringify(j.antennas) !== JSON.stringify(c.antennas) ||
      P.towerHeight !== c.height ||
      P.towerFaceBearingDegrees !== c.faceBearing ||
      JSON.stringify(P.platforms) !== JSON.stringify(c.platforms) ||
      P.estimatedComponentUncertaintyMeters < 1.5 ||
      JSON.stringify(j.anchor) !== JSON.stringify(f.anchor) ||
      f.heading !== 0
    )
      return fail('auger-tower-original-table-identity-or-controls-disagree');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Whole independently named tower and original equipment inventory. Engineering numerical positions/heights/true bearings/dish diameters bound. Lattice widths/brackets/platform shapes/phase carryover explicit estimates; all imagery unused.',
    };
  } catch {
    return fail('auger-tower-evidence-unreadable');
  }
}
