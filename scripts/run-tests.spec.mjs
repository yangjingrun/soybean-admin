import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { buildTsxTestArgs, findSpecFiles } from './run-tests.mjs';

describe('run-tests script helpers', () => {
  it('finds spec files recursively in stable sorted order', () => {
    const root = mkdtempSync(join(tmpdir(), 'ai-foreign-trade-test-files-'));

    try {
      mkdirSync(join(root, 'b'), { recursive: true });
      mkdirSync(join(root, 'a'), { recursive: true });
      writeFileSync(join(root, 'b', 'later.spec.ts'), '');
      writeFileSync(join(root, 'a', 'first.spec.ts'), '');
      writeFileSync(join(root, 'a', 'ignored.test.ts'), '');

      assert.deepEqual(findSpecFiles(root), [join(root, 'a', 'first.spec.ts'), join(root, 'b', 'later.spec.ts')]);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it('builds tsx test args with an optional tsconfig before discovered files', () => {
    assert.deepEqual(buildTsxTestArgs(['one.spec.ts', 'two.spec.ts'], 'apps/server/tsconfig.json'), [
      '--tsconfig',
      'apps/server/tsconfig.json',
      '--test',
      'one.spec.ts',
      'two.spec.ts'
    ]);
  });
});
