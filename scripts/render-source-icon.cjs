const fs = require('fs');
const zlib = require('zlib');

const size = 1024;
const scale = 3;
const width = size * scale;
const height = size * scale;
const pixels = Buffer.alloc(width * height * 4);

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(image) {
  const signature = Buffer.from('89504e470d0a1a0a', 'hex');
  const header = Buffer.alloc(13);
  header.writeUInt32BE(image.width, 0);
  header.writeUInt32BE(image.height, 4);
  header[8] = 8;
  header[9] = 6;

  const stride = image.width * 4;
  const raw = Buffer.alloc((stride + 1) * image.height);
  for (let y = 0; y < image.height; y += 1) {
    raw[y * (stride + 1)] = 0;
    image.pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([signature, pngChunk('IHDR', header), pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })), pngChunk('IEND', Buffer.alloc(0))]);
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function blend(index, r, g, b, a) {
  const currentA = pixels[index + 3] / 255;
  const nextA = a + currentA * (1 - a);
  if (nextA <= 0) return;
  pixels[index] = Math.round((r * a + pixels[index] * currentA * (1 - a)) / nextA);
  pixels[index + 1] = Math.round((g * a + pixels[index + 1] * currentA * (1 - a)) / nextA);
  pixels[index + 2] = Math.round((b * a + pixels[index + 2] * currentA * (1 - a)) / nextA);
  pixels[index + 3] = Math.round(nextA * 255);
}

function paintCircle(cx, cy, radius, color, alpha = 1) {
  const minX = Math.max(0, Math.floor((cx - radius - 3) * scale));
  const maxX = Math.min(width - 1, Math.ceil((cx + radius + 3) * scale));
  const minY = Math.max(0, Math.floor((cy - radius - 3) * scale));
  const maxY = Math.min(height - 1, Math.ceil((cy + radius + 3) * scale));

  for (let y = minY; y <= maxY; y += 1) {
    const py = (y + 0.5) / scale;
    for (let x = minX; x <= maxX; x += 1) {
      const px = (x + 0.5) / scale;
      const distance = Math.hypot(px - cx, py - cy) - radius;
      const coverage = (1 - smoothstep(-0.7, 0.7, distance)) * alpha;
      if (coverage <= 0) continue;
      blend((y * width + x) * 4, color[0], color[1], color[2], coverage);
    }
  }
}

function roundedRectDistance(px, py, x, y, w, h, r) {
  const qx = Math.abs(px - (x + w / 2)) - (w / 2 - r);
  const qy = Math.abs(py - (y + h / 2)) - (h / 2 - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

function paintRoundedRect(x, y, w, h, r, color, alpha = 1) {
  const minX = Math.max(0, Math.floor((x - 3) * scale));
  const maxX = Math.min(width - 1, Math.ceil((x + w + 3) * scale));
  const minY = Math.max(0, Math.floor((y - 3) * scale));
  const maxY = Math.min(height - 1, Math.ceil((y + h + 3) * scale));

  for (let pyI = minY; pyI <= maxY; pyI += 1) {
    const py = (pyI + 0.5) / scale;
    for (let pxI = minX; pxI <= maxX; pxI += 1) {
      const px = (pxI + 0.5) / scale;
      const distance = roundedRectDistance(px, py, x, y, w, h, r);
      const coverage = (1 - smoothstep(-0.7, 0.7, distance)) * alpha;
      if (coverage <= 0) continue;
      blend((pyI * width + pxI) * 4, color[0], color[1], color[2], coverage);
    }
  }
}

function pointInPolygon(px, py, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const xi = points[i][0];
    const yi = points[i][1];
    const xj = points[j][0];
    const yj = points[j][1];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function segmentDistance(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const c = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px - (ax + c * vx), py - (ay + c * vy));
}

function polygonDistance(px, py, points) {
  let distance = Infinity;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    distance = Math.min(distance, segmentDistance(px, py, a[0], a[1], b[0], b[1]));
  }
  return pointInPolygon(px, py, points) ? -distance : distance;
}

function paintPolygon(points, color, alpha = 1) {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.max(0, Math.floor((Math.min(...xs) - 3) * scale));
  const maxX = Math.min(width - 1, Math.ceil((Math.max(...xs) + 3) * scale));
  const minY = Math.max(0, Math.floor((Math.min(...ys) - 3) * scale));
  const maxY = Math.min(height - 1, Math.ceil((Math.max(...ys) + 3) * scale));

  for (let y = minY; y <= maxY; y += 1) {
    const py = (y + 0.5) / scale;
    for (let x = minX; x <= maxX; x += 1) {
      const px = (x + 0.5) / scale;
      const distance = polygonDistance(px, py, points);
      const coverage = (1 - smoothstep(-0.7, 0.7, distance)) * alpha;
      if (coverage <= 0) continue;
      blend((y * width + x) * 4, color[0], color[1], color[2], coverage);
    }
  }
}

function downsample() {
  const output = Buffer.alloc(size * size * 4);
  const samples = scale * scale;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          const source = (((y * scale + sy) * width + x * scale + sx) * 4);
          r += pixels[source];
          g += pixels[source + 1];
          b += pixels[source + 2];
          a += pixels[source + 3];
        }
      }
      const target = (y * size + x) * 4;
      output[target] = Math.round(r / samples);
      output[target + 1] = Math.round(g / samples);
      output[target + 2] = Math.round(b / samples);
      output[target + 3] = Math.round(a / samples);
    }
  }
  return output;
}

for (let y = 0; y < height; y += 1) {
  const py = (y + 0.5) / scale;
  for (let x = 0; x < width; x += 1) {
    const px = (x + 0.5) / scale;
    const radial = Math.min(1, Math.hypot(px - 512, py - 512) / 512);
    const vignette = smoothstep(0.25, 1, radial);
    const value = Math.round(mix(18, 9, vignette));
    const alpha = 1 - smoothstep(509, 512, Math.hypot(px - 512, py - 512));
    blend((y * width + x) * 4, value, value, value, alpha);
  }
}

paintCircle(286, 382, 86, [252, 252, 252]);
paintCircle(512, 352, 110, [252, 252, 252]);
paintCircle(738, 382, 86, [252, 252, 252]);

paintRoundedRect(135, 480, 302, 226, 104, [252, 252, 252]);
paintRoundedRect(587, 480, 302, 226, 104, [252, 252, 252]);
paintRoundedRect(298, 458, 118, 300, 64, [9, 9, 9]);
paintRoundedRect(608, 458, 118, 300, 64, [9, 9, 9]);
paintRoundedRect(319, 476, 386, 305, 92, [252, 252, 252]);

paintPolygon(
  [
    [484, 520],
    [609, 520],
    [524, 648],
    [598, 648],
    [414, 858],
    [470, 703],
    [424, 703]
  ],
  [224, 0, 171]
);

const image = { width: size, height: size, pixels: downsample() };
fs.writeFileSync('static/favicon.png', encodePng(image));
