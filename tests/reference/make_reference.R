# Referenční hodnoty pro pokročilé analýzy, spočtené balíkem metafor (Viechtbauer, 2010).
# Aplikace počítá totéž vlastním kódem v TypeScriptu; testy porovnávají oba výsledky.
#
# Spuštění (R s balíky metafor a metadat):
#   Rscript tests/reference/make_reference.R
# Vytvoří tests/reference/reference-metafor.json a tests/fixtures/metadat.json.

suppressMessages(library(metafor))

# ---- malý zápis do JSON (bez dalších balíků) ---------------------------------
js <- function(x) {
  if (is.null(x)) return("null")
  if (is.list(x)) {
    if (is.null(names(x))) return(paste0("[", paste(vapply(x, js, ""), collapse = ","), "]"))
    return(paste0("{", paste(sprintf("%s:%s", vapply(names(x), function(n) js(n), ""), vapply(x, js, "")), collapse = ","), "}"))
  }
  if (is.character(x) || is.factor(x)) {
    s <- sprintf("\"%s\"", gsub("\"", "\\\\\"", as.character(x)))
    return(if (length(s) == 1) s else paste0("[", paste(s, collapse = ","), "]"))
  }
  s <- ifelse(is.na(x), "null", formatC(as.numeric(x), digits = 15, format = "g"))
  if (length(s) == 1) s else paste0("[", paste(s, collapse = ","), "]")
}
vec <- function(x) as.list(as.numeric(x))          # vždy pole, i u jedné hodnoty
svec <- function(x) as.list(as.character(x))

out <- list(metafor = as.character(packageVersion("metafor")))
fix <- list()

# ---- 1. Metaregrese: vakcína BCG (Colditz et al., 1994) ----------------------
bcg <- escalc(measure = "RR", ai = tpos, bi = tneg, ci = cpos, di = cneg, data = dat.bcg)
uni <- function(res, newmods = NULL) {
  r <- list(names = svec(rownames(res$beta)), b = vec(res$beta), se = vec(res$se), stat = vec(res$zval), pval = vec(res$pval),
            ciLow = vec(res$ci.lb), ciHigh = vec(res$ci.ub), vb = vec(res$vb), tau2 = res$tau2, I2 = res$I2, H2 = res$H2,
            R2 = if (is.null(res$R2)) NA else res$R2, QE = res$QE, pQE = res$QEp, QM = res$QM, pQM = res$QMp)
  if (!is.null(newmods)) {
    p <- predict(res, newmods = newmods)
    r$pred <- list(x = vec(newmods), pred = vec(p$pred), se = vec(p$se), ciLow = vec(p$ci.lb), ciHigh = vec(p$ci.ub))
  }
  r
}
# Přísnější ukončení iterací než výchozí, aby referenční hodnoty byly přesné na více míst.
tight <- list(threshold = 1e-12, maxiter = 1000)
out$reg <- list(
  ablat_reml = uni(rma(yi, vi, mods = ~ ablat, data = bcg, control = tight), c(10, 30, 50)),
  ablat_dl   = uni(rma(yi, vi, mods = ~ ablat, data = bcg, method = "DL")),
  ablat_knha = uni(rma(yi, vi, mods = ~ ablat, data = bcg, test = "knha", control = tight), c(10, 30, 50)),
  ablat_fe   = uni(rma(yi, vi, mods = ~ ablat, data = bcg, method = "FE")),
  ablat_year = uni(rma(yi, vi, mods = ~ ablat + year, data = bcg, control = tight)),
  alloc      = uni(rma(yi, vi, mods = ~ factor(alloc), data = bcg, control = tight)),
  alloc_knha = uni(rma(yi, vi, mods = ~ factor(alloc), data = bcg, test = "knha", control = tight))
)
out$dist <- list(fSf_1_3_10 = pf(1, 3, 10, lower.tail = FALSE), fSf_4.2565_2_9 = pf(4.2565, 2, 9, lower.tail = FALSE), fSf_12.5_4_30 = pf(12.5, 4, 30, lower.tail = FALSE))
fix$bcg <- list(yi = vec(bcg$yi), vi = vec(bcg$vi), ablat = vec(bcg$ablat), year = vec(bcg$year), alloc = svec(bcg$alloc))

# ---- 2. Závislé efekty: tříúrovňový model ------------------------------------
i2ml <- function(res) {
  W <- diag(1 / res$vi); X <- model.matrix(res)
  P <- W - W %*% X %*% solve(t(X) %*% W %*% X) %*% t(X) %*% W
  100 * res$sigma2 / (sum(res$sigma2) + (res$k - res$p) / sum(diag(P)))
}
ml <- function(res) {
  r <- list(names = svec(rownames(res$beta)), b = vec(res$beta), se = vec(res$se), stat = vec(res$zval), pval = vec(res$pval),
            ciLow = vec(res$ci.lb), ciHigh = vec(res$ci.ub), vb = vec(res$vb), sigma2Between = res$sigma2[1], sigma2Within = res$sigma2[2],
            I2 = vec(i2ml(res)), QE = res$QE, pQE = res$QEp, logLik = as.numeric(logLik(res)), QM = res$QM, pQM = res$QMp)
  if (res$p == 1) { p <- predict(res); r$piLow <- p$pi.lb; r$piHigh <- p$pi.ub }
  r
}
ko <- dat.konstantopoulos2011
as16 <- dat.assink2016
out$ml <- list(
  konst = ml(rma.mv(yi, vi, random = ~ 1 | district/school, data = ko)),
  konst_year = ml(rma.mv(yi, vi, mods = ~ year, random = ~ 1 | district/school, data = ko)),
  assink = ml(rma.mv(yi, vi, random = ~ 1 | study/esid, data = as16)),
  assink_deltype = ml(rma.mv(yi, vi, mods = ~ factor(deltype), random = ~ 1 | study/esid, data = as16))
)
fix$konst <- list(yi = vec(ko$yi), vi = vec(ko$vi), district = svec(ko$district), year = vec(ko$year))
fix$assink <- list(yi = vec(as16$yi), vi = vec(as16$vi), study = svec(as16$study), deltype = svec(as16$deltype))

