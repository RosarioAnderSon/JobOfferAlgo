const fs = require('fs');
const path = require('path');

const root = process.cwd();
const maxLines = 300;
const sourceExts = new Set(['.js', '.css', '.ts']);
const roots = ['sniper-extension', 'src'];

const walk = (dir) => {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (sourceExts.has(ext)) out.push(full);
  }
  return out;
};

const files = roots.flatMap((name) => walk(path.join(root, name))).sort();

const violations = [];

for (const full of files) {
  const lines = fs.readFileSync(full, 'utf8').replace(/\r\n/g, '\n').split('\n').length;
  const name = path.relative(root, full).replace(/\\/g, '/');
  if (lines > maxLines) violations.push({ name, lines });
}

if (violations.length) {
  console.warn(`Line-count warning: files over ${maxLines} lines:`);
  for (const v of violations) console.warn(`- ${v.name}: ${v.lines}`);
  process.exit(0);
}

console.log(`Line-count gate passed (${files.length} files, max ${maxLines} lines each).`);
