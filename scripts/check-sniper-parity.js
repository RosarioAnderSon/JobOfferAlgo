const fs = require('fs');
const path = require('path');

const root = process.cwd();
const extDir = path.join(root, 'sniper-extension');

const read = (name) => fs.readFileSync(path.join(extDir, name), 'utf8');
const has = (text, token) => text.includes(token);
const manifest = JSON.parse(read('manifest.json'));

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
    token: "'Niche Avg/hr'",
    message: 'Niche Avg/hr badge config missing',
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

if (manifest.host_permissions) {
  failures.push('Manifest should not declare host_permissions for this content-script-only build');
}
if (manifest.background) {
  failures.push('Manifest should not declare a background/service worker');
}
const forbiddenPermissions = ['tabs', 'scripting', 'webRequest', 'declarativeNetRequest', 'activeTab'];
const declaredPermissions = Array.isArray(manifest.permissions) ? manifest.permissions : [];
for (const permission of forbiddenPermissions) {
  if (declaredPermissions.includes(permission)) {
    failures.push(`Forbidden manifest permission declared: ${permission}`);
  }
}

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
