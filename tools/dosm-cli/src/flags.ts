import { AxiError } from "axi-sdk-js";

export type FlagType = "string" | "number" | "boolean" | "string[]";

export type FlagValue = string | number | boolean | string[];

export interface ParsedFlags {
  positionals: string[];
  flags: Record<string, FlagValue>;
}

/** Parse argv into positionals and typed flags, rejecting unknown input. */
export function parseFlags(
  argv: string[],
  specs: Record<string, FlagType>,
  command: string,
): ParsedFlags {
  const positionals: string[] = [];
  const flags: Record<string, FlagValue> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const eq = arg.indexOf("=");
    const name = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
    const type = specs[name];
    if (!type) {
      const valid = Object.keys(specs).map((f) => `--${f}`).join(", ");
      throw new AxiError(
        `unknown flag --${name} for \`${command}\``,
        "VALIDATION_ERROR",
        [
          `valid flags for \`${command}\`: ${valid} (--help always allowed)`,
          `Run \`${command} --help\` for the full reference`,
        ],
      );
    }
    if (type === "boolean") {
      if (eq !== -1) {
        throw new AxiError(
          `--${name} does not take a value`,
          "VALIDATION_ERROR",
          [`valid flags for \`${command}\`: ${Object.keys(specs).map((f) => `--${f}`).join(", ")}`],
        );
      }
      flags[name] = true;
      continue;
    }
    let raw: string;
    if (eq !== -1) {
      raw = arg.slice(eq + 1);
    } else {
      const next = argv[++i];
      if (next === undefined) {
        throw new AxiError(
          `--${name} requires a value`,
          "VALIDATION_ERROR",
          [`Run \`${command} --help\` for usage`],
        );
      }
      raw = next;
    }
    if (type === "number") {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 0) {
        throw new AxiError(
          `--${name} expects a non-negative integer, got "${raw}"`,
          "VALIDATION_ERROR",
        );
      }
      flags[name] = n;
    } else if (type === "string[]") {
      const arr = (flags[name] as string[] | undefined) ?? [];
      arr.push(raw);
      flags[name] = arr;
    } else {
      flags[name] = raw;
    }
  }
  return { positionals, flags };
}

export function str(flags: Record<string, FlagValue>, name: string): string | undefined {
  const v = flags[name];
  return typeof v === "string" ? v : undefined;
}

export function num(flags: Record<string, FlagValue>, name: string): number | undefined {
  const v = flags[name];
  return typeof v === "number" ? v : undefined;
}

export function bool(flags: Record<string, FlagValue>, name: string): boolean {
  return flags[name] === true;
}

export function strArray(flags: Record<string, FlagValue>, name: string): string[] {
  const v = flags[name];
  return Array.isArray(v) ? (v as string[]) : [];
}
