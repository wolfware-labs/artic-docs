import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tempDirs } from '../temp-dirs';

const repo = resolve(__dirname, '../..');

describe('apply-archive', () => {
  const tempDir = tempDirs();

  const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' });

  // A git repository with the given files staged and nothing committed.
  function stagedRepo(files: Record<string, string>) {
    const dir = tempDir('artic-apply-');
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), text);
    }
    git(dir, 'init', '-q');
    git(dir, 'add', '-A');
    return dir;
  }

  const base = { 'versions.json': '[]\n', 'README.md': 'readme\n', 'src/content/docs/docs/a.md': 'current\n' };

  // The patch the snapshot job would upload: whatever `change` does, against `base`.
  function patchFrom(change: (dir: string) => void) {
    const dir = stagedRepo(base);
    const tree = git(dir, 'write-tree').trim();
    change(dir);
    git(dir, 'add', '-A');
    const patch = join(dir, 'archive.patch');
    writeFileSync(patch, git(dir, 'diff', '--cached', '--binary', tree));
    return patch;
  }

  function site(versions = '[]\n') {
    const scripts = ['scripts/apply-archive.mjs', 'scripts/lib/archive-patch.mjs', 'src/lib/versions.mjs'];
    return stagedRepo({
      ...base,
      'versions.json': versions,
      ...Object.fromEntries(scripts.map((f) => [f, readFileSync(join(repo, f), 'utf8')])),
    });
  }

  function run(dir: string, patch: string, version: string) {
    const out = join(tempDir('artic-apply-output-'), 'output');
    const result = spawnSync('node', ['scripts/apply-archive.mjs', patch, version], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, GITHUB_OUTPUT: out },
    });
    return { ...result, output: existsSync(out) ? readFileSync(out, 'utf8') : '' };
  }

  // Every file in the work tree is staged as it is: nothing modified, nothing untracked.
  const clean = (dir: string) => git(dir, 'diff', '--name-only') + git(dir, 'ls-files', '--others', '--exclude-standard');
  const snapshot = (dir: string) => {
    mkdirSync(join(dir, 'src/content/docs/0.1/docs'), { recursive: true });
    writeFileSync(join(dir, 'src/content/docs/0.1/docs/a.md'), 'archived\n');
    mkdirSync(join(dir, 'src/content/versions'), { recursive: true });
    writeFileSync(join(dir, 'src/content/versions/0.1.json'), '{}\n');
  };

  it('applies the snapshot and records the version', () => {
    const dir = site();
    const result = run(dir, patchFrom(snapshot), '0.1.2');
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(readFileSync(join(dir, 'src/content/docs/0.1/docs/a.md'), 'utf8')).toBe('archived\n');
    expect(JSON.parse(readFileSync(join(dir, 'versions.json'), 'utf8'))).toEqual(['0.1']);
    expect(git(dir, 'ls-files', 'src/content/docs/0.1', 'src/content/versions').split('\n').filter(Boolean)).toEqual([
      'src/content/docs/0.1/docs/a.md',
      'src/content/versions/0.1.json',
    ]);
    expect(clean(dir)).toBe('');
    expect(result.output).toBe('slug=0.1\n');
  });

  it.each([
    [
      'a symlink',
      (d: string) => {
        snapshot(d);
        symlinkSync('/etc/hostname', join(d, 'src/content/docs/0.1/docs/b.md'));
      },
      'not a regular file (120000): src/content/docs/0.1/docs/b.md',
    ],
    [
      'a deleted file',
      (d: string) => {
        snapshot(d);
        rmSync(join(d, 'README.md'));
      },
      'not a new file (D): README.md',
    ],
    [
      'a renamed file',
      (d: string) => {
        snapshot(d);
        mkdirSync(join(d, 'src/content/docs/0.1/old'), { recursive: true });
        cpSync(join(d, 'README.md'), join(d, 'src/content/docs/0.1/old/README.md'));
        rmSync(join(d, 'README.md'));
      },
      'not a new file (D): README.md',
    ],
    [
      'versions.json',
      (d: string) => {
        snapshot(d);
        writeFileSync(join(d, 'versions.json'), '["0.1", "9.9"]\n');
      },
      'not a new file (M): versions.json',
    ],
    [
      'a file of another version',
      (d: string) => {
        snapshot(d);
        mkdirSync(join(d, 'src/content/docs/0.2'), { recursive: true });
        writeFileSync(join(d, 'src/content/docs/0.2/x.md'), 'x\n');
      },
      'outside the 0.1 snapshot: src/content/docs/0.2/x.md',
    ],
  ])('refuses a patch with %s and changes nothing', (_name, change, problem) => {
    const dir = site();
    const tree = git(dir, 'write-tree');
    const result = run(dir, patchFrom(change), '0.1.0');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(problem);
    expect(existsSync(join(dir, 'src/content/docs/0.1'))).toBe(false);
    expect(readFileSync(join(dir, 'versions.json'), 'utf8')).toBe('[]\n');
    expect(readFileSync(join(dir, 'README.md'), 'utf8')).toBe('readme\n');
    expect(git(dir, 'write-tree')).toBe(tree);
    expect(clean(dir)).toBe('');
    expect(result.output).toBe('');
  });

  it.each(['0.1.0; touch x', '1.2.0-beta.1', ''])('refuses the version %j', (version) => {
    const dir = site();
    const result = run(dir, patchFrom(snapshot), version);
    expect(result.status).toBe(1);
    expect(existsSync(join(dir, 'src/content/docs/0.1'))).toBe(false);
    expect(result.output).toBe('');
  });

  it('refuses a version that is already archived', () => {
    const dir = site('["0.1"]\n');
    const result = run(dir, patchFrom(snapshot), '0.1.3');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('0.1 is already archived');
    expect(existsSync(join(dir, 'src/content/docs/0.1'))).toBe(false);
  });
});
