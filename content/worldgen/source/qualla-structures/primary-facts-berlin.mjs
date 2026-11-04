/** Whole original S-Bahn network, from written engineering/operator facts and numeric data. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
const safe = (d, p) =>
  typeof p === 'string' && !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..')
    ? path.join(d, p)
    : null;
export function inspectBerlinPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    for (const [key, url, terms] of [
      [
        'engineering',
        'https://www.berlin.de/ba-friedrichshain-kreuzberg/politik-und-verwaltung/aemter/stadtentwicklungsamt/bebauungsplaene/vi-140cab_k15_tragfahigkeit_s-bahn_tunnel_200430_komp.pdf',
        [
          'WTMEngineers',
          'PDF5',
          '6032',
          '0.8mhigh',
          'not a surveyed uniformcrosssection',
          'NOT tunneltrackfloor',
          'drawings unused',
        ],
      ],
      [
        'operator',
        'https://sbahn.berlin/aktuelles/artikel/unterm-getuemmel-direkt-ins-zentrum/',
        [
          'OfficialS-BahnBerlin',
          '27July1936',
          '1939',
          'Historicsecondlevelsidings',
          'Everyarchive/modernphotograph unused',
        ],
      ],
      [
        'dimensions',
        'https://www.deutschebahn.com/pr-berlin-de/aktuell/presseinformationen/S-Bahn-Berlin-Nord-Sued-Tunnel-an-zwei-Wochenenden-gesperrt-5879028',
        [
          'DB4February2021operatorrelease',
          'OriginalDBURL no longerretrievable',
          '5805m',
          '3.80m',
          '7.04m',
          'all images unused',
        ],
      ],
    ]) {
      const s = proof.primarySources?.find((s) => s.key === key),
        p = safe(dir, s?.path),
        b = p && fs.readFileSync(p);
      if (
        !b ||
        s.url !== url ||
        s.use !== 'factual-text-only' ||
        hash(b) !== s.sha256 ||
        !terms.every((t) => b.toString().includes(t))
      )
        return fail('berlin-whole-tunnel-written-engineer-operator-facts-unbound');
    }
    const n = proof.nativeIdentity,
      files = [
        ['path', 'sha256'],
        ['envelopesPath', 'envelopesHash'],
        ['originalEnvelopePath', 'originalEnvelopeHash'],
        ['portalPath', 'portalHash'],
        ['derivedPlanPath', 'derivedPlanHash'],
        ['derivedInputPath', 'derivedInputHash'],
      ];
    for (const [p, h] of files) {
      const s = safe(dir, n?.[p]);
      if (!s || hash(fs.readFileSync(s)) !== n[h])
        return fail('berlin-original-numeric-whole-network-or-envelopes-stale');
    }
    const routes = JSON.parse(fs.readFileSync(safe(dir, n.path))),
      env = JSON.parse(fs.readFileSync(safe(dir, n.envelopesPath))),
      all = JSON.parse(fs.readFileSync(safe(dir, n.originalEnvelopePath))),
      heads = JSON.parse(fs.readFileSync(safe(dir, n.portalPath))),
      derived = JSON.parse(fs.readFileSync(safe(dir, n.derivedPlanPath))),
      input = JSON.parse(fs.readFileSync(safe(dir, n.derivedInputPath)));
    if (
      routes.ways?.length !== 98 ||
      routes.ways.reduce((s, w) => s + w.nodes.length, 0) !== 765 ||
      env.features?.length !== 17 ||
      all.numberMatched !== 125 ||
      all.features?.length !== 125 ||
      heads.portals?.length !== 6 ||
      derived.inputHash !== n.derivedInputHash ||
      input.estimatedGapHalfWidth !== P.tunnel.gapHalfWidth
    )
      return fail('berlin-incomplete-network-envelopes-or-six-external-heads');
    const expectedHeads = [249189056, 322799093, 30353453, 290175306, 30353069, 290178319];
    if (
      expectedHeads.some((id) => !heads.portals.some((p) => p.id === id)) ||
      routes.ways.some(
        (w) =>
          w.tags.railway !== 'light_rail' ||
          w.tags.voltage !== '750' ||
          !w.tags.operator.includes('DB') ||
          w.tags.tunnel !== 'yes',
      )
    )
      return fail('berlin-mainline-ubahn-new-s21-or-arbitrary-mouth-proxy');
    for (const e of env.features) {
      const original = all.features.find((f) => f.id === e.id);
      if (original?.properties.bwf !== '1870' || JSON.stringify(original) !== JSON.stringify(e))
        return fail('berlin-official-full-envelope-moved-or-substituted');
    }
    if (
      P.model !== 'berlin_nord_sud_tunnel' ||
      P.wholeScope !== 'whole-berlin-original-nordsud-sbahn-98routes-17envelopes-sixheads-2021' ||
      P.representedDate !== '2021-02-04' ||
      P.nativeRailways?.length !== 98 ||
      P.nativeEnvelopes?.length !== 17 ||
      P.portals?.length !== 6 ||
      P.tunnel.clearance !== 3.8 ||
      P.tunnel.junctionClearance !== 7.04 ||
      P.gradeProfileLatitudes?.length !== 9 ||
      P.estimatedPlanUncertaintyMeters < 6 ||
      P.estimatedHeightUncertaintyMeters < 6
    )
      return fail('berlin-whole-physical-scope-profile-or-explicit-estimates-disagree');
    const R = 6378137,
      rad = Math.PI / 180,
      co = Math.cos(f.anchor[1] * rad),
      local = (p) => [
        (p[0] - f.anchor[0]) * R * rad * co,
        -R * (Math.asinh(Math.tan(p[1] * rad)) - Math.asinh(Math.tan(f.anchor[1] * rad))) * co,
      ];
    for (const [i, w] of routes.ways.entries())
      for (const [k, p] of w.coordinates.entries()) {
        const q = local(p);
        if (
          q.some(
            (v, a) =>
              Math.abs(v - f.geometry.centerlines[i][k][a]) > 1e-7 ||
              Math.abs(v - P.nativeRailways[i].local[k][a]) > 1e-7,
          )
        )
          return fail('berlin-original-complete-route-controls-moved');
      }
    for (const [i, e] of env.features.entries())
      for (const [k, p] of e.geometry.coordinates[0][0].slice(0, -1).entries()) {
        const q = local(p);
        if (q.some((v, a) => Math.abs(v - f.geometry.polygons[i][k][a]) > 1e-7))
          return fail('berlin-original-full-envelope-controls-moved');
      }
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Whole98-wayDBS-Bahnnetwork,17officialnumericstation/tunnelenvelopes and6actualexternalheads, bothsouthernbranches/sixstations/intrinsicsidings. Writtenengineer/operatorfacts; archivedDBrelease explicitlyidentified. Everyimageunused. Missing/layeredplan/verticalprofile/sections/finish/grade estimated, no genericoneportal/mainline/U-Bahn/S21proxy.',
    };
  } catch {
    return fail('berlin-factual-evidence-unreadable');
  }
}
