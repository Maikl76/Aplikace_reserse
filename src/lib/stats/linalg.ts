// Malá lineární algebra pro metaregresi, víceúrovňové modely a síťovou metaanalýzu.
// Matice jsou pole řádků; rozměry jsou malé (počet moderátorů nebo léčeb), takže
// stačí přímé postupy bez knihovny.

export type Matrix = number[][];

export const zeros = (rows: number, cols: number): Matrix => Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

export const transpose = (A: Matrix): Matrix => (A.length ? A[0].map((_, j) => A.map((row) => row[j])) : []);

export function matMul(A: Matrix, B: Matrix): Matrix {
  const n = A.length;
  const m = B[0]?.length ?? 0;
  const inner = B.length;
  const out = zeros(n, m);
  for (let i = 0; i < n; i++) {
    const Ai = A[i];
    const Oi = out[i];
    for (let k = 0; k < inner; k++) {
      const a = Ai[k];
      if (a === 0) continue;
      const Bk = B[k];
      for (let j = 0; j < m; j++) Oi[j] += a * Bk[j];
    }
  }
  return out;
}

export const matVec = (A: Matrix, x: number[]): number[] => A.map((row) => row.reduce((s, a, j) => s + a * x[j], 0));

export const dot = (a: number[], b: number[]): number => a.reduce((s, x, i) => s + x * b[i], 0);

/** Inverze čtvercové matice Gaussovou–Jordanovou eliminací s výběrem hlavního prvku; null u singulární matice. */
export function inverse(A: Matrix): Matrix | null {
  const n = A.length;
  const M = A.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    if (Math.abs(M[pivot][col]) < 1e-12 * Math.max(1, ...A.map((row) => Math.abs(row[col])))) return null;
    [M[col], M[pivot]] = [M[pivot], M[col]];
    const d = M[col][col];
    for (let j = 0; j < 2 * n; j++) M[col][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      if (f === 0) continue;
      for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[col][j];
    }
  }
  return M.map((row) => row.slice(n));
}

/** Logaritmus determinantu symetrické pozitivně definitní matice (Choleského rozklad); NaN, pokud definitní není. */
export function logDetSpd(A: Matrix): number {
  const n = A.length;
  const L = zeros(n, n);
  let out = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = A[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) {
        if (s <= 0) return NaN;
        L[i][i] = Math.sqrt(s);
        out += 2 * Math.log(L[i][i]);
      } else L[i][j] = s / L[j][j];
    }
  }
  return out;
}

/** Kvadratická forma x'Ax. */
export const quad = (A: Matrix, x: number[]): number => dot(x, matVec(A, x));
