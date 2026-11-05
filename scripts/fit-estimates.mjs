import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { nnls } from './nnls.mjs';
const exec = promisify(execFile);
const base = 'https://community.squeekchain.com/v1/community';
const receipts = new Map();
async function read(path) {
  if (receipts.has(path)) return receipts.get(path);
  const { stdout } = await exec('curl',['-sS','--max-time','20','-H','Accept: application/json',`${base}${path}`,'-w','\n%{http_code}'],{ maxBuffer: 1024*1024 });
  const end = stdout.lastIndexOf('\n'), status = Number(stdout.slice(end+1));
  if (status === 429) throw new Error('API returned 429; fit aborted without further retries. Try later, respecting Retry-After.');
  if (status !== 200) throw new Error(`${path} returned HTTP ${status}; no model replaced.`);
  const result = JSON.parse(stdout.slice(0,end)); receipts.set(path,result); return result;
}
const startedAt = new Date().toISOString();
const board = await read('/leaderboard');
const catalog = await read('/aura/badges');
const activity = await read('/genesis/activity');
if (!Array.isArray(board.entries) || !Array.isArray(catalog.badges) || !Array.isArray(activity.events)) throw new Error('Unsupported sample source');
const topCodes = board.entries.map(e => e.code);
const recentCodes = [...new Set(activity.events.map(e => e.member.code))].filter(c => !topCodes.includes(c)).sort().slice(0,32);
const codes = [...new Set([...topCodes,...recentCodes])].sort();
if (codes.some(c => !/^[a-z0-9]{8}$/.test(c))) throw new Error('Invalid public code');
const profiles = [];
// Two workers, one request per unique profile. No endpoint is re-requested in this run.
let cursor = 0, stopped = false;
async function worker() {
  while (!stopped && cursor < codes.length) {
    const code = codes[cursor++];
    try {
      const p = await read(`/profiles/${code}`);
      if (p.code !== code || p.valid !== true || !p.standing || !Number.isFinite(p.standing.aura) || !Array.isArray(p.achievements)) throw new Error(`Unsupported profile ${code}`);
      profiles.push(p);
    } catch (e) { stopped = true; throw e; }
  }
}
await Promise.all([worker(),worker()]); profiles.sort((a,b) => a.code.localeCompare(b.code,'en'));
const ids = catalog.badges.filter(b => !b.trophy).map(b => b.id).sort();
const x = profiles.map(p => { const earned = new Set(p.achievements.map(a => a.id)); return ids.map(id => earned.has(id) ? 1 : 0); });
const y = profiles.map(p => p.standing.aura);
const fit = nnls(x,y);
if (!fit.converged) throw new Error(`NNLS did not converge: KKT ${fit.kkt}. No model replaced.`);
const coefficients = Object.fromEntries(ids.map((id,j) => {
  const support = x.reduce((a,r) => a+r[j],0);
  const inseparable = support ? ids.filter((other,k) => k!==j && x.every(r => r[k]===r[j])) : [];
  return [id,{ value: support ? fit.weights[j] : null, support, inseparable }];
}));
for (const b of catalog.badges.filter(b => b.trophy)) coefficients[b.id] = { value: 0, support: profiles.filter(p => p.achievements.some(a => a.id===b.id)).length, inseparable: [], trophy: true };
const sampleHash = createHash('sha256').update(JSON.stringify(profiles.map((p,i) => ({ code:p.code,aura:y[i],badges:x[i],snapshot:p.snapshot })))).digest('hex');
const sourceSnapshots = [...new Set(profiles.map(p => p.snapshot?.computedAt).filter(Boolean))].sort();
const metadata = {
  schemaVersion:1, label:'Unofficial community-derived estimates', method:'Non-negative least squares; accelerated projected gradient from zero; no intercept or regularization',
  startedAt, fittedAt:new Date().toISOString(), sampleSize:profiles.length, leaderboardProfiles:topCodes.length, activityProfiles:recentCodes.length,
  sampleSelection:'Every published leaderboard entry plus up to 32 distinct recent activity member codes outside that board, sorted lexicographically. All profiles fetched once from the official API.',
  sourceSnapshots, sampleHash, features:ids.length, iterations:fit.iterations, tolerance:1e-6, kkt:fit.kkt, converged:fit.converged, rmse:fit.rmse, mae:fit.mae,
  coefficients, limitations:['Non-random sample favors high-rank and recently active members.','Holder caps, referrals and community activation can cause aura not explained by additive badge indicators.','Identical or correlated badge columns cannot establish individual causal values.','Unobserved badges have no estimate; a fitted zero is not an official zero.','Estimates are a dated calibration, never live member data or a promise of extra aura.']
};
await mkdir('artifacts',{recursive:true});
await writeFile('src/aura-model.json',JSON.stringify(metadata,null,2)+'\n');
await writeFile('artifacts/fit-record.json',JSON.stringify({ ...metadata, ids, gram:fit.gram,cross:fit.cross,ySquared:y.reduce((a,v)=>a+v*v,0) },null,2)+'\n');
console.log(JSON.stringify({ sampleSize:metadata.sampleSize,features:metadata.features,rmse:fit.rmse,mae:fit.mae,kkt:fit.kkt,iterations:fit.iterations,fittedAt:metadata.fittedAt },null,2));
