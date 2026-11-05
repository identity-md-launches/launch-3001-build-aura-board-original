# Revision validation — Aura Board

The revision preserves the existing TypeScript/Vite app, live parsers, static routing and NNLS method. It corrects the 12 reported findings. Verdicts are in the repository-root `.imd-responses.json`. Worker observations below are not independent certification.

## Reproduction and scope

The pre-change production export was exercised in standalone Chromium at 390 and 1440 CSS pixels, served under `/preview/`. A test-only route harness used public API responses captured during this revision and explicit 503 responses; none of that harness is part of the app/export. Its baseline results, in temporary `test/scratch/reproduction.json`, showed:

- Clicked leaderboard code `jxghsp2j` had zero profile summaries when the profile failed, although its standing was already loaded.
- The availability disclosure was closed and omitted leaderboard/catalog/activity failures; mobile phase observation time had `display: none`. Failed initial counters stayed as ellipses.
- A normal 20-minute snapshot was labelled delayed under the five-minute rule.
- An all-503 profile still claimed other sections worked. A held background retry replaced it with waiting, disabled the lookup submit and left focus on BODY.
- Retry made zero requests in the cache window while still reading “Retry”. Paging to page five left focus on BODY.
- A rank-swap arrow changed from “↓ 1” to “↔ 0” on the next poll.
- The phone pulse had no dot background and the hamster area was hidden. The hint directed visitors below the 35-card catalog; the input border was `rgb(53, 64, 53)`.

The reported slogans/headings and missing artifacts/directory creation were also confirmed in source. Declared boundary contrast was calculated with the WCAG sRGB formula: 1.59:1 against the input fill, 1.72:1 against the page. Repository/global-ignore interaction was then confirmed by the absence of newly created artifacts from Git's candidate list; budgeted root exceptions now include the required evidence.

## Fixes and rechecks

| Finding / severity | Final source location | Correction and observed recheck |
| --- | --- | --- |
| Leaderboard click-through / high | `src/main.ts:107`, `src/main.ts:118` | Shared summary renders the matching validated leaderboard row with its own timestamps and explicit unavailable movement. Real desktop/mobile independent-origin lookup passed; no ownership was invented. |
| Incomplete availability panel / high | `src/main.ts:95`, `src/main.ts:78`, `src/style.css:30` | All six core resources and the selected profile are checked, errors open by default, count/phase times stay visible, missing failed counts say Unavailable. A mobile three-source 503 test and total-outage test passed. |
| Excessive source-age warning / medium | `src/api.ts:5`, `src/main.ts:167`, `README.md:73` | 90-minute display threshold, retaining per-source time, one-minute observation checks and failure warnings. Tests pass for normal 20-minute and delayed two-hour snapshots. This is not an official SLA. |
| Misdiagnosed/flashing profile failure / medium | `src/main.ts:91`, `src/main.ts:107`, `src/api.ts:70` | Actual error retained; unsupported healthy-section/CORS claims removed; only explicit lookup uses Finding. Held background retry preserves error, summary, enabled action and focus. |
| Invisible cache wait / medium | `src/api.ts:36`, `src/main.ts:39`, `src/main.ts:253` | Visible Retry/Refresh eligible UTC labels include endpoint cache and origin backoff. Browser confirms a cached retry sends no new request; Retry-After checks pass. |
| Pager focus / medium | `src/main.ts:257` | Opposite enabled button receives focus at an endpoint. Keyboard Enter checks pass at both page five and page one. |
| Lost movement arrows / medium | `src/main.ts:211`, `src/main.ts:163` | Compare distinct `snapshot.computedAt` values rather than HTTP fetch times. A swapped snapshot followed by an identical one retains its arrow. |
| Missing shared LED treatment / medium | `src/style.css:18`, `src/main.ts:91` | Shared 12px pulse grid; orbit/point/caption removed. Computed styles verify dots on all three routes at 390/1440; rendered mobile/desktop screenshots were inspected. |
| Voice/builder wording / medium | `src/main.ts:91`, `src/main.ts:151`, `src/main.ts:167`, `index.html:30` | Removed reported voice lines and slogans, used direct section headings and Community Genesis state. Content closes the deleted space; probe slogans/copy checks pass. |
| Indirect phone member discovery / medium | `src/main.ts:91` | Lookup hint directly links to the leaderboard; verified href and visible first-screen link at 390. |
| Missing fit/report evidence / medium | `scripts/fit-estimates.mjs:60`, `artifacts/`, `.gitignore:11`, `README.md:64` | Sampler creates its directory, completed a new real 132-profile fit and emitted aggregate evidence. Historical README time corrected; current README/About match the new model. Required evidence is explicitly included, with a path budget. |
| Weak input boundary / low | `src/style.css:19` | Existing subtle token now outlines fields/secondary controls. Measured 6.96:1 against fill, 7.53:1 against page; browser computed style agrees. |

