/**
 * Generate Chromo Design logo — paintbrush fist on pink background.
 * Simplified iconic version of the logo at 16, 48, 128px.
 * Run: node scripts/generate-icons.mjs
 */
import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { deflateSync } from "zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, "../public/icons");
mkdirSync(outDir, { recursive: true });

// --- PNG encoder ---
function encodePNG(width, height, pixels) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const ihdrChunk = makeChunk("IHDR", ihdr);
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0;
    pixels.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idatChunk = makeChunk("IDAT", deflateSync(raw, { level: 9 }));
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
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); crcTable[n] = c; }
function crc32(buf) { let crc = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8); return (crc ^ 0xFFFFFFFF) >>> 0; }

// --- Drawing helpers ---
function setPixel(pixels, w, x, y, r, g, b, a = 255) {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || x >= w || y < 0 || y >= w) return;
  const i = (y * w + x) * 4;
  const srcA = a / 255;
  const dstA = pixels[i + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA > 0) {
    pixels[i]     = Math.round((r * srcA + pixels[i]     * dstA * (1 - srcA)) / outA);
    pixels[i + 1] = Math.round((g * srcA + pixels[i + 1] * dstA * (1 - srcA)) / outA);
    pixels[i + 2] = Math.round((b * srcA + pixels[i + 2] * dstA * (1 - srcA)) / outA);
    pixels[i + 3] = Math.round(outA * 255);
  }
}

function fillCircle(pixels, w, cx, cy, r, red, green, blue, a = 255) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) {
        setPixel(pixels, w, x, y, red, green, blue, a);
      }
    }
  }
}

function fillRect(pixels, w, x1, y1, x2, y2, r, g, b, a = 255) {
  for (let y = Math.floor(y1); y < Math.ceil(y2); y++) {
    for (let x = Math.floor(x1); x < Math.ceil(x2); x++) {
      setPixel(pixels, w, x, y, r, g, b, a);
    }
  }
}

function fillRoundedRect(pixels, w, x1, y1, x2, y2, rad, r, g, b, a = 255) {
  for (let y = Math.floor(y1); y < Math.ceil(y2); y++) {
    for (let x = Math.floor(x1); x < Math.ceil(x2); x++) {
      let inside = true;
      if (x < x1 + rad && y < y1 + rad) inside = (x - (x1 + rad)) ** 2 + (y - (y1 + rad)) ** 2 <= rad * rad;
      else if (x > x2 - rad && y < y1 + rad) inside = (x - (x2 - rad)) ** 2 + (y - (y1 + rad)) ** 2 <= rad * rad;
      else if (x < x1 + rad && y > y2 - rad) inside = (x - (x1 + rad)) ** 2 + (y - (y2 - rad)) ** 2 <= rad * rad;
      else if (x > x2 - rad && y > y2 - rad) inside = (x - (x2 - rad)) ** 2 + (y - (y2 - rad)) ** 2 <= rad * rad;
      if (inside) setPixel(pixels, w, x, y, r, g, b, a);
    }
  }
}

function fillRotatedRect(pixels, w, cx, cy, hw, hh, angle, r, g, b, a = 255) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const extent = Math.ceil(Math.max(hw, hh) * 1.5);
  for (let dy = -extent; dy <= extent; dy++) {
    for (let dx = -extent; dx <= extent; dx++) {
      const lx = dx * cos + dy * sin;
      const ly = -dx * sin + dy * cos;
      if (Math.abs(lx) <= hw && Math.abs(ly) <= hh) {
        setPixel(pixels, w, cx + dx, cy + dy, r, g, b, a);
      }
    }
  }
}

// --- Draw the logo ---
function drawIcon(s) {
  const pixels = Buffer.alloc(s * s * 4);

  // Pink background (#FF69B4) rounded rect
  const margin = s * 0.04;
  const radius = s * 0.18;
  fillRoundedRect(pixels, s, margin, margin, s - margin, s - margin, radius, 0xFF, 0x69, 0xB4);

  const cx = s * 0.48;
  const cy = s * 0.52;
  const scale = s / 64;

  // Arm (vertical bar from bottom)
  fillRect(pixels, s, cx - 3 * scale, cy + 6 * scale, cx + 3 * scale, cy + 20 * scale, 0x1a, 0x1a, 0x1a);

  // Fist body (large rounded area)
  fillCircle(pixels, s, cx, cy, 10 * scale, 0x1a, 0x1a, 0x1a);
  fillCircle(pixels, s, cx, cy - 2 * scale, 10 * scale, 0x1a, 0x1a, 0x1a);

  // Fingers (4 bumps on top)
  for (let i = 0; i < 4; i++) {
    const fx = cx - 6 * scale + i * 4 * scale;
    const fy = cy - 9 * scale;
    fillCircle(pixels, s, fx, fy, 2.8 * scale, 0x1a, 0x1a, 0x1a);
    fillRect(pixels, s, fx - 2.8 * scale, fy, fx + 2.8 * scale, fy + 5 * scale, 0x1a, 0x1a, 0x1a);
  }

  // Thumb
  fillCircle(pixels, s, cx + 8 * scale, cy + 2 * scale, 3 * scale, 0x1a, 0x1a, 0x1a);

  // Paintbrush handle — angled through the fist
  const brushAngle = -Math.PI / 4;
  fillRotatedRect(pixels, s, cx + 1 * scale, cy + 1 * scale, 16 * scale, 1.5 * scale, brushAngle, 0x1a, 0x1a, 0x1a);

  // Brush tip (top-left end) — teardrop/leaf shape
  const tipX = cx - 10 * scale;
  const tipY = cy - 10 * scale;
  fillCircle(pixels, s, tipX, tipY, 3.5 * scale, 0xFF, 0x69, 0xB4); // Pink tip
  fillCircle(pixels, s, tipX - 1 * scale, tipY - 1 * scale, 2.5 * scale, 0xFF, 0x69, 0xB4);

  // Brush tip outline
  for (let a = 0; a < Math.PI * 2; a += 0.05) {
    const r1 = 3.5 * scale;
    setPixel(pixels, s, tipX + Math.cos(a) * r1, tipY + Math.sin(a) * r1, 0x1a, 0x1a, 0x1a, 200);
  }

  // Finger line details (subtle pink lines on dark fist to show finger separation)
  for (let i = 1; i < 4; i++) {
    const lx = cx - 6 * scale + i * 4 * scale - 2 * scale;
    for (let ly = cy - 8 * scale; ly < cy - 3 * scale; ly += 0.5) {
      setPixel(pixels, s, lx, ly, 0xFF, 0x69, 0xB4, 120);
    }
  }

  return pixels;
}

// Generate all sizes
for (const size of [16, 48, 128]) {
  const pixels = drawIcon(size);
  const png = encodePNG(size, size, pixels);
  writeFileSync(resolve(outDir, `icon-${size}.png`), png);
  console.log(`Generated icon-${size}.png (${png.length} bytes)`);
}

console.log("Done!");
