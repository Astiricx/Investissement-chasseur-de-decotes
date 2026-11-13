/* Suivi « Smart Money » : mouvements des gérants de référence (logique pure).
   Les mouvements sont saisis ou importés par l'utilisateur à partir des lettres et reportings des fonds :
   il n'existe pas de source publique interrogeable depuis un navigateur sans serveur.
   Ce module agrège les mouvements par société et par thème, sur une période donnée. */
(function (racine) {
  "use strict";
  const sousNode = typeof module !== "undefined" && module.exports;
  const Donnees = sousNode ? require("./donnees.js") : racine.DecotesDonnees;
  const CSV = sousNode ? require("./csv.js") : racine.DecotesCSV;

  const ACHATS = ["entree", "renforcement"], VENTES = ["allegement", "sortie"];
  const simplifier = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  /** Mouvements de la période : depuisJours = null pour tout garder. Les mouvements sans date sont toujours gardés. */
  function filtrer(mouvements, depuisJours, maintenant) {
    if (!depuisJours) return mouvements.slice();
    const d = maintenant || new Date();
    const limite = new Date(d.getFullYear(), d.getMonth(), d.getDate() - depuisJours);
    const iso = `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, "0")}-${String(limite.getDate()).padStart(2, "0")}`;
    return mouvements.filter((m) => !m.date || m.date >= iso);
  }

  /**
   * Agrégation par société : nombre de fonds acheteurs et vendeurs, solde (acheteurs − vendeurs), dernier mouvement.
   * Une même société est reconnue par son code, sinon par son nom.
   */
  function parSociete(mouvements) {
    const groupes = new Map();
    for (const m of mouvements) {
      const cle = m.code || "nom:" + simplifier(m.societe);
      if (!groupes.has(cle)) groupes.set(cle, { societe: m.societe, code: m.code, theme: m.theme, acheteurs: new Set(), vendeurs: new Set(), mouvements: [], dernier: null });
      const g = groupes.get(cle);
      g.mouvements.push(m);
      if (!g.theme && m.theme) g.theme = m.theme;
      if (ACHATS.includes(m.mouvement)) g.acheteurs.add(m.fonds);
      if (VENTES.includes(m.mouvement)) g.vendeurs.add(m.fonds);
      if (m.date && (!g.dernier || m.date > g.dernier)) g.dernier = m.date;
    }
    return [...groupes.values()].map((g) => ({
      societe: g.societe, code: g.code, theme: g.theme, dernier: g.dernier, mouvements: g.mouvements.length,
      acheteurs: [...g.acheteurs], vendeurs: [...g.vendeurs], solde: g.acheteurs.size - g.vendeurs.size,
      consensus: g.acheteurs.size >= 2 && g.vendeurs.size === 0,
    })).sort((a, b) => b.solde - a.solde || b.acheteurs.length - a.acheteurs.length || (b.dernier || "").localeCompare(a.dernier || "") || a.societe.localeCompare(b.societe, "fr"));
  }

  /** Solde des mouvements par thème (énergie, cuivre…) : achats − ventes, pour lire les rotations de fond. */
  function parTheme(mouvements) {
    const t = new Map();
    for (const m of mouvements) {
      const theme = m.theme || "Sans thème";
      if (!t.has(theme)) t.set(theme, { theme, achats: 0, ventes: 0 });
      const x = t.get(theme);
      if (ACHATS.includes(m.mouvement)) x.achats++; else x.ventes++;
    }
    return [...t.values()].map((x) => Object.assign(x, { solde: x.achats - x.ventes })).sort((a, b) => b.solde - a.solde || b.achats - a.achats);
  }

  function synthese(mouvements, depuisJours, maintenant) {
    const m = filtrer(mouvements, depuisJours, maintenant);
    const societes = parSociete(m);
    return {
      mouvements: m.slice().sort((a, b) => (b.date || "").localeCompare(a.date || "")),
      societes, themes: parTheme(m),
      fonds: [...new Set(m.map((x) => x.fonds))].sort((a, b) => a.localeCompare(b, "fr")),
      consensus: societes.filter((s) => s.consensus).length,
    };
  }

  /** Lecture d'un CSV de mouvements : Date ; Fonds ; Gérant ; Société ; Code ; Mouvement ; Thème ; Source ; Note. */
  function lireCSV(texte) {
    const tableau = CSV.decouper(texte, CSV.detecterSeparateur(texte));
    const COL = { date: /^date$/, fonds: /^(fonds|fond|gestion|societe de gestion)$/, gerant: /^(gerant|gerante|gestionnaire)$/, societe: /^(societe|entreprise|valeur|titre|nom)$/,
      code: /^(code|ticker|isin|code bourse)$/, mouvement: /^(mouvement|operation|type|sens)$/, theme: /^(theme|secteur)$/, source: /^(source|lien)$/, note: /^(note|notes|commentaire)$/ };
    let pos = -1, idx = null;
    for (let i = 0; i < Math.min(tableau.length, 20) && pos < 0; i++) {
      const trouve = {};
      tableau[i].forEach((c, j) => { const s = simplifier(c); for (const [k, re] of Object.entries(COL)) if (!(k in trouve) && re.test(s)) trouve[k] = j; });
      if ("fonds" in trouve && "societe" in trouve && "mouvement" in trouve) { pos = i; idx = trouve; }
    }
    if (pos < 0) return { mouvements: [], ignores: [], erreur: "Colonnes introuvables : il faut au moins « Fonds », « Société » et « Mouvement »." };
    const mouvements = [], ignores = [];
    for (let i = pos + 1; i < tableau.length; i++) {
      const c = (k) => (k in idx ? String(tableau[i][idx[k]] ?? "").trim() : "");
      if (!c("societe") && !c("fonds")) continue;
      const m = Donnees.normaliserMouvement({ date: CSV.lireDate(c("date")), fonds: c("fonds"), gerant: c("gerant"), societe: c("societe"), code: c("code"),
        mouvement: c("mouvement"), theme: c("theme"), source: c("source"), note: c("note") });
      if (m) mouvements.push(m); else ignores.push({ numero: i + 1, raison: `${c("societe") || "?"} : fonds, société ou mouvement manquant ou illisible` });
    }
    return { mouvements, ignores, erreur: null };
  }

  /**
   * Exemple d'après la vidéo sur William Higgons et l'article d'Épargnant 3.0 (mis à jour le 29/09/2025).
   * Les entrées sur SEB et Électricité de Strasbourg sont citées dans la vidéo, sans date ni source écrite trouvée :
   * elles sont signalées « à vérifier ».
   */
  const EXEMPLE = Object.freeze([
    { date: null, fonds: "Indépendance France Small & Mid", gerant: "William Higgons", societe: "SEB", code: "SK", mouvement: "entree", theme: "Consommation",
      source: "Citée dans la vidéo sur William Higgons, à vérifier dans le reporting mensuel du fonds", note: "" },
    { date: null, fonds: "Indépendance France Small & Mid", gerant: "William Higgons", societe: "Électricité de Strasbourg", code: "ELEC", mouvement: "entree", theme: "Énergie",
      source: "Citée dans la vidéo sur William Higgons, à vérifier dans le reporting mensuel du fonds", note: "" },
    { date: "2025-08-31", fonds: "Indépendance France Small & Mid", gerant: "William Higgons", societe: "Technip Energies", code: "TE", mouvement: "renforcement", theme: "Énergie",
      source: "Épargnant 3.0, article mis à jour le 29/09/2025 : « principaux investissements » à fin août 2025", note: "Libellé « principal investissement » : entrée ou renforcement non précisé" },
    { date: "2025-08-31", fonds: "Indépendance France Small & Mid", gerant: "William Higgons", societe: "Viel et Compagnie", code: "VIL", mouvement: "renforcement", theme: "Finance",
      source: "Épargnant 3.0, article mis à jour le 29/09/2025 : « principaux investissements » à fin août 2025", note: "Libellé « principal investissement » : entrée ou renforcement non précisé" },
  ]);

  const api = { filtrer, parSociete, parTheme, synthese, lireCSV, EXEMPLE, ACHATS, VENTES };
  if (sousNode) module.exports = api;
  else racine.DecotesGerants = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
