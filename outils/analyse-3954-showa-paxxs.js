/* Génère analyses/3954-showa-paxxs.html à partir de la fiche publiée (js/analyses-publiees.js) et des modules
   de calcul de l'application (js/calc.js, js/methodes.js) : aucun chiffre calculé n'est recopié à la main.
   Usage : node outils/analyse-3954-showa-paxxs.js */
const fs = require("fs"), path = require("path");
const racine = process.argv[2] || path.join(__dirname, "..");
const D = require(path.join(racine, "js/calc.js"));
const M = require(path.join(racine, "js/methodes.js"));
const P = require(path.join(racine, "js/analyses-publiees.js")).find((p) => p.id === "3954-showa-paxxs");
const v = P.fiches.vann, rf = P.fiches.rapp;

const nb = (x, d = 0) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(x);
const yen = (x) => nb(x) + " ¥";
const pct = (x, d = 1) => nb(x * 100, d) + " %";
const sig = (x, d = 1) => (x > 0 ? "+" : x < 0 ? "−" : "") + nb(Math.abs(x) * 100, d) + " %";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const r = D.analyser(v);
const scen = [
  ["Retenu : stocks décotés de 20 %", D.analyser(v)],
  ["Sans décote sur les stocks", D.analyser({ ...v, decoteStocks: 0 })],
  ["Stocks décotés de 50 %", D.analyser({ ...v, decoteStocks: 0.5 })],
  ["Terrains seuls (bâtiments exclus)", D.analyser({ ...v, immeublesPrixAchat: 970.1 })],
];
const annees = Array.from({ length: 8 }, (_, i) => Object.fromEntries(["annee", "actions", "chiffreAffaires", "fraisGeneraux", "coutVentes", "stocks", "fondsPropres", "dividende", "cours"].map((k) => [k, rf[`a${i}_${k}`]])));
const rapp = M.rapp(annees, rf.tsr);
const R = Object.fromEntries(rapp.ratios.map((x) => [x.cle, x]));
const coeur = M.rapp(annees.map((a, i) => ({ annee: a.annee, actions: a.actions, fondsPropres: [13683.7, 14541.7, 15274.0, 16206.9, 16972.8, 17757.6, 18801.1, 19908.7][i], dividende: a.dividende, cours: a.cours })), rf.tsr).ratios[3];
const actions = Math.round(v.nbActions * 1e6);
const actifCourant = v.tresorerie + v.creances + v.stocks + v.autresActifsCourants;
const vantNum = v.capitauxPropres - v.incorporels - v.goodwill - v.impotsDifferesActifs;
const lot = 100 * v.cours, eurJpy = 176.8;
const badge = (verdict) => ({ ok: ["✓ Conforme", "ok"], vigilance: ["! À surveiller", "vg"], alerte: ["✕ Alerte", "ko"], incomplet: ["– Incomplet", ""], na: ["– Sans objet", ""] }[verdict]);

