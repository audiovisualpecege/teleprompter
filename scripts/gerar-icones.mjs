// Gera todos os tamanhos do ícone do produto a partir de build/icone.svg
// (e de build/icone-16.svg para 16 e 32 px): PNG de 16 a 1024, o .ico do
// Windows (16 a 256) e o .icns do Mac. Uso: npm run icons
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = join(root, 'build');
const outDir = join(buildDir, 'icons');

export const PNG_SIZES = [16, 32, 48, 64, 128, 256, 512, 1024];
export const ICO_SIZES = [16, 32, 48, 64, 128, 256];
// Tipos do .icns, todos com PNG dentro.
export const ICNS_TYPES = [
  ['icp4', 16],
  ['icp5', 32],
  ['icp6', 64],
  ['ic07', 128],
  ['ic08', 256],
  ['ic09', 512],
  ['ic10', 1024],
  ['ic11', 32],
  ['ic12', 64],
  ['ic13', 256],
  ['ic14', 512],
];

const SMALL_MAX = 32;

function render(svg, size) {
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: size }, background: 'rgba(0,0,0,0)' });
  return resvg.render().asPng();
}

/** .ico com PNG dentro de cada entrada (aceito desde o Windows Vista). */
export function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + 16 * images.length;
  for (const { size, png } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

export function buildIcns(chunks) {
  const parts = chunks.map(({ type, png }) => {
    const h = Buffer.alloc(8);
    h.write(type, 0, 'ascii');
    h.writeUInt32BE(png.length + 8, 4);
    return Buffer.concat([h, png]);
  });
  const body = Buffer.concat(parts);
  const h = Buffer.alloc(8);
  h.write('icns', 0, 'ascii');
  h.writeUInt32BE(body.length + 8, 4);
  return Buffer.concat([h, body]);
}

export function generate() {
  const full = readFileSync(join(buildDir, 'icone.svg'));
  const small = readFileSync(join(buildDir, 'icone-16.svg'));
  const cache = new Map();
  const png = (size) => {
    if (!cache.has(size)) cache.set(size, render(size <= SMALL_MAX ? small : full, size));
    return cache.get(size);
  };
  mkdirSync(outDir, { recursive: true });
  for (const size of PNG_SIZES) writeFileSync(join(outDir, `${size}x${size}.png`), png(size));
  writeFileSync(join(outDir, 'icone.ico'), buildIco(ICO_SIZES.map((size) => ({ size, png: png(size) }))));
  writeFileSync(join(outDir, 'icone.icns'), buildIcns(ICNS_TYPES.map(([type, size]) => ({ type, png: png(size) }))));
  return outDir;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dir = generate();
  console.log(`Ícones gerados em ${dir}`);
}
