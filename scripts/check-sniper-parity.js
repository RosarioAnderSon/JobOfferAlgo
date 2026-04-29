const fs = require('fs');
const path = require('path');

const root = process.cwd();
const extDir = path.join(root, 'sniper-extension');

const read = (name) => fs.readFileSync(path.join(extDir, name), 'utf8');
const has = (text, token) => text.includes(token);

const checks = [
  {
    file: 'sniper-core.js',
    token: 'root.evaluateSniper = evaluateSniper',
    message: 'Global evaluateSniper exposure missing',
  },
  {
    file: 'extractors.js',
    token: 'window.SniperExtractors = SniperExtractors',
    message: 'SniperExtractors global missing',
  },
  {
    file: 'extractors.js',
    token: 'extractPossibleClientNames',
    message: 'extractPossibleClientNames missing in SniperExtractors',
  },
  {
    file: 'content-script-methods-ui-badges.js',
    token: "'Support Avg/hr'",
    message: 'Support Avg/hr badge config missing',
  },
  {
    file: 'content-script-methods-ui-badges.js',
    token: "'Skills match'",
    message: 'Skills match badge config missing',
  },
  {
    file: 'content-script-methods-ui-badges.js',
    token: 'const enDescriptions = {',
    message: 'English description map missing in getBadgeConfig',
  },
];

const failures = [];

for (const c of checks) {
  const text = read(c.file);
  if (!has(text, c.token)) failures.push(`${c.message} (${c.file})`);
}

if (failures.length) {
  console.error('Parity check failed:');
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}

console.log('Parity check passed.');
