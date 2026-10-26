import { describe, expect, it } from 'vitest';
import { shareImageVersion } from '../../src/lib/seo.mjs';

describe('shareImageVersion', () => {
  it('is the first 10 hex characters of the SHA-256 of the file', () => {
    // printf 'card' | sha256sum
    expect(shareImageVersion(Buffer.from('card'))).toBe('8367cd66fd');
  });

  it('changes when the file changes and not otherwise', () => {
    const a = shareImageVersion(Buffer.from('card one'));
    expect(shareImageVersion(Buffer.from('card one'))).toBe(a);
    expect(shareImageVersion(Buffer.from('card two'))).not.toBe(a);
  });
});
