import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tempDirs } from '../temp-dirs';

const made: string[] = [];

// The check reads what the inner suite's afterAll left behind, so it must run
// after that suite: shuffle is off here even when the run shuffles. A run that
// filters the inner test out (-t) has nothing to check, so the check skips.
describe('tempDirs', { shuffle: false }, () => {
  describe('in a suite', () => {
    const tempDir = tempDirs();

    it('makes a new folder under the temp directory with the prefix', () => {
      const a = tempDir('artic-temp-dirs-');
      const b = tempDir('artic-temp-dirs-');
      made.push(a, b);
      expect(a).not.toBe(b);
      for (const dir of [a, b]) {
        expect(existsSync(dir)).toBe(true);
        expect(dirname(dir)).toBe(tmpdir());
        expect(basename(dir).startsWith('artic-temp-dirs-')).toBe(true);
      }
    });
  });

  it('removes every folder it made once its suite has run', (ctx) => {
    ctx.skip(made.length === 0, 'the test that makes the folders did not run');
    expect(made).toHaveLength(2);
    for (const dir of made) expect(existsSync(dir)).toBe(false);
  });
});
