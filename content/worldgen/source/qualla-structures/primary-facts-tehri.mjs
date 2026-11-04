/** Complete Stage-I earthfill dam and all five spillways; no reference imagery. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`,
  safe = (d, p) =>
    typeof p === 'string' && !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..')
      ? path.join(d, p)
      : null;
export function inspectTehriPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    for (const [key, url, phrases] of [
      [
        'operator',
        'https://thdc.co.in/en/node/258',
        [
          'DirectHTTP200',
          'KEYTECHNICALFEATURES',
          '260.5mhigh',
          '575mcrest',
          'three-bayrightbankchute',
          'twoRightBankshaftspillways',
          'twoLeftBankshaftspillways',
          'four250MW',
          'UndergroundpowerhouseonLeftBank',
          'No sourcephotograph/map/figure',
        ],
      ],
      [
        'report',
        'https://www.thdc.co.in/sites/default/files/operational-performance%20/THDC_Tehri_Progress_Report_February2025.pdf',
        [
          'OriginaloperatorFebruary2025two-page',
          'directHTTP200',
          'ActualPDFpage1',
          '260.50m',
          'onechutespillway/fourshaftspillways',
          '220mdrop',
          'undergroundfour250MW',
          'Allsourcefigures/photosunused',
          '2021',
        ],
      ],
      [
        'legacy',
        'https://website.thdcil.in/index.php/en/projects/hydro/tehri-dam-HPP-stage-I',
        [
          'Actualprimaryoperatorcachedtable',
          'originallegacyHTMLrepeatedtimeouts',
          'noclaimretrievedoriginallegacybytes',
          '839.5m',
          '25.5to30.5m',
          'upstreamslope1:2.5/downstream1:2',
          '10.5mwide',
          '12mshaftinlets',
          '197x22x47.2m',
          'notprovidersurveyconversions',
        ],
      ],
    ]) {
      const s = proof.primarySources?.find((s) => s.key === key),
        p = safe(dir, s?.path),
        b = p && fs.readFileSync(p);
      if (
        !b ||
        hash(b) !== s.sha256 ||
        s.url !== url ||
        s.use !== 'factual-text-only' ||
        !phrases.every((t) => b.toString().includes(t))
      )
        return fail('tehri-original-operator-or-explicit-cached-section-facts-unbound');
    }
    const n = proof.nativeIdentity,
      p = safe(dir, n?.path),
      b = p && fs.readFileSync(p);
    if (!b || hash(b) !== n.sha256) return fail('tehri-original-whole-dam-unbound');
    const j = JSON.parse(b),
      w = j.elements.find((e) => e.type === 'way' && e.id === 93091865),
      ns = new Map(j.elements.filter((e) => e.type === 'node').map((e) => [e.id, e]));
    if (
      j.sourceUrl !== 'https://api.openstreetmap.org/api/0.6/way/93091865/full.json' ||
      w?.tags.wikidata !== 'Q69091' ||
      w.nodes.length !== 49 ||
      f.mappedIdentity.wikidataId !== 'Q69091' ||
      P.model !== 'tehri_dam' ||
      P.wholeScope !==
        'whole-StageI-earthrockfill-dam-threebay-chute-fourshaftspillways-leftbank-intake-tailrace-and-access-exteriors' ||
      P.representedDate !== '2014-06-01' ||
      P.dam.nominalHeight !== 260.5 ||
      P.dam.reportedLength !== 575 ||
      P.dam.upstreamSlope !== 2.5 ||
      P.dam.downstreamSlope !== 2 ||
      P.chute.gates !== 3 ||
      P.chute.clearGateWidth !== 10.5 ||
      P.shafts.length !== 4 ||
      P.shafts.filter((s) => s.bank === 'right').length !== 2 ||
      P.shafts.filter((s) => s.bank === 'left').length !== 2 ||
      P.shafts.some((s) => s.diameter !== 12) ||
      P.powerhouse.units !== 4 ||
      P.powerhouse.nameplateMW !== 1000 ||
      P.powerhouse.type !== 'underground-leftbank-no-aboveground-hall' ||
      P.intakes.length !== 2 ||
      P.tailracePortals.length !== 2 ||
      P.estimatedComponentRegistrationUncertaintyMeters < 75 ||
      P.estimatedHeightUncertaintyMeters < 10
    )
      return fail('tehri-whole-StageI-scope-census-or-explicit-estimates-disagree');
    const R = 6378137,
      rad = Math.PI / 180,
      co = Math.cos(f.anchor[1] * rad),
      c = Math.cos(f.heading),
      s = Math.sin(f.heading),
      local = (id) => {
        const p = ns.get(id),
          x = (p.lon - f.anchor[0]) * R * rad * co,
          z =
            -R * (Math.asinh(Math.tan(p.lat * rad)) - Math.asinh(Math.tan(f.anchor[1] * rad))) * co;
        return [c * x - s * z, s * x + c * z];
      },
      ring = w.nodes.slice(0, -1).map(local),
      crest = [4, 2, 1, 0].map((i) => local(w.nodes[i]));
    if (
      JSON.stringify(ring) !== JSON.stringify(f.geometry.polygons[0]) ||
      JSON.stringify(crest) !== JSON.stringify(f.geometry.centerlines[0]) ||
      JSON.stringify(P.nativeDamRing) !== JSON.stringify(ring) ||
      JSON.stringify(P.nativeCrest) !== JSON.stringify(crest)
    )
      return fail('tehri-original-forty-eight-area-and-four-crest-controls-changed');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'CompleteStage-I260.5mearthrockfilldam/575mreportedcrest, original48nativeareacontrols/fourcrestedgecontrols; full3bayrightbankchute/allfour12mshaftspillways andleftbankintake/tailrace/accessportalexteriors. OriginalownerHTML/February2025reportwrittenfacts andexplicitcachedlegacysectiontable. Fourunit1000MWpowerhouse remainsunderground, noinventedshed/campusproxy/newPSP/Koteshwar. Nativeboundaryedge/exposedtoe andallcomponentpositions/verticalroles/sections/finish/grade estimates;75mcomponent/10mheight uncertainty. Allimageryunused, no survey/currentreplacementclaim.',
    };
  } catch {
    return fail('tehri-factual-evidence-invalid');
  }
}
