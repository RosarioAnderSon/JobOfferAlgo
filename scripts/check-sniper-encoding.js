const fs = require('fs');
const path = require('path');

const root = process.cwd();
const extDir = path.join(root, 'sniper-extension');
const baseline = require('child_process').execSync(
  'git show HEAD:sniper-extension/content-script.js',
  { encoding: 'utf8' }
);

const files = fs
  .readdirSync(extDir)
  .filter((f) => f.startsWith('content-script') && f.endsWith('.js'))
  .sort();

// Tokens that typically indicate a second mojibake pass.
const suspiciousTokens = ['Ãƒ', 'Ã‚', 'Â', 'Å'];

// Keep only tokens that do not appear in baseline at all to avoid false positives.
const blockedTokens = suspiciousTokens.filter((token) => !baseline.includes(token));

const violations = [];
for (const file of files) {
  const full = path.join(extDir, file);
  const text = fs.readFileSync(full, 'utf8');
  for (const token of blockedTokens) {
    if (text.includes(token)) {
      violations.push({ file, token });
    }
  }
}

if (violations.length) {
  console.error('Encoding check failed (suspicious mojibake tokens found):');
  for (const v of violations) {
    console.error('- ' + v.file + ': token "' + v.token + '"');
  }
  process.exit(1);
}

console.log('Encoding check passed.');
