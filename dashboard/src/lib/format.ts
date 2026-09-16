/**
 * Shared number formatting (ticket #21) — each format exists in exactly one
 * place, so pages, chart components and the diagnosis lib cannot drift.
 */

/** en-US grouping, default decimals (whole counts, index values, tooltips). */
export function fmtNum(v: number): string {
  return new Intl.NumberFormat("en-US").format(v);
}

/** en-US with exactly one decimal — the RM-million figures. */
export function fmt1(v: number): string {
  return v.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** en-US with exactly two decimals — the per-visitor RM figures (fmtP-style). */
export function fmt2(v: number): string {
  return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Signed RM-million figure with one decimal: "+1,234.5 RM million". */
export function fmtRmMillion(v: number): string {
  return `${v >= 0 ? "+" : ""}${fmt1(v)} RM million`;
}
