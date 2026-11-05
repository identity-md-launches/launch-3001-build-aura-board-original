// Non-negative least squares. Deterministic accelerated projected gradient from zero.
// Objective: 0.5 * ||Xw-y||², w >= 0. No regularization, intercept or official weights.
export function nnls(x, y, { tolerance = 1e-6, maxIterations = 100000 } = {}) {
  if (!x.length || x.length !== y.length) throw new Error('Expected matching, nonempty X and y');
  const p = x[0].length;
  if (!p || x.some(r => r.length !== p || r.some(v => !Number.isFinite(v))) || y.some(v => !Number.isFinite(v))) throw new Error('Invalid fit matrix');
  const gram = Array.from({ length: p }, () => Array(p).fill(0));
  const cross = Array(p).fill(0);
  for (let i = 0; i < x.length; i++) for (let j = 0; j < p; j++) {
    cross[j] += x[i][j] * y[i];
    for (let k = 0; k < p; k++) gram[j][k] += x[i][j] * x[i][k];
  }
  // The maximum absolute row sum bounds the spectral norm of a symmetric matrix.
  const lipschitz = Math.max(...gram.map(r => r.reduce((a,v) => a + Math.abs(v),0)),1);
  let w = Array(p).fill(0), z = [...w], t = 1, iterations = 0, kkt = Infinity;
  for (; iterations < maxIterations; iterations++) {
    const next = z.map((v,j) => Math.max(0,v - (gram[j].reduce((a,g,k) => a+g*z[k],0)-cross[j])/lipschitz));
    kkt = Math.max(...next.map((v,j) => {
      const g = gram[j].reduce((a,g,k) => a+g*next[k],0)-cross[j];
      return v > 1e-8 ? Math.abs(g) : Math.max(0,-g);
    }));
    const nt = (1+Math.sqrt(1+4*t*t))/2;
    z = next.map((v,j) => v + ((t-1)/nt)*(v-w[j]));
    w = next; t = nt;
    if (kkt < tolerance) { iterations++; break; }
  }
  const residuals = x.map((r,i) => r.reduce((a,v,j) => a+v*w[j],0)-y[i]);
  return { weights: w, iterations, kkt, converged: kkt < tolerance, gram, cross,
    rmse: Math.sqrt(residuals.reduce((a,v) => a+v*v,0)/y.length), mae: residuals.reduce((a,v) => a+Math.abs(v),0)/y.length };
}
