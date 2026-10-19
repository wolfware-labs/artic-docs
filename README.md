# artic.rs

Source for the artic.rs landing page and the artic docs. Built with Astro and Starlight;
the interactive parts of the landing page are React islands.

## Requirements

- Node 24 (see `.nvmrc`)
- pnpm 9

```sh
pnpm install
```

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Syncs the contributor docs, then starts the dev server. |
| `pnpm build` | Syncs the contributor docs, then builds the site into `dist/`. |
| `pnpm test` | Runs the unit and integration tests in `tests/` with Vitest. |
| `pnpm test:e2e` | Builds the site with `ROADMAP_OFFLINE=1` into `dist-e2e/`, serves it and runs the Playwright tests, then runs `test:e2e:newsletter`. |
| `pnpm test:e2e:newsletter` | Builds a copy with the newsletter form switched on into `dist-newsletter/` and runs the form tests against it. |
| `pnpm og` | Renders the link-preview card into `public/og/artic.png` from `scripts/og-image.mjs`. Run it after changing the card. |

The e2e builds call `astro build` directly, so run `pnpm build` (or `pnpm dev`) once first
to sync the contributor docs.

## Contributor docs

The pages under `/docs/contributing/` come from the `docs/` folder of
[wolfware-labs/artic](https://github.com/wolfware-labs/artic). `pnpm dev` and `pnpm build`
copy them into `src/content/docs/docs/contributing/` before Astro runs. By default the
script makes a shallow clone of the repo's `main` branch. Set `ARTIC_REPO_DIR` to a local
checkout to use that instead:

```sh
ARTIC_REPO_DIR=../libs pnpm build
```

The synced folder is ignored by git. Don't edit it here; change the docs in the framework
repo.

## Environment variables

| Variable | Used for |
| --- | --- |
| `ARTIC_REPO_DIR` | Local checkout of wolfware-labs/artic to sync contributor docs from, instead of cloning. |
| `ROADMAP_OFFLINE` | When set, the roadmap uses `src/data/milestones.snapshot.json` instead of the GitHub milestones API. |
| `GITHUB_TOKEN` | Optional token for the milestones API call, to avoid the unauthenticated rate limit. |
| `PUBLIC_DOCSEARCH_APP_ID`, `PUBLIC_DOCSEARCH_API_KEY`, `PUBLIC_DOCSEARCH_INDEX` | Algolia DocSearch. All three must be set to turn it on; otherwise the docs use Starlight's built-in search. |
| `PUBLIC_MAILERLITE_ACTION` | MailerLite form endpoint. The newsletter signup only renders when this is set. |
| `ARTIC_OUT_DIR` | Build output directory. Defaults to `dist`. |

If the milestones API call fails or returns nothing, the build falls back to the snapshot
and logs a warning.

## Archiving a docs version

When a framework release ships, archive the current docs under its version:

```sh
node scripts/archive-version.mjs <frameworkVersion>
```

The script adds a major.minor slug to `versions.json` and runs `pnpm build`, which makes
starlight-versions copy the current docs into a versioned snapshot under `src/content/`.
Contributor docs are left out of snapshots because they always track `main`. Commit
`versions.json` and the new files under `src/content/`.

## Deploying

Three workflows under `.github/workflows/` build and ship the site.

| Workflow | Runs on | What it does |
| --- | --- | --- |
| `ci.yml` | Pull requests to `main` | Runs the unit tests, the e2e tests and a smoke check of the Docker image. Nothing is pushed. |
| `deploy.yml` | Pushes to `main`, nightly at 06:23 UTC, manual runs from `main` | Builds the site and the image, smoke-tests it and pushes it to Docker Hub. |
| `archive-docs.yml` | A `framework-release` dispatch, or a manual run | Archives the docs for a framework release and opens a pull request. |

On a push, the `release` job in `deploy.yml` runs semantic-release first. It tags
`vX.Y.Z` and creates the GitHub release; it doesn't commit anything. The `deploy` job
then pushes `docker.io/wolfware/artic-site` with these tags:

| Tag | When | Who uses it |
| --- | --- | --- |
| `<run number>` | Every deploy | The cluster, which picks up new images from Docker Hub. |
| `site-<version>` | HEAD has a release tag and the run is a push | People. |

There is no `latest` tag.

### Archiving from a framework release

The framework repo sends `framework-release` with the version in `client_payload`:

```sh
gh api repos/wolfware-labs/artic-docs/dispatches \
  -f event_type=framework-release \
  -f 'client_payload[version]=0.2.0'
```

The workflow archives the docs and opens a pull request titled
`docs: archive the 0.2 docs`. Pull requests opened with the workflow token don't trigger
`ci.yml`, so the workflow builds and tests the archive itself. A patch release of a line
that is already archived, like 0.1.1 after 0.1.0, does nothing. To run it by hand, start
"Archive docs" from the Actions tab and enter the version.

### Checking the image locally

```sh
pnpm build && docker build -t artic-site:dev . && bash scripts/smoke-image.sh artic-site:dev
```
