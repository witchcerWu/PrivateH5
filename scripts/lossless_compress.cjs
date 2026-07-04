#!/usr/bin/env node
/** Losslessly compress images under pages/ (format-aware). */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const PAGES_DIR = path.join(ROOT, 'pages');
const OPTIPNG = require('optipng-bin').default;
const JPEGTRAN = require('jpegtran-bin').default;

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif']);

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (IMAGE_EXT.has(path.extname(entry.name).toLowerCase())) files.push(full);
  }
  return files;
}

function detectFormat(file) {
  const buf = fs.readFileSync(file);
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50) return 'png';
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8) return 'jpeg';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return 'webp';
  }
  if (buf.length >= 12 && buf.toString('ascii', 4, 12) === 'ftypavif') return 'avif';
  return 'unknown';
}

function compressPng(file) {
  execFileSync(OPTIPNG, ['-o2', '-strip', 'all', '-clobber', '-quiet', file], { stdio: 'pipe' });
}

function compressJpeg(file) {
  const tmp = `${file}.tmp`;
  execFileSync(JPEGTRAN, ['-copy', 'none', '-optimize', '-progressive', '-outfile', tmp, file], {
    stdio: 'pipe',
  });
  fs.renameSync(tmp, file);
}

async function compressWebp(file) {
  const input = fs.readFileSync(file);
  const output = await sharp(input).webp({ lossless: true, effort: 6 }).toBuffer();
  if (output.length < input.length) fs.writeFileSync(file, output);
}

async function compressAvif(file) {
  const input = fs.readFileSync(file);
  const output = await sharp(input).avif({ lossless: true, effort: 6 }).toBuffer();
  if (output.length < input.length) fs.writeFileSync(file, output);
}

async function compressFile(file) {
  const format = detectFormat(file);
  switch (format) {
    case 'png':
      compressPng(file);
      break;
    case 'jpeg':
      compressJpeg(file);
      break;
    case 'webp':
      await compressWebp(file);
      break;
    case 'avif':
      await compressAvif(file);
      break;
    default:
      throw new Error(`unknown format`);
  }
}

async function main() {
  const files = walk(PAGES_DIR).sort();
  let before = 0;
  let after = 0;
  let saved = 0;
  let failed = 0;
  const results = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (i % 25 === 0) process.stdout.write(`\rCompressing ${i + 1}/${files.length}...`);

    const sizeBefore = fs.statSync(file).size;
    before += sizeBefore;

    try {
      await compressFile(file);
    } catch (err) {
      failed++;
      console.error(`\nFAIL ${path.relative(ROOT, file)}: ${err.message}`);
      after += sizeBefore;
      continue;
    }

    const sizeAfter = fs.statSync(file).size;
    after += sizeAfter;
    const delta = sizeBefore - sizeAfter;
    saved += delta;
    if (delta > 0) {
      results.push({ file: path.relative(ROOT, file), before: sizeBefore, after: sizeAfter, delta });
    }
  }

  process.stdout.write('\n');
  results.sort((a, b) => b.delta - a.delta);

  console.log(`\nProcessed ${files.length} images (${failed} failed)`);
  console.log(`Before: ${(before / 1024 / 1024).toFixed(2)} MB`);
  console.log(`After:  ${(after / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Saved:  ${(saved / 1024 / 1024).toFixed(2)} MB (${before ? ((saved / before) * 100).toFixed(1) : 0}%)`);
  console.log(`\nTop 10 savings:`);
  for (const r of results.slice(0, 10)) {
    console.log(`  -${(r.delta / 1024).toFixed(1)}KB  ${r.file}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
