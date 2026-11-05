# Aura Board

An independent, read-only badge and aura tracker for the Squeekchain Genesis community. Built with TypeScript, native HTML and Vite. The static production export is included in `dist/`, with local fonts, an original dot-matrix hamster, favicon and share image.

**Important integration limit, verified 2026-11-05:** the official public profile endpoint restricts browser CORS access to `https://sepolia.squeekchain.com`. Independent static origins cannot currently read member details. Aura Board reports the failure and offers the official profile link; its live stats, leaderboard, badge catalog and activity work independently. No proxy, fabricated profile, fixture fallback, wallet, token, contract or login was added. The required independent-host lookup is therefore **not fully deliverable while this API policy remains in place**. A real profile was tested successfully with the production export in a test-only permitted-origin harness; that does not establish independent-host compatibility.

The requested community Genesis state route also returns 404. The official site's actual launch endpoint currently reports `launch_unconfigured`. The app shows that state and does not invent a launch phase or deadline. These external limits are detailed in [the API audit](artifacts/api-audit.md) and [validation report](artifacts/validation.md).

## Install, run and rebuild

Use Node 22.12 or newer and npm:

```sh
npm ci
npm run dev
npm run typecheck
npm run build
npm run preview
```

`npm run build` typechecks and rebuilds `dist/`. Publish the contents of that directory to a static host. Vite uses `base: './'`; asset URLs are relative and routes use hashes (`#/board`, `#/board/xxxxxxxx`, `#/leaderboard`, `#/about`), so no server rewrites or backend are needed. Serve over HTTP(S), rather than opening `index.html` as a file.

The source and export are ready for the contributor submission pipeline. No remote GitHub repository or hosted URL was created during this run; there was no connected publication service, and `.git/` and `.github/` were outside the permitted paths. No publication URL is invented here.

## What the app does

- Board: validates an 8-character public invite code, requests its profile, displays official aura, tier, rank and movement when readable, and joins earned IDs to the live official badge catalog. It splits earned and in-progress badges and exposes every official criterion in native expandable disclosures.
- Insights: orders badges by unofficial fitted aura contribution and suggests up to three non-holder next steps, excluding trophies and fully allocated early badges. Private eligibility and task completion are not inferred. “In progress” means not earned, not a measured completion percentage.
- Leaderboard: displays the API's published top 100, 20 rows per page, with code/name search, tier labels and colors, profile links, and movement since the previous successful observation in this tab. The API supplies no per-row movement or full-roster pagination; initially movement says “No history.” An exact invite-code search opens a profile lookup outside the top 100 as well.
- Genesis pulse: independently reads member, badge and project counts, requested Genesis state, and the official launch state. Supported v3 active phases use their configured end times for a human-readable countdown. An expired countdown says it is awaiting an official update.

All member details, standing, checklist contents, activity and community counters come from public API reads during the visit. No member data is persisted in browser storage or bundled as a live fallback. The bundled **dated estimation model** is research output, labelled unofficial, separate from live member observations.

## APIs and inspected schemas

Base: `https://community.squeekchain.com/v1/community`.

| Endpoint | Fields consumed / verified behavior |
| --- | --- |
| `/stats` | `members`, `badgesEarned`, `projectsVerified`, `snapshot.computedAt` |
| `/leaderboard` | `entries[].rank/code/identity/aura/badges/tier`, `snapshot`, `generatedAt`; returns 100 entries, ignores limit/offset parameters |
| `/profiles/:code` | `valid`, `identity`, `standing.rank/aura/tier/movement`, `completedReferrals`, `achievements[].id/title/active`, `snapshot`; public JSON, restricted CORS |
| `/aura/badges` | `badges[].id/lane/title/description/instruction/criteria/trophy/rarity/snapshotAt`, `snapshot`; 35 badges when inspected |
| `/genesis/activity` | `events[].id/at/member/kind/achievement`, `nextBefore` |
| `/genesis/state` | HTTP 404; no phase schema invented |
| `https://api.squeekchain.com/v1/genesis-launch` | Official site client schema v3: `status`, unavailable `reason`; available `state.phase`, `configuration.opensAt/whitelistClosesAt/closesAt`, `snapshot.blockTimestamp` (Unix seconds as strings) |

The official `https://sepolia.squeekchain.com` site and its public client bundle were inspected before implementation. The real badge route is `/aura/badges`, not `/badges`. `src/schema.ts` validates the fields actually used, permits extra fields, and rejects missing/malformed fields and unknown enum values. A profile response must match its requested code.

## Aura estimation method

`npm run fit` runs `scripts/fit-estimates.mjs` using public GETs and `curl`, then writes `src/aura-model.json` and `artifacts/fit-record.json`. It does not run during a normal build. The checked-in model is required so a rebuild is deterministic and never depends on a fresh network crawl.

The recorded fit uses **132 real public profiles**: all 100 published leaderboard entries plus 32 distinct recent activity members outside that board. Activity candidates and final profiles are sorted by code; non-trophy features are sorted by badge ID. Every selected profile was fetched once, using two workers. Raw profiles and identities are not shipped.

