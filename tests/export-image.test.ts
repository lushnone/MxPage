import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { EXPORT_JPEG_QUALITY, compressImageBufferForExport } from "../lib/utils/export-image";

test("export compression emits JPEG q88 without resizing", async () => {
  const png = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: "#336699" } })
    .png()
    .toBuffer();
  const jpeg = await compressImageBufferForExport(png);
  const meta = await sharp(jpeg).metadata();
  assert.equal(meta.format, "jpeg");
  assert.equal(meta.width, 1024);
  assert.equal(meta.height, 1024);
  assert.ok(jpeg.length < png.length, "JPEG export should be smaller than PNG original");
  assert.equal(EXPORT_JPEG_QUALITY, 88);
});