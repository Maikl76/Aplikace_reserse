"""Nezávislý výpočet referenčních hodnot pro testy statistiky (SciPy/NumPy).

Spuštění:  python3 tests/reference/make_reference.py > tests/reference/reference.json

Data: 13 studií vakcíny BCG proti tuberkulóze (Colditz et al., 1994), známá jako
datová sada dat.bcg z balíku metafor. Výsledky metaanalýzy této sady jsou publikované
v dokumentaci metafor (Viechtbauer, 2010), takže je lze zkontrolovat i ručně.
"""
import json
import numpy as np
from scipy import stats, optimize, special

# tpos, tneg, cpos, cneg
BCG = [
    (4, 119, 11, 128), (6, 300, 29, 274), (3, 228, 11, 209), (62, 13536, 248, 12619),
    (33, 5036, 47, 5761), (180, 1361, 372, 1079), (8, 2537, 10, 619), (505, 87886, 499, 87892),
    (29, 7470, 45, 7232), (17, 1699, 65, 1600), (186, 50448, 141, 27197), (5, 2493, 3, 2338),
    (27, 16886, 29, 17825),
]
a, b, c, d = (np.array(x, dtype=float) for x in zip(*BCG))
n1, n2 = a + b, c + d
yi = np.log((a / n1) / (c / n2))
vi = 1 / a - 1 / n1 + 1 / c - 1 / n2
k = len(yi)


def pooled(t2):
    w = 1 / (vi + t2)
    mu = np.sum(w * yi) / np.sum(w)
    return mu, np.sqrt(1 / np.sum(w)), w


# model s pevným efektem
mu_fe, se_fe, w_fe = pooled(0.0)
Q = float(np.sum(w_fe * (yi - mu_fe) ** 2))

# DerSimonian–Laird
C = np.sum(w_fe) - np.sum(w_fe**2) / np.sum(w_fe)
t2_dl = max(0.0, (Q - (k - 1)) / C)
mu_dl, se_dl, _ = pooled(t2_dl)

# REML: přímá maximalizace omezené věrohodnosti (jiný postup než Fisherovo skórování v aplikaci)
def neg_reml(t2):
    w = 1 / (vi + t2)
    mu = np.sum(w * yi) / np.sum(w)
    return 0.5 * (np.sum(np.log(vi + t2)) + np.log(np.sum(w)) + np.sum(w * (yi - mu) ** 2))

t2_reml = float(optimize.minimize_scalar(neg_reml, bounds=(0, 5), method="bounded", options={"xatol": 1e-12}).x)
mu_re, se_re, w_re = pooled(t2_reml)
s2 = (k - 1) * np.sum(w_fe) / (np.sum(w_fe) ** 2 - np.sum(w_fe**2))

# Knapp–Hartung
se_kh = float(np.sqrt(np.sum(w_re * (yi - mu_re) ** 2) / ((k - 1) * np.sum(w_re))))
tcrit = stats.t.ppf(0.975, k - 1)

# predikční interval
pi_half = stats.t.ppf(0.975, k - 2) * np.sqrt(t2_reml + se_re**2)

# Eggerův test: OLS regrese y/se na 1/se
x = 1 / np.sqrt(vi)
z = yi / np.sqrt(vi)
X = np.column_stack([np.ones(k), x])
beta, res, *_ = np.linalg.lstsq(X, z, rcond=None)
resid = z - X @ beta
s2e = float(resid @ resid) / (k - 2)
cov = s2e * np.linalg.inv(X.T @ X)
egger_t = beta[0] / np.sqrt(cov[0, 0])

# Hedgesovo g
m1, sd1, g1, m2, sd2, g2 = 10.0, 2.0, 20.0, 8.0, 2.5, 22.0
df = g1 + g2 - 2
sp = np.sqrt(((g1 - 1) * sd1**2 + (g2 - 1) * sd2**2) / df)
J = float(np.exp(special.gammaln(df / 2) - 0.5 * np.log(df / 2) - special.gammaln((df - 1) / 2)))
g = J * (m1 - m2) / sp

out = {
    "dist": {
        "normCdf_1.96": stats.norm.cdf(1.96),
        "normCdf_-3.5": stats.norm.cdf(-3.5),
        "normInv_0.975": stats.norm.ppf(0.975),
        "normInv_0.001": stats.norm.ppf(0.001),
        "chi2Sf_3.84_1": stats.chi2.sf(3.84, 1),
        "chi2Sf_20_12": stats.chi2.sf(20, 12),
        "chi2Sf_152.233_12": stats.chi2.sf(152.233, 12),
        "tCdf_2_10": stats.t.cdf(2.0, 10),
        "tCdf_-1.3_3": stats.t.cdf(-1.3, 3),
        "tInv_0.975_11": stats.t.ppf(0.975, 11),
        "tInv_0.975_1": stats.t.ppf(0.975, 1),
        "tInv_0.975_120": stats.t.ppf(0.975, 120),
        "lgamma_0.5": float(special.gammaln(0.5)),
        "lgamma_10.3": float(special.gammaln(10.3)),
    },
    "bcg": {
        "yi": yi.tolist(),
        "vi": vi.tolist(),
        "fixed": {"estimate": mu_fe, "se": se_fe, "Q": Q, "pQ": stats.chi2.sf(Q, k - 1), "I2": max(0, 100 * (Q - (k - 1)) / Q)},
        "dl": {"tau2": t2_dl, "estimate": mu_dl, "se": se_dl},
        "reml": {
            "tau2": t2_reml, "estimate": mu_re, "se": se_re,
            "ciLow": mu_re - stats.norm.ppf(0.975) * se_re, "ciHigh": mu_re + stats.norm.ppf(0.975) * se_re,
            "I2": 100 * t2_reml / (t2_reml + s2), "H2": t2_reml / s2 + 1,
            "piLow": mu_re - pi_half, "piHigh": mu_re + pi_half,
            "weights": (100 * w_re / np.sum(w_re)).tolist(),
        },
        "knha": {"se": se_kh, "ciLow": mu_re - tcrit * se_kh, "ciHigh": mu_re + tcrit * se_kh,
                 "p": 2 * stats.t.sf(abs(mu_re / se_kh), k - 1)},
        "egger": {"intercept": float(beta[0]), "t": float(egger_t), "p": float(2 * stats.t.sf(abs(egger_t), k - 2))},
    },
    "effects": {
        "smd": {"g": float(g), "v": float(1 / g1 + 1 / g2 + g**2 / (2 * (g1 + g2))), "J": J},
        "md": {"y": m1 - m2, "v": sd1**2 / g1 + sd2**2 / g2},
        "or_first": {"y": float(np.log(a[0] * d[0] / (b[0] * c[0]))), "v": float(1 / a[0] + 1 / b[0] + 1 / c[0] + 1 / d[0])},
        "or_zero": {"y": float(np.log((0.5 * 20.5) / (10.5 * 5.5))), "v": 1 / 0.5 + 1 / 10.5 + 1 / 5.5 + 1 / 20.5},
        "cor": {"y": float(np.arctanh(0.45)), "v": 1 / (50 - 3)},
    },
}
print(json.dumps(out, indent=1))
