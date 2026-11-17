import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const frontendSrcDir = path.resolve(rootDir, 'frontend/src');

console.log('--- Botanical Night Studio Residual Token & Palette Audit ---');
console.log(`Auditing directory: ${frontendSrcDir}`);

const targetDirs = ['components', 'game', 'stores'];
const domainExemptions = [
  'starterAvatars.tsx', // Domain character outfit pixel art
];

function scanFiles(dir, list = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanFiles(fullPath, list);
    } else if (/\.(tsx|ts|css)$/.test(entry.name) && !entry.name.includes('.test.')) {
      list.push(fullPath);
    }
  }
  return list;
}

const files = [];
for (const d of targetDirs) {
  const dirPath = path.join(frontendSrcDir, d);
  if (fs.existsSync(dirPath)) {
    scanFiles(dirPath, files);
  }
}

console.log(`Found ${files.length} production source files to audit.`);

// 1. Audit for legacy Tailwind class names: slate-* or sky-*
const legacyClassRegex = /\b(slate-\d+|sky-\d+)\b/g;
const classViolations = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf-8');
  const matches = content.match(legacyClassRegex);
  if (matches) {
    for (const m of matches) {
      classViolations.push({ file: path.relative(rootDir, file), match: m });
    }
  }
}

// 2. Audit for legacy hex strings in UI chrome
const legacyHexRegex = /#(0f172a|1e293b|334155|475569|64748b|94a3b8|cbd5e1|e2e8f0|f1f5f9|0284c7|0369a1|0ea5e9)\b/gi;
const hexViolations = [];

for (const file of files) {
  if (domainExemptions.some((ex) => file.endsWith(ex))) {
    continue;
  }
  const content = fs.readFileSync(file, 'utf-8');
  const matches = content.match(legacyHexRegex);
  if (matches) {
    for (const m of matches) {
      hexViolations.push({ file: path.relative(rootDir, file), hex: m });
    }
  }
}

// 3. Verify index.css tokens
const cssFile = path.resolve(frontendSrcDir, 'index.css');
const cssContent = fs.readFileSync(cssFile, 'utf-8');
const expectedTokens = [
  '--color-botanical-pine: #0F1714',
  '--color-botanical-leaf: #16221E',
  '--color-botanical-border: #243630',
  '--color-botanical-mist: #E6ECE8',
  '--color-botanical-sage: #8FA399',
  '--color-botanical-amber: #E5A93C',
  '--color-botanical-amber-ink: #0F1714',
  '--color-botanical-emerald: #34D399',
  '.botanical-bezel-outer',
  '.botanical-bezel-inner',
  '.botanical-glass',
  '.botanical-cta',
  'overflow-x: clip',
  'max-width: 100%',
];

const missingTokens = expectedTokens.filter((tok) => !cssContent.includes(tok));

console.log(`\nAudit Results:`);
console.log(`- Legacy Tailwind class violations (slate-*, sky-*): ${classViolations.length}`);
if (classViolations.length > 0) {
  console.error('Violations:', classViolations);
}

console.log(`- Legacy hex string violations: ${hexViolations.length}`);
if (hexViolations.length > 0) {
  console.error('Violations:', hexViolations);
}

console.log(`- Missing core Botanical tokens in index.css: ${missingTokens.length}`);
if (missingTokens.length > 0) {
  console.error('Missing tokens:', missingTokens);
}

if (classViolations.length === 0 && hexViolations.length === 0 && missingTokens.length === 0) {
  console.log('\n Residual Audit PASSED: Zero legacy classes or hexes found in UI chrome!');
  process.exit(0);
} else {
  console.error('\n❌ Residual Audit FAILED: Unresolved violations found.');
  process.exit(1);
}
