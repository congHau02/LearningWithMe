import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function resolveBashExecutable() {
  const gitBash = 'C:\\Program Files\\Git\\bin\\bash.exe';
  if (process.platform === 'win32' && fs.existsSync(gitBash)) {
    return gitBash;
  }
  return 'bash';
}

test('k6 STOMP helpers build and parse STOMP 1.2 frames and walkable steps', async () => {
  const helpers = await import('./k6-stomp-helpers.js');

  const connectFrame = helpers.buildStompFrame('CONNECT', {
    'accept-version': '1.2',
    Authorization: 'Bearer test-jwt-token',
  });
  assert.equal(
    connectFrame,
    'CONNECT\naccept-version:1.2\nAuthorization:Bearer test-jwt-token\n\n\0',
  );

  const movePayload = JSON.stringify({ x: 13, y: 13, facingDir: 'RIGHT', isMoving: true });
  const sendFrame = helpers.buildStompFrame(
    'SEND',
    { destination: '/app/room/main-library/move', 'content-type': 'application/json' },
    movePayload,
  );
  assert.ok(sendFrame.startsWith('SEND\ndestination:/app/room/main-library/move\n'));
  assert.ok(sendFrame.endsWith(`\n\n${movePayload}\0`));

  const rawServerChunk =
    'CONNECTED\nversion:1.2\n\n\0\n' +
    'MESSAGE\ndestination:/topic/room/main-library/events\nsubscription:sub-room\n\n' +
    '{"seq":1,"type":"PLAYER_MOVED","roomId":"main-library","userId":"u-1","timestampEpoch":1700000000123}\0';

  const parsed = helpers.parseStompFrames(rawServerChunk);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].command, 'CONNECTED');
  assert.equal(parsed[0].headers.version, '1.2');
  assert.equal(parsed[1].command, 'MESSAGE');
  assert.equal(parsed[1].headers.destination, '/topic/room/main-library/events');
  const event = JSON.parse(parsed[1].body);
  assert.equal(event.type, 'PLAYER_MOVED');
  assert.equal(event.userId, 'u-1');

  let pos = { x: 12, y: 13 };
  for (let i = 0; i < 8; i++) {
    const next = helpers.nextWalkableStep(pos, i);
    const dist = Math.abs(next.x - pos.x) + Math.abs(next.y - pos.y);
    assert.equal(dist, 1, 'Each step must move exactly 1 orthogonal walkable tile');
    assert.ok(['UP', 'DOWN', 'LEFT', 'RIGHT'].includes(next.facingDir));
    pos = { x: next.x, y: next.y };
  }
});

