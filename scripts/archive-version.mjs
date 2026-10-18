import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addVersion } from '../src/lib/versions.mjs';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const frameworkVersion = process.argv[2];
if (!frameworkVersion) {
  console.error('usage: node scripts/archive-version.mjs <frameworkVersion>');
  process.exit(1);
}

let result;
try {
  result = await addVersion(resolve(root, 'versions.json'), frameworkVersion);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
const { slug, added } = result;

// Lets the workflow decide whether to open a pull request. The slug has already
// passed versionSlug, so it is safe to use in a branch name.
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `slug=${slug}\nadded=${added}\n`);
}

if (!added) {
  console.log(`${slug} is already archived`);
  process.exit(0);
}

console.log(`archiving docs as ${slug}`);
// The build is what makes starlight-versions write the snapshot. It runs without
// a shell, so nothing from the environment is ever parsed as a command line.
const [command, ...args] = (process.env.ARCHIVE_BUILD_CMD || 'pnpm build').split(' ').filter(Boolean);
execFileSync(command, args, { cwd: root, stdio: 'inherit' });
