import './style.css';
import model from './aura-model.json';
import { COMMUNITY, LAUNCH, allResources, freshness, isStale, load, missingSourceTime, resource, subscribe, type Resource } from './api';
import { isCode, parseActivity, parseCatalog, parseLaunch, parseLeaderboard, parseProfile, parseStats, type Badge, type Entry, type Identity, type Profile, type Tier } from './schema';

const stats = resource('stats','Community stats',`${COMMUNITY}/stats`,parseStats);
const leaderboard = resource('leaderboard','Leaderboard',`${COMMUNITY}/leaderboard`,parseLeaderboard);
const catalog = resource('catalog','Badge catalog',`${COMMUNITY}/aura/badges`,parseCatalog);
const activity = resource('activity','Genesis activity',`${COMMUNITY}/genesis/activity`,parseActivity);
const officialState = resource('state','Genesis state',`${COMMUNITY}/genesis/state`,parseLaunch);
const launch = resource('launch','Official launch state',LAUNCH,parseLaunch);
const core = [stats,leaderboard,catalog,activity,officialState,launch];
type Page = 'board' | 'leaderboard' | 'about';
let page: Page = 'board', selected = '', input = '', inputError = '', query = '', boardPage = 0, lane = 'all';
let previousRanks = new Map<string,number>(), observedRanks = new Map<string,number>(), rankObservedAt: number | undefined, previousRankTime: number | undefined;
const PAGE_SIZE = 20;
let resultToReveal = '';
const main = document.querySelector<HTMLElement>('#main')!;
const pulse = document.querySelector<HTMLElement>('#pulse')!;
const announcer = document.querySelector<HTMLElement>('#announcement')!;
const escape = (v: unknown): string => String(v ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const n = (v: number): string => v.toLocaleString('en-US');
const clock = (v?: number | string): string => v === undefined ? 'not observed' : `${new Date(v).toISOString().slice(11,19)} UTC`;
const fullDate = (v: number | string): string => `${new Date(v).toISOString().slice(0,10)} ${clock(v)}`;
const name = (i: Identity | null, fallback: string): string => i?.username ? `@${i.username}` : i?.alias || fallback;
const icon = (kind: string,size = 20): string => {
  const paths: Record<string,string> = {
    arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>', search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
    badge:'<path d="m12 2 3 3 4 1 1 4 2 3-3 3-1 4-4 1-3 1-3-3-4-1-1-4-1-3 3-3 1-4 4-1Z"/><path d="m8 12 3 3 5-6"/>',
    sparkle:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/>',
    code:'<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-14-2 16"/>', users:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v3"/>',
    check:'<path d="m5 12 4 4L19 6"/>', external:'<path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7"/>',
    refresh:'<path d="M20 7a9 9 0 1 0 1 8M20 3v5h-5"/>', info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>', lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2"/>'
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[kind] ?? paths.badge}</svg>`;
};
const tiers = (t: Tier): string => t ? `<span class="tier ${t}"><span aria-hidden="true">◆</span> ${t[0].toUpperCase()+t.slice(1)}</span>` : '<span class="muted">Unranked</span>';
const sourceStamp = <T>(r: Resource<T>): string => r.state.data ? `<p class="source-stamp ${isStale(r.state) ? 'delayed' : ''}"><span class="status-dot" aria-hidden="true"></span>${escape(r.label)} · ${escape(freshness(r))} · fetched <time datetime="${new Date(r.state.observedAt!).toISOString()}">${clock(r.state.observedAt)}</time>${r.state.sourceAt ? ` · source <time datetime="${escape(r.state.sourceAt)}">${clock(r.state.sourceAt)}</time>` : ''}</p>` : '';
function issue<T>(r: Resource<T>,compact = false): string {
  if (r.state.error) return `<div class="notice ${compact ? 'compact' : ''}" role="status">${icon('info')}<div><strong>${escape(r.label)} ${r.state.data ? 'refresh unavailable' : 'unavailable'}</strong><p>${escape(r.state.error)}${r.state.data ? ` Showing the observation from ${fullDate(r.state.observedAt!)}.` : ''}</p></div><button class="text-button" data-action="retry" data-key="${escape(r.key)}">Retry</button></div>`;
  if (isStale(r.state)) return `<div class="notice compact" role="status">${icon('info')}<p><strong>${escape(r.label)} is delayed.</strong> ${missingSourceTime(r.state) ? 'The API supplied no source snapshot time; freshness cannot be confirmed.' : r.state.sourceAt ? `${escape(r.label)} source snapshot is from ${fullDate(r.state.sourceAt)}${Date.parse(r.state.sourceAt)>Date.now()+60_000 ? ' (in the future)' : ''}.` : `The last response was observed at ${fullDate(r.state.observedAt!)}.`} Values remain visible as a dated observation.</p></div>`;
  return '';
}
// Capture the requested code, so rapid navigation cannot attach one member's response to another.
function profileFor(code: string): Resource<Profile> { return resource(`profile:${code}`,`Member ${code}`,`${COMMUNITY}/profiles/${code}`,v => { const p = parseProfile(v); if (p.code!==code) throw new Error('Official profile code did not match the requested member.'); return p; }); }
const coefficient = (id: string) => Object.hasOwn(model.coefficients,id) ? (model.coefficients as Record<string,{value: number | null; support: number; inseparable: string[]; trophy?: boolean}>)[id] : undefined;
function estimate(b: Badge): string {
  const c = coefficient(b.id);
  if (b.trophy) return '<span class="estimate muted">Trophy · no aura, per official criteria</span>';
  if (!c || c.value === null) return '<span class="estimate muted">Unofficial estimate unavailable · no sample</span>';
  return `<span class="estimate">≈${n(Math.round(c.value))} aura <span>· unofficial estimate</span></span>${c.inseparable.length ? '<span class="estimate-caution">Co-earned badges; individual share is uncertain</span>' : c.support<3 ? `<span class="estimate-caution">Low support: ${c.support} sampled member${c.support===1?'':'s'}</span>` : ''}`;
}
function badgeCard(b: Badge, earned?: boolean, p?: Profile): string {
  const holding = p?.achievements.find(a => a.id === b.id);
  return `<article class="badge-card ${earned === true ? 'earned' : ''}">
    <div class="badge-heading"><div class="badge-symbol ${b.lane}">${icon(earned ? 'check' : b.lane==='code' ? 'code' : b.lane==='holder' ? 'sparkle' : 'badge',22)}</div><div><h3>${escape(b.title)}</h3><p class="badge-meta">${earned===true ? 'Earned' : earned===false ? 'In progress' : b.lane==='code' ? 'Builder badge' : b.lane==='holder' ? 'Holder badge' : 'Community badge'}${holding?.active===false?' · holder activation inactive':''}${b.rarity ? ` · ${n(b.rarity.holders)} holders` : ''}</p></div></div>
    <p class="requirement">${escape(b.instruction)}</p>${estimate(b)}
    <details class="requirements" data-detail="${escape(b.id)}"><summary>Official requirements <span aria-hidden="true">+</span></summary><ul>${b.criteria.map(c => `<li>${escape(c.label)}${c.detail ? `<p>${escape(c.detail)}</p>` : ''}</li>`).join('')}</ul>${b.snapshotAt ? `<p>Eligibility snapshot: ${escape(b.snapshotAt.slice(0,10))}.</p>` : ''}</details>
  </article>`;
}
function sortBadges(a: Badge,b: Badge): number { return (coefficient(b.id)?.value ?? -1) - (coefficient(a.id)?.value ?? -1) || a.id.localeCompare(b.id); }
function rankMovement(code: string,rank: number): string {
  const old = previousRanks.get(code); const movement = old===undefined ? null : old-rank;
  return movement===null ? '<span class="movement unknown" aria-label="Movement unavailable: no earlier observation">No history</span>' : movement===0 ? '<span class="movement muted" aria-label="No rank change since earlier observation">↔ 0</span>' : `<span class="movement ${movement>0?'up':'down'}" aria-label="${movement>0?'Up':'Down'} ${Math.abs(movement)} places since earlier observation">${movement>0?'↑':'↓'} ${n(Math.abs(movement))}</span>`;
}
function memberLink(e: Entry,mini = false): string {
  return `<a class="member-row ${mini?'mini':''}" href="#/board/${escape(e.code)}"><span class="row-rank ${e.rank<=3?'podium':''}"><span class="sr-only">Rank </span>${String(e.rank).padStart(2,'0')}</span><span class="member-name"><bdi>${escape(name(e.identity,e.code))}</bdi><code>${escape(e.code)}</code></span>${!mini?`<span><span class="sr-only">Tier </span>${tiers(e.tier)}</span><span class="badge-count"><span class="sr-only">Badges </span>${n(e.badges)} <span class="mobile-label">badges</span></span>`:''}<span class="row-aura"><span class="sr-only">Aura </span>${n(e.aura)}${mini?'<span>aura</span>':''}</span>${!mini?rankMovement(e.code,e.rank):`<span class="row-open" aria-hidden="true">↗</span>`}</a>`;
}
function renderPulse(): void {
  const s = stats.state.data, phase = officialState.state.data ?? launch.state.data;
  const phaseResource = officialState.state.data ? officialState : launch;
  const phaseText = phase?.status==='available' ? (phase.phase ?? '').replace(/_/g,' ') : phase?.reason==='launch_unconfigured' ? 'Launch not configured' : phase?.reason ? phase.reason.replace(/_/g,' ') : 'Phase unavailable';
  const html = `<div class="pulse wrap"><div class="pulse-name"><span class="signal" aria-hidden="true">${icon('sparkle',18)}</span><span>Genesis pulse<span class="pulse-state">${s ? isStale(stats.state)?'Source delayed':'API connected' : stats.state.pending?'Connecting…':'Stats unavailable'}</span></span></div><dl class="pulse-numbers"><div><dt>Members</dt><dd>${s?n(s.members):'…'}</dd></div><div><dt>Badges earned</dt><dd>${s?n(s.badgesEarned):'…'}</dd></div><div><dt>Projects verified</dt><dd>${s?n(s.projectsVerified):'…'}</dd></div></dl><div class="phase"><span class="phase-label">Launch phase</span><strong>${escape(phaseText)}${phase?.status==='available' && isStale(phaseResource.state)?' · last observed':''}</strong>${phase?.status==='available' && phase.endsAt ? `<span data-countdown="${phase.endsAt}">${countdown(phase.endsAt)}</span>` : `<span>${phaseResource.state.observedAt ? `Observed ${clock(phaseResource.state.observedAt)}` : 'Reading official state'}</span>`}</div></div>`;
  if (pulse.innerHTML!==html) pulse.innerHTML=html;
}
function countdown(end: number): string {
  const seconds = Math.max(0,Math.floor((end-Date.now())/1000));
  if (!seconds) return 'Phase end reached; awaiting official update';
  const d = Math.floor(seconds/86400), h = Math.floor(seconds%86400/3600), m = Math.floor(seconds%3600/60), s=seconds%60;
  return `${d?`${d}d `:''}${h}h ${m}m ${s}s remaining`;
}
function lookup(): string {
  const r = selected ? profileFor(selected) : undefined;
  return `<section class="lookup-band" aria-labelledby="board-title"><div class="lookup-content"><h1 id="board-title">Track your Genesis progress<span class="title-dot">.</span></h1><p class="lead">A little more aura. One badge at a time.</p><form id="lookup-form" novalidate><label for="invite-code">Genesis invite code</label><div class="lookup-controls"><div class="input-wrap">${icon('search')}<input id="invite-code" data-focus="invite-code" name="invite-code" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="8" placeholder="8-character code" value="${escape(input)}" aria-describedby="code-hint${inputError?' code-error':''}" ${inputError?'aria-invalid="true"':''} /></div><button class="primary" type="submit" ${r?.state.pending?'disabled':''}>${r?.state.pending?'Finding…':'Find member'} ${icon('arrow')}</button></div><p id="code-hint" class="field-hint">Use a public invite code or choose a member below.</p>${inputError?`<p class="field-error" id="code-error">${escape(inputError)}</p>`:''}</form></div><div class="hamster-art" aria-hidden="true"><span class="orbit orbit-a"></span><span class="orbit orbit-b"></span><span class="art-point one"></span><span class="art-point two"></span><img src="./hamster.svg" width="248" height="224" alt="" /><span class="art-caption">Every squeek counts.</span></div></section>`;
}
function dataHealth(): string {
  const problems: string[] = [];
  if (stats.state.error) problems.push(`Community stats: ${stats.state.error}`);
  else if (isStale(stats.state)) problems.push(`Community stats source snapshot: ${fullDate(stats.state.sourceAt ?? stats.state.observedAt!)}. Counts are dated observations.`);
  if (officialState.state.error) problems.push(`Requested Genesis state route: ${officialState.state.error}`);
  if (launch.state.data?.status==='unavailable') problems.push(`Official launch API reports ${launch.state.data.reason}, observed ${fullDate(launch.state.observedAt!)}. A phase or countdown cannot be confirmed.`);
  if (launch.state.error) problems.push(`Official launch state: ${launch.state.error}`);
  else if (launch.state.data?.status==='available' && isStale(launch.state)) problems.push(`Official launch phase is a dated observation from ${fullDate(launch.state.sourceAt ?? launch.state.observedAt!)}. The current phase cannot be confirmed.`);
  if (!problems.length) return '';
  return `<details class="health"><summary>${icon('info',18)} ${stats.state.error?(stats.state.data?'Stats refresh unavailable':'Community stats unavailable'):launch.state.data?.status==='unavailable'?'Genesis phase unavailable':'Partial community data'} <span class="health-summary">View availability &amp; observation times</span><span class="detail-plus" aria-hidden="true">+</span></summary><ul>${problems.map(p=>`<li>${escape(p)}</li>`).join('')}</ul>${sourceStamp(stats)}<button class="text-button" data-action="refresh">Refresh available sections ${icon('refresh',16)}</button></details>`;
}
function profileView(r: Resource<Profile>): string {
  const p = r.state.data;
  if (!p) return `${issue(r)}${r.state.pending?`<section class="waiting" aria-busy="true"><span class="loading-dots" aria-hidden="true">● ● ●</span><h2>Reading ${escape(selected)}</h2><p>Fetching this member’s public standing and earned badges.</p></section>`:`<section class="unavailable-profile"><h2>Member details cannot be read here</h2><p>This browser could not read the official profile response. On 2026-11-05 the endpoint was verified with access restricted to the official site origin. Aura, tier, rank, movement and earned badges are unavailable for this lookup. The live leaderboard, catalog and activity remain accessible.</p><a class="secondary" href="https://sepolia.squeekchain.com/genesis/${escape(selected)}" target="_blank" rel="noopener noreferrer">Open ${escape(selected)} on the official site ${icon('external',16)}<span class="sr-only"> (opens in a new tab)</span></a></section>`}`;
  if (!p.valid) return `${issue(r)}<section class="empty"><h2>No Genesis member for ${escape(p.code)}</h2><p>Check the 8-character invite code, or choose a member from the leaderboard.</p><a class="secondary" href="#/leaderboard">Browse leaderboard ${icon('arrow',16)}</a>${sourceStamp(r)}</section>`;
  const s = p.standing, movement = s.movement;
  return `${issue(r)}<section class="profile-summary" aria-labelledby="member-heading"><div class="profile-identity"><span class="identity-icon" aria-hidden="true">${icon('badge',28)}</span><div><h2 id="member-heading"><bdi>${escape(name(p.identity,p.code))}</bdi></h2><div class="profile-code"><code>${escape(p.code)}</code><button class="copy-button" data-action="copy" data-code="${escape(p.code)}" aria-label="Copy profile link for ${escape(p.code)}">Copy link ${icon('external',14)}</button></div></div>${tiers(s.tier)}</div><dl class="profile-numbers"><div class="aura-number"><dt>Current aura</dt><dd>${n(s.aura)}<span class="aura-spark" aria-hidden="true">✧</span></dd></div><div><dt>Community rank</dt><dd>${s.rank===null?'Unranked':`#${n(s.rank)}`}</dd></div><div><dt>Official movement</dt><dd class="${movement!==null&&movement>0?'up':movement!==null&&movement<0?'down':''}">${movement===null?'Not provided':movement===0?'↔ 0':`${movement>0?'↑':'↓'} ${n(Math.abs(movement))}`}</dd></div><div><dt>Badges earned</dt><dd>${n(p.achievements.length)}</dd></div></dl>${sourceStamp(r)}</section>${nextSteps(p)}`;
}
function nextSteps(p: Profile): string {
  const earned = new Set(p.achievements.map(a=>a.id));
  if (!catalog.state.data) return '';
  const best = catalog.state.data.badges.filter(b => {
    if (earned.has(b.id) || b.trophy) return false;
    if (b.id==='clout.early_squeek' && (b.rarity?.holders??0)>=888) return false;
    if (b.id==='clout.early_invitooor' && (b.rarity?.holders??0)>=88) return false;
    if (b.id==='code.early_buildooooor' && (b.rarity?.holders??0)>=88) return false;
    // Snapshot ownership cannot be inferred from public profiles. Do not call holder badges achievable.
    if (b.lane==='holder') return false;
    return true;
  }).sort(sortBadges).slice(0,3);
  return `<section class="next-section"><div class="section-heading"><div><h2>What to earn next</h2><p>Potential next steps, ordered by unofficial estimated aura. Eligibility still applies.</p></div><a class="inline-link" href="#/about">How we estimate ${icon('arrow',16)}</a></div>${best.length?`<div class="next-grid">${best.map((b,i)=>`<article class="next-item"><span class="next-index">0${i+1}</span><div><h3>${escape(b.title)}</h3><p>${escape(b.instruction)}</p>${estimate(b)}<a class="inline-link" href="https://sepolia.squeekchain.com/genesis/${escape(p.code)}" target="_blank" rel="noopener noreferrer">Check eligibility on Squeekchain ${icon('external',14)}<span class="sr-only"> (opens in a new tab)</span></a></div></article>`).join('')}</div>`:'<p class="empty-line">No further broadly actionable badges are listed. Review snapshot eligibility in the full checklist.</p>'}<p class="fine-print">Public profiles do not expose task-by-task progress. These suggestions are not a guarantee of eligibility or extra aura.</p></section>`;
}
function checklist(p?: Profile): string {
  const r = catalog;
  if (!r.state.data) return `<section class="catalog-section"><h2>Official badge checklist</h2>${issue(r)}${r.state.pending?'<p class="loading-line">Fetching the official badge catalog…</p>':''}</section>`;
  const all = r.state.data.badges, earnedIds = new Set(p?.achievements.map(a=>a.id) ?? []);
  const filtered = all.filter(b=>lane==='all'||b.lane===lane).sort(sortBadges);
  const earned = filtered.filter(b=>earnedIds.has(b.id)), progress=filtered.filter(b=>!earnedIds.has(b.id));
  const unknown = p?.achievements.filter(a=>!all.some(b=>a.id===b.id)) ?? [];
  return `<section class="catalog-section" aria-labelledby="checklist-title"><div class="section-heading"><div><h2 id="checklist-title">${p?'Your badge checklist':'Explore the badge checklist'}</h2><p>${p?`${p.achievements.length} earned · ${all.filter(b=>!earnedIds.has(b.id)).length} in progress`:`${all.length} badges, fetched from the official catalog`}</p></div><span class="section-icon" aria-hidden="true">${icon('badge',24)}</span></div>
    <div class="checklist-controls"><div class="segmented" role="group" aria-label="Filter badges by category">${[['all','All badges'],['clout','Community'],['code','Builder'],['holder','Holder']].map(([v,l])=>`<button data-action="lane" data-lane="${v}" aria-pressed="${lane===v}" class="${lane===v?'selected':''}">${l}</button>`).join('')}</div><span class="sort-note">By unofficial estimated aura ↓</span></div>
    ${issue(r,true)}${sourceStamp(r)}<p class="fine-print estimate-note">Aura contributions are unofficial community-derived estimates. <a href="#/about">See the ${model.sampleSize}-profile fit (${model.fittedAt.slice(0,10)}) and its limitations.</a>${p?' “In progress” means not earned; the API does not report individual task completion.':''}</p>
    ${unknown.length?`<div class="notice compact"><p>${unknown.length} earned badge${unknown.length===1?' is':'s are'} missing from the current official catalog. Requirements and estimates are unavailable: ${unknown.map(a=>escape(a.title)).join(', ')}.</p></div>`:''}
    ${p?`<div class="checklist-columns"><section><h3 class="list-heading">${icon('check',18)} Earned <span>${earned.length}</span></h3><div class="badge-list">${earned.length?earned.map(b=>badgeCard(b,true,p)).join(''):'<p class="empty-line">No earned badges in this category.</p>'}</div></section><section><h3 class="list-heading">${icon('lock',18)} In progress <span>${progress.length}</span></h3><div class="badge-list">${progress.length?progress.map(b=>badgeCard(b,false,p)).join(''):'<p class="empty-line">Every badge in this category is earned.</p>'}</div></section></div>`:`<div class="catalog-grid">${filtered.map(b=>badgeCard(b)).join('')}</div>`}
  </section>`;
}
function communitySide(): string {
  const entries = leaderboard.state.data?.entries.slice(0,5), events = activity.state.data?.events.slice(0,6);
  return `<aside class="community-side"><section class="community-leaders"><div class="section-heading"><h2>Leading the squeek</h2><span aria-hidden="true">↗</span></div><p class="section-caption">Choose a member to explore their progress.</p>${issue(leaderboard,true)}${entries?.length?`<div class="mini-leaders">${entries.map(e=>memberLink(e,true)).join('')}</div>`:leaderboard.state.pending?'<p class="loading-line">Fetching the leaderboard…</p>':'<p class="empty-line">No published members available.</p>'}${sourceStamp(leaderboard)}<a class="secondary full-width" href="#/leaderboard">View leaderboard ${icon('arrow',16)}</a></section><section class="activity-section"><div class="section-heading"><h2>In the burrow</h2><span class="activity-status"><span class="status-dot" aria-hidden="true"></span>Activity</span></div>${issue(activity,true)}${events?.length?`<ol class="activity-list">${events.map(e=>`<li><span class="activity-node" aria-hidden="true"></span><div><a href="#/board/${escape(e.member.code)}"><bdi>${escape(name(e.member.identity,e.member.code))}</bdi></a><p>${e.kind==='badge_earned'?`earned ${escape(e.achievement?.title ?? 'a badge')}`:e.kind==='member_joined'?'joined Genesis':e.kind==='invite_completed'?'welcomed a new member':escape(e.kind.replace(/_/g,' '))}</p><time datetime="${escape(e.at)}">${clock(e.at)}</time></div></li>`).join('')}</ol>`:activity.state.pending?'<p class="loading-line">Reading Genesis activity…</p>':'<p class="empty-line">No activity in the current API response.</p>'}${sourceStamp(activity)}</section><div class="numbers-note">${icon('info',20)}<p>Official progress. Unofficial insights.<br /><a href="#/about">About the numbers ${icon('arrow',14)}</a></p></div></aside>`;
}
function board(): string {
  const r = selected ? profileFor(selected) : undefined, p = r?.state.data?.valid ? r.state.data : undefined;
  return `${lookup()}${dataHealth()}<div class="board-layout"><div class="board-content">${r?`<section id="member-result" tabindex="-1" aria-label="Lookup result for ${escape(selected)}">${profileView(r)}</section>`:`<section class="board-intro"><div class="intro-icon" aria-hidden="true">${icon('badge',26)}</div><div><h2>A place for every badge</h2><p>Find a member to see earned badges and potential next steps. Explore the official requirements below.</p></div></section>`}${checklist(p)}</div>${communitySide()}</div>`;
}
function leaderboardView(): string {
  const data = leaderboard.state.data;
  const filtered = data?.entries.filter(e=>`${e.code} ${name(e.identity,e.code)}`.toLowerCase().includes(query.toLowerCase().trim())) ?? [];
  const pages = Math.max(1,Math.ceil(filtered.length/PAGE_SIZE)); boardPage=Math.min(boardPage,pages-1);
  const rows = filtered.slice(boardPage*PAGE_SIZE,(boardPage+1)*PAGE_SIZE), exact = query.trim().toLowerCase();
  return `<section class="page-heading"><div><h1>The Genesis leaderboard<span class="title-dot">.</span></h1><p class="lead">Find your people. Follow their progress.</p></div><button class="secondary" data-action="refresh">Refresh ${icon('refresh',16)}</button></section><form class="leader-search" id="leader-search" role="search"><label for="leader-query">Search published members or look up an invite code</label><div class="lookup-controls"><div class="input-wrap">${icon('search')}<input id="leader-query" name="search" data-focus="leader-query" type="search" autocomplete="off" placeholder="Invite code or member name" value="${escape(query)}" /></div><button class="primary" type="submit">Find member ${icon('arrow',18)}</button></div><p class="field-hint">Name search covers the published top ${data?.entries.length ?? '100'}. An exact 8-character code opens a public profile.</p></form>${dataHealth()}${issue(leaderboard)}${sourceStamp(leaderboard)}<div class="leader-legend"><p>${data?n(data.entries.length):'…'} published members${query?` · ${filtered.length} matching “${escape(query)}”`:''}</p><div>${tiers('gold')}${tiers('silver')}${tiers('bronze')}</div></div><section class="leader-table" aria-label="Published Genesis rankings"><div class="leader-table-head" aria-hidden="true"><span>Rank</span><span>Member / invite code</span><span>Tier</span><span>Badges</span><span>Aura</span><span>Movement</span></div>${rows.length?`<ol class="leader-rows">${rows.map(e=>`<li>${memberLink(e)}</li>`).join('')}</ol>`:leaderboard.state.pending?'<p class="empty-line">Fetching the official leaderboard…</p>':`<div class="empty"><h2>${query?`No published match for “${escape(query)}”`:'No published members available'}</h2><p>${query?'Try a member name or an exact invite code.':'Retry when the official API is available.'}</p>${isCode(exact)?`<a class="secondary" href="#/board/${escape(exact)}">Look up ${escape(exact)} ${icon('arrow',16)}</a>`:''}${query?'<button class="text-button" data-action="clear-search">Clear search</button>':''}</div>`}</section><div class="pagination"><span>${filtered.length?`${boardPage*PAGE_SIZE+1}–${Math.min((boardPage+1)*PAGE_SIZE,filtered.length)} of ${filtered.length}`:'0 results'}</span><div><button class="secondary" data-action="prev" ${boardPage===0?'disabled':''}>← Previous</button><span>Page ${boardPage+1} of ${pages}</span><button class="secondary" data-action="next" ${boardPage>=pages-1?'disabled':''}>Next →</button></div></div><p class="fine-print movement-note">The API publishes its top ${data?.entries.length??100} members and exposes no server paging. Movement arrows compare ranks with the previous successful observation in this tab${previousRankTime?` (${clock(previousRankTime)})`:''}; “No history” means no comparison is available. Official profile movement appears on the Board.</p>`;
}
function about(): string {
  const rows = Object.entries(model.coefficients).sort((a,b)=>(b[1].value??-1)-(a[1].value??-1));
  return `<section class="about-intro page-heading"><div><h1>About the numbers<span class="title-dot">.</span></h1><p class="lead">Useful estimates. No secret formula claims.</p></div><div class="about-glyph" aria-hidden="true">${icon('sparkle',48)}</div></section><div class="about-layout"><article class="prose"><section><h2>Official progress, community interpretation</h2><p>Aura Board reads public Squeekchain APIs. Member aura, tier, rank, badge ownership and requirements come from those APIs. This is an independent community tool, with no wallet connection or sign-in.</p><p>Badge contribution estimates are <strong>unofficial community-derived estimates</strong>. They describe associations in a dated public sample. They are not official badge values, a causal explanation, or a promise of extra aura.</p></section><section><h2>How the estimates are fitted</h2><p>For each sampled public profile, one row records its total aura and a binary indicator for every non-trophy badge. An indicator is 1 when the badge appears in the profile’s achievements, including inactive holder achievements; otherwise it is 0.</p><p>The fit minimizes the squared difference between observed aura and the sum of badge contributions, with every contribution constrained to be non-negative:</p><div class="equation"><code>minimize ‖Xw − y‖², with w ≥ 0</code></div><p>There is no extra intercept and no regularization. Signed Up is an ordinary feature, so its coefficient also absorbs a shared baseline. Trophy columns are excluded because their official requirements explicitly say they add no aura.</p><p>The deterministic solver starts at zero and uses accelerated projected gradient descent. The step is the reciprocal of the largest absolute row sum of XᵀX. Features and profiles are sorted by ID/code; the stop condition is a maximum KKT violation below ${model.tolerance}. Values are rounded only for display.</p></section><section><h2>What went into this fit</h2><p>${escape(model.sampleSelection)}</p><p>The sample contains <strong>${model.sampleSize} valid profiles</strong>: ${model.leaderboardProfiles} leaderboard profiles and ${model.activityProfiles} additional recently active members. The fit was generated on <strong>${escape(fullDate(model.fittedAt))}</strong>. Its source snapshot${model.sourceSnapshots.length===1?' was':'s were'} ${model.sourceSnapshots.map(t=>escape(fullDate(t))).join(', ')}.</p><p>Training error is <strong>${Math.round(model.mae)} aura mean absolute error</strong> and <strong>${Math.round(model.rmse)} aura root mean squared error</strong>. These are in-sample errors; there is no independent holdout or claimed predictive accuracy. The solver converged after ${n(model.iterations)} iterations, with KKT violation ${model.kkt.toExponential(2)}.</p><p>The model is a dated research artifact bundled with this static site. It is not a cache of live member progress. Reproduce the sampler and fit with <code>npm run fit</code>; the repository contains aggregate fit evidence in <code>artifacts/fit-record.json</code>.</p></section><section><h2>What the model cannot tell you</h2><ul>${model.limitations.map(l=>`<li>${escape(l)}</li>`).join('')}<li>Badges always earned together cannot be separated from this sample. Their zero-start symmetric solution shares attribution equally; individual estimates are marked uncertain.</li><li>Support counts below three are marked as low support. No sampled holder means no estimate. A fitted zero does not establish an official zero.</li><li>Next steps exclude unearned holder badges because snapshot ownership is private, trophies, and early badges whose published allocation is already full. Remaining badges are ordered by estimated contribution; private eligibility and effort are not scored.</li></ul></section><section><h2>Freshness and honesty rules</h2><p>Every section has its own observation time and, when supplied, a source snapshot time. A source older than five minutes, a response older than one minute, a future timestamp, or any failed refresh is labelled delayed. This is Aura Board’s conservative display rule, not an official service-level guarantee.</p><p>Unavailable sections say what failed. A failed refresh preserves its last validated observation with the original timestamp. Unknown schemas are rejected. Nothing is seeded, fabricated, or silently replaced by sample profiles.</p><p>When verified on 2026-11-05, the public profile API limited browser access to the official site origin. On independent static hosting, member lookups can be blocked by CORS. Aura Board reports this and links to the official profile; it does not use a third-party proxy or a CORS bypass. The official catalog, leaderboard and activity remain readable.</p><p>On 2026-11-05, the requested community Genesis state endpoint returned 404. The launch endpoint used by the official site reports “launch_unconfigured”. No phase or countdown is invented. When the official v3 launch state is available, pending, whitelist and public phases use their configured end times for a human-readable countdown.</p></section><section><h2>Polite public reads</h2><p>Identical endpoint requests are deduplicated and cached in memory for 30 seconds, including failures. Visible pages refresh every 30 seconds; hidden tabs stop polling. No browser storage or background member crawl is used.</p><p>HTTP 429 pauses reads to that API origin until Retry-After expires (at least 30 seconds). Without that header, backoff grows from 30 seconds to 15 minutes. The offline sampler reads each distinct endpoint only once with two workers and stops on 429.</p></section><section><h2>Official sources</h2><ul class="source-links">${[['Community stats',`${COMMUNITY}/stats`],['Published leaderboard',`${COMMUNITY}/leaderboard`],['Public member profile',`${COMMUNITY}/profiles/:code`],['Official badge catalog',`${COMMUNITY}/aura/badges`],['Genesis activity',`${COMMUNITY}/genesis/activity`],['Requested Genesis state',`${COMMUNITY}/genesis/state`],['Official site launch state',LAUNCH],['Official Genesis site','https://sepolia.squeekchain.com/genesis']].map(([label,url])=>`<li><span>${label}</span><a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(url)}<span class="sr-only"> (opens in a new tab)</span></a></li>`).join('')}</ul></section></article><aside class="method-aside"><div class="method-summary"><span class="method-symbol" aria-hidden="true">${icon('sparkle',30)}</span><h2>A fit, not a formula</h2><dl><div><dt>Public profiles sampled</dt><dd>${model.sampleSize}</dd></div><div><dt>Non-trophy features</dt><dd>${model.features}</dd></div><div><dt>Mean absolute fit error</dt><dd>≈${Math.round(model.mae)} aura</dd></div></dl><p>Unofficial estimates. Dated sample. No guaranteed rewards.</p><a class="secondary full-width" href="#/board">Back to the Board ${icon('arrow',16)}</a></div></aside></div><section class="coefficient-section"><div class="section-heading"><div><h2>The contribution estimates</h2><p>Every value is an unofficial estimate. Support is the number of sampled profiles with that badge.</p></div></div><div class="coefficient-list">${rows.map(([id,c])=>`<div class="coefficient-row"><span>${escape(catalog.state.data?.badges.find(b=>b.id===id)?.title ?? id)}${c.inseparable.length?'<small>Co-earned; uncertain individual share</small>':''}</span><span>${c.value===null?'No estimate':`≈${n(Math.round(c.value))}`}<small>${c.value===null?'No sample':'Unofficial aura estimate'}</small></span><span>${c.support}<small>profile${c.support===1?'':'s'}</small></span></div>`).join('')}</div><p class="fine-print">Sample checksum (SHA-256): <code class="hash">${model.sampleHash}</code></p></section>`;
}
function focusSelector(el: HTMLElement): string | undefined {
  if (el.dataset.focus) return `[data-focus="${CSS.escape(el.dataset.focus)}"]`;
  if (el.id) return `#${CSS.escape(el.id)}`;
  if (el instanceof HTMLAnchorElement) return `a[href="${CSS.escape(el.getAttribute('href') ?? '')}"]`;
  if (el.tagName==='SUMMARY') {
    const detail=el.parentElement;
    if(detail?.dataset.detail) return `[data-detail="${CSS.escape(detail.dataset.detail)}"] > summary`;
    if(detail?.classList.contains('health')) return '.health > summary';
  }
  if(el instanceof HTMLButtonElement) {
    if(el.dataset.action) return `button[data-action="${el.dataset.action}"]${['key','lane','code'].filter(k=>el.dataset[k]).map(k=>`[data-${k}="${CSS.escape(el.dataset[k]!)}"]`).join('')}`;
    const form=el.closest('form');if(form?.id)return `#${form.id} button[type="submit"]`;
  }
  return undefined;
}
function replaceMain(html: string): void {
  const active = document.activeElement instanceof HTMLElement && main.contains(document.activeElement) ? document.activeElement : undefined;
  const selector = active ? focusSelector(active) : undefined;
  const index = active && selector ? [...main.querySelectorAll(selector)].indexOf(active) : 0;
  const inputEl = active instanceof HTMLInputElement ? active : undefined;
  const start = inputEl?.selectionStart, end = inputEl?.selectionEnd;
  const openDetails = [...main.querySelectorAll<HTMLDetailsElement>('details[open]')].map(e=>e.dataset.detail ?? (e.classList.contains('health')?'health':''));
  main.innerHTML=html;
  for (const d of main.querySelectorAll<HTMLDetailsElement>('details')) if (openDetails.includes(d.dataset.detail ?? (d.classList.contains('health')?'health':''))) d.open=true;
  if (selector) {
    const next = main.querySelectorAll<HTMLElement>(selector)[Math.max(0,index)]; next?.focus({preventScroll:true});
    if (next instanceof HTMLInputElement && next.type!=='search' && start!==null && start!==undefined) next.setSelectionRange(start,end??start);
  }
}
function revealResult(): void {
  if (!resultToReveal || selected!==resultToReveal) return;
  const r=profileFor(selected);
  if(r.state.pending || (!r.state.data && !r.state.error)) return;
  const p=r.state.data;
  announcer.textContent=p?.valid ? `Observed ${name(p.identity,p.code)}: ${n(p.standing.aura)} aura and ${p.achievements.length} earned badges.${isStale(r.state)?' This observation is delayed.':''}` : p ? `No Genesis member found for ${selected}.` : `Member ${selected} is unavailable. ${r.state.error}`;
  resultToReveal='';
  // A response must not steal focus from a visitor who started another action while waiting.
  if(document.activeElement===main || document.activeElement===document.body || document.activeElement?.matches('#lookup-form button[type="submit"]')) {
    const result=main.querySelector<HTMLElement>('#member-result');result?.focus({preventScroll:true});result?.scrollIntoView({block:'start'});
  }
}

function render(): void {
  const observed = leaderboard.state.observedAt;
  if (observed && observed!==rankObservedAt) { previousRanks=observedRanks; previousRankTime=rankObservedAt; observedRanks=new Map(leaderboard.state.data!.entries.map(e=>[e.code,e.rank])); rankObservedAt=observed; }
  renderPulse(); replaceMain(page==='board'?board():page==='leaderboard'?leaderboardView():about());
  document.querySelectorAll<HTMLAnchorElement>('[data-nav]').forEach(a=>{ if(a.dataset.nav===page) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); });
  revealResult();
}
let renderQueued=false;
subscribe(()=>{ if(!renderQueued) { renderQueued=true; queueMicrotask(()=>{renderQueued=false;render();}); } });
async function refresh(): Promise<void> { await Promise.allSettled([...core.map(r=>load(r as Resource<unknown>)),...(selected?[load(profileFor(selected))]:[])]); }
function route(): void {
  if (location.hash==='#main') { main.focus(); return; }
  const parts=location.hash.replace(/^#\/?/,'').split('/');
  page=parts[0]==='leaderboard'?'leaderboard':parts[0]==='about'?'about':'board';
  const code=(parts[1]??'').toLowerCase(); selected=page==='board'&&isCode(code)?code:'';
  resultToReveal=selected;
  if(selected) { input=selected; void load(profileFor(selected)); }
  inputError=''; document.title=`${page==='board'?'Aura Board':page==='leaderboard'?'Leaderboard · Aura Board':'About the numbers · Aura Board'} · Squeekchain Genesis`;
  render();
}
window.addEventListener('hashchange',()=>{main.focus({preventScroll:true});window.scrollTo(0,0);route();});
main.addEventListener('input',event=>{
  const el=event.target;
  if(el instanceof HTMLInputElement && el.id==='invite-code') { input=el.value; inputError=''; }
  if(el instanceof HTMLInputElement && el.id==='leader-query') { query=el.value;boardPage=0;render(); }
});
main.addEventListener('submit',event=>{
  event.preventDefault();
  if((event.target as HTMLFormElement).id==='lookup-form') {
    const code=input.trim().toLowerCase();
    if(!isCode(code)) { inputError='Enter 8 letters or numbers from a Genesis invite code.';render();main.querySelector<HTMLInputElement>('#invite-code')?.focus();return; }
    input=code;inputError='';resultToReveal=code;
    if(location.hash===`#/board/${code}`) { void load(profileFor(code));render(); } else location.hash=`/board/${code}`;
  } else if((event.target as HTMLFormElement).id==='leader-search') {
    const code=query.trim().toLowerCase();
    if(isCode(code)) location.hash=`/board/${code}`;
    else { boardPage=0;render();announcer.textContent='Published leaderboard search updated.'; }
  }
});
main.addEventListener('click',event=>{
  const button=(event.target as Element).closest<HTMLButtonElement>('button[data-action]');if(!button)return;
  const action=button.dataset.action;
  if(action==='retry') { const r=allResources().find(r=>r.key===button.dataset.key);if(r) { void load(r);announcer.textContent='Retry requested. The 30-second endpoint cache and rate-limit backoff still apply.'; } }
  if(action==='refresh') { void refresh();announcer.textContent='Refresh requested. Endpoints observed in the last 30 seconds are reused.'; }
  if(action==='lane') { lane=button.dataset.lane??'all';render();main.querySelector<HTMLButtonElement>(`[data-lane="${lane}"]`)?.focus({preventScroll:true}); }
  if(action==='clear-search') { query='';boardPage=0;render();main.querySelector<HTMLInputElement>('#leader-query')?.focus(); }
  if(action==='prev'||action==='next') { boardPage+=action==='next'?1:-1;render();main.querySelector('.leader-table')?.scrollIntoView({block:'start'});announcer.textContent=`Leaderboard page ${boardPage+1}.`; }
  if(action==='copy') { const url=new URL(location.href);url.hash=`/board/${button.dataset.code}`;if(!navigator.clipboard){announcer.textContent='Clipboard unavailable. Copy the link from your browser address bar.';return;}navigator.clipboard.writeText(url.href).then(()=>{button.textContent='Link copied';announcer.textContent='Profile link copied.';}).catch(()=>{announcer.textContent='Clipboard unavailable. Copy the link from your browser address bar.';}); }
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
setInterval(()=>{if(!document.hidden)void refresh();},30_000);
setInterval(()=>{ document.querySelectorAll<HTMLElement>('[data-countdown]').forEach(el=>{el.textContent=countdown(Number(el.dataset.countdown));}); },1000);
// Re-evaluate age even when a slow/failing request has not emitted a new observation.
setInterval(()=>{if(!document.hidden)render();},15_000);
route();void refresh();
