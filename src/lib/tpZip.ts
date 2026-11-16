// Reads one file out of the zip that APIerSv1.ExportTPToZipString returns (base64).
// Sizes come from the central directory because Go writes data descriptors after each entry.

function u16(b: Uint8Array, o: number) { return b[o] | (b[o + 1] << 8); }
function u32(b: Uint8Array, o: number) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }

export async function readZipEntry(base64: string, name: string): Promise<string | null> {
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (u32(bytes, i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Tariff plan export is not a zip');
  const count = u16(bytes, eocd + 10);
  let p = u32(bytes, eocd + 16);
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (u32(bytes, p) !== 0x02014b50) throw new Error('Corrupt zip central directory');
    const method = u16(bytes, p + 10);
    const compressed = u32(bytes, p + 20);
    const nameLen = u16(bytes, p + 28);
    const extraLen = u16(bytes, p + 30);
    const commentLen = u16(bytes, p + 32);
    const local = u32(bytes, p + 42);
    const entryName = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    if (entryName === name) {
      const start = local + 30 + u16(bytes, local + 26) + u16(bytes, local + 28);
      const data = bytes.subarray(start, start + compressed);
      if (method === 0) return dec.decode(data);
      if (method !== 8) throw new Error(`Unsupported zip compression ${method}`);
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Response(stream).text();
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}
