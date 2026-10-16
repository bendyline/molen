import { execFileSync } from 'node:child_process';

/** Render outputs; source textures and curated previews live outside these directories. */
export const isReviewCapture = (path) =>
  /(?:^|\/)(?:shots|medium-fi)\/.+\.(?:png|jpe?g|webp)$/i.test(path);

export function checkTrackedReviewCaptures({ root, log = console.log }) {
  const paths = execFileSync('git', ['ls-files', '--cached', '-z'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 ** 2,
  });
  const captures = paths.split('\0').filter(isReviewCapture);
  if (captures.length)
    throw new Error(
      `Generated review captures must stay local, outside Git (${captures.length} tracked):\n${captures.slice(0, 20).join('\n')}\nKeep one or two small summary previews outside shots/ and medium-fi/; keep source textures and review reports.`,
    );
  log('Verified that no bulk review captures are tracked in Git.');
}
