import { describe, expect, it } from "vitest";
import { VERSION } from "../src/version.ts";
import { main } from "../src/cli.ts";

async function capture(argv: string[]): Promise<{ out: string; code: number }> {
  let out = "";
  const origExit = process.exitCode;
  process.exitCode = 0;
  await main(argv, { stdout: { write: (chunk: string) => (out += chunk) } });
  const code = process.exitCode ?? 0;
  process.exitCode = origExit;
  return { out, code };
}

describe("cli boundary", () => {
  it("-v / -V / --version print the bare version and exit 0", async () => {
    for (const flag of ["-v", "-V", "--version"]) {
      const { out, code } = await capture([flag]);
      expect(out.trim()).toBe(VERSION);
      expect(code).toBe(0);
    }
  });

  it("rejects unknown commands with exit 2", async () => {
    const { out, code } = await capture(["frobnicate"]);
    expect(code).toBe(2);
    expect(out).toContain("Unknown command: frobnicate");
  });

  it("rejects flags before the command", async () => {
    const { out, code } = await capture(["--limit", "5", "list"]);
    expect(code).toBe(2);
    expect(out).toContain("Flags must come after the command");
  });

  it("bare --help prints top-level usage", async () => {
    const { out } = await capture(["--help"]);
    expect(out).toContain("usage:");
    expect(out).toContain("dosm get");
  });

  it("per-command --help stays scoped to that command", async () => {
    const { out } = await capture(["get", "--help"]);
    expect(out).toContain("get - query records");
    expect(out).toContain("--filter");
    expect(out).not.toContain("download - save");
  });

  it("home view shows catalog state or first-run guidance", async () => {
    const { out } = await capture([]);
    expect(out).toContain("catalog:");
    expect(out).toContain("dosm search");
  });
});