// Échelle de valeur (SVG statique, couleurs par classes CSS).
function echelle() {
  // Deux dessins : un large (ordinateur) et un étroit (téléphone), pour garder un texte lisible ; la CSS affiche l'un ou l'autre.
  return dessin(660, false) + dessin(320, true);
}
function dessin(W, etroit) {
  const max = 7000, X = (x) => 24 + ((W - 48) * x) / max;
  const reperes = [
    { nom: "VANN", val: r.vannParAction, haut: false, ancre: "end" },
    { nom: "Cours", val: v.cours, haut: true, ancre: "middle", cours: true },
    { nom: etroit ? "Prix max (70 %)" : "Prix max (70 % VANE)", val: r.prixMaxNetEstate, haut: false, ancre: "start" },
    { nom: "VANE", val: r.vaneParAction, haut: true, ancre: "middle" },
    { nom: etroit ? "VANT" : "VANT (objectif)", val: r.vantParAction, haut: true, ancre: "middle" },
  ];
  const o = [`<svg class="echelle ${etroit ? "echelle-etroite" : "echelle-large"}" viewBox="0 0 ${W} 148" role="img" aria-label="Cours de ${yen(v.cours)} comparé à la VANN (${yen(r.vannParAction)}), au prix maximal d'achat (${yen(r.prixMaxNetEstate)}), à la VANE (${yen(r.vaneParAction)}) et à la VANT (${yen(r.vantParAction)})">`];
  o.push(`<rect class="zone-achat" x="${X(0)}" y="58" width="${(X(r.prixMaxNetEstate) - X(0)).toFixed(1)}" height="16" rx="3"/>`);
  o.push(`<line class="axe" x1="${X(0)}" x2="${X(max)}" y1="66" y2="66"/>`);
  for (let t = 0; t <= max; t += etroit ? 2000 : 1000) o.push(`<text class="graduation" x="${X(t).toFixed(1)}" y="144" text-anchor="middle">${nb(t)}</text>`);
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
  ["Créances clients (nettes de 355,7 M¥ de provisions)", v.creances],
  ["Stocks (produits, en-cours, matières)", v.stocks],
  ["Autres actifs courants", v.autresActifsCourants],
  ["Total de l'actif courant", actifCourant, true],
  ["Dettes totales (dont 2 643,1 M¥ d'impôts différés passifs)", v.dettesTotales],
  ["Intérêts minoritaires", v.minoritaires],
  ["Capitaux propres part du groupe", v.capitauxPropres],
  ["Immobilisations incorporelles (logiciels ; pas de goodwill)", v.incorporels],
  ["Impôts différés actifs", v.impotsDifferesActifs],
  ["Total du bilan", v.totalBilan],
  ["Terrains (coût historique, pas de réévaluation)", 970.1],
  ["Bâtiments et constructions, valeur brute (avant 7 182,1 M¥ d'amortissements)", 9890.8],
];

