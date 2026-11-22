/**
 * Keyword chips are stored in the existing memo string, not a new DB field.
 * Recognize only complete tokens separated by the app's original " · " delimiter:
 * ordinary prose containing the same words must never be removed.
 */
export const MEMO_MAX_LENGTH = 500;
const DELIMITER = " · ";

export function hasMemoKeyword(memo: string, keyword: string): boolean {
  return memo.split(DELIMITER).includes(keyword);
}

/** Returns the original memo unchanged when adding would exceed 500 chars. */
export function toggleMemoKeyword(memo: string, keyword: string): string {
  const parts = memo.split(DELIMITER);
  if (parts.includes(keyword)) {
    // Explicitly deselecting a complete keyword removes only matching tokens.
    // No other written text is modified, even when legacy data contains duplicates.
    return parts.filter((part) => part !== keyword).join(DELIMITER);
  }
  const next = memo ? memo + DELIMITER + keyword : keyword;
  return next.length <= MEMO_MAX_LENGTH ? next : memo;
}
