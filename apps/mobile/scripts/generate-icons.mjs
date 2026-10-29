// Draws the Taskora app icons from the theme's accent colour, with no image
// library: every shape is a signed-distance field, rendered with one pixel of
// anti-aliasing and written as a PNG. Run it from apps/mobile:
//   node scripts/generate-icons.mjs
import { deflateSync, crc32 } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../assets/images");

const ACCENT = [0x4b, 0x5b, 0xd6];
const WHITE = [0xff, 0xff, 0xff];
const BLACK = [0x00, 0x00, 0x00];

const clamp01 = (value) => Math.min(1, Math.max(0, value));

// Distance to a rounded rectangle centred at (cx, cy).
const roundedRect = (x, y, cx, cy, halfW, halfH, radius) => {
  const qx = Math.abs(x - cx) - (halfW - radius);
  const qy = Math.abs(y - cy) - (halfH - radius);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
};

// Distance to a line segment with round ends of the given radius.
const capsule = (x, y, ax, ay, bx, by, radius) => {
  const pax = x - ax;
  const pay = y - ay;
  const bax = bx - ax;
  const bay = by - ay;
  const h = clamp01((pax * bax + pay * bay) / (bax * bax + bay * bay));
  return Math.hypot(pax - bax * h, pay - bay * h) - radius;
};

// The check mark, drawn in a 1024 space. `scale` shrinks it around the centre.
const checkDistance = (x, y, scale) => {
  const centre = 512;
  const at = (px, py) => [centre + (px - centre) * scale, centre + (py - centre) * scale];
  const [ax, ay] = at(292, 540);
  const [bx, by] = at(452, 700);
  const [cx, cy] = at(752, 352);
  const radius = 66 * scale;
  return Math.min(capsule(x, y, ax, ay, bx, by, radius), capsule(x, y, bx, by, cx, cy, radius));
};

const render = (size, shade) => {
  const pixels = Buffer.alloc(size * size * 4);
  const unit = 1024 / size;
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const x = (col + 0.5) * unit;
      const y = (row + 0.5) * unit;
      const [r, g, b, a] = shade(x, y, unit);
      const offset = (row * size + col) * 4;
      pixels[offset] = r;
      pixels[offset + 1] = g;
      pixels[offset + 2] = b;
      pixels[offset + 3] = Math.round(clamp01(a) * 255);
    }
  }
  return pixels;
};

// Colour `over` painted on top of `under`, each with its own coverage.
const over = (top, topAlpha, bottom, bottomAlpha) => {
  const alpha = topAlpha + bottomAlpha * (1 - topAlpha);
  if (alpha === 0) {
    return [0, 0, 0, 0];
  }
  const mix = (t, u) => Math.round((t * topAlpha + u * bottomAlpha * (1 - topAlpha)) / alpha);
  return [mix(top[0], bottom[0]), mix(top[1], bottom[1]), mix(top[2], bottom[2]), alpha];
};

const coverage = (distance, unit) => clamp01(0.5 - distance / unit);

const png = (size, pixels) => {
  const chunk = (type, data) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, "ascii");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])) >>> 0, 0);
    return Buffer.concat([head, data, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let row = 0; row < size; row += 1) {
    const start = row * (size * 4 + 1);
    rows[start] = 0;
    pixels.copy(rows, start + 1, row * size * 4, (row + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

const write = (name, size, shade) => {
  writeFileSync(path.join(OUT, name), png(size, render(size, shade)));
  process.stdout.write(`${name} ${size}px\n`);
};

mkdirSync(OUT, { recursive: true });

// iOS and the store: full bleed, the system rounds the corners.
write("icon.png", 1024, (x, y, unit) =>
  over(WHITE, coverage(checkDistance(x, y, 1), unit), ACCENT, 1),
);

// Android adaptive icon: a plain background and a mark inside the safe circle.
write("android-icon-background.png", 1024, () => [...ACCENT, 1]);
write("android-icon-foreground.png", 1024, (x, y, unit) => [
  ...WHITE,
  coverage(checkDistance(x, y, 0.72), unit),
]);
// Themed icons use only the shape's alpha.
write("android-icon-monochrome.png", 1024, (x, y, unit) => [
  ...BLACK,
  coverage(checkDistance(x, y, 0.72), unit),
]);

// Splash: the rounded mark on a transparent square.
write("splash-icon.png", 1024, (x, y, unit) => {
  const tile = coverage(roundedRect(x, y, 512, 512, 360, 360, 150), unit);
  return over(WHITE, coverage(checkDistance(x, y, 0.7), unit), ACCENT, tile);
});

// Browser tab icon.
write("favicon.png", 48, (x, y, unit) => {
  const tile = coverage(roundedRect(x, y, 512, 512, 512, 512, 220), unit);
  return over(WHITE, coverage(checkDistance(x, y, 1), unit), ACCENT, tile);
});
