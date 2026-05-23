const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const root = process.cwd();
const extDir = path.join(root, 'sniper-extension');

const read = (name) => fs.readFileSync(path.join(extDir, name), 'utf8');
const parse = (code, file) => {
  try {
    return acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'script' });
  } catch (error) {
    error.message = `${file}: ${error.message}`;
    throw error;
  }
};

const walk = (node, fn) => {
  fn(node);
  for (const k in node) {
    const v = node[k];
    if (!v || typeof v !== 'object') continue;
    if (Array.isArray(v)) v.forEach((x) => x && typeof x === 'object' && walk(x, fn));
    else walk(v, fn);
  }
};

const collectMethods = (files) => {
  const methods = new Map();
  for (const file of files) {
    const code = read(file);
    const ast = parse(code, file);
    walk(ast, (n) => {
      if (
        n.type === 'AssignmentExpression' &&
        n.operator === '=' &&
        n.left?.type === 'MemberExpression'
      ) {
        const left = n.left;
        if (
          left.object?.type === 'MemberExpression' &&
          left.object.object?.name === 'UpworkSniperExtension' &&
          left.object.property?.name === 'prototype' &&
          left.property?.type === 'Identifier' &&
          (n.right.type === 'FunctionExpression' || n.right.type === 'ArrowFunctionExpression')
        ) {
          methods.set(left.property.name, file);
        }
      }
      if (n.type === 'ClassDeclaration' && n.id?.name === 'UpworkSniperExtension') {
        for (const el of n.body.body) {
          if (el.type === 'MethodDefinition' && el.key?.type === 'Identifier') {
            methods.set(el.key.name, file);
          }
        }
      }
    });
  }
  return methods;
};

const manifest = JSON.parse(read('manifest.json'));
const contentScripts = Array.isArray(manifest.content_scripts) ? manifest.content_scripts : [];
const jsFiles = contentScripts.flatMap((entry) => (Array.isArray(entry.js) ? entry.js : []));
const failures = [];

const requireFile = (file) => {
  if (!jsFiles.includes(file)) failures.push(`Manifest missing JS module: ${file}`);
};
const requireOrder = (before, after) => {
  const beforeIndex = jsFiles.indexOf(before);
  const afterIndex = jsFiles.indexOf(after);
  if (beforeIndex === -1 || afterIndex === -1) return;
  if (beforeIndex >= afterIndex) failures.push(`Manifest JS order invalid: ${before} must load before ${after}`);
};

[
  'sniper-core-shared.js',
  'sniper-core-preflight.js',
  'sniper-core-evaluate.js',
  'sniper-core.js',
  'extractors.js',
  'content-script-base.js',
  'content-script-methods-flow-overlay.js',
  'content-script-methods-flow-route.js',
  'content-script-methods-flow-extract.js',
  'content-script-methods-flow-render.js',
  'content-script-badge-definitions.js',
  'content-script-methods-ui-badges.js',
  'content-script-methods-ui-score.js',
  'content-script.js',
].forEach(requireFile);

if (new Set(jsFiles).size !== jsFiles.length) failures.push('Manifest contains duplicate JS modules');
if (jsFiles[jsFiles.length - 1] !== 'content-script.js') {
  failures.push('content-script.js must remain the final launcher module');
}

requireOrder('sniper-core-shared.js', 'sniper-core-evaluate.js');
requireOrder('sniper-core-preflight.js', 'sniper-core-evaluate.js');
requireOrder('sniper-core-evaluate.js', 'sniper-core.js');
requireOrder('extractors.js', 'content-script-methods-flow-route.js');
requireOrder('extractors.js', 'content-script-methods-flow-extract.js');
requireOrder('content-script-base.js', 'content-script-methods-flow-route.js');
requireOrder('content-script-base.js', 'content-script-methods-flow-extract.js');
requireOrder('content-script-base.js', 'content-script-methods-flow-render.js');
requireOrder('content-script-base.js', 'content-script-methods-ui-score.js');
requireOrder('content-script-badge-definitions.js', 'content-script-methods-ui-badges.js');
requireOrder('content-script-methods-flow-overlay.js', 'content-script-methods-flow-route.js');
requireOrder('content-script-methods-flow-route.js', 'content-script-methods-flow-extract.js');
requireOrder('content-script-methods-flow-extract.js', 'content-script-methods-flow-render.js');
requireOrder('content-script-methods-flow-route.js', 'content-script.js');
requireOrder('content-script-methods-flow-extract.js', 'content-script.js');
requireOrder('content-script-methods-flow-render.js', 'content-script.js');

for (const file of jsFiles) {
  parse(read(file), file);
}

const methods = collectMethods(jsFiles.filter((file) => file.startsWith('content-script')));
const requiredMethods = [
  'waitForJobContent',
  'processJobDetail',
  'extractJobData',
  'evaluateAndRender',
  'renderUI',
  'findJobCardById',
  'createScoreBadge',
  'createScoreTooltip',
  'buildComponentBreakdown',
  'createBadge',
  'getBadgeConfig',
  'createSettingsButton',
  'injectOverlay',
  'applyCachedOverlaysToFeed',
  'getFeedJobLinks',
  'getCardJobId',
  'findOverlayForJob',
  'removeOverlaysForJob',
  'removeOrphanOverlays',
  'cleanupOverlays',
  'refreshOverlaysFromCache',
  'computeSupportAvgBadge',
  'computeSkillsMatch',
  'captureFreelancerProfileSkills',
  'renderGlobalMissingSkillsSidebar',
];

for (const method of requiredMethods) {
  if (!methods.has(method)) failures.push(`Missing UpworkSniperExtension method: ${method}`);
}

if (!read('content-script-methods-flow-overlay.js').includes('window.__sniperOverlayLoaded = true')) {
  failures.push('Overlay runtime loaded marker missing');
}
if (!read('content-script.js').includes('new UpworkSniperExtension()')) {
  failures.push('Launcher does not instantiate UpworkSniperExtension');
}

if (failures.length) {
  console.error('UI parity check failed:');
  for (const failure of failures) console.error('- ' + failure);
  process.exit(1);
}

console.log(`UI parity check passed (${requiredMethods.length} methods, ${jsFiles.length} manifest modules).`);