const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'">
<meta name="referrer" content="no-referrer">
<meta name="color-scheme" content="light dark">
<title>Showa Paxxs (3954) : analyse Daubasses</title>
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
    <h1>Showa Paxxs (3954, Bourse de Tokyo)</h1>
    <p class="sous-titre">Analyse selon la méthode des Daubasses · 16 novembre 2026 · cours de clôture du jour : ${yen(v.cours)} · bilan au 30 septembre 2026</p>
  </div>

  <div class="bloc verdict v-achat">
    <p class="verdict-titre">Verdict de la méthode</p>
    <p class="verdict-texte">Net-Estate tout juste dans la zone d'achat : le cours vaut ${pct(r.coursSurVane)} de la VANE (seuil 70 %). Ce n'est pas un Net-Net.</p>
    <p>Prix d'achat maximal : <strong>${yen(r.prixMaxNetEstate)}</strong>, à peine au-dessus du cours. Objectif de vente (VANT) : <strong>${yen(r.vantParAction)}</strong>, soit ${sig(r.potentiel, 0)}. La marge de sécurité est très mince et repose sur la valeur des bâtiments : voir la sensibilité.</p>
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
      <li><strong>Pas un Net-Net :</strong> le cours dépasse la VANN de ${nb((r.coursSurVann - 1) * 100, 0)} %. Le prix maximal Net-Net serait ${yen(r.prixMaxNetNet)}.</li>
      <li><strong>Net-Estate de justesse :</strong> avec 10 861 M¥ d'immobilier au prix d'achat historique (terrains 970 M¥ et bâtiments 9 891 M¥ bruts), le cours tombe à ${pct(r.coursSurVane)} de la VANE. Avec une décote de 50 % sur les stocks, ou sans les bâtiments, le titre ne passe plus.</li>
      <li><strong>Bilan très solide :</strong> solvabilité maison de ${pct(r.solvabilite)}, 10 293 M¥ de trésorerie pour 1 185 M¥ d'emprunts.</li>
      <li><strong>Direction (RAPP) :</strong> ${rapp.synthese.ok} ratios conformes sur 4${coeur.verdict !== "ok" ? `, ${rapp.synthese.ok - 1} en version prudente (sans les plus-values latentes sur titres)` : ""}. Les stocks tournent plus lentement depuis 2024 : c'est le point à surveiller.</li>
      <li><strong>En pratique :</strong> un lot de 100 actions coûte environ ${nb(lot)} ¥, soit environ ${nb(lot / eurJpy)} € (1 € ≈ ${nb(eurJpy, 1)} ¥). Le titre s'échange très peu (quelques centaines d'actions par jour) et n'est pas éligible au PEA.</li>
    </ul>
  </section>

  <section class="bloc">
    <h2>1. La société</h2>
    <p>Showa Paxxs fabrique des emballages industriels. Son cœur de métier est le sac en papier kraft de grande contenance (ciment, résines, produits chimiques, alimentaire). Elle produit aussi des films plastiques et des conteneurs souples, et loue de l'immobilier. Elle compte 4 filiales consolidées, dont une en Thaïlande, et 681 salariés.</p>
    <p>Actionnariat (septembre 2026) : Sanei Kaken 19,3 % et Shinsei Pulp &amp; Paper Trading 19,1 %. Deux partenaires industriels détiennent donc environ 38 % du capital, et des banques japonaises environ 8 %. Capitalisation : environ 13,1 Md¥ (environ 74 M€), ${nb(actions)} actions hors autocontrôle. Le cours vaut 0,46 fois les fonds propres comptables.</p>
    <p>Résultats : sur l'exercice clos en mars 2026, chiffre d'affaires de 23 564 M¥ et résultat net de 1 283 M¥. Au premier semestre de l'exercice en cours (avril-septembre 2026), les ventes progressent de 12,2 % et le résultat net de 62 %. Prévision de la société pour l'exercice : 25 000 M¥ de ventes, 1 350 M¥ de résultat net et 50 ¥ de dividende, soit un rendement de 1,7 %.</p>
  </section>

  <section class="bloc">
    <h2>2. Les chiffres retenus</h2>
    <p class="note">Bilan consolidé au 30 septembre 2026, en millions de yens. Source : rapport semestriel (kessan tanshin) du 10 novembre 2026.</p>
    <div class="tableau-cadre"><table class="table-simple">
      <thead><tr><th scope="col">Poste</th><th scope="col" class="num">M¥</th></tr></thead>
      <tbody>${lignesBilan.map(([n, x, t]) => `<tr${t ? ' class="total"' : ""}><td>${esc(n)}</td><td class="num">${nb(x, 1)}</td></tr>`).join("")}</tbody>
    </table></div>
    <p class="note">Les provisions japonaises (primes, retraite des dirigeants) figurent déjà dans les dettes : aucune provision n'est déduite une seconde fois.</p>
  </section>

  <section class="bloc">
    <h2>3. Les calculs, pas à pas</h2>
    <p><strong>Actif courant retraité.</strong> Les stocks sont décotés de 20 %, car la durée de stockage est passée de 47 à 62 jours en sept ans. Cela déclenche la règle du cours : dernier exercice plus de 10 % au-dessus de la moyenne des années précédentes. Les créances, déjà nettes de provisions et dont le délai de paiement diminue, ne sont pas décotées.</p>
    <p class="calcul">${nb(v.tresorerie, 1)} + ${nb(v.creances, 1)} + ${nb(v.stocks, 1)} × 80 % + ${nb(v.autresActifsCourants, 1)} = <strong>${nb(r.actifCourantRetraite, 1)} M¥</strong></p>
    <p><strong>VANN</strong> = actif courant retraité − dettes totales − provisions − minoritaires</p>
    <p class="calcul">${nb(r.actifCourantRetraite, 1)} − ${nb(v.dettesTotales, 1)} − 0 − ${nb(v.minoritaires, 1)} = <strong>${nb(r.vann, 1)} M¥</strong>, soit <strong>${yen(r.vannParAction)}</strong> par action. Prix maximal Net-Net (70 %) : ${yen(r.prixMaxNetNet)}.</p>
    <p><strong>VANE</strong> = VANN + 80 % du prix d'achat historique des immeubles (terrains et bâtiments bruts)</p>
    <p class="calcul">${nb(r.vann, 1)} + 80 % × ${nb(v.immeublesPrixAchat, 1)} = <strong>${nb(r.vane, 1)} M¥</strong>, soit <strong>${yen(r.vaneParAction)}</strong> par action. Prix maximal Net-Estate (70 %) : <strong>${yen(r.prixMaxNetEstate)}</strong>.</p>
    <p><strong>VANT</strong> = capitaux propres − incorporels − goodwill − impôts différés actifs</p>
    <p class="calcul">${nb(v.capitauxPropres, 1)} − ${nb(v.incorporels, 1)} − 0 − ${nb(v.impotsDifferesActifs, 1)} = <strong>${nb(vantNum, 1)} M¥</strong>, soit <strong>${yen(r.vantParAction)}</strong> par action (objectif de vente).</p>
    <p><strong>Solvabilité maison</strong> = fonds propres (avec minoritaires) ÷ (total du bilan − trésorerie)</p>
    <p class="calcul">${nb(v.capitauxPropres + v.minoritaires, 1)} ÷ (${nb(v.totalBilan, 1)} − ${nb(v.tresorerie, 1)}) = <strong>${pct(r.solvabilite)}</strong> (solvabilité classique : ${pct(r.solvabiliteClassique)})</p>
    <div class="tableau-cadre"><table class="table-simple">
      <thead><tr><th scope="col">Filtre de la méthode</th><th scope="col" class="num">Résultat</th></tr></thead>
      <tbody>
        <tr><td>Fonds de roulement net positif (${nb(r.fondsDeRoulementNet, 0)} M¥)</td><td class="num ok">✓ Oui</td></tr>
        <tr><td>Solvabilité maison d'au moins 40 %</td><td class="num ok">✓ Oui</td></tr>
        <tr><td>Chiffre d'affaires d'au moins 5 % de la VANN</td><td class="num ok">✓ Oui</td></tr>
        <tr><td>Cours à 70 % ou moins de la VANN (Net-Net)</td><td class="num ko">✕ Non (${pct(r.coursSurVann)})</td></tr>
        <tr><td>Cours à 70 % ou moins de la VANE (Net-Estate)</td><td class="num ok">✓ Oui, de justesse (${pct(r.coursSurVane)})</td></tr>
      </tbody>
    </table></div>
  </section>

  <section class="bloc">
    <h2>4. Sensibilité : le verdict tient-il ?</h2>
    <div class="tableau-cadre"><table class="table-simple">
      <thead><tr><th scope="col">Hypothèse</th><th scope="col" class="num">VANN</th><th scope="col" class="num">VANE</th><th scope="col" class="num">Cours ÷ VANE</th><th scope="col" class="num">Prix max</th><th scope="col" class="num">Verdict</th></tr></thead>
      <tbody>${scen.map(([n, s]) => `<tr><td>${esc(n)}</td><td class="num">${yen(s.vannParAction)}</td><td class="num">${yen(s.vaneParAction)}</td><td class="num">${pct(s.coursSurVane)}</td><td class="num">${yen(s.prixMaxNetEstate)}</td><td class="num ${s.verdict.code === "net-estate" ? "ok" : "ko"}">${s.verdict.code === "net-estate" ? "Net-Estate" : "Attendre"}</td></tr>`).join("")}</tbody>
    </table></div>
    <p>Le verdict dépend surtout des bâtiments : ils pèsent ${nb((0.8 * 9890.8) / r.vane * 100, 0)} % de la VANE. Leur prix d'achat historique comprend des constructions anciennes : l'usine de Tokyo, en reconstruction, a déjà fait l'objet d'une dépréciation de 45 M¥. Leur valeur de revente réelle peut donc être inférieure. Un léger repli du cours sous 3 000 ¥ redonnerait de la marge.</p>
  </section>

  <section class="bloc">
    <h2>5. RAPP : la direction sur huit exercices</h2>
    <p class="note">Exercices clos fin mars, en millions de yens (dividende et cours en yens). Fonds propres = valeur comptable par action publiée × nombre d'actions. Taux sans risque : obligation d'État japonaise à 10 ans, ${pct(rf.tsr, 2)} (adjudication du 5 novembre 2026).</p>
    <div class="tableau-cadre"><table class="table-simple">
      <thead><tr><th scope="col">Exercice</th>${annees.map((a) => `<th scope="col" class="num">${a.annee}</th>`).join("")}</tr></thead>
      <tbody>
        <tr><td>Actions (millions)</td>${annees.map((a) => `<td class="num">${nb(a.actions, 2)}</td>`).join("")}</tr>
        <tr><td>Chiffre d'affaires</td>${annees.map((a) => `<td class="num">${nb(a.chiffreAffaires)}</td>`).join("")}</tr>
        <tr><td>Frais généraux ÷ CA</td>${annees.map((a) => `<td class="num">${pct(a.fraisGeneraux / a.chiffreAffaires)}</td>`).join("")}</tr>
        <tr><td>Durée de stockage (jours)</td>${annees.map((a) => `<td class="num">${nb(a.stocks / a.coutVentes * 365, 0)}</td>`).join("")}</tr>
        <tr><td>Fonds propres par action</td>${annees.map((a) => `<td class="num">${nb(a.fondsPropres / a.actions)}</td>`).join("")}</tr>
        <tr><td>Dividende par action</td>${annees.map((a) => `<td class="num">${nb(a.dividende)}</td>`).join("")}</tr>
        <tr><td>Cours fin mars</td>${annees.map((a) => `<td class="num">${nb(a.cours)}</td>`).join("")}</tr>
      </tbody>
    </table></div>
    <div class="tableau-cadre"><table class="table-simple">
      <thead><tr><th scope="col">Ratio</th><th scope="col">Constat</th><th scope="col" class="num">Verdict</th></tr></thead>
      <tbody>
        <tr><td>Nombre d'actions</td><td>${nb(R.actions.debut, 2)} → ${nb(R.actions.fin, 2)} millions (${sig(R.actions.variation)}) : rachat d'actions en 2025, aucune dilution.</td><td class="num ${badge(R.actions.verdict)[1]}">${badge(R.actions.verdict)[0]}</td></tr>
        <tr><td>Frais généraux ÷ CA</td><td>${pct(R.frais.debut)} → ${pct(R.frais.fin)}, sous la moyenne des années précédentes (${pct(R.frais.reference)}).</td><td class="num ${badge(R.frais.verdict)[1]}">${badge(R.frais.verdict)[0]}</td></tr>
        <tr><td>Durée de stockage</td><td>${nb(R.stocks.debut, 0)} → ${nb(R.stocks.fin, 0)} jours, ${sig(R.stocks.variation)} par rapport à la moyenne des années précédentes. Mieux au premier semestre 2026-2027 (environ 52 jours en rythme annuel).</td><td class="num ${badge(R.stocks.verdict)[1]}">${badge(R.stocks.verdict)[0]}</td></tr>
        <tr><td>Création de valeur</td><td>(${nb(R.creation.fin)} − ${nb(R.creation.debut)}) + ${nb(R.creation.dividendes)} ¥ de dividendes = ${yen(R.creation.creation)} en ${R.creation.annees} ans, soit ${sig(R.creation.rendement)} par an. C'est plus que le seuil de la méthode (taux sans risque de ${pct(rf.tsr, 2)} + 3 points = ${pct(rf.tsr + 0.03, 2)}) et à peine plus que la hausse du cours (${sig(R.creation.hausseCours)} par an). Prudence : sans les plus-values latentes sur titres (capitaux propres « de base »), on obtient ${sig(coeur.rendement)} par an, ${coeur.rendement >= rf.tsr + 0.03 ? "encore au-dessus du seuil" : "sous le seuil"}${coeur.hausseCours !== null && coeur.rendement <= coeur.hausseCours ? " mais sous la hausse du cours" : ""} : ce ratio serait alors « ${badge(coeur.verdict)[0].slice(2)} ».</td><td class="num ${badge(R.creation.verdict)[1]}">${badge(R.creation.verdict)[0]}</td></tr>
      </tbody>
    </table></div>
  </section>

  <section class="bloc">
    <h2>6. Ce que les formules ne disent pas</h2>
    <ul>
      <li><strong>Réserves non comptées :</strong> 9 345 M¥ de titres de participation (environ ${yen(9345.1 / v.nbActions)} par action) et 1 803 M¥ d'actif de retraite. Ils sont exclus de la VANN et de la VANE, alors que les impôts différés passifs qui s'y rattachent (2 643 M¥) sont, eux, déduits. Double prudence.</li>
      <li><strong>Litige :</strong> la filiale Nesco a 382 M¥ de créances à risque. La provision de 356 M¥ est déjà déduite, et un jugement favorable est devenu définitif le 18 juin 2026 : tout recouvrement serait un bonus.</li>
      <li><strong>Trésorerie réelle :</strong> les flux d'exploitation sont positifs chaque année (2 090 M¥ sur l'exercice 2025-2026, 1 124 M¥ au premier semestre en cours), et les investissements restent inférieurs.</li>
      <li><strong>Pourquoi la décote :</strong> rentabilité faible (rendement des fonds propres d'environ 4,8 %), dividende limité à environ 17 % du résultat, près de la moitié du capital chez deux partenaires industriels et des banques, titre très peu échangé.</li>
      <li><strong>Catalyseurs possibles :</strong> la Bourse de Tokyo pousse les sociétés qui cotent sous leurs fonds propres à agir. Ici, le dividende est passé de 40 à 50 ¥, des actions ont été rachetées en 2025 et une filiale a été reprise à 100 % au premier semestre. Ce ne sont que des indices, pas des certitudes.</li>
      <li><strong>Risque à court terme :</strong> la direction signale un possible contrecoup, au second semestre, des achats anticipés liés aux tensions au Moyen-Orient.</li>
    </ul>
  </section>

  <section class="bloc">
    <h2>7. Un plan mécanique, si vous décidez d'acheter</h2>
    <ul>
      <li>N'acheter qu'à ${yen(r.prixMaxNetEstate)} ou moins, avec un ordre à cours limité, sur un compte-titres : le titre n'est pas éligible au PEA.</li>
      <li>Taille de ligne : un lot de 100 actions (environ ${nb(lot / eurJpy)} €) représente environ ${nb(lot / eurJpy / 10000 * 100, 0)} % d'un portefeuille de 10 000 €, bien au-delà de la règle des 5 %. Il faudrait un portefeuille d'environ ${nb(Math.ceil(lot / eurJpy / 0.05 / 1000) * 1000)} € pour la respecter, ou écrire une exception assumée dans le carnet de bord.</li>
      <li>Objectif de vente : la VANT, soit ${yen(r.vantParAction)}. Vendre aussi si le potentiel restant passe sous 20 %, ou si la solvabilité passe sous 40 %.</li>
      <li>Revoir l'analyse à chaque publication semestrielle (mai et novembre) : VANE, durée de stockage, litige Nesco.</li>
      <li>Dans l'application : onglet Analyse, puis « Analyses publiées » et « Showa Paxxs ». Les outils VANN / VANE et RAPP se remplissent, et vous pouvez enregistrer la fiche dans votre coffre.</li>
    </ul>
  </section>

  <section class="bloc">
    <h2>Sources</h2>
    <ul class="sources">
      <li><a href="https://finance-frontend-pc-dist.west.edge.storage-yahoo.jp/disclosure/20261110/20261109568819.pdf">Rapport semestriel au 30 septembre 2026 (kessan tanshin du 10/11/2026)</a></li>
      <li><a href="https://finance.biggo.jp/news/jpx_tdnet_140120260807515360">Rapport du 1er trimestre 2026-2027 (10/08/2026)</a> et <a href="https://finance.biggo.jp/news/jpx_tdnet_140120260512524770">rapport annuel de l'exercice clos en mars 2026 (13/05/2026)</a></li>
      <li><a href="https://finance-frontend-pc-dist.west.edge.storage-yahoo.jp/disclosure/20260518/20260515538489.pdf">Rectificatif du 18/05/2026</a> : une phrase de commentaire sur Nesco, aucun chiffre modifié.</li>
      <li>IR Bank : <a href="https://irbank.net/E00686/pl">compte de résultat</a>, <a href="https://irbank.net/E00686/bs">bilan</a>, <a href="https://irbank.net/E00686/results">synthèse sur dix ans</a>, <a href="https://irbank.net/E00686/holder">grands actionnaires</a></li>
      <li>Kabutan : <a href="https://kabutan.jp/stock/kabuka?code=3954&amp;ashi=day">cours quotidiens</a> et <a href="https://kabutan.jp/stock/kabuka?code=3954&amp;ashi=mon">mensuels</a> (cours de fin mars)</li>
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
// pour qu'aucune ligne ne commence par « : » ou par « % » (uniquement dans le corps de la page).
const [tete, corps] = html.split("<body");
const typo = (s) => s
  .replace(/ ([:;!?»])/g, "\u00a0$1").replace(/« /g, "«\u00a0")
  .replace(/(\d) (?=\d{3}(?!\d))/g, "$1\u00a0")
  .replace(/(\d) (%|¥|M¥|Md¥|M€|€|ans|jours|millions|actions|salariés|filiales)(?![\p{L}])/gu, "$1\u00a0$2");
const corpsFr = corps.replace(/>([^<]+)</g, (m, texte) => ">" + typo(texte) + "<"); // texte seulement, jamais les attributs
const final = tete + "<body" + corpsFr;
fs.mkdirSync(path.join(racine, "analyses"), { recursive: true });
fs.writeFileSync(path.join(racine, "analyses/3954-showa-paxxs.html"), final);
console.log("ok", html.length);
