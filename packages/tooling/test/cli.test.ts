import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { cliFlagSpecs, cliVersion, parseArgs, runCli } from '../src/cli-commands';
import { scaffoldExperience } from '../src/ops/index';

interface Captured {
  code: number;
  out: string;
  err: string;
}

/** Run the CLI exactly as `molen …` would, capturing both streams. */
async function cli(...argv: string[]): Promise<Captured> {
  const out: string[] = [];
  const errors: string[] = [];
  const stdout = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    out.push(String(chunk));
    return true;
  });
  const stderr = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    errors.push(String(chunk));
    return true;
  });
  try {
    const code = await runCli(argv);
    return { code, out: out.join(''), err: errors.join('') };
  } finally {
    stdout.mockRestore();
    stderr.mockRestore();
  }
}

let projectDir: string;

beforeAll(async () => {
  const parent = await mkdtemp(join(tmpdir(), 'molen-cli-'));
  const created = await scaffoldExperience({ name: 'demo', dir: parent });
  if (created.dir === undefined) throw new Error(created.error ?? 'scaffold failed');
  projectDir = created.dir;
}, 60_000);

afterAll(() => {
  // scaffolds live in the OS temp dir
});

describe('argument parsing', () => {
  const validate = () => cliFlagSpecs().get('validate') as NonNullable<ReturnType<typeof spec>>;
  const spec = (verb: string) => cliFlagSpecs().get(verb);

  it('accepts --key=value', () => {
    const args = parseArgs(['run', 'main', '--ticks=30'], spec('sim'));
    expect(args.flags.ticks).toBe('30');
    expect(args.positionals).toEqual(['run', 'main']);
    expect(args.unknownFlags).toBeUndefined();
  });

  it('does not let a valueless flag swallow the next positional', () => {
    const args = parseArgs(['--verify-files', 'scenes/main.scene.json'], validate());
    expect(args.flags['verify-files']).toBe(true);
    expect(args.positionals).toEqual(['scenes/main.scene.json']);
  });

  it('reports unknown flags instead of ignoring them', () => {
    const args = parseArgs(['nope.json', '--bogus', '1'], validate());
    expect(args.unknownFlags).toEqual(['--bogus']);
  });

  it('rejects a value given to a valueless flag', () => {
    const args = parseArgs(['--verify-files=maybe'], validate());
    expect(args.flagErrors?.[0]).toMatch(/takes no value/);
  });

  it('keeps value flags consuming their argument, and passes through after --', () => {
    const args = parseArgs(['--kind', 'scene', '--', '--not-a-flag'], validate());
    expect(args.flags.kind).toBe('scene');
    expect(args.positionals).toEqual(['--not-a-flag']);
  });
});

describe('molen CLI surface', () => {
  it('rejects an unknown flag with a did-you-mean and exit code 2', async () => {
    const bogus = await cli('validate', 'nope.json', '--bogus', '1');
    expect(bogus.code).toBe(2);
    expect(bogus.err).toContain('unknown flag --bogus');

    const typo = await cli('validate', 'nope.json', '--verify-file');
    expect(typo.code).toBe(2);
    expect(typo.err).toContain('did you mean --verify-files?');
  });

  it('accepts --flag=value end to end', async () => {
    const r = await cli(
      'sim',
      'run',
      join(projectDir, 'scenes/main.scene.json'),
      '--ticks=3',
      '--hash',
    );
    expect(r.err, r.err).toBe('');
    expect(r.code).toBe(0);
    expect(r.out).toContain('tick: 3');
    expect(r.out).toContain('hash: ');
  }, 60_000);

  it('runs a project scene by name from outside the project when --project is given', async () => {
    const r = await cli(
      'sim',
      'run',
      'main',
      '--ticks',
      '3',
      '--project',
      join(projectDir, 'project.json'),
    );
    expect(r.err, r.err).toBe('');
    expect(r.code).toBe(0);
    expect(r.out).toContain('tick: 3');
  }, 60_000);

  it('does not let a boolean flag eat the path that follows it', async () => {
    // Before: the path became the value of --verify-files, leaving no positional, so the command
    // died with its usage line. Now the path is parsed and the op gets to answer for itself.
    const r = await cli('validate', '--verify-files', join(projectDir, 'scenes/main.scene.json'));
    expect(r.err).not.toContain('usage: molen validate');
    expect(r.err).toContain('terrain-package');

    // The same shape with a boolean flag that does apply, end to end.
    const sim = await cli(
      'sim',
      'run',
      '--hash',
      'main',
      '--ticks',
      '3',
      '--project',
      join(projectDir, 'project.json'),
    );
    expect(sim.err, sim.err).toBe('');
    expect(sim.code).toBe(0);
    expect(sim.out).toContain('hash: ');
  }, 60_000);

  it('prints the package version for --version and -v', async () => {
    const long = await cli('--version');
    expect(long.code).toBe(0);
    expect(long.out.trim()).toBe(cliVersion());
    expect(long.out.trim()).toMatch(/^\d+\.\d+\.\d+/);
    expect((await cli('-v')).out).toBe(long.out);
  });

  it('prints help for -h, --help and help — including the figure and scripts groups', async () => {
    const help = await cli('--help');
    expect(help.code).toBe(0);
    // The hand-written help omitted both of these groups entirely.
    expect(help.out).toContain('figure preview');
    expect(help.out).toContain('scripts check');
    expect(help.out).toContain('sim run');
    expect((await cli('-h')).out).toBe(help.out);
    expect((await cli('help')).out).toBe(help.out);
  });

  it('prints one command usage for help <cmd> and for <cmd> --help, exit 0', async () => {
    const shot = await cli('help', 'shot');
    expect(shot.code).toBe(0);
    expect(shot.out).toContain('molen shot <scene> --out <png>');
    expect(shot.out).toContain('scenePath');
    expect((await cli('shot', '--help')).out).toBe(shot.out);
  });

  it('suggests a command for a typo and for an unknown help topic', async () => {
    const typo = await cli('shto');
    expect(typo.code).toBe(2);
    expect(typo.err).toContain('did you mean shot?');
    expect((await cli('help', 'shto')).code).toBe(2);
  });

  it('documents figure preview --mode jump|fall, which the code accepts', async () => {
    const figure = await cli('help', 'figure');
    expect(figure.out).toContain('jump');
    expect(figure.out).toContain('fall');
  });
});
