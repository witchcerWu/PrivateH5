#!/usr/bin/env node
/** Convert pages images to WebP and update HTML references. */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const PAGES_DIR = path.join(ROOT, 'pages');
const QUALITY = 88;
const MAX_WIDTH = 1920;
const MIN_BYTES = 500;
const SOURCE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif']);

function walk(dir, extSet) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full, extSet));
    else if (extSet.has(path.extname(entry.name).toLowerCase())) files.push(full);
  }
  return files;
}

function walkHtml(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkHtml(full));
    else if (entry.name.endsWith('.html')) files.push(full);
  }
  return files;
}

async function convertOne(file) {
  const stat = fs.statSync(file);
  if (stat.size < MIN_BYTES) return { file, action: 'skip-small', saved: 0 };

  const out = file.replace(/\.(png|jpe?g|webp|avif)$/i, '.webp');
  if (out === file) return { file, action: 'skip', saved: 0 };

  const meta = await sharp(file).metadata();
  let pipeline = sharp(file);
  if ((meta.width || 0) > MAX_WIDTH) {
    pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
  }

  await pipeline.webp({ quality: QUALITY, effort: 4, alphaQuality: 90 }).toFile(out);

  const outSize = fs.statSync(out).size;
  const saved = stat.size - outSize;
  if (outSize < stat.size) {
    fs.unlinkSync(file);
    return { file, out, action: 'converted', saved, before: stat.size, after: outSize };
  }
  fs.unlinkSync(out);
  return { file, action: 'keep-original', saved: 0 };
}

function updateHtml(htmlPath, relDir) {
  let content = fs.readFileSync(htmlPath, 'utf8');
  let count = 0;
  const newContent = content.replace(
    /((?:src|poster)=["'])images\/([^"']+)\.(png|jpe?g|webp|avif)(["'])/gi,
    function (match, prefix, name, _ext, suffix) {
      const webpPath = path.join(PAGES_DIR, relDir, 'images', `${name}.webp`);
      if (!fs.existsSync(webpPath)) return match;
      count++;
      return `${prefix}images/${name}.webp${suffix}`;
    }
  );
  if (newContent !== content) fs.writeFileSync(htmlPath, newContent, 'utf8');
  return count;
}

async function main() {
  const images = walk(PAGES_DIR, SOURCE_EXT).filter((f) => !f.endsWith('.webp'));
  let converted = 0;
  let saved = 0;
  let skipped = 0;

  console.log(`Converting ${images.length} images to WebP (q=${QUALITY}, maxW=${MAX_WIDTH})...\n`);

  for (let i = 0; i < images.length; i++) {
    if (i % 20 === 0) process.stdout.write(`\r${i + 1}/${images.length}...`);
    try {
      const result = await convertOne(images[i]);
      if (result.action === 'converted') {
        converted++;
        saved += result.saved;
      } else if (result.action === 'skip-small') {
        skipped++;
      }
    } catch (err) {
      console.error(`\nFAIL ${path.relative(ROOT, images[i])}: ${err.message}`);
    }
  }
  process.stdout.write('\n');

  let htmlUpdates = 0;
  for (const html of walkHtml(PAGES_DIR)) {
    const relDir = path.relative(PAGES_DIR, path.dirname(html));
    htmlUpdates += updateHtml(html, relDir);
  }

  console.log(`Converted: ${converted}, skipped tiny: ${skipped}`);
  console.log(`Saved: ${(saved / 1024 / 1024).toFixed(2)} MB`);
  console.log(`HTML references updated: ${htmlUpdates}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
