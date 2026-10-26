import { expect, test } from 'vitest';
import { imageTags } from '../../scripts/lib/image-tags.mjs';

const repo = 'docker.io/wolfware/artic-site';

test('always tags the run number', () => {
  expect(imageTags({ repo, runNumber: '57', headTags: [] })).toEqual([`${repo}:57`]);
});

test('adds a site-<version> tag for a release tag on HEAD', () => {
  expect(imageTags({ repo, runNumber: '57', headTags: ['v1.4.0'] })).toEqual([
    `${repo}:57`,
    `${repo}:site-1.4.0`,
  ]);
});

test('ignores prereleases and tags that are not versions', () => {
  expect(imageTags({ repo, runNumber: '57', headTags: ['v1.4.0-rc.1', 'not-a-version'] })).toEqual([
    `${repo}:57`,
  ]);
});

test.each(['abc', ''])('rejects the run number %j', (runNumber) => {
  expect(() => imageTags({ repo, runNumber, headTags: [] })).toThrow(/run number/);
});
