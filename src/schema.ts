// Required fields verified against the official public API on 2026-11-05.
// Unknown extra fields are tolerated; malformed/missing required fields are rejected.
export type Tier = 'gold' | 'silver' | 'bronze' | null;
export interface Snapshot { members: number; computedAt: string }
export interface Identity { kind: string; username?: string; alias?: string; name?: string }
export interface Stats { members: number; badgesEarned: number; projectsVerified: number; snapshot: Snapshot | null }
export interface Entry { rank: number; code: string; identity: Identity | null; aura: number; badges: number; tier: Tier }
export interface Leaderboard { entries: Entry[]; snapshot: Snapshot | null; generatedAt: string }
export interface Achievement { id: string; title: string; active: boolean | null }
export interface Profile {
  code: string; valid: boolean; identity: Identity | null;
  standing: { rank: number | null; aura: number; tier: Tier; movement: number | null };
  completedReferrals: number; achievements: Achievement[]; snapshot: Snapshot | null;
}
export interface Badge {
  id: string; lane: 'clout' | 'code' | 'holder'; title: string; description: string; instruction: string;
  criteria: { label: string; detail: string | null }[]; trophy: boolean;
  rarity: { holders: number; heldByBps: number } | null; snapshotAt: string | null;
}
export interface Catalog { badges: Badge[]; snapshot: Snapshot | null }
export interface ActivityEvent { id: string; at: string; member: { code: string; identity: Identity | null }; kind: string; achievement?: { id: string; title: string } }
export interface Activity { events: ActivityEvent[]; nextBefore: string | null }
export interface Launch { status: 'available' | 'unavailable'; phase?: string; reason?: string; endsAt?: number; snapshotAt?: string }
export class SchemaError extends Error {
  constructor(field: string) { super(`Unsupported API schema at ${field}. This section cannot be refreshed safely.`); this.name = 'SchemaError'; }
}
type Obj = Record<string, unknown>;
const obj = (v: unknown, p: string): Obj => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new SchemaError(p); return v as Obj; };
const str = (v: unknown, p: string): string => { if (typeof v !== 'string' || !v.length) throw new SchemaError(p); return v; };
const num = (v: unknown, p: string): number => { if (typeof v !== 'number' || !Number.isFinite(v)) throw new SchemaError(p); return v; };
const uint = (v: unknown, p: string): number => { const n = num(v,p); if (!Number.isSafeInteger(n) || n < 0) throw new SchemaError(p); return n; };
const bool = (v: unknown, p: string): boolean => { if (typeof v !== 'boolean') throw new SchemaError(p); return v; };
const arr = (v: unknown, p: string): unknown[] => { if (!Array.isArray(v)) throw new SchemaError(p); return v; };
const date = (v: unknown, p: string): string => { const s = str(v,p); if (!Number.isFinite(Date.parse(s))) throw new SchemaError(p); return s; };
const nullable = <T>(v: unknown, p: string, fn: (x: unknown,p: string) => T): T | null => v === null ? null : fn(v,p);
const tier = (v: unknown,p: string): Tier => { if (v === null || v === 'gold' || v === 'silver' || v === 'bronze') return v; throw new SchemaError(p); };
export const isCode = (s: string): boolean => /^[a-z0-9]{8}$/.test(s);
const code = (v: unknown,p: string): string => { const s = str(v,p); if (!isCode(s)) throw new SchemaError(p); return s; };
const snapshot = (v: unknown): Snapshot | null => { if (v === null) return null; const o = obj(v,'snapshot'); return { members: uint(o.members,'snapshot.members'), computedAt: date(o.computedAt,'snapshot.computedAt') }; };
const identity = (v: unknown): Identity | null => {
  if (v === null) return null;
  const o = obj(v,'identity'); const kind = str(o.kind,'identity.kind');
  if (kind === 'alias') return { kind, alias: str(o.alias,'identity.alias') };
  if (kind === 'x') return { kind, username: str(o.username,'identity.username'), name: typeof o.name === 'string' ? o.name : undefined };
  throw new SchemaError('identity.kind');
};
export function parseStats(v: unknown): Stats { const o = obj(v,'stats'); return { members: uint(o.members,'members'), badgesEarned: uint(o.badgesEarned,'badgesEarned'), projectsVerified: uint(o.projectsVerified,'projectsVerified'), snapshot: snapshot(o.snapshot) }; }
export function parseLeaderboard(v: unknown): Leaderboard {
  const o = obj(v,'leaderboard'); const seen = new Set<string>();
  const entries = arr(o.entries,'entries').map((v,i): Entry => {
    const e = obj(v,`entries[${i}]`); const c = code(e.code,'entry.code');
    if (seen.has(c)) throw new SchemaError('entries duplicate code'); seen.add(c);
    return { rank: uint(e.rank,'rank'), code: c, identity: identity(e.identity), aura: uint(e.aura,'aura'), badges: uint(e.badges,'badges'), tier: tier(e.tier,'tier') };
  });
  return { entries, snapshot: snapshot(o.snapshot), generatedAt: date(o.generatedAt,'generatedAt') };
}
export function parseProfile(v: unknown): Profile {
  const o = obj(v,'profile'), s = obj(o.standing,'standing');
  return { code: code(o.code,'code'), valid: bool(o.valid,'valid'), identity: identity(o.identity),
    standing: { rank: nullable(s.rank,'rank',uint), aura: uint(s.aura,'aura'), tier: tier(s.tier,'tier'), movement: nullable(s.movement,'movement',num) },
    completedReferrals: uint(o.completedReferrals,'completedReferrals'), achievements: arr(o.achievements,'achievements').map((v): Achievement => {
      const a = obj(v,'achievement'); return { id: str(a.id,'achievement.id'), title: str(a.title,'achievement.title'), active: nullable(a.active,'active',bool) };
    }), snapshot: snapshot(o.snapshot) };
}
export function parseCatalog(v: unknown): Catalog {
  const o = obj(v,'catalog'); const seen = new Set<string>();
  const badges = arr(o.badges,'badges').map((v): Badge => {
    const b = obj(v,'badge'), id = str(b.id,'badge.id');
    if (seen.has(id)) throw new SchemaError('badges duplicate id'); seen.add(id);
    const lane = str(b.lane,'lane'); if (!['clout','code','holder'].includes(lane)) throw new SchemaError('lane');
    const rarity = b.rarity === null ? null : obj(b.rarity,'rarity');
    return { id, lane: lane as Badge['lane'], title: str(b.title,'title'), description: str(b.description,'description'), instruction: str(b.instruction,'instruction'), trophy: bool(b.trophy,'trophy'),
      snapshotAt: nullable(b.snapshotAt,'snapshotAt',date), rarity: rarity ? { holders: uint(rarity.holders,'holders'), heldByBps: uint(rarity.heldByBps,'heldByBps') } : null,
      criteria: arr(b.criteria,'criteria').map((v) => { const c = obj(v,'criterion'); return { label: str(c.label,'criterion.label'), detail: nullable(c.detail,'criterion.detail',str) }; }) };
  });
  return { badges, snapshot: snapshot(o.snapshot) };
}
export function parseActivity(v: unknown): Activity {
  const o = obj(v,'activity'); return { nextBefore: nullable(o.nextBefore,'nextBefore',str), events: arr(o.events,'events').map((v): ActivityEvent => {
    const e = obj(v,'event'), m = obj(e.member,'event.member'); let achievement;
    if (e.achievement !== undefined) { const a = obj(e.achievement,'event.achievement'); achievement = { id: str(a.id,'event.achievement.id'), title: str(a.title,'event.achievement.title') }; }
    return { id: str(e.id,'event.id'), at: date(e.at,'event.at'), kind: str(e.kind,'event.kind'), member: { code: code(m.code,'event.member.code'), identity: identity(m.identity) }, achievement };
  }) };
}
const phases = ['awaiting_inventory','pending','whitelist_open','public_open','awaiting_close','waiting_for_hamster','randomness_pending','processing','claimable','cancelled'];
// Schema v3 is taken from the official site's public client, not an invented phase schema.
export function parseLaunch(v: unknown): Launch {
  const o = obj(v,'launch'); if (o.schemaVersion !== 3) throw new SchemaError('launch.schemaVersion');
  if (o.status === 'unavailable') return { status: 'unavailable', reason: str(o.reason,'launch.reason') };
  if (o.status !== 'available') throw new SchemaError('launch.status');
  const s = obj(o.state,'launch.state'), c = obj(o.configuration,'launch.configuration'), snap = obj(o.snapshot,'launch.snapshot');
  const phase = str(s.phase,'launch.state.phase'); if (!phases.includes(phase)) throw new SchemaError('launch.state.phase');
  const seconds = (v: unknown,p: string) => { const s = str(v,p); if (!/^\d+$/.test(s) || !Number.isSafeInteger(Number(s))) throw new SchemaError(p); return Number(s); };
  const opens = seconds(c.opensAt,'configuration.opensAt'), wl = seconds(c.whitelistClosesAt,'configuration.whitelistClosesAt'), closes = seconds(c.closesAt,'configuration.closesAt');
  const stamp = seconds(snap.blockTimestamp,'snapshot.blockTimestamp');
  const end = phase === 'pending' ? opens : phase === 'whitelist_open' ? wl : phase === 'public_open' ? closes : undefined;
  return { status: 'available', phase, endsAt: end ? end * 1000 : undefined, snapshotAt: new Date(stamp * 1000).toISOString() };
}
