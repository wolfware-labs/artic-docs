import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { parse } from 'yaml';

const root = resolve(import.meta.dirname, '../..');
const workflowDir = join(root, '.github/workflows');
const actionsDir = join(root, '.github/actions');

type Step = { uses?: string; run?: string; with?: Record<string, unknown> };
type Job = { if?: string; needs?: string | string[]; permissions?: unknown; steps?: Step[] };
type Workflow = { permissions?: unknown; jobs: Record<string, Job> };

const workflows = readdirSync(workflowDir)
  .filter((f) => /\.ya?ml$/.test(f))
  .map((file) => ({ file, doc: parse(readFileSync(join(workflowDir, file), 'utf8')) as Workflow }));

const jobs = workflows.flatMap(({ file, doc }) =>
  Object.entries(doc.jobs).map(([id, job]) => ({ file, id, job, workflow: doc })),
);

// Jobs that install or run the project's npm dependencies.
const runsDependencyCode = (job: Job) =>
  (job.steps ?? []).some(
    (s) => /\bpnpm\b|scripts\/archive-version\.mjs/.test(s.run ?? '') || s.uses === './.github/actions/build-site',
  );

// The one job allowed to hold a write token after an install: semantic-release
// pushes the release tag and the GitHub release with github.token.
const writeAfterInstall = new Set(['deploy.yml:release']);

const needsOf = (job: Job) => (job.needs === undefined ? [] : [job.needs].flat());

describe('workflows', () => {
  const dependencyJobs = jobs.filter((j) => runsDependencyCode(j.job)).map((j) => [`${j.file}:${j.id}`, j] as const);

  test.each(dependencyJobs)(
    '%s runs dependency code with no secrets and no write permission',
    (name, { job, workflow }) => {
      expect(JSON.stringify(job)).not.toContain('secrets.');
      if (writeAfterInstall.has(name)) return;
      const permissions = job.permissions ?? workflow.permissions;
      expect(JSON.stringify(permissions ?? {})).not.toContain('write');
    },
  );

  // Otherwise the token checkout stores in .git/config is readable by every
  // install script and build step that runs after it.
  test.each(dependencyJobs)('%s checks out without storing credentials', (_name, { job }) => {
    const checkouts = (job.steps ?? []).filter((s) => s.uses?.startsWith('actions/checkout@'));
    for (const step of checkouts) expect(step.with?.['persist-credentials']).toBe(false);
  });

  test.each(jobs.map((j) => [`${j.file}:${j.id}`, j] as const))(
    '%s declares permissions, on the job or the workflow',
    (_name, { job, workflow }) => {
      expect(job.permissions ?? workflow.permissions).toBeDefined();
    },
  );

  // A job's default `if` is success(), which also fails when a job further up the
  // needs chain was skipped. Below a job that runs with always(), each job needs its own if.
  test.each(jobs.map((j) => [`${j.file}:${j.id}`, j] as const))(
    '%s has its own if when a job it needs runs with always()',
    (_name, { job, workflow }) => {
      const upstream = new Set<string>();
      const queue = needsOf(job);
      while (queue.length) {
        const id = queue.shift()!;
        if (upstream.has(id)) continue;
        upstream.add(id);
        queue.push(...needsOf(workflow.jobs[id]));
      }
      const belowAlways = [...upstream].some((id) => /\balways\(\)/.test(workflow.jobs[id].if ?? ''));
      if (belowAlways) expect(job.if ?? '').toMatch(/\balways\(\)|!\s*cancelled\(\)/);
    },
  );

  const actionFiles = readdirSync(actionsDir).map((d) => join(actionsDir, d, 'action.yml'));
  const uses = [
    ...jobs.flatMap(({ file, job }) => (job.steps ?? []).map((s) => [file, s.uses] as const)),
    ...actionFiles.flatMap((f) =>
      ((parse(readFileSync(f, 'utf8')) as { runs: { steps?: Step[] } }).runs.steps ?? []).map(
        (s) => [f.slice(root.length + 1), s.uses] as const,
      ),
    ),
  ].filter((u): u is readonly [string, string] => typeof u[1] === 'string' && !u[1].startsWith('./'));

  test.each(uses)('%s pins %s to a commit', (_file, ref) => {
    expect(ref).toMatch(/^[^@\s]+@[0-9a-f]{40}$/);
  });
});
