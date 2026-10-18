import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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

      // Start from a site with nothing archived, whatever the repo has archived by now.
      writeFileSync(join(work, 'versions.json'), '[]\n');
      for (const entry of readdirSync(join(work, 'src/content/docs'))) {
        if (/^\d+\.\d+$/.test(entry)) rmSync(join(work, 'src/content/docs', entry), { recursive: true, force: true });
      }
      const versionData = join(work, 'src/content/versions');
      if (existsSync(versionData)) {
        for (const entry of readdirSync(versionData)) {
          if (entry !== '.gitkeep') rmSync(join(versionData, entry), { recursive: true, force: true });
        }
      }

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
      // Search still renders, and the page names its version for DocSearch.
      expect(html).toContain('data-open-modal');
      expect(html).toContain('<meta name="docsearch:version" content="0.1">');
      // Our own banner override is still there.
      expect(html).toContain('prerelease-banner');
    },
    180_000,
  );
});

describe('archive-version early exits', () => {
  const dirs: string[] = [];
  afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

  // A small copy of the layout the script needs, with the build replaced by a
  // command that leaves a marker file so a test can tell whether it ran.
  function setup(versions: string) {
    const dir = mkdtempSync(join(tmpdir(), 'artic-archive-fast-'));
    dirs.push(dir);
    mkdirSync(join(dir, 'scripts'));
    mkdirSync(join(dir, 'src/lib'), { recursive: true });
    cpSync(join(repo, 'scripts/archive-version.mjs'), join(dir, 'scripts/archive-version.mjs'));
    cpSync(join(repo, 'src/lib/versions.mjs'), join(dir, 'src/lib/versions.mjs'));
    writeFileSync(join(dir, 'versions.json'), versions);
    const marker = join(dir, 'built');
    writeFileSync(join(dir, 'build.sh'), `#!/bin/sh\ntouch "${marker}"\n`, { mode: 0o755 });
    return { dir, marker };
  }

  function run(dir: string, version: string, extra: Record<string, string> = {}) {
    return spawnSync('node', ['scripts/archive-version.mjs', version], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, ARCHIVE_BUILD_CMD: join(dir, 'build.sh'), ...extra },
    });
  }

  it.each(['1.2.0-beta.1', '0.1.0; touch x', ''])('rejects %j before building', (version) => {
    const { dir, marker } = setup('[]\n');
    const result = run(dir, version);
    expect(result.status).toBe(1);
    expect(existsSync(marker)).toBe(false);
    expect(existsSync(join(dir, 'x'))).toBe(false);
    expect(readFileSync(join(dir, 'versions.json'), 'utf8')).toBe('[]\n');
  });

  it('does nothing for a patch of an archived line', () => {
    const { dir, marker } = setup('["0.1"]\n');
    const out = join(dir, 'github-output');
    const result = run(dir, '0.1.1', { GITHUB_OUTPUT: out });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('0.1 is already archived');
    expect(existsSync(marker)).toBe(false);
    expect(readFileSync(join(dir, 'versions.json'), 'utf8')).toBe('["0.1"]\n');
    expect(readFileSync(out, 'utf8')).toBe('slug=0.1\nadded=false\n');
  });

  it('records a new line and builds', () => {
    const { dir, marker } = setup('["0.1"]\n');
    const out = join(dir, 'github-output');
    const result = run(dir, '0.2.0', { GITHUB_OUTPUT: out });
    expect(result.status).toBe(0);
    expect(existsSync(marker)).toBe(true);
    expect(JSON.parse(readFileSync(join(dir, 'versions.json'), 'utf8'))).toEqual(['0.1', '0.2']);
    expect(readFileSync(out, 'utf8')).toBe('slug=0.2\nadded=true\n');
  });
});