# Sloučení efektů uvnitř studie (Borenstein et al., 2009, kap. 24): prostý průměr, společná korelace.
agg <- aggregate(escalc(yi = yi, vi = vi, data = as16), cluster = study, rho = 0.6, weighted = FALSE)
aggfit <- rma(yi, vi, data = agg, control = tight)
out$aggregate <- list(rho = 0.6, study = svec(agg$study), yi = vec(agg$yi), vi = vec(agg$vi), b = as.numeric(aggfit$beta), se = aggfit$se, tau2 = aggfit$tau2)

# ---- 3. Síťová metaanalýza (kontrastní model, REML) --------------------------
pscore <- function(b, vb, smallerBetter = FALSE) {
  b <- c(0, b); V <- rbind(0, cbind(0, vb)); n <- length(b)
  sapply(seq_len(n), function(i) mean(sapply(setdiff(seq_len(n), i), function(j) {
    z <- (b[i] - b[j]) / sqrt(V[i, i] + V[j, j] - 2 * V[i, j]); pnorm(if (smallerBetter) -z else z) })))
}
# Heterogenita uvnitř designů: model s vlastním parametrem pro každou kombinaci designu a srovnání.
qwithin <- function(dat, V) {
  X <- model.matrix(~ interaction(design, comp, drop = TRUE) - 1, data = dat)
  res <- rma.mv(dat$yi, V, mods = X, intercept = FALSE)
  list(Q = res$QE, df = res$k - res$p)
}
nma <- function(res) list(names = svec(rownames(res$beta)), b = vec(res$beta), se = vec(res$se), vb = vec(res$vb),
                          tau2 = if (is.null(res$tau2) || length(res$tau2) == 0) 0 else res$tau2, QE = res$QE, pQE = res$QEp, k = res$k)

# 3a. Odvykání kouření (Hasselblad, 1998): 24 studií, 4 intervence, dvě tříramenné studie.
ha <- dat.hasselblad1998
fix$hasselblad <- list(study = vec(ha$study), authors = svec(ha$authors), year = vec(ha$year), trt = svec(ha$trt), xi = vec(ha$xi), ni = vec(ha$ni))
haw <- to.wide(ha, study = "study", grp = "trt", ref = "no_contact", grpvars = 6:7)
haw <- escalc(measure = "OR", ai = xi.1, n1i = ni.1, ci = xi.2, n2i = ni.2, data = haw)
calc.v.or <- function(x) { v <- matrix(1 / x$xi.2[1] + 1 / (x$ni.2[1] - x$xi.2[1]), nrow = nrow(x), ncol = nrow(x)); diag(v) <- x$vi; v }
Vha <- bldiag(lapply(split(haw, haw$study), calc.v.or))
haw <- contrmat(haw, grp1 = "trt.1", grp2 = "trt.2")
ha_re <- rma.mv(yi, Vha, mods = ~ self_help + ind_counseling + grp_counseling - 1, random = ~ comp | study, rho = 1/2, data = haw)
ha_fe <- rma.mv(yi, Vha, mods = ~ self_help + ind_counseling + grp_counseling - 1, data = haw)
out$nma <- list(hasselblad_re = nma(ha_re), hasselblad_fe = nma(ha_fe))
out$nma$hasselblad_re$pscore <- vec(pscore(coef(ha_re), vcov(ha_re)))
out$nma$hasselblad_fe$within <- qwithin(haw, Vha)

# 3b. Léky na diabetes (Senn et al., 2013): 26 studií, 10 léčeb, jedna tříramenná studie.
se <- dat.senn2013
fix$senn <- list(study = svec(se$study), treatment = svec(se$treatment), ni = vec(se$ni), mi = vec(se$mi), sdi = vec(se$sdi))
sew <- to.wide(se, study = "study", grp = "treatment", ref = "placebo", grpvars = c("ni", "mi", "sdi"))
sew <- escalc(measure = "MD", m1i = mi.1, sd1i = sdi.1, n1i = ni.1, m2i = mi.2, sd2i = sdi.2, n2i = ni.2, data = sew)
calc.v.md <- function(x) { v <- matrix(x$sdi.2[1]^2 / x$ni.2[1], nrow = nrow(x), ncol = nrow(x)); diag(v) <- x$vi; v }
Vse <- bldiag(lapply(split(sew, sew$study), calc.v.md))
sew <- contrmat(sew, grp1 = "treatment.1", grp2 = "treatment.2")
f <- ~ acarbose + benfluorex + metformin + miglitol + pioglitazone + rosiglitazone + sitagliptin + sulfonylurea + vildagliptin - 1
se_re <- rma.mv(yi, Vse, mods = f, random = ~ comp | study, rho = 1/2, data = sew)
se_fe <- rma.mv(yi, Vse, mods = f, data = sew)
out$nma$senn_re <- nma(se_re)
out$nma$senn_fe <- nma(se_fe)
out$nma$senn_re$pscore <- vec(pscore(coef(se_re), vcov(se_re), smallerBetter = TRUE))
out$nma$senn_fe$within <- qwithin(sew, Vse)

writeLines(js(out), "tests/reference/reference-metafor.json")
writeLines(js(fix), "tests/fixtures/metadat.json")
cat("Hotovo.\n")
