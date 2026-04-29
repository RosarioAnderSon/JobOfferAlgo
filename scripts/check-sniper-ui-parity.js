const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const root = process.cwd();
const extDir = path.join(root, 'sniper-extension');

const parse = (code) => acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'script' });

const walk = (node, fn) => {
  fn(node);
  for (const k in node) {
    const v = node[k];
    if (!v || typeof v !== 'object') continue;
    if (Array.isArray(v)) v.forEach((x) => x && typeof x === 'object' && walk(x, fn));
    else walk(v, fn);
  }
};

const stripMeta = (node) => {
  if (node == null || typeof node !== 'object') return node;
  if (Array.isArray(node)) return node.map(stripMeta);
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === 'start' || k === 'end' || k === 'loc' || k === 'range') continue;
    out[k] = stripMeta(v);
  }
  return out;
};

const classMethods = (code) => {
  const map = new Map();
  const ast = parse(code);
  walk(ast, (n) => {
    if (n.type === 'ClassDeclaration' && n.id && n.id.name === 'UpworkSniperExtension') {
      for (const el of n.body.body) {
        if (el.type === 'MethodDefinition' && el.key && el.key.type === 'Identifier') {
          map.set(el.key.name, el.value);
        }
      }
    }
  });
  return map;
};

const protoMethods = (codes) => {
  const map = new Map();
  for (const code of codes) {
    const ast = parse(code);
    walk(ast, (n) => {
      if (
        n.type === 'AssignmentExpression' &&
        n.operator === '=' &&
        n.left &&
        n.left.type === 'MemberExpression'
      ) {
        const l = n.left;
        if (
          l.object &&
          l.object.type === 'MemberExpression' &&
          l.object.object &&
          l.object.object.type === 'Identifier' &&
          l.object.object.name === 'UpworkSniperExtension' &&
          l.object.property &&
          l.object.property.type === 'Identifier' &&
          l.object.property.name === 'prototype' &&
          l.property &&
          l.property.type === 'Identifier' &&
          (n.right.type === 'FunctionExpression' || n.right.type === 'ArrowFunctionExpression')
        ) {
          map.set(l.property.name, n.right);
        }
      }
      if (n.type === 'ClassDeclaration' && n.id && n.id.name === 'UpworkSniperExtension') {
        for (const el of n.body.body) {
          if (el.type === 'MethodDefinition' && el.key && el.key.type === 'Identifier') {
            map.set(el.key.name, el.value);
          }
        }
      }
    });
  }
  return map;
};

const baseline = execSync('git show HEAD:sniper-extension/content-script.js', { encoding: 'utf8' });
const baselineMethods = classMethods(baseline);

const moduleFiles = fs
  .readdirSync(extDir)
  .filter((f) => f.startsWith('content-script') && f.endsWith('.js'))
  .sort();

const moduleCodes = moduleFiles.map((f) => fs.readFileSync(path.join(extDir, f), 'utf8'));
const currentMethods = protoMethods(moduleCodes);

const methodsToCompare = [
  'waitForJobContent',
  'processJobDetail',
  'extractJobData',
  'evaluateAndRender',
  'renderUI',
  'createScoreBadge',
  'createScoreTooltip',
  'buildComponentBreakdown',
  'createBadge',
  'getBadgeConfig',
  'createSettingsButton',
  'createMissingSkillsPanel',
  'injectOverlay',
];

const mismatches = [];
for (const name of methodsToCompare) {
  const a = baselineMethods.get(name);
  const b = currentMethods.get(name);
  if (!a || !b) {
    mismatches.push({ name, reason: 'missing method in baseline or current modules' });
    continue;
  }
  const sa = JSON.stringify(stripMeta(a));
  const sb = JSON.stringify(stripMeta(b));
  if (sa !== sb) {
    mismatches.push({ name, reason: 'AST differs from baseline' });
  }
}

if (mismatches.length) {
  console.error('UI parity check failed:');
  for (const m of mismatches) {
    console.error('- ' + m.name + ': ' + m.reason);
  }
  process.exit(1);
}

console.log('UI parity check passed.');
