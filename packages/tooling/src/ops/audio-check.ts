import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { type SoundbankDoc, validate } from '@bendyline/molen-schema';
import { probeAudio } from '../audio-probe';
import { parseJson } from './build';
import { guardOp } from './errors';

export interface CheckSoundbankInput {
  /** molen/soundbank@1 file. */
  bankPath: string;
}

export interface SoundbankIssue {
  path: string;
  message: string;
  severity: 'error' | 'notice';
}

export interface CheckSoundbankOutput {
  ok: boolean;
  id?: string;
  sounds: number;
  clips: number;
  bytes: number;
  licenses: Record<string, number>;
  issues: SoundbankIssue[];
  error?: string;
}

const fail = (error: string): CheckSoundbankOutput => ({
  ok: false,
  sounds: 0,
  clips: 0,
  bytes: 0,
  licenses: {},
  issues: [],
  error,
});

/** Validate a sound bank and every clip it names: present, hash, duration, loop points. */
export function checkSoundbank(input: CheckSoundbankInput): Promise<CheckSoundbankOutput> {
  return guardOp(fail, () => checkSoundbankImpl(input));
}

async function checkSoundbankImpl(input: CheckSoundbankInput): Promise<CheckSoundbankOutput> {
  const bankPath = resolve(input.bankPath);
  const raw = parseJson(await readFile(bankPath, 'utf8'));
  const v = validate('soundbank', raw);
  if (!v.ok) return fail(v.formatted);
  const bank = v.value as SoundbankDoc;
  const dir = dirname(bankPath);
  const issues: SoundbankIssue[] = [];
  const licenses: Record<string, number> = {};
  let clips = 0;
  let bytes = 0;
  for (const [id, entry] of Object.entries(bank.sounds)) {
    const at = `/sounds/${id}`;
    licenses[entry.source.license] = (licenses[entry.source.license] ?? 0) + 1;
    if (!entry.description)
      issues.push({
        path: at,
        message: 'no description (agents choose sounds by it)',
        severity: 'notice',
      });
    if (!entry.source.url && !entry.source.prompt && !entry.source.site)
      issues.push({
        path: `${at}/source`,
        message: 'no origin: add url, site or prompt',
        severity: 'notice',
      });
    for (const [i, clip] of entry.clips.entries()) {
      let data: Uint8Array;
      try {
        data = new Uint8Array(await readFile(join(dir, clip)));
      } catch {
        issues.push({
          path: `${at}/clips/${i}`,
          message: `missing file ${clip}`,
          severity: 'error',
        });
        continue;
      }
      clips++;
      bytes += data.length;
      if (i === 0 && entry.hash) {
        const hash = `sha256:${createHash('sha256').update(data).digest('hex')}`;
        if (hash !== entry.hash)
          issues.push({
            path: `${at}/hash`,
            message: `${clip} changed since import`,
            severity: 'error',
          });
      }
      const probe = probeAudio(data);
      if (i === 0 && entry.durationS !== undefined && probe.durationS !== undefined) {
        if (Math.abs(probe.durationS - entry.durationS) > 0.1)
          issues.push({
            path: `${at}/durationS`,
            message: `durationS ${entry.durationS} but ${clip} is ${probe.durationS.toFixed(3)}s`,
            severity: 'error',
          });
      }
      if (
        entry.loopEnd !== undefined &&
        probe.durationS !== undefined &&
        entry.loopEnd > probe.durationS + 0.01
      )
        issues.push({
          path: `${at}/loopEnd`,
          message: `loopEnd ${entry.loopEnd} is past the end of ${clip} (${probe.durationS.toFixed(3)}s)`,
          severity: 'error',
        });
    }
  }
  return {
    ok: !issues.some((i) => i.severity === 'error'),
    id: bank.id,
    sounds: Object.keys(bank.sounds).length,
    clips,
    bytes,
    licenses,
    issues,
  };
}
