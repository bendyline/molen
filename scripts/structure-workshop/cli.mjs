import { build, collect, prepare, review, runRoot } from './pipeline.mjs';

// Older Gezel versions pass an extra pnpm separator through to the CLI.
const args = process.argv.slice(2);
if (args[0] === '--') args.shift();
const [op, run, id] = args;
try {
  const root = runRoot(run);
  const result = await {
    prepare: () => prepare(root),
    build: () => build(root, id),
    review: () => review(root, id),
    collect: () => collect(root),
  }[op]?.();
  if (!result)
    throw new Error(
      'Usage: node scripts/structure-workshop/cli.mjs prepare|build|review|collect <run-id> [asset-id]',
    );
  console.log(JSON.stringify(result, null, 2));
  if (result.decision === 'reject') process.exitCode = 2;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
