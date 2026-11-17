/* Génère analyses/4234-sun-a-kaken.html à partir de la fiche publiée (js/analyses-publiees.js) et des modules
   de calcul de l'application (js/calc.js, js/methodes.js) : aucun chiffre calculé n'est recopié à la main.
   Usage : node outils/analyse-4234-sun-a-kaken.js */
const fs = require("fs"), path = require("path");
const racine = process.argv[2] || path.join(__dirname, "..");
const D = require(path.join(racine, "js/calc.js"));
const M = require(path.join(racine, "js/methodes.js"));
const P = require(path.join(racine, "js/analyses-publiees.js")).find((p) => p.id === "4234-sun-a-kaken");
const v = P.fiches.vann, rf = P.fiches.rapp;

const nb = (x, d = 0) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(x);
const yen = (x) => nb(x) + " ¥";
const pct = (x, d = 1) => nb(x * 100, d) + " %";
const sig = (x, d = 1) => (x > 0 ? "+" : x < 0 ? "−" : "") + nb(Math.abs(x) * 100, d) + " %";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Données complémentaires (millions de yens), hors fiche : sources dans la page.
const TERRAINS = 2462.7, BATIMENTS_BRUTS = 12954.4, BATIMENTS_AMORTIS = 10454.1, BATIMENTS_NETS_SEPT = 2488.1;
const EMPRUNTS = 3810.0 + 481.5, IMPOTS_DIFFERES_PASSIFS_MARS = 1781.7;
const TITRES = 7953.8, ACTIF_RETRAITE = 2104.9, PART_SHOWA = 0.193 * 4.389975 * 2992; // ≈ 19,3 % de Showa Paxxs au cours du 16/11
const ACTIONS_EMISES = 11320000, AUTOCONTROLE = 1660793;
const COURS_OCT_2025 = 572; // clôture de fin octobre 2025 (Kabutan, mensuel)
const COEUR = [17519.6, 15983.9, 16887.4, 18307.7, 17739.8, 17808.9, 17392.5, 18189.5]; // capitaux propres « de base » (株主資本)

const r = D.analyser(v);
const scen = [
  ["Retenu : aucune décote sur les stocks", r],
  ["Stocks décotés de 20 %", D.analyser({ ...v, decoteStocks: 0.2 })],
  ["Stocks décotés de 20 % et créances de 10 %", D.analyser({ ...v, decoteStocks: 0.2, decoteCreances: 0.1 })],
  ["Stocks décotés de 50 %", D.analyser({ ...v, decoteStocks: 0.5 })],
  ["Terrains seuls (bâtiments exclus)", D.analyser({ ...v, immeublesPrixAchat: TERRAINS })],
];
const annees = Array.from({ length: 8 }, (_, i) => Object.fromEntries(["annee", "actions", "chiffreAffaires", "fraisGeneraux", "coutVentes", "stocks", "fondsPropres", "dividende", "cours"].map((k) => [k, rf[`a${i}_${k}`]])));
const rapp = M.rapp(annees, rf.tsr);
const R = Object.fromEntries(rapp.ratios.map((x) => [x.cle, x]));
const coeur = M.rapp(annees.map((a, i) => ({ annee: a.annee, actions: a.actions, fondsPropres: COEUR[i], dividende: a.dividende, cours: a.cours })), rf.tsr).ratios[3];
const jours = annees.map((a) => (a.stocks / a.coutVentes) * 365);
const ref35 = jours.slice(-6, -1).reduce((s, x) => s + x, 0) / 5; // moyenne des 5 exercices précédents (règle de décote)
const joursS1 = (v.stocks / (14574.3 * 2)) * 365; // stocks au 30/09 ÷ coût des ventes du semestre annualisé
const actifCourant = v.tresorerie + v.creances + v.stocks + v.autresActifsCourants;
const vantNum = v.capitauxPropres - v.incorporels - v.goodwill - v.impotsDifferesActifs;
const lot = 100 * v.cours, eurJpy = 176.8;
const poidsBatiments = (0.8 * BATIMENTS_BRUTS) / r.vane;
const badge = (verdict) => ({ ok: ["✓ Conforme", "ok"], vigilance: ["! À surveiller", "vg"], alerte: ["✕ Alerte", "ko"], incomplet: ["– Incomplet", ""], na: ["– Sans objet", ""] }[verdict]);

