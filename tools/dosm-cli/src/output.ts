export interface Truncated {
  text: string;
  total: number;
  truncated: boolean;
}

/** Truncate long text with a total-size marker (AXI truncation contract). */
export function truncate(text: string, limit = 500): Truncated {
  if (text.length <= limit) return { text, total: text.length, truncated: false };
  return { text: text.slice(0, limit), total: text.length, truncated: true };
}

/** Render a help block: help[N]: lines */
export function helpBlock(lines: string[]): string[] {
  return lines;
}
