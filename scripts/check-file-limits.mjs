import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Thresholds from AGENTS.md Section 1 and P7-T2 (#34)
const FRONTEND_NON_APP_EXCLUDES = new Set(['frontend/src/testSetup.ts', 'frontend/src/vite-env.d.ts']);

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

function countLines(content) {
  const normalized = content.replace(/\r?\n$/, '');
  return normalized === '' ? 0 : normalized.split(/\r?\n/).length;
}

function classifyFrontend(relPath) {
  if (relPath.startsWith('frontend/src/__tests__/') || FRONTEND_NON_APP_EXCLUDES.has(relPath)) {
    return null;
  }
  if (relPath.endsWith('.tsx')) {
    return { category: 'React Component (.tsx)', limit: 200 };
  }
  if (!relPath.endsWith('.ts')) return null;
  if (relPath.startsWith('frontend/src/stores/')) {
    return { category: 'Zustand Store', limit: 150 };
  }
  if (relPath.startsWith('frontend/src/game/')) {
    return { category: 'Phaser Scene/Entity', limit: 250 };
  }
  return { category: 'TS Service/Hook/Util', limit: 250 };
}

function classifyJava(relPath, content) {
  if (!relPath.endsWith('.java')) return null;
  const fileName = path.posix.basename(relPath);
  if (
    fileName.endsWith('Controller.java') ||
    fileName.endsWith('Handler.java') ||
    /@(Rest)?Controller\b/.test(content)
  ) {
    return { category: 'Java Controller/Handler', limit: 150 };
  }
  const isDtoOrEntity =
    relPath.includes('/model/') ||
    /(Dto|Entity|Request|Response|Payload|Event|Message|Summary|Metadata|Snapshot)\.java$/.test(fileName) ||
    /^(?:public\s+|final\s+)*record\s+/m.test(content) ||
    /^@Entity\b/m.test(content);
  if (isDtoOrEntity) {
    return { category: 'Java DTO/Record/Entity', limit: 120 };
  }
  return { category: 'Java Service/Class', limit: 250 };
}

export function checkFileLimits(rootDir = process.cwd()) {
  const targets = [
    { dir: path.join(rootDir, 'frontend/src'), classify: classifyFrontend },
    { dir: path.join(rootDir, 'backend/src/main/java'), classify: classifyJava },
  ];

  let checkedCount = 0;
  const violations = [];

  for (const { dir, classify } of targets) {
    for (const fullPath of walkFiles(dir)) {
      const relPath = toPosix(path.relative(rootDir, fullPath));
      const content = fs.readFileSync(fullPath, 'utf8');
      const rule = classify(relPath, content);
      if (!rule) continue;

      checkedCount += 1;
      const lines = countLines(content);
      if (lines > rule.limit) {
        violations.push({ path: relPath, lines, limit: rule.limit, category: rule.category });
      }
    }
  }

  violations.sort((a, b) => b.lines - a.lines || a.path.localeCompare(b.path));
  return { checkedCount, violations };
}

export function formatReport({ checkedCount, violations }) {
  if (violations.length === 0) {
    return `OK: Checked ${checkedCount} files — all within AGENTS.md line limits.`;
  }
  const lines = violations.map(
    (v) => `FAIL  ${v.path}: ${v.lines} lines (limit: ${v.limit}, ${v.category})`,
  );
  lines.push(`\nFound ${violations.length} file-limit violation(s) across ${checkedCount} checked files.`);
  return lines.join('\n');
}

const isMain =
  process.argv[1] &&
  fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));

if (isMain) {
  const result = checkFileLimits(process.cwd());
  console.log(formatReport(result));
  if (result.violations.length > 0) {
    process.exitCode = 1;
  }
}