// Échelle de valeur (SVG statique, couleurs par classes CSS) : un dessin large (ordinateur) et un étroit (téléphone).
const echelle = () => dessin(660, false) + dessin(320, true);
function dessin(W, etroit) {
  const max = 3000, X = (x) => 24 + ((W - 48) * x) / max;
  const reperes = [
    { nom: "VANN", val: r.vannParAction, haut: false, ancre: "end" },
    { nom: "Cours", val: v.cours, haut: true, ancre: "end", cours: true },
    { nom: etroit ? "Prix max (70 %)" : "Prix max (70 % VANE)", val: r.prixMaxNetEstate, haut: false, ancre: "start" },
    { nom: "VANE", val: r.vaneParAction, haut: true, ancre: "middle" },
    { nom: etroit ? "VANT" : "VANT (objectif)", val: r.vantParAction, haut: true, ancre: "start" },
  ];
  const o = [`<svg class="echelle ${etroit ? "echelle-etroite" : "echelle-large"}" viewBox="0 0 ${W} 148" role="img" aria-label="Cours de ${yen(v.cours)} comparé à la VANN (${yen(r.vannParAction)}), au prix maximal d'achat (${yen(r.prixMaxNetEstate)}), à la VANE (${yen(r.vaneParAction)}) et à la VANT (${yen(r.vantParAction)})">`];
  o.push(`<rect class="zone-achat" x="${X(0)}" y="58" width="${(X(r.prixMaxNetEstate) - X(0)).toFixed(1)}" height="16" rx="3"/>`);
  o.push(`<line class="axe" x1="${X(0)}" x2="${X(max)}" y1="66" y2="66"/>`);
  for (let t = 0; t <= max; t += etroit ? 1000 : 500) o.push(`<text class="graduation" x="${X(t).toFixed(1)}" y="144" text-anchor="middle">${nb(t)}</text>`);
  for (const p of reperes) {
    const x = X(p.val).toFixed(1);
    o.push(`<line class="repere${p.cours ? " cours" : ""}" x1="${x}" x2="${x}" y1="${p.haut ? 40 : 66}" y2="${p.haut ? 66 : 92}"/>`);
    const dx = p.ancre === "end" ? -4 : p.ancre === "start" ? 4 : 0;
    o.push(`<text class="etiquette${p.cours ? " cours" : ""}" x="${(+x + dx).toFixed(1)}" y="${p.haut ? 18 : 106}" text-anchor="${p.ancre}">${esc(p.nom)}</text>`);
    o.push(`<text class="valeur" x="${(+x + dx).toFixed(1)}" y="${p.haut ? 33 : 120}" text-anchor="${p.ancre}">${yen(p.val)}</text>`);
  }
  o.push("</svg>");
  return o.join("");
}

const lignesBilan = [
  ["Trésorerie et dépôts", v.tresorerie],
  ["Créances : effets, créances électroniques et comptes clients (nettes de 20,0 M¥ de provisions)", v.creances],
  ["Stocks (produits, en-cours, matières)", v.stocks],
  ["Autres actifs courants", v.autresActifsCourants],
  ["Total de l'actif courant", actifCourant, true],
  [`Dettes totales (dont ${nb(EMPRUNTS, 1)} M¥ d'emprunts bancaires et les impôts différés passifs)`, v.dettesTotales],
  ["Intérêts minoritaires", v.minoritaires],
  ["Capitaux propres part du groupe", v.capitauxPropres],
  ["Immobilisations incorporelles (actifs technologiques 215,7 ; autres 51,8)", v.incorporels],
  ["Goodwill (écart d'acquisition)", v.goodwill],
  ["Impôts différés actifs (non présentés à part)", v.impotsDifferesActifs],
  ["Total du bilan", v.totalBilan],
  ["Terrains (coût historique, pas de réévaluation)", TERRAINS],
  [`Bâtiments et constructions, valeur brute au 31 mars 2026 (avant ${nb(BATIMENTS_AMORTIS, 1)} M¥ d'amortissements)`, BATIMENTS_BRUTS],
];

