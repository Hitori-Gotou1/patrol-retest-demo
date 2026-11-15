import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('actual sync module preserves account state across five async switch boundaries', () => {
  const result = spawnSync(process.execPath, ['--experimental-vm-modules', fileURLToPath(new URL('./helpers/sync-account-race.mjs', import.meta.url))], {
    encoding: 'utf8', timeout: 20000, env: { ...process.env, NODE_TEST_CONTEXT: '' }
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout.trim().split('\n').at(-1));
  assert.equal(report.result, 'PASS');
  assert.equal(report.checks.length, 5);
  assert.equal(report.backend, 'none; actual source in isolated VM');
});
