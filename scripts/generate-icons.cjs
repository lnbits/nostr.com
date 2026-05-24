const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const sourcePath = path.join('static', 'favicon.png');
const webSizes = [16, 32, 48, 72, 96, 144, 180, 192, 512];
const androidSizes = [
  ['mipmap-mdpi', 48],
  ['mipmap-hdpi', 72],
  ['mipmap-xhdpi', 96],
  ['mipmap-xxhdpi', 144],
  ['mipmap-xxxhdpi', 192]
];

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function pngChunks(buffer) {
  const chunks = [];
  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.slice(offset + 4, offset + 8).toString('ascii');
    const data = buffer.slice(offset + 8, offset + 8 + length);
    chunks.push({ type, data });
    offset += length + 12;
    if (type === 'IEND') break;
  }
  return chunks;
}

function decodePng(buffer) {
  if (buffer.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error(`${sourcePath} is not a PNG.`);
  const chunks = pngChunks(buffer);
  const header = chunks.find((chunk) => chunk.type === 'IHDR')?.data;
  if (!header) throw new Error(`${sourcePath} has no PNG header.`);
  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  const bitDepth = header[8];
  const colorType = header[9];
  const interlace = header[12];
  if (bitDepth !== 8 || ![2, 3, 6].includes(colorType) || interlace !== 0) throw new Error(`${sourcePath} must be an 8-bit non-interlaced RGB, indexed, or RGBA PNG.`);

  const compressed = Buffer.concat(chunks.filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.data));
  const raw = zlib.inflateSync(compressed);
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const stride = width * channels;
  const unfiltered = Buffer.alloc(width * height * channels);
  let inputOffset = 0;
  let outputOffset = 0;
  let previous = Buffer.alloc(stride);

  for (let y = 0; y < height; y += 1) {
    const filter = raw[inputOffset];
    inputOffset += 1;
    const scanline = Buffer.from(raw.slice(inputOffset, inputOffset + stride));
    inputOffset += stride;

    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? scanline[x - channels] : 0;
      const up = previous[x];
      const upLeft = x >= channels ? previous[x - channels] : 0;
      if (filter === 1) scanline[x] = (scanline[x] + left) & 255;
      else if (filter === 2) scanline[x] = (scanline[x] + up) & 255;
      else if (filter === 3) scanline[x] = (scanline[x] + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) {
        const predictor = left + up - upLeft;
        const pa = Math.abs(predictor - left);
        const pb = Math.abs(predictor - up);
        const pc = Math.abs(predictor - upLeft);
        scanline[x] = (scanline[x] + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft)) & 255;
      } else if (filter !== 0) {
        throw new Error(`Unsupported PNG filter ${filter}.`);
      }
    }

    scanline.copy(unfiltered, outputOffset);
    previous = scanline;
    outputOffset += stride;
  }

  const pixels = colorType === 6 ? unfiltered : expandToRgba(unfiltered, width, height, colorType, chunks);
  return { width, height, pixels };
}

function expandToRgba(source, width, height, colorType, chunks) {
  const pixels = Buffer.alloc(width * height * 4);
  if (colorType === 2) {
    for (let i = 0, o = 0; i < source.length; i += 3, o += 4) {
      pixels[o] = source[i];
      pixels[o + 1] = source[i + 1];
      pixels[o + 2] = source[i + 2];
      pixels[o + 3] = 255;
    }
    return pixels;
  }

  const palette = chunks.find((chunk) => chunk.type === 'PLTE')?.data;
  if (!palette) throw new Error(`${sourcePath} is indexed but has no palette.`);
  const alpha = chunks.find((chunk) => chunk.type === 'tRNS')?.data ?? Buffer.alloc(0);
  for (let i = 0, o = 0; i < source.length; i += 1, o += 4) {
    const index = source[i];
    const paletteOffset = index * 3;
    pixels[o] = palette[paletteOffset] ?? 0;
    pixels[o + 1] = palette[paletteOffset + 1] ?? 0;
    pixels[o + 2] = palette[paletteOffset + 2] ?? 0;
    pixels[o + 3] = alpha[index] ?? 255;
  }
  return pixels;
}

function resizeCover(image, size) {
  const pixels = Buffer.alloc(size * size * 4);
  const scale = Math.max(size / image.width, size / image.height);
  const cropWidth = size / scale;
  const cropHeight = size / scale;
  const cropX = (image.width - cropWidth) / 2;
  const cropY = (image.height - cropHeight) / 2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sourceX = Math.min(image.width - 1, Math.max(0, Math.floor(cropX + x / scale)));
      const sourceY = Math.min(image.height - 1, Math.max(0, Math.floor(cropY + y / scale)));
      const sourceIndex = (sourceY * image.width + sourceX) * 4;
      const targetIndex = (y * size + x) * 4;
      image.pixels.copy(pixels, targetIndex, sourceIndex, sourceIndex + 4);
    }
  }

  return { width: size, height: size, pixels };
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

function encodeIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;
    entry[1] = size >= 256 ? 0 : size;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map((image) => image.data)]);
}

function writeFile(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, data);
}

function writeAndroidIcons(outputs) {
  const androidRes = path.join('android', 'app', 'src', 'main', 'res');
  if (!fs.existsSync(androidRes)) return;

  for (const [directory, size] of androidSizes) {
    const data = outputs.get(size);
    writeFile(path.join(androidRes, directory, 'ic_launcher.png'), data);
    writeFile(path.join(androidRes, directory, 'ic_launcher_round.png'), data);
    writeFile(path.join(androidRes, directory, 'ic_launcher_foreground.png'), data);
  }

  const adaptiveIconXml = `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@color/ic_launcher_background"/>\n    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>\n`;
  writeFile(path.join(androidRes, 'mipmap-anydpi-v26', 'ic_launcher.xml'), adaptiveIconXml);
  writeFile(path.join(androidRes, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'), adaptiveIconXml);
  writeFile(path.join(androidRes, 'values', 'ic_launcher_background.xml'), '<resources>\n    <color name="ic_launcher_background">#0F172A</color>\n</resources>\n');
}

const source = decodePng(fs.readFileSync(sourcePath));
const outputs = new Map(webSizes.map((size) => [size, encodePng(resizeCover(source, size))]));
for (const [size, data] of outputs) writeFile(path.join('static', `icon-${size}.png`), data);
writeFile(path.join('static', 'apple-touch-icon.png'), outputs.get(180));
writeFile(path.join('static', 'favicon.ico'), encodeIco([16, 32, 48].map((size) => ({ size, data: outputs.get(size) }))));
writeFile(path.join('build-resources', 'icon.png'), outputs.get(512));
writeFile(path.join('build-resources', 'icon.ico'), encodeIco([16, 32, 48].map((size) => ({ size, data: outputs.get(size) }))));
writeFile(path.join('resources', 'icon.png'), outputs.get(512));
writeAndroidIcons(outputs);

console.log('Generated web, Electron, and Capacitor icons from static/favicon.png.');
