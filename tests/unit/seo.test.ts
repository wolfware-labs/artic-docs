import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM module without types
import { shareImageVersion } from '../../src/lib/seo.mjs';

describe('shareImageVersion', () => {
  it('is a 10-character hex hash of the file', () => {
    expect(shareImageVersion(Buffer.from('card'))).toMatch(/^[0-9a-f]{10}$/);
  });

  it('changes when the file changes and not otherwise', () => {
    const a = shareImageVersion(Buffer.from('card one'));
    expect(shareImageVersion(Buffer.from('card one'))).toBe(a);
    expect(shareImageVersion(Buffer.from('card two'))).not.toBe(a);
  });
});
