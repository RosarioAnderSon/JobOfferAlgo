const fs = require('fs');
const path = require('path');

const root = process.cwd();
const extDir = path.join(root, 'sniper-extension');
const suspiciousTokens = ['Ã', 'Â', 'â', 'ðŸ'];
const allowedExt = new Set(['.js', '.css', '.html', '.md', '.json']);

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (allowedExt.has(ext)) out.push(full);
  }
  return out;
}
const files = walk(extDir);
const violations = [];
for (const full of files) {
  const rel = path.relative(root, full).replace(/\\/g, '/');
  const text = fs.readFileSync(full, 'utf8');
  for (const token of suspiciousTokens) {
    const currentCount = text.split(token).length - 1;
    if (currentCount > 0) {
      violations.push({ file: path.relative(root, full), token });
    }
  }

  // Detecta reemplazos rotos comunes en UI ES, por ejemplo: "m?nimo".
  const suspiciousQuestionMarks = [];
  const regex = /[A-Za-zÁÉÍÓÚáéíóúÑñÜü]+\?[A-Za-zÁÉÍÓÚáéíóúÑñÜü]+/g;
  let match = regex.exec(text);
  while (match) {
    suspiciousQuestionMarks.push(match[0]);
    match = regex.exec(text);
  }
  suspiciousQuestionMarks.forEach((token) => {
    violations.push({ file: path.relative(root, full), token: `?word:${token}` });
  });
}

if (violations.length) {
  console.error('Encoding check failed (suspicious mojibake tokens found):');
  for (const v of violations) {
    console.error(`- ${v.file}: token "${v.token}"`);
  }
  process.exit(1);
}

console.log('Encoding check passed.');
