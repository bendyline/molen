import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { hashEvidenceText } from '../../../../packages/worldgen/scripts/evidence-text-hash.mjs';
import { inspectedCaptureMatches } from './progress.mjs';

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
