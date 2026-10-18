const RELEASE_TAG = /^v(\d+\.\d+\.\d+)$/;

// Every build gets its run number; a release commit also gets site-<version>.
export function imageTags({ repo, runNumber, headTags }) {
  if (!/^\d+$/.test(runNumber ?? '')) {
    throw new Error(`Invalid run number: ${JSON.stringify(runNumber)}`);
  }
  const tags = [`${repo}:${runNumber}`];
  for (const tag of headTags) {
    const version = RELEASE_TAG.exec(tag)?.[1];
    if (version) tags.push(`${repo}:site-${version}`);
  }
  return tags;
}
