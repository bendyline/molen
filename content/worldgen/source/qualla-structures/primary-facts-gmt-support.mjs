/** GMT support buildings: whole numerical outlines, learned heights, explicit exterior estimates. */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
export const gmtSupportCases = {
  'gmt-original-northern-support-building-2023': 'giant_magellan_northern_support_building',
  'gmt-original-central-support-building-2023': 'giant_magellan_central_support_building',
  'gmt-original-southern-support-building-2023': 'giant_magellan_southern_support_building',
  'gmt-original-eastern-support-building-2023': 'giant_magellan_eastern_support_building',
  'gmt-original-northwestern-support-building-2023': 'giant_magellan_northwestern_support_building',
  'gmt-original-western-support-building-2023': 'giant_magellan_western_support_building',
  'gmt-original-outer-western-support-building-2023':
    'giant_magellan_outer_western_support_building',
  'gmt-original-western-technical-support-building-2023':
    'giant_magellan_western_technical_support_building',
  'gmt-original-central-technical-support-building-2023':
    'giant_magellan_central_technical_support_building',
  'gmt-original-eastern-technical-support-building-2023':
    'giant_magellan_eastern_technical_support_building',
  'gmt-original-eastern-summit-support-building-2023':
    'giant_magellan_eastern_summit_support_building',
};
const expected = {
  giant_magellan_northern_support_building: ['3ce4b908-9c2c-4d86-b4e6-a9034d30cdc7', 4, 44, 10],
  giant_magellan_central_support_building: ['3a70c7ba-b3da-484e-b389-2eab85313f60', 8, 50, 6.5],
  giant_magellan_southern_support_building: ['32814e0c-0fde-4ea4-9d3c-05f99bda3873', 6, 22, 6],
  giant_magellan_eastern_support_building: ['689910ee-d621-4214-a934-d79f7cf5a013', 4, 8, 7.5],
  giant_magellan_northwestern_support_building: ['250a4680-e5f5-4338-a0ba-50dbc080641f', 4, 2, 4.5],
  giant_magellan_western_support_building: ['fa80c77f-e380-44a7-b3d2-e35f9dea6444', 4, 1, 4.5],
  giant_magellan_outer_western_support_building: ['a58a02dc-6d4a-48f5-8fa3-ce559cc4d1a7', 4, 1, 5],
  giant_magellan_western_technical_support_building: [
    '4f728d51-9ff8-4190-a52b-1a29ea5e9a5b',
    4,
    1,
    5,
    'SS1',
  ],
  giant_magellan_central_technical_support_building: [
    '39915f19-972d-462b-b3ab-0c750aae4861',
    4,
    1,
    4.5,
    'SS1',
  ],
  giant_magellan_eastern_technical_support_building: [
    'fce5d5a6-7f47-475c-af1a-ffc469bca729',
    4,
    1,
    4,
    'SS1',
  ],
  giant_magellan_eastern_summit_support_building: [
    '611084d5-7ff4-4cbc-976a-5a3f0d6f99ac',
    4,
    1,
    7,
    'summit',
  ],
};
export function inspectGmtSupportPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const documents = new Map();
    for (const source of [...(proof.primarySources ?? []), proof.nativeIdentity]) {
      if (
        typeof source?.path !== 'string' ||
        path.isAbsolute(source.path) ||
        source.path.split(/[\\/]/).includes('..')
      )
        return fail('gmt-support-unsafe-source');
      const bytes = fs.readFileSync(path.join(dir, source.path));
      if (hash(bytes) !== source.sha256) return fail('gmt-support-source-bytes-changed');
      documents.set(source.path, JSON.parse(bytes));
    }
    const e = expected[P.model],
      n = documents.get('native-map/original-building-record.json'),
      h = documents.get('primary-source/original-numerical-height-observations.json'),
      facts = documents.get('primary-source/completed-support-site-written-facts.json');
    if (
      !e ||
      P.parentModelIdentity !== 'giant_magellan_telescope' ||
      n?.originalRecord.id !== e[0] ||
      h?.gersId !== e[0] ||
      n.originalRecord.sources[0].dataset !== 'Google Open Buildings' ||
      n.geometry.coordinates[0].length - 1 !== e[1] ||
      JSON.stringify(n.originalRecord) !== JSON.stringify(h.sourceRecord) ||
      JSON.stringify(n.geometry) !== JSON.stringify(h.geometry) ||
      h.selectedSamples !== e[2] ||
      h.heightSummary.median !== e[3] ||
      h.heightSourceYear !== 2023 ||
      h.presenceThreshold !== 0.7 ||
      h.samples.filter((s) => s.values[2] > 0.7 && s.values[1] > 0).length !== e[2] ||
      facts?.identityQid !== 'Q652252' ||
      facts.imageryUsed !== false ||
      facts.primarySources[0].url !==
        'https://giantmagellan.org/wp-content/uploads/2024/09/SPIE24.pdf' ||
      facts.primarySources[1].document !== 'GMT-REQ-03215 Rev.F released2020-10-13'
    )
      return fail('gmt-support-original-building-height-or-site-facts-unbound');
    if (e[4]) {
      const summit = e[4] === 'summit';
      const context = documents.get(
        summit
          ? 'native-map/original-summit-site-context.json'
          : 'native-map/original-technical-site-context.json',
      );
      if (
        P.supportSite !== e[4] ||
        context?.way?.id !== (summit ? 1491745923 : 828285596) ||
        context.way.tags.landuse !== 'construction' ||
        (summit && context.way.tags.wikidata !== 'Q652252') ||
        !Array.isArray(context.nodes)
      )
        return fail('gmt-technical-site-original-context-unbound');
      const nodes = new Map(context.nodes.map((node) => [node.id, [node.lon, node.lat]]));
      const polygon = context.way.nodes.map((id) => nodes.get(id));
      const inside = (point) => {
        let contained = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
          const a = polygon[i],
            b = polygon[j];
          if (
            a[1] > point[1] !== b[1] > point[1] &&
            point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
          )
            contained = !contained;
        }
        return contained;
      };
      if (!n.geometry.coordinates[0].slice(0, -1).every(inside))
        return fail('gmt-technical-building-outside-original-context');
    }
    const D = (6378137 * Math.PI) / 180,
      co = Math.cos((f.anchor[1] * Math.PI) / 180),
      c = Math.cos(f.heading),
      s = Math.sin(f.heading),
      transformed = n.geometry.coordinates[0].slice(0, -1).map(([lon, lat]) => {
        const x = (lon - f.anchor[0]) * D * co,
          z = -(lat - f.anchor[1]) * D;
        return [c * x - s * z, s * x + c * z];
      });
    if (
      JSON.stringify(P.nativeRing) !== JSON.stringify(f.geometry.polygons[0]) ||
      transformed.length !== P.nativeRing.length ||
      transformed.some((q, i) => q.some((v, k) => Math.abs(v - P.nativeRing[i][k]) > 1e-7)) ||
      Math.abs(P.roofTop - P.floor - e[3]) > 1e-8 ||
      P.heightMeasured !== false ||
      P.estimatedHeightUncertaintyMeters < 3 ||
      P.estimatedHorizontalUncertaintyMeters < 10 ||
      !P.limitations.some((s) => s.includes('Individual function') && s.includes('estimates')) ||
      !P.limitations.some((s) => s.includes('Other buildings') && s.includes('unbuilt'))
    )
      return fail('gmt-support-whole-source-outline-or-estimates-disagree');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes: `Whole original Google-via-Overture outline and qualified original2023learned height retained. ${e[4] ?? 'SS2'}membership inferred from operator relative location and source cluster; individual function, floor/roof/facade and historic grade explicit estimates. No unbuilt operating enclosure or whole-project proxy.`,
    };
  } catch {
    return fail('gmt-support-evidence-unreadable');
  }
}
