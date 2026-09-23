import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { playExperience } from '@bendyline/molen-tooling';
import { afterAll, expect, it } from 'vitest';

// Like a render-loop HUD, the status is written only from requestAnimationFrame. The click starts
// work whose first heavy frame blocks the main thread for longer than stableMs before the HUD can
// report it, the way a software rasterizer stalls under load. Measured in wall-clock time the
// stale text looks stable; measured in rendered frames it does not.
const PAGE = `<!doctype html>
<button id="go">go</button>
<pre id="status">0 loading · idle</pre>
<script>
  const status = document.getElementById('status');
  let clickedAt;
  let stalled = false;
  let loadingSince;
  let phase = 'idle';
  document.getElementById('go').addEventListener('click', () => {
    clickedAt = performance.now();
  });
  function frame(now) {
    if (clickedAt !== undefined && !stalled && now - clickedAt >= 200) {
      stalled = true;
      const end = performance.now() + 1500;
      while (performance.now() < end) {}
    } else if (stalled && phase === 'idle') {
      phase = 'loading';
      loadingSince = now;
    } else if (phase === 'loading' && now - loadingSince >= 1000) {
      phase = 'done';
    }
    status.textContent = (phase === 'loading' ? 1 : 0) + ' loading · ' + phase;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
</script>
`;

const temporaryDirectories: string[] = [];

afterAll(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

it('wait-for-stable does not count a stalled frame as stable time', async () => {
  const appDir = await mkdtemp(join(tmpdir(), 'molen-stable-app-'));
  const outDir = await mkdtemp(join(tmpdir(), 'molen-stable-out-'));
  temporaryDirectories.push(appDir, outDir);
  await writeFile(join(appDir, 'index.html'), PAGE, 'utf8');

  const r = await playExperience({
    appDir,
    outDir,
    scenario: {
      format: 'molen/experience-play@1',
      name: 'stable-after-stall',
      viewport: [320, 200],
      probes: [{ name: 'status', selector: '#status' }],
      actions: [
        { type: 'wait-for-stable', selector: '#status', text: '0 loading', stableMs: 500 },
        { type: 'click', selector: '#go' },
        {
          type: 'wait-for-stable',
          selector: '#status',
          text: '0 loading',
          stableMs: 1000,
          timeoutMs: 20_000,
        },
        { type: 'screenshot', name: 'settled' },
      ],
    },
  });
  expect(r.ok, r.error).toBe(true);
  expect(r.frames?.[0]?.probes?.status).toBe('0 loading · done');
});
