# Aura Board design system

## Overview

Aura Board is a read-only Genesis progress tool for the Squeekchain community. A warm charcoal interface, seed-yellow action, quiet LED dots and an original dot-matrix hamster carry its visual identity. The lookup is the first action, with a direct leaderboard link in its hint; status, member observations and requirements follow. This is a working community board rather than a marketing landing page.

The source of truth is `src/style.css`, with markup/patterns in `src/main.ts` and the shared shell in `index.html`. The aesthetic is deliberately dark only. There is no theme selector, wallet UI or modal system.

## Colors

All interface roles are declared in `src/style.css:5` using sRGB hex values.

| Token | Value | Role |
| --- | --- | --- |
| `--color-bg` | `#101311` | Page and flat content background |
| `--color-surface` | `#171c18` | Pulse, fields, sidebar and neutral icon fills |
| `--color-hover` | `#242c24` | Selected filters and interactive hover fill |
| `--color-border` | `#354035` | Structural dividers and card outlines |
| `--color-text` | `#f1f3e8` | Primary text |
| `--color-muted` | `#b0b9ac` | Supporting prose and labels |
| `--color-subtle` | `#9da894` | Observation times, hints, minor data and interactive control boundaries |
| `--color-accent` | `#e8dc79` | Primary action fill, brand/art accents |
| `--color-accent-hover` | `#f6eba0` | Primary action hover |
| `--color-on-accent` | `#202515` | Text on the filled primary action |
| `--color-focus` | `#f6eba0` | Keyboard outline |
| `--color-good` | `#a4d6a3` | Earned/positive movement, with text/icon cues |
| `--color-warning` | `#ecc08b` | Unavailable, delayed and uncertain observations |
| `--color-negative` | `#f3a5a0` | Field error and negative rank movement |
| `--color-gold`, `--color-silver`, `--color-bronze` | `#e8cf87`, `#c6d1d2`, `#dfa988` | Tier text and diamond marks |

Measured declared solid pairs (rechecked during revision for the changed input boundary): primary text/page 16.67:1, muted/surface 8.54:1, subtle/surface 6.96:1, primary-button text/fill 11.18:1, warning/surface 10.26:1, focus/page 15.41:1. The production probe also measures rendered text/background pairs. The input boundary uses `--color-subtle`: 6.96:1 against its surface fill and 7.53:1 against the page, replacing the 1.59:1 structural border. Pulse minor text uses `--color-muted`, at least 5.36:1 against the brightest LED dot (`--color-border`); the probe skips image/gradient-backed text, so this worst-case pair was measured separately. These measurements do not substitute for native forced-color or screen-reader testing.

## Typography

Locally bundled Space Grotesk uses real 400, 500 and 600 TTF files in `public/`, with Arial/sans-serif fallback. `@font-face` declarations are in `src/style.css:1`. Interface prose uses 400; headings/actions/member names use 500; strong emphasis and the brand use 600. Code, invite codes, the equation and checksum use system monospace only.

One six-step type scale: 13, 14, 16, 20, 32 and 48 px (`--text-xs` through `--text-display`). Body is 16/1.5; long methodology prose uses 1.75 line height. Dense requirement copy is 14/1.6, hints 13/1.6. The Board title is 48/1.12 desktop and 32/1.15 mobile; other page titles are 32. Section headings are 20, card headings 16. The current aura may use 48, including mobile.

Display tracking is -0.055em desktop and -0.04em at 32 px; section headings use -0.025em. Normal content is untracked, sentence case, left/start aligned. Numbers use tabular figures. Paragraphs use `text-wrap: pretty`; headings use `balance`. Names and identifiers wrap rather than being ellipsized, and mixed-direction identities use `<bdi>`. Mobile inputs remain 16 px to avoid iOS input zoom.

## Layout

The `.wrap` primitive has a 1240 px maximum and desktop inline margins of 48 px, becoming 32 px below 1120, 20 px below 660, and 16 px below 360. Spacing tokens are 4, 8, 12, 16, 20, 24, 32, 40, 48 and 64 px. Controls are grouped more tightly than sections; shared leading edges align the shell, pulse, lookup and content.

The Board's desktop grid has a flexible main column, a 312 px community sidebar and a 48 px gap. Below 1120 the sidebar becomes 285 px with a 32 px gap; below 880 it is 260 px with a 28 px gap. At 660 and below the content stacks before the sidebar and decorative hamster art is removed. Badge cards use two columns at wide desktop, one at intermediate widths. A selected profile uses separate earned/in-progress columns on wide desktop; they stack on narrower screens.

The pulse becomes two rows below 880, and a compact three-counter strip below 660. Observation/source times for counts remain visible in a line under the pulse on all widths; the phase observation/source line and any active countdown also stay visible on mobile. Availability details open by default, list all core-source problems plus the selected profile, and retain full observation dates/times.

At 660 and below navigation moves to a second header row; the lookup remains on the first 390 px screen. The leaderboard uses an ordered list of linked rows with a desktop visual header and screen-reader labels per value. Mobile rearranges member/tier and aura/movement into two rows; badges remain available in the member detail. Tablet movement remains visible. About's summary panel moves ahead of its prose below 880. No fixed navigation or floating control overlays content.

