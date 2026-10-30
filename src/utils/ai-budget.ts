/**
 * Conservative token estimate for French text with small local models: about
 * three characters per token. It errs on the side of refusing a prompt rather
 * than letting the model drop its beginning.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3);
}

/** Marker the prompts ask the model to use instead of inventing information. */
export const TO_COMPLETE_PATTERN = /\[À compléter\s*:[^\]]*\]/gi;

export function countToComplete(markdown: string): number {
  return markdown.match(TO_COMPLETE_PATTERN)?.length ?? 0;
}