## Commands actually run

Dependencies were installed in excluded `test/scratch/tooling/`, using the exact manifest versions, without changing the source lockfile or creating a root dependency tree. Its binaries were put on PATH for npm scripts. Browser downloads and runtime files also stayed in excluded scratch/cache directories.

| Command | Actual result |
| --- | --- |
| `npm run fit` | Exit 0. 132 real profiles, 32 features, fitted 2026-11-05 16:28:22 UTC; source 16:27:25 UTC. 21,358 iterations, KKT 9.2272e-7, MAE 67.3744, RMSE 127.2339. Full aggregate record is included. |
| `npm run typecheck` | Exit 0 with TypeScript 5.9.3. |
| `npm run build` | Exit 0 with Vite 8.3.6, after the final runtime-source corrections. Relative asset URLs, complete `dist/`, no source maps. |
| `npm test` | NNLS behavior, model consistency, metadata/relative assets and export integrity passed. The revision also checks the restored aggregate record and required evidence. |
| `npm run test:browser` | Exit 0, **34/34 checks passed**. Final run: 2026-11-05 16:34:54–16:35:09 UTC. See [browser-results.json](browser-results.json) for each actual result. |
| `node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste` | Exit 0, **16/16 checks passed**, final runtime source; see [design-probe.json](design-probe.json). |
| `git diff --check` | Checked at final handoff; no whitespace errors. |

The browser script used its documented `AURA_PLAYWRIGHT_MODULE` and `AURA_TEST_PROXY` settings, with Playwright's scratch browser path and temporary directory. The pinned probe used its documented `IMD_PLAYWRIGHT` module override pointing to a scratch wrapper that supplied the same test transport proxy; the measurement code was unchanged. Machine-specific settings/addresses are not delivered. The app itself still reads only the official public endpoints directly.

Initial test runs exposed assumptions in the old test harness: it expected the absence of a fallback summary, matched a fixed aura value, and treated summary appearance as completed profile loading. These assertions were updated to compare actual loaded row values and wait for earned checklist completion. Hash navigation now waits for the About layout; a paused virtual clock makes countdown checks deterministic. Intermediate failures are not claimed as passes; the linked record is the complete passing rerun.

## Interaction coverage

Both 1440×1000 desktop and 390×844 mobile exercised real-code lookup, code/name search, empty search/clear, paging and navigation. The valid independent-origin lookup shows the live leaderboard summary and actual profile CORS failure. A separate test-only static harness used the API-allowed official origin to exercise real fetched aura, rank, tier, movement, badge ownership/requirements, categories, recommendations and a second member lookup on mobile; API bodies/CORS headers there were not altered. This does not establish independent-host profile compatibility.

Test-only responses cover success then outage with original observations retained, unsupported schema, two-hour stale snapshot, absent source time, 12-second timeout, 429/120-second Retry-After and origin-wide pause, active v3 countdown, 20-minute normal source cadence, three-source/total outage, cache eligibility labels, held profile retry with focus retention and movement across duplicate snapshots. The script manages and closes its own bounded static preview/browser, and timers advance virtually rather than requiring real-time waits.

