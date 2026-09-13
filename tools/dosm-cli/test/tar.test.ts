import { describe, expect, it } from "vitest";
import zlib from "node:zlib";
import { buildTar, extractTarEntries } from "../src/tar.ts";

describe("tar", () => {
  it("round-trips entries through build and extract", () => {
    const entries = [
      { name: "data-catalogue/a.json", data: '{"title_en":"A"}' },
      { name: "data-catalogue/b.json", data: '{"title_en":"B"}' },
      { name: "other/ignored.txt", data: "skip me" },
    ];
    const gz = zlib.gzipSync(buildTar(entries));
    const extracted = extractTarEntries(zlib.gunzipSync(gz));
    expect(extracted.map((e) => e.name)).toEqual([
      "data-catalogue/a.json",
      "data-catalogue/b.json",
      "other/ignored.txt",
    ]);
    expect(new TextDecoder().decode(extracted[0]!.data)).toBe('{"title_en":"A"}');
  });

  it("skips pax extended headers by size", () => {
    const encoder = new TextEncoder();
    const mkHeader = (name: string, size: number, type: number): Uint8Array => {
      const h = new Uint8Array(512);
      encoder.encodeInto(name, h.subarray(0, 100));
      encoder.encodeInto(`${size.toString(8).padStart(11, "0")} `, h.subarray(124, 136));
      h[156] = type;
      h.fill(0x20, 148, 156);
      let sum = 0;
      for (const b of h) sum += b;
      encoder.encodeInto(`${sum.toString(8).padStart(6, "0")}\0 `, h.subarray(148, 156));
      return h;
    };
    const paxPayload = encoder.encode("30 mtime=1700000000\n");
    const pad = (512 - (paxPayload.length % 512)) % 512;
    const paxBlock = new Uint8Array(512 + paxPayload.length + pad);
    paxBlock.set(mkHeader("pax_header", paxPayload.length, 0x78), 0);
    paxBlock.set(paxPayload, 512);
    const file = buildTar([{ name: "hello.json", data: "{}" }]);
    const out = extractTarEntries(new Uint8Array([...paxBlock, ...file]));
    expect(out).toHaveLength(1);
    expect(out[0]!.name).toBe("hello.json");
  });
});
