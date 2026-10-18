import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM module without types
import { addVersion, versionSlug, versionsPluginConfig } from '../../src/lib/versions.mjs';

describe('versionSlug', () => {
  it('keeps major.minor', () => {
    expect(versionSlug('0.1.3')).toBe('0.1');
    expect(versionSlug('1.2.0')).toBe('1.2');
  });
  it('accepts a leading v', () => {
    expect(versionSlug('v1.2.0')).toBe('1.2');
  });
  it('rejects prereleases', () => {
    expect(() => versionSlug('0.1.0-rc.1')).toThrow();
  });
  it('rejects garbage', () => {
    expect(() => versionSlug('latest')).toThrow();
  });
});

describe('versionsPluginConfig', () => {
  it('is null for an empty list', () => {
    expect(versionsPluginConfig([])).toBeNull();
  });
  it('lists the newest version first and excludes contributor docs', () => {
    expect(versionsPluginConfig(['0.1', '0.2'])).toEqual({
      versions: [{ slug: '0.2' }, { slug: '0.1' }],
      exclude: ['docs/contributing/**'],
    });
  });
  it('sorts numerically, not lexically', () => {
    const slugs = versionsPluginConfig(['0.9', '0.10'])!.versions.map((v: { slug: string }) => v.slug);
    expect(slugs).toEqual(['0.10', '0.9']);
  });
});

describe('addVersion', () => {
  it('archiving the same version twice leaves one entry', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'artic-versions-'));
    const file = join(dir, 'versions.json');
    await writeFile(file, '[]\n');
    expect(await addVersion(file, '0.1.0')).toEqual({ slug: '0.1', added: true });
    expect(await addVersion(file, '0.1.4')).toEqual({ slug: '0.1', added: false });
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(['0.1']);
  });
});
