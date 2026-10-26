import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test } from 'vitest';
// @ts-expect-error plain .mjs module without types
import { syncContributorDocs, transformDoc } from '../../scripts/lib/contributor-docs.mjs';

const FIXTURE = resolve(import.meta.dirname, '../fixtures/artic-docs');

test('takes the title from the first H1 and drops it', () => {
  const r = transformDoc('# Backend seams\n\nBody', 'design/backends.md');
  expect(r.title).toBe('Backend seams');
  expect(r.body.trim()).toBe('Body');
});

test('design pages drop the "Design:" prefix the sidebar group already says', () => {
  expect(transformDoc('# Design: backend seams', 'design/backends.md').title).toBe('Backend seams');
  expect(transformDoc('# Design: the XAML compiler', 'design/xaml-compiler.md').title).toBe(
    'The XAML compiler',
  );
  expect(transformDoc('# Design: x', 'architecture.md').title).toBe('Design: x');
});

test('falls back to the file name when there is no H1', () => {
  expect(transformDoc('No heading', 'design/loader-values.md').title).toBe('Loader values');
});

test('rewrites relative .md links to site paths and keeps anchors', () => {
  const r = transformDoc('# T\n[x](../design/text.md#3-shaping)', 'spec/technical_spec.md');
  expect(r.body).toContain('](/docs/contributing/design/text/#3-shaping)');
});

test('resolves sibling links and lowercases underscores to hyphens', () => {
  const r = transformDoc('# T\n[x](technical_spec.md)', 'spec/other.md');
  expect(r.body).toContain('](/docs/contributing/spec/technical-spec/)');
});

test('links outside the published set point to GitHub', () => {
  const r = transformDoc('# T\n[p](internal/plans/a.md)', 'architecture.md');
  expect(r.body).toContain(
    '](https://github.com/wolfware-labs/artic/blob/main/docs/internal/plans/a.md)',
  );
});

test('leaves external links, anchors and fenced code alone', () => {
  const src = '# T\n[a](https://x.dev/a.md) [b](#b)\n\n```\n[c](d.md)\n```\n';
  const r = transformDoc(src, 'architecture.md');
  expect(r.body).toContain('](https://x.dev/a.md)');
  expect(r.body).toContain('](#b)');
  expect(r.body).toContain('[c](d.md)');
});

test('sync copies only the published set', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'artic-sync-'));
  const written: string[] = await syncContributorDocs({ sourceDir: FIXTURE, outDir: tmp });
  expect(written.some((p) => p.includes('internal'))).toBe(false);
  expect(written.some((p) => p.includes('spikes'))).toBe(false);
  expect(written.some((p) => p.includes('README'))).toBe(false);
  expect(written.map((p) => p.slice(tmp.length + 1)).sort()).toEqual([
    'architecture.md',
    'design/loader-values.md',
    'design/text.md',
    'spec/technical-spec.md',
  ]);
});

test('written files carry quoted frontmatter titles', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'artic-sync-'));
  await syncContributorDocs({ sourceDir: FIXTURE, outDir: tmp });
  const out = await readFile(join(tmp, 'design/text.md'), 'utf8');
  expect(out.startsWith('---\ntitle: "Text \\"shaping\\""\n---\n')).toBe(true);
});
