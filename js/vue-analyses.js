/* Vue « analyses » : sous-onglets VANN / VANE, RAPP, Holding, Mine, et fiches enregistrées.
   Les calculs sont dans calc.js (VANN, VANE, VANT) et methodes.js (RAPP, holding, mine).
   Chaque outil a un formulaire dont les champs portent un nom (name) et un type (data-type) :
   lire et remplir un formulaire est donc générique, et une fiche enregistrée n'est qu'un objet { nom: valeur }. */
(function (racine) {
  "use strict";

  function creer(ctx) {
    const { $, el, G, M, Donnees, estNombre } = ctx;
    const fNb1 = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const fNb2 = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fNb0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
    const fPct1 = new Intl.NumberFormat("fr-FR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const fPct0 = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 });
    const vide = "–";
    const f = (fmt, v, suffixe) => (estNombre(v) ? fmt.format(v) + (suffixe || "") : vide);
    const signe = (v) => (estNombre(v) ? (v > 0 ? "+" : "") + fPct1.format(v) : vide);
    const NB_ANNEES = 8, NB_PARTICIPATIONS = 6;

    // ---------------------------------------------------------------- Formulaires génériques
    let prefixe = ""; // préfixe des identifiants du formulaire en cours de construction (évite les doublons entre outils)
    function champ(cle, libelle, type, aide) {
      const id = `a-${prefixe}-${cle}`;
      return el("div", { class: "champ" + (type === "texte" ? " large" : "") }, [
        el("label", { for: id, texte: libelle }),
        el("input", { id, name: cle, "data-type": type || "nombre", type: "text", inputmode: type === "texte" ? null : "decimal" }),
        aide ? el("small", { texte: aide }) : null,
      ]);
    }
    function groupe(titre, enfants) { return el("fieldset", {}, [el("legend", { texte: titre })].concat(enfants)); }

    /** Lit tous les champs nommés d'un formulaire : nombres (pourcentages ramenés à 0-1), textes. */
    function lireFormulaire(form) {
      const valeurs = {};
      for (const c of form.querySelectorAll("input[name]")) {
        const type = c.dataset.type;
        if (type === "texte") { if (c.value.trim()) valeurs[c.name] = c.value.trim(); continue; }
        const v = ctx.lireChamp(c);
        if (estNombre(v)) valeurs[c.name] = type === "pourcent" ? v / 100 : v;
      }
      return valeurs;
    }
    function remplirFormulaire(form, valeurs) {
      for (const c of form.querySelectorAll("input[name]")) {
        const v = valeurs ? valeurs[c.name] : undefined;
        c.classList.remove("invalide");
        c.value = v === undefined || v === null ? "" : c.dataset.type === "texte" ? String(v) : ctx.versChamp(c.dataset.type === "pourcent" ? v * 100 : v);
      }
    }

    function badge(verdict) {
      const b = { ok: ["✓ Conforme", "b-ok"], vigilance: ["! À surveiller", "b-vigilance"], alerte: ["✕ Alerte", "b-alerte"], incomplet: ["– Incomplet", "b-incomplet"], na: ["– Sans objet", "b-na"] }[verdict];
      return el("span", { class: "badge " + b[1], texte: b[0] });
    }
    function verdictBloc(id, nom, code, texte) {
      const v = $(id);
      v.className = "bloc verdict " + (code === "achat" || code === "ok" ? "v-achat" : code === "exclue" || code === "alerte" ? "v-exclue" : code === "attendre" || code === "vigilance" ? "v-attendre" : "");
      v.replaceChildren(el("p", { class: "verdict-titre", texte: nom || "Société" }), el("p", { class: "verdict-texte", texte }));
    }
    const ligneValeur = (t, val, fort) => [el("dt", { class: fort ? "fort" : null, texte: t }), el("dd", { class: fort ? "fort" : null, texte: val })];
    const sep = () => el("div", { class: "sep" });

    // ---------------------------------------------------------------- RAPP
    const LIGNES_RAPP = [
      ["actions", "Nombre d'actions (millions)"],
      ["chiffreAffaires", "Chiffre d'affaires"],
      ["fraisGeneraux", "Frais généraux (commerciaux et administratifs)"],
      ["coutVentes", "Coût des ventes"],
      ["stocks", "Stocks"],
      ["fondsPropres", "Fonds propres part du groupe"],
      ["dividende", "Dividende par action (€)"],
      ["cours", "Cours de fin d'exercice (€, facultatif)"],
    ];
    function construireRapp() {
      prefixe = "rapp";
      const entete = el("tr", {}, [el("th", { scope: "col", texte: "Exercice" })].concat(Array.from({ length: NB_ANNEES }, (_, i) =>
        el("th", { scope: "col" }, el("input", { name: `a${i}_annee`, "data-type": "nombre", type: "text", inputmode: "numeric", "aria-label": `Année de l'exercice ${i + 1}` })))));
      const lignes = LIGNES_RAPP.map(([cle, libelle]) => el("tr", {}, [el("th", { scope: "row", texte: libelle })].concat(Array.from({ length: NB_ANNEES }, (_, i) =>
        el("td", {}, el("input", { name: `a${i}_${cle}`, "data-type": "nombre", type: "text", inputmode: "decimal", "aria-label": `${libelle}, exercice ${i + 1}` }))))));
      $("f-rapp").replaceChildren(
        el("div", { class: "rapp-entete" }, [champ("nom", "Société", "texte"), champ("tsr", "Taux sans risque (%)", "pourcent", "Par exemple le rendement de l'OAT à 10 ans.")]),
        el("p", { class: "note", texte: "Huit exercices, du plus ancien au plus récent. Montants en millions, sauf le dividende et le cours (par action)." }),
        el("div", { class: "rapp-cadre" }, el("table", { class: "rapp-table" }, [el("thead", {}, entete), el("tbody", {}, lignes)])),
      );
    }
    function calculerRapp() {
      const v = lireFormulaire($("f-rapp"));
      const annees = Array.from({ length: NB_ANNEES }, (_, i) => {
        const a = { annee: v[`a${i}_annee`] };
        for (const [cle] of LIGNES_RAPP) a[cle] = v[`a${i}_${cle}`];
        return a;
      });
      const r = M.rapp(annees, v.tsr);
      const sy = r.synthese;
      const evalues = 4 - sy.incomplet;
      verdictBloc("rapp-synthese", v.nom, sy.alerte ? "alerte" : sy.vigilance ? "vigilance" : evalues ? "ok" : "",
        evalues === 0 ? "Saisissez au moins deux exercices pour évaluer les ratios."
          : `${sy.ok} ratio${sy.ok > 1 ? "s" : ""} conforme${sy.ok > 1 ? "s" : ""} sur ${evalues} évalué${evalues > 1 ? "s" : ""}` +
            (sy.vigilance ? ` · ${sy.vigilance} à surveiller` : "") + (sy.alerte ? ` · ${sy.alerte} en alerte` : "") + ` (${r.exercices} exercice${r.exercices > 1 ? "s" : ""} saisi${r.exercices > 1 ? "s" : ""}).`);
      $("rapp-ratios").replaceChildren(...r.ratios.map(carteRatio));
    }
    function chiffresRatio(x) {
      const periode = x.serie.length >= 2 ? `${x.serie[0].annee} → ${x.serie[x.serie.length - 1].annee}` : "";
      if (x.verdict === "incomplet" || x.verdict === "na") return null;
      if (x.cle === "actions") return [`${f(fNb2, x.debut)} → ${f(fNb2, x.fin)} M`, `${periode} · ${signe(x.variation)}`];
      if (x.cle === "frais") return [`${f(fPct1, x.debut)} → ${f(fPct1, x.fin)}`, `${periode} · moyenne des années précédentes ${f(fPct1, x.reference)}`];
      if (x.cle === "stocks") return [`${f(fNb0, x.debut)} → ${f(fNb0, x.fin)} jours`, `${periode} · ${signe(x.variation)} vs moyenne précédente`];
      return [`${f(fNb2, x.creation, " €")} créés par action`,
        `(${f(fNb2, x.fin)} − ${f(fNb2, x.debut)}) + ${f(fNb2, x.dividendes)} € de dividendes en ${x.annees} ans · ${signe(x.rendement)} par an, taux sans risque ${f(fPct1, x.tauxSansRisque)}` +
        (x.hausseCours !== null ? `, cours ${signe(x.hausseCours)} par an` : "")];
    }
    function carteRatio(x) {
      const chiffres = chiffresRatio(x);
      const enfants = [
        el("div", { class: "ratio-tete" }, [el("h3", { texte: x.titre }), badge(x.verdict)]),
        chiffres ? el("div", { class: "ratio-corps" }, [
          el("div", { class: "ratio-chiffres" }, [el("span", { texte: chiffres[0] }), el("small", { texte: chiffres[1] })]),
          G.miniCourbe(x.serie.map((p) => p.valeur), `Évolution : ${x.titre}`),
        ]) : null,
        el("p", { texte: x.explication }),
        x.decoteSuggeree ? el("p", { class: "avertissement", texte: "Le dernier exercice dépasse de plus de 10 % la moyenne des années précédentes : appliquez une décote sur les stocks dans le calcul de la VANN (onglet VANN / VANE)." }) : null,
        el("p", { class: "attendu", texte: "Ce que l'on veut voir : " + x.attendu }),
      ];
      return el("div", { class: "bloc ratio" }, enfants);
    }
    function aplatirRapp(ex) {
      const v = { nom: ex.nom, tsr: ex.tauxSansRisque };
      ex.annees.forEach((a, i) => { for (const [k, val] of Object.entries(a)) v[`a${i}_${k}`] = val; });
      return v;
    }
    function rappVide() {
      // Années préremplies : les huit derniers exercices clos.
      const an = new Date().getFullYear();
      const v = {};
      for (let i = 0; i < NB_ANNEES; i++) v[`a${i}_annee`] = an - NB_ANNEES + i;
      return v;
    }

    // ---------------------------------------------------------------- Holding
    function construireHolding() {
      prefixe = "holding";
      const parts = [];
      for (let i = 0; i < NB_PARTICIPATIONS; i++) {
        parts.push(el("input", { name: `p${i}_nom`, "data-type": "texte", type: "text", "aria-label": `Participation ${i + 1} : nom`, placeholder: `Participation ${i + 1}` }));
        parts.push(el("input", { name: `p${i}_valeur`, "data-type": "nombre", type: "text", inputmode: "decimal", "aria-label": `Participation ${i + 1} : valeur en millions`, placeholder: "M€" }));
      }
      $("f-holding").replaceChildren(
        groupe("La holding", [champ("nom", "Nom", "texte"), champ("cours", "Cours actuel (€)"), champ("nbActions", "Nombre d'actions (millions)")]),
        groupe("Participations (valeur actuelle, M€)", [
          el("p", { class: "note", texte: "Cotée : nombre de titres détenus × cours actuel. Non cotée : une valeur prudente." }),
          el("div", { class: "participations" }, parts),
        ]),
        groupe("Bilan de la holding (M€)", [champ("tresorerie", "Trésorerie"), champ("dettes", "Dettes de la holding")]),
      );
    }
    function calculerHolding() {
      const v = lireFormulaire($("f-holding"));
      const participations = [];
      for (let i = 0; i < NB_PARTICIPATIONS; i++) if (estNombre(v[`p${i}_valeur`])) participations.push({ nom: v[`p${i}_nom`] || `Participation ${i + 1}`, valeur: v[`p${i}_valeur`] });
      const r = M.holding({ participations, tresorerie: v.tresorerie, dettes: v.dettes, nbActions: v.nbActions, cours: v.cours });
      verdictBloc("holding-verdict", v.nom, r.verdict.code, r.verdict.texte);
      const Mx = (x) => f(fNb1, x, " M€");
      $("holding-valeurs").replaceChildren(
        ...ligneValeur("Valeur des participations", Mx(r.valeurParticipations)),
        ...ligneValeur("+ Trésorerie", Mx(v.tresorerie ?? 0)),
        ...ligneValeur("− Dettes de la holding", Mx(v.dettes ?? 0)),
        ...ligneValeur("= Actif net réévalué (ANR)", Mx(r.anr), true), sep(),
        ...ligneValeur("ANR par action", f(fNb2, r.anrParAction, " €"), true),
        ...ligneValeur("Cours actuel", f(fNb2, v.cours, " €")),
        ...ligneValeur("Décote sur l'ANR", estNombre(r.decote) ? fPct1.format(r.decote) : vide, true),
        ...ligneValeur(`Prix d'achat maximal (décote de ${fPct0.format(M.SEUILS.holding.decoteAchat)})`, f(fNb2, r.prixMax, " €")),
        ...ligneValeur("Capitalisation boursière", Mx(r.capitalisation)));
      $("holding-parts").replaceChildren(G.barresClassees(r.participations.map((p) => ({ nom: p.nom, valeur: p.valeur, texte: `${Mx(p.valeur)} · ${f(fPct0, p.part)}` })), "Poids des participations"));
    }
    function aplatirHolding(ex) {
      const v = { nom: ex.nom, cours: ex.cours, nbActions: ex.nbActions, tresorerie: ex.tresorerie, dettes: ex.dettes };
      ex.participations.forEach((p, i) => { v[`p${i}_nom`] = p.nom; v[`p${i}_valeur`] = p.valeur; });
      return v;
    }

    // ---------------------------------------------------------------- Mine
    function construireMine() {
      prefixe = "mine";
      const S = M.SEUILS.mine;
      $("f-mine").replaceChildren(
        el("p", { class: "note", texte: "Tous les montants dans la même devise, celle des comptes de la mine (souvent le dollar)." }),
        groupe("La société", [champ("nom", "Nom", "texte"), champ("cours", "Cours de l'action"), champ("nbActions", "Nombre d'actions (millions)")]),
        groupe("Réserves (millions d'onces)", [
          champ("reservesProuvees", `Réserves prouvées (retenues à ${fPct0.format(S.coefProuvees)})`),
          champ("reservesPotentielles", `Réserves potentielles (retenues à ${fPct0.format(S.coefPotentielles)})`),
          champ("reservesProbables", `Réserves probables (retenues à ${fPct0.format(S.coefProbables)})`, "nombre", "Catégories et coefficients de l'analyse d'Oceana Gold citée par le blog."),
        ]),
        groupe("Économie de la mine (par once)", [champ("coursOr", "Cours de l'or ou de l'argent"), champ("coutProduction", "Coût complet de production", "nombre", "Coût de production tout compris (AISC) par once.")]),
        groupe("Bilan (millions)", [
          champ("tresorerie", "Trésorerie"), champ("creances", "Créances"), champ("passifTotal", "Total du passif"),
          champ("investissementsAnnuels", "Investissements annuels", "nombre", `${S.anneesInvestissement} années d'investissements sont retirées.`),
          champ("decotePays", "Décote pour le risque pays (%)", "pourcent", "10 % dans le cas d'Oceana Gold."),
        ]),
      );
      $("mine-precautions").textContent = `Précautions appliquées : or décoté de ${fPct0.format(S.decoteOr)}, marge par once amputée de ${fPct0.format(S.impots)} (impôts et redevances), ` +
        `${S.anneesInvestissement} ans d'investissements retirés, puis marge de sécurité de ${fPct0.format(S.margeSecurite)}. Méthode reprise de l'analyse d'Oceana Gold (2013) du blog.`;
    }
    function calculerMine() {
      const v = lireFormulaire($("f-mine"));
      const r = M.mine(v);
      verdictBloc("mine-verdict", v.nom, r.verdict.code, r.verdict.texte);
      const Mx = (x) => f(fNb1, x, " M");
      const S = r.seuils;
      $("mine-valeurs").replaceChildren(
        ...ligneValeur("Réserves retenues", f(fNb2, r.reservesRetenues, " M oz")),
        ...ligneValeur(`Cours de l'or décoté de ${fPct0.format(S.decoteOr)}`, f(fNb0, r.coursOrDecote, " / oz")),
        ...ligneValeur("Marge par once (− coût de production)", f(fNb0, r.margeOnce, " / oz")),
        ...ligneValeur(`Marge après impôts et redevances (− ${fPct0.format(S.impots)})`, f(fNb0, r.margeNette, " / oz")),
        ...ligneValeur("Valeur des réserves", Mx(r.valeurReserves), true), sep(),
        ...ligneValeur(`+ Trésorerie et créances − passif − ${S.anneesInvestissement} ans d'investissements`, Mx(r.autresActifs)),
        ...ligneValeur("= Valeur brute", Mx(r.valeurBrute)),
        ...ligneValeur("Après décote pour le risque pays", Mx(r.apresPays)),
        ...ligneValeur(`Après marge de sécurité (− ${fPct0.format(S.margeSecurite)})`, Mx(r.valeurFinale), true), sep(),
        ...ligneValeur("Valeur prudente par action", f(fNb2, r.parAction), true),
        ...ligneValeur("Cours actuel", f(fNb2, v.cours)),
        ...ligneValeur("Potentiel", signe(r.potentiel), true),
        ...ligneValeur("Cours de l'or implicite", estNombre(r.coursOrImplicite) ? `${fNb0.format(r.coursOrImplicite)} / oz` : vide));
      if (estNombre(r.coursOrImplicite) && estNombre(v.coursOr)) {
        $("mine-valeurs").append(el("p", { class: "note mine-implicite", texte: `Avec toutes ces précautions, le marché valorise la mine comme si l'once valait ${fNb0.format(r.coursOrImplicite)}, contre ${fNb0.format(v.coursOr)} aujourd'hui.` }));
      }
    }

    // ---------------------------------------------------------------- Qualité « action idéale » (radar Buffett)
    function construireQualite() {
      prefixe = "qualite";
      $("f-qualite").replaceChildren(
        el("p", { class: "note", texte: "Montants en millions, dans la devise des comptes. Critères de la fiche « Buffett et les états financiers »." }),
        groupe("La société", [champ("nom", "Nom", "texte")]),
        groupe("Compte de résultat (dernier exercice)", [
          champ("chiffreAffaires", "Chiffre d'affaires"), champ("resultatBrut", "Résultat brut (marge brute)"),
          champ("frais", "Frais commerciaux et administratifs"), champ("rd", "Recherche et développement"),
          champ("resultatExploitation", "Résultat d'exploitation"), champ("interets", "Charges d'intérêts", "nombre", "Laisser vide si non publiées."),
          champ("resultatNet", "Résultat net"),
        ]),
        groupe("Croissance du résultat net", [champ("resultatNetDebut", "Résultat net il y a N années"), champ("annees", "N (nombre d'années, 4 à 10)")]),
        groupe("Bilan", [champ("detteLT", "Dette à long terme"), champ("totalDettes", "Total des dettes (passif)"), champ("capitauxPropres", "Capitaux propres")]),
        groupe("Quatre derniers exercices", [champ("capex4ans", "Investissements (capex) cumulés"), champ("resultatNet4ans", "Résultats nets cumulés")]),
      );
    }
    const formatCritere = (c, v) => (!estNombre(v) ? "non renseigné" : c.unite === "ans" ? `${fNb1.format(v)} an${v >= 2 ? "s" : ""}` : c.unite === "x" ? fNb2.format(v) : fPct1.format(v) + (c.unite === "%/an" ? " par an" : ""));
    const formatSeuil = (c) => (c.sens === "min" ? "≥ " : "≤ ") + (c.unite === "ans" ? `${c.seuil} ans` : c.unite === "x" ? fNb1.format(c.seuil) : fPct0.format(c.seuil) + (c.unite === "%/an" ? " par an" : ""));
    function calculerQualite() {
      const v = lireFormulaire($("f-qualite"));
      const r = M.qualite(Object.assign({}, v, { resultatNetFin: v.resultatNet }));
      verdictBloc("qualite-verdict", v.nom, r.evalues === 0 ? "" : r.respectes === r.evalues ? "ok" : r.respectes >= r.evalues / 2 ? "vigilance" : "alerte",
        r.evalues === 0 ? "Saisissez les comptes pour évaluer les critères." : `${r.respectes} critère${r.respectes > 1 ? "s" : ""} respecté${r.respectes > 1 ? "s" : ""} sur ${r.evalues} évalué${r.evalues > 1 ? "s" : ""}.`);
      $("qualite-radar").replaceChildren(G.radar(r.criteres.map((c) => ({ court: c.court, titre: c.titre, score: c.score, texte: formatCritere(c, c.valeur), seuil: formatSeuil(c), respecte: c.respecte })),
        `Radar de qualité : ${r.respectes} critères respectés sur ${r.evalues}`));
      $("qualite-criteres").replaceChildren(...r.criteres.map((c) => el("li", { class: c.respecte === null ? "na" : c.respecte ? "oui-ligne" : "non-ligne" }, [
        el("span", { class: "critere-icone", texte: c.respecte === null ? "–" : c.respecte ? "✓" : "✕", "aria-label": c.respecte === null ? "non évalué" : c.respecte ? "respecté" : "non respecté" }),
        el("span", { class: "critere-nom", texte: c.titre }),
        el("span", { class: "critere-valeur", texte: formatCritere(c, c.valeur) }),
        el("span", { class: "critere-seuil", texte: formatSeuil(c) }),
      ])));
    }

    // ---------------------------------------------------------------- Outils et fiches
    const OUTILS = {
      vann: { note: "VANN, VANE et VANT à partir du bilan. Montants en millions d'euros, cours en euros.",
        lire: () => ctx.vann.lire(), remplir: (v) => ctx.vann.remplir(v), exemple: () => ctx.vann.exemple, videParDefaut: () => null },
      rapp: { note: "Les quatre ratios publics de la RAPP sur huit exercices : jugent la direction, pas le prix.",
        lire: () => lireFormulaire($("f-rapp")), remplir: (v) => { remplirFormulaire($("f-rapp"), v); calculerRapp(); }, exemple: () => aplatirRapp(M.EXEMPLE_RAPP), videParDefaut: rappVide },
      holding: { note: "Actif net réévalué (ANR) d'une holding : achat quand elle cote au moins 30 % sous son ANR.",
        lire: () => lireFormulaire($("f-holding")), remplir: (v) => { remplirFormulaire($("f-holding"), v); calculerHolding(); }, exemple: () => aplatirHolding(M.EXEMPLE_HOLDING), videParDefaut: () => null },
      qualite: { note: "L'« action idéale » selon les critères de Buffett : marges, croissance, dette, investissements.",
        lire: () => lireFormulaire($("f-qualite")), remplir: (v) => { remplirFormulaire($("f-qualite"), v); calculerQualite(); }, exemple: () => Object.assign({}, M.EXEMPLE_APPLE), videParDefaut: () => null },
      mine: { note: "Valeur prudente d'une mine d'or ou d'argent à partir de ses réserves, sans parier sur une hausse du métal.",
        lire: () => lireFormulaire($("f-mine")), remplir: (v) => { remplirFormulaire($("f-mine"), v); calculerMine(); }, exemple: () => Object.assign({}, M.EXEMPLE_MINE), videParDefaut: () => null },
    };
    let outilActif = "vann";

    function afficherOutil(cle) {
      outilActif = cle;
      document.querySelectorAll("#sous-onglets button").forEach((b) => (b.dataset.outil === cle ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current")));
      for (const k of Object.keys(OUTILS)) $("outil-" + k).hidden = k !== cle;
      $("outil-note").textContent = OUTILS[cle].note;
      $("fiche-etat").textContent = "";
      afficherFiches();
    }

    const fichesDe = (cle) => (ctx.etat.pf ? ctx.etat.pf.analyses.filter((a) => a.outil === cle) : []).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

    function afficherFiches(selection) {
      const fiches = fichesDe(outilActif);
      $("fiche-liste").replaceChildren(el("option", { value: "", texte: fiches.length ? "Nouvelle fiche" : "Aucune fiche enregistrée" }),
        ...fiches.map((a) => el("option", { value: a.id, texte: a.nom })));
      $("fiche-liste").value = selection || "";
      $("fiche-supprimer").disabled = !selection;
    }

    function enregistrerFiche() {
      const pf = ctx.etat.pf; if (!pf) return;
      const valeurs = OUTILS[outilActif].lire();
      const nom = String(valeurs.nom || "").trim();
      if (!nom) { $("fiche-etat").textContent = "Donnez un nom à la société avant d'enregistrer la fiche."; return; }
      const existante = pf.analyses.find((a) => a.outil === outilActif && a.nom.toLowerCase() === nom.toLowerCase());
      if (!existante && pf.analyses.length >= Donnees.MAX_ANALYSES) { $("fiche-etat").textContent = `Limite de ${Donnees.MAX_ANALYSES} fiches atteinte : supprimez-en une.`; return; }
      const fiche = Donnees.normaliserAnalyse({ id: existante && existante.id, outil: outilActif, nom, valeurs, modifieLe: new Date().toISOString() });
      if (existante) pf.analyses[pf.analyses.indexOf(existante)] = fiche; else pf.analyses.push(fiche);
      ctx.enregistrer();
      afficherFiches(fiche.id);
      $("fiche-etat").textContent = `Fiche « ${nom} » ${existante ? "mise à jour" : "enregistrée"}` + (ctx.etat.mode === "demo" ? " (démonstration : elle ne sera pas conservée)." : ", chiffrée avec le reste du portefeuille.");
    }

    function supprimerFiche() {
      const pf = ctx.etat.pf, id = $("fiche-liste").value;
      const fiche = pf && pf.analyses.find((a) => a.id === id);
      if (!fiche || !window.confirm(`Supprimer la fiche « ${fiche.nom} » ?`)) return;
      pf.analyses = pf.analyses.filter((a) => a.id !== id);
      ctx.enregistrer();
      afficherFiches();
      $("fiche-etat").textContent = `Fiche « ${fiche.nom} » supprimée.`;
    }

    function installer() {
      construireRapp(); construireHolding(); construireMine(); construireQualite();
      $("f-qualite").addEventListener("input", calculerQualite);
      $("f-rapp").addEventListener("input", calculerRapp);
      $("f-holding").addEventListener("input", calculerHolding);
      $("f-mine").addEventListener("input", calculerMine);
      for (const id of ["f-rapp", "f-holding", "f-mine", "f-qualite"]) $(id).addEventListener("submit", (e) => e.preventDefault());
      document.querySelectorAll("#sous-onglets button").forEach((b) => b.addEventListener("click", () => afficherOutil(b.dataset.outil)));
      $("fiche-liste").addEventListener("change", () => {
        const fiche = ctx.etat.pf && ctx.etat.pf.analyses.find((a) => a.id === $("fiche-liste").value);
        $("fiche-supprimer").disabled = !fiche;
        if (fiche) { OUTILS[outilActif].remplir(fiche.valeurs); $("fiche-etat").textContent = `Fiche « ${fiche.nom} » chargée.`; }
      });
      $("fiche-enregistrer").addEventListener("click", enregistrerFiche);
      $("fiche-supprimer").addEventListener("click", supprimerFiche);
      $("fiche-exemple").addEventListener("click", () => { OUTILS[outilActif].remplir(OUTILS[outilActif].exemple()); afficherFiches(); $("fiche-etat").textContent = "Exemple fictif chargé."; });
      $("fiche-vider").addEventListener("click", () => { OUTILS[outilActif].remplir(OUTILS[outilActif].videParDefaut()); afficherFiches(); $("fiche-etat").textContent = ""; });
      reinitialiser();
    }

    /** Remet chaque outil sur son exemple fictif (au démarrage et au verrouillage). */
    function reinitialiser() {
      for (const o of Object.values(OUTILS)) o.remplir(o.exemple());
      afficherOutil("vann");
    }

    /** Ouvre l'outil VANN / VANE sur une société (formulaire vidé, nom prérempli). */
    function analyserSociete(nom) {
      afficherOutil("vann");
      ctx.vann.remplir({ nom });
      $("fiche-etat").textContent = `Analyse de « ${nom} » : saisissez son bilan.`;
    }

    return { installer, reinitialiser, afficherFiches: () => afficherFiches(), afficherOutil, analyserSociete };
  }

  racine.DecotesVueAnalyses = { creer };
})(typeof globalThis !== "undefined" ? globalThis : this);
