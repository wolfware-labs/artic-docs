import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addVersion } from '../src/lib/versions.mjs';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const frameworkVersion = process.argv[2];
if (!frameworkVersion) {
  console.error('usage: node scripts/archive-version.mjs <frameworkVersion>');
  process.exit(1);
}

const slug = await addVersion(resolve(root, 'versions.json'), frameworkVersion);
console.log(`archiving docs as ${slug}`);
// The build is what makes starlight-versions write the snapshot.
execFileSync('pnpm', ['build'], { cwd: root, stdio: 'inherit' });
