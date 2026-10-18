import { readFile, writeFile } from 'node:fs/promises';

const RELEASE = /^v?(\d+)\.(\d+)\.\d+$/;

/** "0.1.3" and "v0.1.3" both archive as "0.1". Prereleases are not archived. */
export function versionSlug(frameworkVersion) {
  const match = RELEASE.exec(frameworkVersion);
  if (!match) {
    throw new Error(`Cannot archive "${frameworkVersion}": expected a release like 1.2.3`);
  }
  return `${match[1]}.${match[2]}`;
}

function compareSlugs(a, b) {
  const [aMajor, aMinor] = a.split('.').map(Number);
  const [bMajor, bMinor] = b.split('.').map(Number);
  return aMajor - bMajor || aMinor - bMinor;
}

/** Config for starlight-versions, or null when nothing has been archived yet. */
export function versionsPluginConfig(versions) {
  if (versions.length === 0) return null;
  return {
    versions: [...versions].sort(compareSlugs).reverse().map((slug) => ({ slug })),
    // Contributor docs are generated from the framework repo and always track main.
    exclude: ['docs/contributing/**'],
  };
}

export async function readVersions(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

/** Adds the version's slug to the file unless it is already there. Returns the slug. */
export async function addVersion(file, frameworkVersion) {
  const slug = versionSlug(frameworkVersion);
  const versions = await readVersions(file);
  if (!versions.includes(slug)) {
    versions.push(slug);
    versions.sort(compareSlugs);
    await writeFile(file, `${JSON.stringify(versions, null, 2)}\n`);
  }
  return slug;
}
