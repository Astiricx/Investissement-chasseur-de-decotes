/* Modèle commun des pages de synthèse (dossier analyses/) : la page est construite à partir de la fiche publiée
   (js/analyses-publiees.js), des modules de calcul de l'application (js/calc.js, js/methodes.js) et d'une
   configuration de textes propre à chaque société. Aucun chiffre calculé n'est recopié à la main. */
const fs = require("fs"), path = require("path");

const nb = (x, d = 0) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(x);
const pct = (x, d = 1) => nb(x * 100, d) + " %";
const sig = (x, d = 1) => (x > 0 ? "+" : x < 0 ? "−" : "") + nb(Math.abs(x) * 100, d) + " %";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const BADGE = { ok: ["✓ Conforme", "ok"], vigilance: ["! À surveiller", "vg"], alerte: ["✕ Alerte", "ko"], incomplet: ["– Incomplet", ""], na: ["– Sans objet", ""] };

/** Place les étiquettes de l'échelle sans chevauchement (deux rangées, trois ancrages possibles). */
function placer(reperes, X, W) {
  const rangs = { haut: [], bas: [] }, larg = (p) => Math.max(p.nom.length * 7.4, p.texte.length * 6.8) + 4;
  for (const p of reperes) {
    const autre = p.rang === "haut" ? "bas" : "haut";
    const essais = [p.rang, autre].flatMap((r) => ["middle", "start", "end"].map((a) => [r, a]));
    const x = X(p.val);
    for (const [r, a] of essais) {
      const w = larg(p), g = a === "middle" ? x - w / 2 : a === "start" ? x + 4 : x - 4 - w, d = g + w;
      if (g < 2 || d > W - 2) continue;
      if (rangs[r].some(([g2, d2]) => !(d + 6 < g2 || g - 6 > d2))) continue;
      rangs[r].push([g, d]); Object.assign(p, { rangFinal: r, ancre: a, x }); break;
    }
    if (!p.rangFinal) Object.assign(p, { rangFinal: p.rang, ancre: "middle", x });
  }
  return reperes;
}

function echelle(r, v, unite, netNet, etroit) {
  const W = etroit ? 320 : 660, haut = Math.max(r.vantParAction, r.vaneParAction || 0, v.cours) * 1.06;
  const pas = [1, 2, 2.5, 5, 10].map((m) => m * 10 ** Math.floor(Math.log10(haut / (etroit ? 3 : 6)))).find((p) => haut / p <= (etroit ? 4 : 7));
  const max = Math.ceil(haut / pas) * pas, X = (x) => 24 + ((W - 48) * x) / max;
  const pm = netNet ? r.prixMaxNetNet : r.prixMaxNetEstate;
  const reperes = placer([
    { nom: "Cours", val: v.cours, rang: "haut", cours: true },
    { nom: etroit ? "Prix max (70 %)" : `Prix max (70 % ${netNet ? "VANN" : "VANE"})`, val: pm, rang: "bas" },
    { nom: "VANN", val: r.vannParAction, rang: "bas" },
    { nom: "VANE", val: r.vaneParAction, rang: "haut" },
    { nom: etroit ? "VANT" : "VANT (objectif)", val: r.vantParAction, rang: "haut" },
  ].map((p) => ({ ...p, texte: nb(p.val) + " " + unite })).sort((a, b) => a.val - b.val), X, W);
  const o = [`<svg class="echelle ${etroit ? "echelle-etroite" : "echelle-large"}" viewBox="0 0 ${W} 148" role="img" aria-label="Cours de ${nb(v.cours)} ${unite} comparé à la VANN (${nb(r.vannParAction)} ${unite}), au prix maximal d'achat (${nb(pm)} ${unite}), à la VANE (${nb(r.vaneParAction)} ${unite}) et à la VANT (${nb(r.vantParAction)} ${unite})">`];
  o.push(`<rect class="zone-achat" x="${X(0)}" y="58" width="${(X(pm) - X(0)).toFixed(1)}" height="16" rx="3"/>`);
  o.push(`<line class="axe" x1="${X(0)}" x2="${X(max)}" y1="66" y2="66"/>`);
  for (let t = 0; t <= max + 1e-9; t += pas) o.push(`<text class="graduation" x="${X(t).toFixed(1)}" y="144" text-anchor="middle">${nb(t)}</text>`);
  for (const p of reperes) {
    const h = p.rangFinal === "haut", x = p.x.toFixed(1), dx = p.ancre === "end" ? -4 : p.ancre === "start" ? 4 : 0;
    o.push(`<line class="repere${p.cours ? " cours" : ""}" x1="${x}" x2="${x}" y1="${h ? 40 : 66}" y2="${h ? 66 : 92}"/>`);
    o.push(`<text class="etiquette${p.cours ? " cours" : ""}" x="${(+x + dx).toFixed(1)}" y="${h ? 18 : 106}" text-anchor="${p.ancre}">${esc(p.nom)}</text>`);
    o.push(`<text class="valeur" x="${(+x + dx).toFixed(1)}" y="${h ? 33 : 120}" text-anchor="${p.ancre}">${p.texte}</text>`);
  }
  o.push("</svg>");
  return o.join("");
}

