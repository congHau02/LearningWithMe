import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkFileLimits, formatReport } from './check-file-limits.mjs';

function makeLines(count, body = 'const x = 1;') {
  return `${Array.from({ length: count }, () => body).join('\n')}\n`;
}

function writeFixture(rootDir, relPath, content) {
  const fullPath = path.join(rootDir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
}

function createTempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'file-limits-test-'));
}

test('passes when all source files are within AGENTS.md line limits and ignores test files', () => {
  const rootDir = createTempRepo();
  try {
    writeFixture(rootDir, 'frontend/src/App.tsx', makeLines(200));
    writeFixture(rootDir, 'frontend/src/stores/useAppStore.ts', makeLines(150));
    writeFixture(rootDir, 'frontend/src/game/scenes/ClassroomScene.ts', makeLines(250));
    writeFixture(rootDir, 'frontend/src/services/roomApi.ts', makeLines(250));
    writeFixture(rootDir, 'frontend/src/__tests__/giant.test.tsx', makeLines(500));

    writeFixture(rootDir, 'backend/src/main/java/com/app/RoomController.java', makeLines(150, '// ok'));
    writeFixture(rootDir, 'backend/src/main/java/com/app/GlobalHandler.java', makeLines(150, '// ok'));
    writeFixture(
      rootDir,
      'backend/src/main/java/com/app/RoomService.java',
      `public class RoomService {\n    private record Nested(String id) {}\n${makeLines(248, '// ok')}`,
    );
    writeFixture(
      rootDir,
      'backend/src/main/java/com/app/model/PlayerEvent.java',
      `public record PlayerEvent(String id) {}\n${makeLines(119, '// ok')}`,
    );
    writeFixture(
      rootDir,
      'backend/src/main/java/com/app/UserRecord.java',
      `@Entity\npublic class UserRecord {}\n${makeLines(118, '// ok')}`,
    );
    writeFixture(rootDir, 'backend/src/test/java/com/app/BigIntegrationTest.java', makeLines(600, '// ok'));

    const result = checkFileLimits(rootDir);
    assert.equal(result.violations.length, 0);
    assert.equal(result.checkedCount, 9);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('reports every offender with its line count and limit across all categories', () => {
  const rootDir = createTempRepo();
  try {
    writeFixture(rootDir, 'frontend/src/components/Big.tsx', makeLines(201));
    writeFixture(rootDir, 'frontend/src/stores/useBigStore.ts', makeLines(151));
    writeFixture(rootDir, 'frontend/src/game/entities/BigSprite.ts', makeLines(251));
    writeFixture(rootDir, 'frontend/src/services/bigClient.ts', makeLines(251));

    writeFixture(rootDir, 'backend/src/main/java/com/app/BigController.java', makeLines(151, '// x'));
    writeFixture(rootDir, 'backend/src/main/java/com/app/BigHandler.java', makeLines(152, '// x'));
    writeFixture(rootDir, 'backend/src/main/java/com/app/BigService.java', makeLines(251, '// x'));
    writeFixture(
      rootDir,
      'backend/src/main/java/com/app/BigDto.java',
      `public record BigDto(String id) {}\n${makeLines(120, '// x')}`,
    );

    const result = checkFileLimits(rootDir);
    assert.equal(result.violations.length, 8);

    const report = formatReport(result);
    assert.match(report, /frontend\/src\/components\/Big\.tsx.*201.*200/);
    assert.match(report, /frontend\/src\/stores\/useBigStore\.ts.*151.*150/);
    assert.match(report, /frontend\/src\/game\/entities\/BigSprite\.ts.*251.*250/);
    assert.match(report, /frontend\/src\/services\/bigClient\.ts.*251.*250/);
    assert.match(report, /BigController\.java.*151.*150/);
    assert.match(report, /BigHandler\.java.*152.*150/);
    assert.match(report, /BigService\.java.*251.*250/);
    assert.match(report, /BigDto\.java.*121.*120/);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});