Production reflow was checked at 320, 390, 760 and 1440 CSS px. Native 200% browser zoom and physical-device Safari are unverified; see the validation report.

## Elevation & Depth

The interface is flat: no box shadows, backdrop blurs, gradient text or raised card stacks. Surface tone distinguishes fields, the pulse and community sidebar. Borders communicate structure and focus. The 12 px LED dot grid belongs to the shared `.pulse-shell`, so Board, Leaderboard and About retain the visual identity on phones too. The hamster area contains only the centred local dot-matrix hamster; orbit lines, decorative points and the caption were removed. The hamster is `aria-hidden` and never intercepts an action.

## Shapes

Action/input radius is 7 px. Badge cards, filter groups and sidebar surfaces use 8 px, inner filter buttons 5 px. Identity and badge symbols are circular. Cards have a single structural border and no shadow. The dot hamster and favicon are local SVG assets; the 1200×630 share card is a local PNG. Art colors are separate illustrative values, not new interface status tokens.

## Components

| Component / source symbol in `src/main.ts` | Use and states |
| --- | --- |
| `lookup()` / `#lookup-form` | Labelled code input, adjacent verb-first submit, inline `aria-invalid` error and hint. An explicit lookup pending for the selected code disables submit with “Finding…”; background polling keeps the action enabled and preserves its focus. Codes normalize to lowercase only on submit; paste is allowed. |
| `renderPulse()` | Shared counts and independently observed launch state. Connected/delayed/unavailable have text as well as a status mark. Configured phase end time uses `countdown()`; an expired deadline waits for a new official state. |
| `sourceStamp()`, `issue()`, `dataHealth()` | Per-section observation/source time, persistent last-known observations, scoped failure notices and a native availability disclosure, open by default. Cache/backoff states give Retry and Refresh their next eligible UTC time. No successful refresh overwrites a failed section with sample data. |
| `profileView()` | Identity, official aura/rank/tier/movement/badge count. Invalid, loading, CORS and refresh-failed states are explicit. When a profile is unreadable, the same summary markup shows any validated leaderboard entry with its own timestamps and explicit unavailable movement. It does not infer earned badge IDs. The official-site link remains the recovery path for the profile read; a background retry leaves the error and summary visible. |
| `badgeCard()` / `.requirements` | API title/instruction/criteria and badge ownership. Native `<details>` gives keyboard-operable requirements; all aura estimates are labelled unofficial. Trophy, sparse sample, unseen and inseparable estimates have distinct text. |
| `checklist()` / `.segmented` | All/Community/Builder/Holder buttons use `aria-pressed`. Earned and in-progress lists join live profile IDs with the fetched catalog; unknown earned IDs receive a missing-requirements notice. |
| `nextSteps()` | Potential non-holder next steps ranked by unofficial contribution. Eligibility limits remain visible; no completion percentages or private eligibility are invented. |
| `memberLink()`, `rankMovement()` | Real profile anchors support keyboard and new-tab navigation. Tier labels supplement color. Arrows compare distinct source snapshots seen in this tab and persist through identical polling responses; unknown history is explicitly unknown. |
| `leaderboardView()` | Labelled live search, top-100 scope, empty/reset state and 20-row paging. At the first/last page, keyboard focus moves to the other enabled pager button. The eight-character exact-code path opens a lookup. |
| `about()` | Method, sample, fit error, honesty rules, endpoint sources and a contribution/support list. |

Focus uses a 2 px outline, offset 5 px for links and 3 px for fields/buttons/summaries. The skip link targets main content; navigation indicates `aria-current`. `focusSelector()` and `replaceMain()` preserve keyboard focus and open requirements during resource refreshes. `revealResult()` announces and scrolls to a completed lookup when focus is still on the initiating flow; it does not interrupt a visitor who started another action. External new-tab links include an accessible cue. Touch controls generally reach 44–52 px; inline prose links use the native inline exception.

Hover and press feedback changes only named properties over 150 ms with `cubic-bezier(.2,0,0,1)`. Press scale is 0.96. All transitions exist only inside `prefers-reduced-motion: no-preference`; there is no autoplay or infinite animation. Forced-color styles use system focus and borders; that native mode was not manually reviewed.

## Do's and Don'ts

- Start a page inside `.wrap` with one `h1`, the shared shell and the existing six type sizes. Reuse `.section-heading`, `.primary`, `.secondary`, `.source-stamp` and `.notice`.
- Give one filled action primary emphasis. Keep tier, error and freshness status meanings consistent and repeat them in text.
- Render official facts only after validation. Keep a failed section's old timestamp; never label bundled estimator output as live member progress.
- Preserve requirements, complete invite codes and identities. Wrap them; do not clip critical data to make a row fit.
- Keep the hamster/dot treatment decorative and secondary. Do not introduce gradients, extra font families, nested raised cards, wallet controls or marketing sections into this read-only tool.
- For another page, add a hash route in `route()`, reuse the shared pulse and page heading, define any new live resource through `resource()`/`load()`, render its observation/error state, and validate reflow plus keyboard focus at mobile and desktop widths.