/** Typographie française : espaces insécables devant les signes doubles et entre un nombre et son unité (texte seulement). */
function typographie(html, unites) {
  const [tete, corps] = html.split("<body");
  const re = new RegExp(`(\\d) (%|${unites.map((u) => u.replace(/[$]/g, "\\$&")).join("|")}|ans|jours|mois|millions|actions|salariés|filiales)(?![\\p{L}])`, "gu");
  const typo = (s) => s.replace(/ ([:;!?»])/g, " $1").replace(/« /g, "« ").replace(/(\d) (?=\d{3}(?!\d))/g, "$1 ").replace(re, "$1 $2");
  return tete + "<body" + corps.replace(/>([^<]+)</g, (m, t) => ">" + typo(t) + "<");
}

/**
 * Génère une page. c : configuration (voir outils/analyses-coree.js). Retourne les résultats de calcul pour contrôle.
 */
function genererPage(racine, c) {
  const D = require(path.join(racine, "js/calc.js"));
  const M = require(path.join(racine, "js/methodes.js"));
  const P = require(path.join(racine, "js/analyses-publiees.js")).find((p) => p.id === c.id);
  const v = P.fiches.vann, rf = P.fiches.rapp, u = c.unite, mu = "M" + u;
  const m = (x) => nb(x) + " " + u, mm = (x, d = 1) => nb(x, d);
  const r = D.analyser(v), netNet = r.verdict.code === "net-net";
  const annees = Array.from({ length: 8 }, (_, i) => Object.fromEntries(["annee", "actions", "chiffreAffaires", "fraisGeneraux", "coutVentes", "stocks", "fondsPropres", "dividende", "cours"].map((k) => [k, rf[`a${i}_${k}`]])));
  const rapp = M.rapp(annees, rf.tsr), R = Object.fromEntries(rapp.ratios.map((x) => [x.cle, x]));
  const scen = c.scenarios.map(([n, o]) => [n, D.analyser({ ...v, ...o })]);
  const ctx = { r, v, rf, R, rapp, annees, m, mm, nb, pct, sig, u, mu, scen };
  const vantNum = v.capitauxPropres - v.incorporels - v.goodwill - v.impotsDifferesActifs;
  const lot = v.cours / c.eur;
  const verdictLigne = (s) => (s.verdict.code === "net-net" ? ["ok", "Net-Net"] : s.verdict.code === "net-estate" ? ["ok", "Net-Estate"] : ["ko", "Attendre"]);
  const T = (x) => (typeof x === "function" ? x(ctx) : x);

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'">
<meta name="referrer" content="no-referrer">
<meta name="color-scheme" content="light dark">
<title>${esc(c.titreCourt)} : analyse Daubasses</title>
<link rel="stylesheet" href="../css/style.css">
<link rel="stylesheet" href="../css/rapport.css">
</head>
<body class="rapport-page">
<header class="entete">
  <div class="entete-int">
    <div class="marque">
      <span class="logo" aria-hidden="true"></span>
      <div><p class="marque-nom">Chasseur de décotes</p><p class="marque-sous">Analyse publiée</p></div>
      <a class="retour" href="../index.html">← Application</a>
    </div>
  </div>
</header>
<main>
  <div class="vue">
  <div>
    <h1>${esc(c.titre)}</h1>
    <p class="sous-titre">${T(c.sousTitre)}</p>
  </div>

  <div class="bloc verdict ${c.classeVerdict || "v-achat"}">
    <p class="verdict-titre">Verdict de la méthode</p>
    <p class="verdict-texte">${T(c.verdictTexte)}</p>
    <p>${T(c.verdictDetail)}</p>
  </div>

  <div class="tuiles">
    <div class="indic"><p class="indic-titre">VANN par action</p><p class="indic-valeur">${m(r.vannParAction)}</p><p class="indic-detail">Cours = ${pct(r.coursSurVann)} de la VANN</p></div>
    <div class="indic"><p class="indic-titre">VANE par action</p><p class="indic-valeur">${m(r.vaneParAction)}</p><p class="indic-detail">Cours = ${pct(r.coursSurVane)} de la VANE</p></div>
    <div class="indic"><p class="indic-titre">VANT (objectif)</p><p class="indic-valeur">${m(r.vantParAction)}</p><p class="indic-detail">Potentiel ${sig(r.potentiel, 0)}</p></div>
    <div class="indic"><p class="indic-titre">Solvabilité maison</p><p class="indic-valeur">${pct(r.solvabilite)}</p><p class="indic-detail">Minimum de la méthode : 40 %</p></div>
  </div>

  <section class="bloc">
    <h2>Le cours face aux valeurs de la méthode</h2>
    ${echelle(r, v, u, netNet, false)}${echelle(r, v, u, netNet, true)}
    <p class="note">Zone verte : prix auxquels la méthode autorise l'achat (70 % de la ${netNet ? "VANN" : "VANE"} ou moins). Valeurs par action, en ${c.uniteLongue}.</p>
  </section>

  <section class="bloc">
    <h2>En bref</h2>
    <ul>${T(c.enBref).map((x) => `\n      <li>${x}</li>`).join("")}
    </ul>
  </section>

  <section class="bloc">
    <h2>1. La société</h2>
    ${T(c.societe)}
  </section>

  <section class="bloc">
    <h2>2. Les chiffres retenus</h2>
    <p class="note">${T(c.noteBilan)}</p>
    <div class="tableau-cadre"><table class="table-simple">
      <thead><tr><th scope="col">Poste</th><th scope="col" class="num">${mu}</th></tr></thead>
      <tbody>${T(c.lignesBilan).map(([n, x, t]) => `<tr${t ? ' class="total"' : ""}><td>${esc(n)}</td><td class="num">${nb(x, 1)}</td></tr>`).join("")}</tbody>
    </table></div>
    <p class="note">${T(c.noteBilan2)}</p>
  </section>

  <section class="bloc">
    <h2>3. Les calculs, pas à pas</h2>
    <p><strong>Actif courant retraité.</strong> ${T(c.retraitement)}</p>
    <p class="calcul">${mm(v.tresorerie)} + ${mm(v.creances)}${v.decoteCreances ? ` × ${nb((1 - v.decoteCreances) * 100)} %` : ""} + ${mm(v.stocks)}${v.decoteStocks ? ` × ${nb((1 - v.decoteStocks) * 100)} %` : ""} + ${mm(v.autresActifsCourants)} = <strong>${mm(r.actifCourantRetraite)} ${mu}</strong></p>
    <p><strong>VANN</strong> = actif courant retraité − dettes totales − provisions − minoritaires</p>
    <p class="calcul">${mm(r.actifCourantRetraite)} − ${mm(v.dettesTotales)} − ${mm(v.provisions)} − ${mm(v.minoritaires)} = <strong>${mm(r.vann)} ${mu}</strong>, soit <strong>${m(r.vannParAction)}</strong> par action (${nb(v.nbActions * 1e6)} actions hors autocontrôle). Prix maximal Net-Net (70 %) : <strong>${m(r.prixMaxNetNet)}</strong>.</p>
    <p><strong>VANE</strong> = VANN + 80 % du prix d'achat historique des immeubles</p>
    <p class="calcul">${mm(r.vann)} + 80 % × ${mm(v.immeublesPrixAchat)} = <strong>${mm(r.vane)} ${mu}</strong>, soit <strong>${m(r.vaneParAction)}</strong> par action. Prix maximal Net-Estate (70 %) : ${m(r.prixMaxNetEstate)}.</p>
    <p><strong>VANT</strong> = capitaux propres − incorporels − goodwill − impôts différés actifs</p>
    <p class="calcul">${mm(v.capitauxPropres)} − ${mm(v.incorporels)} − ${mm(v.goodwill)} − ${mm(v.impotsDifferesActifs)} = <strong>${mm(vantNum)} ${mu}</strong>, soit <strong>${m(r.vantParAction)}</strong> par action (objectif de vente).</p>
    <p><strong>Solvabilité maison</strong> = fonds propres (avec minoritaires) ÷ (total du bilan − trésorerie)</p>
    <p class="calcul">${mm(v.capitauxPropres + v.minoritaires)} ÷ (${mm(v.totalBilan)} − ${mm(v.tresorerie)}) = <strong>${pct(r.solvabilite)}</strong> (solvabilité classique : ${pct(r.solvabiliteClassique)})</p>
    <div class="tableau-cadre"><table class="table-simple">
      <thead><tr><th scope="col">Filtre de la méthode</th><th scope="col" class="num">Résultat</th></tr></thead>
      <tbody>
        <tr><td>Fonds de roulement net positif (${nb(r.fondsDeRoulementNet)} ${mu})</td><td class="num ${r.filtres.fondsDeRoulementPositif ? "ok\">✓ Oui" : "ko\">✕ Non"}</td></tr>
        <tr><td>Solvabilité maison d'au moins 40 %</td><td class="num ${r.filtres.solvabiliteSuffisante ? "ok\">✓ Oui" : "ko\">✕ Non"}</td></tr>
        <tr><td>Chiffre d'affaires d'au moins 5 % de la VANN</td><td class="num ${r.filtres.chiffreAffairesSuffisant ? "ok\">✓ Oui" : "ko\">✕ Non"}</td></tr>
        <tr><td>Cours à 70 % ou moins de la VANN (Net-Net)</td><td class="num ${r.filtres.decoteNetNet ? `ok">✓ Oui (${pct(r.coursSurVann)})` : `ko">✕ Non (${pct(r.coursSurVann)})`}</td></tr>
        <tr><td>Cours à 70 % ou moins de la VANE (Net-Estate)</td><td class="num ${r.filtres.decoteNetEstate ? `ok">✓ Oui (${pct(r.coursSurVane)})` : `ko">✕ Non (${pct(r.coursSurVane)})`}</td></tr>
      </tbody>
    </table></div>
  </section>

  <section class="bloc">
    <h2>4. Sensibilité : le verdict tient-il ?</h2>
    <div class="tableau-cadre"><table class="table-simple">
      <thead><tr><th scope="col">Hypothèse</th><th scope="col" class="num">VANN</th><th scope="col" class="num">Cours ÷ VANN</th><th scope="col" class="num">Prix max Net-Net</th><th scope="col" class="num">Verdict</th></tr></thead>
      <tbody>${scen.map(([n, s]) => `<tr><td>${esc(n)}</td><td class="num">${m(s.vannParAction)}</td><td class="num">${pct(s.coursSurVann)}</td><td class="num">${m(s.prixMaxNetNet)}</td><td class="num ${verdictLigne(s)[0]}">${verdictLigne(s)[1]}</td></tr>`).join("")}</tbody>
    </table></div>
    ${T(c.sensibilite)}
  </section>

  <section class="bloc">
    <h2>5. RAPP : la direction sur huit exercices</h2>
    <p class="note">${T(c.noteRapp)} Taux sans risque : ${T(c.tauxSansRisque)}.</p>
    <div class="tableau-cadre"><table class="table-simple">
      <thead><tr><th scope="col">Exercice</th>${annees.map((a) => `<th scope="col" class="num">${a.annee}</th>`).join("")}</tr></thead>
      <tbody>
        <tr><td>Actions (millions)</td>${annees.map((a) => `<td class="num">${nb(a.actions, 3)}</td>`).join("")}</tr>
        <tr><td>Chiffre d'affaires (Md${u})</td>${annees.map((a) => `<td class="num">${nb(a.chiffreAffaires / 1000, 1)}</td>`).join("")}</tr>
        <tr><td>Frais généraux ÷ CA</td>${annees.map((a) => `<td class="num">${pct(a.fraisGeneraux / a.chiffreAffaires)}</td>`).join("")}</tr>
        <tr><td>Durée de stockage (jours)</td>${annees.map((a) => `<td class="num">${nb((a.stocks / a.coutVentes) * 365)}</td>`).join("")}</tr>
        <tr><td>Fonds propres par action</td>${annees.map((a) => `<td class="num">${nb(a.fondsPropres / a.actions)}</td>`).join("")}</tr>
        <tr><td>Dividende par action</td>${annees.map((a) => `<td class="num">${nb(a.dividende)}</td>`).join("")}</tr>
        <tr><td>Cours fin décembre</td>${annees.map((a) => `<td class="num">${nb(a.cours)}</td>`).join("")}</tr>
      </tbody>
    </table></div>
    <div class="tableau-cadre"><table class="table-simple">
      <thead><tr><th scope="col">Ratio</th><th scope="col">Constat</th><th scope="col" class="num">Verdict</th></tr></thead>
      <tbody>${["actions", "frais", "stocks", "creation"].map((k) => `\n        <tr><td>${esc(R[k].titre)}</td><td>${c.constats[k](ctx)}</td><td class="num ${BADGE[R[k].verdict][1]}">${BADGE[R[k].verdict][0]}</td></tr>`).join("")}
      </tbody>
    </table></div>
  </section>

  <section class="bloc">
    <h2>6. Ce que les formules ne disent pas</h2>
    <ul>${T(c.horsFormules).map((x) => `\n      <li>${x}</li>`).join("")}
    </ul>
  </section>

  <section class="bloc">
    <h2>7. Un plan mécanique, si vous décidez d'acheter</h2>
    <ul>
      <li>N'acheter qu'à ${m(netNet ? r.prixMaxNetNet : r.prixMaxNetEstate)} ou moins (70 % de la ${netNet ? "VANN" : "VANE"}), avec un ordre à cours limité, sur un compte-titres donnant accès à la Bourse de Séoul : le titre n'est pas éligible au PEA. En Corée, on peut acheter une seule action à la fois (environ ${nb(lot, 2)} € au cours actuel, 1 € ≈ ${nb(c.eur, 1)} ${u}).</li>
      <li>Taille de ligne : 5 % du portefeuille au plus. ${T(c.liquidite)}</li>
      <li>Objectif de vente : la VANT, soit ${m(r.vantParAction)}. Vendre aussi si le potentiel restant passe sous 20 % (cours au-dessus d'environ ${m(r.vantParAction / 1.2)} à VANT inchangée), ou si la solvabilité passe sous 40 %.</li>${T(c.planPlus || []).map((x) => `\n      <li>${x}</li>`).join("")}
      <li>Dans l'application : onglet Analyse, puis « Analyses publiées » et « ${esc(P.societe)} ». Les outils VANN / VANE et RAPP se remplissent en ${c.uniteLongue}, et vous pouvez enregistrer la fiche dans votre coffre.</li>
    </ul>
  </section>

  <section class="bloc">
    <h2>Sources</h2>
    <ul class="sources">${T(c.sources).map((x) => `\n      <li>${x}</li>`).join("")}
    </ul>
  </section>

  <p class="note">Analyse d'application d'une méthode, préparée à partir des comptes publiés : ce n'est pas un conseil en investissement. Vérifiez les chiffres dans les documents d'origine avant toute décision.</p>
  </div>
</main>
</body>
</html>
`;
  fs.writeFileSync(path.join(racine, P.page), typographie(html, [u, mu, "Md" + u, "€"]));
  return { r, rapp, R, scen, P };
}

module.exports = { genererPage, nb, pct, sig, esc };
