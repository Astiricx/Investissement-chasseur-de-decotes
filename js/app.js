/* Interface : tableau de bord et calculatrice d'analyse. Aucune donnée n'est enregistrée ni envoyée. */
(function () {
  "use strict";
  const D = window.Decotes;
  const P = D.PARAMETRES;
  const $ = (id) => document.getElementById(id);

  // ---------- Mise en forme ----------
  const fEur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
  const fEur0 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const fPct = new Intl.NumberFormat("fr-FR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const fPct0 = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 });
  const fNb = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  const vide = "–";
  const fmt = (f, v) => (typeof v === "number" && Number.isFinite(v) ? f.format(v) : vide);
  const signe = (v) => (typeof v === "number" && Number.isFinite(v) ? (v > 0 ? "+" : "") + fPct.format(v) : vide);

  function el(balise, attrs, enfants) {
    const e = document.createElement(balise);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "texte") e.textContent = v;
      else if (v !== null && v !== undefined) e.setAttribute(k, v);
    }
    for (const c of [].concat(enfants || [])) if (c) e.append(c);
    return e;
  }

  // ---------- Navigation ----------
  function afficherVue(nom) {
    document.querySelectorAll(".vue").forEach((v) => (v.hidden = v.id !== "vue-" + nom));
    document.querySelectorAll(".onglet").forEach((o) =>
      o.dataset.vue === nom ? o.setAttribute("aria-current", "page") : o.removeAttribute("aria-current"));
    window.scrollTo(0, 0);
  }
  document.querySelectorAll(".onglet").forEach((o) => o.addEventListener("click", () => afficherVue(o.dataset.vue)));

  // ---------- Données de démonstration (sociétés fictives) ----------
  function dansJours(nb) {
    const d = new Date(); d.setDate(d.getDate() + nb);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  const DEMO = {
    cash: 7850,
    lignes: [
      { nom: "Alpha Industrie", code: "ALPH", enveloppe: "PEA", quantite: 100, prixRevient: 3.5, cours: 3.8, objectif: 7.5, solvabilite: 0.881, dateResultats: dansJours(9) },
      { nom: "Bêta Textile", code: "BETA", enveloppe: "PEA", quantite: 40, prixRevient: 9.2, cours: 15.4, objectif: 16, solvabilite: 0.62, dateResultats: dansJours(70) },
      { nom: "Gamma Outillage", code: "GAMM", enveloppe: "PEA", quantite: 140, prixRevient: 4.1, cours: 3.15, objectif: 8.2, solvabilite: 0.55, dateResultats: dansJours(40) },
      { nom: "Delta Négoce", code: "DELT", enveloppe: "CTO", quantite: 60, prixRevient: 6, cours: 5.1, objectif: 10.5, solvabilite: 0.31, dateResultats: dansJours(25) },
      { nom: "Epsilon Papiers", code: "EPSI", enveloppe: "PEA", quantite: 70, prixRevient: 5.4, cours: 5.9, objectif: null, solvabilite: null, dateResultats: null },
    ],
  };

  // ---------- Tableau de bord ----------
  const CLASSE_STATUT = {
    [D.STATUTS.VENDRE]: "s-vendre", [D.STATUTS.REEXAMINER]: "s-reexaminer", [D.STATUTS.RENFORCER]: "s-renforcer",
    [D.STATUTS.A_COMPLETER]: "s-completer", [D.STATUTS.GARDER]: "s-garder",
  };

  function indicateur(titre, valeur, detail, extra) {
    return el("div", { class: "indic" }, [
      el("p", { class: "indic-titre", texte: titre }),
      el("p", { class: "indic-valeur", texte: valeur }),
      extra, el("p", { class: "indic-detail", texte: detail }),
    ]);
  }

  function afficherTableau() {
    const s = D.synthese(DEMO.lignes, DEMO.cash, P, new Date());
    const S = D.STATUTS;
    const decisions = s.compte(S.VENDRE) + s.compte(S.REEXAMINER) + s.compte(S.RENFORCER);
    const alertes = s.lignesTropLourdes + s.resultatsProches;

    const jauge = el("div", { class: "jauge", role: "img", "aria-label": `Cash : ${fmt(fPct0, s.partCash)}, cible ${fPct0.format(P.cashCible)}` }, [el("span"), el("i")]);
    jauge.firstChild.style.width = Math.min(100, (s.partCash || 0) * 100) + "%";
    jauge.lastChild.style.left = P.cashCible * 100 + "%";

    $("indicateurs").replaceChildren(
      indicateur("Valeur totale", fmt(fEur0, s.total), `Capital de départ : ${fEur0.format(P.capitalDepart)} (${signe(s.total / P.capitalDepart - 1)})`),
      indicateur("Cash disponible", fmt(fEur0, s.cash), `${fmt(fPct0, s.partCash)} du total, cible ${fPct0.format(P.cashCible)}`, jauge),
      indicateur("Décisions à prendre", String(decisions), `${s.compte(S.VENDRE)} à vendre · ${s.compte(S.REEXAMINER)} à réexaminer · ${s.compte(S.RENFORCER)} à renforcer ?`),
      indicateur("Points d'attention", String(alertes + s.compte(S.A_COMPLETER)), `${s.lignesTropLourdes} ligne trop lourde · ${s.resultatsProches} publication proche · ${s.compte(S.A_COMPLETER)} à compléter`),
    );

    $("resume-lignes").textContent = `${s.detail.length} lignes · ${fmt(fEur0, s.valeurTitres)} en actions`;
    const cellule = (titre, texte, classe) => el("td", { "data-titre": titre, class: classe || "num", texte });
    const corps = $("lignes").tBodies[0];
    corps.replaceChildren(...s.detail.map((d) => {
      const l = d.ligne;
      const puces = [];
      if (d.tropLourde) puces.push(el("span", { class: "puce", texte: `Ligne trop lourde (> ${fPct0.format(P.tailleMaxLigne)})` }));
      if (d.resultatsProches) puces.push(el("span", { class: "puce", texte: d.joursAvantResultats === 0 ? "Résultats aujourd'hui" : `Résultats dans ${d.joursAvantResultats} j` }));
      return el("tr", {}, [
        el("td", { class: "c-soc" }, [el("div", { class: "soc-nom", texte: l.nom }), el("div", { class: "soc-code", texte: `${l.code} · ${l.enveloppe} · ${l.quantite} titres` })]),
        cellule("Cours", fmt(fEur, l.cours)),
        cellule("Prix de revient", fmt(fEur, l.prixRevient)),
        cellule("Performance", signe(d.performance), "num " + (d.performance > 0 ? "hausse" : d.performance < 0 ? "baisse" : "")),
        cellule("Objectif", fmt(fEur, l.objectif)),
        cellule("Potentiel", signe(d.potentiel)),
        cellule("Poids", fmt(fPct, d.poids)),
        el("td", { class: "c-statut" }, [el("span", { class: "statut " + CLASSE_STATUT[d.statut], texte: d.statut }), el("div", {}, puces)]),
      ]);
    }));

    const regles = [
      ["Prix d'achat maximal", `${fPct0.format(P.achatMaxPctValeur)} de la VANN ou de la VANE`],
      ["Vente", `à l'objectif (VANT), ou potentiel restant < ${fPct0.format(P.seuilVentePotentiel)}`],
      ["Renforcement envisagé", `baisse de ${fPct0.format(-P.seuilRenforcement)} et bilan solide`],
      ["Solvabilité maison minimale", fPct0.format(P.solvabiliteMin)],
      ["Taille maximale d'une ligne", fPct0.format(P.tailleMaxLigne)],
      ["Part de cash visée", fPct0.format(P.cashCible)],
      ["Immeubles retenus dans la VANE", `${fPct0.format(P.immeublesRetenus)} du prix d'achat`],
      ["Alerte avant publication", `${P.joursAlerteResultats} jours`],
    ];
    $("regles").replaceChildren(...regles.flatMap(([t, v]) => [el("dt", { texte: t }), el("dd", { texte: v })]));
  }

  // ---------- Calculatrice d'analyse ----------
  const CHAMPS = [
    ["La société", [
      ["nom", "Nom", "texte"],
      ["cours", "Cours actuel (€)"],
      ["nbActions", "Nombre d'actions (millions)"],
      ["chiffreAffaires", "Chiffre d'affaires"],
    ]],
    ["Le bilan", [
      ["tresorerie", "Trésorerie et placements"],
      ["creances", "Créances clients"],
      ["stocks", "Stocks"],
      ["autresActifsCourants", "Autres actifs courants"],
      ["immeublesPrixAchat", "Immeubles : prix d'achat historique", "nombre", "Dans l'annexe des comptes, pas la valeur nette du bilan."],
      ["incorporels", "Immobilisations incorporelles"],
      ["goodwill", "Goodwill"],
      ["impotsDifferesActifs", "Impôts différés actifs"],
      ["totalBilan", "Total du bilan"],
      ["capitauxPropres", "Capitaux propres part du groupe"],
      ["minoritaires", "Intérêts minoritaires"],
      ["provisions", "Provisions (si hors dettes)"],
      ["dettesTotales", "Dettes totales", "nombre", "Emprunts, fournisseurs et autres dettes."],
    ]],
    ["Retraitements", [
      ["decoteStocks", "Décote sur les stocks (%)", "pourcent", "0 % si la rotation est stable ; 20 à 50 % si elle ralentit."],
      ["decoteCreances", "Décote sur les créances (%)", "pourcent", "0 % si le délai clients est stable ; 30 % s'il s'allonge."],
    ]],
  ];
  const TYPES = Object.fromEntries(CHAMPS.flatMap(([, cs]) => cs.map(([cle, , type]) => [cle, type || "nombre"])));

  function construireFormulaire() {
    $("formulaire").replaceChildren(...CHAMPS.map(([titre, champs]) =>
      el("fieldset", {}, [el("legend", { texte: titre })].concat(champs.map(([cle, libelle, type, aide]) =>
        el("div", { class: "champ" + (type === "texte" ? " large" : "") }, [
          el("label", { for: "c-" + cle, texte: libelle }),
          el("input", { id: "c-" + cle, name: cle, type: "text", inputmode: type === "texte" ? null : "decimal" }),
          aide ? el("small", { texte: aide }) : null,
        ]))))));
  }

  /** Lit un nombre saisi à la française (« 1 234,5 ») ou avec un point. Vide = null. */
  function lireNombre(texte) {
    const t = String(texte).replace(/[\s  €%]/g, "").replace(",", ".");
    if (t === "") return null;
    return /^-?\d*\.?\d+$/.test(t) ? Number(t) : NaN;
  }

  function remplir(societe) {
    for (const [cle, type] of Object.entries(TYPES)) {
      const v = societe ? societe[cle] : null;
      $("c-" + cle).value = v === null || v === undefined ? "" :
        type === "texte" ? v : String(type === "pourcent" ? Math.round(v * 1e6) / 1e4 : v).replace(".", ",");
    }
    calculer();
  }

  function calculer() {
    const s = {};
    for (const [cle, type] of Object.entries(TYPES)) {
      const champ = $("c-" + cle);
      if (type === "texte") { s[cle] = champ.value.trim(); continue; }
      const v = lireNombre(champ.value);
      champ.classList.toggle("invalide", Number.isNaN(v));
      s[cle] = Number.isNaN(v) || v === null ? null : type === "pourcent" ? v / 100 : v;
    }
    const r = D.analyser(s, P);
    const incomplet = !(s.cours > 0 && s.nbActions > 0 && s.totalBilan > 0);

    const v = $("verdict");
    v.className = "bloc verdict " + (incomplet ? "" : r.verdict.code === "exclue" ? "v-exclue" : r.verdict.code === "attendre" ? "v-attendre" : "v-achat");
    v.replaceChildren(
      el("p", { class: "verdict-titre", texte: s.nom || "Société" }),
      el("p", { class: "verdict-texte", texte: incomplet ? "Saisissez au moins le cours, le nombre d'actions et le total du bilan" : r.verdict.texte }));

    const ligne = (t, val, fort) => [el("dt", { class: fort ? "fort" : null, texte: t }), el("dd", { class: fort ? "fort" : null, texte: val })];
    const sep = () => el("div", { class: "sep" });
    const M = (x) => (typeof x === "number" && Number.isFinite(x) ? fNb.format(x) + " M€" : vide);
    $("valeurs").replaceChildren(
      ...ligne("Capitalisation boursière", M(r.capitalisation)),
      ...ligne("Fonds de roulement net", M(r.fondsDeRoulementNet)),
      ...ligne("Actif courant retraité", M(r.actifCourantRetraite)), sep(),
      ...ligne("VANN par action", fmt(fEur, r.vannParAction), true),
      ...ligne("VANN totale", M(r.vann)),
      ...ligne("Prix d'achat maximal Net-Net", fmt(fEur, r.prixMaxNetNet)),
      ...ligne("Cours en % de la VANN", fmt(fPct, r.coursSurVann)), sep(),
      ...ligne("VANE par action", fmt(fEur, r.vaneParAction), true),
      ...ligne("Prix d'achat maximal Net-Estate", fmt(fEur, r.prixMaxNetEstate)),
      ...ligne("Cours en % de la VANE", fmt(fPct, r.coursSurVane)), sep(),
      ...ligne("VANT par action (objectif de vente)", fmt(fEur, r.vantParAction), true),
      ...ligne("Potentiel jusqu'à la VANT", signe(r.potentiel)), sep(),
      ...ligne("Solvabilité maison", fmt(fPct, r.solvabilite), true),
      ...ligne("Solvabilité classique", fmt(fPct, r.solvabiliteClassique)));

    const f = r.filtres;
    const filtres = [
      ["Fonds de roulement net positif", f.fondsDeRoulementPositif],
      [`Solvabilité maison d'au moins ${fPct0.format(P.solvabiliteMin)}`, f.solvabiliteSuffisante],
      ["Chiffre d'affaires suffisant", f.chiffreAffairesSuffisant],
      [`Cours à ${fPct0.format(P.achatMaxPctValeur)} ou moins de la VANN`, f.decoteNetNet],
      [`Cours à ${fPct0.format(P.achatMaxPctValeur)} ou moins de la VANE`, f.decoteNetEstate],
    ];
    $("filtres").replaceChildren(...filtres.map(([t, ok]) =>
      el("li", {}, [el("span", { texte: t }), el("span", { class: ok ? "oui" : "non", texte: ok ? "Oui" : "Non" })])));
  }

  // ---------- Démarrage ----------
  construireFormulaire();
  $("formulaire").addEventListener("input", calculer);
  $("formulaire").addEventListener("submit", (e) => e.preventDefault());
  $("reinitialiser").addEventListener("click", () => remplir(D.ALPHA_INDUSTRIE));
  $("vider").addEventListener("click", () => remplir(null));
  remplir(D.ALPHA_INDUSTRIE);
  afficherTableau();

  const t = window.DecotesTests;
  const etat = $("etat-tests");
  etat.className = "tests " + (t.ok ? "ok" : "ko");
  etat.textContent = t.ok
    ? `Logique vérifiée au chargement : ${t.reussis}/${t.total} tests réussis.`
    : `Attention : ${t.total - t.reussis} test(s) en échec sur ${t.total}. Ne vous fiez pas aux calculs et consultez la console.`;
})();