Reflow was checked at 320, 390, 760 and 1440 CSS pixels. All routes were additionally checked at 390 and 1440. Runtime JavaScript errors on live primary flows: none. Expected external CORS/network failures were observed and presented, rather than counted as missing local assets. The pinned probe found no missing local files.

## Better Interface review: all six domains

| Domain | Coverage and fixes | Limits |
| --- | --- | --- |
| Accessibility | **Checked** source semantics/labels, visible keyboard focus, lookup validation, native badge disclosures, submit focus during polling, both pager boundaries, control borders, reduced motion. Actual focus screenshot was inspected. | No screen-reader session, physical-device testing or native forced-colors review; target scan is not full WCAG certification. Four controls are below the comfortable 44px size but pass the probe's 24px/spacing check. |
| Layout | **Checked** first phone screen, source banner, linked member discovery, all routes at 390/1440, reflow at 320/760, overflow and long IDs/requirements. Main action stays in the first 390×844 screen. | CSS viewports are not native 200% zoom; pseudo-localization and RTL localization were not tested. |
| Writing | **Checked** reported voice lines/heading labels, exact source errors, retained-observation explanations, cache/backoff labels, non-guaranteed/unofficial estimates and external-source limitations. | Official badge/identity text remains API content; it is not editorially rewritten. |
| Typography | **Checked** existing six token sizes, real local font weights, 16px mobile fields, tabular numbers, full identity/code wrapping. Probe finds two families and three weights. | Existing small local TTF files are retained; no format migration was needed for this revision. Native text enlargement untested. |
| Colors | **Checked** control-boundary pairs and probe-measurable text contrast. Supporting pulse text was changed to muted after measuring the LED-dot worst case: muted/dot **5.36:1**, versus subtle/dot 4.37:1. Input boundary/fill **6.96:1**. | Probe skips 28 text boxes over images/gradients; pulse token extrema were checked separately. No blanket accessibility certification. |
| UI details | **Checked** shared LED identity, removed competing ornament, existing flat surfaces, pending/error/retry states, persistent movement, consistent buttons, reduced motion and local share assets. Probe finds no nested raised cards, border+shadow stacks, or infinite animations. | No wallet, modal, theme switch, payments or destructive flows exist; these are **Not applicable**. |

[review-mobile.png](review-mobile.png) is the real independent-origin Board first screen at 390×844; [review-desktop.png](review-desktop.png) is the final desktop Board from the pinned probe. Both were visually inspected. Further temporary screenshots included About, page-two leaderboard, real allowed-origin profiles/checklist, focused submit and simulated outage/stale/countdown/fallback states; those scratch files are deliberately not submission assets.

## Remaining limits and delivery

**Complete for the reported revision scope.** The official profile CORS restriction, missing community Genesis state and unconfigured launch remain external integration limits, documented in [api-audit.md](api-audit.md). Earned ownership and official movement cannot be retrieved by independent static origins until the API owner enables those reads. The app preserves everything its other validated sources can actually establish and never substitutes sample ownership.

The supplied browser connector failed to launch because of its temporary socket path; standalone Playwright Chromium Headless Shell succeeded and performed the reported checks. WebKit installation succeeded but launch failed with missing host libraries (including GTK4, Graphene and multimedia libraries), so **WebKit/Safari checks are unperformed**, not passed. No user input or runtime proxy was introduced to conceal that limit.

`dist/index.html` and its complete local assets are included with source and the unchanged lockfile. Old hashed production assets were removed by the final Vite build. Documentation, aggregate research evidence and review screenshots are required evidence, not runtime member caches. Excluded scratch/dependency/browser/cache directories and archives are not part of the Git candidate list. No `.git/`, `.github/`, `.env` or existing dependency tree was edited; no submodule or publication command was used. Hosting/public repository publication remains with the contributor delivery pipeline.

The final size audit is in `submission-size.json`; it counts the entire Git candidate tree (excluding removed files and assignment inputs), a conservative upper bound on additions, against 8,388,608 bytes. Required artifacts have a 512 KiB path budget and `.imd-responses.json` a 32 KiB budget. These paths are explicitly included even in the presence of inherited ignore rules.
