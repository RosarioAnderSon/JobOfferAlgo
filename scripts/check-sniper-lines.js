const fs = require('fs');
const path = require('path');

const root = process.cwd();
const dir = path.join(root, 'sniper-extension');
const maxLines = 300;
const sourceExts = new Set(['.js', '.css']);

const files = fs
  .readdirSync(dir, { withFileTypes: true })
  .filter((d) => d.isFile())
  .map((d) => d.name)
  .filter((name) => sourceExts.has(path.extname(name).toLowerCase()))
  .sort();

const violations = [];

for (const name of files) {
  const full = path.join(dir, name);
  const lines = fs.readFileSync(full, 'utf8').replace(/\r\n/g, '\n').split('\n').length;
  if (lines > maxLines) violations.push({ name, lines });
}

if (violations.length) {
  console.warn(`Line-count warning: files over ${maxLines} lines:`);
  for (const v of violations) console.warn(`- ${v.name}: ${v.lines}`);
  process.exit(0);
}

console.log(`Line-count gate passed (${files.length} files, max ${maxLines} lines each).`);
