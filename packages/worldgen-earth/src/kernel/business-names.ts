/** Business names as mapped, compared, and cleaned for a sign. */

/** Longest name a sign shows, in characters; a longer one keeps its category sign. */
export const MAX_SIGN_NAME_LENGTH = 40;

/** Comparison form: NFKC, lower case, without apostrophes, spaces and `.-_/`. */
export function normalizeBusinessName(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’'\s.\-_/]/g, '');
}

/** Whether text is written in Latin letters (with digits, punctuation and accents). */
export function isLatinText(value: string): boolean {
  return /^[\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]*$/u.test(value);
}

/**
 * A mapped name as a sign shows it, or undefined when nothing sign-worthy is left. NFKC folds
 * full-width letters and brackets; decorative symbols and emoji (☆, ♪) go; a trailing store
 * number (`#1234`), a trailing parenthesized qualifier (`(Downtown)`, `(阪急嵐山駅前)`) and a
 * Japanese branch name after a space (`ローソン 京都駅前店`) are dropped, as a storefront does
 * not carry them. A name longer than {@link MAX_SIGN_NAME_LENGTH} is not shortened: it is
 * returned undefined, and the place keeps its category sign.
 */
export function cleanBusinessName(value: string): string | undefined {
  let text = value
    .normalize('NFKC')
    .replace(/[\p{So}\p{Co}\p{Cs}​-‍]|︎|️/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const trim = (pattern: RegExp): void => {
    const shorter = text.replace(pattern, '').trim();
    if (Array.from(shorter).length >= 2) text = shorter;
  };
  trim(/\s*#\s*\d+$/u);
  trim(/\s*\([^()]*\)$/u);
  trim(/\s+\S+(?:店|支店|営業所)$/u);
  if (!/[\p{L}\p{N}]/u.test(text)) return undefined;
  return Array.from(text).length <= MAX_SIGN_NAME_LENGTH ? text : undefined;
}
