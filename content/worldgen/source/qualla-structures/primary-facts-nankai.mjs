import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const nankaiCase = 'nankai-heritage-campus-named-buildings';
export const nankaiModel = 'tianjin_nankai_high_school';
const ids = [315909342, 682064893, 315909343, 682064891, 682064896, 682064895];
const names = ['伯苓楼（东楼）', '北楼', '范孙楼', '瑞廷礼堂', '西斋 一排', '西斋 二排'];
const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;

export function inspectNankaiFacts({ dir, proof, controls, frame, inventory }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  function read(record, expected) {
    if (record.path !== expected) throw Error('Unexpected evidence path');
    const bytes = fs.readFileSync(path.join(dir, expected));
    if (hash(bytes) !== record.sha256) throw Error('Changed evidence');
    return JSON.parse(bytes);
  }
  try {
    const archive = read(
      proof.primarySources,
      'reference-rights/nankai-written-architectural-facts.json',
    );
    const excluded = read(
      proof.candidateExclusion,
      'reference-rights/article-image-exclusions.json',
    );
    const map = read(proof.nativeIdentity, 'native-map/old-campus-named-ways.json');
    const city = archive.sources.find(
      (r) => r.url === 'https://tjculture.museum.chaoxing.com/302/305/9402.html',
    )?.facts;
    const design = archive.sources.find(
      (r) => r.url === 'https://news.sina.com.cn/c/2004-08-16/20594047099.shtml',
    )?.facts;
    const reasons = new Map(excluded.candidates.map((r) => [r.sourceUrl, r.reason]));
    if (
      archive.mode !== 'factual-text-only' ||
      archive.imageryUsed !== false ||
      proof.primarySources.use !== archive.mode ||
      excluded.selectedImages !== 0 ||
      !inventory.candidates.every((r) => reasons.get(r.sourceUrl)?.trim()) ||
      city?.boling.storeys !== 2 ||
      !city.boling.archedUpperWindows ||
      city?.north.roof !== 'pitched' ||
      !city.ruiting.brick ||
      !city.xizhai.coveredCorridors ||
      design?.fansunStoreys !== 3 ||
      !design?.flatRoof
    )
      return fail('nankai-written-architecture-or-photo-exclusion-unbound');
    const [lon, lat] = frame.anchor,
      m = (6378137 * Math.PI) / 180,
      mx = m * Math.cos((lat * Math.PI) / 180);
    const nodes = new Map(map.nodes.map((n) => [n.id, n]));
    if (
      frame.heading !== 0 ||
      frame.sourceHash !== proof.nativeIdentity.sha256 ||
      map.school.id !== 4250697 ||
      map.school.wikidata !== 'Q4125838' ||
      controls.wikidataId !== map.school.wikidata ||
      controls.dimensions.formerSiteId !== map.school.id ||
      map.ways.length !== ids.length ||
      frame.geometry.polygons.length !== ids.length ||
      controls.dimensions.polygons.length !== ids.length ||
      !ids.every((id, i) => {
        const w = map.ways[i],
          p = frame.geometry.polygons[i],
          d = controls.dimensions.polygons[i];
        return (
          w.id === id &&
          w.tags.name === names[i] &&
          frame.features[i].id === `way/${id}` &&
          p.length === w.nodes.length - 1 &&
          p.length === d.length &&
          w.nodes.slice(0, -1).every((id, j) => {
            const n = nodes.get(id);
            const [x, z] = p[j];
            return (
              x === d[j][0] &&
              z === d[j][1] &&
              Math.hypot(x - (n.lon - lon) * mx, z - (lat - n.lat) * m) < 0.001
            );
          })
        );
      })
    )
      return fail('nankai-named-heritage-footprints-unbound');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'Current named map outlines control the school’s four formally listed buildings and two mapped Xizhai dormitory rows. The preservation center and architectural descriptions support the reconstruction, with heights, details and color estimated.',
    };
  } catch {
    return fail('nankai-primary-facts-invalid');
  }
}