For each profile, `X[i,j]` is 1 if achievement `j` is present, including inactive holder achievements, and 0 otherwise. `y[i]` is official total aura. We solve pure non-negative least squares:

```text
minimize ||Xw - y||², subject to w >= 0
```

There are 32 non-trophy columns, no regularization and no separate intercept. Signed Up can absorb a common baseline. Trophy columns are excluded and displayed as zero only because their fetched official criteria explicitly say they add no aura. The deterministic accelerated projected-gradient solver starts at zero; its step is `1 / max(abs-row-sum(XᵀX))`. It stops when maximum KKT violation is below `1e-6` (or refuses to replace the model after 100,000 iterations).

Recorded result: fitted **2026-11-05 15:18:58 UTC**, source snapshot **2026-11-05 14:58:20 UTC**, **19,492 iterations**, KKT violation **9.34e-7**, in-sample MAE **71.47 aura**, RMSE **125.78 aura**. No holdout accuracy or causal interpretation is claimed. The About page publishes these numbers, sample selection, contribution table, support counts, sample checksum and limitations. The aggregate fit record preserves the Gram matrix, cross-product and squared target sum for independent examination of the recorded objective. Re-running the sampler against a changed API produces a new dated sample, not necessarily the same model.

No sampled holders means no estimate. Support below three is marked sparse. Identical feature columns are marked inseparable; zero-start symmetry shares their fitted attribution equally. Badge co-occurrence, referrals, holder caps and community activation confound individual estimates. A fitted zero does not establish an official zero. Suggestions are an ordering of potential next steps, not a guarantee of eligibility, effort or extra aura. Every displayed contribution is labelled unofficial.

## Caching, failure and freshness rules

- Endpoint reads are deduplicated while in flight. A validated response is reused for at least 30 seconds from observation; failed attempts are throttled for 30 seconds. The visible app attempts refreshes every 30 seconds, so a recently observed endpoint may skip a tick. Hidden tabs stop polling; returning to the tab requests a refresh under the same cache policy.
- A request times out after 12 seconds. HTTP errors, browser/network/CORS failures, invalid JSON and unsupported schemas are reported by section. Failed refreshes retain the previous validated response and its original observation time.
- HTTP 429 pauses that API origin, including profile reads. `Retry-After` seconds or dates are honored with a minimum 30-second pause. Without that exposed header, exponential backoff starts at 30 seconds and grows to 15 minutes. A concurrent success cannot cancel an active rate-limit pause.
- Source snapshots older than five minutes, more than one minute in the future, missing source timestamps on snapshot-bearing responses, observations older than one minute, and failed refreshes are explicitly marked delayed/unverified. Five minutes is our conservative UI threshold, not an official SLA.
- API responses are never silently replaced by the estimator's historical sample. Each section publishes its observation/source time. The sampler requests each distinct endpoint once and aborts on 429 rather than retrying through a rate limit.

## Checks actually run

The production build, TypeScript typecheck, NNLS/static integrity checks, production-export browser interactions, API failure simulations and pinned design probe were run. The full commands, final outcomes, screenshots, six-domain review and unperformed checks are recorded in [artifacts/validation.md](artifacts/validation.md). These are worker observations, not independent certification.

To repeat the portable checks after installation:

```sh
npm run typecheck
npm run build
npm test
npx playwright install chromium
npm run test:browser
```

The browser check serves `dist/` at a subpath, closes its own server/browser, fetches current official data, tests independent-origin behavior, and uses a clearly identified permitted-origin harness for real profile success. Failure simulations exist only in the test process. It supports optional `AURA_PLAYWRIGHT_MODULE`, `AURA_BROWSER_EXECUTABLE` and `AURA_TEST_PROXY` test-runtime settings; no machine-specific values or credentials are included in the source or export. A network change or CORS-policy change can alter live integration results.

## Layout and submission budget

[DESIGN.md](DESIGN.md) documents the final tokens, typography, components and responsive rules. Source is in `src/`; estimation and validation tools are in `scripts/`; local runtime assets are in `public/`; the complete production export is in `dist/`.

Explicit ignore-path budget for the new `.gitignore`:

| Ignored paths, at every nesting depth where marked `**` | Submission budget |
| --- | ---: |
| `**/node_modules/`, `**/.npm/`, `**/.vite/`, `**/.cache/` | 0 bytes |
| `**/playwright-report/`, `**/test-results/`, `test/scratch/`, `*.tsbuildinfo` | 0 bytes |
| `dist/`, source, lockfile, model and required runtime assets | Included; never ignored |

Tooling dependencies, browser downloads and all transient captures stayed in excluded scratch/cache directories. There is no submodule, vendored registry, dependency archive or runtime backend. The final validation report records the conservative uncompressed submission total against the 8 MiB limit.

## Attribution

The original LED hamster, favicon and share art were drawn for Aura Board. Space Grotesk is bundled locally under its SIL Open Font License in `public/FONT-LICENSE.txt` (also in the export). Design/review work applies the pinned Better Interface guide, adapted from Jakub Krehel (MIT), and documentation guidance adapted from Paul Bakaus's Impeccable (Apache-2.0). Their retained notices are in `artifacts/design-guidance-LICENSE.txt`.
