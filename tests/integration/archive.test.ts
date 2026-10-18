import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const repo = resolve(__dirname, '../..');

describe('archive-version', () => {
  const work = mkdtempSync(join(tmpdir(), 'artic-archive-'));
  afterAll(() => rmSync(work, { recursive: true, force: true }));

  it(
    'snapshots the docs and builds the archived pages',
    () => {
      // Copy only files git knows about (or would track), so build output and local
      // folders that are ignored or excluded stay out of the temp copy.
      const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
        cwd: repo,
        encoding: 'utf8',
      })
        .split('\0')
        .filter((f) => f && existsSync(join(repo, f)));
      for (const file of files) {
        cpSync(join(repo, file), join(work, file), { recursive: true });
      }
      // A symlinked node_modules makes Vite treat every dependency as outside the project
      // root, which breaks Astro's style handling, so the install is copied instead.
      execFileSync('cp', ['-a', join(repo, 'node_modules'), join(work, 'node_modules')]);

      execFileSync('node', ['scripts/archive-version.mjs', '0.1.0'], {
        cwd: work,
        stdio: 'inherit',
        env: process.env,
      });

      expect(existsSync(join(work, 'src/content/docs/0.1/docs/start-here/install.mdx'))).toBe(true);
      // Contributor docs are excluded from the snapshot. The plugin still recreates their
      // (empty) directories, so assert there are no files rather than no directory.
      const snapshotContributing = join(work, 'src/content/docs/0.1/docs/contributing');
      expect(
        existsSync(snapshotContributing)
          ? readdirSync(snapshotContributing, { recursive: true, withFileTypes: true }).filter((e) => e.isFile())
          : [],
      ).toEqual([]);

      const page = join(work, 'dist/0.1/docs/start-here/install/index.html');
      expect(existsSync(page)).toBe(true);
      const html = readFileSync(page, 'utf8');
      // The plugin's version picker and its "old version" notice both render.
      expect(html).toContain('<starlight-version-select');
      expect(html).toContain('This content is for the 0.1 version.');
      // Our own banner override is still there.
      expect(html).toContain('prerelease-banner');
    },
    180_000,
  );
});
