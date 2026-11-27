import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addVersion, readVersions, versionSlug } from '../src/lib/versions.mjs';
import { archiveEntryProblems, parseRawDiff } from './lib/archive-patch.mjs';

// Applies the docs snapshot built by the archive workflow's first job and
// records the version, so the pull request job never runs the build itself.
// The slug comes from the version given here, not from the patch.
const root = resolve(fileURLToPath(import.meta.url), '../..');
const [patch, frameworkVersion] = process.argv.slice(2);
if (!patch || !frameworkVersion) {
  console.error('usage: node scripts/apply-archive.mjs <patch> <frameworkVersion>');
  process.exit(1);
}

let slug;
try {
  slug = versionSlug(frameworkVersion);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const git = (args, env = process.env) => execFileSync('git', args, { cwd: root, encoding: 'utf8', env });

// Apply to a scratch index first and list what the patch would change, so a
// refused patch leaves the work tree and the index as they were.
const scratch = mkdtempSync(join(tmpdir(), 'archive-index-'));
let problems;
try {
  const base = git(['write-tree']).trim();
  const env = { ...process.env, GIT_INDEX_FILE: join(scratch, 'index') };
  git(['read-tree', base], env);
  git(['apply', '--cached', resolve(patch)], env);
  problems = archiveEntryProblems(parseRawDiff(git(['diff-index', '--cached', '--raw', '-z', '--no-renames', base], env)), slug);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
if (problems.length) {
  console.error(`refusing the archive patch:\n${problems.join('\n')}`);
  process.exit(1);
}

const versionsFile = join(root, 'versions.json');
if ((await readVersions(versionsFile)).includes(slug)) {
  console.error(`${slug} is already archived`);
  process.exit(1);
}
git(['apply', '--index', resolve(patch)]);
await addVersion(versionsFile, frameworkVersion);
git(['add', 'versions.json']);

if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `slug=${slug}\n`);
console.log(`applied the ${slug} snapshot`);
