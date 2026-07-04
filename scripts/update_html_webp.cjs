const fs = require('fs');
const path = require('path');

function walk(d) {
  let r = [];
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) r.push(...walk(f));
    else if (e.name.endsWith('.html')) r.push(f);
  }
  return r;
}

let updated = 0;
for (const html of walk(path.join(__dirname, '../pages'))) {
  const dir = path.dirname(html);
  let content = fs.readFileSync(html, 'utf8');
  const next = content.replace(
    /((?:src|poster)=["'])images\/([^"']+)\.(png|jpe?g|webp|avif)(["'])/gi,
    (m, p1, name, _ext, p4) => {
      const webp = path.join(dir, 'images', `${name}.webp`);
      if (!fs.existsSync(webp)) return m;
      updated++;
      return `${p1}images/${name}.webp${p4}`;
    }
  );
  if (next !== content) fs.writeFileSync(html, next, 'utf8');
}
console.log('Updated references:', updated);
