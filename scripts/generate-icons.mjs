/**
 * Generate PNG extension icons using raw PNG encoding (no dependencies).
 * Creates a design pen icon on a blue gradient rounded-rect background.
 * Run: node scripts/generate-icons.mjs
 */
import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { deflateSync } from "zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, "../public/icons");
mkdirSync(outDir, { recursive: true });

// --- Raw PNG encoder ---

function createPNG(width, height, pixels) {
  // pixels is Uint8Array of RGBA values (width * height * 4)
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = makeChunk("IHDR", ihdr);

  // IDAT — filter each row with "none" (0), then deflate
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter type: none
    pixels.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const compressed = deflateSync(raw);
  const idatChunk = makeChunk("IDAT", compressed);

  // IEND
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

// CRC32 lookup table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// --- Icon drawing ---

function drawIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);

  function setPixel(x, y, r, g, b, a) {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const i = (iy * size + ix) * 4;
    // Alpha blend
    const srcA = a / 255;
    const dstA = pixels[i + 3] / 255;
    const outA = srcA + dstA * (1 - srcA);
    if (outA > 0) {
      pixels[i] = Math.round((r * srcA + pixels[i] * dstA * (1 - srcA)) / outA);
      pixels[i + 1] = Math.round((g * srcA + pixels[i + 1] * dstA * (1 - srcA)) / outA);
      pixels[i + 2] = Math.round((b * srcA + pixels[i + 2] * dstA * (1 - srcA)) / outA);
      pixels[i + 3] = Math.round(outA * 255);
    }
  }

  const s = size;
  const margin = s * 0.06;
  const radius = s * 0.22;

  // Draw rounded rect background with gradient
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      // Check if inside rounded rect
      const rx = x - margin;
      const ry = y - margin;
      const rw = s - margin * 2;
      const rh = s - margin * 2;

      let inside = false;
      if (rx >= 0 && rx < rw && ry >= 0 && ry < rh) {
        // Check corners
        const cr = radius;
        let dist = 0;
        if (rx < cr && ry < cr) {
          dist = Math.sqrt((rx - cr) ** 2 + (ry - cr) ** 2);
          inside = dist <= cr;
        } else if (rx > rw - cr && ry < cr) {
          dist = Math.sqrt((rx - (rw - cr)) ** 2 + (ry - cr) ** 2);
          inside = dist <= cr;
        } else if (rx < cr && ry > rh - cr) {
          dist = Math.sqrt((rx - cr) ** 2 + (ry - (rh - cr)) ** 2);
          inside = dist <= cr;
        } else if (rx > rw - cr && ry > rh - cr) {
          dist = Math.sqrt((rx - (rw - cr)) ** 2 + (ry - (rh - cr)) ** 2);
          inside = dist <= cr;
        } else {
          inside = true;
        }
      }

      if (inside) {
        // Blue gradient from top-left to bottom-right
        const t = (x + y) / (s * 2);
        const r = Math.round(79 * (1 - t) + 43 * t);   // #4f -> #2b
        const g = Math.round(158 * (1 - t) + 125 * t);  // #9e -> #7d
        const b = Math.round(255 * (1 - t) + 233 * t);  // #ff -> #e9
        setPixel(x, y, r, g, b, 255);
      }
    }
  }

  // Draw a pen/pencil icon in white, centered
  const cx = s / 2;
  const cy = s / 2;
  const penLen = s * 0.35;
  const penW = s * 0.1;
  const angle = -Math.PI / 4; // 45 degrees, pointing top-right to bottom-left

  // Draw pen body as a rotated rectangle
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      // Transform to pen-local coordinates
      const dx = x - cx;
      const dy = y - cy;
      const lx = dx * cosA + dy * sinA;
      const ly = -dx * sinA + dy * cosA;

      // Pen body
      if (lx >= -penLen * 0.4 && lx <= penLen * 0.5 && Math.abs(ly) <= penW / 2) {
        setPixel(x, y, 255, 255, 255, 240);
      }

      // Pen tip (triangle)
      if (lx > penLen * 0.5 && lx < penLen * 0.5 + penW * 1.2) {
        const tipProgress = (lx - penLen * 0.5) / (penW * 1.2);
        const tipWidth = (penW / 2) * (1 - tipProgress);
        if (Math.abs(ly) <= tipWidth) {
          setPixel(x, y, 255, 255, 255, 240);
        }
      }

      // Pen cap (top end)
      if (lx >= -penLen * 0.4 - penW * 0.5 && lx < -penLen * 0.4 && Math.abs(ly) <= penW / 2 + 0.5) {
        setPixel(x, y, 255, 255, 255, 180);
      }
    }
  }

  // Small design sparkle dots
  const dotR = Math.max(1, s * 0.04);
  const dot1x = cx - s * 0.2;
  const dot1y = cy - s * 0.22;
  const dot2x = cx - s * 0.28;
  const dot2y = cy - s * 0.12;

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const d1 = Math.sqrt((x - dot1x) ** 2 + (y - dot1y) ** 2);
      if (d1 <= dotR * 1.5) setPixel(x, y, 255, 255, 255, Math.round(200 * Math.max(0, 1 - d1 / (dotR * 1.5))));

      const d2 = Math.sqrt((x - dot2x) ** 2 + (y - dot2y) ** 2);
      if (d2 <= dotR) setPixel(x, y, 255, 255, 255, Math.round(150 * Math.max(0, 1 - d2 / dotR)));
    }
  }

  return pixels;
}

// Generate all sizes
for (const size of [16, 48, 128]) {
  const pixels = drawIcon(size);
  const png = createPNG(size, size, pixels);
  writeFileSync(resolve(outDir, `icon-${size}.png`), png);
  console.log(`Generated icon-${size}.png (${png.length} bytes)`);
}

console.log("Done!");