test('backup-nightly workflow and backup/restore scripts exist and meet Phase 7 spec', () => {
  const workflowPath = path.join(rootDir, '.github/workflows/backup-nightly.yml');
  assert.ok(fs.existsSync(workflowPath), 'backup-nightly.yml must exist');
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /retention-days:\s*7/);
  assert.match(workflow, /scripts\/create-backup\.sh/);

  const backupEnvScript = path.join(rootDir, 'scripts/backup-env.sh');
  const createScript = path.join(rootDir, 'scripts/create-backup.sh');
  const restoreScript = path.join(rootDir, 'scripts/restore-backup.sh');
  const k6Script = path.join(rootDir, 'scripts/k6-room-load.js');

  assert.ok(fs.existsSync(backupEnvScript), 'scripts/backup-env.sh must exist');
  assert.ok(fs.existsSync(createScript), 'scripts/create-backup.sh must exist');
  assert.ok(fs.existsSync(restoreScript), 'scripts/restore-backup.sh must exist');
  assert.ok(fs.existsSync(k6Script), 'scripts/k6-room-load.js must exist');

  const k6Content = fs.readFileSync(k6Script, 'utf8');
  assert.match(k6Content, /\/api\/v1\/auth\/guest/);
  assert.match(k6Content, /\/api\/v1\/rooms\/join/);
  assert.match(k6Content, /\/app\/room\/\$\{roomId\}\/move/);
  assert.match(k6Content, /\/app\/room\/\$\{roomId\}\/chat/);
  assert.match(k6Content, /stomp_broadcast_latency_ms/);
  assert.match(k6Content, /p\(95\)</);

  const createContent = fs.readFileSync(createScript, 'utf8');
  assert.match(createContent, /\bSCAN\b/);
  assert.doesNotMatch(createContent, /KEYS['",\s]+\*/);
  assert.match(createContent, /if raw then/);

  const restoreContent = fs.readFileSync(restoreScript, 'utf8');
  assert.match(restoreContent, /redis-cli.*-x\s+EVAL/);
  assert.match(restoreContent, /BACKUP_ENCRYPTION_PASSPHRASE/);
  assert.match(restoreContent, /openssl enc -d -aes-256-cbc -pbkdf2/);

  const bashBin = resolveBashExecutable();
  execFileSync(bashBin, ['-n', backupEnvScript]);
  execFileSync(bashBin, ['-n', createScript]);
  execFileSync(bashBin, ['-n', restoreScript]);

  const runBackupDryRun = (archive, envOverrides) =>
    execFileSync(bashBin, [createScript, archive], {
      env: {
        ...process.env,
        BACKUP_DRY_RUN: 'true',
        SPRING_DATA_REDIS_HOST: 'redis-123.redns.redis-cloud.com',
        SPRING_DATA_REDIS_PORT: '14567',
        SPRING_DATA_REDIS_SSL_ENABLED: 'true',
        ...envOverrides,
      },
      encoding: 'utf8',
    });

  const dryRunOut = runBackupDryRun('backups/test.tar.gz', {
    SPRING_DATASOURCE_URL:
      'jdbc:mysql://mysql-aiven.example.com:25060/defaultdb?sslMode=REQUIRED&characterEncoding=UTF-8',
    SPRING_DATASOURCE_USERNAME: 'avnadmin',
  });
  assert.match(
    dryRunOut,
    /MYSQL_HOST=mysql-aiven\.example\.com MYSQL_PORT=25060 MYSQL_DATABASE=defaultdb MYSQL_USER=avnadmin MYSQL_SSL_MODE=REQUIRED/,
  );
  assert.match(
    dryRunOut,
    /REDIS_HOST=redis-123\.redns\.redis-cloud\.com REDIS_PORT=14567 REDIS_USERNAME=default REDIS_TLS=true OUTPUT=backups\/test\.tar\.gz/,
  );

  // TiDB Cloud Serverless JDBC URL (VERIFY_IDENTITY) + Redis Labs TLS
  const tidbDryRunOut = runBackupDryRun('backups/tidb.tar.gz', {
    SPRING_DATASOURCE_URL:
      'jdbc:mysql://gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/studytogether?sslMode=VERIFY_IDENTITY&enabledTLSProtocols=TLSv1.2,TLSv1.3',
    SPRING_DATASOURCE_USERNAME: 'tidbuser.root',
  });
  assert.match(
    tidbDryRunOut,
    /MYSQL_HOST=gateway01\.ap-southeast-1\.prod\.aws\.tidbcloud\.com MYSQL_PORT=4000 MYSQL_DATABASE=studytogether MYSQL_USER=tidbuser\.root MYSQL_SSL_MODE=VERIFY_IDENTITY/,
  );
  assert.match(
    tidbDryRunOut,
    /REDIS_HOST=redis-123\.redns\.redis-cloud\.com REDIS_PORT=14567 REDIS_USERNAME=default REDIS_TLS=true OUTPUT=backups\/tidb\.tar\.gz/,
  );

  // Verify actual TLS CLI args emitted by backup-env.sh for TiDB Cloud and Redis Labs
  const tlsArgsOut = execFileSync(
    bashBin,
    [
      '-c',
      `source "${backupEnvScript.replace(/\\/g, '/')}"
       mysqldump() { echo "--ssl-mode --ssl-ca"; }
       resolve_backup_connection_env
       append_mysql_ssl_args mysqldump
       build_redis_cli_args
       printf 'MYSQL_ARGS=%s\\nREDIS_ARGS=%s\\n' "\${MYSQL_SSL_ARGS[*]}" "\${REDIS_ARGS[*]}"`,
    ],
    {
      env: {
        ...process.env,
        SPRING_DATASOURCE_URL:
          'jdbc:mysql://gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/studytogether?sslMode=VERIFY_IDENTITY',
        MYSQL_SSL_CA: '/etc/ssl/certs/ca-certificates.crt',
        SPRING_DATA_REDIS_HOST: 'redis-123.redns.redis-cloud.com',
        SPRING_DATA_REDIS_PORT: '14567',
        SPRING_DATA_REDIS_SSL_ENABLED: 'true',
      },
      encoding: 'utf8',
    },
  );
  assert.match(tlsArgsOut, /MYSQL_ARGS=--ssl-mode=VERIFY_IDENTITY --ssl-ca=\/etc\/ssl\/certs\/ca-certificates\.crt/);
  assert.match(tlsArgsOut, /REDIS_ARGS=-h redis-123\.redns\.redis-cloud\.com -p 14567 --tls/);
});

test('GitHub Actions workflows never reference secrets.* inside if: conditionals and backup-nightly handles unconfigured secrets gracefully', () => {
  const workflowsDir = path.join(rootDir, '.github/workflows');
  const workflowFiles = fs
    .readdirSync(workflowsDir)
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'));
  assert.ok(workflowFiles.length >= 3, 'Expected ci.yml, cd.yml, and backup-nightly.yml');

  for (const file of workflowFiles) {
    const content = fs.readFileSync(path.join(workflowsDir, file), 'utf8');
    const lines = content.split(/\r?\n/);
    let inIfBlock = false;
    let ifIndent = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const ifMatch = line.match(/^(\s*)(?:-\s*)?if:\s*(.*)$/);
      if (ifMatch) {
        ifIndent = ifMatch[1].length + (line.includes('- if:') ? 2 : 0);
        inIfBlock = true;
        assert.doesNotMatch(
          ifMatch[2],
          /\bsecrets\./,
          `${file}:${i + 1} must not reference secrets.* inside an if: conditional`,
        );
        continue;
      }
      if (inIfBlock) {
        if (/^\s*$/.test(line) || /^\s*#/.test(line)) continue;
        const indent = line.match(/^(\s*)/)[1].length;
        if (indent > ifIndent) {
          assert.doesNotMatch(
            line,
            /\bsecrets\./,
            `${file}:${i + 1} must not reference secrets.* inside a multi-line if: conditional`,
          );
        } else {
          inIfBlock = false;
        }
      }
    }
  }

  const backupWorkflow = fs.readFileSync(path.join(workflowsDir, 'backup-nightly.yml'), 'utf8');
  assert.match(backupWorkflow, /::warning::/);
  assert.match(backupWorkflow, /steps\.create-backup\.outputs\.archive\s*!=\s*''/);
  assert.match(backupWorkflow, /BACKUP_S3_BUCKET/);
  assert.match(backupWorkflow, /BACKUP_ENCRYPTION_PASSPHRASE/);
  assert.match(backupWorkflow, /openssl enc -aes-256-cbc -pbkdf2/);
  assert.match(backupWorkflow, /rm -f "\$ARCHIVE"/);
});
