import { SchemaError } from './schema';
export const COMMUNITY = 'https://community.squeekchain.com/v1/community';
export const LAUNCH = 'https://api.squeekchain.com/v1/genesis-launch';
export const CACHE_MS = 30_000;
export const STALE_MS = 5 * 60_000;
export interface Observation<T> { data?: T; observedAt?: number; sourceAt?: string; pending: boolean; error?: string; retryAt?: number; lastAttempt?: number }
export interface Resource<T> { key: string; label: string; url: string; parse: (v: unknown) => T; state: Observation<T> }
const resources = new Map<string, Resource<unknown>>();
const inflight = new Map<string, Promise<void>>();
const backoffs = new Map<string, { until: number; attempts: number }>();
const listeners = new Set<() => void>();
export function subscribe(fn: () => void): () => void { listeners.add(fn); return () => listeners.delete(fn); }
const emit = () => listeners.forEach(fn => fn());
export function resource<T>(key: string,label: string,url: string,parse: (v: unknown) => T): Resource<T> {
  const existing = resources.get(key); if (existing) return existing as Resource<T>;
  const r = { key, label, url, parse, state: { pending: false } }; resources.set(key,r); return r;
}
function sourceTime(data: unknown): string | undefined {
  const d = data as { snapshot?: { computedAt?: string } | null; generatedAt?: string; snapshotAt?: string };
  return d.snapshot?.computedAt ?? d.snapshotAt ?? d.generatedAt;
}
export function missingSourceTime<T>(s: Observation<T>): boolean {
  return !!s.data && typeof s.data === 'object' && 'snapshot' in s.data && (s.data as {snapshot: unknown}).snapshot === null;
}
export function isStale<T>(s: Observation<T>,now = Date.now()): boolean {
  return !!s.data && (missingSourceTime(s) || !!s.error || !s.observedAt || now - s.observedAt > 60_000 || (!!s.sourceAt && (now - Date.parse(s.sourceAt) > STALE_MS || Date.parse(s.sourceAt) > now + 60_000)));
}
export function freshness<T>(r: Resource<T>): string {
  const s = r.state;
  if (!s.data) return s.pending ? 'Loading official API' : 'Unavailable';
  if (s.error) return 'Last observation; refresh failed';
  if (missingSourceTime(s)) return 'Source time unavailable';
  if (isStale(s)) return 'Delayed source snapshot';
  return 'Recent API observation';
}
export async function load<T>(r: Resource<T>): Promise<void> {
  if (inflight.has(r.key)) return inflight.get(r.key);
  const now = Date.now(), origin = new URL(r.url).origin;
  if (r.state.lastAttempt && now - r.state.lastAttempt < CACHE_MS) return;
  if (r.state.observedAt && !r.state.error && now - r.state.observedAt < CACHE_MS) return;
  const backoff = backoffs.get(origin);
  if (backoff && backoff.until > now) {
    r.state.retryAt = backoff.until; r.state.error = `API rate limit. Requests paused until ${new Date(backoff.until).toISOString().slice(11,19)} UTC.`; emit(); return;
  }
  r.state.pending = true; r.state.lastAttempt = now; emit();
  const task = (async () => {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(r.url, { credentials: 'omit', referrerPolicy: 'no-referrer', headers: { Accept: 'application/json' }, cache: 'no-store', signal: controller.signal });
      if (response.status === 429) {
        const attempts = (backoffs.get(origin)?.attempts ?? 0) + 1;
        const retry = response.headers.get('retry-after');
        const serverUntil = retry && /^\d+$/.test(retry.trim()) ? Date.now() + Number(retry) * 1000 : retry ? Date.parse(retry) : NaN;
        const until = Math.max(Date.now() + CACHE_MS, Number.isFinite(serverUntil) ? serverUntil : Date.now() + Math.min(900_000, CACHE_MS * 2 ** (attempts - 1)));
        backoffs.set(origin,{ until,attempts }); r.state.retryAt = until;
        throw new Error(`API rate limit (HTTP 429). Requests paused until ${new Date(until).toISOString().slice(11,19)} UTC.`);
      }
      if (!response.ok) throw new Error(`Official endpoint returned HTTP ${response.status}${response.status === 404 ? ' (not found)' : ''}.`);
      let json: unknown; try { json = await response.json(); } catch { throw new Error('Official endpoint returned invalid JSON.'); }
      const data = r.parse(json);
      // A response is only promoted after validation. A failed refresh preserves its prior observation.
      r.state.data = data; r.state.observedAt = Date.now(); r.state.sourceAt = sourceTime(data);
      r.state.error = undefined; r.state.retryAt = undefined; if ((backoffs.get(origin)?.until ?? 0) <= Date.now()) backoffs.delete(origin);
    } catch (error) {
      r.state.error = error instanceof SchemaError ? error.message : error instanceof Error && error.name === 'AbortError' ? 'Official API timed out after 12 seconds. Loaded observations remain visible.' : error instanceof TypeError ? (r.key.startsWith('profile:') ? 'Browser cannot read this profile (network or CORS). CORS was restricted to the official site when verified on 2026-11-05.' : `${r.label} could not be read by the browser. Check the network connection and retry.`) : error instanceof Error ? error.message : 'Official API unavailable.';
    } finally { clearTimeout(timeout); r.state.pending = false; inflight.delete(r.key); emit(); }
  })();
  inflight.set(r.key,task); return task;
}
export function allResources(): Resource<unknown>[] { return [...resources.values()]; }
