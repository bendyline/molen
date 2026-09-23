export interface ValidationIssue {
  /** JSON Pointer to the offending location, e.g. "/components/transform/pos". */
  path: string;
  /** Stable machine code, e.g. "invalid_type", "unrecognized_keys". */
  code: string;
  /** What is wrong. */
  message: string;
  /** What valid looks like. */
  expected?: string;
  /** What was found (truncated repr). */
  received?: string;
  /** Did-you-mean, example value, or fix suggestion. */
  hint?: string;
  docsRef?: string;
  /** Absent = error (blocks). `notice` = advisory only; the document is still accepted. */
  severity?: 'error' | 'notice';
}

/** The issues that make a document invalid (everything except notices). */
export function blockingIssues(issues: ValidationIssue[]): ValidationIssue[] {
  return issues.filter((i) => i.severity !== 'notice');
}

/** The advisory issues only. */
export function noticeIssues(issues: ValidationIssue[]): ValidationIssue[] {
  return issues.filter((i) => i.severity === 'notice');
}

export interface ValidationSuccess<T> {
  ok: true;
  value: T;
  /** Non-fatal advisories (e.g. code "deprecated_format" after a legacy auto-upgrade). */
  notices?: ValidationIssue[];
}

export interface ValidationFailure {
  ok: false;
  issues: ValidationIssue[];
  formatted: string;
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

const MAX_ISSUES = 10;

/** Renders the agent-facing error block. Its exact shape is a tested product surface. */
export function formatIssues(label: string, issues: ValidationIssue[]): string {
  const shown = issues.slice(0, MAX_ISSUES);
  const lines: string[] = [];
  lines.push(
    `✖ ${label} failed validation (${issues.length} issue${issues.length === 1 ? '' : 's'})`,
  );
  shown.forEach((issue, i) => {
    lines.push('');
    lines.push(`${i + 1}. ${issue.path === '' ? '/' : issue.path}`);
    lines.push(`   ${issue.message}`);
    if (issue.expected !== undefined) lines.push(`   expected: ${issue.expected}`);
    if (issue.received !== undefined) lines.push(`   received: ${issue.received}`);
    if (issue.hint !== undefined) lines.push(`   hint:     ${issue.hint}`);
    if (issue.docsRef !== undefined) lines.push(`   docs:     ${issue.docsRef}`);
  });
  if (issues.length > MAX_ISSUES) {
    lines.push('');
    lines.push(`…and ${issues.length - MAX_ISSUES} more`);
  }
  return lines.join('\n');
}
