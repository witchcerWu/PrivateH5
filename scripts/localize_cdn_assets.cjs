#!/usr/bin/env node
/** Download CDN images/videos referenced in HTML and replace with local paths. */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const CDN_PATTERN =
  /https:\/\/(?:ae-pic-a1\.aliexpress-media\.com|img\.alicdn\.com|video\.aliexpress-media\.com)[^\s"'<>]+/g;

function walkHtmlFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkHtmlFiles(full));
    else if (entry.name === 'index.html') results.push(full);
  }
  return results;
}

function urlToFilename(url) {
  const pathPart = url.split('?')[0];
  let name = pathPart.split('/').pop();
  if (!name || name.length > 180) {
    const digest = crypto.createHash('md5').update(url).digest('hex').slice(0, 12);
    let ext = '.png';
    if (/\.jpe?g/i.test(pathPart)) ext = '.jpg';
    else if (/\.webp/i.test(pathPart)) ext = '.webp';
    else if (/\.mp4/i.test(pathPart)) ext = '.mp4';
    name = `cdn-${digest}${ext}`;
  }
  return name;
}

function download(url, dest) {
  return new Promise((resolve) => {
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      resolve(true);
      return;
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const file = fs.createWriteStream(dest);
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        download(res.headers.location, dest).then(resolve);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        console.log(`  FAIL HTTP ${res.statusCode}: ${url}`);
        resolve(false);
        return;
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        const size = fs.statSync(dest).size;
        if (size < 50) console.log(`  WARN tiny file (${size}B): ${url}`);
        resolve(true);
      });
    });
    req.on('error', (err) => {
      file.close();
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      console.log(`  FAIL ${err.message}: ${url}`);
      resolve(false);
    });
    req.setTimeout(60000, () => {
      req.destroy();
      file.close();
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      console.log(`  FAIL timeout: ${url}`);
      resolve(false);
    });
  });
}

async function processHtml(htmlPath) {
  const imagesDir = path.join(path.dirname(htmlPath), 'images');
  let content = fs.readFileSync(htmlPath, 'utf8');
  const urls = [...new Set(content.match(CDN_PATTERN) || [])];
  if (!urls.length) return 0;

  const replacements = {};
  const usedNames = {};

  for (const url of urls) {
    let filename = urlToFilename(url);
    if (usedNames[filename] != null) {
      usedNames[filename]++;
      const dot = filename.lastIndexOf('.');
      filename =
        dot > 0
          ? `${filename.slice(0, dot)}-${usedNames[filename]}${filename.slice(dot)}`
          : `${filename}-${usedNames[filename]}`;
    } else {
      usedNames[filename] = 0;
    }

    const dest = path.join(imagesDir, filename);
    console.log(`  ${filename} <- ${url.slice(0, 80)}...`);
    const ok = await download(url, dest);
    if (ok) replacements[url] = `images/${filename}`;
  }

  let newContent = content;
  for (const [url, local] of Object.entries(replacements)) {
    newContent = newContent.split(url).join(local);
  }

  if (newContent !== content) {
    fs.writeFileSync(htmlPath, newContent, 'utf8');
  }

  return Object.keys(replacements).length;
}

async function main() {
  const htmlFiles = walkHtmlFiles(path.join(ROOT, 'pages')).sort();
  let total = 0;
  for (const htmlPath of htmlFiles) {
    const rel = path.relative(ROOT, htmlPath);
    console.log(`\n=== ${rel} ===`);
    const count = await processHtml(htmlPath);
    console.log(`  -> ${count} assets localized`);
    total += count;
  }
  console.log(`\nDone. Total: ${total} assets across ${htmlFiles.length} pages.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
