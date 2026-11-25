/**
 * Fly or drive the trial cards and report the scorecard.
 *
 *   node packages/entities/scripts/run-trials.mjs aircraft|vehicles [--ids=a,b] [--write] [--check] [--json]
 *
 * `--write` records the scorecard (the budget the tests hold a later run to) and its Markdown
 * page; `--check` compares a run with the recorded one and fails if a card that passed no longer
 * does; `--ids` narrows the run to some vehicles (not with `--write`).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { compareScorecards } from '@bendyline/molen-kernel/trials';
import { publishedFigure, scorecardMarkdown, TRIAL_DOMAINS } from './trial-cards.mjs';

const [name, ...flags] = process.argv.slice(2);
const domain = TRIAL_DOMAINS[name];
if (!domain) throw Error('Usage: run-trials.mjs aircraft|vehicles [--ids=a,b] [--write] [--check]');
const only = flags
  .find((flag) => flag.startsWith('--ids='))
  ?.slice(6)
  .split(',');
const write = flags.includes('--write');
if (write && only) throw Error('--write records the whole scorecard; drop --ids');

const started = performance.now();
const card = domain.run(only);
const seconds = ((performance.now() - started) / 1000).toFixed(1);

if (flags.includes('--json')) console.log(JSON.stringify(card, null, 2));
else {
  for (const [key, entry] of Object.entries(card.cards)) {
    if (!only && entry.status === 'pass') continue;
    const measured = entry.measured === undefined ? '—' : entry.measured;
    const held = publishedFigure(entry);
    const reference = held === '—' ? '' : ` (published ${held})`;
    const error = entry.error === undefined ? '' : ` ${(entry.error * 100).toFixed(0)}%`;
    console.log(
      `${entry.status.padEnd(10)} ${key.padEnd(46)} ${measured} ${entry.unit}${reference}${error}`.trimEnd(),
    );
  }
  console.log(
    `${card.passed} of ${card.scored} scored ${name} cards within tolerance (${seconds} s)`,
  );
}

if (write) {
  await writeFile(domain.scorecard, `${JSON.stringify(card, null, 2)}\n`);
  await writeFile(
    new URL(`../../../content/entities/source/${domain.page}`, import.meta.url),
    scorecardMarkdown(card, domain),
  );
  console.log(`Recorded the ${name} scorecard and ${domain.page}.`);
}

if (flags.includes('--check')) {
  const recorded = JSON.parse(await readFile(domain.scorecard, 'utf8'));
  const baseline = only
    ? Object.fromEntries(
        Object.entries(recorded.cards).filter(([key]) =>
          only.includes(key.slice(key.startsWith('cycle.') ? 6 : 0, key.indexOf('/'))),
        ),
      )
    : recorded.cards;
  const change = compareScorecards(baseline, card.cards);
  for (const key of change.improvements) console.log(`now passes: ${key}`);
  if (change.improvements.length + change.added.length + change.removed.length > 0)
    console.log(`The recorded scorecard is out of date; run ${domain.command}.`);
  if (change.regressions.length > 0) {
    for (const key of change.regressions) console.error(`no longer passes: ${key}`);
    process.exitCode = 1;
  }
}
