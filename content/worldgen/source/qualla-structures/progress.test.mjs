import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { hashEvidenceText } from '../../../../packages/worldgen/scripts/evidence-text-hash.mjs';
import { buildProgress, inspectedCaptureMatches } from './progress.mjs';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
test('completion rejects changed frames, changed inputs, uninspected reports and escaping paths', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qualla-progress-'));
  try {
    fs.mkdirSync(path.join(dir, 'shots'));
    const frame = Buffer.from('reviewed-frame');
    fs.writeFileSync(path.join(dir, 'shots/front.png'), frame);
    const report = Buffer.from(
      JSON.stringify({
        inputHash: 'input-v1',
        frames: [{ path: 'shots/front.png', hash: hash(frame) }],
        errors: [],
      }),
    );
    const review = {
      status: 'passed',
      captureReportHash: hashEvidenceText(report),
      inspectedFrames: ['shots/front.png'],
    };
    assert.equal(inspectedCaptureMatches(dir, report, review, 'input-v1'), true);
    assert.equal(inspectedCaptureMatches(dir, report, review, 'input-v2'), false);
    assert.equal(
      inspectedCaptureMatches(dir, report, { ...review, status: 'pending' }, 'input-v1'),
      false,
    );
    assert.equal(
      inspectedCaptureMatches(dir, report, { ...review, inspectedFrames: [] }, 'input-v1'),
      false,
    );
    assert.equal(
      inspectedCaptureMatches(
        dir,
        report,
        { ...review, inspectedFrames: ['../front.png'] },
        'input-v1',
      ),
      false,
    );
    fs.writeFileSync(path.join(dir, 'shots/front.png'), 'changed');
    assert.equal(inspectedCaptureMatches(dir, report, review, 'input-v1'), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('later batches write a separate resumable ledger and preserve the core ledger', async () => {
  const repository = fs.mkdtempSync(path.join(os.tmpdir(), 'structure-batch-'));
  const output = path.join(repository, 'content/worldgen/source/qualla-structures');
  const put = (relative, value) => {
    const file = path.join(repository, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value));
  };
  try {
    put('content/worldgen/source/qualla-structures/batches/qualla-002.json', {
      title: 'Next batch',
      targetCount: 300,
      entries: [],
    });
    put('content/worldgen/source/qualla-structures/batches/readiness.json', { ready: 100 });
    put('content/worldgen/source/next-1000/candidates.json', { candidates: [] });
    put('content/worldgen/source/next-1000/collections.json', { collections: [] });
    put('content/worldgen/project.json', { assets: {} });
    put('content/worldgen/stylepack.json', { assets: {} });
    put('content/earth/structures/placements.json', { entries: [] });
    fs.writeFileSync(path.join(output, 'structures.jsonl'), '{}\n');
    const core = fs.readFileSync(path.join(output, 'batches/readiness.json'));
    const counts = await buildProgress({ repository, output, batchName: 'qualla-002' });
    assert.equal(counts.target, 300);
    assert.equal(counts.ready, 0);
    assert.deepEqual(fs.readFileSync(path.join(output, 'batches/readiness.json')), core);
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(output, 'batches/qualla-002.readiness.json'))).counts
        .target,
      300,
    );
    await buildProgress({ repository, output, batchName: 'qualla-002', check: true });
    await assert.rejects(
      buildProgress({ repository, output, batchName: '../escape' }),
      /Invalid batch name/,
    );
  } finally {
    fs.rmSync(repository, { recursive: true, force: true });
  }
});
