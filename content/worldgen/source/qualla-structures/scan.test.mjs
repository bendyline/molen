/** Behavioral checks for discovery, identity and resumable source/corpus changes. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { classify } from './classify.mjs';
import {
  applyDecision,
  contentHash,
  matchCatalog,
  publishedStoryLink,
  scan,
  storyUrl,
} from './scan.mjs';
import { structureCatalogEntries, workAssignment } from './work-ownership.mjs';

const article = (id, title, summary, lat = 51.5, lng = -0.1) => ({
  id,
  title,
  summary,
  content: { intro: summary, sections: [] },
  location: { coordinates: { lat, lng } },
  categories: [],
});

test('structure catalog ownership covers planned, imported, ready and possible member matches', () => {
  const entries = structureCatalogEntries(
    { candidates: [{ id: 'kensington_palace', title: 'Kensington Palace' }] },
    {
      collections: [{ members: [{ id: 'msu_main_building', title: 'MSU', assetId: 'molen.msu' }] }],
    },
  );
  for (const status of [
    'existing-planned',
    'existing-model-review',
    'existing-ready',
    'identity-review',
  ]) {
    const assigned = workAssignment(
      { name: 'Palace', status, existing: [{ candidateId: 'kensington_palace' }] },
      entries,
    );
    assert.equal(assigned.owner, 'structure-catalog-other-device');
    assert.equal(assigned.localAuthoringAllowed, false);
  }
  assert.equal(
    workAssignment(
      {
        name: 'Alias',
        existing: [{ assetId: 'molen.msu', basis: 'possible-name-and-coordinate' }],
      },
      entries,
    ).localAuthoringAllowed,
    false,
  );
  assert.equal(
    workAssignment({ name: 'Unlisted house', existing: [] }, entries).owner,
    'qualla-local',
  );
});

test('event sites, ordinary hotels and natural names are distinguished', () => {
  assert.equal(
    classify(article('murder-of-ennis-cosby-wp', 'Murder of Ennis Cosby', 'A roadside murder.'))
      .disposition,
    'no-structure',
  );
  assert.equal(
    classify(
      article(
        'attack-on-pearl-harbor-wp',
        'Attack on Pearl Harbor',
        'The attack pulled America into World War II.',
      ),
    ).disposition,
    'no-structure',
  );
  assert.equal(
    classify(
      article('plain-hotel-wp', 'Plain Hotel', 'An ordinary hotel with a remarkable history.'),
    ).disposition,
    'structure',
  );
  assert.equal(
    classify(article('monument-valley-wp', 'Monument Valley', 'A valley of sandstone buttes.'))
      .disposition,
    'no-structure',
  );
  assert.equal(
    classify(
      article('robben-island-wk', 'Robben Island', 'An island containing a historic prison.'),
    ).disposition,
    'review',
  );
  assert.equal(
    classify(article('iroquois-theatre-fire-wp', 'Iroquois Theatre fire', 'A fire in a theater.'))
      .disposition,
    'review',
  );
  assert.equal(
    classify(article('proposed-dam-wp', 'Proposed Dam', 'An unbuilt dam.')).disposition,
    'review',
  );
});

test('semantic changes invalidate review but media and neighbor changes do not', () => {
  const a = article('hotel-wp', 'Hotel', 'Historic hotel.');
  const fingerprint = contentHash(a, 'Hotel');
  assert.equal(
    contentHash(
      { ...a, media: { hero: 'new.webp' }, directionalNeighbors: { n: 'other' } },
      'Hotel',
    ),
    fingerprint,
  );
  assert.notEqual(contentHash({ ...a, summary: 'Demolished hotel.' }, 'Hotel'), fingerprint);
  const decision = { contentHash: fingerprint, disposition: 'no-structure', reason: 'Reviewed.' };
  assert.equal(applyDecision(classify(a), decision, fingerprint).review, 'editorial');
  assert.equal(applyDecision(classify(a), decision, 'changed').review, 'stale-editorial-decision');
  assert.equal(applyDecision(classify(a), decision, 'changed').disposition, 'review');
});

test('catalog matches require geography; partial names cannot declare coverage', () => {
  const catalog = {
    models: [
      {
        title: 'Windsor Castle',
        names: ['Windsor Castle'],
        coordinate: [-0.6, 51.48],
        candidateId: 'N1',
      },
    ],
  };
  const a = article('windsor-castle-wp', 'Windsor Castle', 'A castle.');
  assert.equal(matchCatalog(a, a.title, [150, -33], catalog).length, 0);
  assert.equal(matchCatalog(a, a.title, [-0.6, 51.48], catalog)[0].basis, 'name-and-coordinate');
  const chapel = article('st-georges-chapel-wp', "St George's Chapel, Windsor Castle", 'A chapel.');
  assert.equal(
    matchCatalog(chapel, chapel.title, [-0.6, 51.48], catalog)[0].basis,
    'possible-name-and-coordinate',
  );
  assert.throws(
    () => matchCatalog(a, a.title, [-0.6, 51.48], catalog, 'missing'),
    /Unknown explicit/,
  );
});

test('Qualla canonical URL rules and exceptions use IDs, not imported slugs', () => {
  assert.equal(storyUrl('seattle-city-wk', {}), 'https://qualla.com/seattle/');
  assert.equal(storyUrl('new-york-city-wk', {}), 'https://qualla.com/new-york-city/');
  assert.equal(
    storyUrl('fort-worth-stockyards-wk', { 'fort-worth-stockyards-wk': 'stockyards-fort-worth' }),
    'https://qualla.com/stockyards-fort-worth/',
  );
});

test('colliding public slugs fall back to the precise story route', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-qualla-link-'));
  try {
    fs.mkdirSync(path.join(temp, 'r/fort-meade'), { recursive: true });
    fs.writeFileSync(
      path.join(temp, 'r/fort-meade/index.html'),
      '<link rel="canonical" href="https://qualla.com/fort-meade-south-dakota/">' +
        '<script>window.__QUALLA_ARTICLE__={"id":"fort-meade-south-dakota-wp","tile":"9xyk"}</script>',
    );
    assert.equal(
      publishedStoryLink(temp, 'fort-meade-wp', '_c/art/d/q/c/x/fort-meade-wp.json', {}).url,
      'https://qualla.com/#list/dqcx/fort-meade-wp',
    );
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('bounded scans resume, preserve IDs across catalog progress, and retire removed sources', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-qualla-scan-'));
  const qualla = path.join(temp, 'qualla');
  const repository = path.join(temp, 'molen');
  const output = path.join(temp, 'output');
  const put = (file, value) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value));
  };
  const repo = (file, value) => put(path.join(repository, file), value);
  const records = () =>
    fs
      .readFileSync(path.join(output, 'structures.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(JSON.parse);
  try {
    repo('content/worldgen/source/structure-index.json', { entries: [] });
    repo('content/worldgen/source/structure-catalog/candidates.json', { candidates: [] });
    repo('content/worldgen/source/structure-catalog/collections.json', { collections: [] });
    repo('content/worldgen/project.json', { assets: {} });
    repo('content/worldgen/stylepack.json', { assets: {} });
    fs.mkdirSync(path.join(repository, 'content/earth/source/placements'), { recursive: true });
    repo('content/earth/structures/readiness.json', { candidates: [], counts: { ready: 0 } });
    put(path.join(qualla, '_c/idx/slug-exceptions.json'), {});
    const aPath = path.join(qualla, '_c/art/g/c/p/v/plain-hotel-wp.json');
    const bPath = path.join(qualla, '_c/art/g/c/p/v/simple-palace-wp.json');
    const a = article('plain-hotel-wp', 'Plain Hotel', 'An ordinary hotel.');
    put(aPath, a);
    put(bPath, article('simple-palace-wp', 'Simple Palace', 'A royal palace.'));
    const partial = scan({ qualla, repository, output, limit: 1 });
    assert.equal(partial.scanComplete, false);
    assert.equal(partial.run.pending, 1);
    const complete = scan({ qualla, repository, output });
    assert.equal(complete.run.reused, 1);
    assert.equal(complete.run.classified, 1);
    assert.equal(complete.structureCount, 2);
    assert.equal(scan({ qualla, repository, output, check: true }).run.filesChanged, 0);
    const stableId = records().find((item) => item.name === 'Plain Hotel').id;
    repo('content/worldgen/source/structure-catalog/candidates.json', {
      candidates: [
        {
          id: 'N1',
          title: 'Plain Hotel',
          category: 'hotel',
          referenceCoordinate: { longitude: -0.1, latitude: 51.5 },
        },
      ],
    });
    const progress = scan({ qualla, repository, output });
    assert.equal(progress.run.reused, 2);
    assert.equal(records().find((item) => item.name === 'Plain Hotel').id, stableId);
    assert.equal(records().find((item) => item.name === 'Plain Hotel').status, 'existing-planned');
    put(path.join(output, 'decisions.json'), {
      articles: {
        'plain-hotel-wp': {
          contentHash: contentHash(a),
          disposition: 'no-structure',
          reason: 'Editorial exclusion.',
        },
      },
    });
    assert.equal(scan({ qualla, repository, output }).articleDecisions.editorial, 1);
    put(aPath, { ...a, summary: 'A changed hotel story.' });
    assert.equal(scan({ qualla, repository, output }).articleDecisions.review, 1);
    fs.unlinkSync(bPath);
    const removed = scan({ qualla, repository, output });
    assert.equal(removed.articleCount, 1);
    assert.equal(fs.existsSync(path.join(output, 'lists/palace-castle-fort.md')), false);
    const ledger = fs
      .readFileSync(path.join(output, 'scan/gc.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .slice(1)
      .map(JSON.parse);
    assert.equal(ledger.find((item) => item.articleId === 'simple-palace-wp').active, false);
    const duplicatePath = path.join(qualla, '_c/art/g/c/p/w/plain-hotel-wp.json');
    put(duplicatePath, a);
    assert.equal(scan({ qualla, repository, output }).duplicateArticleIds.length, 1);
    assert.equal(records().length, 0);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
