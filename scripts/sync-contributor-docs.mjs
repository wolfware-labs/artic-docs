import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { syncContributorDocs } from './lib/contributor-docs.mjs';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const outDir = join(root, 'src/content/docs/docs/contributing');
const REPO = 'https://github.com/wolfware-labs/artic';

async function resolveSourceDir() {
  if (process.env.ARTIC_REPO_DIR) return join(resolve(process.env.ARTIC_REPO_DIR), 'docs');
  const cache = join(root, 'node_modules/.cache/artic');
  await rm(cache, { recursive: true, force: true });
  await mkdir(join(cache, '..'), { recursive: true });
  execFileSync('git', ['clone', '--depth', '1', '--branch', 'main', REPO, cache], {
    stdio: 'inherit',
  });
  return join(cache, 'docs');
}

const sourceDir = await resolveSourceDir();
if (!existsSync(sourceDir)) throw new Error(`Framework docs not found at ${sourceDir}`);
await rm(outDir, { recursive: true, force: true });
const written = await syncContributorDocs({ sourceDir, outDir });
console.log(`contributor docs: wrote ${written.length} pages from ${sourceDir}`);