const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'">
<meta name="referrer" content="no-referrer">
<meta name="color-scheme" content="light dark">
<title>Sun A. Kaken (4234) : analyse Daubasses</title>
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
    <h1>Sun A. Kaken (4234, Bourse de Tokyo)</h1>
    <p class="sous-titre">Analyse selon la méthode des Daubasses · 17 novembre 2026 · cours de clôture du 17 novembre : ${yen(v.cours)} (Kabutan) · bilan au 30 septembre 2026 · ISIN JP3324600000</p>
  </div>

  <div class="bloc verdict v-achat">
    <p class="verdict-titre">Verdict de la méthode</p>
    <p class="verdict-texte">Net-Estate dans la zone d'achat : le cours vaut ${pct(r.coursSurVane)} de la VANE (seuil 70 %). Ce n'est pas un Net-Net.</p>
    <p>Prix d'achat maximal : <strong>${yen(r.prixMaxNetEstate)}</strong>, soit ${nb((r.prixMaxNetEstate / v.cours - 1) * 100, 0)} % au-dessus du cours. Objectif de vente (VANT) : <strong>${yen(r.vantParAction)}</strong>, soit ${sig(r.potentiel, 0)}. La marge repose sur des bâtiments amortis à ${nb((BATIMENTS_AMORTIS / BATIMENTS_BRUTS) * 100, 0)} %, et le cours a doublé en un an : voir la sensibilité et les risques.</p>
  </div>

  <div class="tuiles">
    <div class="indic"><p class="indic-titre">VANN par action</p><p class="indic-valeur">${yen(r.vannParAction)}</p><p class="indic-detail">Cours = ${pct(r.coursSurVann)} de la VANN</p></div>
    <div class="indic"><p class="indic-titre">VANE par action</p><p class="indic-valeur">${yen(r.vaneParAction)}</p><p class="indic-detail">Cours = ${pct(r.coursSurVane)} de la VANE</p></div>
    <div class="indic"><p class="indic-titre">VANT (objectif)</p><p class="indic-valeur">${yen(r.vantParAction)}</p><p class="indic-detail">Potentiel ${sig(r.potentiel, 0)}</p></div>
    <div class="indic"><p class="indic-titre">Solvabilité maison</p><p class="indic-valeur">${pct(r.solvabilite)}</p><p class="indic-detail">Minimum de la méthode : 40 %</p></div>
  </div>

  <section class="bloc">
    <h2>Le cours face aux valeurs de la méthode</h2>
    ${echelle()}
    <p class="note">Zone verte : prix auxquels la méthode autorise l'achat (70 % de la VANE ou moins). Valeurs par action, en yens.</p>
  </section>

  <section class="bloc">
    <h2>En bref</h2>
    <ul>
      <li><strong>Pas un Net-Net :</strong> le cours vaut ${pct(r.coursSurVann, 0)} de la VANN. Le prix maximal Net-Net serait ${yen(r.prixMaxNetNet)}.</li>
      <li><strong>Net-Estate avec une marge correcte :</strong> avec ${nb(TERRAINS + BATIMENTS_BRUTS)} M¥ d'immobilier au prix d'achat historique (terrains ${nb(TERRAINS)} M¥, bâtiments ${nb(BATIMENTS_BRUTS)} M¥ bruts), le cours tombe à ${pct(r.coursSurVane)} de la VANE. Le verdict résiste à une décote de 20 % sur les stocks, mais pas à une décote de 50 %, ni au retrait des bâtiments.</li>
      <li><strong>Bilan solide :</strong> solvabilité maison de ${pct(r.solvabilite)}, ${nb(v.tresorerie)} M¥ de trésorerie pour ${nb(EMPRUNTS)} M¥ d'emprunts bancaires.</li>
      <li><strong>Résultats en forte hausse :</strong> premier semestre 2026-2027 avec un résultat d'exploitation multiplié par 5. La société vise un résultat net record de 2 200 M¥ (228 ¥ par action, soit 5,1 fois le cours) et relève son dividende de 18 à 24 ¥.</li>
      <li><strong>Direction (RAPP) :</strong> ${rapp.synthese.ok} ratios conformes sur 4 (rachats d'actions, frais tenus). Points à surveiller : des stocks qui tournent plus lentement qu'en 2019, et une création de valeur modeste sur sept ans.</li>
      <li><strong>Le marché a déjà réagi :</strong> ${yen(COURS_OCT_2025)} fin octobre 2025, ${yen(v.cours)} aujourd'hui (${sig(v.cours / COURS_OCT_2025 - 1, 0)}), dont un plafond de hausse journalière le 13 novembre à l'annonce des résultats.</li>
      <li><strong>En pratique :</strong> un lot de 100 actions coûte ${nb(lot)} ¥, soit environ ${nb(lot / eurJpy)} € (1 € ≈ ${nb(eurJpy, 1)} ¥). Hors annonces, il s'échange de 15 000 à 65 000 actions par jour. Le titre n'est pas éligible au PEA.</li>
    </ul>
  </section>

  <section class="bloc">
    <h2>1. La société</h2>
    <p>Sun A. Kaken (サンエー化研), basée à Tokyo, transforme des plastiques en films et en emballages. Elle a trois activités. Les chiffres sont ceux du premier semestre 2026-2027 (avril à septembre).</p>
    <div class="tableau-cadre"><table class="table-simple">
      <thead><tr><th scope="col">Activité</th><th scope="col" class="num">Ventes (M¥)</th><th scope="col" class="num">Résultat (M¥)</th><th scope="col" class="num">Résultat un an plus tôt</th></tr></thead>
      <tbody>
        <tr><td>Emballages légers (films et sachets d'emballage)</td><td class="num">7 178,8</td><td class="num">793,6</td><td class="num">205,2</td></tr>
        <tr><td>Matériaux industriels</td><td class="num">6 142,2</td><td class="num">491,5</td><td class="num">117,2</td></tr>
        <tr><td>Matériaux fonctionnels (films techniques, notamment pour l'électronique et les écrans)</td><td class="num">4 684,9</td><td class="num">625,8</td><td class="num">14,9</td></tr>
        <tr><td>Autres</td><td class="num">212,7</td><td class="num">11,9</td><td class="num">48,0</td></tr>
      </tbody>
    </table></div>
    <p>Actionnariat (septembre 2026) : Shinsei Pulp &amp; Paper Trading 18,8 %, Showa Paxxs 13,9 %, plan d'épargne des salariés 3,4 %, Toyo Kagaku 3,1 %, puis des banques fiduciaires. Sun A. Kaken détient elle-même environ 19 % de <a href="3954-showa-paxxs.html">Showa Paxxs</a>, analysée la veille. Capitalisation : environ ${nb((v.cours * v.nbActions) / 1000, 1)} Md¥ (environ ${nb((v.cours * v.nbActions) / eurJpy)} M€), sur ${nb(ACTIONS_EMISES - AUTOCONTROLE)} actions hors autocontrôle (${nb(ACTIONS_EMISES)} émises). Le cours vaut ${nb(v.cours / (v.capitauxPropres / v.nbActions), 2)} fois les fonds propres comptables.</p>
    <p>Résultats : sur l'exercice clos en mars 2026, ventes de 30 358 M¥, résultat d'exploitation de 837 M¥ et résultat net de 957 M¥. Au premier semestre en cours, les ventes progressent de 17,3 % (18 219 M¥), le résultat d'exploitation passe de 385 à 1 923 M¥ et le résultat net de 384 à 1 445 M¥. Selon la société, les commandes de produits destinés aux composants électroniques sont fortes. Le contrecoup attendu après les stocks de précaution constitués au premier trimestre (tensions au Moyen-Orient) a aussi été plus faible que prévu.</p>
    <p>Prévisions relevées le 13 novembre pour l'exercice : 35 000 M¥ de ventes, 2 800 M¥ de résultat d'exploitation, 2 200 M¥ de résultat net, un record depuis 21 ans. Elles supposent un second semestre nettement moins rentable que le premier (878 M¥ de résultat d'exploitation, contre 1 923). Dividende : 24 ¥ (12 + 12), soit un rendement de ${pct(24 / v.cours)}.</p>
  </section>

  <section class="bloc">
    <h2>2. Les chiffres retenus</h2>
    <p class="note">Bilan consolidé au 30 septembre 2026, en millions de yens. Source : rapport semestriel (kessan tanshin) du 13 novembre 2026. Le rapport semestriel ne donne pas la valeur brute des bâtiments : c'est celle du rapport annuel au 31 mars 2026. Leur valeur nette n'a presque pas bougé depuis (${nb(2500.3, 1)} → ${nb(BATIMENTS_NETS_SEPT, 1)} M¥).</p>
    <div class="tableau-cadre"><table class="table-simple">
      <thead><tr><th scope="col">Poste</th><th scope="col" class="num">M¥</th></tr></thead>
      <tbody>${lignesBilan.map(([n, x, t]) => `<tr${t ? ' class="total"' : ""}><td>${esc(n)}</td><td class="num">${nb(x, 1)}</td></tr>`).join("")}</tbody>
    </table></div>
    <p class="note">Les provisions japonaises (primes, retraite des dirigeants) figurent déjà dans les dettes : aucune provision n'est déduite une seconde fois. Les impôts différés passifs (${nb(IMPOTS_DIFFERES_PASSIFS_MARS, 1)} M¥ au 31 mars 2026) restent dans les dettes, ce qui est prudent.</p>
  </section>

  <section class="bloc">
    <h2>3. Les calculs, pas à pas</h2>
    <p><strong>Actif courant retraité.</strong> Aucune décote sur les stocks. La règle du cours compare la durée de stockage du dernier exercice (${nb(jours[7], 0)} jours) à la moyenne des cinq précédents (${nb(ref35, 1)} jours) : elle ne la dépasse pas de plus de 10 %. La durée est stable autour de 70 jours depuis 2023 (${nb(joursS1, 0)} jours au premier semestre, en rythme annuel). Les créances ne sont pas décotées non plus : elles sont nettes de provisions et leur délai de paiement baisse (4,7 mois en 2024, 4,3 mois en 2026).</p>
    <p class="calcul">${nb(v.tresorerie, 1)} + ${nb(v.creances, 1)} + ${nb(v.stocks, 1)} + ${nb(v.autresActifsCourants, 1)} = <strong>${nb(r.actifCourantRetraite, 1)} M¥</strong></p>
    <p><strong>VANN</strong> = actif courant retraité − dettes totales − provisions − minoritaires</p>
    <p class="calcul">${nb(r.actifCourantRetraite, 1)} − ${nb(v.dettesTotales, 1)} − 0 − ${nb(v.minoritaires, 1)} = <strong>${nb(r.vann, 1)} M¥</strong>, soit <strong>${yen(r.vannParAction)}</strong> par action. Prix maximal Net-Net (70 %) : ${yen(r.prixMaxNetNet)}.</p>
    <p><strong>VANE</strong> = VANN + 80 % du prix d'achat historique des immeubles (terrains et bâtiments bruts)</p>
    <p class="calcul">${nb(r.vann, 1)} + 80 % × ${nb(v.immeublesPrixAchat, 1)} = <strong>${nb(r.vane, 1)} M¥</strong>, soit <strong>${yen(r.vaneParAction)}</strong> par action. Prix maximal Net-Estate (70 %) : <strong>${yen(r.prixMaxNetEstate)}</strong>.</p>
    <p><strong>VANT</strong> = capitaux propres − incorporels − goodwill − impôts différés actifs</p>
    <p class="calcul">${nb(v.capitauxPropres, 1)} − ${nb(v.incorporels, 1)} − ${nb(v.goodwill, 1)} − ${nb(v.impotsDifferesActifs, 1)} = <strong>${nb(vantNum, 1)} M¥</strong>, soit <strong>${yen(r.vantParAction)}</strong> par action (objectif de vente).</p>
    <p><strong>Solvabilité maison</strong> = fonds propres (avec minoritaires) ÷ (total du bilan − trésorerie)</p>
    <p class="calcul">${nb(v.capitauxPropres + v.minoritaires, 1)} ÷ (${nb(v.totalBilan, 1)} − ${nb(v.tresorerie, 1)}) = <strong>${pct(r.solvabilite)}</strong> (solvabilité classique : ${pct(r.solvabiliteClassique)})</p>
    <div class="tableau-cadre"><table class="table-simple">
      <thead><tr><th scope="col">Filtre de la méthode</th><th scope="col" class="num">Résultat</th></tr></thead>
      <tbody>
        <tr><td>Fonds de roulement net positif (${nb(r.fondsDeRoulementNet, 0)} M¥)</td><td class="num ok">✓ Oui</td></tr>
        <tr><td>Solvabilité maison d'au moins 40 %</td><td class="num ok">✓ Oui</td></tr>
        <tr><td>Chiffre d'affaires d'au moins 5 % de la VANN</td><td class="num ok">✓ Oui</td></tr>
        <tr><td>Cours à 70 % ou moins de la VANN (Net-Net)</td><td class="num ko">✕ Non (${pct(r.coursSurVann)})</td></tr>
        <tr><td>Cours à 70 % ou moins de la VANE (Net-Estate)</td><td class="num ok">✓ Oui (${pct(r.coursSurVane)})</td></tr>
      </tbody>
    </table></div>
  </section>

  <section class="bloc">
    <h2>4. Sensibilité : le verdict tient-il ?</h2>
    <div class="tableau-cadre"><table class="table-simple">
      <thead><tr><th scope="col">Hypothèse</th><th scope="col" class="num">VANN</th><th scope="col" class="num">VANE</th><th scope="col" class="num">Cours ÷ VANE</th><th scope="col" class="num">Prix max</th><th scope="col" class="num">Verdict</th></tr></thead>
      <tbody>${scen.map(([n, s]) => `<tr><td>${esc(n)}</td><td class="num">${yen(s.vannParAction)}</td><td class="num">${yen(s.vaneParAction)}</td><td class="num">${pct(s.coursSurVane)}</td><td class="num">${yen(s.prixMaxNetEstate)}</td><td class="num ${s.verdict.code === "net-estate" ? "ok" : "ko"}">${s.verdict.code === "net-estate" ? "Net-Estate" : "Attendre"}</td></tr>`).join("")}</tbody>
    </table></div>
    <p>Les bâtiments pèsent ${nb(poidsBatiments * 100, 0)} % de la VANE. Ils ont été achetés ${nb(BATIMENTS_BRUTS)} M¥ mais sont amortis à ${nb((BATIMENTS_AMORTIS / BATIMENTS_BRUTS) * 100, 0)} % (valeur nette : ${nb(BATIMENTS_NETS_SEPT)} M¥) : ce sont pour l'essentiel des usines anciennes, dont la valeur de revente réelle peut être bien inférieure. Le verdict Net-Estate dépend donc de la confiance qu'on leur accorde. Sans eux, le titre vaut ${pct(scen[4][1].coursSurVane, 0)} de la VANE.</p>
  </section>

  <section class="bloc">
    <h2>5. RAPP : la direction sur huit exercices</h2>
    <p class="note">Exercices clos fin mars, en millions de yens (dividende et cours en yens). Chiffres des rapports annuels. Fonds propres = part du groupe (capital, réserves et plus-values latentes). Actions = fonds propres ÷ valeur comptable par action publiée. Taux sans risque : obligation d'État japonaise à 10 ans, ${pct(rf.tsr, 2)} (adjudication du 5 novembre 2026).</p>
    <div class="tableau-cadre"><table class="table-simple">
      <thead><tr><th scope="col">Exercice</th>${annees.map((a) => `<th scope="col" class="num">${a.annee}</th>`).join("")}</tr></thead>
      <tbody>
        <tr><td>Actions (millions)</td>${annees.map((a) => `<td class="num">${nb(a.actions, 2)}</td>`).join("")}</tr>
        <tr><td>Chiffre d'affaires</td>${annees.map((a) => `<td class="num">${nb(a.chiffreAffaires)}</td>`).join("")}</tr>
        <tr><td>Frais généraux ÷ CA</td>${annees.map((a) => `<td class="num">${pct(a.fraisGeneraux / a.chiffreAffaires)}</td>`).join("")}</tr>
        <tr><td>Durée de stockage (jours)</td>${annees.map((a) => `<td class="num">${nb(a.stocks / a.coutVentes * 365, 0)}</td>`).join("")}</tr>
        <tr><td>Fonds propres par action</td>${annees.map((a) => `<td class="num">${nb(a.fondsPropres / a.actions)}</td>`).join("")}</tr>
        <tr><td>Dividende par action</td>${annees.map((a) => `<td class="num">${nb(a.dividende, a.dividende % 1 ? 1 : 0)}</td>`).join("")}</tr>
        <tr><td>Cours fin mars</td>${annees.map((a) => `<td class="num">${nb(a.cours)}</td>`).join("")}</tr>
      </tbody>
    </table></div>
    <div class="tableau-cadre"><table class="table-simple">
      <thead><tr><th scope="col">Ratio</th><th scope="col">Constat</th><th scope="col" class="num">Verdict</th></tr></thead>
      <tbody>
        <tr><td>Nombre d'actions</td><td>${nb(R.actions.debut, 2)} → ${nb(R.actions.fin, 2)} millions (${sig(R.actions.variation)}) : rachats d'actions de 2023 à 2025, aucune dilution.</td><td class="num ${badge(R.actions.verdict)[1]}">${badge(R.actions.verdict)[0]}</td></tr>
        <tr><td>Frais généraux ÷ CA</td><td>${pct(R.frais.debut)} → ${pct(R.frais.fin)}, proche de la moyenne des années précédentes (${pct(R.frais.reference)}). Au premier semestre en cours : ${pct(1721.8 / 18218.7)}.</td><td class="num ${badge(R.frais.verdict)[1]}">${badge(R.frais.verdict)[0]}</td></tr>
        <tr><td>Durée de stockage</td><td>${nb(R.stocks.debut, 0)} → ${nb(R.stocks.fin, 0)} jours, ${sig(R.stocks.variation)} par rapport à la moyenne des sept années précédentes. La hausse date de 2022-2023 ; depuis, la durée est stable, ce qui n'appelle pas de décote selon la règle du cours.</td><td class="num ${badge(R.stocks.verdict)[1]}">${badge(R.stocks.verdict)[0]}</td></tr>
        <tr><td>Création de valeur</td><td>(${nb(R.creation.fin)} − ${nb(R.creation.debut)}) + ${nb(R.creation.dividendes)} ¥ de dividendes = ${yen(R.creation.creation)} en ${R.creation.annees} ans, soit ${sig(R.creation.rendement)} par an. C'est plus que le taux sans risque (${pct(rf.tsr, 2)}), mais moins que le seuil de la méthode (taux sans risque + 3 points = ${pct(rf.tsr + 0.03, 2)}) et que la hausse du cours (${sig(R.creation.hausseCours)} par an). Sans les plus-values latentes sur titres (capitaux propres « de base ») : ${sig(coeur.rendement)} par an. Les sept années comptent deux exercices de pertes (2020 et 2023) ; la valeur comptable par action atteint déjà ${yen(v.capitauxPropres / v.nbActions)} au 30 septembre 2026, et le résultat prévu (228 ¥ par action) l'augmenterait encore nettement.</td><td class="num ${badge(R.creation.verdict)[1]}">${badge(R.creation.verdict)[0]}</td></tr>
      </tbody>
    </table></div>
  </section>

  <section class="bloc">
    <h2>6. Ce que les formules ne disent pas</h2>
    <ul>
      <li><strong>Réserves non comptées :</strong> ${nb(TITRES)} M¥ de titres de participation (environ ${yen(TITRES / v.nbActions)} par action), dont environ ${nb(PART_SHOWA / 1000, 1)} Md¥ pour la part de Showa Paxxs au cours du 16 novembre, et ${nb(ACTIF_RETRAITE)} M¥ d'actif de retraite (${yen(ACTIF_RETRAITE / v.nbActions)} par action). Ils sont exclus de la VANN et de la VANE, alors que les impôts différés passifs qui s'y rattachent sont déduits.</li>
      <li><strong>Participations croisées :</strong> Showa Paxxs détient 13,9 % de Sun A. Kaken, qui détient environ 19 % de Showa Paxxs, et Shinsei Pulp &amp; Paper Trading détient près de 19 % des deux. Cette boucle protège la société d'un rachat hostile et peut faire durer la décote. Elle pourrait aussi déboucher un jour sur un regroupement, mais rien de tel n'est annoncé.</li>
      <li><strong>Des résultats irréguliers :</strong> pertes en 2020 et 2023, résultat d'exploitation négatif en 2024 et 2025, puis un net rebond. Le premier semestre a profité de commandes anticipées. La société elle-même prévoit un second semestre deux fois moins rentable. Les marges dépendent aussi du prix des résines plastiques.</li>
      <li><strong>Trésorerie réelle :</strong> flux d'exploitation de 1 670 M¥ sur l'exercice 2025-2026 pour 500 M¥ d'investissements, mais négatifs en 2023 et 2025. Au premier semestre en cours : 726 M¥, freinés par la hausse des créances liée à celle des ventes.</li>
      <li><strong>Catalyseurs possibles :</strong> dividende relevé de 18 à 24 ¥, rachats d'actions récents, résultat record, et la pression de la Bourse de Tokyo sur les sociétés cotées sous leurs fonds propres. Ce ne sont que des indices, pas des certitudes.</li>
      <li><strong>Un titre devenu spéculatif :</strong> le cours a doublé en un an et beaucoup d'acheteurs sont à crédit (Kabutan affiche un ratio achats/ventes à crédit de 34). Si les résultats déçoivent, la baisse peut être brutale. Pour la méthode, c'est plutôt une occasion d'acheter plus bas.</li>
    </ul>
  </section>

  <section class="bloc">
    <h2>7. Un plan mécanique, si vous décidez d'acheter</h2>
    <ul>
      <li>N'acheter qu'à ${yen(r.prixMaxNetEstate)} ou moins, avec un ordre à cours limité, sur un compte-titres : le titre n'est pas éligible au PEA.</li>
      <li>Taille de ligne : 5 % du portefeuille au plus, par lots de 100 actions (environ ${nb(lot / eurJpy)} € le lot).</li>
      <li>Liquidité : de 15 000 à 65 000 actions par séance hors annonces. Une ligne de plusieurs lots peut se construire en quelques séances, toujours avec un ordre limité, jamais « au marché ».</li>
      <li>Objectif de vente : la VANT, soit ${yen(r.vantParAction)}. Vendre aussi si le potentiel restant passe sous 20 % (cours au-dessus d'environ ${yen(r.vantParAction / 1.2)} à VANT inchangée), ou si la solvabilité passe sous 40 %.</li>
      <li>Revoir l'analyse à chaque publication semestrielle (mai et novembre) : la VANE (bâtiments), la durée de stockage, et les résultats réels face aux prévisions du second semestre.</li>
      <li>Dans l'application : onglet Analyse, puis « Analyses publiées » et « Sun A. Kaken ». Les outils VANN / VANE et RAPP se remplissent, et vous pouvez enregistrer la fiche dans votre coffre.</li>
    </ul>
  </section>

  <section class="bloc">
    <h2>Sources</h2>
    <ul class="sources">
      <li><a href="https://finance-frontend-pc-dist.west.edge.storage-yahoo.jp/disclosure/20261113/20261026555708.pdf">Rapport semestriel au 30 septembre 2026 (kessan tanshin du 13/11/2026)</a> et <a href="https://kabutan.jp/disclosures/pdf/20261113/140120261026556193/">révision des prévisions du 13/11/2026</a></li>
      <li><a href="https://kabutan.jp/disclosures/pdf/20261028/140120261028557442/">Hausse du dividende (28/10/2026)</a> ; Kabutan : <a href="https://kabutan.jp/stock/news?code=4234&amp;b=k202611130025">résultats semestriels</a> et <a href="https://kabutan.jp/stock/news?code=4234&amp;b=n202611130865">raisons de la révision</a></li>
      <li>IR Bank : <a href="https://irbank.net/E01052/results">synthèse sur dix ans</a>, <a href="https://irbank.net/E01052/S100YK61/bs">bilan du rapport annuel 2025-2026</a> (bâtiments bruts, impôts différés), <a href="https://irbank.net/E01052/S100ZFTD/pl">compte de résultat semestriel</a>, <a href="https://irbank.net/E01052/holder">grands actionnaires</a>, rapports annuels 2019 à 2026 (chiffres de la RAPP)</li>
      <li>Kabutan : <a href="https://kabutan.jp/stock/kabuka?code=4234&amp;ashi=day">cours quotidiens</a>, <a href="https://kabutan.jp/stock/kabuka?code=4234&amp;ashi=mon">mensuels</a> (cours de fin mars) et <a href="https://kabutan.jp/stock/finance?code=4234">fonds propres par action</a></li>
      <li><a href="https://www.mof.go.jp/english/policy/jgbs/auction/calendar/eresul/eresul20261105.htm">Ministère des Finances japonais, adjudication des obligations à 10 ans du 05/11/2026</a> (rendement moyen 2,768 %)</li>
      <li><a href="https://www.mitrade.com/insights/news/live-news/article-1-2237028-20261106">Cours EUR/JPY d'environ 176,8 (06/11/2026)</a></li>
    </ul>
  </section>

  <p class="note">Analyse d'application d'une méthode, préparée à partir des comptes publiés : ce n'est pas un conseil en investissement. Vérifiez les chiffres dans les documents d'origine avant toute décision.</p>
  </div>
</main>
</body>
</html>
`;
// Typographie française : espaces insécables devant les signes doubles et entre un nombre et son unité,
// pour qu'aucune ligne ne commence par « : » ou par « % » (uniquement dans le texte, jamais les attributs).
const [tete, corps] = html.split("<body");
const typo = (s) => s
  .replace(/ ([:;!?»])/g, " $1").replace(/« /g, "« ")
  .replace(/(\d) (?=\d{3}(?!\d))/g, "$1 ")
  .replace(/(\d) (%|¥|M¥|Md¥|M€|€|ans|jours|mois|millions|actions|salariés|filiales)(?![\p{L}])/gu, "$1 $2");
const final = tete + "<body" + corps.replace(/>([^<]+)</g, (m, texte) => ">" + typo(texte) + "<");
fs.mkdirSync(path.join(racine, "analyses"), { recursive: true });
fs.writeFileSync(path.join(racine, "analyses/4234-sun-a-kaken.html"), final);
console.log("ok", html.length);
