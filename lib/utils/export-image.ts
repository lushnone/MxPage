import sharp from "sharp";

/** JPEG quality for ZIP / long-image downloads; originals in storage stay unchanged. */
export const EXPORT_JPEG_QUALITY = 88;

export async function compressImageBufferForExport(buffer: Buffer) {
  return sharp(buffer, { limitInputPixels: 40_000_000 })
    .rotate()
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: EXPORT_JPEG_QUALITY })
    .toBuffer();
}