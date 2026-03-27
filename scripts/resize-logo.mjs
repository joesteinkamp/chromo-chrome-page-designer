/**
 * Resize the source logo image to Chrome extension icon sizes.
 * Uses canvas-free approach: reads source PNG, creates downscaled versions.
 * Run: node scripts/resize-logo.mjs <source-image-path>
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { deflateSync, inflateSync } from "zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, "../public/icons");
mkdirSync(outDir, { recursive: true });

// --- PNG decoder (minimal) ---

function decodePNG(buffer) {
  // Verify signature
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) {
    if (buffer[i] !== sig[i]) throw new Error("Not a PNG file");
  }

  let offset = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idatChunks = [];

  while (offset < buffer.length) {
    const len = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.slice(offset + 8, offset + 8 + len);
    offset += 12 + len; // 4 len + 4 type + data + 4 crc

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  const compressed = Buffer.concat(idatChunks);
  const raw = inflateSync(compressed);

  // Parse scanlines (assuming RGBA, 8-bit, no interlacing)
  const bpp = colorType === 6 ? 4 : 3; // RGBA or RGB
  const pixels = Buffer.alloc(width * height * 4);

  let rawOffset = 0;
  for (let y = 0; y < height; y++) {
    const filterType = raw[rawOffset++];
    const scanline = Buffer.alloc(width * bpp);
    const prevScanline = y > 0 ? Buffer.alloc(width * bpp) : null;

    // Copy raw bytes
    for (let x = 0; x < width * bpp; x++) {
      scanline[x] = raw[rawOffset++];
    }

    // Apply filter
    for (let x = 0; x < width * bpp; x++) {
      const a = x >= bpp ? scanline[x - bpp] : 0;
      const b = prevScanline && y > 0 ? getPrevPixel(pixels, y - 1, x, width, bpp) : 0;
      const c = (x >= bpp && y > 0) ? getPrevPixel(pixels, y - 1, x - bpp, width, bpp) : 0;

      switch (filterType) {
        case 0: break; // None
        case 1: scanline[x] = (scanline[x] + a) & 0xFF; break; // Sub
        case 2: scanline[x] = (scanline[x] + b) & 0xFF; break; // Up
        case 3: scanline[x] = (scanline[x] + Math.floor((a + b) / 2)) & 0xFF; break; // Average
        case 4: scanline[x] = (scanline[x] + paethPredictor(a, b, c)) & 0xFF; break; // Paeth
      }
    }

    // Write to pixel buffer
    for (let x = 0; x < width; x++) {
      const si = x * bpp;
      const di = (y * width + x) * 4;
      pixels[di] = scanline[si];
      pixels[di + 1] = scanline[si + 1];
      pixels[di + 2] = scanline[si + 2];
      pixels[di + 3] = bpp === 4 ? scanline[si + 3] : 255;
    }
  }

  return { width, height, pixels };
}

function getPrevPixel(pixels, y, x, width, bpp) {
  const px = Math.floor(x / bpp);
  const channel = x % bpp;
  if (px < 0 || px >= width) return 0;
  return pixels[(y * width + px) * 4 + channel];
}

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

// --- Bilinear resize ---

function resize(src, srcW, srcH, dstW, dstH) {
  const dst = Buffer.alloc(dstW * dstH * 4);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;

  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const sx = x * xRatio;
      const sy = y * yRatio;
      const sx0 = Math.floor(sx);
      const sy0 = Math.floor(sy);
      const sx1 = Math.min(sx0 + 1, srcW - 1);
      const sy1 = Math.min(sy0 + 1, srcH - 1);
      const fx = sx - sx0;
      const fy = sy - sy0;

      const di = (y * dstW + x) * 4;
      for (let c = 0; c < 4; c++) {
        const v00 = src[(sy0 * srcW + sx0) * 4 + c];
        const v10 = src[(sy0 * srcW + sx1) * 4 + c];
        const v01 = src[(sy1 * srcW + sx0) * 4 + c];
        const v11 = src[(sy1 * srcW + sx1) * 4 + c];
        dst[di + c] = Math.round(
          v00 * (1 - fx) * (1 - fy) +
          v10 * fx * (1 - fy) +
          v01 * (1 - fx) * fy +
          v11 * fx * fy
        );
      }
    }
  }
  return dst;
}

// --- PNG encoder ---

function encodePNG(width, height, pixels) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const ihdrChunk = makeChunk("IHDR", ihdr);

  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0;
    pixels.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idatChunk = makeChunk("IDAT", deflateSync(raw));
  const iendChunk = makeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeB = Buffer.from(type, "ascii");
  const crcData = Buffer.concat([typeB, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData), 0);
  return Buffer.concat([len, typeB, data, crc]);
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[n] = c;
}
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// --- Main ---

const srcPath = process.argv[2];
if (!srcPath) {
  console.error("Usage: node resize-logo.mjs <source-image.png>");
  process.exit(1);
}

console.log(`Reading ${srcPath}...`);
const srcBuf = readFileSync(srcPath);
const { width, height, pixels } = decodePNG(srcBuf);
console.log(`Source: ${width}x${height}`);

for (const size of [16, 48, 128]) {
  const resized = resize(pixels, width, height, size, size);
  const png = encodePNG(size, size, resized);
  const outPath = resolve(outDir, `icon-${size}.png`);
  writeFileSync(outPath, png);
  console.log(`Generated icon-${size}.png (${png.length} bytes)`);
}

console.log("Done!");
