/**
 * Minimal in-memory tar reader (ustar/gnu). Handles regular files; other entry
 * types (pax headers, directories, long names) are skipped by their size.
 */
export interface TarEntry {
  name: string;
  data: Uint8Array;
}

export function extractTarEntries(data: Uint8Array): TarEntry[] {
  const entries: TarEntry[] = [];
  const decoder = new TextDecoder();
  let off = 0;
  while (off + 512 <= data.length) {
    const header = data.subarray(off, off + 512);
    if (header.every((b) => b === 0)) break;
    const name = decoder.decode(header.subarray(0, 100)).split("\0")[0]!;
    const prefix = decoder.decode(header.subarray(345, 500)).split("\0")[0]!;
    const sizeField = decoder.decode(header.subarray(124, 136)).replace(/[^0-7]/g, "");
    const size = sizeField.length > 0 ? parseInt(sizeField, 8) : 0;
    const type = String.fromCharCode(header[156] ?? 0x20);
    off += 512;
    const payload = data.subarray(off, off + size);
    off += Math.ceil(size / 512) * 512;
    if (type === "0" || type === "\0") {
      entries.push({ name: prefix.length > 0 ? `${prefix}/${name}` : name, data: payload });
    }
  }
  return entries;
}

/** Build a tar archive in memory (for tests). */
export function buildTar(entries: Array<{ name: string; data: Uint8Array | string }>): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  for (const entry of entries) {
    const body = typeof entry.data === "string" ? encoder.encode(entry.data) : entry.data;
    const header = new Uint8Array(512);
    encoder.encodeInto(entry.name, header.subarray(0, 100));
    encoder.encodeInto(`${body.length.toString(8).padStart(11, "0")} `, header.subarray(124, 136));
    header[156] = 0x30; // '0'
    // checksum: spaces while computing, then octal
    header.fill(0x20, 148, 156);
    let sum = 0;
    for (const b of header) sum += b;
    encoder.encodeInto(`${sum.toString(8).padStart(6, "0")}\0 `, header.subarray(148, 156));
    chunks.push(header, body);
    const pad = (512 - (body.length % 512)) % 512;
    if (pad > 0) chunks.push(new Uint8Array(pad));
  }
  chunks.push(new Uint8Array(1024)); // end-of-archive
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}
