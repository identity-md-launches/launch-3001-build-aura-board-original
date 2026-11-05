# Public API audit — revision, 2026-11-05

Direct GETs were repeated at 16:23:59 UTC against the official public URLs, with `Origin: http://127.0.0.1:5173`. Responses were inspected before changing the existing integration. Subsequent production-browser checks made their own live reads; recorded values here are audit observations, not runtime fallback data.

| Source | HTTP / observed schema | Cross-origin observation |
| --- | --- | --- |
| `https://community.squeekchain.com/v1/community/stats` | 200; `members`, `badgesEarned`, `projectsVerified`, `totalAura`, `snapshot.members/computedAt` | `Access-Control-Allow-Origin: *` |
| `https://community.squeekchain.com/v1/community/leaderboard` | 200; `entries[].rank/code/identity/aura/badges/tier`, `snapshot`, `generatedAt`; 100 entries | `Access-Control-Allow-Origin: *` |
| `https://community.squeekchain.com/v1/community/profiles/jxghsp2j` | 200; `code`, `valid`, `identity`, `standing.rank/aura/tier/next/movement`, `completedReferrals`, `inviteeColors`, `achievements`, `snapshot` | No allow-origin header for the independent origin. A second GET with the official site Origin returned `Access-Control-Allow-Origin: https://sepolia.squeekchain.com`. |
| `https://community.squeekchain.com/v1/community/aura/badges` | 200; `badges`, `snapshot`; 35 badges. Fields used: ID, lane, title, instruction, criteria, trophy, rarity and eligibility snapshot. | `Access-Control-Allow-Origin: *` |
| `https://community.squeekchain.com/v1/community/genesis/activity` | 200; `events`, `nextBefore`; 50 events. Event member, kind, time and optional achievement are used. | `Access-Control-Allow-Origin: *` |
| `https://community.squeekchain.com/v1/community/genesis/state` | 404; `{"error":"not_found"}` | No independent-origin allow-origin header; Chromium therefore reports a browser/network/CORS failure rather than exposing the HTTP body/status. |
| `https://api.squeekchain.com/v1/genesis-launch` | 200; `{"schemaVersion":3,"status":"unavailable","reason":"launch_unconfigured"}` | `Access-Control-Allow-Origin: *` |
| `https://sepolia.squeekchain.com/genesis` | 302 followed to HTML, HTTP 200; official Squeekchain title and public-client asset reference | The referenced `/assets/index-CTPMeMZJ.js` returned 404 on the revision machine. The previously implemented v3 available-state parser is preserved; only the real unavailable state was observed live in this revision. |

At the audit observation, the common source snapshot was `2026-11-05T16:09:23.811Z`, about 14 minutes before receipt. The top entry was code `jxghsp2j`, rank 1, aura 6,617, tier gold, 12 badges. Later browser reads returned aura 6,618 from a newer snapshot. Tests compare the current row with its detail rather than hard-coding either value.

The independent-origin browser lookup was actually exercised at desktop and mobile widths. Its blocked profile does not hide the already validated leaderboard standing: the Board shows that row's aura, tier, rank and badge count with leaderboard timestamps. Movement says “Not available here.” The fetched catalog remains a catalog, with no invented ownership or earned checklist. The exact read failure and official profile link remain available. A separate, test-only allowed-origin static harness loaded real profiles and exercised the fetched earned/in-progress join; this is not evidence that independent hosting can read profiles.

The missing community state route and unconfigured launch state remain visible availability messages. Active-phase countdown behavior was tested with an explicitly simulated v3 response; no real active phase was observed or claimed. Unlocking independent-host earned badges and movement requires the API owner to allow browser cross-origin profile GETs. No proxy or CORS-bypass service was added to the app.

The revision sampler fetched each selected public profile once, with two workers, and regenerated the dated model plus `fit-record.json`. See the README and that record for the actual fit time, source snapshot, sample size, objective, error and aggregate inputs. Raw profiles and identities are not shipped as a cache.
