import { describe, expect, test } from 'vitest';
import { archiveEntryProblems, parseRawDiff } from '../../scripts/lib/archive-patch.mjs';

const Z = '0'.repeat(40);
const H = 'a'.repeat(40);

describe('parseRawDiff', () => {
  test('reads modes, status and path from NUL-separated raw output', () => {
    const raw = `:000000 100644 ${Z} ${H} A\0src/content/docs/0.1/a b.md\0:100644 000000 ${H} ${Z} D\0x\n.md\0`;
    expect(parseRawDiff(raw)).toEqual([
      { oldMode: '000000', newMode: '100644', status: 'A', path: 'src/content/docs/0.1/a b.md' },
      { oldMode: '100644', newMode: '000000', status: 'D', path: 'x\n.md' },
    ]);
  });

  test('reads nothing from empty output', () => {
    expect(parseRawDiff('')).toEqual([]);
  });
});

describe('archiveEntryProblems', () => {
  const add = (path: string, newMode = '100644') => ({ oldMode: '000000', newMode, status: 'A', path });

  test('accepts new regular files in the snapshot folders of the slug', () => {
    expect(
      archiveEntryProblems(
        [add('src/content/docs/0.1/docs/start-here/install.mdx'), add('src/content/versions/0.1.json')],
        '0.1',
      ),
    ).toEqual([]);
  });

  test.each([
    ['a workflow', '.github/workflows/x.yml'],
    ['package.json', 'package.json'],
    ['versions.json', 'versions.json'],
    ['another version', 'src/content/docs/0.2/docs/a.md'],
    ['a version with the slug as prefix', 'src/content/docs/0.10/docs/a.md'],
    ['another version file', 'src/content/versions/0.2.json'],
    ['the current docs', 'src/content/docs/docs/a.md'],
  ])('rejects %s', (_name, path) => {
    expect(archiveEntryProblems([add('src/content/docs/0.1/a.md'), add(path)], '0.1')).toEqual([
      `outside the 0.1 snapshot: ${path}`,
    ]);
  });

  test('rejects a symlink and a submodule', () => {
    expect(
      archiveEntryProblems(
        [add('src/content/docs/0.1/a.md', '120000'), add('src/content/docs/0.1/b', '160000')],
        '0.1',
      ),
    ).toEqual(['not a regular file (120000): src/content/docs/0.1/a.md', 'not a regular file (160000): src/content/docs/0.1/b']);
  });

  test('rejects an executable file', () => {
    expect(archiveEntryProblems([add('src/content/docs/0.1/a.md', '100755')], '0.1')).toEqual([
      'not a regular file (100755): src/content/docs/0.1/a.md',
    ]);
  });

  test('rejects changes to files that exist', () => {
    const entries = [
      add('src/content/docs/0.1/a.md'),
      { oldMode: '100644', newMode: '100644', status: 'M', path: 'src/content/docs/0.1/b.md' },
      { oldMode: '100644', newMode: '000000', status: 'D', path: 'README.md' },
      { oldMode: '100644', newMode: '100755', status: 'M', path: 'src/content/docs/0.1/c.md' },
    ];
    expect(archiveEntryProblems(entries, '0.1')).toEqual([
      'not a new file (M): src/content/docs/0.1/b.md',
      'not a new file (D): README.md',
      'not a new file (M): src/content/docs/0.1/c.md',
    ]);
  });

  test('rejects a patch with no docs pages', () => {
    expect(archiveEntryProblems([add('src/content/versions/0.1.json')], '0.1')).toEqual([
      'no pages under src/content/docs/0.1/',
    ]);
  });
});
