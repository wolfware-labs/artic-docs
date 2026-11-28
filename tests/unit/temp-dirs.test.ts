import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tempDirs } from '../temp-dirs';

const made: string[] = [];

describe('tempDirs', () => {
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

it('removes every folder it made once its suite has run', () => {
  expect(made).toHaveLength(2);
  for (const dir of made) expect(existsSync(dir)).toBe(false);
});
