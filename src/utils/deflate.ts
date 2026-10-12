/**
 * Compress bytes into a PDF FlateDecode stream (zlib format).
 * The browser's native zlib is about 3× faster than pdf-lib's JavaScript one, for files 1-2% bigger.
 */
export async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const compressed = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(compressed).arrayBuffer());
}

/**
 * Decompress a PDF FlateDecode stream (zlib format), with the browser's native zlib
 */
export async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const decompressed = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(decompressed).arrayBuffer());
}
