import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM module without types
import { docsearchEnabled, searchPlugins, versionFromPath } from '../../src/lib/search.mjs';

const all = {
  PUBLIC_DOCSEARCH_APP_ID: 'app',
  PUBLIC_DOCSEARCH_API_KEY: 'key',
  PUBLIC_DOCSEARCH_INDEX: 'index',
};

describe('searchPlugins', () => {
  it('is empty without any Algolia settings', () => {
    expect(searchPlugins({})).toEqual([]);
  });
  it('is empty when a setting is missing or blank', () => {
    expect(searchPlugins({ PUBLIC_DOCSEARCH_APP_ID: 'app', PUBLIC_DOCSEARCH_API_KEY: 'key' })).toEqual([]);
    expect(searchPlugins({ ...all, PUBLIC_DOCSEARCH_INDEX: '' })).toEqual([]);
  });
  it('returns the DocSearch plugin when all settings are present', () => {
    expect(searchPlugins(all)).toHaveLength(1);
    expect(docsearchEnabled(all)).toBe(true);
    expect(docsearchEnabled({})).toBe(false);
  });
});

describe('versionFromPath', () => {
  it('reads an archived version from the first segment', () => {
    expect(versionFromPath('/0.1/docs/x/', ['0.1'])).toBe('0.1');
  });
  it('is latest for unversioned paths', () => {
    expect(versionFromPath('/docs/x/', ['0.1'])).toBe('latest');
    expect(versionFromPath('/docs/x/', [])).toBe('latest');
    expect(versionFromPath('/', ['0.1'])).toBe('latest');
  });
  it('does not match a version as a prefix of another segment', () => {
    expect(versionFromPath('/0.10/docs/', ['0.1'])).toBe('latest');
  });
});
